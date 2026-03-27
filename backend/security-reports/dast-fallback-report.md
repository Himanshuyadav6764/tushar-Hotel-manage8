# DAST Fallback Report

- Target: http://localhost:5000
- Generated: 2026-03-27T12:51:01.833Z
- Total checks: 5
- Passed: 5
- Failed: 0

## Results

- [PASS] SEC_HEADERS_PUBLIC | status=401 | Public endpoint returns security headers
- [PASS] SQLI_REJECT | status=400 | SQL injection style payload is rejected
- [PASS] XSS_REJECT | status=401 | XSS payload is rejected
- [PASS] AUTH_GUARD | status=401 | Protected endpoint denies anonymous requests
- [PASS] TRACE_BLOCK | status=405 | TRACE method is blocked or unsupported