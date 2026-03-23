const mongoose = require('mongoose');

const businessSourceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Business Source is required'],
        trim: true
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

businessSourceSchema.index({ hotelId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('BusinessSource', businessSourceSchema);
