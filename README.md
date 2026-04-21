# Hotel Management System for Hotels

in india for hotels

A comprehensive MERN stack application for hotel management.

## Project Structure

- **frontend/**: React frontend application.
- **backend/**: Node.js/Express backend API.

## Getting Started

### Prerequisites

- Node.js (v18+)
- MongoDB (running locally or URI provided)

### Installation

1.  **Backend Setup**:
    ```bash
    cd backend
    npm install
    npm run dev
    ```

2.  **Frontend Setup**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

The application will be available at `http://localhost:5173`.
The backend API runs on `http://localhost:5000`.

## Security Testing

From `backend/` run:

```bash
npm run security:smoke
```

```bash
npm run security:zap:baseline
```

Detailed Burp Suite and OWASP ZAP workflow is available in `backend/SECURITY_TESTING.md`.
