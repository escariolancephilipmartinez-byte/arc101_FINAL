-- ARC101 Readymix & Development Corp Database
-- Run this in phpMyAdmin or MySQL CLI: source arc101.sql

CREATE DATABASE IF NOT EXISTS arc101db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE arc101db;

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('customer','admin') DEFAULT 'customer',
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- PROJECT REQUESTS TABLE
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    dimension_type ENUM('known','request_measurement') DEFAULT 'known',
    total_area DECIMAL(10,2) NULL,
    structural_type VARCHAR(100) NULL,
    project_address TEXT NULL,
    materials JSON NULL,
    other_materials TEXT NULL,
    plan_file VARCHAR(255) NULL,
    additional_specs TEXT NULL,
    status ENUM('pending','under_review','accepted','in_progress','completed','rejected') DEFAULT 'pending',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_customer (customer_id),
    INDEX idx_status (status)
);

-- CHAT ROOMS TABLE (one per project)
CREATE TABLE IF NOT EXISTS chat_rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    customer_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_project (project_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    sender_id INT NOT NULL,
    message TEXT NULL,
    attachment_path VARCHAR(255) NULL,
    attachment_type ENUM('file','image','receipt','progress_photo','signature_request','meeting') NULL,
    receipt_data JSON NULL,
    payment_status ENUM('unpaid','paid') DEFAULT 'unpaid',
    payment_link VARCHAR(255) NULL,
    is_read TINYINT(1) DEFAULT 0,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_room (room_id),
    INDEX idx_sent (sent_at)
);

-- MATERIALS CATALOG
CREATE TABLE IF NOT EXISTS materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category ENUM('concrete','cement','aggregate','chemical','other') NOT NULL,
    description TEXT,
    unit VARCHAR(30),
    is_active TINYINT(1) DEFAULT 1
);

-- NOTIFICATIONS TABLE (for push notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(50),
    reference_id INT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_read (is_read)
);

-- PUSH TOKENS TABLE (for mobile app notifications)
CREATE TABLE IF NOT EXISTS push_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL,
    platform VARCHAR(20) DEFAULT 'android',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
);

-- SEED DATA
INSERT INTO users (name, email, password, role) VALUES
('Admin ARC101', 'admin@arc101.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('Juan Dela Cruz', 'customer@arc101.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer');
-- Default password for both: "password"

INSERT INTO materials (name, category, description, unit) VALUES
('Ready Mix Concrete', 'concrete', 'Pre-mixed concrete delivered fresh', 'cubic meter'),
('Portland Cement (40kg)', 'cement', 'Standard Portland cement bag', 'bag'),
('Portland Cement (50kg)', 'cement', 'Standard Portland cement bag', 'bag'),
('Fine Sand', 'aggregate', 'Washed fine aggregate', 'cubic meter'),
('Coarse Gravel (3/4")', 'aggregate', 'Crushed gravel for concrete', 'cubic meter'),
('Coarse Gravel (1/2")', 'aggregate', 'Fine crushed gravel', 'cubic meter'),
('Admixture - Plasticizer', 'chemical', 'Water reducing admixture', 'liter'),
('Admixture - Accelerator', 'chemical', 'Speeds up concrete setting', 'liter'),
('Admixture - Retarder', 'chemical', 'Slows concrete setting time', 'liter'),
('G.I. Rebar (10mm)', 'other', 'Steel reinforcing bar', 'piece'),
('G.I. Rebar (12mm)', 'other', 'Steel reinforcing bar', 'piece');
