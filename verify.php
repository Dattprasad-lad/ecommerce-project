<?php
// ─────────────────────────────────────────────
//  SmartHub — Email Verification Handler
//  URL: /smarthub/verify.php?token=<TOKEN>
// ─────────────────────────────────────────────
require_once __DIR__ . '/db.php';

$token   = trim($_GET['token'] ?? '');
$status  = 'error';
$heading = 'Something went wrong';
$message = 'This verification link is invalid.';

if (!empty($token)) {
    // Find user with matching token that hasn't expired
    $stmt = $conn->prepare(
        "SELECT id, name, is_verified FROM users 
         WHERE verify_token = ? AND verify_expires_at > NOW()"
    );
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();

    if ($result->num_rows === 0) {
        // Token not found or expired
        $status  = 'expired';
        $heading = 'Link Expired or Invalid';
        $message = 'This verification link has expired or already been used. Please sign up again or contact support.';
    } else {
        $user = $result->fetch_assoc();

        if ($user['is_verified']) {
            // Already verified
            $status  = 'already';
            $heading = 'Already Verified!';
            $message = 'Your email is already verified. You can log in now.';
        } else {
            // Verify the account
            $upd = $conn->prepare(
                "UPDATE users SET is_verified = TRUE, verify_token = NULL, verify_expires_at = NULL WHERE id = ?"
            );
            $upd->bind_param('i', $user['id']);
            $upd->execute();
            $upd->close();

            $status  = 'success';
            $heading = 'Email Verified! 🎉';
            $message = 'Your account is now active. Click below to log in and start shopping.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification — SmartHub</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      padding: 50px 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
      display: block;
    }
    .icon.success { color: #28a745; }
    .icon.error   { color: #dc3545; }
    .icon.expired { color: #ffc107; }
    .icon.already { color: #667eea; }

    h1 { font-size: 26px; color: #222; margin-bottom: 14px; }
    p  { font-size: 15px; color: #666; line-height: 1.7; margin-bottom: 30px; }

    .btn {
      display: inline-block;
      padding: 14px 36px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: bold;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.88; }
    .btn-primary {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
    }
    .btn-secondary {
      background: #f1f1f1;
      color: #555;
      margin-left: 10px;
    }
    .logo {
      font-size: 20px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 30px;
      display: block;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="logo">🛒 SmartHub</span>

    <?php if ($status === 'success'): ?>
      <i class="fas fa-check-circle icon success"></i>
      <h1><?= htmlspecialchars($heading) ?></h1>
      <p><?= htmlspecialchars($message) ?></p>
      <a href="index.html" class="btn btn-primary">Go to Login</a>

    <?php elseif ($status === 'already'): ?>
      <i class="fas fa-check-circle icon already"></i>
      <h1><?= htmlspecialchars($heading) ?></h1>
      <p><?= htmlspecialchars($message) ?></p>
      <a href="index.html" class="btn btn-primary">Login Now</a>

    <?php elseif ($status === 'expired'): ?>
      <i class="fas fa-clock icon expired"></i>
      <h1><?= htmlspecialchars($heading) ?></h1>
      <p><?= htmlspecialchars($message) ?></p>
      <a href="index.html" class="btn btn-secondary">Back to Home</a>

    <?php else: ?>
      <i class="fas fa-times-circle icon error"></i>
      <h1><?= htmlspecialchars($heading) ?></h1>
      <p><?= htmlspecialchars($message) ?></p>
      <a href="index.html" class="btn btn-secondary">Back to Home</a>
    <?php endif; ?>
  </div>
</body>
</html>
