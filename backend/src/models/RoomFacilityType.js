const mongoose = require('mongoose');

const roomFacilityTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Facility Type name is required'],
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

roomFacilityTypeSchema.index({ hotelId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('RoomFacilityType', roomFacilityTypeSchema);
