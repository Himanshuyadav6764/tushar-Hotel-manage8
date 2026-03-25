import { useState, useMemo, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import '../AddPayment.css'; 

const AddPaymentForm = ({ booking, onSubmit, onCancel }) => {
    const { settings, getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const EPSILON = 0.005;

    const normalize2 = (value) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 0;
        return Number(parsed.toFixed(2));
    };

    const availableModes = useMemo(() => {
        const modes = [];
        const pm = settings?.paymentModes || {};
        if (pm.cash !== false) modes.push({ id: 'Cash', icon: '💵', label: 'Cash' });
        if (pm.card) modes.push({ id: 'Card', icon: '💳', label: 'Card' });
        if (pm.upi) modes.push({ id: 'UPI', icon: '📱', label: 'UPI' });
        if (pm.bankTransfer) modes.push({ id: 'Bank Transfer', icon: '🏦', label: 'Bank' });
        if (pm.cheque) modes.push({ id: 'Cheque', icon: '📝', label: 'Cheque' });
        
        if (modes.length === 0) {
            return [
                { id: 'Cash', icon: '💵', label: 'Cash' },
                { id: 'Card', icon: '💳', label: 'Card' },
                { id: 'UPI', icon: '📱', label: 'UPI' },
                { id: 'Bank Transfer', icon: '🏦', label: 'Bank' }
            ];
        }
        return modes;
    }, [settings?.paymentModes]);

    const [formData, setFormData] = useState({
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: availableModes[0]?.id || 'Cash',
        amount: '',
        referenceId: '',
        comment: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
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
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
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

    const validate = () => {
        const newErrors = {};
        const amt = parseFloat(formData.amount);
        const entered = normalize2(amt);
        const limit = normalize2(selectedFolioBalance);
        if (!formData.amount || isNaN(amt) || amt <= 0) {
            newErrors.amount = 'Amount is required';
        } else if (entered > (limit + EPSILON)) {
            newErrors.amount = `Amount cannot exceed selected folio balance (${cs}${formatMoney(selectedFolioBalance)})`;
        }
        
        if (['Card', 'UPI', 'Bank Transfer', 'Cheque', 'Bank'].includes(formData.paymentMethod) && !formData.referenceId?.trim()) {
            newErrors.referenceId = 'Ref ID is required';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!validate()) return;
        setIsSubmitting(true);
        try {
            await onSubmit({
                ...formData,
                date: formData.paymentDate,
                amount: Math.abs(parseFloat(formData.amount)),
                folioId: selectedFolioId,
                selectedGuestName: selectedGuest?.name || booking?.guestName || 'Guest'
            });
        } catch (error) {
            console.error('Submit error:', error);
            setIsSubmitting(false);
        }
    };

    const balance = Math.max(0, toNumber(
        booking?.folioRemainingAmount
        ?? booking?.balanceDue
        ?? booking?.remainingAmount,
        resolveOverallBalance(booking)
    ));

    const roomChargeFinal = useMemo(() => {
        const nights = Math.max(1, toNumber(booking?.duration?.nights ?? booking?.nights ?? booking?.numberOfNights, 1));
        const gross = toNumber(
            booking?.roomCharges
            ?? booking?.billing?.roomCharges
            ?? booking?.billing?.roomChargesAmount,
            toNumber(booking?.pricePerNight ?? booking?.billing?.roomRate ?? booking?.rooms?.[0]?.ratePerNight, 0) * nights
        );

        const tax = toNumber(
            booking?.tax
            ?? booking?.taxAmount
            ?? booking?.billing?.tax
            ?? booking?.billing?.taxAmount,
            0
        );

        const service = toNumber(
            booking?.serviceCharge
            ?? booking?.serviceChargeAmount
            ?? booking?.billing?.serviceCharge
            ?? booking?.billing?.serviceChargeAmount,
            Math.round((gross * (toNumber(settings?.roomServiceCharge, 0) / 100)) * 100) / 100
        );

        const discount = toNumber(
            booking?.discount
            ?? booking?.discountAmount
            ?? booking?.billing?.discount
            ?? booking?.billing?.discountAmount,
            0
        );

        return Math.max(0, gross + tax + service - discount);
    }, [booking, settings?.roomServiceCharge]);

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
            name: booking?.guestName || 'Guest'
        };

        const additional = (Array.isArray(booking?.additionalGuests) ? booking.additionalGuests : [])
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
    }, [booking?.guestName, booking?.additionalGuests]);

    const folioBalances = useMemo(() => {
        const txns = Array.isArray(booking?.transactions) ? booking.transactions : [];
        const overall = Math.max(0, Number(balance) || 0);
        const balanceMap = {};
        const incomingFolioBalances = booking && typeof booking.folioBalances === 'object' ? booking.folioBalances : null;

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

            if (guest.folioId === 0) {
                const hasRoomTariff = folioTxns.some((transaction) => {
                    const text = `${transaction?.particulars || ''} ${transaction?.description || ''}`.toLowerCase();
                    return String(transaction?.type || '').toLowerCase() === 'charge' && (
                        text.includes('room tariff')
                        || text.includes('room rent')
                        || text.includes('room charges')
                        || text.includes('room stay')
                    );
                });

                if (!hasRoomTariff) {
                    const nights = Math.max(1, toNumber(booking?.duration?.nights ?? booking?.nights ?? booking?.numberOfNights, 1));
                    const roomRate = toNumber(
                        booking?.billing?.roomRate
                        ?? booking?.pricePerNight
                        ?? booking?.rooms?.[0]?.ratePerNight,
                        0
                    );
                    const virtualRoomCharge = toNumber(
                        booking?.billing?.roomCharges
                        ?? booking?.roomCharges,
                        roomRate * nights
                    );

                    if (virtualRoomCharge > 0) {
                        summary.charges += virtualRoomCharge;
                    }
                }
            }

            const grandTotal = Math.max(0, summary.charges - summary.discounts);
            let folioBal = Math.max(0, grandTotal - summary.payments);

            balanceMap[guest.folioId] = folioBal;
            if (guest.folioId !== 0) otherFoliosTotal += folioBal;
        });

        const expectedPrimary = Math.max(0, overall - otherFoliosTotal);
        const currentPrimary = Math.max(0, toNumber(balanceMap[0], 0));
        balanceMap[0] = Math.max(currentPrimary, expectedPrimary);

        // Prefer explicit folio-wise balances from parent payload when available.
        if (incomingFolioBalances) {
            Object.keys(incomingFolioBalances).forEach((folioKey) => {
                const folioIndex = Number(folioKey);
                const mappedBalance = toNumber(incomingFolioBalances[folioKey], NaN);
                if (Number.isFinite(folioIndex) && Number.isFinite(mappedBalance)) {
                    if (folioIndex === 0) return;
                    balanceMap[folioIndex] = Math.max(0, mappedBalance);
                }
            });
        }

        return balanceMap;
    }, [booking?.transactions, booking?.folioBalances, booking?.folioRemainingAmount, booking?.balanceDue, booking?.remainingAmount, folioGuests, balance, roomChargeFinal]);

    const selectedGuest = folioGuests.find((guest) => guest.id === selectedGuestId) || folioGuests[0];
    const selectedFolioId = selectedGuest?.folioId ?? 0;
    const selectedFolioBalance = Math.max(0, folioBalances[selectedFolioId] ?? 0);

    useEffect(() => {
        if (!folioGuests.some((guest) => guest.id === selectedGuestId)) {
            setSelectedGuestId(folioGuests[0]?.id || 'primary');
        }
    }, [folioGuests, selectedGuestId]);

    return (
        <div className="add-payment-form-premium" style={{ width: '100%', overflowX: 'hidden' }}>
            <div className="add-payment-body">
                {/* Reservation Summary Card */}
                <div className="payment-summary-card">
                    <div className="summary-header">
                        <span className="ref-tag">SELECT FOLIO / GUEST</span>
                        <span className="ref-number">{booking?.bookingId || 'RES-1002'}</span>
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

                {/* Balance Preview - Pink Box */}
                <div className="new-balance-preview animate-in">
                    <div className="preview-label">Balance after this payment</div>
                    <div className={`preview-amount ${ (selectedFolioBalance - (parseFloat(formData.amount) || 0)) <= 0 ? 'fully-paid' : ''}`}>
                        {cs}{formatMoney(Math.max(0, selectedFolioBalance - (parseFloat(formData.amount) || 0)))}
                    </div>
                </div>

                {/* Date Input */}
                <div className="payment-field-group">
                    <label className="field-label-premium">PAYMENT DATE</label>
                    <div className="input-with-icon">
                        <span className="field-icon">📅</span>
                        <input
                            type="date"
                            value={formData.paymentDate}
                            onChange={(e) => handleChange('paymentDate', e.target.value)}
                            className={errors.paymentDate ? 'error' : ''}
                        />
                    </div>
                </div>

                {/* Payment Method Grid */}
                <div className="payment-field-group">
                    <label className="field-label-premium">SELECT METHOD</label>
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
                    <label className="field-label-premium">AMOUNT TO PAY <span className="req-star">*</span></label>
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

                {/* Reference ID */}
                {['Card', 'UPI', 'Bank Transfer', 'Cheque', 'Bank'].includes(formData.paymentMethod) && (
                    <div className="payment-field-group animate-in">
                        <label className="field-label-premium">REF / TRANSACTION ID <span className="req-star">*</span></label>
                        <input
                            type="text"
                            value={formData.referenceId}
                            onChange={(e) => handleChange('referenceId', e.target.value)}
                            placeholder="Enter reference number"
                            className={errors.referenceId ? 'error' : ''}
                        />
                        {errors.referenceId && <span className="err-hint">{errors.referenceId}</span>}
                    </div>
                )}

                {/* Comment */}
                <div className="payment-field-group">
                    <label className="field-label-premium">NOTES (OPTIONAL)</label>
                    <textarea
                        className="premium-textarea"
                        value={formData.comment}
                        onChange={(e) => handleChange('comment', e.target.value)}
                        placeholder="Add essential notes about this payment..."
                        rows="2"
                    />
                </div>
            </div>

            {/* Premium Footer */}
            <div className="payment-modal-footer">
                <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>
                    CANCEL
                </button>
                <button 
                    type="submit" 
                    className="btn-primary" 
                    onClick={handleSubmit} 
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <div className="spinner-small"></div>
                    ) : (
                        <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
                            CONFIRM PAYMENT
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default AddPaymentForm;
