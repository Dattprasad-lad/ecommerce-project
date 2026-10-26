<?php
// ─────────────────────────────────────────────────────────────
//  SmartHub OTP Handler
//  Handles: send_otp, verify_otp
//  OTP: 4 digits | Expiry: 10 minutes
// ─────────────────────────────────────────────────────────────
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/email.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

switch ($action) {
    case 'send_otp':       handleSendOTP($input, $conn);      break;
    case 'verify_otp':     handleVerifyOTP($input, $conn);    break;
    case 'reset_password': handleResetPassword($input, $conn); break;
    default:               sendResponse(false, 'Invalid action');
}

// ── Send OTP ──────────────────────────────────────────────────
function handleSendOTP($data, $conn) {
    $email   = trim($data['email']   ?? '');
    $purpose = trim($data['purpose'] ?? ''); // 'signup' or 'login'

    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendResponse(false, 'Invalid email address');
        return;
    }
    if (!in_array($purpose, ['signup', 'login', 'forgot_password'])) {
        sendResponse(false, 'Invalid OTP purpose');
        return;
    }

    // For login: check user exists and is verified
    if ($purpose === 'login') {
        $stmt = $conn->prepare("SELECT id, name, is_verified FROM users WHERE email = ?");
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res->num_rows === 0) {
            sendResponse(false, 'No account found with this email');
            return;
        }
        $user = $res->fetch_assoc();
        $stmt->close();
        $name = $user['name'];
    } else if ($purpose === 'forgot_password') {
        $stmt = $conn->prepare("SELECT id, name FROM users WHERE email = ?");
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res->num_rows === 0) {
            sendResponse(false, 'No account found with this email address.');
            return;
        }
        $user = $res->fetch_assoc();
        $stmt->close();
        $name = $user['name'];
    } else {
        // For signup: get name from request
        $name = trim($data['name'] ?? 'User');
    }

    // Rate limit: max 3 OTPs per email per 10 minutes
    $stmt = $conn->prepare(
        "SELECT COUNT(*) as cnt FROM otp_codes
         WHERE email = ? AND purpose = ? AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)"
    );
    $stmt->bind_param('ss', $email, $purpose);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($row['cnt'] >= 3) {
        sendResponse(false, 'Too many OTP requests. Please wait 10 minutes and try again.');
        return;
    }

    // Invalidate previous unused OTPs for this email+purpose
    $stmt = $conn->prepare("UPDATE otp_codes SET used = TRUE WHERE email = ? AND purpose = ? AND used = FALSE");
    $stmt->bind_param('ss', $email, $purpose);
    $stmt->execute();
    $stmt->close();

    // Generate 4-digit OTP
    $otp        = str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    $expires_at = date('Y-m-d H:i:s', strtotime('+10 minutes'));

    // Store OTP
    $stmt = $conn->prepare(
        "INSERT INTO otp_codes (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)"
    );
    $stmt->bind_param('ssss', $email, $otp, $purpose, $expires_at);
    if (!$stmt->execute()) {
        sendResponse(false, 'Failed to generate OTP');
        return;
    }
    $stmt->close();

    // Send OTP email
    $html = buildOTPEmail($name, $otp, $purpose);
    $subjects = [
        'signup'           => 'Your SmartHub Signup OTP',
        'login'            => 'Your SmartHub Login OTP',
        'forgot_password'  => '🔑 SmartHub Password Reset OTP',
    ];
    $subject = $subjects[$purpose] ?? 'Your SmartHub OTP';

    $sent = sendEmail($email, $name, $subject, $html);

    if ($sent) {
        sendResponse(true, 'OTP sent to ' . $email . '. Check your inbox.');
    } else {
        sendResponse(false, 'Failed to send OTP email. Please try again.');
    }
}

// ── Verify OTP ────────────────────────────────────────────────
function handleVerifyOTP($data, $conn) {
    $email   = trim($data['email']   ?? '');
    $otp     = trim($data['otp']     ?? '');
    $purpose = trim($data['purpose'] ?? '');

    if (!$email || !$otp || !$purpose) {
        sendResponse(false, 'Email, OTP and purpose are required');
        return;
    }

    // Find valid OTP
    $stmt = $conn->prepare(
        "SELECT id FROM otp_codes
         WHERE email = ? AND otp = ? AND purpose = ?
           AND used = FALSE AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1"
    );
    $stmt->bind_param('sss', $email, $otp, $purpose);
    $stmt->execute();
    $res = $stmt->get_result();
    $stmt->close();

    if ($res->num_rows === 0) {
        sendResponse(false, 'Invalid or expired OTP. Please try again.');
        return;
    }

    $otpRow = $res->fetch_assoc();

    // Mark OTP as used
    $stmt = $conn->prepare("UPDATE otp_codes SET used = TRUE WHERE id = ?");
    $stmt->bind_param('i', $otpRow['id']);
    $stmt->execute();
    $stmt->close();

    if ($purpose === 'signup') {
        // Mark user as verified
        $stmt = $conn->prepare("UPDATE users SET is_verified = TRUE, otp_verified = TRUE WHERE email = ?");
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $stmt->close();
        sendResponse(true, 'Email verified successfully! You can now login.');

    } else if ($purpose === 'forgot_password') {
        // OTP correct — issue a short-lived reset token
        $reset_token   = bin2hex(random_bytes(32));
        $reset_expires = date('Y-m-d H:i:s', strtotime('+15 minutes'));
        $stmt = $conn->prepare(
            "UPDATE users SET verify_token = ?, verify_expires_at = ? WHERE email = ?"
        );
        $stmt->bind_param('sss', $reset_token, $reset_expires, $email);
        $stmt->execute();
        $stmt->close();
        sendResponse(true, 'OTP verified! Please set your new password.', [
            'reset_token' => $reset_token,
            'email'       => $email
        ]);

    } else {
        // Login OTP verified — return user data + token
        $stmt = $conn->prepare(
            "SELECT id, name, email, phone, address, is_admin FROM users WHERE email = ?"
        );
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $res  = $stmt->get_result();
        $stmt->close();

        if ($res->num_rows === 0) {
            sendResponse(false, 'User not found');
            return;
        }

        $user  = $res->fetch_assoc();
        $token = bin2hex(random_bytes(32));

        $upd = $conn->prepare("UPDATE users SET auth_token = ? WHERE id = ?");
        $upd->bind_param('si', $token, $user['id']);
        $upd->execute();
        $upd->close();

        sendResponse(true, 'Login successful', ['user' => $user, 'token' => $token]);
    }
}

// ── Reset Password ────────────────────────────────────────────
function handleResetPassword($data, $conn) {
    $email       = trim($data['email']       ?? '');
    $reset_token = trim($data['reset_token'] ?? '');
    $new_password = trim($data['password']   ?? '');

    if (!$email || !$reset_token || !$new_password) {
        sendResponse(false, 'All fields are required'); return;
    }
    if (strlen($new_password) < 6) {
        sendResponse(false, 'Password must be at least 6 characters'); return;
    }

    // Validate token
    $stmt = $conn->prepare(
        "SELECT id FROM users WHERE email = ? AND verify_token = ? AND verify_expires_at > NOW()"
    );
    $stmt->bind_param('ss', $email, $reset_token);
    $stmt->execute();
    $res = $stmt->get_result();
    $stmt->close();

    if ($res->num_rows === 0) {
        sendResponse(false, 'Reset session expired. Please start again.'); return;
    }

    $hashed = password_hash($new_password, PASSWORD_BCRYPT);
    $stmt   = $conn->prepare(
        "UPDATE users SET password = ?, verify_token = NULL, verify_expires_at = NULL WHERE email = ?"
    );
    $stmt->bind_param('ss', $hashed, $email);
    $stmt->execute();
    $stmt->close();

    sendResponse(true, 'Password reset successfully! You can now log in.');
}

// ── OTP Email Template ────────────────────────────────────────
function buildOTPEmail(string $name, string $otp, string $purpose): string {
    $purposeTexts = [
        'signup'          => 'verify your email address',
        'login'           => 'log in to your account',
        'forgot_password' => 'reset your SmartHub password',
    ];
    $purposeText = $purposeTexts[$purpose] ?? 'continue';
    $digits = str_split($otp);
    $boxes  = '';
    foreach ($digits as $d) {
        $boxes .= "<span style=\"display:inline-block;width:52px;height:62px;line-height:62px;
                   text-align:center;font-size:30px;font-weight:900;letter-spacing:0;
                   background:#f0f0ff;border:2px solid #667eea;border-radius:10px;
                   color:#667eea;margin:0 5px;\">$d</span>";
    }

    return <<<HTML
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="font-family:Arial,sans-serif;background:#f0f2f5;margin:0;padding:30px 10px;">
  <div style="max-width:520px;margin:0 auto;">

    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:14px 14px 0 0;padding:36px 40px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:1px;">🛒 SmartHub</h1>
      <p style="color:rgba(255,255,255,0.80);margin:6px 0 0;font-size:14px;">Your one-stop tech store</p>
    </div>

    <div style="background:#fff;padding:36px 40px;text-align:center;">
      <h2 style="color:#222;font-size:22px;margin:0 0 10px;">Hi {$name}! 👋</h2>
      <p style="color:#555;font-size:15px;line-height:1.75;margin:0 0 28px;">
        Use the OTP below to {$purposeText}.<br>
        This code is valid for <strong>10 minutes</strong>.
      </p>

      <div style="margin:0 auto 28px;">
        {$boxes}
      </div>

      <p style="color:#999;font-size:13px;margin:0 0 8px;">
        ⚠️ Never share this OTP with anyone. SmartHub will never ask for it.
      </p>
      <p style="color:#bbb;font-size:12px;margin:0;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>

    <div style="background:#f0f2f5;border-radius:0 0 14px 14px;text-align:center;padding:20px;font-size:12px;color:#aaa;">
      © SmartHub · All rights reserved
    </div>

  </div>
</body>
</html>
HTML;
}
