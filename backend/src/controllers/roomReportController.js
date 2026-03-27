const Room = require('../models/Room');
const Booking = require('../models/Booking');

exports.getRoomOptions = async (req, res) => {
    try {
        console.log("Fetching distinct roomTypes...");
        const types = await Room.distinct('roomType');
        console.log("Fetched types:", types);
        console.log("Fetching distinct floors...");
        const floors = await Room.distinct('floor');
        console.log("Fetched floors:", floors);
        const statuses = Room.schema.path('status').enumValues || ['Available', 'Booked', 'Occupied', 'Maintenance', 'Cleaning', 'Under Maintenance'];

        // Filter out null or undefined
        const data = {
            types: types.filter(Boolean),
            floors: floors.filter(Boolean),
            statuses: statuses
        };
        console.log("Returning data:", data);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching room options:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch options' });
    }
};

exports.getRoomReport = async (req, res) => {
    try {
        const { tab, roomType, floor, status, paymentMode, startDate, endDate } = req.query;

        const normalizePaymentMode = (value) => {
            const mode = String(value || '').trim().toLowerCase();
            if (!mode) return '';
            if (mode.includes('mixed') || mode.includes('multiple')) return 'Mixed';
            if (mode.includes('upi')) return 'UPI';
            if (mode.includes('card')) return 'Card';
            if (mode.includes('bank') || mode.includes('transfer')) return 'Bank Transfer';
            if (mode.includes('cash')) return 'Cash';
            return String(value || '').trim();
        };

        let start = new Date();
        start.setHours(0, 0, 0, 0);
        if (startDate && !isNaN(new Date(startDate))) {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
        }

        let end = new Date();
        end.setHours(23, 59, 59, 999);
        if (endDate && !isNaN(new Date(endDate))) {
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        }

        // We will build a query based on the tab
        // 'Room Occupancy', 'Check-In / Check-Out', 'Room Revenue', 'Reservation', 'No-Show', 'Cancellation'

        // Pre-fetch rooms to map them and their floors
        const roomQuery = {};
        if (roomType && roomType !== 'All Room Types' && roomType !== 'All') roomQuery.roomType = roomType;
        if (floor && floor !== 'All Floors' && floor !== 'All') roomQuery.floor = floor;
        if (status && status !== 'All Statuses' && status !== 'All Statuss' && status !== 'All') roomQuery.status = status; // Check status matches

        const rooms = await Room.find(roomQuery);
        const roomIds = rooms.map(r => r._id);
        const roomMap = {};
        rooms.forEach(r => roomMap[r._id.toString()] = r);

        // If rooms were filtered but none exist, avoid fetching all bookings
        if (Object.keys(roomQuery).length > 0 && roomIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const bookingQuery = {};
        if (roomIds.length > 0) {
            bookingQuery.room = { $in: roomIds };
        }

        // Tab specific logic
        if (tab === 'Check-In / Check-Out') {
            bookingQuery.$or = [
                { checkInDate: { $gte: start, $lte: end } },
                { checkOutDate: { $gte: start, $lte: end } }
            ];
            bookingQuery.status = { $in: ['CheckedIn', 'CheckedOut', 'Checked-in', 'Checked-out', 'IN_HOUSE', 'CHECKED_OUT'] };
        } else if (tab === 'Reservation') {
            bookingQuery.createdAt = { $gte: start, $lte: end };
        } else if (tab === 'No-Show') {
            bookingQuery.checkInDate = { $gte: start, $lte: end };
            bookingQuery.status = { $in: ['NoShow', 'No-Show', 'No Show'] };
        } else if (tab === 'Cancellation') {
            bookingQuery.updatedAt = { $gte: start, $lte: end };
            bookingQuery.status = 'Cancelled';
        } else if (tab === 'Room Revenue') {
            // Include paid/checked out or checked in bookings in the range
            bookingQuery.$or = [
                { checkInDate: { $gte: start, $lte: end } },
                { checkOutDate: { $gte: start, $lte: end } }
            ];
            bookingQuery.status = { $in: ['CheckedOut', 'Checked-out', 'CHECKED_OUT', 'CheckedIn', 'Checked-in', 'IN_HOUSE'] };
        } else if (tab === 'Room Occupancy') {
            // Bookings that overlap with the date range
            bookingQuery.checkInDate = { $lte: end };
            bookingQuery.checkOutDate = { $gte: start };
            bookingQuery.status = { $in: ['Confirmed', 'CheckedIn', 'Checked-in', 'IN_HOUSE', 'CheckedOut', 'Checked-out', 'CHECKED_OUT'] };
        }

        let bookings = await Booking.find(bookingQuery).populate('guest').populate('room');

        // Post-filter bookings by the actual selected room constraints
        if (Object.keys(roomQuery).length > 0) {
            bookings = bookings.filter(b => {
                const bRoomNum = b.room?.roomNumber || b.roomNumber;
                let matchesType = true;
                let matchesFloor = true;
                let matchesStatus = true;

                if (roomQuery.roomType) {
                    const typeMatch1 = b.room?.roomType?.toLowerCase() === roomQuery.roomType.toLowerCase();
                    const typeMatch2 = b.roomType?.toLowerCase() === roomQuery.roomType.toLowerCase();
                    matchesType = typeMatch1 || typeMatch2;
                }

                if (roomQuery.floor) {
                    const rObj = Object.values(roomMap).find(r => r.roomNumber === bRoomNum);
                    matchesFloor = rObj && rObj.floor?.toLowerCase() === roomQuery.floor.toLowerCase();
                }

                if (roomQuery.status) {
                    const rObj = Object.values(roomMap).find(r => r.roomNumber === bRoomNum);
                    matchesStatus = rObj && rObj.status?.toLowerCase() === roomQuery.status.toLowerCase();
                }

                return matchesType && matchesFloor && matchesStatus;
            });
        }

        // Optional payment mode filter for room reports.
        if (paymentMode && paymentMode !== 'All') {
            const selectedMode = normalizePaymentMode(paymentMode);
            bookings = bookings.filter((b) => {
                const bookingMode = normalizePaymentMode(b.paymentMode);

                // Prefer explicit paymentMode on booking when present.
                if (bookingMode) {
                    return bookingMode === selectedMode;
                }

                // Fallback: infer from payment transactions.
                const paymentTx = Array.isArray(b.transactions)
                    ? b.transactions.filter(t => String(t?.type || '').toLowerCase() === 'payment')
                    : [];

                if (paymentTx.length === 0) return false;

                const txModes = paymentTx
                    .map(t => normalizePaymentMode(t?.method || t?.paymentMode || t?.mode))
                    .filter(Boolean);

                const uniqueModes = [...new Set(txModes)];
                if (selectedMode === 'Mixed') {
                    return uniqueModes.length > 1;
                }
                return uniqueModes.includes(selectedMode);
            });
        }

        const reportData = bookings.map(b => {
            // For legacy/flat fields vs populated fields
            const roomNo = b.room?.roomNumber || b.roomNumber || 'N/A';
            let gName = b.guest?.name || b.guestName || 'Unknown';
            if (gName === 'Unknown' && b.guest && b.guest.firstName) {
                gName = `${b.guest.firstName} ${b.guest.lastName || ''}`.trim();
            }

            // Format dates
            const formatDt = (d) => {
                if (!d) return 'N/A';
                return new Date(d).toISOString().split('T')[0];
            };

            const checkIn = formatDt(b.checkInDate);
            const checkOut = formatDt(b.checkOutDate);
            const nights = b.duration?.nights || b.numberOfNights || 1;

            let amount = b.billing?.totalAmount || b.totalAmount || 0;

            return {
                roomNo,
                guestName: gName,
                checkIn,
                checkOut,
                nights,
                amount
            };
        });

        res.json({
            success: true,
            data: reportData
        });
    } catch (error) {
        console.error('Error generating room report:', error);
        res.status(500).json({ success: false, message: 'Failed to generate room report' });
    }
};
