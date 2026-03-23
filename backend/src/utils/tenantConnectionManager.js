const mongoose = require('mongoose');

const connectionCache = new Map();

const normalizeDbName = (value) => {
    if (!value) return null;
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_\-]/g, '_');
};

const getTenantConnection = (dbName) => {
    const normalizedDbName = normalizeDbName(dbName);
    if (!normalizedDbName) {
        throw new Error('Tenant database name is missing.');
    }

    const baseConnection = mongoose.connection;
    if (!baseConnection || baseConnection.readyState !== 1) {
        throw new Error('Base MongoDB connection is not ready.');
    }

    if (connectionCache.has(normalizedDbName)) {
        return connectionCache.get(normalizedDbName);
    }

    const tenantConnection = baseConnection.useDb(normalizedDbName, { useCache: true });
    connectionCache.set(normalizedDbName, tenantConnection);
    return tenantConnection;
};

module.exports = {
    getTenantConnection,
    normalizeDbName
};
