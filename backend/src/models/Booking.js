const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    // Core References
    guest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Guest',
        required: [true, 'Guest reference is required'],
        index: true
    },
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: [false, 'Room is required for stay bookings'], // Optional for "Inquiry" phase
        index: true
    },

    // Booking Metadata
    bookingId: {
        type: String, // e.g. BK-2024001
        required: true,
        uppercase: true,
        trim: true
    },
    referenceId: String, // Additional reference field for external IDs
    source: {
        type: String,
        enum: ['Walk-In', 'Online', 'Phone', 'Corporate', 'Agent', 'Direct'],
        default: 'Walk-In'
    },
    purpose: String,

    // Legacy/Flat Fields for Frontend Support
    roomNumber: String,
    roomType: String,
    guestName: String,
    mobileNumber: String,
    email: String,
    reservationType: String,
    businessSource: String,
    idProofType: String,
    idNumber: String,
    vehicleNumber: String,
    securityDeposit: Number,

    // Additional guests on the same booking
    additionalGuests: [{
        name: String,
        mobile: String,
        email: String,
        gender: String,
        nationality: String,
        dob: String,
        address: String,
        city: String,
        state: String,
        country: String,
        pinCode: String,
        idProofType: String,
        idProofNumber: String,
        vehicleNumber: String,
        companyName: String
    }],

    // Multi-room support inside single booking record
    rooms: [{
        roomType: String,
        roomNumber: String,
        adults: Number,
        children: Number,
        ratePerNight: Number,
        discount: Number,
        total: Number,
        mealPlan: String
    }],

    // Stay Details
    checkInDate: {
        type: Date,
        required: true,
        index: true
    },
    checkOutDate: {
        type: Date,
        required: true,
        index: true
    },
    actualCheckIn: Date,
    actualCheckOut: Date,

    duration: {
        nights: { type: Number, required: true, default: 1 },
        adults: { type: Number, default: 1 },
        children: { type: Number, default: 0 }
    },

    // Status
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled', 'NoShow', 'No-Show', 'No Show', 'NO_SHOW', 'Void', 'Voided', 'RESERVED', 'IN_HOUSE', 'CHECKED_OUT', 'Upcoming', 'Checked-in', 'Checked-out'], // Added compatibility for legacy NO_SHOW
        default: 'Pending',
        index: true
    },

    // Finances (Snapshot)
    billing: {
        roomRate: { type: Number, default: 0 }, // Rate at time of booking
        discount: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        serviceCharge: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 }, // Net total
        paidAmount: { type: Number, default: 0 },
        balanceAmount: { type: Number, default: 0 },
        currency: { type: String, default: 'INR' },

        // Detailed breakdown
        extras: [{
            description: String,
            amount: Number,
            date: { type: Date, default: Date.now }
        }]
    },

    // Payment History (Embedded for transactional integrity within booking context)
    transactions: [{
        type: { type: String, enum: ['Payment', 'Refund', 'Adjustment', 'Charge', 'Discount', 'payment', 'charge', 'discount'], required: true },
        amount: { type: Number, required: true },
        method: { type: String, enum: ['Cash', 'Card', 'UPI', 'Transfer'], default: 'Cash' },
        referenceId: String, // Transaction ID from payment gateway
        date: { type: Date, default: Date.now },
        day: String, // UI field
        particulars: String, // UI field
        description: String, // UI field
        user: String, // UI field
        notes: String,
        folioId: { type: Number, default: 0 }, // For routing support
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Staff
    }],

    // Visitors Log
    visitors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Visitor'
    }],

    // Internal Notes
    specialRequests: String,
    remarks: String,

    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checkedOutBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    auditTrail: [{
        action: { type: String, trim: true },
        description: { type: String, trim: true },
        performedBy: { type: String, trim: true, default: 'System' },
        performedAt: { type: Date, default: Date.now },
        metadata: { type: mongoose.Schema.Types.Mixed }
    }],

    // Multi-folio routing
    folios: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folio'
    }],
    routingRules: [{
        category: String, // e.g., laundry, spa, roomCharges, roomPosting
        targetFolioId: { type: Number, required: true }
    }]

}, {
    timestamps: true
});

bookingSchema.pre('validate', function (next) {
    // Normalize legacy status variants to canonical form to avoid enum failures.
    if (this.status === 'NO_SHOW' || this.status === 'No-Show' || this.status === 'No Show') {
        this.status = 'NoShow';
    }
    next();
});

bookingSchema.pre('save', function (next) {
    if (!this.billing) {
        this.billing = { roomRate: 0, totalAmount: 0, paidAmount: 0, balanceAmount: 0 };
    }

    if (this.transactions && this.transactions.length > 0) {
        // Core Sign Convention: Charges (+) , Payments (-)
        // We calculate absolute totals for billing fields
        const totalPaid = this.transactions
            .filter(t => t.type?.toLowerCase() === 'payment')
            .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

        const extraCharges = this.transactions
            .filter(t => t.type?.toLowerCase() === 'charge' && t.particulars !== 'Room Tariff' && t.particulars !== 'Room Charges')
            .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

        const roomTariffTrans = this.transactions
            .filter(t => t.particulars === 'Room Tariff' || t.particulars === 'Room Charges')
            .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

        const totalDiscounts = this.transactions
            .filter(t => t.type?.toLowerCase() === 'discount')
            .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

        // FALLBACK: If "Room Tariff" transaction is missing, we use (roomRate * nights)
        const baseStayValue = roomTariffTrans || ((this.billing.roomRate || 0) * (this.duration?.nights || 1));

        this.billing.paidAmount = totalPaid;
        this.billing.totalAmount = baseStayValue + extraCharges - totalDiscounts;
    }

    this.billing.balanceAmount = (this.billing.totalAmount || 0) - (this.billing.paidAmount || 0);
    next();
});

bookingSchema.index({ hotelId: 1, bookingId: 1 }, { unique: true });

module.exports = mongoose.model('Booking', bookingSchema);
