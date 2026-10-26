-- Create Smart Hub Database
CREATE DATABASE IF NOT EXISTS smarthub;
USE smarthub;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(10) NOT NULL,
    address TEXT NOT NULL,
    password VARCHAR(255) NOT NULL,
    auth_token VARCHAR(64) NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verify_token VARCHAR(64) NULL,
    verify_expires_at DATETIME NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price INT NOT NULL,
    original_price INT NOT NULL,
    rating DECIMAL(3,1) DEFAULT 4.5,
    image VARCHAR(255),
    description TEXT,
    stock INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    total_amount INT NOT NULL,
    delivery_address TEXT NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'Cash on Delivery',
    status ENUM('pending', 'processing', 'shipped', 'completed', 'cancelled') DEFAULT 'pending',
    items_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin Logs Table (for daily reports)
CREATE TABLE IF NOT EXISTS admin_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    date DATE NOT NULL,
    total_sales INT DEFAULT 0,
    total_orders INT DEFAULT 0,
    total_profit INT DEFAULT 0,
    total_loss INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert Sample Products
INSERT INTO products (name, category, price, original_price, rating, image, description, stock) VALUES
('iPhone 17 Pro', 'smartphones', 99999, 129999, 4.8, 'images/iphone17pro.jpg', 'Latest flagship smartphone with advanced features', 50),
('Samsung Galaxy S24', 'smartphones', 79999, 99999, 4.7, 'images/galaxys24.jpg', 'Premium Android smartphone with AI features', 45),
('MacBook Pro 14"', 'laptops', 199999, 249999, 4.9, 'images/macbookpro14.jpg', 'Powerful laptop for professionals', 20),
('Dell 14 Plus', 'laptops', 149999, 179999, 4.6, 'images/dell14plus.jpg', 'Sleek and powerful Windows laptop', 25),
('Sony WH-1000XM5', 'audio', 24999, 29999, 4.8, 'images/sonywh.jpg', 'Premium noise-cancelling headphones', 60),
('AirPods Pro', 'audio', 19999, 24999, 4.7, 'images/airpodspro.webp', 'Apple wireless earbuds with ANC', 70),
('iPad Air', 'accessories', 79999, 99999, 4.6, 'images/ipadair.png', 'Versatile tablet for work and entertainment', 35),
('Samsung Galaxy Watch', 'accessories', 19999, 24999, 4.5, 'images/galaxywatch.jpg', 'Smartwatch with health tracking', 40);

-- Create index for faster queries
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_product_category ON products(category);
CREATE INDEX idx_order_user ON orders(user_id);
CREATE INDEX idx_order_date ON orders(created_at);

-- Create stored procedure for daily report
DELIMITER //
CREATE PROCEDURE generate_daily_report()
BEGIN
    DECLARE sale_total INT DEFAULT 0;
    DECLARE order_count INT DEFAULT 0;
    
    SELECT COALESCE(SUM(total_amount), 0), COUNT(*) 
    INTO sale_total, order_count
    FROM orders 
    WHERE DATE(created_at) = CURDATE() AND status = 'completed';
    
    INSERT INTO admin_logs (date, total_sales, total_orders, total_profit)
    VALUES (CURDATE(), sale_total, order_count, FLOOR(sale_total * 0.3))
    ON DUPLICATE KEY UPDATE 
        total_sales = sale_total,
        total_orders = order_count,
        total_profit = FLOOR(sale_total * 0.3);
END //
DELIMITER ;

-- Create admin user (or update if already exists)
INSERT INTO users (name, email, phone, address, password, is_admin, is_verified) VALUES
('Admin User', 'prakashlad078@gmail.com', '9999999999', 'Smart Hub Store, Kolhāpur', '$2y$10$OTyo08olnRbHFZcHKnqhH.00yWyQ9mv.MdKhovok/nm3Qby2UH8eC', TRUE, TRUE)
ON DUPLICATE KEY UPDATE
  password   = '$2y$10$OTyo08olnRbHFZcHKnqhH.00yWyQ9mv.MdKhovok/nm3Qby2UH8eC',
  is_admin   = TRUE,
  is_verified = TRUE;

-- Password for admin is: admin123 (hashed with bcrypt)

-- If upgrading an existing database, run these to add the new columns:
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_token VARCHAR(64) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token VARCHAR(64) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_expires_at DATETIME NULL;

-- Mark existing users as already verified so they can still log in
UPDATE users SET is_verified = TRUE WHERE is_verified = FALSE;

-- ── OTP SYSTEM ────────────────────────────────────────────────────────────
-- OTP Table: stores one-time passwords for signup verification & login 2FA
CREATE TABLE IF NOT EXISTS otp_codes (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    email       VARCHAR(100) NOT NULL,
    otp         VARCHAR(4)   NOT NULL,
    purpose     ENUM('signup','login') NOT NULL,
    expires_at  DATETIME     NOT NULL,
    used        BOOLEAN      DEFAULT FALSE,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_otp_email (email),
    INDEX idx_otp_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Run these if upgrading an existing database:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE;
-- ──────────────────────────────────────────────────────────────────────────
