const mongoose = require('mongoose');

const bedTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Bed type name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

bedTypeSchema.index({ hotelId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('BedType', bedTypeSchema);
