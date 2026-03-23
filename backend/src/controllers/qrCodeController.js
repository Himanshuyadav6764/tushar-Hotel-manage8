const QRCode = require('qrcode');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const QRCodeModel = require('../models/QrCode');
const OTPLog = require('../models/OtpLog');
const QRScanLog = require('../models/QrScanLog');

// Generate or Get QR Code for a Room
exports.generateRoomQR = async (req, res) => {
    try {
        const { roomId } = req.params;

        // Find the room
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Check if QR already exists
        let qrCodeDoc = await QRCodeModel.findOne({ roomId });

        const qrData = {
            hotelId: 'bareena-atithi',
            roomId: room._id.toString(),
            roomNumber: room.roomNumber,
            category: room.roomType,
            roomType: room.roomType,
            scanUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/scan-qr/${room._id}`
        };

        // Generate QR Code
        const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            quality: 0.95,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFA500'
            },
            width: 400
        });

        if (qrCodeDoc) {
            // Update existing QR
            qrCodeDoc.qrCode = qrCodeDataUrl;
            qrCodeDoc.qrData = qrData;
            qrCodeDoc.lastUpdated = new Date();
            await qrCodeDoc.save();
        } else {
            // Create new QR
            qrCodeDoc = await QRCodeModel.create({
                roomId: room._id,
                qrCode: qrCodeDataUrl,
                qrData: qrData
            });
        }

        res.json({
            success: true,
            message: 'QR Code generated successfully',
            data: {
                qrCode: qrCodeDataUrl,
                qrData: qrData,
                room: {
                    roomNumber: room.roomNumber,
                    roomType: room.roomType,
                    status: room.status
                }
            }
        });

    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate QR code',
            error: error.message
        });
    }
};

// Get Room Details by QR Scan
exports.getRoomDetailsByQR = async (req, res) => {
    try {
        const { roomId } = req.params;

        // Find the room
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Find active booking for this room (Checked-in status)
        const booking = await Booking.findOne({
            roomNumber: room.roomNumber,
            status: 'Checked-in'
        }).sort({ checkInDate: -1 });

        if (!booking) {
            return res.status(403).json({
                success: false,
                message: 'This room is not currently checked-in. Please contact reception.',
                roomStatus: room.status
            });
        }

        // Calculate stay duration
        const checkIn = new Date(booking.checkInDate);
        const checkOut = new Date(booking.checkOutDate);
        const stayDuration = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        // Log the scan
        const deviceInfo = {
            userAgent: req.headers['user-agent'],
            platform: req.headers['sec-ch-ua-platform'],
            language: req.headers['accept-language']
        };

        await QRScanLog.create({
            roomId: room._id,
            bookingId: booking._id,
            scanDateTime: new Date(),
            deviceInfo: deviceInfo,
            ipAddress: req.ip || req.connection.remoteAddress,
            status: 'success'
        });

        res.json({
            success: true,
            data: {
                room: {
                    roomNumber: room.roomNumber,
                    category: room.roomType,
                    roomType: room.roomType,
                    capacity: room.capacity || 2,
                    status: room.status,
                    checkInDate: booking.checkInDate,
                    checkOutDate: booking.checkOutDate
                },
                booking: {
                    bookingId: booking._id,
                    bookingDate: booking.createdAt,
                    stayDuration: stayDuration,
                    numberOfGuests: booking.numberOfGuests
                },
                guest: {
                    guestName: booking.guestName,
                    mobileNumber: booking.mobileNumber.replace(/(\d{2})(\d{4})(\d{4})/, '$1****$3'), // Masked
                    numberOfGuests: booking.numberOfGuests
                },
                requiresVerification: true
            }
        });

    } catch (error) {
        console.error('Error fetching room details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch room details',
            error: error.message
        });
    }
};

// Send OTP for Mobile Verification
exports.sendOTP = async (req, res) => {
    try {
        const { mobileNumber, roomId } = req.body;

        if (!mobileNumber || !roomId) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number and room ID are required'
            });
        }

        // Validate mobile number format
        if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit mobile number'
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Set expiry time (5 minutes)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Save OTP to database
        await OTPLog.create({
            mobileNumber,
            otp,
            roomId,
            expiresAt
        });

        // TODO: Send OTP via SMS (Twilio/other service)
        // For now, we'll just log it (in production, use SMS service)
        console.log(`OTP for ${mobileNumber}: ${otp}`);

        res.json({
            success: true,
            message: 'OTP sent successfully to your mobile number',
            // Remove this in production - only for development
            devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
        });

    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: error.message
        });
    }
};

// Verify OTP and Reservation
exports.verifyOTPAndReservation = async (req, res) => {
    try {
        const { mobileNumber, otp, roomId } = req.body;

        if (!mobileNumber || !otp || !roomId) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number, OTP, and room ID are required'
            });
        }

        // Find the OTP log
        const otpLog = await OTPLog.findOne({
            mobileNumber,
            roomId,
            isVerified: false
        }).sort({ createdAt: -1 });

        if (!otpLog) {
            return res.status(404).json({
                success: false,
                message: 'OTP not found or already used'
            });
        }

        // Check if OTP is expired
        if (new Date() > otpLog.expiresAt) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.'
            });
        }

        // Check attempts
        if (otpLog.attempts >= 3) {
            return res.status(400).json({
                success: false,
                message: 'Maximum OTP attempts exceeded. Please request a new OTP.'
            });
        }

        // Verify OTP
        if (otpLog.otp !== otp) {
            otpLog.attempts += 1;
            await otpLog.save();

            return res.status(400).json({
                success: false,
                message: `Invalid OTP. ${3 - otpLog.attempts} attempts remaining.`
            });
        }

        // Find the room
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Check if mobile number matches with active booking
        const booking = await Booking.findOne({
            roomNumber: room.roomNumber,
            mobileNumber: mobileNumber,
            status: 'Checked-in'
        });

        if (!booking) {
            // Log failed attempt
            await QRScanLog.create({
                roomId: room._id,
                guestMobile: mobileNumber,
                scanDateTime: new Date(),
                deviceInfo: {
                    userAgent: req.headers['user-agent']
                },
                ipAddress: req.ip || req.connection.remoteAddress,
                status: 'unauthorized',
                failureReason: 'Mobile number not linked with reservation'
            });

            return res.status(403).json({
                success: false,
                message: 'This mobile number is not linked with the reservation for this room.'
            });
        }

        // Mark OTP as verified
        otpLog.isVerified = true;
        await otpLog.save();

        // Log successful verification
        await QRScanLog.create({
            roomId: room._id,
            bookingId: booking._id,
            guestMobile: mobileNumber,
            scanDateTime: new Date(),
            deviceInfo: {
                userAgent: req.headers['user-agent']
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            status: 'success'
        });

        res.json({
            success: true,
            message: 'Verification successful! Access granted.',
            data: {
                booking: {
                    bookingId: booking._id,
                    guestName: booking.guestName,
                    roomNumber: booking.roomNumber,
                    checkInDate: booking.checkInDate,
                    checkOutDate: booking.checkOutDate,
                    totalAmount: booking.totalAmount,
                    advancePaid: booking.advancePaid,
                    remainingAmount: booking.totalAmount - booking.advancePaid
                },
                accessToken: `${booking._id}-${Date.now()}` // Simple token for session
            }
        });

    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify OTP',
            error: error.message
        });
    }
};

// Get QR Scan Logs (Admin)
exports.getQRScanLogs = async (req, res) => {
    try {
        const logs = await QRScanLog.find()
            .populate('roomId', 'roomNumber roomType')
            .populate('bookingId', 'guestName bookingDate')
            .sort({ scanDateTime: -1 })
            .limit(100);

        res.json({
            success: true,
            count: logs.length,
            data: logs
        });

    } catch (error) {
        console.error('Error fetching scan logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch scan logs',
            error: error.message
        });
    }
};
