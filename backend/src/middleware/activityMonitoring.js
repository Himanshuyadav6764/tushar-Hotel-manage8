const ActivityLog = require('../models/ActivityLog');
const { notifySecurityAlert } = require('../utils/securityNotifier');

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAIL_THRESHOLD = 5;
const BURST_WINDOW_MS = 60 * 1000;
const BURST_THRESHOLD = 180;
const BOOKING_WINDOW_MS = 10 * 60 * 1000;
const BOOKING_MUTATION_THRESHOLD = 45;
const BOOKING_FAILURE_THRESHOLD = 15;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

const failedLoginByActor = new Map();
const requestBurstByIp = new Map();
const bookingMutationByIp = new Map();
const bookingFailureByIp = new Map();
const alertCooldownByKey = new Map();
let isSuspiciousDetectionPaused = false;

const SENSITIVE_KEYS = new Set([
    'password',
    'adminPassword',
    'currentPassword',
    'newPassword',
    'token',
    'authorization',
    'otp'
]);

const pruneOldEntries = (entries, now, windowMs) => {
    while (entries.length > 0 && (now - entries[0]) > windowMs) {
        entries.shift();
    }
};

const trackCounter = (store, key, now, windowMs) => {
    const entries = store.get(key) || [];
    entries.push(now);
    pruneOldEntries(entries, now, windowMs);
    store.set(key, entries);
    return entries.length;
};

const shouldSendAlertNow = (key, now) => {
    const lastAt = alertCooldownByKey.get(key) || 0;
    if ((now - lastAt) < ALERT_COOLDOWN_MS) {
        return false;
    }
    alertCooldownByKey.set(key, now);
    return true;
};

const toSafeObject = (value, depth = 0) => {
    if (depth > 3) return '[MaxDepth]';
    if (value === null || value === undefined) return value;

    if (typeof value === 'string') {
        return value.length > 300 ? `${value.slice(0, 300)}...` : value;
    }

    if (Array.isArray(value)) {
        return value.slice(0, 20).map((item) => toSafeObject(item, depth + 1));
    }

    if (typeof value !== 'object') {
        return value;
    }

    const safe = {};
    for (const [key, val] of Object.entries(value)) {
        if (SENSITIVE_KEYS.has(String(key).toLowerCase())) {
            safe[key] = '[REDACTED]';
        } else {
            safe[key] = toSafeObject(val, depth + 1);
        }
    }

    return safe;
};

const resolveBookingAction = (normalizedMethod, normalizedPath, statusCode) => {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod);
    const succeeded = statusCode >= 200 && statusCode < 300;

    let baseAction = 'booking_viewed';
    if (normalizedPath.includes('/check-in')) baseAction = 'booking_checkin';
    else if (normalizedPath.includes('/add-payment')) baseAction = 'booking_payment_added';
    else if (normalizedPath.includes('/amend-stay')) baseAction = 'booking_stay_amended';
    else if (normalizedPath.includes('/room-move')) baseAction = 'booking_room_moved';
    else if (normalizedPath.includes('/room-exchange')) baseAction = 'booking_room_exchanged';
    else if (normalizedPath.includes('/add-visitor')) baseAction = 'booking_visitor_added';
    else if (normalizedPath.includes('/no-show')) baseAction = 'booking_no_show_marked';
    else if (normalizedPath.includes('/void')) baseAction = 'booking_voided';
    else if (normalizedPath.includes('/cancel')) baseAction = 'booking_cancelled';
    else if (normalizedPath.includes('/transactions') && normalizedMethod === 'POST') baseAction = 'booking_transaction_added';
    else if (normalizedPath.includes('/transactions') && (normalizedMethod === 'PUT' || normalizedMethod === 'PATCH')) baseAction = 'booking_transaction_updated';
    else if (normalizedPath.includes('/transactions') && normalizedMethod === 'DELETE') baseAction = 'booking_transaction_deleted';
    else if (normalizedPath.includes('/route-folio')) baseAction = 'booking_folio_routed';
    else if (normalizedPath.includes('/add') || normalizedPath.includes('/create') || normalizedMethod === 'POST') baseAction = 'booking_created';
    else if (normalizedMethod === 'PUT' || normalizedMethod === 'PATCH') baseAction = 'booking_updated';
    else if (normalizedMethod === 'DELETE') baseAction = 'booking_deleted';

    if (isMutation && !succeeded) {
        return `${baseAction}_failed`;
    }

    return baseAction;
};

const resolveReservationAction = (normalizedMethod, normalizedPath, statusCode) => {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod);
    const succeeded = statusCode >= 200 && statusCode < 300;
    let baseAction = 'reservation_viewed';

    if (normalizedPath.includes('/checkin')) baseAction = 'reservation_checkin';
    else if (normalizedPath.includes('/checkout')) baseAction = 'reservation_checkout';
    else if (normalizedPath.includes('/cancel')) baseAction = 'reservation_cancelled';
    else if (normalizedPath.includes('/no-show')) baseAction = 'reservation_no_show_marked';
    else if (normalizedMethod === 'POST') baseAction = 'reservation_created';
    else if (normalizedMethod === 'PUT' || normalizedMethod === 'PATCH') baseAction = 'reservation_updated';
    else if (normalizedMethod === 'DELETE') baseAction = 'reservation_deleted';

    if (isMutation && !succeeded) {
        return `${baseAction}_failed`;
    }

    return baseAction;
};

const deriveCategoryAndAction = (method, path, statusCode) => {
    const normalizedMethod = String(method || 'GET').toUpperCase();
    const normalizedPath = String(path || '').toLowerCase();

    if (normalizedPath.startsWith('/api/auth/login')) {
        return {
            category: 'auth',
            action: statusCode >= 200 && statusCode < 300 ? 'login_success' : 'login_failed'
        };
    }

    if (normalizedPath.startsWith('/api/auth/register')) {
        return {
            category: 'auth',
            action: statusCode >= 200 && statusCode < 300 ? 'register_success' : 'register_failed'
        };
    }

    if (normalizedPath.startsWith('/api/bookings')) {
        return { category: 'booking', action: resolveBookingAction(normalizedMethod, normalizedPath, statusCode) };
    }

    if (normalizedPath.startsWith('/api/reservations')) {
        return { category: 'reservation', action: resolveReservationAction(normalizedMethod, normalizedPath, statusCode) };
    }

    if (normalizedPath.startsWith('/api/super-admin')) {
        return { category: 'admin', action: 'super_admin_action' };
    }

    if (normalizedPath.startsWith('/api/cashier') || normalizedPath.startsWith('/api/payment')) {
        return { category: 'billing', action: 'billing_action' };
    }

    return { category: 'system', action: 'api_request' };
};

const detectSuspiciousActivity = ({ method, path, statusCode, ipAddress, requestBody }) => {
    const reasons = [];
    const now = Date.now();
    const normalizedMethod = String(method || '').toUpperCase();
    const normalizedPath = String(path || '').toLowerCase();
    const ip = String(ipAddress || 'unknown');

    const burstCount = trackCounter(requestBurstByIp, ip, now, BURST_WINDOW_MS);
    if (burstCount > BURST_THRESHOLD) {
        reasons.push('high_request_rate');
    }

    const pathLooksMalicious = /\.{2}|%2e%2e|<script|union\s+select|drop\s+table|javascript:/i.test(normalizedPath);
    if (pathLooksMalicious) {
        reasons.push('malicious_path_pattern');
    }

    if (normalizedPath.startsWith('/api/auth/login') && statusCode >= 400) {
        const username = String(requestBody?.username || requestBody?.email || 'unknown').toLowerCase().trim();
        const actorKey = `${ip}::${username}`;
        const failCount = trackCounter(failedLoginByActor, actorKey, now, LOGIN_WINDOW_MS);
        if (failCount >= LOGIN_FAIL_THRESHOLD) {
            reasons.push('possible_bruteforce_login');
        }
    }

    const isBookingOrReservationPath = normalizedPath.startsWith('/api/bookings') || normalizedPath.startsWith('/api/reservations');
    const isMutationMethod = normalizedMethod === 'POST' || normalizedMethod === 'PUT' || normalizedMethod === 'PATCH' || normalizedMethod === 'DELETE';

    if (isBookingOrReservationPath && isMutationMethod) {
        const mutationCount = trackCounter(bookingMutationByIp, ip, now, BOOKING_WINDOW_MS);
        if (mutationCount >= BOOKING_MUTATION_THRESHOLD) {
            reasons.push('high_booking_mutation_rate');
        }

        if (statusCode >= 400) {
            const failureCount = trackCounter(bookingFailureByIp, ip, now, BOOKING_WINDOW_MS);
            if (failureCount >= BOOKING_FAILURE_THRESHOLD) {
                reasons.push('repeated_booking_failures');
            }
        }

        if (normalizedPath.includes('/void') || normalizedPath.includes('/cancel')) {
            const destructiveCount = trackCounter(bookingMutationByIp, `${ip}::destructive`, now, BOOKING_WINDOW_MS);
            if (destructiveCount >= 12) {
                reasons.push('excessive_booking_cancellations_or_voids');
            }
        }
    }

    if (isBookingOrReservationPath && typeof requestBody?.advancePaid !== 'undefined') {
        const advancePaid = Number(requestBody.advancePaid);
        if (Number.isFinite(advancePaid) && advancePaid > 5000000) {
            reasons.push('unusually_high_advance_payment_value');
        }
    }

    if ((normalizedMethod === 'TRACE' || normalizedMethod === 'TRACK' || normalizedMethod === 'CONNECT') && statusCode >= 400) {
        reasons.push('blocked_dangerous_method');
    }

    if ((normalizedPath.startsWith('/api/super-admin') || normalizedPath.startsWith('/api/auth')) && (statusCode === 401 || statusCode === 403)) {
        const unauthorizedCount = trackCounter(requestBurstByIp, `${ip}::unauthorized`, now, LOGIN_WINDOW_MS);
        if (unauthorizedCount >= 20) {
            reasons.push('repeated_unauthorized_access');
        }
    }

    return reasons;
};

const createActivityMonitoringMiddleware = () => {
    return (req, res, next) => {
        const startedAt = Date.now();

        if (isSuspiciousDetectionPaused) {
            return next();
        }

        res.on('finish', async () => {
            try {
                const method = req.method;
                const path = req.originalUrl || req.url || '';
                const statusCode = res.statusCode || 0;
                const ipAddress = req.ip || req.connection?.remoteAddress || '';
                const userAgent = req.get('user-agent') || '';
                const durationMs = Date.now() - startedAt;

                const requestBody = toSafeObject(req.body || {});
                const query = toSafeObject(req.query || {});
                const { category, action } = deriveCategoryAndAction(method, path, statusCode);
                const suspiciousReasons = detectSuspiciousActivity({
                    method,
                    path,
                    statusCode,
                    ipAddress,
                    requestBody
                });

                await ActivityLog.create({
                    userId: req.user?._id || null,
                    userEmail: req.user?.username || req.user?.email || '',
                    userRole: req.user?.role || 'anonymous',
                    hotelId: req.user?.hotelId || null,
                    category,
                    action,
                    method,
                    path,
                    statusCode,
                    durationMs,
                    requestBody,
                    query,
                    ipAddress,
                    userAgent,
                    suspicious: suspiciousReasons.length > 0,
                    suspiciousReasons
                });

                if (suspiciousReasons.length > 0) {
                    const now = Date.now();
                    const alertKey = `${ipAddress || 'unknown'}::${suspiciousReasons.join('|')}`;
                    if (shouldSendAlertNow(alertKey, now)) {
                        notifySecurityAlert({
                            title: 'Suspicious API activity detected',
                            category,
                            action,
                            method,
                            path,
                            statusCode,
                            userEmail: req.user?.username || req.user?.email || 'anonymous',
                            userRole: req.user?.role || 'anonymous',
                            ipAddress,
                            suspiciousReasons,
                            requestBody,
                            query
                        }).catch((error) => {
                            console.error('Security alert notify failed:', error.message);
                        });
                    }
                }
            } catch (error) {
                console.error('Activity monitor log error:', error.message);
            }
        });

        next();
    };
};

module.exports = {
    createActivityMonitoringMiddleware,
    isDetectionPaused: () => isSuspiciousDetectionPaused,
    setPauseDetection: (paused) => { isSuspiciousDetectionPaused = !!paused; }
};
