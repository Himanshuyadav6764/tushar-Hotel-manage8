const mongoose = require('mongoose');

const reservationTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Reservation Type name is required'],
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

reservationTypeSchema.index({ hotelId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ReservationType', reservationTypeSchema);
