import React, { useState } from 'react';
import './ReservationModal.css';
import API_URL_CONFIG from '../config/api';
import { useSettings } from '../context/SettingsContext';

const ReservationModal = ({ table, onClose, onReserve }) => {
    const {
        getCurrencySymbol,
        getCurrentDateISO,
        getCurrentTime24,
        toTime24,
        timeToMinutes,
        isPastDateTime
    } = useSettings();
    const cs = getCurrencySymbol();

    const addMinutesToTime = (time, minutesToAdd) => {
        const normalized = toTime24(time);
        const baseMinutes = timeToMinutes(normalized);
        if (baseMinutes === null) return normalized;

        const total = baseMinutes + minutesToAdd;
        const h = Math.floor((total / 60) % 24);
        const m = total % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const [formData, setFormData] = useState(() => {
        const nowTime = getCurrentTime24();
        return {
            guestName: '',
            guestPhone: '',
            date: getCurrentDateISO(),
            startTime: nowTime,
            endTime: addMinutesToTime(nowTime, 60),
            guests: 4,
            note: '',
            source: 'Phone',
            advancePayment: 0
        };
    });
    const [errors, setErrors] = useState({});

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const next = { ...prev, [name]: value };

            if (name === 'startTime') {
                const normalizedStart = toTime24(value);
                next.startTime = normalizedStart;

                const startTotal = timeToMinutes(normalizedStart);
                const endTotal = timeToMinutes(next.endTime);
                if (startTotal !== null && (endTotal === null || endTotal <= startTotal)) {
                    next.endTime = addMinutesToTime(normalizedStart, 60);
                }
            }

            if (name === 'endTime') {
                next.endTime = toTime24(value);
            }

            if (name === 'date') {
                const todayStr = getCurrentDateISO();
                if (value === todayStr) {
                    const nowTime = getCurrentTime24();
                    const nowTotal = timeToMinutes(nowTime) ?? 0;
                    const startTotal = timeToMinutes(next.startTime) ?? 0;
                    if (startTotal < nowTotal) {
                        next.startTime = nowTime;
                        const endTotal = timeToMinutes(next.endTime);
                        if (endTotal === null || endTotal <= nowTotal) {
                            next.endTime = addMinutesToTime(nowTime, 60);
                        }
                    }
                }
            }

            return next;
        });

        setErrors({ ...errors, [name]: '' });
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.guestName) newErrors.guestName = 'Name is required';
        if (!formData.guestPhone || formData.guestPhone.length !== 10) newErrors.guestPhone = 'Must be 10 digits';
        if (!formData.date) newErrors.date = 'Date is required';
        if (!formData.startTime) newErrors.startTime = 'Start time required';
        if (!formData.endTime) newErrors.endTime = 'End time required';
        if (!formData.guests || formData.guests < 1) newErrors.guests = 'Min 1 guest';
        if (formData.guests > table.seats) newErrors.guests = `Max ${table.seats} guests`;

        // Time Logic
        const normalizedStart = toTime24(formData.startTime);
        const normalizedEnd = toTime24(formData.endTime);
        const startTotal = timeToMinutes(normalizedStart);
        const endTotal = timeToMinutes(normalizedEnd);

        if (startTotal === null) newErrors.startTime = 'Invalid start time';
        if (endTotal === null) newErrors.endTime = 'Invalid end time';
        if (startTotal !== null && endTotal !== null) {
            if (endTotal <= startTotal) newErrors.endTime = 'End time must be after start';
            if (endTotal - startTotal < 15) newErrors.endTime = 'Min duration 15 mins';
        }

        if (formData.date < getCurrentDateISO()) {
            newErrors.date = 'Cannot reserve in past date';
        }

        if (!newErrors.startTime && isPastDateTime(formData.date, normalizedStart)) {
            newErrors.startTime = 'Cannot reserve in past';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (validate()) {
            onReserve(formData);
        }
    };

    return (
        <div className="add-payment-overlay" onClick={onClose}>
            <div className="add-payment-modal reserve-table-premium" onClick={(e) => e.stopPropagation()} style={{ width: '480px' }}>
                {/* Modern Premium Header */}
                <div className="premium-payment-header">
                    <div className="header-icon-wrap">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    <div className="header-text">
                        <h3>Reserve Table - {table.name}</h3>
                        <span>RESERVATION DETAILS</span>
                    </div>
                    <button className="premium-close-btn" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="add-payment-body">
                    {/* Guest Phone Field */}
                    <div className="payment-field-group">
                        <label className="field-label-premium">GUEST MOBILE NUMBER <span className="req-star">*</span></label>
                        <div className="input-with-icon-premium">
                            <span className="field-icon">📱</span>
                            <input
                                type="text"
                                name="guestPhone"
                                value={formData.guestPhone}
                                onChange={handleInputChange}
                                placeholder="Enter 10 digit number"
                                maxLength="10"
                                className="premium-input-field"
                                style={errors.guestPhone ? { borderColor: '#d41424' } : {}}
                            />
                        </div>
                        {errors.guestPhone && <span className="error-text-premium">{errors.guestPhone}</span>}
                    </div>

                    {/* Guest Name Field */}
                    <div className="payment-field-group">
                        <label className="field-label-premium">GUEST NAME <span className="req-star">*</span></label>
                        <div className="input-with-icon-premium">
                            <span className="field-icon">👤</span>
                            <input
                                type="text"
                                name="guestName"
                                value={formData.guestName}
                                onChange={handleInputChange}
                                placeholder="Enter Guest Name"
                                className="premium-input-field"
                                style={errors.guestName ? { borderColor: '#d41424' } : {}}
                            />
                        </div>
                        {errors.guestName && <span className="error-text-premium">{errors.guestName}</span>}
                    </div>

                    <div className="payment-row-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {/* Date */}
                        <div className="payment-field-group" style={{ marginBottom: 0 }}>
                            <label className="field-label-premium">DATE <span className="req-star">*</span></label>
                            <div className="input-with-icon-premium">
                                <span className="field-icon">📅</span>
                                <input
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleInputChange}
                                    min={getCurrentDateISO()}
                                    className="premium-input-field"
                                    style={errors.date ? { borderColor: '#d41424' } : {}}
                                />
                            </div>
                            {errors.date && <span className="error-text-premium">{errors.date}</span>}
                        </div>

                        {/* Session */}
                        <div className="payment-field-group" style={{ marginBottom: 0 }}>
                            <label className="field-label-premium">TIME (SESSION) <span className="req-star">*</span></label>
                            <div className="premium-time-range" style={errors.startTime || errors.endTime ? { borderColor: '#d41424' } : {}}>
                                <input
                                    type="time"
                                    name="startTime"
                                    value={formData.startTime}
                                    onChange={handleInputChange}
                                    className="time-input"
                                />
                                <span className="time-sep">-</span>
                                <input
                                    type="time"
                                    name="endTime"
                                    value={formData.endTime}
                                    onChange={handleInputChange}
                                    className="time-input"
                                />
                            </div>
                            {errors.startTime && <span className="error-text-premium">{errors.startTime}</span>}
                            {errors.endTime && <span className="error-text-premium">{errors.endTime}</span>}
                        </div>
                    </div>

                    <div className="payment-row-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px' }}>
                        {/* Guests Count */}
                        <div className="payment-field-group" style={{ marginBottom: 0 }}>
                            <label className="field-label-premium">GUESTS COUNT <span className="req-star">*</span></label>
                            <div className="input-with-icon-premium">
                                <span className="field-icon">👥</span>
                                <input
                                    type="number"
                                    name="guests"
                                    value={formData.guests}
                                    onChange={(e) => {
                                        let val = e.target.value;
                                        setFormData({ ...formData, guests: val !== '' ? Number(val) : '' });
                                        setErrors({ ...errors, [e.target.name]: '' });
                                    }}
                                    onKeyDown={(e) => {
                                        if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                                            e.preventDefault();
                                        }
                                    }}
                                    min="1"
                                    max={table.seats}
                                    className="premium-input-field"
                                    style={errors.guests ? { borderColor: '#d41424' } : {}}
                                />
                            </div>
                            {errors.guests && <span className="error-text-premium">{errors.guests}</span>}
                        </div>

                        {/* Source */}
                        <div className="payment-field-group" style={{ marginBottom: 0 }}>
                            <label className="field-label-premium">RESERVATION SOURCE</label>
                            <div className="input-with-icon-premium">
                                <span className="field-icon">🛎️</span>
                                <select
                                    name="source"
                                    value={formData.source}
                                    onChange={handleInputChange}
                                    className="premium-input-field"
                                    style={{
                                        appearance: 'none',
                                        background: 'transparent url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E") no-repeat right 0px center',
                                        backgroundSize: '16px',
                                        paddingRight: '16px'
                                    }}
                                >
                                    <option value="Phone">Phone Number</option>
                                    <option value="Walk-In">Walk In</option>
                                    <option value="Online">Online</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="payment-field-group" style={{ marginTop: '20px' }}>
                        <label className="field-label-premium">SPECIAL NOTE</label>
                        <div className="input-with-icon-premium">
                            <span className="field-icon">📝</span>
                            <input
                                type="text"
                                name="note"
                                value={formData.note}
                                onChange={handleInputChange}
                                placeholder="e.g. Birthday, Anniversary..."
                                className="premium-input-field"
                            />
                        </div>
                    </div>

                    <div className="payment-field-group">
                        <label className="field-label-premium">ADVANCE PAYMENT</label>
                        <div className="input-with-icon-premium">
                            <span className="field-icon" style={{ color: '#059669', background: '#ecfdf5' }}>{cs}</span>
                            <input
                                type="number"
                                name="advancePayment"
                                value={formData.advancePayment}
                                onChange={(e) => {
                                    let val = e.target.value;
                                    setFormData({ ...formData, advancePayment: val !== '' ? Number(val) : '' });
                                    setErrors({ ...errors, [e.target.name]: '' });
                                }}
                                onKeyDown={(e) => {
                                    if (['-', '+', 'e', 'E'].includes(e.key)) {
                                        e.preventDefault();
                                    }
                                }}
                                placeholder="0.00"
                                className="premium-input-field has-value"
                                style={{ border: '1.5px solid #10b981' }}
                            />
                        </div>
                        <p className="hint-text-premium">* Enter the advance amount collected from the guest.</p>
                    </div>

                    <div className="payment-modal-footer">
                        <button className="btn-secondary" onClick={onClose}>CANCEL</button>
                        <button className="btn-primary" onClick={handleSubmit}>
                            <span>RESERVE TABLE</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default ReservationModal;
