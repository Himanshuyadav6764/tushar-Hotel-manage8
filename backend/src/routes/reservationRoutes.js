const express = require('express');
const router = express.Router();
const Reservation = require('../models/Booking');

// GET all reservations
router.get('/list', async (req, res) => {
    try {
        const reservations = await Reservation.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: reservations
        });
    } catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reservations',
            error: error.message
        });
    }
});

// GET reservation by ID (Universal for Stay Management)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[DEBUG] GET /api/reservations/${id} - Fetching stay details (v2.1)`);

        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.error(`[ERROR] Invalid ObjectId: ${id}`);
            return res.status(400).json({ success: false, message: 'Invalid reservation ID format' });
        }

        const Booking = require('../models/Booking');
        const Reservation = require('../models/Booking');

        let data = await Reservation.findById(id);

        if (!data) {
            console.log(`[DEBUG] Not found in Reservation model, checking Booking...`);
            const booking = await Booking.findById(id);
            if (booking) {
                console.log(`[DEBUG] Found in Booking model: ${booking.referenceId || booking.bookingId}`);
                data = {
                    _id: booking._id,
                    reservationId: booking.referenceId || booking.bookingId,
                    guestName: booking.guestName,
                    checkInDate: booking.checkInDate,
                    checkOutDate: booking.checkOutDate,
                    checkInTime: booking.scheduledCheckInTime || '14:00',
                    checkOutTime: booking.scheduledCheckOutTime || '11:00',
                    nights: booking.numberOfNights,
                    adults: booking.numberOfAdults,
                    children: booking.numberOfChildren,
                    ratePerNight: booking.pricePerNight,
                    taxPercentage: booking.taxPercentage || 12,
                    discount: booking.discount || 0,
                    grandTotal: booking.totalAmount,
                    balance: booking.remainingAmount,
                    status: booking.status,
                    roomNumber: booking.roomNumber,
                    roomType: booking.roomType,
                    idProofType: booking.idProofType,
                    idNumber: booking.idNumber,
                    vehicleNumber: booking.vehicleNumber
                };
            }
        } else {
            console.log(`[DEBUG] Found in Reservation model: ${data.referenceId}`);
            data = {
                _id: data._id,
                reservationId: data.referenceId,
                guestName: data.guestName,
                checkInDate: data.checkInDate,
                checkOutDate: data.checkOutDate,
                checkInTime: data.scheduledCheckInTime || data.checkInTime || '14:00',
                checkOutTime: data.scheduledCheckOutTime || data.checkOutTime || '11:00',
                nights: data.nights,
                adults: data.adults || 1,
                children: data.children || 0,
                ratePerNight: (data.amount / (data.nights || 1)) || 0,
                taxPercentage: 12,
                discount: 0,
                grandTotal: data.amount,
                balance: data.balance,
                status: data.status,
                roomNumber: data.roomNumber,
                roomType: data.roomType,
                idProofType: data.idProofType,
                idNumber: data.idNumber,
                vehicleNumber: data.vehicleNumber
            };
        }

        if (!data) {
            console.warn(`[WARN] Stay record not found for ID: ${id}`);
            return res.status(404).json({ success: false, message: 'Stay record not found' });
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('[CRITICAL] Error fetching stay details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch record', error: error.message });
    }
});

// PUT Check-In Reservation
router.put('/checkin/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const reservation = await Reservation.findById(id);

        if (!reservation) {
            console.log("Reservation not found for ID:", id);
            const all = await Reservation.find();
            console.log("All IDs in DB:", all.map(r => r._id.toString()));
            return res.status(500).json({ message: "Debug: ID mismatch" });
        }

        // Update fields from sidebar form
        reservation.status = "Checked-in"; // Use Checked-in for consistency
        if (req.body.arrivalDate && req.body.checkInTime) {
            reservation.actualCheckIn = new Date(`${req.body.arrivalDate}T${req.body.checkInTime}`);
        } else {
            reservation.actualCheckIn = new Date();
        }

        reservation.idProofType = req.body.idProofType;
        reservation.idNumber = req.body.idNumber;

        if (!reservation.duration) reservation.duration = { nights: 1, adults: 1, children: 0 };
        reservation.duration.adults = Number(req.body.adults) || reservation.duration.adults;
        reservation.duration.children = Number(req.body.children) || reservation.duration.children;
        reservation.vehicleNumber = req.body.vehicleNumber;
        const depositAmount = Number(req.body.securityDeposit) || 0;
        reservation.securityDeposit = depositAmount;
        reservation.remarks = req.body.remarks;

        // Record security deposit as a payment transaction so it updates the paid amount and balance
        if (depositAmount > 0) {
            // Check if we already have a Security Deposit transaction for this check-in to prevent duplicates
            // (Simple check by notes match)
            const hasDeposit = reservation.transactions && reservation.transactions.some(t => t.notes === 'Security Deposit at Check-in');

            if (!hasDeposit) {
                if (!reservation.transactions) reservation.transactions = [];
                reservation.transactions.push({
                    type: 'Payment',
                    amount: depositAmount,
                    method: 'Cash', // Default for check-in deposit if not specified
                    notes: 'Security Deposit at Check-in',
                    date: new Date()
                });
            }
        }

        await reservation.save();

        // Update room status to Occupied
        const Room = require('../models/Room');
        const roomNumbers = [];
        if (reservation.isMulti && reservation.rooms && reservation.rooms.length > 0) {
            reservation.rooms.forEach(r => {
                if (r.roomNumber && r.roomNumber !== 'TBD') roomNumbers.push(r.roomNumber);
            });
        } else if (reservation.roomNumber && reservation.roomNumber !== 'TBD') {
            roomNumbers.push(reservation.roomNumber);
        }

        for (const roomNo of roomNumbers) {
            await Room.findOneAndUpdate({ roomNumber: roomNo }, { status: 'Occupied' });
        }

        // --- STEP 3: Auto Create Folios on CHECKED_IN ---
        try {
            const Folio = require('../models/Folio');
            const { recalculateFolio } = require('../controllers/folioController');

            if (!reservation.folios || reservation.folios.length === 0) {
                const createdFolioIds = [];

                // 1. Create PRIMARY folio
                const numberOfNights = reservation.duration?.nights || 1;
                const roomRate = (reservation.amount / (reservation.nights || 1)) || 0;
                const totalRoomCharge = roomRate * numberOfNights;

                const primaryFolio = await Folio.create({
                    type: 'PRIMARY',
                    reservationId: reservation._id,
                    roomId: reservation.room || reservation.roomId,
                    guestId: reservation.guest || reservation.guestId,
                    entries: [{
                        type: 'ROOM_CHARGE',
                        description: `Room charge for ${numberOfNights} night(s)`,
                        amount: totalRoomCharge,
                        addedBy: 'System'
                    }],
                    status: 'OPEN'
                });

                if (depositAmount > 0) {
                    primaryFolio.entries.push({
                        type: 'PAYMENT',
                        description: 'Security Deposit at Check-in',
                        amount: depositAmount,
                        paymentMode: 'CASH',
                        addedBy: 'System'
                    });
                    await primaryFolio.save();
                }

                await recalculateFolio(primaryFolio._id);
                createdFolioIds.push(primaryFolio._id);

                // 2. If corporate
                if (reservation.source === 'Corporate' || reservation.businessSource === 'Corporate') {
                    const companyFolio = await Folio.create({
                        type: 'COMPANY',
                        reservationId: reservation._id,
                        roomId: reservation.room || reservation.roomId,
                        guestId: reservation.guest || reservation.guestId,
                        status: 'OPEN'
                    });
                    createdFolioIds.push(companyFolio._id);
                }

                // Update reservation
                reservation.folios = createdFolioIds;
                await reservation.save();

                console.log(`Initialized ${createdFolioIds.length} folios for reservation ${reservation._id}`);
            }
        } catch (folioErr) {
            console.error('Error auto-creating folios:', folioErr);
        }

        res.status(200).json({
            success: true,
            message: "Check-In successful",
            updatedReservation: reservation
        });

    } catch (error) {
        console.error('Error checking in reservation:', error);
        res.status(500).json({ message: error.message });
    }
});

// PUT Amend Stay
router.put('/amend/:id', async (req, res) => {
    // We'll use the logic in bookingController but exposed via this route
    const { amendBookingStay } = require('../controllers/bookingController');
    return amendBookingStay(req, res);
});

// PUT Room Move
router.put('/:id/room-move', async (req, res) => {
    const { moveBookingRoom } = require('../controllers/bookingController');
    return moveBookingRoom(req, res);
});

// PUT Room Exchange
router.put('/:id/exchange-room', async (req, res) => {
    const { exchangeBookingRoom } = require('../controllers/bookingController');
    return exchangeBookingRoom(req, res);
});

// PUT No-Show
router.put('/:id/no-show', async (req, res) => {
    console.log(`[Route Hit] PUT /api/reservations/${req.params.id}/no-show`);
    const { markNoShow } = require('../controllers/reservationController');
    return markNoShow(req, res);
});

// PUT Void
router.put('/:id/void', async (req, res) => {
    console.log(`[Route Hit] PUT /api/reservations/${req.params.id}/void`);
    const { voidReservation } = require('../controllers/reservationController');
    return voidReservation(req, res);
});

module.exports = router;
