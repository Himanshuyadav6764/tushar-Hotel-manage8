const mongoose = require('mongoose');

const slugifyDbToken = (value) => {
    return String(value || 'hotel')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 20) || 'hotel';
};

const hotelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Hotel name is required'],
        trim: true
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true
    },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pin: { type: String, trim: true, default: '' },
    gstNumber: {
        type: String,
        trim: true
    },
    phone: {
        type: String
    },
    dbName: {
        type: String,
        required: [true, 'Tenant database name is required'],
        unique: true,
        trim: true,
        lowercase: true
    },
    logoUrl: { type: String, default: null },

    // Regional Settings
    currency: { type: String, default: 'INR (₹)' },
    timezone: { type: String, default: '(GMT+05:30) Kolkata' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    timeFormat: { type: String, default: '12 Hour' },

    // Tax Settings
    taxType: { type: String, default: 'GST' },
    cgst: { type: Number, default: 2.5 },
    sgst: { type: Number, default: 2.5 },
    serviceCharge: { type: Number, default: 10 },
    roomGst: { type: Number, default: 12 },
    roomGstSlabs: {
        type: [{
            min: { type: Number, default: 0 },
            max: { type: Number, default: 0 },
            rate: { type: Number, default: 0 }
        }],
        default: [
            { min: 0, max: 1000, rate: 0 },
            { min: 1001, max: 7500, rate: 12 },
            { min: 7501, max: 99999, rate: 18 }
        ]
    },
    foodGst: { type: Number, default: 5 },
    roomServiceCharge: { type: Number, default: 5 },
    inclusiveTax: { type: Boolean, default: false },

    // Invoice & Billing
    invoicePrefix: { type: String, default: 'INV-2026-' },
    billingInvoicePrefix: { type: String, default: 'ATITHI' },
    startingInvoiceNumber: { type: String, default: '1001' },
    panNumber: { type: String, default: '' },
    autoGenerateInvoice: { type: Boolean, default: true },
    autoIncrementInvoice: { type: Boolean, default: true },
    billPrintFormat: { type: String, default: 'Hotel Invoice' },
    thankYouMessage: { type: String, default: 'Thank you for visiting our hotel!' },

    // Feature Toggles
    enableRoomPosting: { type: Boolean, default: true },
    posEnabled: { type: Boolean, default: true },
    displayLogoOnBill: { type: Boolean, default: true },
    printKOTHeader: { type: Boolean, default: true },

    // Payment Modes
    paymentModes: {
        cash: { type: Boolean, default: true },
        upi: { type: Boolean, default: true },
        card: { type: Boolean, default: true },
        bankTransfer: { type: Boolean, default: true },
        wallet: { type: Boolean, default: true },
        creditAllowed: { type: Boolean, default: true }
    },

    // Billing Rules
    billingRules: {
        autoPost: { type: Boolean, default: true },
        mandatorySettlement: { type: Boolean, default: true },
        partialPayment: { type: Boolean, default: true },
        splitBill: { type: Boolean, default: true },
        mergeTable: { type: Boolean, default: true },
        addToRoom: { type: Boolean, default: true }
    },

    // Discount Rules
    discountRules: {
        maxDiscount: { type: Number, default: 25 },
        managerApproval: { type: Boolean, default: true },
        couponEnabled: { type: Boolean, default: true }
    },

    isActive: {
        type: Boolean,
        default: true
    },
    subscription: {
        plan: {
            type: String,
            enum: ['basic', 'premium'],
            default: 'basic',
            required: true
        },
        startDate: {
            type: Date,
            required: true
        },
        expiryDate: {
            type: Date,
            required: true
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Method to check if subscription is expired
hotelSchema.methods.isSubscriptionExpired = function() {
    return new Date() > this.subscription.expiryDate;
};

// Method to check if subscription is expiring soon (within 7 days)
hotelSchema.methods.isExpiringSoon = function() {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    return this.subscription.expiryDate <= sevenDaysFromNow && this.subscription.expiryDate > new Date();
};

hotelSchema.pre('validate', function (next) {
    if (!this.dbName) {
        const suffix = this._id ? String(this._id).slice(-6) : Date.now().toString().slice(-6);
        this.dbName = `tenant_${slugifyDbToken(this.name)}_${suffix}`;
    }
    next();
});

module.exports = mongoose.model('Hotel', hotelSchema);
