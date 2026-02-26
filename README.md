# Sahayata Nidhi

**Sahayata Nidhi** is a government-backed financial assistance platform developed under the **Social Welfare Department**. It enables citizens from economically weaker sections to apply for monetary aid, track their application status, and receive funds through a secure, multi-stage officer workflow.

The system promotes transparency, speed, and accountability using a digital-first, multilingual interface with dynamic workflow creation, secure authentication, and integrated digital signatures.

---

## 📌 Project Overview

Sahayata Nidhi is structured into multiple modules:

- **Users:** Citizens submit applications, upload documents, and track progress.
- **Officers:** Government officials review, verify, and sanction applications.
- **Designers:** Admin-level users who configure services and workflows.
- **Admin (optional):** Supervisory users to manage system-wide settings and reporting.

---

## ⚙️ Technology Stack

| Layer                  | Technology                            |
| ---------------------- | ------------------------------------- |
| **Frontend**           | React.js, Bootstrap, Google Translate |
| **Backend**            | ASP.NET Core MVC, REST APIs           |
| **Database**           | SQL Server                            |
| **Authentication**     | ASP.NET Identity / JWT                |
| **Digital Signatures** | DSC Token Registration via USB        |
| **Architecture**       | MVC + API Integration                 |
| **Deployment**         | IIS / Azure / Docker                  |

---

## 🚀 Key Features

- 🌐 **Multilingual Support**: Google Translate integration for **Hindi**, **Urdu**, and **English**
- 📄 Form submission and document uploads
- 🔁 Customizable approval workflows per service
- 👤 Role-based access: User, Officer, Designer
- 🔐 Secure login with DSC integration
- 📊 Dashboards with application metrics and status
- 📬 Email & future SMS alerts for users
- 🛠️ Admin-level service & flow creation

---

## 🏗️ Modules

### 1. **User Module**

- Register, login, and update profile
- Fill out application forms for available services
- Upload identity or financial documents
- Track the status of submitted applications

### 2. **Officer Module**

- Login with secure credentials
- View assigned applications
- Review, verify, approve or reject applications
- Register **Digital Signature Certificate (DSC)** with:
  - Serial Number
  - Subject Name
  - Expiry Date
- Sign off on sanctioned applications using DSC

### 3. **Designer Module**

- Create new government **services**
- Define **approval flows**: which officers handle which stage
- Activate/deactivate services dynamically
- Assign role-based workflows per department or region
- Preview service configurations before publishing

### 4. **Admin Module** _(Optional or Role Merged)_

- Monitor all applications
- Add or remove users and officers
- Audit log reviews and performance summaries

---

## 🔤 Multilingual Interface

The platform uses **Google Translate** to offer live UI translation in:

- 🇮🇳 Hindi
- 🇮🇳 Urdu
- 🇮🇳 English

> Users can change their preferred language from the header menu at any point.

---

## 🛠️ Installation & Setup

### Prerequisites

- [.NET SDK 9+](https://dotnet.microsoft.com/)
- [Node.js & npm](https://nodejs.org/)
- [SQL Server 2019+](https://www.microsoft.com/en-us/sql-server/)
- Visual Studio 2022 or later

### Backend Setup

```bash
git clone https://github.com/AlgorithmicArchive/SahayataNidhi.git
cd SahayataNidhi

#Restore node_modules
npm install

# Restore NuGet packages
dotnet restore

# Apply EF Core migrations
dotnet ef database update

# Run the backend server
dotnet run
```
