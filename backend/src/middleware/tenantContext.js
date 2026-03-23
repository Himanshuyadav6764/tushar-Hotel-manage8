const { AsyncLocalStorage } = require('async_hooks');
const jwt = require('jsonwebtoken');

const tenantStorage = new AsyncLocalStorage();

const TENANT_HEADER = 'x-hotel-id';
const TENANT_DB_HEADER = 'x-tenant-db';

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
            hotelId: headerTenantId || defaultHotelId,
            dbName: headerDbName || defaultDbName,
            role: null,
            userId: null
        },
        () => {
            // If auth token is present, hydrate role/hotelId early even on non-protected routes.
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    const store = tenantStorage.getStore();
                    if (store) {
                        store.userId = decoded.id || null;
                        store.role = decoded.role || null;
                        if (!store.dbName) {
                            store.dbName = normalizeTenantId(decoded.dbName);
                        }
                        if (!store.hotelId) {
                            store.hotelId = normalizeTenantId(decoded.hotelId);
                        }
                    }
                } catch (error) {
                    // Ignore invalid token here; auth middleware handles auth errors.
                }
            }

            next();
        }
    );
};

const setTenantContextFromUser = (user) => {
    const store = tenantStorage.getStore();
    if (!store || !user) return;

    store.userId = user._id ? String(user._id) : null;
    store.role = user.role || null;
    if (user.role !== 'super_admin') {
        store.hotelId = normalizeTenantId(user.hotelId);
        if (user.dbName) {
            store.dbName = normalizeTenantId(user.dbName);
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
