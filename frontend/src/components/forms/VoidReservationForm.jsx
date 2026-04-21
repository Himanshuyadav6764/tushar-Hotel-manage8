import { useState } from 'react';

const VoidReservationForm = ({ booking, onSubmit, onCancel }) => {
    const [reason, setReason] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const handleSubmit = async () => {
        const newErrors = {};
        if (!reason.trim()) newErrors.reason = 'Please provide a reason for voiding this reservation.';
        if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
        setErrors({});
        setIsLoading(true);
        try {
            await onSubmit({ reason });
        } catch {
            setIsLoading(false);
        }
    };

    const labelStyle = { fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px', display: 'block' };
    const boxStyle = { width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
    const errorStyle = { margin: '4px 0 0 0', color: '#d41424', fontSize: '12px', fontWeight: '600' };

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#F8FAFC', color: '#1E293B', width: '100%', boxSizing: 'border-box' }}>
            <div className="flex-1 overflow-y-auto p-6" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '16px', paddingRight: '32px' }}>

                {/* Guest Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', display: 'block' }}>GUEST</span>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>{booking.guestName}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', display: 'block' }}>ROOM</span>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>{booking.roomNumber || 'N/A'}</span>
                    </div>
                </div>

                {/* Reservation Details */}
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0' }}>
                    <span style={{ ...labelStyle, marginBottom: '12px' }}>RESERVATION DETAILS</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                        <div>
                            <span style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', display: 'block' }}>RESERVATION ID</span>
                            <span style={{ fontWeight: '700', fontFamily: 'monospace' }}>{booking.reservationId || booking.referenceId || 'N/A'}</span>
                        </div>
                        <div>
                            <span style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', display: 'block' }}>ARRIVAL DATE</span>
                            <span style={{ fontWeight: '700' }}>{new Date(booking.checkInDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div>
                            <span style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', display: 'block' }}>STATUS</span>
                            <span style={{ fontWeight: '700', color: '#3B82F6' }}>{booking.status}</span>
                        </div>
                    </div>
                </div>

                {/* Warning */}
                <div style={{ padding: '14px 16px', borderRadius: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', color: '#b40f1d', fontSize: '13px', fontWeight: '600', lineHeight: '1.5' }}>
                    ⚠️ This action will permanently mark this reservation as <strong>VOID</strong> and release the room. All financial records will be zeroed out. This cannot be undone.
                </div>

                {/* Reason */}
                <div>
                    <span style={labelStyle}>REASON FOR VOIDING <span style={{ color: '#d41424' }}>*</span></span>
                    <textarea
                        value={reason}
                        onChange={(e) => { setReason(e.target.value); if (errors.reason) setErrors({}); }}
                        placeholder="e.g. Duplicate booking, Test entry, Guest requested cancellation..."
                        rows={4}
                        style={{ ...boxStyle, border: errors.reason ? '2px solid #d41424' : '1px solid #E2E8F0', resize: 'vertical' }}
                    />
                    {errors.reason && <p style={errorStyle}>{errors.reason}</p>}
                </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 32px 20px 16px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '12px' }}>
                <button type="button" onClick={onCancel} disabled={isLoading} style={{ flex: 1, padding: '14px', backgroundColor: '#F1F5F9', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#64748B', cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={handleSubmit} disabled={isLoading} style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #d41424, #b40f1d)', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer', opacity: isLoading ? 0.5 : 1, boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)' }}>
                    {isLoading ? 'Processing...' : 'Void Reservation'}
                </button>
            </div>
        </div>
    );
};

export default VoidReservationForm;
