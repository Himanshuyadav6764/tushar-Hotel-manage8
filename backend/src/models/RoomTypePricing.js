const mongoose = require('mongoose');

const roomTypePricingSchema = new mongoose.Schema({
    roomType: {
        type: String,
        required: [true, 'Room type is required'],
        trim: true
    },
    minPrice: {
        type: Number,
        required: [true, 'Minimum price is required'],
        min: 0
    },
    maxPrice: {
        type: Number,
        required: [true, 'Maximum price is required'],
        min: 0
    },
    defaultPrice: {
        type: Number,
        min: 0
    },
    weekendMultiplier: {
        type: Number,
        default: 1,
        min: 1
    },
    seasonalMultiplier: {
        type: Number,
        default: 1,
        min: 1
    },
    dynamicPricingEnabled: {
        type: Boolean,
        default: false
    },
    currency: {
        type: String,
        default: 'INR'
    }
}, {
    timestamps: true
});

roomTypePricingSchema.index({ hotelId: 1, roomType: 1 }, { unique: true });

const RoomTypePricing = mongoose.model('RoomTypePricing', roomTypePricingSchema);

module.exports = RoomTypePricing;
