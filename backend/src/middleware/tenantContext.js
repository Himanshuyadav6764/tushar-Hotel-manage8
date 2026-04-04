const { AsyncLocalStorage } = require('async_hooks');
const jwt = require('jsonwebtoken');

const tenantStorage = new AsyncLocalStorage();

const TENANT_HEADER = 'x-hotel-id';
const TENANT_DB_HEADER = 'x-tenant-db';
const allowDefaultTenantFallback =
    process.env.NODE_ENV !== 'production'
    || String(process.env.ALLOW_DEFAULT_TENANT_CONTEXT || '').trim().toLowerCase() === 'true';

const normalizeTenantId = (value) => {
    if (!value) return null;
    return String(value).trim() || null;
};

const runTenantContext = (req, res, next) => {
    const headerTenantId = normalizeTenantId(req.headers[TENANT_HEADER]);
    const headerDbName = normalizeTenantId(req.headers[TENANT_DB_HEADER]);
    const defaultHotelId = normalizeTenantId(process.env.DEFAULT_HOTEL_ID);
    const defaultDbName = normalizeTenantId(process.env.DEFAULT_TENANT_DB);

    tenantStorage.run(
        {
            hotelId: headerTenantId || (allowDefaultTenantFallback ? defaultHotelId : null),
            dbName: headerDbName || (allowDefaultTenantFallback ? defaultDbName : null),
            role: null,
            userId: null
        },
        () => {
            // If auth token is present, hydrate role/hotelId early even on non-protected routes.
            const authHeader = req.headers.authorization;
            const guestAccessToken = req.headers['x-guest-access-token'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    const store = tenantStorage.getStore();
                    if (store) {
                        const tokenHotelId = normalizeTenantId(decoded.hotelId);
                        const tokenDbName = normalizeTenantId(decoded.dbName);

                        store.userId = decoded.id || null;
                        store.role = decoded.role || null;

                        // Header takes highest priority; otherwise prefer token over defaults.
                        if (!headerDbName && tokenDbName) {
                            store.dbName = tokenDbName;
                        }

                        if (!headerTenantId && tokenHotelId) {
                            store.hotelId = tokenHotelId;
                        }
                    }
                } catch (error) {
                    // Ignore invalid token here; auth middleware handles auth errors.
                }
            } else if (guestAccessToken) {
                try {
                    const decodedGuest = jwt.verify(String(guestAccessToken), process.env.JWT_SECRET);
                    const store = tenantStorage.getStore();
                    if (store && decodedGuest?.type === 'guest_room_qr') {
                        const guestHotelId = normalizeTenantId(decodedGuest.hotelId);
                        const guestDbName = normalizeTenantId(decodedGuest.dbName);

                        if (!headerDbName && guestDbName) {
                            store.dbName = guestDbName;
                        }

                        if (!headerTenantId && guestHotelId) {
                            store.hotelId = guestHotelId;
                        }
                    }
                } catch (error) {
                    // Ignore invalid guest token here; endpoint handler validates it.
                }
            }

            next();
        }
    );
};

const setTenantContextFromUser = (user, options = {}) => {
    const store = tenantStorage.getStore();
    if (!store || !user) return;

    store.userId = user._id ? String(user._id) : null;
    store.role = user.role || null;
    if (user.role !== 'super_admin') {
        store.hotelId = normalizeTenantId(user.hotelId);
        const resolvedDbName = normalizeTenantId(options.dbName || user.dbName);
        if (resolvedDbName) {
            store.dbName = resolvedDbName;
        }
    } else {
        store.hotelId = null;
        store.dbName = null;
    }
};

const getTenantContext = () => tenantStorage.getStore() || null;

module.exports = {
    runTenantContext,
    setTenantContextFromUser,
    getTenantContext,
    TENANT_HEADER,
    TENANT_DB_HEADER
};
