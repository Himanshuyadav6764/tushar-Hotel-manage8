import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';
import './QRScanPage.css';

const QRScanPage = () => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const { roomId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const queryParams = new URLSearchParams(location.search || '');
    const qrHotelId = queryParams.get('hid') || '';
    const qrTenantDb = queryParams.get('tdb') || '';
    const roomQrToken = queryParams.get('rt') || '';

    // States
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(2); // 2: Booking Verification
    const [roomData, setRoomData] = useState(null);
    const [error, setError] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [bookingId, setBookingId] = useState('');
    const [verifyLoading, setVerifyLoading] = useState(false);

    // Fetch room details on mount
    useEffect(() => {
        fetchRoomDetails();
    }, [roomId]);

    const fetchRoomDetails = async () => {
        try {
            setLoading(true);
            const response = await apiCall(`/api/qr/room-details/${roomId}?rt=${encodeURIComponent(roomQrToken)}`, {
                headers: {
                    ...(qrHotelId ? { 'x-hotel-id': qrHotelId } : {}),
                    ...(qrTenantDb ? { 'x-tenant-db': qrTenantDb } : {})
                }
            });
            const data = await response.json();

            if (data.success) {
                setRoomData(data.data);
                setStep(2);
            } else {
                setError(data.message);
            }
        } catch (err) {
            console.error('Error fetching room details:', err);
            setError('Failed to load room details. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyBooking = async () => {
        if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
            setError('Please enter a valid 10-digit mobile number');
            return;
        }

        if (!bookingId.trim()) {
            setError('Please enter your booking ID');
            return;
        }

        setError('');
        setVerifyLoading(true);

        try {
            const response = await apiCall(`/api/qr/verify-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(qrHotelId ? { 'x-hotel-id': qrHotelId } : {}),
                    ...(qrTenantDb ? { 'x-tenant-db': qrTenantDb } : {})
                },
                body: JSON.stringify({
                    mobileNumber,
                    bookingId,
                    roomId
                })
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('guestAccessToken', data.data.accessToken);
                localStorage.setItem('guestTenantContext', JSON.stringify({
                    hotelId: qrHotelId,
                    dbName: qrTenantDb,
                    roomId,
                    roomToken: roomQrToken
                }));

                const guestRoomContext = {
                    id: `qr-room-${roomId}`,
                    roomNumber: data.data.booking?.roomNumber || roomData?.room?.roomNumber,
                    guestName: data.data.booking?.guestName || 'Guest',
                    guestPhone: data.data.booking?.mobileNumber || mobileNumber,
                    bookingId: data.data.booking?.bookingId || bookingId,
                    mode: 'online'
                };

                localStorage.setItem('guestRoomContext', JSON.stringify(guestRoomContext));

                navigate('/order-success', {
                    state: {
                        source: 'qr-room',
                        orderMode: 'online',
                        guestQrFlow: true,
                        room: guestRoomContext
                    }
                });
            } else {
                setError(data.message);
            }
        } catch (err) {
            console.error('Error verifying booking details:', err);
            setError('Failed to verify booking details. Please try again.');
        } finally {
            setVerifyLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="qr-scan-page">
                <div className="loading-container">
                    <div className="loader"></div>
                    <p>Loading room details...</p>
                </div>
            </div>
        );
    }

    if (error && !roomData) {
        return (
            <div className="qr-scan-page">
                <div className="error-container">
                    <div className="error-icon">⚠️</div>
                    <h2>Access Denied</h2>
                    <p>{error}</p>
                    <button className="btn-primary" onClick={() => navigate('/')}>
                        Go to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="qr-scan-page">
            <div className="qr-scan-container">
                <div className="qr-scan-header">
                    <h1>🏨 Bareena Atithi</h1>
                    <p>Room Service & Access</p>
                </div>

                <AnimatePresence mode="wait">
                    {/* Step 2: Booking Verification */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="step-container"
                        >
                            <div className="verification-card">
                                <div className="verification-icon">🔐</div>
                                <h2>Booking Verification</h2>
                                <p className="verification-subtitle">
                                    Please enter your room booking details below to proceed.
                                </p>

                                {roomData && (
                                    <div className="room-info-small">
                                        <span>Room {roomData.room.roomNumber}</span>
                                        <span className="separator">•</span>
                                        <span>{roomData.room.category}</span>
                                    </div>
                                )}

                                <div className="input-group">
                                    <label>Mobile Number</label>
                                    <input
                                        type="tel"
                                        maxLength="10"
                                        placeholder="Enter 10-digit mobile number"
                                        value={mobileNumber}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, '');
                                            setMobileNumber(value);
                                            setError('');
                                        }}
                                        className="mobile-input"
                                    />
                                </div>

                                <div className="input-group">
                                    <label>Room Number</label>
                                    <input
                                        type="text"
                                        value={roomData?.room?.roomNumber || ''}
                                        className="mobile-input"
                                        readOnly
                                    />
                                </div>

                                <div className="input-group">
                                    <label>Booking ID / Reservation ID / Reservation Number</label>
                                    <input
                                        type="text"
                                        placeholder="Enter booking ID / reservation ID / reservation number"
                                        value={bookingId}
                                        onChange={(e) => {
                                            setBookingId(e.target.value);
                                            setError('');
                                        }}
                                        className="mobile-input"
                                    />
                                </div>

                                {error && (
                                    <div className="error-message">
                                        <span>⚠️</span> {error}
                                    </div>
                                )}

                                <button
                                    className="btn-primary"
                                    onClick={handleVerifyBooking}
                                    disabled={verifyLoading || mobileNumber.length !== 10 || !bookingId.trim()}
                                >
                                    {verifyLoading ? 'Verifying...' : 'Verify & Continue'}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default QRScanPage;
