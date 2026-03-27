import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import API_URL, { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';
import './QRScanPage.css';

const QRScanPage = () => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const { roomId } = useParams();
    const navigate = useNavigate();

    // States
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1); // 1: Room Details, 2: Mobile Input, 3: OTP, 4: Access Granted
    const [roomData, setRoomData] = useState(null);
    const [error, setError] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [otp, setOTP] = useState(['', '', '', '', '', '']);
    const [otpSent, setOtpSent] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [accessGranted, setAccessGranted] = useState(false);
    const [bookingDetails, setBookingDetails] = useState(null);

    // Fetch room details on mount
    useEffect(() => {
        fetchRoomDetails();
    }, [roomId]);

    const fetchRoomDetails = async () => {
        try {
            setLoading(true);
            const response = await apiCall(`/api/qr/room-details/${roomId}`);
            const data = await response.json();

            if (data.success) {
                setRoomData(data.data);
                setStep(2); // Move to mobile input step
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

    const handleSendOTP = async () => {
        if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
            setError('Please enter a valid 10-digit mobile number');
            return;
        }

        setError('');
        setOtpLoading(true);

        try {
            const response = await apiCall(`/api/qr/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mobileNumber,
                    roomId
                })
            });

            const data = await response.json();

            if (data.success) {
                setOtpSent(true);
                setStep(3);
                // For development - show OTP in console
                if (data.devOTP) {
                    console.log('Development OTP:', data.devOTP);
                    alert(`Development Mode - OTP: ${data.devOTP}`);
                }
            } else {
                setError(data.message);
            }
        } catch (err) {
            console.error('Error sending OTP:', err);
            setError('Failed to send OTP. Please try again.');
        } finally {
            setOtpLoading(false);
        }
    };

    const handleOTPChange = (index, value) => {
        if (value.length > 1) value = value[0];
        if (!/^\d*$/.test(value)) return;

        const newOTP = [...otp];
        newOTP[index] = value;
        setOTP(newOTP);

        // Auto-focus next input
        if (value && index < 5) {
            document.getElementById(`otp-${index + 1}`)?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            document.getElementById(`otp-${index - 1}`)?.focus();
        }
    };

    const handleVerifyOTP = async () => {
        const otpValue = otp.join('');
        
        if (otpValue.length !== 6) {
            setError('Please enter complete OTP');
            return;
        }

        setError('');
        setVerifyLoading(true);

        try {
            const response = await apiCall(`/api/qr/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mobileNumber,
                    otp: otpValue,
                    roomId
                })
            });

            const data = await response.json();

            if (data.success) {
                setAccessGranted(true);
                setBookingDetails(data.data.booking);
                setStep(4);
                // Store access token
                localStorage.setItem('guestAccessToken', data.data.accessToken);
            } else {
                setError(data.message);
                // Clear OTP on error
                setOTP(['', '', '', '', '', '']);
                document.getElementById('otp-0')?.focus();
            }
        } catch (err) {
            console.error('Error verifying OTP:', err);
            setError('Failed to verify OTP. Please try again.');
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleResendOTP = () => {
        setOTP(['', '', '', '', '', '']);
        setError('');
        handleSendOTP();
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
                    {/* Step 1: Room Details Display */}
                    {step === 1 && roomData && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="step-container"
                        >
                            <div className="room-details-card">
                                <h2>Room Details</h2>
                                <div className="detail-row">
                                    <span>Room Number:</span>
                                    <strong>{roomData.room.roomNumber}</strong>
                                </div>
                                <div className="detail-row">
                                    <span>Category:</span>
                                    <strong>{roomData.room.category}</strong>
                                </div>
                                <div className="detail-row">
                                    <span>Status:</span>
                                    <span className={`status-badge ${roomData.room.status?.toLowerCase()}`}>
                                        {roomData.room.status}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: Mobile Number Input */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="step-container"
                        >
                            <div className="verification-card">
                                <div className="verification-icon">📱</div>
                                <h2>Mobile Verification</h2>
                                <p className="verification-subtitle">
                                    Enter your registered mobile number to continue
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

                                {error && (
                                    <div className="error-message">
                                        <span>⚠️</span> {error}
                                    </div>
                                )}

                                <button
                                    className="btn-primary"
                                    onClick={handleSendOTP}
                                    disabled={otpLoading || mobileNumber.length !== 10}
                                >
                                    {otpLoading ? 'Sending...' : 'Send OTP'}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 3: OTP Verification */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="step-container"
                        >
                            <div className="verification-card">
                                <div className="verification-icon">🔐</div>
                                <h2>Enter OTP</h2>
                                <p className="verification-subtitle">
                                    We've sent a 6-digit code to<br />
                                    <strong>{mobileNumber.replace(/(\d{2})(\d{4})(\d{4})/, '$1****$3')}</strong>
                                </p>

                                <div className="otp-input-container">
                                    {otp.map((digit, index) => (
                                        <input
                                            key={index}
                                            id={`otp-${index}`}
                                            type="text"
                                            maxLength="1"
                                            value={digit}
                                            onChange={(e) => handleOTPChange(index, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(index, e)}
                                            className="otp-input"
                                        />
                                    ))}
                                </div>

                                {error && (
                                    <div className="error-message">
                                        <span>⚠️</span> {error}
                                    </div>
                                )}

                                <button
                                    className="btn-primary"
                                    onClick={handleVerifyOTP}
                                    disabled={verifyLoading || otp.join('').length !== 6}
                                >
                                    {verifyLoading ? 'Verifying...' : 'Verify OTP'}
                                </button>

                                <button
                                    className="btn-secondary"
                                    onClick={handleResendOTP}
                                    disabled={otpLoading}
                                >
                                    Resend OTP
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 4: Access Granted */}
                    {step === 4 && accessGranted && bookingDetails && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="step-container"
                        >
                            <div className="success-card">
                                <div className="success-icon">✅</div>
                                <h2>Access Granted!</h2>
                                <p className="success-subtitle">Welcome, {bookingDetails.guestName}</p>

                                <div className="booking-summary">
                                    <h3>Booking Summary</h3>
                                    <div className="summary-row">
                                        <span>Room:</span>
                                        <strong>{bookingDetails.roomNumber}</strong>
                                    </div>
                                    <div className="summary-row">
                                        <span>Check-in:</span>
                                        <strong>{new Date(bookingDetails.checkInDate).toLocaleDateString()}</strong>
                                    </div>
                                    <div className="summary-row">
                                        <span>Check-out:</span>
                                        <strong>{new Date(bookingDetails.checkOutDate).toLocaleDateString()}</strong>
                                    </div>
                                    <div className="summary-row">
                                        <span>Total Amount:</span>
                                        <strong>{cs}{bookingDetails.totalAmount}</strong>
                                    </div>
                                    <div className="summary-row">
                                        <span>Remaining:</span>
                                        <strong>{cs}{bookingDetails.remainingAmount}</strong>
                                    </div>
                                </div>

                                <div className="service-buttons">
                                    <button 
                                        className="service-btn"
                                        onClick={() => navigate('/food-menu')}
                                    >
                                        <span className="service-icon">🍽️</span>
                                        Food Menu
                                    </button>
                                    <button 
                                        className="service-btn"
                                        onClick={() => alert('Room Service coming soon!')}
                                    >
                                        <span className="service-icon">🛎️</span>
                                        Room Service
                                    </button>
                                    <button 
                                        className="service-btn"
                                        onClick={() => alert('Extra Services coming soon!')}
                                    >
                                        <span className="service-icon">⭐</span>
                                        Extra Services
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default QRScanPage;
