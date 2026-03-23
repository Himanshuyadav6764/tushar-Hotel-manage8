const mongoose = require('mongoose');

const extraChargeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Charge Name is required'],
        trim: true
    },
    chargeType: {
        type: String,
        required: [true, 'Charge Type is required'],
        enum: ['Per Night', 'Fixed', 'Per Item']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: 0
    },
    taxApplicable: {
        type: Boolean,
        default: true
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

extraChargeSchema.index({ hotelId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ExtraCharge', extraChargeSchema);
