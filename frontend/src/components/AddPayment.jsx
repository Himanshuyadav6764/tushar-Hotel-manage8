import React, { useState, useMemo, useEffect } from 'react';
import './AddPayment.css';
import { useSettings } from '../context/SettingsContext';

const AddPayment = ({ onClose, onAdd, reservation, lockToFolio = false, fixedFolioId = 0, fixedGuestName = '' }) => {
    const { settings, getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const EPSILON = 0.005;

    const normalize2 = (value) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 0;
        return Number(parsed.toFixed(2));
    };

    // Build payment modes from settings or defaults
    const availableModes = useMemo(() => {
        const modes = [];
        const pm = settings?.paymentModes || {};
        if (pm.cash !== false) modes.push({ id: 'Cash', icon: '💵', label: 'Cash' });
        if (pm.card) modes.push({ id: 'Card', icon: '💳', label: 'Card' });
        if (pm.upi) modes.push({ id: 'UPI', icon: '📲', label: 'UPI' });
        if (pm.bankTransfer) modes.push({ id: 'Bank Transfer', icon: '🏦', label: 'Bank' });
        
        if (modes.length === 0) {
            return [
                { id: 'Cash', icon: '💵', label: 'Cash' },
                { id: 'Card', icon: '💳', label: 'Card' },
                { id: 'UPI', icon: '📲', label: 'UPI' },
                { id: 'Bank Transfer', icon: '🏦', label: 'Bank' }
            ];
        }
        return modes;
    }, [settings?.paymentModes]);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        paymentMethod: availableModes[0]?.id || 'Cash',
        amount: '',
        referenceId: '',
        comment: ''
    });

    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedGuestId, setSelectedGuestId] = useState('primary');
    
    const toNumber = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const resolveOverallBalance = (record) => {
        const candidates = [
            record?.remainingAmount,
            record?.balanceDue,
            record?.billing?.remainingAmount,
            record?.billing?.balanceDue,
            record?.billing?.balanceAmount,
            (toNumber(record?.totalAmount, 0) - toNumber(record?.paidAmount ?? record?.advancePaid, 0))
        ];

        const positiveCandidates = candidates
            .map((value) => toNumber(value, NaN))
            .filter((value) => Number.isFinite(value) && value > 0);

        if (positiveCandidates.length > 0) {
            return Math.max(...positiveCandidates);
        }

        const firstFinite = candidates.find((value) => Number.isFinite(Number(value)));
        return toNumber(firstFinite, 0);
    };

    const formatMoney = (value) => Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const handleChange = (field, value) => {
        let finalValue = value;
        if (field === 'amount') {
            const cleaned = String(value ?? '')
                .replace(/[^0-9.]/g, '')
                .replace(/(\..*)\./g, '$1');
            if (cleaned === '' || /^\d*(\.\d{0,2})?$/.test(cleaned)) {
                finalValue = cleaned;
                const parsed = Number(cleaned);
                const limit = normalize2(selectedFolioBalance);
                if (cleaned !== '' && Number.isFinite(parsed) && parsed > (limit + EPSILON)) {
                    finalValue = limit.toFixed(2);
                }
            } else {
                return;
            }
        }

        setFormData(prev => ({ ...prev, [field]: finalValue }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const handleAmountBlur = () => {
        const raw = String(formData.amount ?? '').trim();
        if (!raw) return;

        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            setFormData((prev) => ({ ...prev, amount: '' }));
            return;
        }

        const entered = normalize2(Math.abs(parsed));
        const limit = normalize2(selectedFolioBalance);
        const normalized = entered > (limit + EPSILON) ? limit : entered;
        setFormData((prev) => ({ ...prev, amount: normalized.toFixed(2) }));
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.date) newErrors.date = 'Date is required';
        if (!formData.paymentMethod) newErrors.paymentMethod = 'Method is required';
        
        const amountValue = parseFloat(formData.amount);
        const entered = normalize2(amountValue);
        const limit = normalize2(selectedFolioBalance);
        if (!formData.amount || amountValue <= 0) {
            newErrors.amount = 'Enter valid amount';
        } else if (entered > (limit + EPSILON)) {
            newErrors.amount = `Amount cannot exceed selected folio balance (${cs}${formatMoney(selectedFolioBalance)})`;
        }
        
        if (['Card', 'UPI', 'Bank Transfer'].includes(formData.paymentMethod) && !formData.referenceId) {
            newErrors.referenceId = 'Ref ID is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        setIsSubmitting(true);

        try {
            const selectedGuestName = lockToFolio
                ? (fixedGuestName || folioGuests.find((guest) => Number(guest.folioId) === Number(fixedFolioId))?.name || reservation?.guestName || 'Guest')
                : (selectedGuest?.name || reservation?.guestName || 'Guest');

            const paymentData = {
                ...formData,
                amount: parseFloat(formData.amount),
                paymentType: formData.paymentMethod, // mapping for parent
                folioId: selectedFolioId,
                selectedGuestName,
                timestamp: new Date().toISOString()
            };

            if (onAdd) {
                await onAdd(paymentData);
            }
        } catch (error) {
            console.error('Error adding payment:', error);
            setIsSubmitting(false);
        }
    };

    const balance = reservation ? Math.max(0, resolveOverallBalance(reservation)) : 0;

    const roomChargeFinal = useMemo(() => {
        const nights = Math.max(1, toNumber(reservation?.duration?.nights ?? reservation?.nights ?? reservation?.numberOfNights, 1));
        const gross = toNumber(
            reservation?.roomCharges
            ?? reservation?.billing?.roomCharges
            ?? reservation?.billing?.roomChargesAmount,
            toNumber(reservation?.pricePerNight ?? reservation?.billing?.roomRate ?? reservation?.rooms?.[0]?.ratePerNight, 0) * nights
        );

        const tax = toNumber(
            reservation?.tax
            ?? reservation?.taxAmount
            ?? reservation?.billing?.tax
            ?? reservation?.billing?.taxAmount,
            0
        );

        const service = toNumber(
            reservation?.serviceCharge
            ?? reservation?.serviceChargeAmount
            ?? reservation?.billing?.serviceCharge
            ?? reservation?.billing?.serviceChargeAmount,
            Math.round((gross * (toNumber(settings?.roomServiceCharge, 0) / 100)) * 100) / 100
        );

        const discount = toNumber(
            reservation?.discount
            ?? reservation?.discountAmount
            ?? reservation?.billing?.discount
            ?? reservation?.billing?.discountAmount,
            0
        );

        return Math.max(0, gross + tax + service - discount);
    }, [reservation, settings?.roomServiceCharge]);

    const isRoomChargeTransaction = (transaction) => {
        const text = `${transaction?.particulars || ''} ${transaction?.description || ''}`.toLowerCase();
        return String(transaction?.type || '').toLowerCase() === 'charge' && (
            text.includes('room charges')
            || text.includes('room tariff')
            || text.includes('room stay')
            || String(transaction?.particulars || '').toLowerCase().includes('room')
        );
    };

    const getDisplayAmount = (transaction) => {
        if (isRoomChargeTransaction(transaction)) {
            return toNumber(roomChargeFinal, 0);
        }
        return Math.abs(toNumber(transaction?.amount, 0));
    };

    const folioGuests = useMemo(() => {
        const primaryGuest = {
            id: 'primary',
            folioId: 0,
            name: reservation?.guestName || 'Guest'
        };

        const additional = (Array.isArray(reservation?.additionalGuests) ? reservation.additionalGuests : [])
            .map((guest, index) => {
                if (typeof guest === 'string') {
                    return { id: `guest-${index}`, folioId: index + 1, name: guest };
                }

                const guestName = guest?.guestName || guest?.name || guest?.fullName || guest?.firstName;
                if (!guestName) return null;

                return {
                    id: guest?._id || guest?.id || `guest-${index}`,
                    folioId: index + 1,
                    name: guestName
                };
            })
            .filter(Boolean);

        return [primaryGuest, ...additional];
    }, [reservation?.guestName, reservation?.additionalGuests]);

    const folioBalances = useMemo(() => {
        const txns = Array.isArray(reservation?.transactions) ? reservation.transactions : [];
        const overall = Math.max(0, Number(balance) || 0);
        const balanceMap = {};

        let otherFoliosTotal = 0;
        folioGuests.forEach((guest) => {
            const folioTxns = txns.filter((t) => Number(t.folioId || 0) === guest.folioId);

            const summary = folioTxns.reduce((acc, transaction) => {
                const typeLc = String(transaction?.type || '').toLowerCase();
                const amountAbs = getDisplayAmount(transaction);

                if (typeLc === 'payment') {
                    acc.payments += amountAbs;
                    return acc;
                }

                if (typeLc === 'discount') {
                    acc.discounts += amountAbs;
                    return acc;
                }

                acc.charges += amountAbs;
                return acc;
            }, { charges: 0, discounts: 0, payments: 0 });

            const grandTotal = Math.max(0, summary.charges - summary.discounts);
            let folioBal = Math.max(0, grandTotal - summary.payments);

            balanceMap[guest.folioId] = folioBal;
            if (guest.folioId !== 0) otherFoliosTotal += folioBal;
        });

        const expectedPrimary = Math.max(0, overall - otherFoliosTotal);
        const currentPrimary = Math.max(0, toNumber(balanceMap[0], 0));

        // Keep primary folio in sync with the most reliable overall outstanding amount.
        balanceMap[0] = Math.max(currentPrimary, expectedPrimary);
        return balanceMap;
    }, [reservation?.transactions, folioGuests, balance, roomChargeFinal]);

    const selectedGuest = folioGuests.find((guest) => guest.id === selectedGuestId) || folioGuests[0];
    const selectedFolioId = lockToFolio
        ? Number(fixedFolioId || 0)
        : (selectedGuest?.folioId ?? 0);

    const lockedFolioBalance = Math.max(0, toNumber(
        reservation?.folioRemainingAmount
        ?? reservation?.balanceDue
        ?? reservation?.remainingAmount,
        0
    ));

    const selectedFolioBalance = lockToFolio
        ? lockedFolioBalance
        : Math.max(0, folioBalances[selectedFolioId] ?? 0);

    useEffect(() => {
        if (lockToFolio) return;
        if (!folioGuests.some((guest) => guest.id === selectedGuestId)) {
            setSelectedGuestId(folioGuests[0]?.id || 'primary');
        }
    }, [folioGuests, selectedGuestId, lockToFolio]);

    return (
        <div className="add-payment-overlay" onClick={onClose}>
            <div className="add-payment-modal" onClick={(e) => e.stopPropagation()}>
                {/* Modern Header */}
                <div className="premium-payment-header">
                    <div className="header-icon-wrap">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                    </div>
                    <div className="header-text">
                        <h3>Add Payment</h3>
                        <span>Process new transaction</span>
                    </div>
                    <button className="premium-close-btn" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="add-payment-body">
                    {/* Reservation Summary Card */}
                    {reservation && !lockToFolio && (
                        <div className="payment-summary-card">
                            <div className="summary-header">
                                <span className="ref-tag">SELECT FOLIO / GUEST</span>
                                <span className="ref-number">{reservation.bookingId || reservation._id?.toString().slice(-6).toUpperCase() || 'RES-1002'}</span>
                            </div>
                            <div className="folio-guest-list" role="radiogroup" aria-label="Folio guests">
                                {folioGuests.map((guest) => {
                                    const isSelected = selectedGuestId === guest.id;
                                    return (
                                        <button
                                            key={guest.id}
                                            type="button"
                                            className={`folio-guest-item ${isSelected ? 'active' : ''}`}
                                            onClick={() => setSelectedGuestId(guest.id)}
                                            role="radio"
                                            aria-checked={isSelected}
                                        >
                                            <span className="folio-radio-dot" aria-hidden="true"></span>
                                            <span className="folio-guest-meta">
                                                <span className="folio-guest-name">{guest.name}</span>
                                                <span className="folio-guest-balance">
                                                    Folio Balance: {cs}{formatMoney(folioBalances[guest.folioId] || 0)}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {reservation && lockToFolio && (
                        <div className="payment-summary-card">
                            <div className="summary-header">
                                <span className="ref-tag">CURRENT FOLIO</span>
                                <span className="ref-number">{reservation.bookingId || reservation._id?.toString().slice(-6).toUpperCase() || 'RES-1002'}</span>
                            </div>
                            <div className="summary-main">
                                <div className="summary-column">
                                    <div className="summary-item">
                                        <label>Guest</label>
                                        <span>{fixedGuestName || folioGuests.find((guest) => Number(guest.folioId) === Number(selectedFolioId))?.name || reservation?.guestName || 'Guest'}</span>
                                    </div>
                                </div>
                                <div className="summary-column">
                                    <div className="summary-item" style={{ textAlign: 'right' }}>
                                        <label>Folio Balance</label>
                                        <span style={{ color: '#059669', fontWeight: '800' }}>{cs}{formatMoney(selectedFolioBalance)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* New Balance Preview (Dynamic) */}
                    <div className="new-balance-preview animate-in">
                        <div className="preview-label">Balance after this payment</div>
                        <div className={`preview-amount ${ (selectedFolioBalance - (parseFloat(formData.amount) || 0)) <= 0 ? 'fully-paid' : ''}`}>
                            {cs}{formatMoney(Math.max(0, selectedFolioBalance - (parseFloat(formData.amount) || 0)))}
                        </div>
                    </div>

                    {/* Date Input */}
                    <div className="payment-field-group">
                        <label className="field-label-premium">Payment Date</label>
                        <div className="input-with-icon">
                            <span className="field-icon">📅</span>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => handleChange('date', e.target.value)}
                                className={errors.date ? 'error' : ''}
                            />
                        </div>
                    </div>

                    {/* Payment Method Grid */}
                    <div className="payment-field-group">
                        <label className="field-label-premium">Select Method</label>
                        <div className="payment-method-grid">
                            {availableModes.map(mode => (
                                <button
                                    key={mode.id}
                                    type="button"
                                    className={`method-btn-premium ${formData.paymentMethod === mode.id ? 'active' : ''}`}
                                    onClick={() => handleChange('paymentMethod', mode.id)}
                                >
                                    <div className="method-selection-indicator">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                    <span className="method-icon">{mode.icon}</span>
                                    <span className="method-label">{mode.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Amount Input */}
                    <div className="payment-field-group">
                        <label className="field-label-premium">Amount <span className="req-star">*</span></label>
                        <div className="amount-input-container">
                            <span className="currency-indicator">{cs}</span>
                            <input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => handleChange('amount', e.target.value)}
                                onBlur={handleAmountBlur}
                                onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                                min="0"
                                max={normalize2(selectedFolioBalance)}
                                step="0.01"
                                placeholder="0.00"
                                className={`amount-input-field ${errors.amount ? 'error' : ''}`}
                            />
                            {selectedFolioBalance > 0 && (
                                <button
                                    type="button"
                                    className="pay-full-action-btn"
                                    onClick={() => handleChange('amount', Number(selectedFolioBalance).toFixed(2))}
                                >
                                    PAY FULL
                                </button>
                            )}
                        </div>
                        {errors.amount && <span className="err-hint">{errors.amount}</span>}
                    </div>

                    {/* Reference ID - Conditional */}
                    {['Card', 'UPI', 'Bank Transfer'].includes(formData.paymentMethod) && (
                        <div className="payment-field-group animate-in">
                            <label>Ref / Transaction ID <span className="req-star">*</span></label>
                            <input
                                type="text"
                                value={formData.referenceId}
                                onChange={(e) => handleChange('referenceId', e.target.value)}
                                placeholder="TID12345678"
                                className={errors.referenceId ? 'error' : ''}
                            />
                            {errors.referenceId && <span className="err-hint">{errors.referenceId}</span>}
                        </div>
                    )}

                    {/* Comment */}
                    <div className="payment-field-group">
                        <label className="field-label-premium">Comment / Notes</label>
                        <textarea
                            className="premium-textarea"
                            value={formData.comment}
                            onChange={(e) => handleChange('comment', e.target.value)}
                            placeholder="Add essential notes about this payment..."
                            rows="2"
                        />
                    </div>
                </div>

                {/* Modern Footer Actions */}
                <div className="payment-modal-footer">
                    <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button 
                        className="btn-primary" 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <div className="spinner-small"></div>
                        ) : (
                            <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
                                Confirm Payment
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddPayment;
