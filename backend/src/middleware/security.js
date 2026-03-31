const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';
const toPositiveInt = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const generalWindowMinutes = toPositiveInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 10);
const generalMaxRequests = toPositiveInt(
    process.env.RATE_LIMIT_MAX,
    isDev ? 10000 : 2000
);
const disableGeneralRateLimit = process.env.DISABLE_API_RATE_LIMIT === 'true' || isDev;

const isLocalRequest = (req) => {
    const host = String(req.hostname || req.headers?.host || '')
        .toLowerCase()
        .split(':')[0];
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = String(req.ip || req.connection?.remoteAddress || forwarded || '').toLowerCase();

    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    return localHosts.has(host)
        || ip === '::1'
        || ip === '127.0.0.1'
        || ip.endsWith('::ffff:127.0.0.1');
};

// Helper to get client IP safely
const getClientIp = (req) => {
    return req.ip || req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
};

// General API rate limiter
// Development: relaxed
// Production: practical default, configurable via env
const limiter = disableGeneralRateLimit
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: generalWindowMinutes * 60 * 1000,
        max: generalMaxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: getClientIp,
        skip: (req) => {
            const path = String(req.path || '');
            // Never throttle local development requests and keep modal list flows responsive.
            return isLocalRequest(req)
                || path.startsWith('/guests')
                || path.startsWith('/rooms')
                || path.startsWith('/bookings/list')
                || path.startsWith('/reservations/list');
        },
        message: {
            success: false,
            message: `Too many requests from this IP, please try again in ${generalWindowMinutes} minutes`
        }
    });

// Login route limiter - stricter to prevent brute force
// Development: relaxed (50 attempts / 15 min)
// Production: strict (10 attempts / 15 min)
const loginLimiter = disableGeneralRateLimit
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: isDev ? 50 : 10,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: getClientIp,
        message: {
            success: false,
            message: 'Too many login attempts, please try again after 15 minutes'
        }
    });

// Super admin panel limiter - protects dashboard APIs from abuse.
const superAdminLimiter = disableGeneralRateLimit
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 10 * 60 * 1000,
        max: isDev ? 300 : 120,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: getClientIp,
        message: {
            success: false,
            message: 'Too many super admin requests, please try again in a few minutes'
        }
    });

// Extra strict limiter for high-risk super admin actions.
const superAdminCriticalLimiter = disableGeneralRateLimit
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 10 * 60 * 1000,
        max: isDev ? 40 : 15,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: getClientIp,
        message: {
            success: false,
            message: 'Too many critical admin actions, please wait and try again'
        }
    });

module.exports = { limiter, loginLimiter, superAdminLimiter, superAdminCriticalLimiter };
