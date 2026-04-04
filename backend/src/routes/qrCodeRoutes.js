const express = require('express');
const router = express.Router();
const {
    generateRoomQR,
    getRoomDetailsByQR,
    sendOTP,
    verifyOTPAndReservation,
    verifyBookingForRoomAccess,
    getQRScanLogs
} = require('../controllers/qrCodeController');

// Admin Routes
router.post('/generate/:roomId', generateRoomQR);
router.get('/scan-logs', getQRScanLogs);

// Guest Routes
router.get('/room-details/:roomId', getRoomDetailsByQR);
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTPAndReservation);
router.post('/verify-booking', verifyBookingForRoomAccess);

module.exports = router;
