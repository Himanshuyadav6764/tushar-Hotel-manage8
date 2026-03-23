const mongoose = require('mongoose');

const floorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Floor name is required'],
        trim: true
    },
    roomCount: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

floorSchema.index({ hotelId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Floor', floorSchema);
