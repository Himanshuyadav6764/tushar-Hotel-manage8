# Bireena Atithi Hotel Management System

Production-ready hotel management platform with a React + Vite frontend and a Node.js + Express API. Built for multi-tenant hotel operations with strong security defaults, reporting, and real-time updates.

Live: https://www.bireenaaathithi.in

## Project Structure

- **frontend/**: React + Vite web app (PWA + Capacitor Android support).
- **backend/**: Express API with MongoDB and tenant isolation.

## Highlights

- Multi-tenant data isolation with per-request tenant context.
- Default-deny API access (auth required unless explicitly public).
- Security hardening: helmet, rate limiting, NoSQL sanitization, XSS clean, HPP, firewall rules, and request validation.
- Real-time updates via Socket.io.
- PWA build with offline-capable assets and installable app shell.
- Reports: sales, payment, analytics, staff, reservation, and consolidated reports.

## Core Features

### Frontend

- Role-based dashboards (admin, staff, cashier).
- Booking, room, and guest management UI.
- Menu and guest-meal ordering flow.
- QR flows for OTP verification and room/booking checks.
- Printable receipts, exports, and report views.
- PWA installability; Capacitor Android packaging.

### Backend Modules (API)

Base path: `/api`

- Auth and staff access: `/auth`, `/staff`
- Super-admin operations: `/super-admin`
- Hotel settings and pricing: `/hotel`, `/pricing`
- Rooms and facilities: `/rooms`, `/facilities`, `/facility-types`, `/bed-types`, `/floors`
- Bookings and reservations: `/bookings`, `/reservations`, `/reservation-types`
- Guest management: `/guests`, `/guest-meal`
- Menu and tables: `/menu`, `/tables`
- Cashier and folio: `/cashier`, `/folio`
- QR workflows: `/qr`
- Notifications: `/notifications`
- Sources and identities: `/booking-sources`, `/business-sources`, `/customer-identities`
- Add-ons: `/extra-charges`, `/complimentary-services`
- Operations: `/maintenance-blocks`, `/housekeeping`, `/visitors`
- Reports: `/sales-report`, `/payment-report`, `/analytics-report`, `/staff-report`, `/reservation-report`, `/reports`
- Chatbot: `/chatbot`

## Tech Stack

- Frontend: React 19, Vite 7, Tailwind CSS, Socket.io client, Vite PWA, Capacitor.
- Backend: Node.js, Express, MongoDB (Mongoose), Socket.io.
- Security: Helmet, rate limiting, NoSQL/XSS sanitization, HPP, firewall middleware.

## Local Development

### Prerequisites

- Node.js 18+
- MongoDB (local or remote URI)

### Backend

```bash
cd backend
npm install
npm run dev
```

The API will run on `http://localhost:5000` by default.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The web app will run on `http://localhost:3000` (Vite proxy routes `/api` to the backend).

## Environment Variables

### Backend (`backend/.env`)

Start from [backend/.env.example](backend/.env.example).

```
MONGODB_URI=mongodb://localhost:27017/hotel-management
PORT=5000
NODE_ENV=development
JWT_SECRET=replace-with-strong-secret
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
FIREWALL_ENABLED=true
DATA_ENCRYPTION_KEY=
DEFAULT_HOTEL_ID=
DEFAULT_TENANT_DB=hotel-management
```

### Frontend (`frontend/.env.local`)

Start from [frontend/.env.example](frontend/.env.example).

```
VITE_API_URL=
VITE_ENV=development
```

For production, set `VITE_API_URL` to your deployed API URL.

## Production Build

### Frontend Build

```bash
cd frontend
npm run build
```

### Backend Start

```bash
cd backend
npm run start
```

This repository includes Vercel configs for both frontend and backend:

- [frontend/vercel.json](frontend/vercel.json)
- [backend/vercel.json](backend/vercel.json)

## Android (Capacitor)

From `frontend/`:

```bash
npm run android:add
npm run android:sync
npm run android:open
```

Generate a debug APK:

```bash
npm run apk:debug
```

## Security Testing

From `backend/`:

```bash
npm run security:smoke
npm run security:zap:baseline
```

Full workflow details are documented in [backend/SECURITY_TESTING.md](backend/SECURITY_TESTING.md).

## Notes

- Public endpoints are limited; all other API routes require a valid JWT.
- Socket.io is initialized on the backend for real-time updates.
- CORS must be explicitly configured for production (see `CORS_ORIGIN`).
