import React, { useState } from 'react';
import './EditReservationModal.css';
import ReservationHeader from './ReservationHeader';
import ReservationTabs from './ReservationTabs';
import FolioOperations from './FolioOperations';

import BookingDetails from './BookingDetails';
import GuestDetails from './GuestDetails';
import RoomCharges from './RoomCharges';
import AuditTrail from './AuditTrail';
import API_URL, { apiCall } from '../config/api';
import { useSettings } from '../context/SettingsContext';
const EditReservationModal = ({ isOpen, onClose, reservation, onRefresh }) => {
    const [activeTab, setActiveTab] = useState('folio-operations');
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(false);
    const [showActionConfirm, setShowActionConfirm] = useState(false);
    const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
    const { formatDate } = useSettings();

    // Initial balance calculation or updates when reservation changes
    React.useEffect(() => {
        if (reservation) {
            const currentBalance = calculateTotalBalance(reservation);
            setBalance(currentBalance);
        }
    }, [reservation]);

    function calculateTotalBalance(booking) {
        if (!booking) return 0;
        const transactions = booking.transactions || [];

        const payments = transactions
            .filter(t => t.type?.toLowerCase() === 'payment')
            .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

        const discounts = transactions
            .filter(t => t.type?.toLowerCase() === 'discount')
            .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

        let charges = transactions
            .filter(t => t.type?.toLowerCase() === 'charge')
            .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

        const hasRoomTariff = transactions.some(t =>
            t.particulars === 'Room Tariff' ||
            (t.description?.toLowerCase().includes('room charges'))
        );

        if (!hasRoomTariff) {
            const reservationTotal = booking.billing?.totalAmount || booking.totalAmount || 0;
            if (reservationTotal > 0) {
                charges += reservationTotal;
            } else {
                const checkIn = booking.checkInDate;
                const checkOut = booking.checkOutDate;
                const nights = (checkIn && checkOut) ? Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))) : 0;
                const rate = booking.billing?.roomRate || booking.pricePerNight || 0;
                charges += (rate * nights);
            }
        }

        return charges - discounts - payments;
    }

    if (!isOpen || !reservation) return null;

    const isCheckout = ['IN_HOUSE', 'Checked-in', 'Occupied', 'CheckedIn'].includes(reservation?.status);
    const isCheckoutDisabled = isCheckout && balance > 0.5;

    const performStatusAction = async () => {
        if (loading) return;

        const newStatus = isCheckout ? 'Checked-out' : 'Checked-in';
        const actionText = isCheckout ? 'checkout' : 'check-in';

        try {
            setLoading(true);
            setActionMessage({ type: '', text: '' });
            const response = await apiCall(`/api/bookings/status/${reservation._id || reservation.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await response.json();
            if (data.success) {
                setActionMessage({ type: 'success', text: `Guest ${newStatus} successfully.` });
                setShowActionConfirm(false);
                if (onRefresh) onRefresh();
                setTimeout(() => onClose(), 900);
            } else {
                setActionMessage({ type: 'error', text: data.message || `Failed to ${actionText}` });
            }
        } catch (error) {
            console.error(`Error during ${actionText}:`, error);
            setActionMessage({ type: 'error', text: `An error occurred during ${actionText}.` });
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async () => {
        if (loading) return;
        setActionMessage({ type: '', text: '' });
        setShowActionConfirm(true);
    };

    const handleOverlayClick = (e) => {
        if (e.target.classList.contains('edit-modal-overlay')) {
            onClose();
        }
    };

    return (
        <div className="edit-modal-overlay" onClick={handleOverlayClick}>
            <div className="edit-modal-card">
                {/* Close Button */}
                <button className="edit-modal-close" onClick={onClose}>
                    ✕
                </button>

                {/* Header Section */}
                <div className="edit-modal-header">
                    <div className="guest-info-header">
                        <div className="guest-avatar-circle">👤</div>
                        <div className="guest-name-section">
                            <h2 className="guest-name-modal">{reservation.guestName}</h2>
                            <p className="guest-phone-modal">📞 {reservation.guestPhone}</p>
                        </div>
                    </div>
                </div>

                {/* Booking Summary Row */}
                <div className="booking-summary-modal">
                    <div className="summary-info-row">
                        <div className="summary-col">
                            <span className="summary-label-modal">BOOKING DATE</span>
                            <span className="summary-value-modal">
                                {formatDate(reservation.createdAt)}
                            </span>
                        </div>
                        <div className="summary-col">
                            <span className="summary-label-modal">ARRIVAL</span>
                            <span className="summary-value-modal">
                                {formatDate(reservation.checkInDate)}
                            </span>
                        </div>
                        <div className="summary-col">
                            <span className="summary-label-modal">DEPARTURE</span>
                            <span className="summary-value-modal">
                                {formatDate(reservation.checkOutDate)}
                            </span>
                        </div>
                        <div className="summary-col">
                            <span className="summary-label-modal">NIGHTS</span>
                            <span className="summary-value-modal">
                                {Math.max(1, Math.ceil((new Date(reservation.checkOutDate) - new Date(reservation.checkInDate)) / (1000 * 60 * 60 * 24)))}
                            </span>
                        </div>
                        <div className="summary-col">
                            <span className="summary-label-modal">ROOM / ROOM TYPE</span>
                            <span className="summary-value-modal">
                                {reservation.roomNumber || 'TBD'} / {reservation.roomType || 'Pending'}
                            </span>
                        </div>
                        <div className="summary-col">
                            <span className="summary-label-modal">RESERVATION NO</span>
                            <span className="summary-value-modal">{reservation.id}</span>
                        </div>
                        <div className="summary-col">
                            <span className="summary-label-modal">RESERVATION STATUS</span>
                            <span className={`status-badge-modal ${reservation.status.toLowerCase()}`}>
                                {reservation.status.replace('_', ' ')}
                            </span>
                        </div>
                    </div>
                    <div className="check-in-action">
                        <button
                            className={`btn-check-in-modal ${isCheckoutDisabled ? 'disabled' : ''} ${loading ? 'loading' : ''}`}
                            disabled={isCheckoutDisabled || loading}
                            onClick={handleAction}
                            title={isCheckoutDisabled ? 'Payment is pending. Please settle balance to checkout.' : ''}
                        >
                            {loading ? 'Processing...' : (isCheckout ? 'Checkout' : 'Check-in')}
                        </button>
                        {showActionConfirm && !isCheckoutDisabled && (
                            <div className="inline-checkin-confirm">
                                <p>{`Are you sure you want to proceed with ${isCheckout ? 'checkout' : 'check-in'}?`}</p>
                                <div className="inline-checkin-confirm-actions">
                                    <button
                                        type="button"
                                        className="inline-confirm-btn yes"
                                        onClick={performStatusAction}
                                        disabled={loading}
                                    >
                                        Yes
                                    </button>
                                    <button
                                        type="button"
                                        className="inline-confirm-btn no"
                                        onClick={() => setShowActionConfirm(false)}
                                        disabled={loading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                        {actionMessage.text && (
                            <div className={`inline-action-message ${actionMessage.type}`}>
                                {actionMessage.text}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="modal-tabs-section">
                    <ReservationTabs
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />
                </div>

                {/* Tab Content */}
                <div className="modal-content-area">
                    {activeTab === 'folio-operations' && (
                        <FolioOperations
                            reservation={reservation}
                            onTotalsChange={(newTotals) => setBalance(newTotals.remaining)}
                            onRefresh={onRefresh}
                        />
                    )}
                    {activeTab === 'booking-details' && (
                        <BookingDetails reservation={reservation} />
                    )}
                    {activeTab === 'guest-details' && (
                        <GuestDetails reservation={reservation} />
                    )}
                    {activeTab === 'room-charges' && (
                        <RoomCharges reservation={reservation} />
                    )}
                    {activeTab === 'audit-trail' && (
                        <AuditTrail reservation={reservation} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default EditReservationModal;
