# 🏛 CivicPulse Platform

An advanced, feature-rich 3-Tier Citizen Grievance Redressal and Municipal Management Platform designed for modern civic administration.

## 🌟 Key Features

### 👤 1. Citizen Portal
- **Dashboard Home**: Interactive welcome widgets with real-time statistics (Total Complaints, In-Progress, Pending, and Resolved).
- **Register Complaint**: Simple registration with drop-down categories (Water, Road, Electrical, Sanitation, Drainage), priority rating, image uploads, GPS coordinates support, and automated department routing.
- **Complaint Tracking**: Live timeline status tracking, ETA, and assigned officer info.
- **Receipt Download**: Generate clean, print-friendly PDF receipts for registered grievances.
- **History Logs**: Search and filter past complaints.
- **AI Chat Assistant**: Fully integrated conversational AI to guide citizens, answer FAQ queries, and help log grievances.

### 👨‍💼 2. Departmental Authority Portal
- **Role-Based Access**: Auto-routed departmental logins (e.g., Road Officer only views Road complaints).
- **Actionable Workspaces**: Update statuses (In Progress, Resolved, Escalated), add custom action log updates, assign timeline expectations (ETA).
- **Escalation Rules**: Escalate critical files to Super Admins.
- **Export Reports**: Single-click PDF exports, CSV spreadsheets, and Excel reports.

### 🛡️ 3. Super Admin Portal
- **Enterprise Controls**: Add and remove city departments dynamically.
- **Advanced Editing Control**:
  - Re-route complaint departments and adjust priorities manually.
  - Ban or restore citizen accounts to prevent spam.
  - Oversee all departments and complaints globally.
- **System Settings Configuration**: Modify operational parameters (e.g., auto-escalation SLAs, emergency status tags) in real-time.

---

## 🏗 System Architecture

CivicPulse is built with a decoupled 3-tier architecture:
- **Frontend Layer**: Served via standard static assets using Vanilla HTML, CSS, JavaScript, dynamic SVG charting, and dynamic map APIs.
- **Backend API Layer**: Powered by Node.js & Express.
- **Data Persistence Layer**: In-memory database with robust controllers and transaction logs.

---

## 🚀 Setup & Launch Instructions

### Prerequisites
- Node.js installed locally.

### 1. Start the Backend API
Navigate to the `backend` folder, install the packages, and run the server:
```bash
cd backend
npm install
npm start
```
*Note: The backend starts on `http://127.0.0.1:5000`.*

### 2. Start the Frontend
Serve the `frontend` folder using any local server (e.g. `http-server`):
```bash
# From the root directory:
npx http-server frontend -p 3000
```
*Note: The user portal will load at `http://127.0.0.1:3000`.*

---

## 🔑 Seeding / Demo Credentials

Test the platform utilizing these pre-configured user profiles:

| Role | Username / Email | Password |
| :--- | :--- | :--- |
| **🛡️ Super Admin** | `admin@civic.gov` | `adminpassword` |
| **👤 Citizen** | `jane@citizen.com` | `citizenpassword` |
| **👨‍💼 Road Officer** | `road@civic.gov` | `officerpassword` |
| **👨‍💼 Sanitation Officer** | `sanitation@civic.gov` | `officerpassword` |
| **👨‍💼 Water Officer** | `water@civic.gov` | `officerpassword` |

---

## 📬 Email Logs

When a citizen registers a complaint or an escalation occurs, the system utilizes a mock SMTP fallback transporter. Email preview links are output directly to the **backend terminal log window** for inspection.
