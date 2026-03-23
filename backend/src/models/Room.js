const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: [true, 'Room number is required'],
        trim: true,
        index: true
    },
    roomType: {
        type: String,
        required: [true, 'Room type is required'],
        trim: true,
        index: true
    },
    bedType: {
        type: String,
        default: 'Double',
        trim: true
    },
    price: {
        type: Number,
        required: [true, 'Room price is required'],
        min: 0
    },
    capacity: {
        type: Number,
        required: [true, 'Room capacity is required'],
        min: 1
    },
    floor: {
        type: String, // Kept as String to allow "Ground Floor" etc.
        required: false,
        trim: true
    },
    status: {
        type: String,
        enum: ['Available', 'Booked', 'Occupied', 'Maintenance', 'Cleaning', 'Under Maintenance'],
        default: 'Available',
        index: true
    },
    housekeepingStatus: {
        type: String,
        enum: ["clean", "dirty"],
        default: "clean"
    },

    // Enterprise / Advanced Features
    roomViewType: {
        type: String, // 'Sea View', 'City View'
        trim: true
    },
    smokingPolicy: {
        type: String, // 'Smoking', 'Non-Smoking'
        enum: ['Smoking', 'Non-Smoking'],
        default: 'Non-Smoking'
    },
    roomSize: {
        type: Number, // Sq ft
        default: 0
    },
    isSmartRoom: {
        type: Boolean,
        default: false
    },
    dynamicRateEnabled: {
        type: Boolean,
        default: false
    },
    facilities: [{
        type: String,
        trim: true
    }],

    // Legacy fields if needed
    amenities: [String]

}, {
    timestamps: true
});

roomSchema.index({ hotelId: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);
