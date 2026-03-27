const toList = (value = '') => String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeIp = (ip = '') => {
    const value = String(ip || '').trim();
    if (!value) return '';
    return value.replace(/^::ffff:/i, '');
};

const getClientIp = (req) => {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '')
        .split(',')[0]
        .trim();

    return normalizeIp(forwarded || req.ip || req.connection?.remoteAddress || '');
};

const DEFAULT_BLOCKED_USER_AGENTS = [
    'sqlmap',
    'nikto',
    'acunetix',
    'nessus',
    'nmap',
    'burp',
    'masscan',
    'zgrab'
];

const buildRegexList = (rawItems = []) => rawItems
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => new RegExp(escapeRegex(item), 'i'));

const createFirewallMiddleware = () => {
    const enabled = process.env.FIREWALL_ENABLED !== 'false';
    const allowIps = new Set(toList(process.env.FIREWALL_ALLOW_IPS).map(normalizeIp));
    const blockIps = new Set(toList(process.env.FIREWALL_BLOCK_IPS).map(normalizeIp));

    const blockedAgents = toList(process.env.FIREWALL_BLOCK_USER_AGENTS);
    const agentMatchers = buildRegexList(
        blockedAgents.length > 0 ? blockedAgents : DEFAULT_BLOCKED_USER_AGENTS
    );

    const blockedPathPatterns = toList(process.env.FIREWALL_BLOCK_PATH_PATTERNS)
        .map((pattern) => {
            try {
                return new RegExp(pattern, 'i');
            } catch (error) {
                return null;
            }
        })
        .filter(Boolean);

    const blockedMethods = new Set(
        toList(process.env.FIREWALL_BLOCK_METHODS || 'TRACE,TRACK,CONNECT')
            .map((item) => item.toUpperCase())
    );

    return (req, res, next) => {
        if (!enabled) {
            return next();
        }

        const method = String(req.method || '').toUpperCase();
        const path = String(req.originalUrl || req.url || '');
        const clientIp = getClientIp(req);
        const userAgent = String(req.headers['user-agent'] || '').toLowerCase();

        if (blockedMethods.has(method)) {
            return res.status(405).json({
                success: false,
                message: `HTTP method ${method} is not allowed`
            });
        }

        if (allowIps.size > 0 && !allowIps.has(clientIp)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied by firewall policy'
            });
        }

        if (clientIp && blockIps.has(clientIp)) {
            return res.status(403).json({
                success: false,
                message: 'Your IP has been blocked by firewall policy'
            });
        }

        if (agentMatchers.some((matcher) => matcher.test(userAgent))) {
            return res.status(403).json({
                success: false,
                message: 'Request blocked by firewall (user agent policy)'
            });
        }

        if (blockedPathPatterns.some((matcher) => matcher.test(path))) {
            return res.status(403).json({
                success: false,
                message: 'Request blocked by firewall (path policy)'
            });
        }

        return next();
    };
};

module.exports = {
    createFirewallMiddleware
};
