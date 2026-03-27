import { useState, useEffect, useMemo } from 'react';
import API_URL, { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';

const ExchangeRoomForm = ({ booking: initialBooking, onSubmit, onCancel }) => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();

    const [reservation, setReservation] = useState(null);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        targetCategory: '',
        newRoomId: '',
        reason: '',
        effectiveDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const resResponse = await apiCall(`/api/reservations/${initialBooking._id || initialBooking.id}`);
                const resResult = await resResponse.json();
                if (resResult.success) {
                    setReservation(resResult.data);
                    const roomsResponse = await apiCall(`/api/rooms/available?from=${resResult.data.checkInDate}&to=${resResult.data.checkOutDate}`);
                    const roomsResult = await roomsResponse.json();
                    setAvailableRooms(roomsResult.data || []);
                }
            } catch (err) {
                console.error('Error fetching data:', err);
            } finally {
                setLoading(false);
            }
        };
        if (initialBooking?._id || initialBooking?.id) fetchData();
    }, [initialBooking]);

    const categories = useMemo(() => {
        return [...new Set(availableRooms.map(r => r.roomType))].sort();
    }, [availableRooms]);

    const filteredRooms = formData.targetCategory
        ? availableRooms.filter(r => r.roomType === formData.targetCategory)
        : [];

    const selectedRoom = availableRooms.find(r => r._id === formData.newRoomId);

    const adjustment = useMemo(() => {
        if (!formData.newRoomId || !reservation) return { total: 0, diff: 0, nights: 0, newPrice: 0 };
        const oldPrice = reservation.ratePerNight || 0;
        const newPrice = selectedRoom?.price || 0;
        const diff = newPrice - oldPrice;
        const checkOut = new Date(reservation.checkOutDate);
        const effective = new Date(formData.effectiveDate);
        effective.setHours(0, 0, 0, 0);
        checkOut.setHours(0, 0, 0, 0);
        const remainingNights = Math.max(0, Math.ceil((checkOut - effective) / (1000 * 60 * 60 * 24)));
        return { diff, nights: remainingNights, total: diff * remainingNights, newPrice };
    }, [formData.newRoomId, formData.effectiveDate, reservation, selectedRoom]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'targetCategory') {
            setFormData(prev => ({ ...prev, targetCategory: value, newRoomId: '' }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        if (errors[name]) setErrors(prev => { const u = { ...prev }; delete u[name]; return u; });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newErrors = {};
        if (!formData.newRoomId) newErrors.newRoomId = 'Please select a room';
        if (!formData.reason.trim()) newErrors.reason = 'Reason is required';

        const effective = new Date(formData.effectiveDate);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (effective < today) newErrors.effectiveDate = 'Cannot be in the past';
        if (reservation && effective > new Date(reservation.checkOutDate)) newErrors.effectiveDate = 'Cannot be after checkout';
        if (selectedRoom?.roomNumber === reservation?.roomNumber) newErrors.newRoomId = 'Cannot exchange to same room';

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        setIsSubmitting(true);
        try {
            await onSubmit({
                newRoomId: formData.newRoomId,
                newRoomNumber: selectedRoom?.roomNumber,
                reason: formData.reason,
                effectiveDate: formData.effectiveDate
            });
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #E11D48', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontWeight: '600', color: '#64748B' }}>Loading exchange details...</span>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!reservation) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ color: '#EF4444', fontWeight: '600' }}>Stay record not found</p>
            </div>
        );
    }

    const labelStyle = { fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px', display: 'block' };
    const boxStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px' };
    const errorStyle = { color: '#EF4444', fontSize: '11px', marginTop: '4px', fontWeight: '600' };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#F8FAFC', color: '#1E293B', width: '100%', boxSizing: 'border-box' }}>
            <div className="flex-1 overflow-y-auto p-6" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '16px', paddingRight: '32px' }}>

                {/* Guest Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', display: 'block' }}>GUEST</span>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>{reservation.guestName}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', display: 'block' }}>CURRENT ROOM</span>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>{reservation.roomNumber} · {reservation.roomType || 'Standard'}</span>
                    </div>
                </div>

                {/* Current Room Info */}
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', display: 'block', marginBottom: '12px' }}>CURRENT RATE</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ color: '#64748B' }}>Rate per Night</span>
                        <span style={{ fontWeight: '800', fontSize: '16px' }}>{cs}{(reservation.ratePerNight || 0).toLocaleString()}</span>
                    </div>
                </div>

                {/* Category Selector */}
                <div>
                    <label style={labelStyle}>Room Category</label>
                    <select name="targetCategory" value={formData.targetCategory} onChange={handleChange} style={{ ...boxStyle, width: '100%', fontWeight: '700', appearance: 'none', cursor: 'pointer' }}>
                        <option value="">Select Category</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>

                {/* Room Selector */}
                {formData.targetCategory && (
                    <div>
                        <label style={labelStyle}>Select Room</label>
                        {filteredRooms.length === 0 ? (
                            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', color: '#991B1B', fontSize: '13px', fontWeight: '600' }}>
                                No rooms available in this category.
                            </div>
                        ) : (
                            <select name="newRoomId" value={formData.newRoomId} onChange={handleChange} style={{ ...boxStyle, width: '100%', fontWeight: '700', appearance: 'none', cursor: 'pointer', borderColor: errors.newRoomId ? '#EF4444' : '#E2E8F0' }}>
                                <option value="">Select Room</option>
                                {filteredRooms.map(room => (
                                    <option key={room._id} value={room._id}>
                                        Room {room.roomNumber} – {cs}{room.price}/night
                                    </option>
                                ))}
                            </select>
                        )}
                        {errors.newRoomId && <div style={errorStyle}>{errors.newRoomId}</div>}
                    </div>
                )}

                {/* New Rate Display */}
                {selectedRoom && (
                    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', display: 'block', marginBottom: '12px' }}>NEW RATE</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                            <span style={{ color: '#64748B' }}>Room {selectedRoom.roomNumber} – {selectedRoom.roomType}</span>
                            <span style={{ fontWeight: '800', fontSize: '16px' }}>{cs}{(selectedRoom.price || 0).toLocaleString()}</span>
                        </div>
                    </div>
                )}

                {/* Rate Difference */}
                {formData.newRoomId && adjustment.total !== 0 && (
                    <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: adjustment.total > 0 ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${adjustment.total > 0 ? '#FEE2E2' : '#DCFCE7'}`, fontSize: '13px', color: adjustment.total > 0 ? '#991B1B' : '#166534', fontWeight: '600' }}>
                        {adjustment.total > 0 ? '⚠️ Upgrade:' : '✅ Downgrade:'} {cs}{Math.abs(adjustment.diff)}/{adjustment.diff > 0 ? 'more' : 'less'} per night.
                        Total <strong>{cs}{Math.abs(adjustment.total).toLocaleString()}</strong> will be {adjustment.total > 0 ? 'added' : 'reduced'} for {adjustment.nights} nights.
                    </div>
                )}

                {/* Reason */}
                <div>
                    <label style={labelStyle}>Reason for Exchange *</label>
                    <textarea name="reason" value={formData.reason} onChange={handleChange} placeholder="e.g. Guest upgrade, maintenance, category swap..." rows={2} style={{ ...boxStyle, width: '100%', fontWeight: '600', resize: 'none', fontSize: '13px', borderColor: errors.reason ? '#EF4444' : '#E2E8F0' }} />
                    {errors.reason && <div style={errorStyle}>{errors.reason}</div>}
                </div>

                {/* Effective Date */}
                <div>
                    <label style={labelStyle}>Effective Date</label>
                    <input type="date" name="effectiveDate" value={formData.effectiveDate} onChange={handleChange} style={{ ...boxStyle, width: '100%', fontWeight: '700', borderColor: errors.effectiveDate ? '#EF4444' : '#E2E8F0' }} />
                    {errors.effectiveDate && <div style={errorStyle}>{errors.effectiveDate}</div>}
                </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 32px 20px 16px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '12px' }}>
                <button type="button" onClick={onCancel} style={{ flex: 1, padding: '14px', backgroundColor: '#F1F5F9', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#64748B', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting || !formData.newRoomId} style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer', opacity: (!formData.newRoomId || isSubmitting) ? 0.5 : 1, boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)' }}>
                    {isSubmitting ? 'Processing...' : 'Confirm Exchange'}
                </button>
            </div>
        </form>
    );
};

export default ExchangeRoomForm;
