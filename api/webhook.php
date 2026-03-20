<?php
// ============================================================
// WEBHOOK NOVAPLEX — Versão PHP para Hostinger
// Recebe notificações de pagamento da NovaPlex
// ============================================================

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

try {
    $body = json_decode(file_get_contents('php://input'), true);
    
    // Log do webhook
    $logFile = sys_get_temp_dir() . '/novaplex_webhook.log';
    $logEntry = date('Y-m-d H:i:s') . ' | ' . json_encode($body) . "\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND);
    
    $status = strtolower($body['status'] ?? '');
    $transactionId = $body['transaction_id'] ?? $body['id'] ?? $body['external_id'] ?? '';
    
    $paidStatuses = ['completed', 'succeeded', 'paid', 'approved', 'confirmed', 'settled'];
    
    if (in_array($status, $paidStatuses) && !empty($transactionId)) {
        // Salvar no cache de pagamentos confirmados
        $cacheFile = sys_get_temp_dir() . '/novaplex_confirmed.json';
        $confirmed = [];
        
        if (file_exists($cacheFile)) {
            $confirmed = json_decode(file_get_contents($cacheFile), true) ?: [];
        }
        
        $confirmed[$transactionId] = [
            'status' => 'paid',
            'timestamp' => time(),
            'data' => $body
        ];
        
        // Limpar entradas antigas (mais de 24h)
        foreach ($confirmed as $key => $entry) {
            if (time() - ($entry['timestamp'] ?? 0) > 86400) {
                unset($confirmed[$key]);
            }
        }
        
        file_put_contents($cacheFile, json_encode($confirmed));
    }
    
    http_response_code(200);
    echo json_encode(['received' => true]);
    
} catch (Exception $e) {
    http_response_code(200);
    echo json_encode(['error' => 'Erro interno', 'message' => $e->getMessage()]);
}
