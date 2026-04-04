const Booking = require('../models/Booking');
const MaintenanceBlock = require('../models/MaintenanceBlock');
const { applyRoutingRules, CATEGORIES_MAPPING } = require('../utils/folioUtils');
const { emitOpsNotification } = require('../utils/opsRealtimeEmitter');

const resolveActorName = (rawActor, fallback = 'System') => {
    if (!rawActor) return fallback;
    if (typeof rawActor === 'string') return rawActor.trim() || fallback;
    if (typeof rawActor === 'object') {
        return rawActor.name || rawActor.username || rawActor.email || rawActor.role || fallback;
    }
    return fallback;
};

const pushAuditTrail = (booking, payload) => {
    if (!booking) return;
    if (!booking.auditTrail) booking.auditTrail = [];
    booking.auditTrail.push({
        action: payload.action,
        description: payload.description,
        performedBy: resolveActorName(payload.performedBy, 'System'),
        performedAt: new Date(),
        metadata: payload.metadata || {}
    });
};

const toAmount = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const normalizeMethodForTransaction = (mode) => {
    const raw = String(mode || '').trim().toLowerCase();
    if (!raw) return 'Cash';
    if (raw === 'bank transfer' || raw === 'transfer') return 'Transfer';
    if (raw === 'card') return 'Card';
    if (raw === 'upi') return 'UPI';
    return 'Cash';
};

const parsePaymentSplitsFromBooking = (bookingData) => {
    const directSplits = Array.isArray(bookingData?.paymentSplits) ? bookingData.paymentSplits : [];
    if (directSplits.length > 0) {
        return directSplits
            .map((split) => ({
                mode: String(split?.mode || split?.paymentMode || split?.method || '').trim(),
                amount: toAmount(split?.amount),
                referenceId: String(split?.referenceId || '').trim()
            }))
            .filter((split) => split.mode && split.amount > 0);
    }

    const rawTxn = String(bookingData?.transactionId || '').trim();
    if (!rawTxn || !rawTxn.includes(':')) return [];

    return rawTxn
        .split(';')
        .map((chunk) => String(chunk || '').trim())
        .filter(Boolean)
        .map((chunk) => {
            const [modeRaw, amountWithRef = ''] = chunk.split(':');
            const [amountRaw, refRaw = ''] = String(amountWithRef).split('@');
            return {
                mode: String(modeRaw || '').trim(),
                amount: toAmount(amountRaw),
                referenceId: String(refRaw || '').trim()
            };
        })
        .filter((split) => split.mode && split.amount > 0);
};

const buildPaymentSplitDescription = (splits) => {
    if (!Array.isArray(splits) || splits.length === 0) return '';
    return splits
        .map((split) => {
            const mode = String(split?.mode || '').trim();
            const amount = toAmount(split?.amount);
            const ref = String(split?.referenceId || '').trim();
            if (!mode || amount <= 0) return '';
            const refText = ref ? ` (Ref/UTR: ${ref})` : '';
            return `${mode}: Rs ${amount.toFixed(2)}${refText}`;
        })
        .filter(Boolean)
        .join(' | ');
};


// Get all bookings
exports.getBookings = async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: bookings,
            count: bookings.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching bookings',
            error: error.message
        });
    }
};

// Get booking by ID
exports.getBookingById = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        res.status(200).json({
            success: true,
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching booking',
            error: error.message
        });
    }
};

// Create a new booking
exports.addBooking = async (req, res) => {
    try {
        const bookingData = req.body;

        // Validate required fields
        if (!bookingData.guestName || !bookingData.mobileNumber ||
            !bookingData.checkInDate || !bookingData.checkOutDate) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const Room = require('../models/Room');
        const Guest = require('../models/Guest');

        // 1. Find or Create Guest
        let guest = await Guest.findOne({ mobile: bookingData.mobileNumber });
        if (!guest) {
            guest = await Guest.create({
                fullName: bookingData.guestName,
                mobile: bookingData.mobileNumber,
                email: bookingData.email
            });
        }

        const roomsToUpdate = [];
        let totalCalculatedAmount = 0;

        // Determine if it's a multi-room booking
        const multiRooms = bookingData.rooms && Array.isArray(bookingData.rooms) && bookingData.rooms.length > 0;

        if (multiRooms) {
            // Check for duplicate room numbers in the same request
            const roomNumsInRequest = bookingData.rooms.map(r => r.roomNumber).filter(n => n && n !== 'TBD');
            if (new Set(roomNumsInRequest).size !== roomNumsInRequest.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Duplicate room numbers selected in the same booking'
                });
            }

            // Validate all rooms in multi-room booking
            for (const roomItem of bookingData.rooms) {
                const roomNumber = roomItem.roomNumber;
                const room = await Room.findOne({ roomNumber });

                if (!room && roomNumber !== 'TBD') {
                    return res.status(404).json({ success: false, message: `Room ${roomNumber} not found` });
                }

                if (room && roomNumber !== 'TBD') {
                    const checkIn = new Date(bookingData.checkInDate);
                    const checkOut = new Date(bookingData.checkOutDate);

                    // A. Check Maintenance Overlaps
                    const maintenanceOverlap = await MaintenanceBlock.findOne({
                        room: roomNumber,
                        status: { $ne: 'Completed' },
                        $or: [
                            { startDate: { $lt: checkOut }, endDate: { $gt: checkIn } }
                        ]
                    });

                    if (maintenanceOverlap) {
                        return res.status(409).json({
                            success: false,
                            message: `Room ${roomNumber} is under maintenance from ${new Date(maintenanceOverlap.startDate).toLocaleDateString()} to ${new Date(maintenanceOverlap.endDate).toLocaleDateString()}.`
                        });
                    }

                    // B. Check Booking Overlaps
                    const bookingOverlap = await Booking.findOne({
                        $and: [
                            { $or: [{ roomNumber }, { "rooms.roomNumber": roomNumber }] },
                            { status: { $in: ['Upcoming', 'Checked-in', 'RESERVED', 'IN_HOUSE', 'CheckedIn', 'Reserved'] } },
                            { checkInDate: { $lt: checkOut } },
                            { checkOutDate: { $gt: checkIn } }
                        ]
                    });

                    if (bookingOverlap) {
                        return res.status(409).json({
                            success: false,
                            message: `Room ${roomNumber} is already booked between ${new Date(bookingOverlap.checkInDate).toLocaleDateString()} and ${new Date(bookingOverlap.checkOutDate).toLocaleDateString()}.`
                        });
                    }
                }

                roomsToUpdate.push(room);
                // Calculate individual room total if not provided
                const nights = Number(bookingData.numberOfNights) || 1;
                const roomTotal = (Number(roomItem.ratePerNight) * nights) - (Number(roomItem.discount) || 0);
                roomItem.total = roomTotal;
                totalCalculatedAmount += roomTotal;
            }

            bookingData.isMulti = bookingData.rooms.length > 1;
            bookingData.totalAmount = bookingData.totalAmount || totalCalculatedAmount;
            // For backward compatibility
            bookingData.roomNumber = bookingData.rooms[0].roomNumber;
            bookingData.roomType = bookingData.rooms[0].roomType;
            bookingData.pricePerNight = bookingData.rooms[0].ratePerNight;
        } else {
            // Single room traditional path
            if (!bookingData.roomNumber) {
                return res.status(400).json({ success: false, message: 'Room number is required' });
            }
            if (bookingData.roomNumber !== 'TBD') {
                const room = await Room.findOne({ roomNumber: bookingData.roomNumber });
                if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

                const checkIn = new Date(bookingData.checkInDate);
                const checkOut = new Date(bookingData.checkOutDate);

                // A. Check Maintenance Overlaps
                const maintenanceOverlap = await MaintenanceBlock.findOne({
                    room: bookingData.roomNumber,
                    status: { $ne: 'Completed' },
                    $or: [
                        { startDate: { $lt: checkOut }, endDate: { $gt: checkIn } }
                    ]
                });

                if (maintenanceOverlap) {
                    return res.status(409).json({
                        success: false,
                        message: `Room ${bookingData.roomNumber} is under maintenance from ${new Date(maintenanceOverlap.startDate).toLocaleDateString()} to ${new Date(maintenanceOverlap.endDate).toLocaleDateString()}.`
                    });
                }

                // B. Check Booking Overlaps
                const bookingOverlap = await Booking.findOne({
                    $and: [
                        { $or: [{ roomNumber: bookingData.roomNumber }, { "rooms.roomNumber": bookingData.roomNumber }] },
                        { status: { $in: ['Upcoming', 'Checked-in', 'RESERVED', 'IN_HOUSE', 'CheckedIn', 'Reserved'] } },
                        { checkInDate: { $lt: checkOut } },
                        { checkOutDate: { $gt: checkIn } }
                    ]
                });

                if (bookingOverlap) {
                    return res.status(409).json({
                        success: false,
                        message: `Room ${bookingData.roomNumber} is already booked between ${new Date(bookingOverlap.checkInDate).toLocaleDateString()} and ${new Date(bookingOverlap.checkOutDate).toLocaleDateString()}.`
                    });
                }

                roomsToUpdate.push(room);
            }
        }

        // 2. Map Flat Data to Nested Shell (Booking Model Support)
        const finalBookingData = {
            guest: guest._id,
            room: roomsToUpdate[0] ? roomsToUpdate[0]._id : null, // Link first room ObjectId
            bookingId: bookingData.bookingId || `BK-${Date.now().toString().slice(-8)}`,
            checkInDate: new Date(bookingData.checkInDate),
            checkOutDate: new Date(bookingData.checkOutDate),
            status: bookingData.status || 'RESERVED',
            source: bookingData.bookingSource || 'Walk-In',
            purpose: bookingData.purposeOfVisit || '',
            duration: {
                nights: Number(bookingData.numberOfNights) || 1,
                adults: Number(bookingData.numberOfAdults) || 1,
                children: Number(bookingData.numberOfChildren) || 0
            },
            billing: {
                roomRate: Number(bookingData.pricePerNight) || 0,
                discount: Number(bookingData.discountAmount) || 0,
                tax: Number(bookingData.taxAmount) || 0,
                serviceCharge: Number(bookingData.serviceChargeAmount) || 0,
                totalAmount: Number(bookingData.totalAmount) || 0,
                paidAmount: Number(bookingData.advancePaid) || 0,
                balanceAmount: (Number(bookingData.totalAmount) || 0) - (Number(bookingData.advancePaid) || 0)
            },
            // Legacy/Extra fields (Now in schema, so they will persist)
            roomNumber: bookingData.roomNumber,
            roomType: bookingData.roomType,
            guestName: bookingData.guestName,
            mobileNumber: bookingData.mobileNumber,
            email: bookingData.email,
            idProofType: bookingData.idProofType,
            idNumber: bookingData.idNumber,
            vehicleNumber: bookingData.vehicleNumber,
            paymentMode: String(bookingData.paymentMode || '').trim() || undefined,
            transactionId: String(bookingData.transactionId || '').trim() || undefined,
            paymentSplits: parsePaymentSplitsFromBooking(bookingData),
            referenceId: bookingData.referenceId || bookingData.bookingId,
            rooms: bookingData.rooms || [],
            additionalGuests: Array.isArray(bookingData.additionalGuests) ? bookingData.additionalGuests : []
        };

        // Update all room statuses
        const newStatus = bookingData.status === 'Checked-in' ? 'Occupied' : 'Booked';
        for (const room of roomsToUpdate) {
            if (room) {
                room.status = newStatus;
                await room.save();
            }
        }

        const booking = new Booking(finalBookingData);
        const paymentSplits = parsePaymentSplitsFromBooking(bookingData);

        // If advance paid, add matching payment transaction
        if (finalBookingData.billing.paidAmount > 0) {
            const splitText = buildPaymentSplitDescription(paymentSplits);
            const fallbackRef = String(bookingData.transactionId || '').trim();
            booking.transactions.push({
                type: 'Payment',
                amount: finalBookingData.billing.paidAmount,
                description: splitText
                    ? `Advance payment at booking | ${splitText}`
                    : (fallbackRef ? `Advance payment at booking | Ref/UTR: ${fallbackRef}` : 'Advance payment at booking'),
                date: new Date(),
                method: normalizeMethodForTransaction(paymentSplits[0]?.mode || bookingData.paymentMode),
                referenceId: fallbackRef || undefined,
                paymentSplits
            });
        }

        await booking.save();

        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            data: booking
        });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(400).json({
            success: false,
            message: 'Error creating booking: ' + error.message,
            error: error.message
        });
    }
};

// Update booking
exports.updateBooking = async (req, res) => {
    try {
        let booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const oldStatus = booking.status;
        const oldRoomNumber = booking.roomNumber;

        if (!booking.billing) {
            booking.billing = { roomRate: 0, totalAmount: 0, paidAmount: 0, balanceAmount: 0 };
        }

        if (req.body.pricePerNight !== undefined) booking.billing.roomRate = Number(req.body.pricePerNight) || 0;
        if (req.body.discountAmount !== undefined) booking.billing.discount = Number(req.body.discountAmount) || 0;
        if (req.body.taxAmount !== undefined) booking.billing.tax = Number(req.body.taxAmount) || 0;
        if (req.body.serviceChargeAmount !== undefined) booking.billing.serviceCharge = Number(req.body.serviceChargeAmount) || 0;
        if (req.body.totalAmount !== undefined) booking.billing.totalAmount = Number(req.body.totalAmount) || 0;
        if (req.body.advancePaid !== undefined) booking.billing.paidAmount = Number(req.body.advancePaid) || 0;
        if (req.body.totalAmount !== undefined || req.body.advancePaid !== undefined) {
            booking.billing.balanceAmount = (Number(booking.billing.totalAmount) || 0) - (Number(booking.billing.paidAmount) || 0);
        }

        // Update only provided fields
        Object.assign(booking, req.body);
        await booking.save();

        // Update room status if booking status changed
        const Room = require('../models/Room');

        // If room number changed, update old room to Available
        if (req.body.roomNumber && req.body.roomNumber !== oldRoomNumber) {
            const oldRoom = await Room.findOne({ roomNumber: oldRoomNumber });
            if (oldRoom) {
                oldRoom.status = 'Available';
                await oldRoom.save();
            }
        }

        // Update current room status based on booking status
        const currentRoomNumber = req.body.roomNumber || oldRoomNumber;
        const room = await Room.findOne({ roomNumber: currentRoomNumber });

        if (room) {
            if (booking.status === 'Checked-in') {
                room.status = 'Occupied';
            } else if (booking.status === 'Upcoming') {
                room.status = 'Booked';
            } else if (booking.status === 'Checked-out' || booking.status === 'Cancelled') {
                room.status = 'Available';
            }
            await room.save();
        }

        res.status(200).json({
            success: true,
            message: 'Booking updated successfully',
            data: booking
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error updating booking',
            error: error.message
        });
    }
};

// Delete booking
exports.deleteBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const roomNumber = booking.roomNumber;
        await Booking.findByIdAndDelete(req.params.id);

        // Update room status to Available when booking is deleted
        const Room = require('../models/Room');
        const room = await Room.findOne({ roomNumber: roomNumber });

        if (room) {
            room.status = 'Available';
            await room.save();
        }

        res.status(200).json({
            success: true,
            message: 'Booking deleted successfully',
            data: {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting booking',
            error: error.message
        });
    }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
    try {
        const { status, invoiceId } = req.body;
        const validStatuses = ['Upcoming', 'Checked-in', 'Checked-out', 'Cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Update room statuses based on record status
        const Room = require('../models/Room');
        const roomNumbers = [];

        if (booking.isMulti && booking.rooms && booking.rooms.length > 0) {
            booking.rooms.forEach(r => roomNumbers.push(r.roomNumber));
        } else if (booking.roomNumber) {
            roomNumbers.push(booking.roomNumber);
        }

        const roomStatusMap = {
            'Upcoming': 'Booked',
            'Checked-in': 'Occupied',
            'Checked-out': 'Available',
            'Cancelled': 'Available'
        };

        // --- STEP 7: Checkout Validation ---
        if (status === 'Checked-out') {
            const Folio = require('../models/Folio');
            const folios = await Folio.find({ reservationId: booking._id });

            let currentBalance = 0;

            if (folios && folios.length > 0) {
                // Folio is the checkout source of truth when present.
                currentBalance = folios.reduce((sum, folio) => {
                    return sum + (Number(folio?.balance) || 0);
                }, 0);
            } else {
                // Legacy fallback for records without folios.
                const billingBalance = Number(booking?.billing?.balanceAmount);
                if (Number.isFinite(billingBalance)) {
                    currentBalance = billingBalance;
                } else {
                    const transactions = booking.transactions || [];
                    const totalPayments = transactions
                        .filter(t => t.type?.toLowerCase() === 'payment')
                        .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

                    const totalDiscounts = transactions
                        .filter(t => t.type?.toLowerCase() === 'discount')
                        .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

                    const totalCharges = transactions
                        .filter(t => t.type?.toLowerCase() === 'charge')
                        .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

                    // Never synthesize room tariff here; it creates false outstanding amounts.
                    currentBalance = totalCharges - totalDiscounts - totalPayments;
                }
            }

            if (currentBalance > 0.5) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot checkout. Outstanding balance of ₹${Math.round(currentBalance)} found.`,
                    balance: currentBalance
                });
            }

            if (folios && folios.length > 0) {
                for (const folio of folios) {
                    folio.status = 'CLOSED';
                    folio.balance = 0;
                    await folio.save();
                }
            }
        }

        const newRoomStatus = roomStatusMap[status];

        if (newRoomStatus) {
            const HousekeepingTask = require('../models/HousekeepingTask');
            for (const roomNo of roomNumbers) {
                // Keep existing logic for room status (Available)
                const updateData = { status: newRoomStatus };

                // Add housekeeping logic if checking out
                if (status === 'Checked-out') {
                    updateData.housekeepingStatus = 'dirty';

                    // Create housekeeping alert record
                    const room = await Room.findOne({ roomNumber: roomNo });
                    if (room) {
                        // Check if a pending task already exists to avoid duplicates
                        const existingTask = await HousekeepingTask.findOne({
                            roomId: room._id,
                            status: 'pending'
                        });

                        if (!existingTask) {
                            const newTask = await HousekeepingTask.create({
                                roomId: room._id,
                                roomNumber: room.roomNumber,
                                status: 'pending',
                                createdAt: new Date()
                            });

                            emitOpsNotification(req, {
                                eventId: `housekeeping-${String(newTask._id)}-${new Date(newTask.createdAt).getTime()}`,
                                module: 'housekeeping',
                                entity: 'housekeeping-task',
                                entityId: String(newTask._id),
                                title: 'New Housekeeping Task',
                                message: `Room ${room.roomNumber} requires housekeeping attention.`,
                                data: {
                                    _id: String(newTask._id),
                                    roomNumber: newTask.roomNumber,
                                    status: newTask.status,
                                    pendingAcknowledged: false,
                                    createdAt: newTask.createdAt,
                                    updatedAt: newTask.updatedAt,
                                },
                            });
                        }
                    }
                }

                await Room.findOneAndUpdate({ roomNumber: roomNo }, updateData);
            }
        }

        if (status === 'Checked-in' && !booking.actualCheckIn) {
            booking.actualCheckIn = new Date();
        } else if (status === 'Checked-out' && !booking.actualCheckOut) {
            booking.actualCheckOut = new Date();
        }

        booking.status = status;
        booking.updatedAt = Date.now();
        if (invoiceId) booking.invoiceId = invoiceId;

        // Ensure billing exists before save to prevent validation errors
        if (!booking.billing) {
            booking.billing = { roomRate: 0, totalAmount: 0, paidAmount: 0, balanceAmount: 0 };
        }
        if (booking.billing.roomRate == null) booking.billing.roomRate = 0;
        if (booking.billing.totalAmount == null) booking.billing.totalAmount = 0;

        try {
            await booking.save();
        } catch (saveError) {
            // Fallback: use findByIdAndUpdate to bypass validation
            console.error('booking.save() failed, using findByIdAndUpdate fallback:', saveError.message);
            const updateFields = {
                status: status,
                updatedAt: new Date()
            };
            if (status === 'Checked-in') updateFields.actualCheckIn = booking.actualCheckIn;
            if (status === 'Checked-out') updateFields.actualCheckOut = booking.actualCheckOut;
            if (invoiceId) updateFields.invoiceId = invoiceId;

            await Booking.findByIdAndUpdate(req.params.id, { $set: updateFields });
            // Re-fetch for response
            const updatedBooking = await Booking.findById(req.params.id);
            return res.status(200).json({
                success: true,
                message: 'Booking status updated successfully',
                data: updatedBooking
            });
        }

        res.status(200).json({
            success: true,
            message: 'Booking status updated successfully',
            data: booking
        });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating booking status',
            error: error.message
        });
    }
};

// Get bookings by room number
exports.getBookingsByRoom = async (req, res) => {
    try {
        const { roomNumber } = req.params;
        const bookings = await Booking.find({
            $or: [
                { roomNumber: roomNumber },
                { "rooms.roomNumber": roomNumber }
            ]
        }).sort({ checkInDate: 1 });

        res.status(200).json({
            success: true,
            data: bookings,
            count: bookings.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching bookings',
            error: error.message
        });
    }
};

// Get bookings by date range
exports.getBookingsByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'startDate and endDate are required'
            });
        }

        const bookings = await Booking.find({
            checkInDate: { $gte: new Date(startDate) },
            checkOutDate: { $lte: new Date(endDate) }
        }).sort({ checkInDate: -1 });

        res.status(200).json({
            success: true,
            data: bookings,
            count: bookings.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching bookings',
            error: error.message
        });
    }
};

// Add transaction (charge or payment) to a booking
exports.addTransaction = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const transactionData = req.body;
        const actor = resolveActorName(transactionData?.performedBy || transactionData?.user || req.user, 'System');

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Apply automatic routing rules if it's a new charge
        applyRoutingRules(booking, transactionData);

        if (!transactionData.user || transactionData.user === 'current_user') {
            transactionData.user = actor;
        }

        booking.transactions.push(transactionData);
        const latestTransaction = booking.transactions[booking.transactions.length - 1];

        pushAuditTrail(booking, {
            action: 'FOLIO_TRANSACTION_ADDED',
            description: `${transactionData.type || 'Transaction'} added in folio: ${transactionData.particulars || '-'} (${transactionData.amount || 0})`,
            performedBy: actor,
            metadata: {
                transactionId: latestTransaction?._id,
                folioId: transactionData.folioId ?? 0,
                type: transactionData.type,
                particulars: transactionData.particulars,
                amount: transactionData.amount,
                source: 'Folio Operations'
            }
        });

        await booking.save();

        res.status(200).json({
            success: true,
            message: 'Transaction added successfully',
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding transaction',
            error: error.message
        });
    }
};

// Update transaction
exports.updateTransaction = async (req, res) => {
    try {
        const { bookingId, transactionId } = req.params;
        const updatedData = req.body;
        const actor = resolveActorName(updatedData?.performedBy || updatedData?.user || req.user, 'System');

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const transaction = booking.transactions.id(transactionId);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        const before = {
            particulars: transaction.particulars,
            description: transaction.description,
            amount: transaction.amount,
            type: transaction.type,
            folioId: transaction.folioId
        };

        Object.assign(transaction, updatedData);

        if (!transaction.user || transaction.user === 'current_user') {
            transaction.user = actor;
        }

        pushAuditTrail(booking, {
            action: 'FOLIO_TRANSACTION_UPDATED',
            description: `Folio transaction updated: ${transaction.particulars || '-'} (${before.amount} -> ${transaction.amount})`,
            performedBy: actor,
            metadata: {
                transactionId: transaction._id,
                before,
                after: {
                    particulars: transaction.particulars,
                    description: transaction.description,
                    amount: transaction.amount,
                    type: transaction.type,
                    folioId: transaction.folioId
                },
                source: 'Folio Operations'
            }
        });

        await booking.save();

        res.status(200).json({
            success: true,
            message: 'Transaction updated successfully',
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating transaction',
            error: error.message
        });
    }
};

// Delete transaction (void)
exports.deleteTransaction = async (req, res) => {
    try {
        const { bookingId, transactionId } = req.params;
        const actor = resolveActorName(req.body?.performedBy || req.body?.user || req.user, 'System');

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const transaction = booking.transactions.id(transactionId);
        const removedSnapshot = transaction ? {
            type: transaction.type,
            particulars: transaction.particulars,
            amount: transaction.amount,
            folioId: transaction.folioId
        } : null;

        booking.transactions.pull(transactionId);

        if (removedSnapshot) {
            pushAuditTrail(booking, {
                action: 'FOLIO_TRANSACTION_VOIDED',
                description: `Folio transaction removed: ${removedSnapshot.particulars || '-'} (${removedSnapshot.amount})`,
                performedBy: actor,
                metadata: {
                    transactionId,
                    removedSnapshot,
                    source: 'Folio Operations'
                }
            });
        }

        await booking.save();

        res.status(200).json({
            success: true,
            message: 'Transaction deleted successfully',
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting transaction',
            error: error.message
        });
    }
};

// Route transactions from source folio to target folio (supports cross-booking routing)
exports.routeFolioTransactions = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const {
            transactionIds,
            sourceFolioId,
            targetFolioId,
            targetBookingId,
            selectedCategories,
            routedBy
        } = req.body;

        const actor = resolveActorName(routedBy || req.user, 'System');

        // Validate input
        if (sourceFolioId === undefined || targetFolioId === undefined) {
            return res.status(400).json({ success: false, message: 'Missing folio mapping' });
        }

        const currentTransactionIds = Array.isArray(transactionIds) ? transactionIds : [];
        if (currentTransactionIds.length === 0 && !selectedCategories) {
            return res.status(400).json({
                success: false,
                message: 'No transactions selected and no routing rules provided'
            });
        }

        if (sourceFolioId === targetFolioId && (!targetBookingId || targetBookingId === bookingId)) {
            return res.status(400).json({
                success: false,
                message: 'Source and target folio cannot be the same'
            });
        }

        const sourceBooking = await Booking.findById(bookingId);
        if (!sourceBooking) {
            return res.status(404).json({
                success: false,
                message: 'Source booking not found'
            });
        }

        // Check if routing to different booking
        const isCrossBookingRoute = targetBookingId && targetBookingId !== bookingId;
        let targetBooking = sourceBooking;

        if (isCrossBookingRoute) {
            targetBooking = await Booking.findById(targetBookingId);
            if (!targetBooking) {
                return res.status(404).json({
                    success: false,
                    message: 'Target booking not found'
                });
            }
        }

        // Save automatic routing rules for the future if selectedCategories provided
        if (selectedCategories && !isCrossBookingRoute) {
            if (!sourceBooking.routingRules) sourceBooking.routingRules = [];

            Object.entries(selectedCategories).forEach(([category, isSelected]) => {
                if (isSelected && category !== 'all' && category !== 'scope') {
                    // Remove existing rule for this category if any
                    sourceBooking.routingRules = sourceBooking.routingRules.filter(r => r.category !== category);
                    // Add new rule
                    sourceBooking.routingRules.push({
                        category,
                        targetFolioId: parseInt(targetFolioId)
                    });
                }
            });
        }

        // Validate and route transactions
        let routedCount = 0;
        const routingTimestamp = new Date();
        const routedTransactions = [];
        const transactionsToRemove = [];

        for (const transactionId of currentTransactionIds) {
            const transaction = sourceBooking.transactions.id(transactionId);

            if (!transaction) {
                continue; // Skip if transaction not found
            }

            // Verify transaction belongs to source folio (or any folio if cross-booking)
            if (!isCrossBookingRoute && transaction.folioId !== sourceFolioId) {
                continue; // Skip if transaction doesn't belong to source folio
            }

            if (isCrossBookingRoute) {
                // Cross-booking routing: Clone transaction to target booking
                const newTransaction = {
                    type: transaction.type,
                    day: transaction.day,
                    particulars: transaction.particulars,
                    description: transaction.description,
                    amount: transaction.amount,
                    user: transaction.user,
                    folioId: targetFolioId,
                    routedFrom: sourceFolioId,
                    routedTo: targetFolioId,
                    routedBy: actor,
                    routedAt: routingTimestamp,
                    originalBookingId: bookingId,
                    createdAt: transaction.createdAt || new Date()
                };

                targetBooking.transactions.push(newTransaction);
                transactionsToRemove.push(transactionId);
            } else {
                // Same booking routing: Update folioId
                transaction.folioId = targetFolioId;
                transaction.routedFrom = sourceFolioId;
                transaction.routedTo = targetFolioId;
                transaction.routedBy = actor;
                transaction.routedAt = routingTimestamp;
            }

            routedTransactions.push({
                id: transaction._id,
                particulars: transaction.particulars,
                amount: transaction.amount
            });

            routedCount++;
        }

        if (routedCount === 0 && !selectedCategories) {
            return res.status(400).json({
                success: false,
                message: 'No valid transactions found to route'
            });
        }

        // Save target booking first (in case of cross-booking)
        if (isCrossBookingRoute) {
            pushAuditTrail(targetBooking, {
                action: 'FOLIO_TRANSACTION_ROUTED_IN',
                description: `${routedCount} transaction(s) routed in from booking ${bookingId}`,
                performedBy: actor,
                metadata: {
                    sourceBookingId: bookingId,
                    targetBookingId,
                    sourceFolioId,
                    targetFolioId,
                    routedCount,
                    transactions: routedTransactions,
                    source: 'Folio Routing'
                }
            });
            await targetBooking.save();

            // Remove transactions from source booking
            for (const transactionId of transactionsToRemove) {
                sourceBooking.transactions.pull(transactionId);
            }
        }

        // Save source booking
        pushAuditTrail(sourceBooking, {
            action: 'FOLIO_TRANSACTION_ROUTED_OUT',
            description: `${routedCount} transaction(s) routed from folio ${sourceFolioId} to ${targetFolioId}`,
            performedBy: actor,
            metadata: {
                sourceBookingId: bookingId,
                targetBookingId: targetBookingId || bookingId,
                sourceFolioId,
                targetFolioId,
                routedCount,
                transactions: routedTransactions,
                crossBookingRoute: Boolean(isCrossBookingRoute),
                source: 'Folio Routing'
            }
        });

        await sourceBooking.save();

        res.status(200).json({
            success: true,
            message: `Successfully routed ${routedCount} transaction(s) and updated routing rules.`,
            data: {
                sourceBooking: isCrossBookingRoute ? sourceBooking : undefined,
                targetBooking: isCrossBookingRoute ? targetBooking : undefined,
                booking: !isCrossBookingRoute ? sourceBooking : undefined,
                routedCount,
                routedTransactions,
                crossBookingRoute: isCrossBookingRoute
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error routing folio transactions',
            error: error.message
        });
    }
};



// Check-In Booking
exports.checkInBooking = async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        const { securityDeposit, idProofType, idNumber, adults, children, vehicleNumber, remarks, idProofNumber, idNumber: altIdNumber } = req.body;

        booking.status = 'Checked-in';
        if (req.body.arrivalDate && req.body.checkInTime) {
            booking.actualCheckIn = new Date(`${req.body.arrivalDate}T${req.body.checkInTime}`);
        } else {
            booking.actualCheckIn = new Date();
        }

        // Update fields if provided
        if (idProofType) booking.idProofType = idProofType;
        const finalIdNumber = idNumber || idProofNumber || altIdNumber;
        if (finalIdNumber) booking.idNumber = finalIdNumber;

        if (!booking.duration) booking.duration = { nights: 1, adults: 1, children: 0 };
        if (adults) booking.duration.adults = Number(adults);
        if (children !== undefined) booking.duration.children = Number(children);

        if (vehicleNumber) booking.vehicleNumber = vehicleNumber;
        if (remarks) booking.remarks = remarks;

        const depositAmount = Number(securityDeposit) || 0;
        booking.securityDeposit = depositAmount;

        // Ensure transactions array exists
        if (!booking.transactions) booking.transactions = [];

        // 1. Record security deposit as a payment transaction
        if (depositAmount > 0) {
            const hasDeposit = booking.transactions.some(t => t.notes === 'Security Deposit at Check-in' || t.particulars === 'Security Deposit');
            if (!hasDeposit) {
                const depositTransaction = {
                    type: 'Payment',
                    amount: depositAmount,
                    method: 'Cash',
                    notes: 'Security Deposit at Check-in',
                    particulars: 'Security Deposit',
                    description: 'Security Deposit collected during check-in',
                    date: new Date(),
                    day: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'short' }),
                    user: 'System'
                };
                applyRoutingRules(booking, depositTransaction);
                booking.transactions.push(depositTransaction);
            }
        }

        // 2. Auto-generate Room Charge transaction for Folio visibility
        const roomRate = booking.billing?.roomRate || booking.pricePerNight || 0;
        const nights = booking.duration?.nights || 1;
        const totalRoomCharge = roomRate * nights;

        if (totalRoomCharge > 0) {
            const hasRoomCharge = booking.transactions.some(t => t.particulars === 'Room Tariff' || t.notes === 'Auto-generated Room Charge at Check-in');
            if (!hasRoomCharge) {
                const roomChargeTransaction = {
                    type: 'Charge',
                    amount: totalRoomCharge,
                    particulars: 'Room Tariff',
                    description: `Room Charges: ${roomRate} for ${nights} night(s) - Room No ${booking.roomNumber}`,
                    notes: 'Auto-generated Room Charge at Check-in',
                    date: new Date(),
                    day: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'short' }),
                    user: 'System'
                };
                applyRoutingRules(booking, roomChargeTransaction);
                booking.transactions.push(roomChargeTransaction);
            }
        }

        // Update billing summary
        booking.billing.totalAmount = (booking.transactions || [])
            .filter(t => t.type?.toLowerCase() === 'charge')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        booking.billing.paidAmount = (booking.transactions || [])
            .filter(t => t.type?.toLowerCase() === 'payment')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        booking.billing.balanceAmount = booking.billing.totalAmount - booking.billing.paidAmount;

        await booking.save();

        const Room = require('../models/Room');
        const roomNumbers = [];
        if (booking.isMulti && booking.rooms && booking.rooms.length > 0) {
            booking.rooms.forEach(r => {
                if (r.roomNumber && r.roomNumber !== 'TBD') roomNumbers.push(r.roomNumber);
            });
        } else if (booking.roomNumber && booking.roomNumber !== 'TBD') {
            roomNumbers.push(booking.roomNumber);
        }

        for (const roomNo of roomNumbers) {
            await Room.findOneAndUpdate({ roomNumber: roomNo }, { status: 'Occupied' });
        }

        // --- STEP 3: Auto Create Folios on CHECKED_IN ---
        try {
            const Folio = require('../models/Folio');
            const { recalculateFolio } = require('./folioController');

            // Check if folios array is empty to proceed
            if (!booking.folios || booking.folios.length === 0) {
                const createdFolioIds = [];

                // 1. Create PRIMARY folio (Mandatory)
                const numberOfNights = booking.duration?.nights || 1;
                const roomRate = booking.billing?.roomRate || booking.pricePerNight || 0;
                const totalRoomCharge = roomRate * numberOfNights;

                const primaryFolio = await Folio.create({
                    type: 'PRIMARY',
                    reservationId: booking._id,
                    roomId: booking.room,
                    guestId: booking.guest,
                    entries: [{
                        type: 'ROOM_CHARGE',
                        description: `Room charge for ${numberOfNights} night(s)`,
                        amount: totalRoomCharge,
                        addedBy: 'System'
                    }],
                    status: 'OPEN'
                });

                // Add initial security deposit to primary if paid
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

                // 2. If corporate, create COMPANY folio
                const isCorporate = booking.source === 'Corporate' || booking.businessSource === 'Corporate';
                if (isCorporate) {
                    const companyFolio = await Folio.create({
                        type: 'COMPANY',
                        reservationId: booking._id,
                        roomId: booking.room,
                        guestId: booking.guest,
                        status: 'OPEN'
                    });
                    createdFolioIds.push(companyFolio._id);
                }

                // 3. If multi-guest/room, optionally create SECONDARY folio (simplified: always create SECONDARY for multi-room)
                if (booking.isMulti) {
                    const secondaryFolio = await Folio.create({
                        type: 'SECONDARY',
                        reservationId: booking._id,
                        roomId: booking.room,
                        guestId: booking.guest,
                        status: 'OPEN'
                    });
                    createdFolioIds.push(secondaryFolio._id);
                }

                // Update booking with folio IDs
                booking.folios = createdFolioIds;
                await booking.save();

                console.log(`Initialized ${createdFolioIds.length} folios for booking ${booking._id}`);
            }
        } catch (folioErr) {
            console.error('Error auto-creating folios:', folioErr);
        }

        res.status(200).json({ success: true, message: 'Checked in successfully', data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error checking in', error: error.message });
    }
};

// Add Payment
exports.addBookingPayment = async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        const { amount, mode, reference, notes, paymentMethod, referenceId, comment, folioId } = req.body;

        const payMode = paymentMethod || mode || 'Cash';
        const now = new Date();
        const resolvedFolioId = Number.isFinite(Number(folioId)) ? Number(folioId) : 0;

        // Add payment transaction with folio-compatible fields
        booking.transactions.push({
            type: 'Payment',
            amount: Math.abs(Number(amount)),
            method: payMode,
            referenceId: referenceId || reference || '',
            notes: comment || notes || '',
            date: now,
            day: now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'short' }),
            particulars: `Payment (${payMode})`,
            description: comment || notes || `Payment via ${payMode}`,
            user: 'Staff',
            folioId: resolvedFolioId
        });

        await booking.save();
        res.status(200).json({ success: true, message: 'Payment added', data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error adding payment', error: error.message });
    }
};

// Amend Stay
exports.amendBookingStay = async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            // Check if it's in the Reservation model instead
            const Reservation = require('../models/Booking');
            const reservation = await Reservation.findById(req.params.id);
            if (!reservation) {
                return res.status(404).json({ success: false, message: 'Reservation/Booking not found' });
            }

            // If it's a Reservation, we need to handle it differently or migrate it?
            // For now, let's treat Reservation objects as simpler entities.
            const { checkInDate, checkOutDate, adults, children, ratePerNight, newGrandTotal, nights } = req.body;

            if (reservation.status === 'CHECKED_OUT' || reservation.status === 'CANCELLED') {
                return res.status(400).json({ success: false, message: 'Cannot amend a completed or cancelled reservation' });
            }

            reservation.checkInDate = new Date(checkInDate);
            reservation.checkOutDate = new Date(checkOutDate);
            reservation.nights = Number(nights);
            reservation.adults = Number(adults);
            reservation.children = Number(children);
            reservation.amount = Number(newGrandTotal);
            reservation.balance = Number(newGrandTotal) - (reservation.paid || 0);

            await reservation.save();
            return res.status(200).json({ success: true, message: 'Reservation amended successfully', data: reservation });
        }

        // Status check for Booking
        if (booking.status === 'Checked-out' || booking.status === 'Cancelled' || booking.status === 'No-Show' || booking.status === 'Voided') {
            return res.status(400).json({ success: false, message: `Cannot amend booking with status: ${booking.status}` });
        }

        const {
            newCheckInDate,
            newCheckOutDate,
            newCheckInTime,
            newCheckOutTime,
            adults,
            children,
            ratePerNight,
            newGrandTotal,
            nights,
            discount,
            reason
        } = req.body;

        // Capture old data for audit log
        const oldData = {
            checkInDate: booking.checkInDate,
            checkOutDate: booking.checkOutDate,
            nights: booking.duration?.nights || 1,
            totalAmount: booking.billing?.totalAmount || 0,
            ratePerNight: booking.billing?.roomRate || 0,
            occupancy: { adults: booking.duration?.adults || 1, children: booking.duration?.children || 0 }
        };

        // Update stay details
        if (newCheckInDate) booking.checkInDate = new Date(newCheckInDate);
        if (newCheckOutDate) booking.checkOutDate = new Date(newCheckOutDate);
        if (newCheckInTime) booking.scheduledCheckInTime = newCheckInTime;
        if (newCheckOutTime) booking.scheduledCheckOutTime = newCheckOutTime;

        // Update occupancy
        if (!booking.duration) booking.duration = {};
        if (adults !== undefined) booking.duration.adults = Number(adults);
        if (children !== undefined) booking.duration.children = Number(children);
        booking.numberOfGuests = (Number(adults) || 0) + (Number(children) || 0);

        // Update pricing and handle folio adjustments
        if (!booking.billing) booking.billing = {};
        if (ratePerNight !== undefined) booking.billing.roomRate = Number(ratePerNight);
        if (nights !== undefined) booking.duration.nights = Number(nights);

        // Financial Adjustment Logic
        const oldTotal = booking.billing.totalAmount || 0;
        const targetTotal = Number(newGrandTotal);
        const difference = targetTotal - oldTotal;

        if (difference !== 0) {
            if (!booking.transactions) booking.transactions = [];

            booking.transactions.push({
                type: difference > 0 ? 'Charge' : 'Adjustment',
                notes: `Stay amended from ${oldData.nights} to ${nights} nights at ₹${ratePerNight}/night. ${reason || ''}`,
                amount: Math.abs(difference),
                date: new Date()
            });

            // Update authoritative billing total
            booking.billing.totalAmount = targetTotal;
        }

        // Add to audit trail
        if (!booking.auditTrail) booking.auditTrail = [];
        booking.auditTrail.push({
            action: 'STAY_AMENDED',
            description: reason || 'Booking details amended via Amend Stay feature',
            performedBy: 'user',
            performedAt: new Date(),
            metadata: {
                oldData,
                newData: {
                    checkInDate: booking.checkInDate,
                    checkOutDate: booking.checkOutDate,
                    nights: booking.duration.nights,
                    totalAmount: booking.billing.totalAmount,
                    ratePerNight: booking.billing.roomRate,
                    occupancy: { adults: booking.duration.adults, children: booking.duration.children }
                }
            }
        });

        await booking.save();

        res.status(200).json({
            success: true,
            message: 'Stay amended successfully',
            data: booking
        });
    } catch (error) {
        console.error('Error in amendBookingStay:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during amendment',
            error: error.message
        });
    }
};

// Room Move with Financial Adjustment and Audit Trail
exports.moveBookingRoom = async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        const Room = require('../models/Room');

        const { id } = req.params;
        const { newRoomId, newRoomNumber, reason, effectiveDate } = req.body;

        if (!id || !newRoomId) {
            return res.status(400).json({ success: false, message: 'Missing Booking ID or Target Room ID' });
        }

        // 1. Fetch record
        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Stay record not found' });
        }

        // 2. Eligibility Check
        const currentStatus = booking.status;
        const inHouseStatuses = ['Checked-in', 'IN_HOUSE', 'CheckedIn'];
        if (!inHouseStatuses.includes(currentStatus)) {
            return res.status(400).json({
                success: false,
                message: `Room move is only allowed for in-house guests. Current status: ${currentStatus}`
            });
        }

        // 3. New Room Validation
        const newRoom = await Room.findById(newRoomId);

        if (!newRoom) {
            return res.status(404).json({ success: false, message: 'Target room not found' });
        }

        if (newRoom.status !== 'Available') {
            return res.status(400).json({
                success: false,
                message: `Room ${newRoom.roomNumber} is currently ${newRoom.status}. Please select an Available room.`
            });
        }

        const oldRoomNumber = booking.roomNumber;
        const oldPrice = booking.billing?.roomRate || booking.pricePerNight || 0;
        const newPrice = newRoom.price || 0;

        // 4. Calculate Financial Adjustment
        const checkOutDate = new Date(booking.checkOutDate);
        const moveDate = new Date(effectiveDate || new Date());
        moveDate.setHours(0, 0, 0, 0);
        checkOutDate.setHours(0, 0, 0, 0);

        const remainingNights = Math.max(0, Math.ceil((checkOutDate - moveDate) / (1000 * 60 * 60 * 24)));
        const rateDiff = newPrice - oldPrice;
        const totalAdjustment = rateDiff * remainingNights;

        // 5. Update Record
        const oldData = {
            roomNumber: booking.roomNumber,
            roomType: booking.roomType,
            pricePerNight: oldPrice
        };

        booking.room = newRoom._id;
        booking.roomNumber = newRoom.roomNumber;
        booking.roomType = newRoom.roomType;

        if (!booking.billing) booking.billing = {};
        booking.billing.roomRate = newPrice;

        // 6. Record Transaction & Audit
        if (totalAdjustment !== 0) {
            if (!booking.transactions) booking.transactions = [];
            booking.transactions.push({
                type: totalAdjustment > 0 ? 'Charge' : 'Adjustment',
                amount: Math.abs(totalAdjustment),
                method: 'Cash',
                date: new Date(),
                notes: `Room Move: ${oldRoomNumber} ⇄ ${newRoom.roomNumber}. Rate diff: ₹${rateDiff}/night for ${remainingNights} nights.`,
                recordedBy: req.user?._id
            });

            // Update authoritative billing total
            booking.billing.totalAmount = (booking.billing.totalAmount || 0) + totalAdjustment;
            booking.billing.balanceAmount = (booking.billing.balanceAmount || 0) + totalAdjustment;
        }

        if (!booking.auditTrail) booking.auditTrail = [];
        booking.auditTrail.push({
            action: 'ROOM_MOVED',
            description: `Room move from ${oldRoomNumber} to ${newRoom.roomNumber}. Reason: ${reason}`,
            performedBy: req.user?.name || 'Staff',
            performedAt: new Date(),
            metadata: {
                oldRoom: oldData,
                newRoom: {
                    roomNumber: newRoom.roomNumber,
                    roomType: newRoom.roomType,
                    pricePerNight: newPrice
                }
            }
        });

        await booking.save();

        // 7. Update Room Statuses
        if (oldRoomNumber) {
            await Room.findOneAndUpdate({ roomNumber: oldRoomNumber }, { status: 'Available' });
        }
        await Room.findOneAndUpdate({ roomNumber: newRoom.roomNumber }, { status: 'Occupied' });

        res.status(200).json({
            success: true,
            message: `Room moved successfully to ${newRoom.roomNumber}.`,
            data: booking
        });

    } catch (error) {
        console.error('Room Move Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during room move', error: error.message });
    }
};

// Room Exchange with Financial Recalculation
// Room Exchange with Financial Recalculation
exports.exchangeBookingRoom = async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        const Reservation = require('../models/Booking');
        const Room = require('../models/Room');

        const { id } = req.params;
        const { newRoomId, reason, effectiveDate } = req.body;

        // 1. Fetch Reservation/Booking
        let booking = await Booking.findById(id);
        let isReservation = false;

        if (!booking) {
            booking = await Reservation.findById(id);
            isReservation = true;
        }

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Stay record not found' });
        }

        // 2. Validate Reservation Status (must be IN_HOUSE)
        const currentStatus = booking.status;
        const validStatuses = ['Checked-in', 'IN_HOUSE'];
        if (!validStatuses.includes(currentStatus)) {
            return res.status(400).json({
                success: false,
                message: `Room exchange is only allowed for Checked-in guests. Current status: ${currentStatus}`
            });
        }

        // 3. Room Swap Validation
        if (booking.roomNumber === req.body.newRoomNumber) { // Check if same room
            return res.status(400).json({ success: false, message: 'Cannot exchange to the same room.' });
        }

        const newRoom = await Room.findById(newRoomId);
        if (!newRoom) {
            return res.status(404).json({ success: false, message: 'Target room not found' });
        }

        if (newRoom.status !== 'Available') {
            return res.status(400).json({ success: false, message: `Room ${newRoom.roomNumber} is not Available.` });
        }

        // 4. Calculation Logic
        const checkOutDate = new Date(booking.checkOutDate);
        const moveDate = new Date(effectiveDate || new Date());
        moveDate.setHours(0, 0, 0, 0);
        checkOutDate.setHours(0, 0, 0, 0);

        if (moveDate >= checkOutDate) {
            return res.status(400).json({ success: false, message: 'Effective date must be before checkout date.' });
        }

        const remainingNights = Math.max(0, Math.ceil((checkOutDate - moveDate) / (1000 * 60 * 60 * 24)));
        const oldPrice = booking.billing?.roomRate || 0;
        const newPrice = newRoom.price || 0;

        const rateDiffPerNight = newPrice - oldPrice;
        const totalAdjustment = rateDiffPerNight * remainingNights;

        const oldRoomNumber = booking.roomNumber;

        // 5. Update Main Record
        booking.roomNumber = newRoom.roomNumber;
        booking.roomType = newRoom.roomType;

        if (!booking.billing) booking.billing = {};
        booking.billing.roomRate = newPrice;

        // 6. Financial Transaction (For Bookings primarily)
        if (totalAdjustment !== 0) {
            if (!booking.transactions) booking.transactions = [];

            const type = totalAdjustment > 0 ? 'Charge' : 'Adjustment';
            const notes = `Room Exchange: ${oldRoomNumber} ⇄ ${newRoom.roomNumber}. ${remainingNights} nights difference. Reason: ${reason}`;

            booking.transactions.push({
                type: type,
                notes: notes,
                amount: Math.abs(totalAdjustment),
                date: new Date()
            });

            // Update authoritative billing total
            booking.billing.totalAmount = (booking.billing.totalAmount || 0) + totalAdjustment;
        }

        // 7. Audit Trail
        if (!booking.auditTrail) booking.auditTrail = [];
        booking.auditTrail.push({
            action: 'ROOM_EXCHANGE',
            description: `Exchanged room ${oldRoomNumber} for ${newRoom.roomNumber}. Reason: ${reason}`,
            performedBy: req.body.performedBy || 'Staff',
            performedAt: new Date(),
            metadata: {
                oldRoomNumber,
                newRoomNumber: newRoom.roomNumber,
                rateDiffPerNight,
                totalAdjustment,
                remainingNights
            }
        });

        await booking.save();

        // 8. Physical Room Status Sync
        if (oldRoomNumber) {
            await Room.findOneAndUpdate({ roomNumber: oldRoomNumber }, { status: 'Available' });
        }
        await Room.findOneAndUpdate({ roomNumber: newRoom.roomNumber }, { status: 'Occupied' });

        res.status(200).json({
            success: true,
            message: `Room exchanged successfully to ${newRoom.roomNumber}. Adjustment of ₹${Math.abs(totalAdjustment)} applied.`,
            data: booking
        });

    } catch (error) {
        console.error('[ERROR] exchangeBookingRoom:', error);
        res.status(500).json({ success: false, message: 'Exchange failed', error: error.message });
    }
};

// Add Visitor
exports.addBookingVisitor = async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        const Visitor = require('../models/Visitor');

        let booking = await Booking.findById(req.params.id);

        if (!booking) return res.status(404).json({ success: false, message: 'Stay record not found' });

        const visitorData = req.body;

        // Basic Validation
        if (!visitorData.visitorName || !visitorData.mobileNumber || !visitorData.idProofNumber) {
            return res.status(400).json({ success: false, message: 'Missing required visitor details (Name, Mobile, ID).' });
        }

        // Create Visitor record
        const Room = require('../models/Room');
        let roomId = booking.roomId;
        if (!roomId && booking.roomNumber) {
            const room = await Room.findOne({ roomNumber: booking.roomNumber });
            if (room) roomId = room._id;
        }

        if (!roomId) {
            return res.status(400).json({ success: false, message: 'Room ID could not be determined for this booking.' });
        }

        const newVisitor = new Visitor({
            reservationId: booking._id,
            room: roomId, // Storing the room ObjectId in the 'room' field
            guest: booking.guest || null,
            name: visitorData.visitorName,
            mobile: visitorData.mobileNumber,
            idType: visitorData.idProofType || 'Aadhar',
            idNumber: visitorData.idProofNumber,
            purpose: visitorData.visitPurpose || visitorData.purpose || 'Visiting',
            inTime: visitorData.inTime || new Date()
        });

        await newVisitor.save();

        // Ensure visitors array exists
        if (!booking.visitors) booking.visitors = [];

        booking.visitors.push(newVisitor._id);

        // Add visitor entry as a folio transaction so it appears in Folio Operations
        const now = new Date();
        if (!booking.transactions) booking.transactions = [];
        booking.transactions.push({
            type: 'Charge',
            amount: 0,
            date: now,
            day: now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'short' }),
            particulars: 'Visitor Entry',
            description: `Visitor: ${visitorData.visitorName} (${visitorData.visitPurpose || visitorData.purpose || 'Visiting'})`,
            user: 'Staff',
            folioId: 0
        });

        // Add to audit trail if available
        if (booking.auditTrail) {
            booking.auditTrail.push({
                action: 'ADD_VISITOR',
                description: `Added visitor: ${visitorData.visitorName}`,
                performedBy: 'Staff',
                performedAt: new Date()
            });
        }

        await booking.save();

        res.status(200).json({
            success: true,
            message: 'Visitor added successfully',
            data: booking
        });
    } catch (error) {
        console.error('Error adding visitor:', error);
        res.status(500).json({ success: false, message: 'Error adding visitor', error: error.message });
    }
};

// Mark No Show
exports.markBookingNoShow = async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        const { applyCharge } = req.body;

        booking.status = 'NoShow';

        if (applyCharge) {
            const chargeAmount = booking.billing?.roomRate || 0;
            if (chargeAmount > 0) {
                if (!booking.transactions) booking.transactions = [];
                booking.transactions.push({
                    type: 'Charge',
                    amount: chargeAmount,
                    notes: '1 Night No-Show Charge',
                    date: new Date()
                });

                if (!booking.billing) booking.billing = {};
                booking.billing.totalAmount = (booking.billing.totalAmount || 0) + Number(chargeAmount);
            }
        }

        await booking.save();

        const Room = require('../models/Room');
        if (booking.roomNumber) {
            await Room.findOneAndUpdate({ roomNumber: booking.roomNumber }, { status: 'Available' });
        }

        res.status(200).json({ success: true, message: 'Marked as No Show', data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error marking No Show', error: error.message });
    }
};

// Void Booking
exports.voidBooking = async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        const { reason } = req.body;

        booking.status = 'Void';
        booking.cancellationReason = reason || 'Voided';

        // Zero out financial records
        if (booking.billing) {
            booking.billing.totalAmount = 0;
            booking.billing.balanceAmount = 0;
        }

        await booking.save();

        const Room = require('../models/Room');
        if (booking.roomNumber) {
            await Room.findOneAndUpdate({ roomNumber: booking.roomNumber }, { status: 'Available' });
        }

        res.status(200).json({ success: true, message: 'Booking Voided', data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error voiding booking', error: error.message });
    }
};

// Cancel Booking
exports.cancelBooking = async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        const { reason, cancellationCharges, refundAmount, refundMode } = req.body;

        booking.status = 'Cancelled';
        booking.cancellationReason = reason;

        if (!booking.transactions) booking.transactions = [];
        if (!booking.billing) booking.billing = {};

        if (cancellationCharges > 0) {
            booking.transactions.push({
                type: 'Charge',
                amount: cancellationCharges,
                notes: `Cancellation Charges. Reason: ${reason}`,
                date: new Date()
            });

            booking.billing.totalAmount = (booking.billing.totalAmount || 0) + Number(cancellationCharges);
            booking.billing.balanceAmount = (booking.billing.balanceAmount || 0) + Number(cancellationCharges);
        }

        if (refundAmount > 0) {
            booking.transactions.push({
                type: 'Refund',
                amount: refundAmount,
                method: refundMode || 'Cash',
                notes: `Refund for cancellation. Reason: ${reason}`,
                date: new Date()
            });

            booking.billing.paidAmount = (booking.billing.paidAmount || 0) - Number(refundAmount);
            booking.billing.balanceAmount = (booking.billing.balanceAmount || 0) + Number(refundAmount);
        }

        await booking.save();

        const Room = require('../models/Room');
        if (booking.roomNumber) {
            await Room.findOneAndUpdate({ roomNumber: booking.roomNumber }, { status: 'Available' });
        }

        res.status(200).json({ success: true, message: 'Booking Cancelled', data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error cancelling booking', error: error.message });
    }
};

// Search bookings by keywords
exports.searchBookings = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(200).json({ success: true, data: [], count: 0 });
        }

        const query = {
            $or: [
                { guestName: { $regex: q, $options: 'i' } },
                { referenceId: { $regex: q, $options: 'i' } }
            ]
        };

        if (/^\d+$/.test(q)) {
            query.$or.push({ mobileNumber: { $regex: q } });
            query.$or.push({ roomNumber: { $regex: q, $options: 'i' } });
        }

        const bookings = await Booking.find(query);

        // Sort: Checked-in (IN_HOUSE) first, Upcoming (RESERVED) second, others after
        const sortedBookings = bookings.sort((a, b) => {
            const statusOrder = { 'Checked-in': 1, 'Upcoming': 2 };
            const orderA = statusOrder[a.status] || 3;
            const orderB = statusOrder[b.status] || 3;

            if (orderA !== orderB) return orderA - orderB;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        res.status(200).json({
            success: true,
            data: sortedBookings,
            count: sortedBookings.length
        });
    } catch (error) {
        console.error('[SEARCH ERROR]', error);
        res.status(500).json({
            success: false,
            message: 'Error searching bookings',
            error: error.message
        });
    }
};


