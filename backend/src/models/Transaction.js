const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Income', 'Expense', 'Refund', 'Void'],
        required: true
    },
    category: {
        type: String,
        enum: ['Room', 'Restaurant', 'Service', 'Other'],
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque', 'Credit'],
        required: true
    },

    // Links (Polymorphic-ish)
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: false
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: false
    },
    guest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Guest',
        required: false
    },

    // Meta
    referenceId: {
        type: String // Transaction ID
    },
    description: String,
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['Success', 'Pending', 'Failed'],
        default: 'Success'
    },
    date: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

transactionSchema.index(
    { hotelId: 1, referenceId: 1 },
    {
        unique: true,
        partialFilterExpression: { referenceId: { $type: 'string' } }
    }
);

module.exports = mongoose.model('Transaction', transactionSchema);
