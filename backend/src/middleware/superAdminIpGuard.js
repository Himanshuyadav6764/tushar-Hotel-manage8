const normalizeIp = (rawIp = '') => {
    const ip = String(rawIp || '').trim();
    if (!ip) return '';
    if (ip.startsWith('::ffff:')) return ip.replace('::ffff:', '');
    return ip;
};

const getClientIp = (req) => {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '')
        .split(',')[0]
        .trim();

    return normalizeIp(forwarded || req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '');
};

const getAllowlistedIps = () => {
    return String(process.env.SUPER_ADMIN_IP_ALLOWLIST || '')
        .split(',')
        .map((item) => normalizeIp(item))
        .filter(Boolean);
};

const isAllowlistEnabled = () => {
    return String(process.env.SUPER_ADMIN_IP_ALLOWLIST_ENABLED || '').trim().toLowerCase() === 'true';
};

const isIpAllowed = (ip, allowlist) => {
    if (!allowlist || allowlist.length === 0) return true;
    return allowlist.includes(ip);
};

const superAdminIpGuard = (req, res, next) => {
    if (!isAllowlistEnabled()) {
        return next();
    }

    const allowlist = getAllowlistedIps();
    if (allowlist.length === 0) {
        return res.status(500).json({
            success: false,
            message: 'Super admin IP allowlist is enabled but no IPs are configured.'
        });
    }

    const clientIp = getClientIp(req);
    if (!clientIp || !isIpAllowed(clientIp, allowlist)) {
        return res.status(403).json({
            success: false,
            message: 'Access denied from this IP address.'
        });
    }

    return next();
};

module.exports = {
    superAdminIpGuard,
    getClientIp,
    getAllowlistedIps,
    isAllowlistEnabled,
    isIpAllowed
};
