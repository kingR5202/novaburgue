// Cache compartilhado (em instâncias Vercel isso é limitado, mas ajuda em picos)
// Para produção real, um Redis seria o ideal, mas aqui usamos o cache em memória
// que o proxy.js também acessará se estiver na mesma instância.
const confirmedPayments = new Map();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        const body = req.body;
        console.log('[Webhook NovaPlex] Recebido:', JSON.stringify(body));

        // A NovaPlex envia notificações de depósito
        // Estrutura comum: { id, transaction_id, status, amount, external_id, type: 'Deposit' }
        
        const status = (body.status || '').toLowerCase();
        const transactionId = body.transaction_id || body.id || body.external_id;

        // Status que consideramos como pago
        const paidStatuses = ['completed', 'succeeded', 'paid', 'approved', 'confirmed', 'settled'];

        if (paidStatuses.includes(status)) {
            console.log(`[Webhook NovaPlex] PAGAMENTO CONFIRMADO: ${transactionId} (${status})`);
            
            // Armazena no cache global para o proxy.js consultar
            if (transactionId) {
                confirmedPayments.set(transactionId, {
                    status: 'paid',
                    timestamp: Date.now(),
                    data: body
                });
            }
        } else {
            console.log(`[Webhook NovaPlex] Status ignorado: ${transactionId} (${status})`);
        }

        // Sempre responder 200 para a NovaPlex não tentar reenviar
        return res.status(200).json({ received: true });

    } catch (error) {
        console.error('[Webhook NovaPlex] Erro:', error);
        // Mesmo com erro, retornamos 200 para evitar loops de retry do gateway se o erro for de processamento nosso
        return res.status(200).json({ error: 'Erro interno', message: error.message });
    }
}
