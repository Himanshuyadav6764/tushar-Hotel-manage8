const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // Controller aliases (GuestMealOrder style)
    tableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Table'
    },
    tableNumber: Number,
    roomNumber: String,
    guestName: String,
    guestPhone: String,
    numberOfGuests: { type: Number, default: 1 },

    orderType: {
        type: String,
        enum: ['Dine-In', 'Room Service', 'Take Away', 'Post to Room', 'Room Order', 'Delivery', 'Direct Payment', 'Online'], // Merged enums
        default: 'Dine-In'
    },

    // New Standard Links
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest' },

    // Flexible Items Structure (Controller uses flat structure)
    items: [{
        menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu' }, // Link to Menu
        id: String, // Legacy or frontend ID
        menuItemId: String, // Another variant seen in controller
        name: String,
        itemName: String,
        quantity: { type: Number, default: 1 },
        price: Number,
        total: Number,
        notes: String,
        subtotal: Number,
        category: String,
        image: String
    }],

    // Financials
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    serviceChargeAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    discountMeta: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    discountHistory: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },
    finalAmount: { type: Number, default: 0 }, // Controller uses this
    totalAmount: { type: Number, default: 0 }, // Internal standardized

    revenue: { type: Number, default: 0 }, // For analytics

    // Status
    status: {
        type: String,
        enum: ['Pending', 'Active', 'Confirmed', 'Preparing', 'Ready', 'Started', 'Served', 'Billed', 'Completed', 'Cancelled', 'Closed', 'Pending Payment'],
        default: 'Active',
        index: true
    },

    paymentMethod: {
        type: String,
        default: 'Pending'
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed', 'Partial', 'Refunded'],
        default: 'Pending'
    },
    paymentSplits: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },

    billing: { // New structure if we want to migrate slowly
        subtotal: Number,
        tax: Number,
        total: Number,
        balance: Number
    },

    notes: String,
    kotNote: String,
    billedAt: Date,
    closedAt: Date

}, {
    timestamps: true
});

// Harmonize fields pre-save
orderSchema.pre('save', function (next) {
    // Sync tableId <-> table
    if (this.tableId && !this.table) this.table = this.tableId;
    if (this.table && !this.tableId) this.tableId = this.table;

    // Allow settlement flow to persist exact cashier-calculated values.
    if (this.$locals && this.$locals.skipFinancialRecalc) {
        return next();
    }

    // Recalculate if items exist (Controller logic replication)
    if (this.items && this.items.length > 0) {
        this.subtotal = this.items.reduce((sum, item) => {
            const itemTotal = (item.price || 0) * (item.quantity || 1);
            item.subtotal = itemTotal; // Update item subtotal
            item.total = itemTotal;
            return sum + itemTotal;
        }, 0);

        this.tax = (this.subtotal * (this.taxRate || 0)) / 100;
        this.totalAmount = this.subtotal + this.tax;
        this.finalAmount = this.totalAmount - (this.discountAmount || 0);
    }

    next();
});

module.exports = mongoose.model('Order', orderSchema);
