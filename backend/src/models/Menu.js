const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
    itemName: { // Changed from 'name' to 'itemName' to match controller
        type: String,
        required: true,
        trim: true
    },
    foodCode: { // Required by controller
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        index: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    description: String,

    // Inventory/Stock
    quantity: { // Daily stock
        type: Number,
        default: 0
    },
    unit: {
        type: String,
        default: 'PCS'
    },

    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },

    // Legacy/Extra fields
    dietary: {
        type: String,
        enum: ['Veg', 'Non-Veg', 'Vegan', 'Egg'],
        default: 'Veg'
    },
    image: String, // URL
    isAvailable: {
        type: Boolean,
        default: true
    },
    preparationTime: {
        type: Number,
        default: 15
    }
}, {
    timestamps: true
});

menuSchema.index({ hotelId: 1, foodCode: 1 }, { unique: true });

module.exports = mongoose.model('Menu', menuSchema);
