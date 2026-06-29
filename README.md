# ARC101 Readymix & Development Corp. — Web System

> End-to-end structural solutions platform for project requests, order management, and real-time customer communication.

**BSCpE Final Project — Web and Mobile Systems**  
Polytechnic University of the Philippines

---

## 📌 Project Overview

**Company:** ARC101 Readymix & Development Corp.  
**Industry:** Construction / Building Materials  
**Products & Services:** Ready-mix concrete, cement, sand, gravel, aggregates, and chemical admixtures.

This system allows customers to submit project requests online, communicate with the ARC101 team via real-time chat, receive price quotations, and make payments — all through a modern web interface.

---

## 🖥️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Backend | PHP 8.x (API endpoints only) |
| Database | MySQL 8.x via XAMPP |
| AJAX | Fetch API with JSON |
| Charts | Chart.js 4 |
| Auth | PHP Sessions (`session_start`, `session_regenerate_id`) |
| Icons | Font Awesome 6.5 |
| Fonts | Google Fonts (Montserrat + Open Sans) |

---

## 📁 Project Structure

```
arc101-web/
│
├── index.html              ← Public homepage
├── about.html              ← About page
├── services.html           ← Project request form
├── login.html              ← Login page
├── register.html           ← Registration page
├── logout.php              ← Session destroy + redirect
├── pay.php                 ← Payment page (GCash / PayMaya)
│
├── assets/
│   ├── css/
│   │   ├── main.css        ← Shared design system (tokens, layout, components)
│   │   ├── public.css      ← Public pages styles (hero, services grid, form)
│   │   └── dashboard.css   ← Dashboard-specific overrides
│   └── js/
│       ├── utils.js             ← Shared utilities (api, Toast, Modal, fmtDate, etc.)
│       ├── index.js             ← Homepage session check
│       ├── login.js             ← Login form logic
│       ├── register.js          ← Registration form logic
│       ├── services.js          ← Project submission form logic
│       ├── customer-dashboard.js
│       ├── customer-projects.js
│       ├── customer-chat.js
│       ├── admin-dashboard.js
│       ├── admin-review.js
│       ├── admin-chat.js
│       └── admin-reports.js
│
├── customer/
│   ├── dashboard.html      ← Customer dashboard (stats, projects table, progress)
│   ├── projects.html       ← All projects with filter and search
│   └── chat.html           ← Real-time chat with admin
│
├── admin/
│   ├── dashboard.html      ← Admin dashboard (charts, recent projects)
│   ├── review_orders.html  ← Review and update project statuses
│   ├── chat.html           ← Admin chat (send receipts, progress photos, meetings)
│   └── reports.html        ← Analytics and reports with charts
│
├── api/                    ← PHP Backend (API endpoints only, no HTML)
│   ├── projects.php        ← AJAX: submit / list / get / update_status / stats
│   ├── chat.php            ← AJAX: rooms / messages / send / mark_paid
│   └── notifications.php  ← AJAX: count / list / read_all / save_token
│
├── includes/
│   └── config.php          ← DB connection (PDO), session helpers, jsonResponse()
│
├── uploads/
│   ├── projects/           ← Uploaded project plan files
│   ├── messages/           ← Chat file attachments
│   ├── progress/           ← Progress photos
│   └── receipts/           ← Receipt files
│
└── arc101.sql              ← Database schema + seed data
```

---

## 🚀 Deployment Guide (XAMPP)

### Step 1 — Prerequisites
- [XAMPP](https://www.apachefriends.org/) installed with PHP 8.x and MySQL
- A modern browser (Chrome recommended)

### Step 2 — Copy Files to XAMPP

**Windows:**
```
Copy the arc101-web folder to: C:\xampp\htdocs\arc101-web\
```

**Mac:**
```
Copy the arc101-web folder to: /Applications/XAMPP/htdocs/arc101-web/
```

### Step 3 — Start XAMPP
Open XAMPP Control Panel → click **Start** for both **Apache** and **MySQL**.

### Step 4 — Create the Database

1. Open your browser and go to `http://localhost/phpmyadmin`
2. Click **New** in the left sidebar
3. Enter database name: `arc101db` → click **Create**
4. Click the **Import** tab
5. Click **Choose File** → select `arc101-web/arc101.sql`
6. Click **Go**

### Step 5 — Configure the App

Open `arc101-web/includes/config.php` and verify these settings:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'arc101db');
define('DB_USER', 'root');
define('DB_PASS', '');          // Add your MySQL password if you set one
define('APP_URL', 'http://localhost/arc101-web');
define('UPLOAD_PATH', __DIR__ . '/../uploads/');
```

### Step 6 — Open in Browser

```
http://localhost/arc101-web/
```

### Step 7 — Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Customer | customer@arc101.com | password |
| Admin | admin@arc101.com | password |

---

## ✨ Features

### Public Pages
- **Homepage** — Hero section, services overview, how it works, CTA
- **About** — Mission, vision, core values
- **Services / Project Request** — Multi-section form with drag & drop file upload

### Customer Portal
- **Dashboard** — Stats, projects table with progress bars, status guide
- **My Projects** — Filter by status, search, view project details modal
- **Messages** — Real-time chat with admin (3-second polling, no duplicates)
- **Payment** — Pay receipts via GCash or PayMaya

### Admin Panel
- **Dashboard** — Chart.js bar chart (monthly submissions) + doughnut (status breakdown)
- **Review Orders** — Side-by-side project list and detail panel, update project status
- **Chat** — Send receipts with itemized pricing, progress photos, schedule meetings
- **Reports** — Full analytics with charts and filterable project table

---

## ⚙️ Technical Highlights (Rubric Requirements)

| Requirement | Implementation |
|------------|----------------|
| **PHP Sessions** | `session_start()` and `session_regenerate_id(true)` in `config.php`; role-based access control (customer/admin) enforced on every API call |
| **AJAX** | `fetch()` API used for all data operations: project submit, list, status update, chat send/receive, notifications — zero page reloads |
| **JSON** | `json_encode()` / `json_decode()` for all API responses (`Content-Type: application/json`), materials stored as JSON in DB |
| **PDO** | Prepared statements throughout all DB queries — no raw SQL string concatenation |
| **Responsive Design** | CSS custom properties, Flexbox, CSS Grid, 3 breakpoints (mobile ≤640px, tablet ≤992px, desktop) |
| **Real-time Chat** | Polling every 3 seconds using `since=lastMsgId` for efficiency; stops/restarts poll on send to prevent duplicates |
| **File Upload** | Drag & drop + click-to-upload with image previews; supports JPG, PNG, PDF, DWG |
| **Charts** | Chart.js 4 — bar chart for monthly submissions, doughnut for status breakdown, horizontal bar for materials |
| **Separated Concerns** | HTML structure, CSS styling, and JavaScript logic in completely separate files |

---

## 🗄️ Database Schema

```sql
users          → id, name, email, password (bcrypt), role, phone, address, created_at
projects       → id, customer_id, title, dimension_type, total_area, structural_type,
                 project_address, materials (JSON), other_materials, plan_file,
                 additional_specs, status ENUM, submitted_at
chat_rooms     → id, project_id, customer_id, created_at
messages       → id, room_id, sender_id, message, attachment_path, attachment_type,
                 receipt_data (JSON), payment_status, payment_link, is_read, sent_at
notifications  → id, user_id, title, body, type, reference_id, is_read, created_at
materials      → id, name, category, unit, description (catalog reference table)
```

**Database is in 3NF:**
- Each table has a single primary key
- No partial dependencies (all non-key columns depend on the full primary key)
- No transitive dependencies (no non-key column depends on another non-key column)

---

## 🔄 Key Workflows

### Project Submission Flow
```
Customer fills services.html form
  → services.js collects form data + files
  → fetch POST to api/projects.php?action=submit
  → PHP validates, saves to DB, notifies admin
  → Customer redirected to dashboard
```

### Order Review Flow
```
Admin opens review_orders.html
  → admin-review.js fetches project list
  → Admin clicks project → sees full details
  → Admin clicks status button → fetch POST to api/projects.php?action=update_status
  → If Accepted: PHP creates chat_room, notifies customer
```

### Real-time Chat Flow
```
Both parties open chat page
  → JS polls api/chat.php?action=messages&since=lastMsgId every 3 seconds
  → Only new messages fetched (efficient, no duplicates)
  → On send: poll stopped → fresh load → poll restarted
```

### Payment Flow
```
Admin sends receipt via chat
  → receipt_data (JSON) stored in message
  → Customer sees receipt card with "Pay Now" button
  → Customer opens pay.php → selects GCash or PayMaya
  → Clicks "I've Sent Payment"
  → fetch POST to api/chat.php?action=mark_paid
  → Admin sees "Customer Paid" status on receipt card
```

---

## 📱 Mobile App (Cordova)

See the `arc101-cordova/` folder for the Android APK project.

The mobile app connects to this same PHP backend over your local WiFi network.

**Quick setup:**
```bash
cd arc101-cordova
npm install
cordova platform add android
cordova plugin add cordova-plugin-camera
cordova build android
```

Change the `BASE` URL in `arc101-cordova/www/index.html` to your computer's local IP:
```javascript
const BASE = 'http://YOUR_IP/arc101-web';
```

APK output: `platforms/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔒 Security Features

- Passwords hashed with `password_hash()` using `PASSWORD_BCRYPT` (cost 12)
- Session regeneration on login with `session_regenerate_id(true)`
- PDO prepared statements prevent SQL injection on all queries
- Role-based access control — every API endpoint checks `isLoggedIn()` and user role
- File upload validation — extension whitelist + 10MB size limit
- `.htaccess` blocks direct access to sensitive files and disables directory listing

---

## 👥 Team

BSCpE Students — Polytechnic University of the Philippines  
Final Project — Web and Mobile Systems (2026)

---

## 📄 License

For academic use only. All rights reserved by ARC101 Readymix & Development Corp.
