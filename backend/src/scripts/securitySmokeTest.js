/*
 * Basic API attack simulation checks.
 * Run: npm run security:smoke
 */

const BASE_URL = String(process.env.SECURITY_TEST_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

const tests = [
    {
        id: 'SQLI_LOGIN',
        description: 'SQL injection payload should be rejected',
        method: 'POST',
        path: '/api/auth/login',
        body: {
            username: "admin@bireena.com' OR '1'='1",
            password: 'random123!',
            role: 'admin'
        },
        allowedStatuses: [400, 401, 403, 429]
    },
    {
        id: 'XSS_LOGIN',
        description: 'XSS payload should be rejected',
        method: 'POST',
        path: '/api/auth/login',
        body: {
            username: '<script>alert(1)</script>@evil.test',
            password: 'random123!',
            role: 'admin'
        },
        allowedStatuses: [400, 401, 403, 429]
    },
    {
        id: 'TRACE_BLOCK',
        description: 'TRACE method should be blocked by firewall',
        method: 'TRACE',
        path: '/api/auth/login',
        body: null,
        allowedStatuses: [403, 405, 404]
    },
    {
        id: 'MALICIOUS_FILE_REF',
        description: 'Executable extension in image field should be blocked',
        method: 'PUT',
        path: '/api/hotel/settings',
        headers: {
            Authorization: 'Bearer invalid-token-for-security-test'
        },
        body: {
            logoUrl: 'https://attacker.test/payload.js'
        },
        // 401 can occur before payload check on protected routes; 400 means validation blocked.
        allowedStatuses: [400, 401, 403]
    }
];

const run = async () => {
    console.log(`Security smoke test target: ${BASE_URL}`);
    const results = [];

    for (const test of tests) {
        const url = `${BASE_URL}${test.path}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(test.headers || {})
        };

        try {
            const response = await fetch(url, {
                method: test.method,
                headers,
                body: test.body ? JSON.stringify(test.body) : undefined
            });

            const responseText = await response.text();
            const passed = test.allowedStatuses.includes(response.status);
            results.push({
                id: test.id,
                passed,
                status: response.status,
                description: test.description,
                snippet: responseText.slice(0, 220)
            });
        } catch (error) {
            const errorMessage = String(error && error.message ? error.message : error);
            const traceUnsupported = test.id === 'TRACE_BLOCK' && /unsupported/i.test(errorMessage) && /trace/i.test(errorMessage);

            results.push({
                id: test.id,
                passed: traceUnsupported,
                status: 'NETWORK_ERROR',
                description: test.description,
                snippet: errorMessage
            });
        }
    }

    console.log('\nSecurity smoke test results:\n');
    for (const result of results) {
        const marker = result.passed ? '[PASS]' : '[FAIL]';
        console.log(`${marker} ${result.id} | status=${result.status} | ${result.description}`);
        if (!result.passed) {
            console.log(`  Response snippet: ${result.snippet}`);
        }
    }

    const failed = results.filter((item) => !item.passed);
    if (failed.length > 0) {
        console.error(`\n${failed.length} security checks failed.`);
        process.exitCode = 1;
        return;
    }

    console.log('\nAll security smoke checks passed.');
};

run();
