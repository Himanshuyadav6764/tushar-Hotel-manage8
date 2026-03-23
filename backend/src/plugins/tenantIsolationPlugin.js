const mongoose = require('mongoose');
const { getTenantContext } = require('../middleware/tenantContext');

const TENANT_EXEMPT_MODELS = new Set(['User', 'Hotel', 'AuditLog', 'OTPLog']);

const shouldBypassTenant = (context) => context && context.role === 'super_admin';

const applyTenantFilterToQuery = function () {
    const modelName = this.model?.modelName;
    if (TENANT_EXEMPT_MODELS.has(modelName)) {
        return;
    }

    const tenantContext = getTenantContext();
    if (shouldBypassTenant(tenantContext)) {
        return;
    }

    const hotelId = tenantContext?.hotelId;
    if (!hotelId) {
        throw new Error('Tenant context missing. Provide auth token with hotelId or x-hotel-id header.');
    }

    const query = this.getQuery() || {};
    if (query.hotelId && String(query.hotelId) !== String(hotelId)) {
        throw new Error('Cross-tenant access denied.');
    }

    this.where({ hotelId: new mongoose.Types.ObjectId(hotelId) });
};

const applyTenantFilterToAggregate = function () {
    const modelName = this._model?.modelName;
    if (TENANT_EXEMPT_MODELS.has(modelName)) {
        return;
    }

    const tenantContext = getTenantContext();
    if (shouldBypassTenant(tenantContext)) {
        return;
    }

    const hotelId = tenantContext?.hotelId;
    if (!hotelId) {
        throw new Error('Tenant context missing. Provide auth token with hotelId or x-hotel-id header.');
    }

    const pipeline = this.pipeline();
    const matchStage = { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } };

    if (pipeline.length > 0 && pipeline[0].$geoNear) {
        pipeline.splice(1, 0, matchStage);
    } else {
        pipeline.unshift(matchStage);
    }
};

const installTenantIsolationPlugin = () => {
    mongoose.plugin((schema) => {
        // Add tenant field to all tenant-scoped schemas.
        if (!schema.path('hotelId')) {
            schema.add({
                hotelId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Hotel',
                    index: true
                }
            });
        }

        schema.pre('save', function (next) {
            const inferredModelName = this.constructor?.modelName;
            if (TENANT_EXEMPT_MODELS.has(inferredModelName)) {
                return next();
            }

            const tenantContext = getTenantContext();
            if (shouldBypassTenant(tenantContext)) {
                return next();
            }

            const hotelId = tenantContext?.hotelId;
            if (!hotelId) {
                return next(new Error('Tenant context missing for write operation.'));
            }

            if (!this.hotelId) {
                this.hotelId = new mongoose.Types.ObjectId(hotelId);
            } else if (String(this.hotelId) !== String(hotelId)) {
                return next(new Error('Cross-tenant write denied.'));
            }

            return next();
        });

        schema.pre('insertMany', function (next, docs) {
            const inferredModelName = this.modelName;
            if (TENANT_EXEMPT_MODELS.has(inferredModelName)) {
                return next();
            }

            const tenantContext = getTenantContext();
            if (shouldBypassTenant(tenantContext)) {
                return next();
            }

            const hotelId = tenantContext?.hotelId;
            if (!hotelId) {
                return next(new Error('Tenant context missing for bulk write operation.'));
            }

            for (const doc of docs || []) {
                if (!doc.hotelId) {
                    doc.hotelId = new mongoose.Types.ObjectId(hotelId);
                } else if (String(doc.hotelId) !== String(hotelId)) {
                    return next(new Error('Cross-tenant bulk write denied.'));
                }
            }

            return next();
        });

        const queryMiddlewares = [
            'countDocuments',
            'deleteMany',
            'deleteOne',
            'find',
            'findOne',
            'findOneAndDelete',
            'findOneAndReplace',
            'findOneAndUpdate',
            'replaceOne',
            'updateMany',
            'updateOne'
        ];

        queryMiddlewares.forEach((middlewareName) => {
            schema.pre(middlewareName, applyTenantFilterToQuery);
        });

        schema.pre('aggregate', applyTenantFilterToAggregate);
    });
};

module.exports = {
    installTenantIsolationPlugin,
    TENANT_EXEMPT_MODELS
};
