/*
 * Non-Docker fallback DAST scanner.
 * Run: npm run security:dast:fallback
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const BASE_URL = String(process.env.SECURITY_TEST_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const REPORT_DIR = path.join(process.cwd(), 'security-reports');

const ensureReportDir = () => {
    if (!fs.existsSync(REPORT_DIR)) {
        fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
};

const nowIso = () => new Date().toISOString();

const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    const text = await response.text();
    return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        text
    };
};

const traceRequest = (url) => {
    return new Promise((resolve) => {
        try {
            const parsed = new URL(url);
            const lib = parsed.protocol === 'https:' ? https : http;

            const req = lib.request(
                {
                    method: 'TRACE',
                    hostname: parsed.hostname,
                    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                    path: parsed.pathname + parsed.search
                },
                (res) => {
                    let body = '';
                    res.on('data', (chunk) => { body += chunk; });
                    res.on('end', () => {
                        resolve({ status: res.statusCode || 0, text: body, error: null });
                    });
                }
            );

            req.on('error', (error) => {
                resolve({ status: 0, text: '', error: String(error.message || error) });
            });

            req.end();
        } catch (error) {
            resolve({ status: 0, text: '', error: String(error.message || error) });
        }
    });
};

const run = async () => {
    ensureReportDir();

    const checks = [];

    // Check 1: Public endpoint should return security headers from helmet.
    try {
        const res = await fetchJson(`${BASE_URL}/api/hotel/settings`);
        const hasXcto = !!res.headers['x-content-type-options'];
        const hasFrame = !!res.headers['x-frame-options'];

        checks.push({
            id: 'SEC_HEADERS_PUBLIC',
            description: 'Public endpoint returns security headers',
            status: res.status,
            passed: hasXcto && hasFrame,
            evidence: {
                xContentTypeOptions: res.headers['x-content-type-options'] || null,
                xFrameOptions: res.headers['x-frame-options'] || null
            }
        });
    } catch (error) {
        checks.push({
            id: 'SEC_HEADERS_PUBLIC',
            description: 'Public endpoint returns security headers',
            status: 'NETWORK_ERROR',
            passed: false,
            evidence: { error: String(error.message || error) }
        });
    }

    // Check 2: SQLi payload rejected.
    try {
        const res = await fetchJson(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "admin@bireena.com' OR '1'='1",
                password: 'x',
                role: 'admin'
            })
        });

        checks.push({
            id: 'SQLI_REJECT',
            description: 'SQL injection style payload is rejected',
            status: res.status,
            passed: [400, 401, 403, 429].includes(res.status),
            evidence: { snippet: res.text.slice(0, 200) }
        });
    } catch (error) {
        checks.push({
            id: 'SQLI_REJECT',
            description: 'SQL injection style payload is rejected',
            status: 'NETWORK_ERROR',
            passed: false,
            evidence: { error: String(error.message || error) }
        });
    }

    // Check 3: XSS payload rejected.
    try {
        const res = await fetchJson(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: '<script>alert(1)</script>@evil.test',
                password: 'x',
                role: 'admin'
            })
        });

        checks.push({
            id: 'XSS_REJECT',
            description: 'XSS payload is rejected',
            status: res.status,
            passed: [400, 401, 403, 429].includes(res.status),
            evidence: { snippet: res.text.slice(0, 200) }
        });
    } catch (error) {
        checks.push({
            id: 'XSS_REJECT',
            description: 'XSS payload is rejected',
            status: 'NETWORK_ERROR',
            passed: false,
            evidence: { error: String(error.message || error) }
        });
    }

    // Check 4: Protected endpoint should deny anonymous access.
    try {
        const res = await fetchJson(`${BASE_URL}/api/super-admin/dashboard`);
        checks.push({
            id: 'AUTH_GUARD',
            description: 'Protected endpoint denies anonymous requests',
            status: res.status,
            passed: [401, 403].includes(res.status),
            evidence: { snippet: res.text.slice(0, 200) }
        });
    } catch (error) {
        checks.push({
            id: 'AUTH_GUARD',
            description: 'Protected endpoint denies anonymous requests',
            status: 'NETWORK_ERROR',
            passed: false,
            evidence: { error: String(error.message || error) }
        });
    }

    // Check 5: TRACE blocked/unsupported.
    const trace = await traceRequest(`${BASE_URL}/api/auth/login`);
    const tracePassed = [403, 404, 405, 501].includes(trace.status)
        || /unsupported|not allowed|blocked|forbidden/i.test(trace.error || trace.text || '');

    checks.push({
        id: 'TRACE_BLOCK',
        description: 'TRACE method is blocked or unsupported',
        status: trace.status || 'NETWORK_ERROR',
        passed: tracePassed,
        evidence: {
            error: trace.error || null,
            snippet: String(trace.text || '').slice(0, 200)
        }
    });

    const passedCount = checks.filter((c) => c.passed).length;
    const failedCount = checks.length - passedCount;

    const summary = {
        target: BASE_URL,
        generatedAt: nowIso(),
        totalChecks: checks.length,
        passed: passedCount,
        failed: failedCount,
        checks
    };

    const jsonPath = path.join(REPORT_DIR, 'dast-fallback-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

    const mdLines = [];
    mdLines.push('# DAST Fallback Report');
    mdLines.push('');
    mdLines.push(`- Target: ${BASE_URL}`);
    mdLines.push(`- Generated: ${summary.generatedAt}`);
    mdLines.push(`- Total checks: ${summary.totalChecks}`);
    mdLines.push(`- Passed: ${summary.passed}`);
    mdLines.push(`- Failed: ${summary.failed}`);
    mdLines.push('');
    mdLines.push('## Results');
    mdLines.push('');

    for (const item of checks) {
        const marker = item.passed ? 'PASS' : 'FAIL';
        mdLines.push(`- [${marker}] ${item.id} | status=${item.status} | ${item.description}`);
    }

    const mdPath = path.join(REPORT_DIR, 'dast-fallback-report.md');
    fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

    console.log(`DAST fallback report generated:`);
    console.log(`- ${jsonPath}`);
    console.log(`- ${mdPath}`);

    for (const item of checks) {
        const marker = item.passed ? '[PASS]' : '[FAIL]';
        console.log(`${marker} ${item.id} | status=${item.status} | ${item.description}`);
    }

    if (failedCount > 0) {
        process.exitCode = 1;
    }
};

run().catch((error) => {
    console.error('DAST fallback scan failed:', error);
    process.exit(1);
});
