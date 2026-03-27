import React, { useState } from 'react';
import '../AddPayment.css';
import { useSettings } from '../../context/SettingsContext';
import { calculateRoomTaxBySlab } from '../../utils/roomTax';

const PrintSummaryForm = ({ booking, onSubmit, onCancel }) => {
    const { settings, getCurrencySymbol, getFullAddress } = useSettings();
    const cs = getCurrencySymbol();
    const [printType, setPrintType] = useState('A4');

    const printOptions = [
        { id: 'A4', label: 'A4', icon: '📄', desc: 'Standard' },
        { id: 'A5', label: 'A5', icon: '📃', desc: 'Half Sheet' },
        { id: 'Thermal', label: 'Thermal', icon: '🧾', desc: '80mm Roll' },
        { id: 'Dot Matrix', label: 'Dot Matrix', icon: '🖨️', desc: 'DMP' },
        { id: '3 inch', label: '3 inch', icon: '📜', desc: '76mm Roll' },
        { id: '2 inch', label: '2 inch', icon: '🔖', desc: '58mm Roll' },
    ];

    const formatDate = (date) => {
        if (!date) return 'N/A';
        try {
            return new Date(date).toLocaleDateString('en-IN', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
        } catch { return 'N/A'; }
    };

    const handlePrint = () => {
        if (onSubmit) {
            onSubmit({ action: 'print-summary', timestamp: new Date().toISOString(), type: printType });
        }
    };

    const toNum = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const pickNum = (...values) => {
        for (const value of values) {
            if (value === null || value === undefined || value === '') continue;
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return parsed;
        }
        return undefined;
    };

    const b = booking || {};
    const billing = b.billing || {};
    const nights = toNum(b.numberOfNights ?? b.nights, 1);
    const roomCount = Math.max(1, Array.isArray(b.rooms) && b.rooms.length > 0 ? b.rooms.length : toNum(b.numberOfRooms, 1));

    const roomRows = Array.isArray(b.rooms) && b.rooms.length > 0
        ? b.rooms.map((room) => ({
            ratePerNight: toNum(room.ratePerNight ?? room.roomRate ?? room.pricePerNight ?? room.price, 0),
            discount: toNum(room.discount ?? room.discountAmount, 0)
        }))
        : [{
            ratePerNight: toNum(b.pricePerNight ?? b.roomRate ?? b.ratePerNight ?? billing.roomRate ?? billing.pricePerNight, 0),
            discount: toNum(b.roomLevelDiscount ?? billing.roomLevelDiscount, 0)
        }];

    const roomChargesFromRows = roomRows.reduce((sum, row) => sum + (toNum(row.ratePerNight, 0) * Math.max(1, nights)), 0);

    const slabTax = calculateRoomTaxBySlab({
        rooms: roomRows,
        nights,
        taxExempt: false,
        inclusiveTax: Boolean(settings.inclusiveTax),
        roomGstSlabs: settings.roomGstSlabs,
        fallbackRoomGst: settings.roomGst
    });

    const baseRate = toNum(b.pricePerNight ?? b.roomRate ?? b.ratePerNight ?? billing.roomRate ?? billing.pricePerNight, 0);

    const roomCharges = pickNum(
        b.roomCharges,
        b.baseRoomCharges,
        billing.roomCharges,
        billing.roomChargesAmount
    ) ?? (roomChargesFromRows || (baseRate * Math.max(1, nights) * roomCount) || slabTax.roomCharges);

    const discount = pickNum(
        b.discount,
        b.discountAmount,
        b.totalDiscount,
        billing.discount,
        billing.discountAmount
    ) ?? ((pickNum(b.autoDiscountAmount, billing.autoDiscountAmount) || 0) + (pickNum(b.manualDiscountAmount, billing.manualDiscountAmount) || 0));

    const explicitServiceCharge = pickNum(
        b.serviceCharge,
        b.serviceChargeAmount,
        billing.serviceCharge,
        billing.serviceChargeAmount
    ) ?? 0;

    const derivedServiceCharge = Math.max(0, roomCharges - discount) * ((parseFloat(settings.roomServiceCharge ?? settings.serviceCharge) || 0) / 100);
    const serviceCharge = explicitServiceCharge > 0 ? explicitServiceCharge : derivedServiceCharge;
    const taxEnabled = Boolean(settings.inclusiveTax);
    const tax = taxEnabled ? (pickNum(b.tax, b.taxAmount, billing.tax, billing.taxAmount) ?? slabTax.taxAmount) : 0;
    const taxPct = parseFloat(settings.roomGst ?? 12) || 12;
    const storedTotal = pickNum(billing.totalAmount, b.totalAmount, b.grandTotal, b.amount);
    const grossBeforeDiscount = Math.max(0, roomCharges + serviceCharge + tax);
    const derivedDiscountFromTotal = storedTotal !== undefined ? Math.max(0, grossBeforeDiscount - Number(storedTotal || 0)) : 0;
    const effectiveDiscount = discount > 0 ? discount : derivedDiscountFromTotal;
    const subtotal = Math.max(roomCharges + serviceCharge - effectiveDiscount, 0);
    const totalAmount = Math.max(0, roomCharges + serviceCharge + tax - effectiveDiscount);

    return (
        <div className="add-payment-form-premium" style={{ height: '100%', width: '100%', boxSizing: 'border-box' }}>
            <div className="add-payment-body">
                {/* Guest & Reservation Summary Card */}
                <div className="payment-summary-card">
                    <div className="summary-header">
                        <span className="ref-tag">RESERVATION</span>
                        <span className="ref-number">{b.bookingId || 'N/A'}</span>
                    </div>
                    
                    <div className="summary-main">
                        <div className="summary-column">
                            <div className="summary-item">
                                <label>GUEST</label>
                                <span>{b.guestName || 'N/A'}</span>
                            </div>
                            <div className="summary-item">
                                <label>CHECK-IN</label>
                                <span>{formatDate(b.checkInDate)}</span>
                            </div>
                            <div className="summary-item">
                                <label>NIGHTS</label>
                                <span>{nights} Night{nights > 1 ? 's' : ''}</span>
                            </div>
                        </div>
                        <div className="summary-column">
                            <div className="summary-item">
                                <label>ROOM</label>
                                <span>{b.roomNumber || 'TBA'} ({b.roomType || 'Std'})</span>
                            </div>
                            <div className="summary-item">
                                <label>CHECK-OUT</label>
                                <span>{formatDate(b.checkOutDate)}</span>
                            </div>
                            <div className="summary-item">
                                <label>TOTAL</label>
                                <span style={{ color: '#e11d48', fontWeight: '900' }}>{cs}{totalAmount.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="payment-summary-card" style={{ marginTop: '10px' }}>
                    <div className="summary-header">
                        <span className="ref-tag">BILL BREAKDOWN</span>
                        <span className="ref-number">{cs}{totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="summary-main">
                        <div className="summary-column">
                            <div className="summary-item">
                                <label>ROOM CHARGES</label>
                                <span>{cs}{roomCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="summary-item">
                                <label>SERVICE CHARGES</label>
                                <span>{cs}{serviceCharge.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <div className="summary-column">
                            <div className="summary-item">
                                <label>DISCOUNT APPLIED</label>
                                <span style={{ color: '#059669' }}>-{cs}{effectiveDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="summary-item">
                                <label>SUBTOTAL</label>
                                <span>{cs}{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="summary-item">
                                <label>{taxEnabled ? `TAX (${taxPct.toFixed(1)}%)` : 'TAX (disabled)'}</label>
                                <span>{cs}{tax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Print Format Selector */}
                <div style={{ marginTop: '4px' }}>
                    <label className="field-label-premium" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🖨️</span> SELECT PRINT FORMAT
                    </label>
                    <div className="grid grid-cols-3 gap-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        {printOptions.map(opt => (
                            <button 
                                key={opt.id} 
                                type="button" 
                                onClick={() => setPrintType(opt.id)}
                                style={{
                                    background: printType === opt.id ? '#fef2f2' : 'white',
                                    border: printType === opt.id ? '2px solid #e11d48' : '2px solid #f1f5f9',
                                    borderRadius: '16px',
                                    padding: '16px 8px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: printType === opt.id ? '0 8px 20px rgba(225, 29, 72, 0.15)' : 'none',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                <span style={{ fontSize: '24px' }}>{opt.icon}</span>
                                <span style={{ fontSize: '13px', fontWeight: '800', color: printType === opt.id ? '#e11d48' : '#475569' }}>
                                    {opt.label}
                                </span>
                                {printType === opt.id && (
                                    <div style={{ 
                                        position: 'absolute', 
                                        top: '-6px', 
                                        right: '-6px', 
                                        background: '#e11d48', 
                                        color: 'white', 
                                        width: '20px', 
                                        height: '20px', 
                                        borderRadius: '50%', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        fontSize: '10px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                        border: '2px solid white'
                                    }}>✓</div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Status Indicator */}
                <div className="new-balance-preview" style={{ marginTop: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div className="preview-label" style={{ color: '#64748b' }}>SELECTED FORMAT:</div>
                    <div className="preview-amount" style={{ color: '#1e293b', fontSize: '14px' }}>
                        {printOptions.find(p => p.id === printType)?.icon} {printType}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="payment-modal-footer">
                <button type="button" className="btn-secondary" onClick={onCancel}>
                    CANCEL
                </button>
                <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handlePrint}
                    style={{ flex: 2 }}
                >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    PRINT SUMMARY
                </button>
            </div>
        </div>
    );
};

export default PrintSummaryForm;
