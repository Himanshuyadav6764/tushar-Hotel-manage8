import { useState, useEffect } from 'react';
import API_URL, { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';

const AmendStayForm = ({ booking, onSubmit, onCancel }) => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [resolvedBookingStatus, setResolvedBookingStatus] = useState('');

    const normalizeStatusToken = (value = '') => String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const inHouseTokens = new Set(['INHOUSE', 'CHECKEDIN']);
    const statusCandidates = [
        booking?.status,
        booking?.bookingStatus,
        booking?.reservationStatus,
        resolvedBookingStatus
    ].map(normalizeStatusToken);
    const hasActiveCheckIn = Boolean(booking?.actualCheckIn) && !Boolean(booking?.actualCheckOut);
    const isInHouseBooking = statusCandidates.some((token) => inHouseTokens.has(token)) || hasActiveCheckIn;

    const formatDateForInput = (dateStr) => {
        if (!dateStr) return '';
        try { return new Date(dateStr).toISOString().split('T')[0]; } catch { return ''; }
    };

    const [formData, setFormData] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [availabilityWarning, setAvailabilityWarning] = useState('');
    const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiCall(`/api/reservations/${booking._id || booking.id}`);
                const result = await response.json();
                if (result.success) {
                    const data = result.data;
                    setResolvedBookingStatus(data?.status || '');
                    setFormData({
                        newCheckInDate: formatDateForInput(data.checkInDate),
                        newCheckInTime: data.checkInTime || '14:00',
                        newCheckOutDate: formatDateForInput(data.checkOutDate),
                        newCheckOutTime: data.checkOutTime || '11:00',
                        adults: data.adults || 1,
                        children: data.children || 0,
                        ratePerNight: data.ratePerNight || 0,
                        discount: data.discount || 0,
                        taxPercentage: data.taxPercentage || 12,
                        reason: '',
                        id: data._id
                    });
                    setSummary({
                        nights: data.nights || 0,
                        oldTotal: data.grandTotal || data.amount || 0,
                        newTotal: data.grandTotal || data.amount || 0,
                        tax: 0,
                        grandTotal: data.grandTotal || data.amount || 0,
                        difference: 0
                    });
                }
            } catch (err) {
                console.error('Fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [booking._id, booking.id]);

    useEffect(() => {
        if (!formData) return;
        const checkIn = new Date(`${formData.newCheckInDate}T${formData.newCheckInTime}`);
        const checkOut = new Date(`${formData.newCheckOutDate}T${formData.newCheckOutTime}`);

        if (!isNaN(checkIn) && !isNaN(checkOut)) {
            let diffDays = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) diffDays = 0;

            const roomRate = parseFloat(formData.ratePerNight) || 0;
            const discountAmount = Math.max(0, parseFloat(formData.discount) || 0);
            const taxPerc = parseFloat(formData.taxPercentage) || 0;
            const roomTotal = roomRate * diffDays;
            const taxAmount = Math.round((roomTotal * taxPerc) / 100);
            const newGrandTotal = roomTotal + taxAmount - discountAmount;
            const oldGrandTotal = booking.totalAmount || booking.grandTotal || 0;

            setSummary({
                nights: diffDays,
                oldTotal: oldGrandTotal,
                newTotal: roomTotal,
                tax: taxAmount,
                grandTotal: Math.max(0, newGrandTotal),
                difference: newGrandTotal - oldGrandTotal
            });
        }
    }, [formData, booking.totalAmount, booking.grandTotal]);

    useEffect(() => {
        if (!formData) return;

        const timer = setTimeout(async () => {
            const bookingId = booking?._id || booking?.id;
            if (!bookingId) return;

            const payload = isInHouseBooking
                ? {
                    newCheckOutTime: formData.newCheckOutTime,
                    reason: formData.reason || 'Checkout time extension',
                    validateOnly: true
                }
                : {
                    ...formData,
                    newGrandTotal: summary?.grandTotal,
                    nights: summary?.nights,
                    reason: formData.reason || 'Stay Amendment',
                    validateOnly: true
                };

            try {
                setIsCheckingAvailability(true);
                setAvailabilityWarning('');
                const response = await apiCall(`/api/reservations/amend/${bookingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (!response.ok) {
                    const warningMessage = result?.message || 'Already booked this time. Please pick another slot.';
                    setAvailabilityWarning(warningMessage);
                }
            } catch (err) {
                console.error('Availability validation failed:', err);
            } finally {
                setIsCheckingAvailability(false);
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [formData, summary, booking?._id, booking?.id, isInHouseBooking]);

    if (loading || !formData || !summary) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #E11D48', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontWeight: '600', color: '#64748B' }}>Fetching stay details...</span>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const validate = () => {
        const newErrors = {};
        if (!formData) return false;
        const checkIn = new Date(`${formData.newCheckInDate}T${formData.newCheckInTime || '14:00'}`);
        const checkOut = new Date(`${formData.newCheckOutDate}T${formData.newCheckOutTime || '11:00'}`);

        if (checkOut <= checkIn) newErrors.checkOutTime = 'Check-out must be after check-in';
        if (availabilityWarning) newErrors.checkOutTime = availabilityWarning;

        if (!isInHouseBooking) {
            if (formData.adults < 1) newErrors.adults = 'At least 1 adult required';
            if (summary.nights < 1) newErrors.nights = 'Stay must be at least 1 night';
            if (formData.ratePerNight <= 0) newErrors.ratePerNight = 'Rate must be greater than 0';
            if (parseFloat(formData.discount) < 0) newErrors.discount = 'Discount cannot be negative';
            const roomTotal = (parseFloat(formData.ratePerNight) || 0) * summary.nights;
            if (parseFloat(formData.discount) > roomTotal) newErrors.discount = 'Discount exceeds room total';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value)
        }));
        if (errors[name]) setErrors(prev => { const u = { ...prev }; delete u[name]; return u; });
    };

    const handleCounter = (field, change) => {
        setFormData(prev => ({
            ...prev,
            [field]: Math.max(field === 'adults' ? 1 : 0, (prev[field] || 0) + change)
        }));
    };

    const handleSaveClick = (e) => {
        e.preventDefault();
        if (validate()) setShowSummaryModal(true);
    };

    const handleFinalConfirm = async () => {
        setIsSubmitting(true);
        try {
            const payload = isInHouseBooking
                ? {
                    newCheckOutTime: formData.newCheckOutTime,
                    reason: formData.reason || 'Checkout time extension'
                }
                : {
                    ...formData,
                    newGrandTotal: summary.grandTotal,
                    nights: summary.nights,
                    reason: formData.reason || 'Stay Amendment'
                };

            await onSubmit({
                ...payload
            });
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
            setShowSummaryModal(false);
        }
    };

    const labelStyle = { fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px', display: 'block' };
    const boxStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px', transition: 'all 0.2s ease' };
    const errorStyle = { color: '#EF4444', fontSize: '11px', marginTop: '4px', fontWeight: '600' };

    return (
        <>
            <form onSubmit={handleSaveClick} className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#F8FAFC', color: '#1E293B', width: '100%', boxSizing: 'border-box' }}>
                <div className="flex-1 overflow-y-auto p-6" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '16px', paddingRight: '32px' }}>

                    {/* Guest Banner */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                        <div>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', display: 'block' }}>GUEST NAME</span>
                            <span style={{ fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>{booking.guestName}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', display: 'block' }}>REFERENCE</span>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B' }}>{booking.bookingId || booking.referenceNumber || 'N/A'}</span>
                        </div>
                    </div>

                    {isInHouseBooking ? (
                        <>
                            <div style={{ backgroundColor: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: '12px', padding: '10px 12px', fontSize: '12px', color: '#9A3412', fontWeight: 700 }}>
                                In-House amendment allows only check-out time extension. The system will block updates that clash with the next booking.
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={labelStyle}>Check-out Date</label>
                                    <input type="date" name="newCheckOutDate" value={formData.newCheckOutDate} disabled style={{ ...boxStyle, width: '100%', fontWeight: '700', backgroundColor: '#F8FAFC' }} />
                                </div>
                                <div>
                                    <label style={labelStyle}>New Check-out Time</label>
                                    <input type="time" name="newCheckOutTime" value={formData.newCheckOutTime} onChange={handleChange} style={{ ...boxStyle, width: '100%', fontWeight: '700', borderColor: errors.checkOutTime ? '#EF4444' : '#E2E8F0' }} />
                                    {errors.checkOutTime && <div style={errorStyle}>{errors.checkOutTime}</div>}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Date Section */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={labelStyle}>New Check-in Date</label>
                                    <input type="date" name="newCheckInDate" value={formData.newCheckInDate} onChange={handleChange} style={{ ...boxStyle, width: '100%', fontWeight: '700' }} />
                                </div>
                                <div>
                                    <label style={labelStyle}>New Check-out Date</label>
                                    <input type="date" name="newCheckOutDate" value={formData.newCheckOutDate} onChange={handleChange} style={{ ...boxStyle, width: '100%', fontWeight: '700', borderColor: errors.checkOutDate ? '#EF4444' : '#E2E8F0' }} />
                                    {errors.checkOutDate && <div style={errorStyle}>{errors.checkOutDate}</div>}
                                </div>
                            </div>

                            {/* Time Section */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={labelStyle}>Check-in Time</label>
                                    <input type="time" name="newCheckInTime" value={formData.newCheckInTime} onChange={handleChange} style={{ ...boxStyle, width: '100%', fontWeight: '700' }} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Check-out Time</label>
                                    <input type="time" name="newCheckOutTime" value={formData.newCheckOutTime} onChange={handleChange} style={{ ...boxStyle, width: '100%', fontWeight: '700', borderColor: errors.checkOutTime ? '#EF4444' : '#E2E8F0' }} />
                                    {errors.checkOutTime && <div style={errorStyle}>{errors.checkOutTime}</div>}
                                </div>
                            </div>
                        </>
                    )}

                    {(availabilityWarning || isCheckingAvailability) && (
                        <div style={{ backgroundColor: availabilityWarning ? '#FEF2F2' : '#EFF6FF', border: `1px solid ${availabilityWarning ? '#FCA5A5' : '#BFDBFE'}`, borderRadius: '12px', padding: '10px 12px', fontSize: '12px', color: availabilityWarning ? '#B91C1C' : '#1D4ED8', fontWeight: 700 }}>
                            {availabilityWarning || 'Checking room time availability...'}
                        </div>
                    )}

                    {!isInHouseBooking && (
                        <>
                            {/* Occupancy Section */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={labelStyle}>Adults</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ ...boxStyle, flex: 1, display: 'flex', justifyContent: 'center', fontWeight: '800' }}>{formData.adults}</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <button type="button" onClick={() => handleCounter('adults', 1)} style={{ ...boxStyle, padding: '4px 8px', lineHeight: 1, cursor: 'pointer' }}>+</button>
                                            <button type="button" onClick={() => handleCounter('adults', -1)} style={{ ...boxStyle, padding: '4px 8px', lineHeight: 1, cursor: 'pointer' }}>-</button>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label style={labelStyle}>Children</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ ...boxStyle, flex: 1, display: 'flex', justifyContent: 'center', fontWeight: '800' }}>{formData.children}</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <button type="button" onClick={() => handleCounter('children', 1)} style={{ ...boxStyle, padding: '4px 8px', lineHeight: 1, cursor: 'pointer' }}>+</button>
                                            <button type="button" onClick={() => handleCounter('children', -1)} style={{ ...boxStyle, padding: '4px 8px', lineHeight: 1, cursor: 'pointer' }}>-</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pricing Section */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={labelStyle}>Rate per Night ({cs})</label>
                                    <input type="number" name="ratePerNight" value={formData.ratePerNight} onChange={handleChange} min="0" style={{ ...boxStyle, width: '100%', fontWeight: '800', borderColor: errors.ratePerNight ? '#EF4444' : '#E2E8F0' }} />
                                    {errors.ratePerNight && <div style={errorStyle}>{errors.ratePerNight}</div>}
                                </div>
                                <div>
                                    <label style={labelStyle}>Discount ({cs})</label>
                                    <input type="number" name="discount" value={formData.discount} onChange={handleChange} min="0" style={{ ...boxStyle, width: '100%', fontWeight: '800', borderColor: errors.discount ? '#EF4444' : '#E2E8F0' }} />
                                    {errors.discount && <div style={errorStyle}>{errors.discount}</div>}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Reason for Amendment */}
                    <div>
                        <label style={labelStyle}>Reason for Amendment</label>
                        <textarea
                            name="reason"
                            value={formData.reason}
                            onChange={handleChange}
                            placeholder="e.g. Extended stay, date correction, rate change..."
                            rows={2}
                            style={{ ...boxStyle, width: '100%', fontWeight: '600', resize: 'none', fontSize: '13px' }}
                        />
                    </div>

                    {/* Summary Card */}
                    <div style={{ backgroundColor: '#1E293B', color: '#FFFFFF', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', opacity: 0.7 }}>
                            <span>Nights: {summary.nights}</span>
                            <span>Tax ({formData.taxPercentage}%): {cs}{summary.tax.toLocaleString()}</span>
                        </div>
                        {isInHouseBooking ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', opacity: 0.85 }}>
                                <span>Check-out</span>
                                <span style={{ fontWeight: 700 }}>{formData.newCheckOutDate} {formData.newCheckOutTime}</span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', opacity: 0.85 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Check-in</span>
                                    <span style={{ fontWeight: 700 }}>{formData.newCheckInDate} {formData.newCheckInTime}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Check-out</span>
                                    <span style={{ fontWeight: 700 }}>{formData.newCheckOutDate} {formData.newCheckOutTime}</span>
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                                <span style={{ fontSize: '11px', fontWeight: '800', opacity: 0.6, display: 'block' }}>OLD GRAND TOTAL</span>
                                <span style={{ fontSize: '16px', fontWeight: '700', textDecoration: 'line-through', opacity: 0.6 }}>{cs}{summary.oldTotal.toLocaleString()}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: '#FDA4AF', display: 'block' }}>NEW GRAND TOTAL</span>
                                <span style={{ fontSize: '24px', fontWeight: '900', color: '#FFFFFF' }}>{cs}{summary.grandTotal.toLocaleString()}</span>
                            </div>
                        </div>
                        <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', fontWeight: '700' }}>Balance Difference:</span>
                            <span style={{ fontSize: '14px', fontWeight: '900', color: summary.difference >= 0 ? '#4ADE80' : '#F87171' }}>
                                {summary.difference >= 0 ? '+' : ''}{cs}{Math.abs(summary.difference).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div style={{ padding: '20px 32px 20px 16px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '12px' }}>
                    <button type="button" onClick={onCancel} style={{ flex: 1, padding: '14px', backgroundColor: '#F1F5F9', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#64748B', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={isSubmitting} style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer', boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)' }}>
                        Review & Save
                    </button>
                </div>
            </form>

            {/* Confirmation Modal */}
            {showSummaryModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
                    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', width: '100%', maxWidth: '400px', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: '#1E293B' }}>Confirm Amendment</h3>
                        <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '24px' }}>Review the stay changes before saving.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#94A3B8' }}>Stay Duration</span>
                                <span style={{ fontSize: '13px', fontWeight: '800' }}>{booking.numberOfNights || booking.nights || '—'} → {summary.nights} Nights</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#94A3B8' }}>Grand Total</span>
                                <span style={{ fontSize: '13px', fontWeight: '800' }}>{cs}{summary.oldTotal.toLocaleString()} → {cs}{summary.grandTotal.toLocaleString()}</span>
                            </div>
                            {formData.reason && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#94A3B8' }}>Reason</span>
                                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569', maxWidth: '180px', textAlign: 'right' }}>{formData.reason}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', fontWeight: '800', color: '#1E293B' }}>Net Difference</span>
                                <span style={{ fontSize: '18px', fontWeight: '900', color: summary.difference >= 0 ? '#10B981' : '#EF4444' }}>
                                    {summary.difference >= 0 ? '+' : ''}{cs}{Math.abs(summary.difference).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button type="button" onClick={() => setShowSummaryModal(false)} style={{ flex: 1, padding: '14px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#64748B', cursor: 'pointer' }}>Go Back</button>
                            <button type="button" onClick={handleFinalConfirm} disabled={isSubmitting} style={{ flex: 1, padding: '14px', backgroundColor: '#1E293B', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer' }}>
                                {isSubmitting ? 'Saving...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AmendStayForm;


