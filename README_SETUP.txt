╔══════════════════════════════════════════════════════════════════╗
║           SmartHub v7 — Setup Guide for Windows (XAMPP)         ║
╚══════════════════════════════════════════════════════════════════╝

─────────────────────────────────────────────────────────────────
 STEP 1 — Place Files
─────────────────────────────────────────────────────────────────
 Copy this entire "smarthub" folder to:
   C:\xampp\htdocs\smarthub\

─────────────────────────────────────────────────────────────────
 STEP 2 — Start XAMPP
─────────────────────────────────────────────────────────────────
 Open XAMPP Control Panel
 → Start Apache
 → Start MySQL

─────────────────────────────────────────────────────────────────
 STEP 3 — Create Database
─────────────────────────────────────────────────────────────────
 1. Open browser → http://localhost/phpmyadmin
 2. Click "New" → Name: smarthub → Create
 3. Click smarthub → Import tab
 4. Choose File → select smarthub.sql → Import

─────────────────────────────────────────────────────────────────
 STEP 4 — Set Up Gmail OTP Email (5 minutes)
─────────────────────────────────────────────────────────────────
 4a. Enable 2-Step Verification on your Google account:
     → https://myaccount.google.com/security
     → Click "2-Step Verification" → Turn ON

 4b. Create a Gmail App Password:
     → https://myaccount.google.com/apppasswords
     → App name: SmartHub → Click Create
     → COPY the 16-character password shown

 4c. Open email.php in Notepad and edit these two lines:
     define('MAIL_FROM',     'YOUR_GMAIL@gmail.com');
     define('MAIL_PASSWORD', 'xxxx xxxx xxxx xxxx');  ← paste app password

─────────────────────────────────────────────────────────────────
 STEP 5 — Install PHPMailer (run once)
─────────────────────────────────────────────────────────────────
 1. Install Composer from: https://getcomposer.org/download/
    (Download and run Composer-Setup.exe)

 2. Open Command Prompt (search "cmd" in Start menu)

 3. Type these commands:
      cd C:\xampp\htdocs\smarthub
      composer require phpmailer/phpmailer

 4. Wait for it to finish — you'll see a "vendor" folder appear

─────────────────────────────────────────────────────────────────
 STEP 6 — Create Your Admin Account
─────────────────────────────────────────────────────────────────
 1. Go to http://localhost/phpmyadmin
 2. Click smarthub database → users table → Insert tab
 3. Fill in:
      name:        Admin
      email:       admin@smarthub.com
      phone:       9999999999
      address:     Admin Office
      password:    (leave blank — run SQL below instead)
      is_admin:    1
      is_verified: 1

 OR easier — run this SQL in the SQL tab (replaces admin password with "admin123"):
   INSERT INTO users (name, email, phone, address, password, is_admin, is_verified)
   VALUES ('Admin', 'admin@smarthub.com', '9999999999', 'HQ',
           '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1, 1);

 Admin email:    admin@smarthub.com
 Admin password: admin123

─────────────────────────────────────────────────────────────────
 STEP 7 — Open the Website
─────────────────────────────────────────────────────────────────
 Main store:   http://localhost/smarthub/index.html
 Admin panel:  http://localhost/smarthub/admin_dashboard.html

═══════════════════════════════════════════════════════════════════
 NEW FEATURES IN THIS VERSION
═══════════════════════════════════════════════════════════════════
 ✅ Signup now has inline OTP step — fill form → get OTP → verify → done
 ✅ Admin panel is now protected with a login screen
 ✅ Admin login uses email + password (admin accounts only)
 ✅ Gmail App Password setup ready in email.php

═══════════════════════════════════════════════════════════════════
 COMMON PROBLEMS
═══════════════════════════════════════════════════════════════════
 OTP not arriving?
   → Check that email.php has correct Gmail and App Password
   → Make sure you ran: composer require phpmailer/phpmailer
   → Check C:\xampp\php\logs\php_error_log for errors

 Admin login says "Access denied"?
   → Make sure is_admin = 1 in your users table

 Apache won't start?
   → Port 80 is taken. Stop Skype or IIS, then retry.

