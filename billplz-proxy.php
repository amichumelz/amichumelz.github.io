<?php
// BillPlz Proxy — letak file ni sama folder dengan index.html
// ⚠️  Jangan share file ni atau dedahkan ke public

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ─── Config ───────────────────────────────────────────────────
$SECRET_KEY    = 'a811b5f5-a685-4eea-a4ba-db0f7c9777d5';
$SANDBOX       = false; // true = sandbox, false = production
// ──────────────────────────────────────────────────────────────

$BASE_URL = $SANDBOX
    ? 'https://www.billplz-sandbox.com/api/v3/bills'
    : 'https://www.billplz.com/api/v3/bills';

$input = json_decode(file_get_contents('php://input'), true);

$required = ['collection_id', 'email', 'mobile', 'name', 'amount', 'description', 'redirect_url'];
foreach ($required as $field) {
    if (empty($input[$field])) {
        http_response_code(400);
        echo json_encode(['error' => "Field '$field' diperlukan."]);
        exit;
    }
}

$postData = http_build_query([
    'collection_id' => $input['collection_id'],
    'email'         => $input['email'],
    'mobile'        => $input['mobile'],
    'name'          => $input['name'],
    'amount'        => $input['amount'],
    'description'   => $input['description'],
    'redirect_url'  => $input['redirect_url'],
    'callback_url'  => $input['redirect_url'],
]);

$ch = curl_init($BASE_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $postData,
    CURLOPT_USERPWD        => $SECRET_KEY . ':',
    CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
    CURLOPT_TIMEOUT        => 15,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(500);
    echo json_encode(['error' => 'Gagal sambung ke BillPlz: ' . $curlError]);
    exit;
}

http_response_code($httpCode);
echo $response;
