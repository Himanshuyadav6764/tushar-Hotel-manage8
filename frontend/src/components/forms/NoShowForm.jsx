import { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';

const NoShowForm = ({ booking, onSubmit, onCancel }) => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [applyCharge, setApplyCharge] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const chargeAmount = booking.ratePerNight || booking.pricePerNight || (booking.totalAmount / (booking.nights || booking.numberOfNights || 1)) || 0;

    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            await onSubmit({ applyCharge });
        } catch {
            setIsLoading(false);
        }
    };

    const labelStyle = { fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px', display: 'block' };

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
                    ⚠️ This reservation will be marked as <strong>NO-SHOW</strong> and the room will be released immediately. This action cannot be undone.
                </div>

                {/* Charge Option */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <input type="checkbox" id="applyCharge" checked={applyCharge} onChange={(e) => setApplyCharge(e.target.checked)} style={{ marginTop: '3px', width: '18px', height: '18px', cursor: 'pointer', accentColor: '#d41424' }} />
                    <label htmlFor="applyCharge" style={{ cursor: 'pointer' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#1E293B', display: 'block' }}>Apply 1 Night No-Show Charge</span>
                        <span style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                            A charge of <strong>{cs}{Math.round(chargeAmount).toLocaleString()}</strong> will be posted to the folio.
                        </span>
                    </label>
                </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 32px 20px 16px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '12px' }}>
                <button type="button" onClick={onCancel} disabled={isLoading} style={{ flex: 1, padding: '14px', backgroundColor: '#F1F5F9', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#64748B', cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={handleSubmit} disabled={isLoading} style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #d41424, #b40f1d)', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer', opacity: isLoading ? 0.5 : 1, boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)' }}>
                    {isLoading ? 'Processing...' : 'Confirm No-Show'}
                </button>
            </div>
        </div>
    );
};

export default NoShowForm;
