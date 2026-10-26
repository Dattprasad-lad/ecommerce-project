<?php
// ─────────────────────────────────────────────────────────────
//  SmartHub Auth Handler
//  signup  → saves user (unverified) → OTP sent via otp.php
//  login   → verifies password → OTP sent via otp.php
//  verify_otp handled by otp.php
// ─────────────────────────────────────────────────────────────
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/email.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$input  = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

switch ($action) {
    case 'signup':       handleSignup($input, $conn); break;
    case 'login':        handleLogin($input, $conn);  break;
    case 'admin_login':  handleAdminLogin($input, $conn); break;
    default:             sendResponse(false, 'Invalid action');
}

// ── SIGNUP: save user, trigger OTP ───────────────────────────
function handleSignup($data, $conn) {
    // Validate fields
    if (empty($data['name']) || empty($data['email']) || empty($data['phone']) ||
        empty($data['address']) || empty($data['password'])) {
        sendResponse(false, 'All fields are required'); return;
    }
    if (strlen($data['phone']) !== 10 || !is_numeric($data['phone'])) {
        sendResponse(false, 'Phone number must be 10 digits'); return;
    }
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        sendResponse(false, 'Invalid email format'); return;
    }
    if (strlen($data['password']) < 6) {
        sendResponse(false, 'Password must be at least 6 characters'); return;
    }

    // Check existing
    $stmt = $conn->prepare("SELECT id, is_verified FROM users WHERE email = ?");
    $stmt->bind_param('s', $data['email']);
    $stmt->execute();
    $existing = $stmt->get_result();
    $stmt->close();

    if ($existing->num_rows > 0) {
        $row = $existing->fetch_assoc();
        if ($row['is_verified']) {
            sendResponse(false, 'This email is already registered. Please log in.');
        } else {
            // Old unverified account — mark it verified now and tell user to log in
            $upd = $conn->prepare("UPDATE users SET is_verified = TRUE WHERE id = ?");
            $upd->bind_param('i', $row['id']);
            $upd->execute();
            $upd->close();
            sendResponse(false, 'This email is already registered. Please log in.');
        }
        return;
    }

    // Insert verified user (no OTP required for signup)
    $hashed = password_hash($data['password'], PASSWORD_BCRYPT);
    $stmt   = $conn->prepare(
        "INSERT INTO users (name, email, phone, address, password, is_verified)
         VALUES (?, ?, ?, ?, ?, TRUE)"
    );
    $stmt->bind_param('sssss',
        $data['name'], $data['email'], $data['phone'], $data['address'], $hashed
    );
    if (!$stmt->execute()) {
        sendResponse(false, 'Error creating account: ' . $stmt->error); return;
    }
    $userId = $conn->insert_id;
    $stmt->close();

    // Auto-login: generate token and return user data
    $token = bin2hex(random_bytes(32));
    $upd   = $conn->prepare("UPDATE users SET auth_token = ? WHERE id = ?");
    $upd->bind_param('si', $token, $userId);
    $upd->execute();
    $upd->close();

    sendResponse(true, 'Account created successfully!', [
        'user'  => [
            'id'      => $userId,
            'name'    => $data['name'],
            'email'   => $data['email'],
            'phone'   => $data['phone'],
            'address' => $data['address'],
        ],
        'token' => $token
    ]);
}

// ── LOGIN: verify password → trigger OTP ─────────────────────
function handleLogin($data, $conn) {
    if (empty($data['email']) || empty($data['password'])) {
        sendResponse(false, 'Email and password are required'); return;
    }

    $stmt = $conn->prepare(
        "SELECT id, name, email, phone, address, password, is_admin, is_verified FROM users WHERE email = ?"
    );
    $stmt->bind_param('s', $data['email']);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        sendResponse(false, 'Invalid email or password'); return;
    }

    $user = $result->fetch_assoc();
    $stmt->close();

    if (!password_verify($data['password'], $user['password'])) {
        sendResponse(false, 'Invalid email or password'); return;
    }

    if (!$user['is_verified']) {
        // Mark as verified now (legacy unverified accounts)
        $upd = $conn->prepare("UPDATE users SET is_verified = TRUE WHERE id = ?");
        $upd->bind_param('i', $user['id']);
        $upd->execute();
        $upd->close();
    }

    // Password correct — log in directly (no OTP for login)
    $token = bin2hex(random_bytes(32));
    $upd   = $conn->prepare("UPDATE users SET auth_token = ? WHERE id = ?");
    $upd->bind_param('si', $token, $user['id']);
    $upd->execute();
    $upd->close();

    sendResponse(true, 'Login successful', [
        'user'  => [
            'id'      => $user['id'],
            'name'    => $user['name'],
            'email'   => $user['email'],
            'phone'   => $user['phone'],
            'address' => $user['address'],
            'is_admin'=> $user['is_admin'],
        ],
        'token' => $token
    ]);
}

// ── ADMIN LOGIN: password only, no OTP ───────────────────────
function handleAdminLogin($data, $conn) {
    if (empty($data['email']) || empty($data['password'])) {
        sendResponse(false, 'Email and password are required'); return;
    }

    $stmt = $conn->prepare(
        "SELECT id, name, email, password, is_admin, is_verified FROM users WHERE email = ?"
    );
    $stmt->bind_param('s', $data['email']);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();

    if ($result->num_rows === 0) {
        sendResponse(false, 'Invalid email or password'); return;
    }

    $user = $result->fetch_assoc();

    if (!password_verify($data['password'], $user['password'])) {
        sendResponse(false, 'Invalid email or password'); return;
    }

    if (!$user['is_admin']) {
        sendResponse(false, 'Access denied. Admin privileges required.'); return;
    }

    if (!$user['is_verified']) {
        sendResponse(false, 'Account not verified.'); return;
    }

    // Generate token and store it
    $token = bin2hex(random_bytes(32));
    $upd   = $conn->prepare("UPDATE users SET auth_token = ? WHERE id = ?");
    $upd->bind_param('si', $token, $user['id']);
    $upd->execute();
    $upd->close();

    sendResponse(true, 'Admin login successful', [
        'user'  => [
            'id'    => $user['id'],
            'name'  => $user['name'],
            'email' => $user['email'],
        ],
        'token' => $token
    ]);
}
