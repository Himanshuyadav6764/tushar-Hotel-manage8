import { useState, useEffect, useMemo } from 'react';
import API_URL, { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';

const RoomMoveForm = ({ booking: initialBooking, onSubmit, onCancel }) => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();

    const [booking, setBooking] = useState(initialBooking);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fetchError, setFetchError] = useState(null);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        newRoomId: '',
        newRoomNumber: '',
        newRoomPrice: 0,
        reason: '',
        moveEffectiveDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const resResponse = await apiCall(`/api/reservations/${initialBooking._id || initialBooking.id}`);
                const resResult = await resResponse.json();

                if (resResult.success) {
                    setBooking(resResult.data);
                    const roomsResponse = await apiCall(`/api/rooms/list?status=Available`);
                    const roomsResult = await roomsResponse.json();

                    if (roomsResult.success && roomsResult.data?.length > 0) {
                        const filtered = roomsResult.data
                            .filter(r => r.roomNumber !== resResult.data.roomNumber && r._id && r.roomNumber && r.price)
                            .map(r => ({ ...r, _id: r._id.toString() }));
                        setAvailableRooms(filtered);
                    } else {
                        setAvailableRooms([]);
                    }
                } else {
                    throw new Error(resResult.message || 'Failed to fetch reservation');
                }
            } catch (err) {
                setFetchError(err.message || 'Failed to load room data');
                setAvailableRooms([]);
            } finally {
                setLoading(false);
            }
        };
        if (initialBooking?._id || initialBooking?.id) loadData();
    }, [initialBooking]);

    const adjustment = useMemo(() => {
        if (!formData.newRoomId || !booking) return { total: 0, diff: 0, nights: 0 };
        const oldPrice = booking.ratePerNight || 0;
        const newPrice = formData.newRoomPrice || 0;
        const diff = newPrice - oldPrice;
        const checkOutDate = new Date(booking.checkOutDate);
        const moveDate = new Date(formData.moveEffectiveDate);
        moveDate.setHours(0, 0, 0, 0);
        checkOutDate.setHours(0, 0, 0, 0);
        const remainingNights = Math.max(0, Math.ceil((checkOutDate - moveDate) / (1000 * 60 * 60 * 24)));
        return { diff, nights: remainingNights, total: diff * remainingNights };
    }, [formData.newRoomId, formData.newRoomPrice, formData.moveEffectiveDate, booking]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'newRoomId') {
            const selectedRoom = availableRooms.find(r => r._id === value);
            setFormData(prev => ({
                ...prev,
                newRoomId: value,
                newRoomNumber: selectedRoom?.roomNumber || '',
                newRoomPrice: selectedRoom?.price || 0
            }));
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

        const selectedRoom = availableRooms.find(r => r._id === formData.newRoomId);
        if (formData.newRoomId && !selectedRoom) newErrors.newRoomId = 'Selected room is no longer available';

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        setIsSubmitting(true);
        try {
            await onSubmit({
                newRoomId: formData.newRoomId,
                newRoomNumber: formData.newRoomNumber,
                reason: formData.reason,
                effectiveDate: formData.moveEffectiveDate
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
                <span style={{ fontWeight: '600', color: '#64748B' }}>Fetching room details...</span>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ color: '#EF4444', fontWeight: '600', marginBottom: '16px' }}>{fetchError}</p>
                <button onClick={onCancel} style={{ color: '#64748B', textDecoration: 'underline', border: 'none', background: 'none', cursor: 'pointer' }}>Close</button>
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
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>{booking.guestName}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', display: 'block' }}>ROOM</span>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>{booking.roomNumber}</span>
                    </div>
                </div>

                {/* Current Room Card */}
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', display: 'block', marginBottom: '12px' }}>CURRENT ROOM</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                            <span style={{ color: '#64748B' }}>Category</span>
                            <span style={{ fontWeight: '700' }}>{booking.roomType || 'Standard'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                            <span style={{ color: '#64748B' }}>Rate per Night</span>
                            <span style={{ fontWeight: '700' }}>{cs}{(booking.ratePerNight || 0).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                            <span style={{ color: '#64748B' }}>Stay</span>
                            <span style={{ fontWeight: '600' }}>
                                {new Date(booking.checkInDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – {new Date(booking.checkOutDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Select New Room */}
                <div>
                    <label style={labelStyle}>Move Guest To</label>
                    {availableRooms.length === 0 ? (
                        <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', color: '#991B1B', fontSize: '13px', fontWeight: '600' }}>
                            No available rooms found. Try again later.
                        </div>
                    ) : (
                        <select name="newRoomId" value={formData.newRoomId} onChange={handleChange} style={{ ...boxStyle, width: '100%', fontWeight: '700', appearance: 'none', cursor: 'pointer', borderColor: errors.newRoomId ? '#EF4444' : '#E2E8F0' }}>
                            <option value="">Select New Room</option>
                            {availableRooms.map(room => (
                                <option key={room._id} value={room._id}>
                                    Room {room.roomNumber} – {room.roomType} ({cs}{room.price})
                                </option>
                            ))}
                        </select>
                    )}
                    {errors.newRoomId && <div style={errorStyle}>{errors.newRoomId}</div>}
                </div>

                {/* Rate Difference */}
                {formData.newRoomId && adjustment.total !== 0 && (
                    <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: adjustment.total > 0 ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${adjustment.total > 0 ? '#FEE2E2' : '#DCFCE7'}`, fontSize: '13px', color: adjustment.total > 0 ? '#991B1B' : '#166534', fontWeight: '600' }}>
                        {adjustment.total > 0 ? '⚠️' : '✅'} {cs}{Math.abs(adjustment.diff)}/{adjustment.diff > 0 ? 'more' : 'less'} per night.
                        Total <strong>{cs}{Math.abs(adjustment.total).toLocaleString()}</strong> will be {adjustment.total > 0 ? 'charged' : 'reduced'} for {adjustment.nights} remaining nights.
                    </div>
                )}

                {/* Reason */}
                <div>
                    <label style={labelStyle}>Reason for Room Move *</label>
                    <textarea name="reason" value={formData.reason} onChange={handleChange} placeholder="e.g. AC Repair, Guest Request..." rows={3} style={{ ...boxStyle, width: '100%', fontWeight: '600', resize: 'none', fontSize: '13px', borderColor: errors.reason ? '#EF4444' : '#E2E8F0' }} />
                    {errors.reason && <div style={errorStyle}>{errors.reason}</div>}
                </div>

                {/* Effective Date */}
                <div>
                    <label style={labelStyle}>Effective From</label>
                    <input type="date" name="moveEffectiveDate" value={formData.moveEffectiveDate} onChange={handleChange} style={{ ...boxStyle, width: '100%', fontWeight: '700' }} />
                </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 32px 20px 16px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '12px' }}>
                <button type="button" onClick={onCancel} style={{ flex: 1, padding: '14px', backgroundColor: '#F1F5F9', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#64748B', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting || !formData.newRoomId} style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer', opacity: (!formData.newRoomId || isSubmitting) ? 0.5 : 1, boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)' }}>
                    {isSubmitting ? 'Processing...' : 'Confirm Room Move'}
                </button>
            </div>
        </form>
    );
};

export default RoomMoveForm;
