# Security Testing Guide

This project now includes automated and manual security testing hooks for:
- OWASP ZAP baseline scanning
- Burp Suite proxy-based attack simulation
- In-project API attack smoke tests
- Non-Docker fallback DAST scan with report generation

## 1) Prerequisites

- Backend running on `http://localhost:5000`
- Node.js 18+
- Docker Desktop running (for ZAP baseline script)

## 2) Quick Attack Simulation (Project Script)

From `backend`:

```powershell
npm run security:smoke
```

What it checks:
- SQL injection style payload on login
- XSS style payload on login
- TRACE method blocking
- Executable payload attempt in image URL field

Expected result: responses should be blocked/rejected (4xx), not accepted as valid requests.

## 3) Docker Setup Check (for ZAP)

From `backend`:

```powershell
npm run security:docker:check
```

Auto-install Docker Desktop (when missing):

```powershell
npm run security:docker:setup
```

## 4) OWASP ZAP Baseline Scan

From `backend`:

```powershell
npm run security:zap:baseline
```

Optional custom target:

```powershell
$env:ZAP_TARGET_URL="http://host.docker.internal:5000/api"
npm run security:zap:baseline
```

Reports generated in:
- `backend/security-reports/zap-baseline-report.html`
- `backend/security-reports/zap-baseline-report.json`
- `backend/security-reports/zap-baseline-report.md`

## 5) Non-Docker Fallback DAST Scan

If Docker/ZAP is unavailable, run fallback DAST checks:

```powershell
npm run security:dast:fallback
```

Reports generated in:
- `backend/security-reports/dast-fallback-report.json`
- `backend/security-reports/dast-fallback-report.md`

## 6) Burp Suite Manual Attack Simulation

1. Open Burp Suite Community or Pro.
2. Set proxy to `127.0.0.1:8080`.
3. Configure browser proxy to Burp.
4. Login and use application normally to capture requests.
5. Send critical requests to Repeater/Intruder:
   - `/api/auth/login`
   - `/api/hotel/settings`
   - `/api/super-admin/*`
6. Test attacks:
   - SQLi payloads in username/email fields
   - XSS payloads in text fields
   - Broken JWT / missing JWT
   - Method tampering (TRACE, CONNECT)
   - Oversized JSON body
   - Malicious image payloads (.js/.exe references)
7. Confirm server blocks and returns safe 4xx errors.

## 7) Security Baseline Already Enforced

- Helmet headers
- CORS allowlist
- Rate limiting (general, login, super-admin critical)
- NoSQL sanitize + XSS clean + HPP
- Global suspicious payload validation
- API default-deny auth guard
- Firewall middleware (method, IP, UA policy)
- Upload validation for image fields (JPG/PNG, max 2MB, executable extension blocked)
- Global API activity logging (login, booking, reservation, admin, system actions)
- Suspicious activity detection (bruteforce pattern, high request rate, malicious path patterns, repeated unauthorized access)

## 8) Monitoring APIs (Super Admin)

- `GET /api/super-admin/activity-logs`
- `GET /api/super-admin/suspicious-activities`

Useful query params:

- `category=auth|booking|reservation|admin|system`
- `action=login_failed` (or any action string)
- `suspicious=true`
- `startDate=2026-03-01&endDate=2026-03-27`
- `page=1&limit=50`

## 9) Important Note

No software can be declared "fully secure" permanently. Keep running these tests after every security-sensitive change and review reports for new findings.
