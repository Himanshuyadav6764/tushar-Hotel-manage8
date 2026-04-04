const emitOpsNotification = (req, payload = {}) => {
    try {
        const io = req?.app?.get('io');
        if (!io) return null;

        const timestamp = new Date().toISOString();
        const eventId = String(
            payload.eventId
            || `${payload.entity || 'ops'}-${payload.entityId || 'unknown'}-${Date.now()}`
        );

        const eventPayload = {
            eventId,
            timestamp,
            module: payload.module || 'operations',
            entity: payload.entity || 'event',
            entityId: payload.entityId ? String(payload.entityId) : undefined,
            title: payload.title || 'Operational update',
            message: payload.message || 'A new operational event was received.',
            data: payload.data || {},
            ...payload,
        };

        io.emit('ops:notification', eventPayload);
        return eventPayload;
    } catch (error) {
        return null;
    }
};

module.exports = {
    emitOpsNotification,
};
