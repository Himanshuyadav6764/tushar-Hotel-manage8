import { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';

const CancelReservationForm = ({ booking, onSubmit, onCancel }) => {
    const { getCurrencySymbol, settings } = useSettings();
    const cs = getCurrencySymbol();
    const advancePaid = booking.advancePaid || 0;

    const [formData, setFormData] = useState({
        reason: '',
        cancellationCharges: 0,
        refundAmount: advancePaid,
        refundMode: 'Cash'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    };

    const handleSubmit = async () => {
        const newErrors = {};
        if (!formData.reason.trim()) newErrors.reason = 'Cancellation reason is required';
        const refund = parseFloat(formData.refundAmount) || 0;
        if (refund < 0) newErrors.refundAmount = 'Refund amount cannot be negative';
        if (refund > advancePaid) newErrors.refundAmount = `Refund cannot exceed advance paid (${cs}${advancePaid})`;
        if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
        setErrors({});
        setIsSubmitting(true);
        try {
            await onSubmit(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    const netAmount = advancePaid - (parseFloat(formData.refundAmount) || 0) + (parseFloat(formData.cancellationCharges) || 0);

    // Build refund mode options from settings if available
    const pm = settings?.paymentModes || {};
    const refundModes = [];
    if (pm.cash !== false) refundModes.push('Cash');
    if (pm.card !== false) refundModes.push('Card');
    if (pm.upi !== false) refundModes.push('UPI');
    if (pm.bankTransfer !== false) refundModes.push('Bank Transfer');
    if (pm.cheque) refundModes.push('Cheque');
    if (!refundModes.length) refundModes.push('Cash', 'Card', 'UPI', 'Bank Transfer');

    const labelStyle = { fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px', display: 'block' };
    const boxStyle = { width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF' };
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

                {/* Warning */}
                <div style={{ padding: '14px 16px', borderRadius: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', color: '#b40f1d', fontSize: '13px', fontWeight: '600', lineHeight: '1.5' }}>
                    ⚠️ This reservation will be permanently <strong>CANCELLED</strong>. Any advance paid will be processed as per the refund details below.
                </div>

                {/* Reason */}
                <div>
                    <span style={labelStyle}>CANCELLATION REASON <span style={{ color: '#d41424' }}>*</span></span>
                    <textarea name="reason" value={formData.reason} onChange={handleChange} placeholder="Why is this reservation being cancelled?" rows={2} style={{ ...boxStyle, border: errors.reason ? '2px solid #d41424' : '1px solid #E2E8F0', resize: 'vertical' }} />
                    {errors.reason && <p style={errorStyle}>{errors.reason}</p>}
                </div>

                {/* Financial Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                        <span style={labelStyle}>CANCELLATION CHARGES ({cs})</span>
                        <input type="number" name="cancellationCharges" value={formData.cancellationCharges} onChange={handleChange} min="0" step="0.01" placeholder="0" style={{ ...boxStyle, border: '1px solid #E2E8F0' }} />
                    </div>
                    <div>
                        <span style={labelStyle}>REFUND AMOUNT ({cs})</span>
                        <input type="number" name="refundAmount" value={formData.refundAmount} onChange={handleChange} min="0" max={advancePaid} step="0.01" placeholder={`Max: ${cs}${advancePaid}`} style={{ ...boxStyle, border: errors.refundAmount ? '2px solid #d41424' : '1px solid #E2E8F0' }} />
                        {errors.refundAmount && <p style={errorStyle}>{errors.refundAmount}</p>}
                    </div>
                </div>

                {/* Refund Mode */}
                <div>
                    <span style={labelStyle}>REFUND MODE</span>
                    <select name="refundMode" value={formData.refundMode} onChange={handleChange} style={{ ...boxStyle, border: '1px solid #E2E8F0', cursor: 'pointer' }}>
                        {refundModes.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                {/* Net Summary */}
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B', marginBottom: '8px' }}>
                        <span>Advance Paid</span><span style={{ fontWeight: '700', color: '#1E293B' }}>{cs}{advancePaid.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B', marginBottom: '8px' }}>
                        <span>Refund</span><span style={{ fontWeight: '700', color: '#d41424' }}>- {cs}{(parseFloat(formData.refundAmount) || 0).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B', marginBottom: '8px' }}>
                        <span>Charges</span><span style={{ fontWeight: '700', color: '#059669' }}>+ {cs}{(parseFloat(formData.cancellationCharges) || 0).toLocaleString()}</span>
                    </div>
                    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '800' }}>
                        <span>Net Amount Due</span><span>{cs}{Math.max(0, netAmount).toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 32px 20px 16px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '12px' }}>
                <button type="button" onClick={onCancel} disabled={isSubmitting} style={{ flex: 1, padding: '14px', backgroundColor: '#F1F5F9', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#64748B', cursor: 'pointer' }}>Go Back</button>
                <button type="button" onClick={handleSubmit} disabled={isSubmitting} style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #d41424, #b40f1d)', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer', opacity: isSubmitting ? 0.5 : 1, boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)' }}>
                    {isSubmitting ? 'Cancelling...' : 'Cancel Reservation'}
                </button>
            </div>
        </div>
    );
};

export default CancelReservationForm;
