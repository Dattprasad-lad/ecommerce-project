<?php
// Database Configuration
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASSWORD', '');
define('DB_NAME', 'smarthub');

// Create connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

// Check connection
if ($conn->connect_error) {
    die(json_encode(['success' => false, 'message' => 'Database connection failed: ' . $conn->connect_error]));
}

// Set charset
$conn->set_charset("utf8");

// API Response Headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Utility function for JSON response
function sendResponse($success, $message = '', $data = null) {
    $response = [
        'success' => $success,
        'message' => $message
    ];
    
    if ($data !== null) {
        if (is_array($data)) {
            foreach ($data as $key => $value) {
                $response[$key] = $value;
            }
        } else {
            $response['data'] = $data;
        }
    }
    
    echo json_encode($response, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit();
}

// Get Bearer Token — handles XAMPP Apache header stripping
function getBearerToken() {
    $header = null;

    // Check all possible locations Apache/PHP may put the Authorization header
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $header = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['HTTP_X_AUTHORIZATION'])) {
        $header = $_SERVER['HTTP_X_AUTHORIZATION'];
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();
        // case-insensitive search
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                $header = $value;
                break;
            }
        }
    }

    // Also check GET/POST fallback (for environments that strip headers)
    if (empty($header) && !empty($_GET['_token'])) {
        return $_GET['_token'];
    }
    if (empty($header) && !empty($_POST['_token'])) {
        return $_POST['_token'];
    }

    if (!empty($header) && preg_match('/Bearer\s(\S+)/', $header, $matches)) {
        return $matches[1];
    }
    return null;
}

// Verify JWT Token (Simple implementation)
function verifyToken($token) {
    // For simplicity, we're using user_id from session
    // In production, implement proper JWT verification
    if (isset($_SESSION['user_id'])) {
        return $_SESSION['user_id'];
    }
    return null;
}

// Session management
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
?>
