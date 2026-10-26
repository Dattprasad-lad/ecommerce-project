<?php
// ─────────────────────────────────────────────────────────────
//  SmartHub Email Helper — PHPMailer + Gmail SMTP
//
//  ✅ HOW TO SET UP (one-time, 5 minutes):
//
//  STEP 1 — Enable 2-Step Verification on your Gmail:
//    → https://myaccount.google.com/security
//    → Click "2-Step Verification" and turn it ON
//
//  STEP 2 — Create a Gmail App Password:
//    → https://myaccount.google.com/apppasswords
//    → App name: type "SmartHub" → click Create
//    → Copy the 16-character password shown (e.g. abcd efgh ijkl mnop)
//
//  STEP 3 — Paste below (keep the spaces, they are fine):
//
define('MAIL_FROM',     'yourgmail@gmail.com');   // ← your Gmail address
define('MAIL_PASSWORD', 'xxxx xxxx xxxx xxxx');   // ← 16-char App Password here
//
//  STEP 4 — Install PHPMailer (run once in your project folder):
//    Open Command Prompt → cd C:\xampp\htdocs\smarthub
//    Run: composer require phpmailer/phpmailer
//
//  That's it! OTP emails will now work.
// ─────────────────────────────────────────────────────────────

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$autoload = __DIR__ . '/vendor/autoload.php';
if (file_exists($autoload)) {
    require_once $autoload;
}

define('MAIL_FROM_NAME', 'SmartHub');
define('SITE_URL', 'http://localhost/smarthub');

/**
 * Send an HTML email via Gmail SMTP (PHPMailer).
 * Falls back to PHP mail() if PHPMailer is not installed.
 */
function sendEmail(string $toEmail, string $toName, string $subject, string $htmlBody): bool
{
    if (!class_exists('PHPMailer\\PHPMailer\\PHPMailer')) {
        // Fallback — only works if your server has sendmail configured
        $headers  = "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $headers .= "From: " . MAIL_FROM_NAME . " <" . MAIL_FROM . ">\r\n";
        return mail($toEmail, $subject, $htmlBody, $headers);
    }

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = MAIL_FROM;
        $mail->Password   = MAIL_PASSWORD;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        $mail->setFrom(MAIL_FROM, MAIL_FROM_NAME);
        $mail->addAddress($toEmail, $toName);
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $htmlBody;
        $mail->AltBody = strip_tags(str_replace(['<br>', '</p>', '</div>'], "\n", $htmlBody));

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log('SmartHub mailer error: ' . $mail->ErrorInfo);
        return false;
    }
}

/**
 * Build branded HTML verification email body.
 */
function buildVerificationEmail(string $name, string $verifyUrl): string
{
    return <<<HTML
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="font-family:Arial,sans-serif;background:#f0f2f5;margin:0;padding:30px 10px;">
  <div style="max-width:560px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:14px 14px 0 0;padding:36px 40px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:1px;">🛒 SmartHub</h1>
      <p style="color:rgba(255,255,255,0.80);margin:6px 0 0;font-size:14px;">Your one-stop tech store</p>
    </div>
    <div style="background:#fff;padding:36px 40px;">
      <h2 style="color:#222;font-size:22px;margin:0 0 14px;">Hi {$name}, welcome! 👋</h2>
      <p style="color:#555;line-height:1.75;font-size:15px;margin:0 0 16px;">
        Thanks for creating your SmartHub account. Please verify your email to activate it.
      </p>
      <div style="text-align:center;">
        <a href="{$verifyUrl}" style="display:inline-block;margin:10px 0 24px;padding:15px 40px;
           background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;
           border-radius:8px;font-size:16px;font-weight:bold;">✅ Verify My Email</a>
      </div>
      <p style="font-size:13px;color:#999;margin:0 0 8px;">
        This link expires in <strong>24 hours</strong>.
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
