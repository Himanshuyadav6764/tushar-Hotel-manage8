const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    userEmail: {
        type: String,
        default: ''
    },
    userRole: {
        type: String,
        default: 'anonymous'
    },
    hotelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        default: null,
        index: true
    },
    category: {
        type: String,
        enum: ['auth', 'booking', 'reservation', 'billing', 'admin', 'system', 'other'],
        default: 'other',
        index: true
    },
    action: {
        type: String,
        required: true,
        index: true
    },
    method: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    statusCode: {
        type: Number,
        required: true,
        index: true
    },
    durationMs: {
        type: Number,
        default: 0
    },
    requestBody: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    query: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ipAddress: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    },
    suspicious: {
        type: Boolean,
        default: false,
        index: true
    },
    suspiciousReasons: {
        type: [String],
        default: []
    }
}, {
    timestamps: true
});

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ suspicious: 1, createdAt: -1 });
activityLogSchema.index({ category: 1, action: 1, createdAt: -1 });

// Keep activity logs for 180 days by default.
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
