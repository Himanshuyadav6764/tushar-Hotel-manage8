import React, { useState, useEffect } from 'react';
import API_URL, { apiCall } from '../config/api';
import './NewFolio.css';

const NewFolio = ({ onClose, onSave, reservation }) => {
    const [formData, setFormData] = useState({
        phone: '',
        customer: '',
        rooms: reservation?.roomNumber || '',
        registrationNo: ''
    });

    const [guests, setGuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch guests from current reservation
    useEffect(() => {
        if (reservation) {
            const sharersList = [];

            // Add primary guest
            sharersList.push({
                id: reservation.guestId || reservation.id || 'primary',
                name: reservation.guestName,
                phone: reservation.guestPhone || reservation.mobileNumber || ''
            });

            // Add additional guests (sharers)
            if (reservation.additionalGuests && reservation.additionalGuests.length > 0) {
                reservation.additionalGuests.forEach((guest, index) => {
                    sharersList.push({
                        id: guest._id || `guest-${index}`,
                        name: guest.name,
                        phone: guest.mobileNumber || guest.phone || ''
                    });
                });
            }

            setGuests(sharersList);
            setLoading(false);
        } else {
            fetchGuests();
        }
    }, [reservation]);

    const fetchGuests = async () => {
        try {
            setLoading(true);
            const response = await apiCall(`/api/bookings/list`);
            const data = await response.json();

            if (data.success && data.data) {
                // Extract unique guests
                const uniqueGuests = [];
                const guestMap = new Map();

                data.data.forEach(booking => {
                    const key = `${booking.guestName}-${booking.mobileNumber}`;
                    if (!guestMap.has(key)) {
                        guestMap.set(key, {
                            id: booking._id,
                            name: booking.guestName,
                            phone: booking.mobileNumber,
                            roomNumber: booking.roomNumber
                        });
                        uniqueGuests.push(guestMap.get(key));
                    }
                });

                setGuests(uniqueGuests);
            }
        } catch (error) {
            console.error('Error fetching guests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSave(formData);
            setTimeout(() => onClose(), 500);
        } catch (error) {
            console.error('Error saving folio:', error);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="add-payment-overlay" onClick={onClose}>
            <div className="add-payment-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="premium-payment-header">
                    <div className="header-icon-wrap">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 4v16m8-8H4"></path></svg>
                    </div>
                    <div className="header-text">
                        <h3>New Folio</h3>
                        <span>Create additional folio for this room</span>
                    </div>
                    <button className="premium-close-btn" onClick={onClose}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="add-payment-body">
                    {/* Reservation Context Card */}
                    {reservation && (
                        <div className="payment-summary-card">
                            <div className="summary-header">
                                <span className="ref-tag">PARENT BOOKING</span>
                                <span className="ref-number">{reservation.bookingId || 'BKG-552'}</span>
                            </div>
                            <div className="summary-details">
                                <div className="detail-col">
                                    <label>Primary Guest</label>
                                    <p className="truncate-text">{reservation.guestName}</p>
                                </div>
                                <div className="detail-col-group">
                                    <div className="detail-sub-col">
                                        <label>Room No</label>
                                        <p>{reservation.roomNumber}</p>
                                    </div>
                                    <div className="detail-sub-col text-right">
                                        <label>Status</label>
                                        <p style={{color:'#10b981', fontWeight:800}}>ACTIVE</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="payment-field-group">
                            <label className="field-label-premium">Assign Sharer (Guest)</label>
                            <div className="modern-select-wrapper">
                                <select
                                    value={formData.customer}
                                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                                    className="premium-dropdown-select"
                                    disabled={loading}
                                    required
                                >
                                    <option value="">
                                        {loading ? 'Loading guests...' : 'Select a customer'}
                                    </option>
                                    {guests.map((guest) => (
                                        <option key={guest.id} value={guest.id}>
                                            {guest.name} {guest.phone ? `(${guest.phone})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <div className="select-arrow">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                            </div>
                        </div>

                        <div className="payment-field-group">
                            <label className="field-label-premium">Target Room(s)</label>
                            <input
                                type="text"
                                value={formData.rooms}
                                onChange={(e) => setFormData({ ...formData, rooms: e.target.value })}
                                placeholder="e.g. 101, 102"
                                required
                            />
                        </div>

                        <div className="payment-field-group">
                            <label className="field-label-premium">Registration Number</label>
                            <input
                                type="text"
                                value={formData.registrationNo}
                                onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                                placeholder="Enter GRN or local registration ID"
                            />
                        </div>
                    </form>
                </div>

                <div className="payment-modal-footer">
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <div className="spinner-small" /> : 'Create Folio'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewFolio;

