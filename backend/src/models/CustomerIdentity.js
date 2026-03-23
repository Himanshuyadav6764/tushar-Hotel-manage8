const mongoose = require('mongoose');

const customerIdentitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Identity Type is required'],
        trim: true
    },
    requiredByLaw: {
        type: Boolean,
        default: false
    },
    usedForReservations: {
        type: Boolean,
        default: false
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

customerIdentitySchema.index({ hotelId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('CustomerIdentity', customerIdentitySchema);
