const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
    tableName: {
        type: String,
        trim: true,
        required: true
    },
    tableNumber: {
        type: Number,
        required: true
    },
    capacity: {
        type: Number,
        default: 4
    },
    type: { // 'General', 'VIP', etc. matches controller usage
        type: String,
        default: 'General'
    },
    status: {
        type: String, // 'Available', 'Running', 'Billed', 'Reserved'
        enum: ['Available', 'Running', 'Billed', 'Reserved', 'Occupied', 'Cleaning'],
        default: 'Available'
    },

    // Runtime Order State (denormalized for performance/controller logic)
    currentOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    guests: {
        type: Number,
        default: 0
    },
    orderStartTime: Date,
    runningOrderAmount: {
        type: Number,
        default: 0
    },

    // Merging logic
    mergedTableIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Table'
    }],
    originalTableName: String,
    originalCapacity: Number,

    // Reservations
    reservations: [{
        id: String,
        name: String,
        guestName: String, // legacy support
        date: String,      // YYYY-MM-DD
        startTime: String,
        endTime: String,
        guests: Number,
        phone: String,
        contact: String,   // legacy support
        note: String,
        advancePayment: Number,
        source: {
            type: String,
            enum: ['Walk-In', 'Phone', 'Online'],
            default: 'Phone'
        },
        status: {
            type: String,
            enum: ['Upcoming', 'Arrived', 'Completed', 'Cancelled', 'No Show'],
            default: 'Upcoming'
        },
        cancellationReason: String,
        cancellationNote: String,
        cancellationCharge: {
            type: Number,
            default: 0
        },
        cancelledAt: Date,
        cancelledBy: String
    }],

    location: {
        type: String,
        default: 'Main Hall'
    },
    qrCode: String
}, {
    timestamps: true
});

// Helper methods from controller logic
tableSchema.methods.getOrderDuration = function () {
    if (!this.orderStartTime) return 0;
    const now = new Date();
    const start = new Date(this.orderStartTime);
    const diffMs = now - start;
    return Math.floor(diffMs / 1000 / 60); // minutes
};

tableSchema.methods.getFormattedDuration = function () {
    const minutes = this.getOrderDuration();
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
};

// Compound unique index: same tableName allowed in different types, but not in same type
tableSchema.index({ hotelId: 1, tableName: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Table', tableSchema);
