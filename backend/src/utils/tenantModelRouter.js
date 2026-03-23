const mongoose = require('mongoose');
const { getTenantContext } = require('../middleware/tenantContext');
const { getTenantConnection } = require('./tenantConnectionManager');

const TENANT_EXEMPT_MODELS = new Set(['User', 'Hotel', 'AuditLog', 'OTPLog']);
const PATCH_FLAG = Symbol('tenantModelRouterPatched');

const shouldBypass = (context, modelName) => {
    if (TENANT_EXEMPT_MODELS.has(modelName)) return true;
    return context?.role === 'super_admin';
};

const getTenantBoundModel = (baseModel) => {
    const modelName = baseModel?.modelName;
    if (!modelName) return baseModel;

    const context = getTenantContext();
    if (shouldBypass(context, modelName)) {
        return baseModel;
    }

    const dbName = context?.dbName;
    if (!dbName) {
        throw new Error('Tenant database context missing.');
    }

    const tenantConnection = getTenantConnection(dbName);
    if (baseModel.db?.name === tenantConnection.name) {
        return baseModel;
    }

    if (tenantConnection.models[modelName]) {
        return tenantConnection.models[modelName];
    }

    return tenantConnection.model(modelName, baseModel.schema, baseModel.collection.name);
};

const installTenantModelRouter = () => {
    if (mongoose.Model[PATCH_FLAG]) return;
    mongoose.Model[PATCH_FLAG] = true;

    const staticMethodsToPatch = [
        'aggregate',
        'countDocuments',
        'create',
        'deleteMany',
        'deleteOne',
        'distinct',
        'estimatedDocumentCount',
        'exists',
        'find',
        'findById',
        'findByIdAndDelete',
        'findByIdAndUpdate',
        'findOne',
        'findOneAndDelete',
        'findOneAndUpdate',
        'insertMany',
        'replaceOne',
        'updateMany',
        'updateOne'
    ];

    for (const methodName of staticMethodsToPatch) {
        const original = mongoose.Model[methodName];
        if (typeof original !== 'function') continue;

        mongoose.Model[methodName] = function patchedModelMethod(...args) {
            const routedModel = getTenantBoundModel(this);
            return original.apply(routedModel, args);
        };
    }

    const originalSave = mongoose.Model.prototype.save;
    mongoose.Model.prototype.save = async function patchedSave(...args) {
        const currentModel = this.constructor;
        const routedModel = getTenantBoundModel(currentModel);

        if (routedModel === currentModel) {
            return originalSave.apply(this, args);
        }

        const payload = this.toObject({ depopulate: true });
        let savedDoc;

        if (this.isNew) {
            savedDoc = await routedModel.create(payload);
        } else {
            savedDoc = await routedModel.findByIdAndUpdate(
                this._id,
                payload,
                {
                    new: true,
                    runValidators: true,
                    overwrite: true
                }
            );
        }

        if (!savedDoc) {
            throw new Error('Failed to persist routed tenant document.');
        }

        this.set(savedDoc.toObject({ depopulate: true }));
        this.isNew = false;
        return this;
    };
};

module.exports = {
    installTenantModelRouter
};
