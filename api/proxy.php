// Arquivo removido para evitar conflito de nomes na Vercel. O conteúdo foi movido para proxy-php.php.
// ============================================================
// PROXY NOVAPLEX — Versão PHP para Hostinger
// Equivalente ao api/proxy.js (Vercel)
// ============================================================

require_once __DIR__ . '/config.php';

// CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ============================================================
// HELPERS
// ============================================================

function generateCPF() {
    $n = [];
    for ($i = 0; $i < 9; $i++) {
        $n[] = mt_rand(0, 9);
    }
    
    $d1 = 0;
    for ($i = 0; $i < 9; $i++) {
        $d1 += $n[$i] * (10 - $i);
    }
    $d1 = 11 - ($d1 % 11);
    if ($d1 >= 10) $d1 = 0;
    
    $d2 = 0;
    for ($i = 0; $i < 9; $i++) {
        $d2 += $n[$i] * (11 - $i);
    }
    $d2 += $d1 * 2;
    $d2 = 11 - ($d2 % 11);
    if ($d2 >= 10) $d2 = 0;
    
    $n[] = $d1;
    $n[] = $d2;
    return implode('', $n);
}

function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function curlRequest($url, $method = 'GET', $headers = [], $body = null) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
    }
    
    if (!empty($headers)) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        return ['ok' => false, 'error' => $error, 'status' => 0, 'body' => ''];
    }
    
    return [
        'ok' => $httpCode >= 200 && $httpCode < 300,
        'status' => $httpCode,
        'body' => $response
    ];
}

// ============================================================
// AUTENTICAÇÃO NOVAPLEX (com cache em arquivo)
// ============================================================

function getNovaplexToken() {
    $cacheFile = sys_get_temp_dir() . '/novaplex_jwt_cache.json';
    
    // Verificar cache
    if (file_exists($cacheFile)) {
        $cache = json_decode(file_get_contents($cacheFile), true);
        if ($cache && isset($cache['token']) && isset($cache['expiry']) && time() < $cache['expiry']) {
            return $cache['token'];
        }
    }
    
    if (!NOVAPLEX_CLIENT_ID || !NOVAPLEX_CLIENT_SECRET) {
        throw new Exception('Credenciais NovaPlex ausentes');
    }
    
    $result = curlRequest(
        'https://api.novaplex.com.br/api/auth/login',
        'POST',
        ['Content-Type: application/json'],
        json_encode([
            'client_id' => NOVAPLEX_CLIENT_ID,
            'client_secret' => NOVAPLEX_CLIENT_SECRET
        ])
    );
    
    if (!$result['ok']) {
        throw new Exception('Autenticação NovaPlex falhou (HTTP ' . $result['status'] . ')');
    }
    
    $authData = json_decode($result['body'], true);
    if (!$authData || !isset($authData['token'])) {
        throw new Exception('Autenticação NovaPlex falhou: token ausente');
    }
    
    // Salvar cache (50 minutos)
    $cacheData = [
        'token' => $authData['token'],
        'expiry' => time() + (50 * 60)
    ];
    file_put_contents($cacheFile, json_encode($cacheData));
    
    return $authData['token'];
}

// ============================================================
// VERIFICAR PAGAMENTOS CONFIRMADOS (cache de webhook)
// ============================================================

function getConfirmedPayments() {
    $cacheFile = sys_get_temp_dir() . '/novaplex_confirmed.json';
    if (file_exists($cacheFile)) {
        $data = json_decode(file_get_contents($cacheFile), true);
        if (is_array($data)) return $data;
    }
    return [];
}

// ============================================================
// MAIN HANDLER
// ============================================================

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    // ==================== GET: Verificar status ====================
    if ($method === 'GET') {
        $id = isset($_GET['id']) ? trim($_GET['id']) : '';
        $action = isset($_GET['action']) ? trim($_GET['action']) : '';
        
        if ($action === 'track') {
            jsonResponse(['status' => 'ignored']);
        }
        
        if (empty($id)) {
            jsonResponse(['error' => 'ID ausente'], 400);
        }
        
        // 1. Verificar cache de Webhook
        $confirmed = getConfirmedPayments();
        if (isset($confirmed[$id])) {
            jsonResponse(['status' => 'paid', 'source' => 'webhook_cache']);
        }
        
        // 2. Consulta direta
        $token = getNovaplexToken();
        $result = curlRequest(
            'https://api.novaplex.com.br/api/payments/deposit/' . urlencode($id),
            'GET',
            [
                'Authorization: Bearer ' . $token,
                'Accept: application/json'
            ]
        );
        
        if ($result['ok']) {
            $data = json_decode($result['body'], true);
            $status = strtolower($data['status'] ?? $data['transaction_status'] ?? 'PENDING');
            $paidStatuses = ['completed', 'succeeded', 'paid', 'approved', 'confirmed', 'settled'];
            $isPaid = in_array($status, $paidStatuses);
            jsonResponse(['status' => $isPaid ? 'paid' : 'pending']);
        }
        
        // 3. Busca exaustiva em listas
        $endpoints = [
            'https://api.novaplex.com.br/api/payments/deposit?limit=100',
            'https://api.novaplex.com.br/api/transactions?limit=100'
        ];
        
        foreach ($endpoints as $endpoint) {
            $r = curlRequest($endpoint, 'GET', ['Authorization: Bearer ' . $token]);
            if ($r['ok']) {
                $list = json_decode($r['body'], true);
                $items = isset($list['data']) ? $list['data'] : (is_array($list) ? $list : []);
                foreach ($items as $item) {
                    if (($item['id'] ?? '') === $id || 
                        ($item['transaction_id'] ?? '') === $id || 
                        ($item['external_id'] ?? '') === $id) {
                        $status = strtolower($item['status'] ?? 'PENDING');
                        $paidStatuses = ['completed', 'succeeded', 'paid', 'approved', 'confirmed', 'settled'];
                        $isPaid = in_array($status, $paidStatuses);
                        jsonResponse(['status' => $isPaid ? 'paid' : 'pending']);
                    }
                }
            }
        }
        
        // 4. Fallback
        if (strpos($id, 'ord-') === 0) {
            jsonResponse(['status' => 'pending']);
        }
        
        jsonResponse(['error' => 'Não encontrado'], 404);
    }
    
    // ==================== POST: Criar depósito PIX ====================
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) $input = $_POST;
        
        $value = isset($input['value']) ? intval($input['value']) : 0;
        $amount = isset($input['amount']) ? intval($input['amount']) : 0;
        $finalAmountCents = $value ?: $amount;
        
        if (!$finalAmountCents) {
            jsonResponse(['error' => 'Valor obrigatório'], 400);
        }
        
        $token = getNovaplexToken();
        $externalId = 'ord-' . time() . '-' . mt_rand(0, 999);
        
        $customerName = 'Cliente';
        $customerPhone = '11999999999';
        if (isset($input['metadata']['customer'])) {
            $customer = $input['metadata']['customer'];
            $customerName = $customer['nome'] ?? 'Cliente';
            $customerPhone = preg_replace('/\D/', '', $customer['telefone'] ?? '11999999999');
        }
        
        $payload = [
            'amount' => $finalAmountCents / 100,
            'external_id' => $externalId,
            'clientCallbackUrl' => 'https://' . SITE_DOMAIN . '/api/webhook.php',
            'payer' => [
                'name' => $customerName,
                'email' => $customerPhone . '@pedido.com',
                'document' => generateCPF()
            ]
        ];
        
        $result = curlRequest(
            'https://api.novaplex.com.br/api/payments/deposit',
            'POST',
            [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $token
            ],
            json_encode($payload)
        );
        
        $data = json_decode($result['body'], true);
        
        if (!$result['ok']) {
            jsonResponse(['error' => $data['message'] ?? 'Erro NovaPlex'], $result['status']);
        }
        
        $qrData = $data['qrCodeResponse'] ?? [];
        $pixCode = $qrData['qrcode'] ?? $data['qrcode'] ?? '';
        
        // Extrair UUID do PIX
        $transactionId = $externalId;
        if (preg_match('/at\/([a-fA-F0-9-]{36})/', $pixCode, $matches)) {
            $transactionId = $matches[1];
        } elseif (isset($qrData['transactionId'])) {
            $transactionId = $qrData['transactionId'];
        } elseif (isset($data['id'])) {
            $transactionId = $data['id'];
        }
        
        jsonResponse([
            'id' => $transactionId,
            'qr_code' => $pixCode,
            'status' => 'PENDING',
            'amount' => $finalAmountCents
        ]);
    }
    
    // Método não suportado
    jsonResponse(['error' => 'Método não permitido'], 405);
    
} catch (Exception $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
