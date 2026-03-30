const mongoose = require('mongoose');

const housekeepingTaskSchema = new mongoose.Schema({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    roomNumber: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "completed"],
        default: "pending"
    },
    pendingAcknowledged: {
        type: Boolean,
        default: false
    },
    pendingAcknowledgedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('HousekeepingTask', housekeepingTaskSchema);
