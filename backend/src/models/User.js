const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: 'staff'
    },
    phone: {
        type: String
    },
    hotelName: {
        type: String
    },
    gstNumber: {
        type: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    subscriptionStart: {
        type: Date
    },
    subscriptionEnd: {
        type: Date
    },
    name: {
        type: String,
        required: true
    },
    hotelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: function () {
            return this.role !== 'super_admin'; // Only non-super_admin users need hotelId
        }
    },
    permissions: {
        type: [String],
        default: []
    },
    // New Staff Management Fields
    image: {
        type: String, // URL to image
        default: ''
    },
    outlet: {
        type: String,
        default: 'General'
    },
    shift: {
        type: String,
        enum: ['Morning', 'Evening', 'Night'],
        default: 'Morning'
    },
    salary: {
        type: Number,
        default: 0
    },
    attendanceStatus: {
        type: String,
        enum: ['Present', 'Absent', 'On Leave'],
        default: 'Present'
    },
    performance: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date,
        default: null
    },
    suspendedBySystem: {
        type: Boolean,
        default: false
    },
    suspendedAt: {
        type: Date,
        default: null
    },
    suspensionReason: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isAccountLocked = function () {
    return !!(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

module.exports = mongoose.model('User', userSchema);
