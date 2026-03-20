// Helper para gerar um CPF válido aleatório para transações anônimas
function generateCPF() {
    const rnd = (n) => Math.round(Math.random() * n);
    const mod = (dividend, divisor) => Math.round(dividend - (Math.floor(dividend / divisor) * divisor));
    const n = Array(9).fill(0).map(() => rnd(9));
    let d1 = n.reduce((total, num, i) => total + (num * (10 - i)), 0);
    d1 = 11 - mod(d1, 11);
    if (d1 >= 10) d1 = 0;
    let d2 = n.reduce((total, num, i) => total + (num * (11 - i)), 0) + (d1 * 2);
    d2 = 11 - mod(d2, 11);
    if (d2 >= 10) d2 = 0;
    return [...n, d1, d2].join('');
}

// Cache do JWT em memória
let cachedJwt = null;
let cachedJwtExpiry = 0;

// Cache de pagamentos confirmados (compartilhado entre proxy e webhook se na mesma instância)
const confirmedPayments = new Map();

async function getNovaplexToken() {
    if (cachedJwt && Date.now() < cachedJwtExpiry) {
        return cachedJwt;
    }

    const { NOVAPLEX_CLIENT_ID, NOVAPLEX_CLIENT_SECRET, NOVAPLEX_TOKEN } = process.env;

    if (NOVAPLEX_TOKEN) return NOVAPLEX_TOKEN;

    if (!NOVAPLEX_CLIENT_ID || !NOVAPLEX_CLIENT_SECRET) {
        throw new Error('Credenciais NovaPlex ausentes');
    }

    const authResponse = await fetch('https://api.novaplex.com.br/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: NOVAPLEX_CLIENT_ID,
            client_secret: NOVAPLEX_CLIENT_SECRET
        })
    });

    const authData = await authResponse.json();
    if (!authResponse.ok || !authData.token) {
        throw new Error('Autenticação NovaPlex falhou');
    }

    cachedJwt = authData.token;
    cachedJwtExpiry = Date.now() + (50 * 60 * 1000);
    return cachedJwt;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'GET') {
            const { id, action } = req.query;

            if (action === 'track') return res.status(200).json({ status: 'ignored' });
            if (!id) return res.status(400).json({ error: 'ID ausente' });

            // 1. Verificar cache de Webhook
            if (confirmedPayments.has(id)) {
                return res.status(200).json({ status: 'paid', source: 'webhook_cache' });
            }

            // 2. Consulta direta
            const token = await getNovaplexToken();
            const response = await fetch(`https://api.novaplex.com.br/api/payments/deposit/${encodeURIComponent(id)}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                const status = (data.status || data.transaction_status || 'PENDING').toLowerCase();
                const paid = ['completed', 'succeeded', 'paid', 'approved', 'confirmed', 'settled'].includes(status);
                return res.status(200).json({ status: paid ? 'paid' : 'pending' });
            }

            // 3. Busca exaustiva em listas
            const endpoints = [
                'https://api.novaplex.com.br/api/payments/deposit?limit=100',
                'https://api.novaplex.com.br/api/transactions?limit=100'
            ];

            for (const endpoint of endpoints) {
                const r = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
                if (r.ok) {
                    const list = await r.json();
                    const items = Array.isArray(list) ? list : (list.data || []);
                    const found = items.find(d => d.id === id || d.transaction_id === id || d.external_id === id);
                    if (found) {
                        const status = (found.status || 'PENDING').toLowerCase();
                        const paid = ['completed', 'succeeded', 'paid', 'approved', 'confirmed', 'settled'].includes(status);
                        return res.status(200).json({ status: paid ? 'paid' : 'pending' });
                    }
                }
            }

            // 4. Fallback para evitar erro de "não encontrado"
            if (id.startsWith('ord-')) return res.status(200).json({ status: 'pending' });

            return res.status(404).json({ error: 'Não encontrado' });
        }

        if (req.method === 'POST') {
            const { value, amount, metadata } = req.body;
            const finalAmountCents = parseInt(value || amount);
            if (!finalAmountCents) return res.status(400).json({ error: 'Valor obrigatório' });

            const token = await getNovaplexToken();
            const externalId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            
            const payload = {
                amount: finalAmountCents / 100,
                external_id: externalId,
                clientCallbackUrl: `https://${req.headers.host}/api/webhook`,
                payer: {
                    name: metadata?.customer?.nome || 'Cliente',
                    email: (metadata?.customer?.telefone || '11999999999').replace(/\D/g, '') + '@pedido.com',
                    document: generateCPF()
                }
            };

            const response = await fetch('https://api.novaplex.com.br/api/payments/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) return res.status(response.status).json({ error: data.message });

            const qrData = data.qrCodeResponse || {};
            const pixCode = qrData.qrcode || data.qrcode || '';
            
            // Extrair UUID do PIX para ser o ID de polling (mais estável)
            const match = pixCode.match(/at\/([a-fA-F0-9-]{36})/);
            const transactionId = (match && match[1]) || qrData.transactionId || data.id || externalId;

            return res.status(200).json({
                id: transactionId,
                qr_code: pixCode,
                status: 'PENDING',
                amount: finalAmountCents
            });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
