const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema({
    // Core Identity
    fullName: {
        type: String,
        required: [true, 'Guest name is required'],
        trim: true,
        index: true
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        sparse: true // Allow unique but also nulls if not provided
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        trim: true,
        index: true
    },

    // Demographics
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        default: 'Male'
    },
    nationality: {
        type: String,
        default: 'Indian'
    },
    dob: Date,
    anniversary: Date,

    // Address
    address: {
        line: String,
        city: String,
        state: String,
        country: {
            type: String,
            default: 'India'
        },
        pinCode: String
    },

    // KYC / ID Proof
    idProof: {
        type: {
            type: String,
            enum: ['Aadhaar', 'Passport', 'Driving License', 'Voter ID', 'PAN Card', 'Other'],
            default: 'Aadhaar'
        },
        number: {
            type: String,
            trim: true
        },
        files: [{
            url: String,
            type: String // 'front', 'back', 'other'
        }]
    },

    // Business Info
    companyName: String,
    gstNumber: String,

    // System Metadata
    photo: String, // Profile photo URL
    notes: String,

    // Stats (Cached - update via hooks/controllers)
    stays: {
        count: { type: Number, default: 0 },
        totalSpent: { type: Number, default: 0 },
        lastStayDate: Date
    },

    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for search
guestSchema.index({ fullName: 'text', mobile: 'text', email: 'text' });
guestSchema.index({ hotelId: 1, mobile: 1 }, { unique: true });

module.exports = mongoose.model('Guest', guestSchema);
