import { CreditCard, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import './BillingSummary.css';

const BillingSummary = ({
    roomCharges = 0,
    discount = 0,
    autoDiscount = 0,
    autoDiscountNames = [],
    manualDiscount = 0,
    manualDiscountType = 'FLAT',
    manualDiscountValue = 0,
    manualDiscountPercent = 0,
    tax = 0,
    taxLabel = '',
    serviceCharge = 0,
    serviceChargeLabel = 'Service Charge',
    totalAmount = 0,
    grossTotal = 0,
    paidAmount = 0,
    balanceDue = 0,
    paymentMode = 'Cash',
    onPaymentModeChange = () => { },
    onPaidAmountChange = () => { },
    onManualDiscountChange = () => { },
    onManualDiscountTypeChange = () => { },
    onTaxExemptChange = () => { },
    taxExempt = false,
    transactionId = '',
    onTransactionIdChange = () => { },
    splitAmounts = { Cash: '', UPI: '', Card: '', 'Bank Transfer': '' },
    onSplitAmountsChange = () => { },
    splitReferences = { UPI: '', Card: '', 'Bank Transfer': '' },
    onSplitReferencesChange = () => { },
    upiUtr = '',
    onUpiUtrChange = () => { },
    bankTransactionId = '',
    onBankTransactionIdChange = () => { },
    cardTransactionId = '',
    onCardTransactionIdChange = () => { }
}) => {
    const { getCurrencySymbol, settings } = useSettings();
    const cs = getCurrencySymbol();
    const paidPercentage = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;
    const isFullyPaid = balanceDue <= 0 && totalAmount > 0;

    const roomGstPct = parseFloat(settings.roomGst) || 12;
    const isTaxEnabled = Boolean(settings.inclusiveTax);
    const pm = settings.paymentModes || {};
    const resolvedTaxLabel = isTaxEnabled
        ? (taxLabel || `Tax (${roomGstPct}%)`)
        : 'Tax (disabled)';
    const displayedTax = isTaxEnabled ? tax : 0;

    // Build enabled payment options
    const paymentOptions = [
        pm.cash !== false && { value: 'Cash', label: 'Cash' },
        pm.upi !== false && { value: 'UPI', label: 'UPI / Online' },
        pm.card !== false && { value: 'Card', label: 'Card' },
        pm.bankTransfer && { value: 'Bank Transfer', label: 'Bank Transfer' },
        { value: 'Multiple Payment', label: 'Multiple Payment' },
    ].filter(Boolean);

    const splitModes = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
    const isSplitPayment = paymentMode === 'Multiple Payment';
    const splitTotal = splitModes.reduce((sum, mode) => sum + (Number(splitAmounts[mode]) || 0), 0);
    const splitUsedModesCount = splitModes.filter(mode => (Number(splitAmounts[mode]) || 0) > 0).length;
    const splitRemaining = Math.max(0, Number(totalAmount || 0) - splitTotal);
    const splitHasMismatch = Math.abs(splitTotal - Number(totalAmount || 0)) > 0.01;

    const handleSplitAmountChange = (mode, rawValue) => {
        if (rawValue !== '' && Number(rawValue) < 0) return;
        const entered = rawValue === '' ? 0 : (Number(rawValue) || 0);
        const otherTotal = splitModes
            .filter(key => key !== mode)
            .reduce((sum, key) => sum + (Number(splitAmounts[key]) || 0), 0);
        const maxForCurrent = Math.max(0, Number(totalAmount || 0) - otherTotal);
        const nextValue = rawValue === '' ? '' : String(Math.min(entered, maxForCurrent));
        const nextSplitAmounts = { ...splitAmounts, [mode]: nextValue };
        onSplitAmountsChange(nextSplitAmounts);

        const nextTotal = splitModes.reduce((sum, key) => sum + (Number(nextSplitAmounts[key]) || 0), 0);
        onPaidAmountChange(nextTotal);
    };

    return (
        <div className="billing-payment-dual-container">
            {/* Left Card: Billing Summary */}
            <div className="billing-card premium-card-v2">
                <div className="card-header-v2">
                    <div className="header-icon-title">
                        <span className="header-icon-wrap">💰</span>
                        <h3>BILLING SUMMARY</h3>
                    </div>
                </div>

                <div className="card-body-v2">
                    <div className="card-body-left">
                        <div className="summary-item-v2">
                            <span className="label">Room Charges</span>
                            <span className="value">{cs}{roomCharges.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="summary-item-v2" style={{ marginTop: '20px' }}>
                            <span className="label">{resolvedTaxLabel}</span>
                            <span className="value">{cs}{displayedTax.toLocaleString('en-IN')}</span>
                        </div>
                        {serviceCharge > 0 && (
                            <div className="summary-item-v2" style={{ marginTop: '10px' }}>
                                <span className="label">{serviceChargeLabel}</span>
                                <span className="value">{cs}{serviceCharge.toLocaleString('en-IN')}</span>
                            </div>
                        )}
                        {autoDiscount > 0 && (
                            <div className="summary-item-v2" style={{ marginTop: '10px' }}>
                                <span className="label">
                                    Auto Discount
                                    {autoDiscountNames.length > 0 ? ` (${autoDiscountNames.join(', ')})` : ''}
                                </span>
                                <span className="value" style={{ color: '#059669' }}>-{cs}{Math.round(autoDiscount).toLocaleString('en-IN')}</span>
                            </div>
                        )}
                    </div>

                    <div className="card-body-right">
                        <div className="summary-item-v2 align-right">
                            <span className="label">Subtotal</span>
                            <span className="value">{cs}{(roomCharges - discount).toLocaleString('en-IN')}</span>
                        </div>

                        <div className="total-amount-box-v2">
                            <span className="total-label-v2">GRAND TOTAL</span>
                            <span className="total-value-v2">{cs}{totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Card: Payment Details */}
            <div className="payment-card premium-card-v2">
                <div className="card-header-v2">
                    <div className="header-icon-title">
                        <span className="header-icon-wrap">💳</span>
                        <h3>PAYMENT DETAILS</h3>
                    </div>
                </div>

                <div className="card-body-v2">
                    <div className="card-body-left">
                        <div className="payment-form-group-v2">
                            <label className="input-label-v2">PAYMENT MODE</label>
                            <select
                                className="premium-select-v2"
                                value={paymentMode}
                                onChange={(e) => {
                                    const selectedMode = e.target.value;
                                    onPaymentModeChange(selectedMode);

                                    if (selectedMode !== 'Multiple Payment') {
                                        onSplitAmountsChange({ Cash: '', UPI: '', Card: '', 'Bank Transfer': '' });
                                        onSplitReferencesChange({ UPI: '', Card: '', 'Bank Transfer': '' });
                                    }
                                }}
                            >
                                {paymentOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {!isSplitPayment && paymentMode === 'UPI' && (
                            <div className="payment-form-group-v2">
                                <label className="input-label-v2">UPI UTR NUMBER <span className="req-star">*</span></label>
                                <div className="premium-input-wrapper-v2">
                                    <input
                                        type="text"
                                        className="premium-input-v2"
                                        value={upiUtr}
                                        onChange={(e) => onUpiUtrChange(e.target.value)}
                                        placeholder="Enter 12-digit UTR"
                                        maxLength={12}
                                    />
                                </div>
                            </div>
                        )}

                        {!isSplitPayment && paymentMode === 'Bank Transfer' && (
                            <div className="payment-form-group-v2">
                                <label className="input-label-v2">BANK TRANSACTION ID <span className="req-star">*</span></label>
                                <div className="premium-input-wrapper-v2">
                                    <input
                                        type="text"
                                        className="premium-input-v2"
                                        value={bankTransactionId}
                                        onChange={(e) => onBankTransactionIdChange(e.target.value)}
                                        placeholder="Enter Bank Txn ID (10/12/15)"
                                        maxLength={15}
                                    />
                                </div>
                            </div>
                        )}

                        {!isSplitPayment && paymentMode === 'Card' && (
                            <div className="payment-form-group-v2">
                                <label className="input-label-v2">CARD TRANSACTION ID <span className="req-star">*</span></label>
                                <div className="premium-input-wrapper-v2">
                                    <input
                                        type="text"
                                        className="premium-input-v2"
                                        value={cardTransactionId}
                                        onChange={(e) => onCardTransactionIdChange(e.target.value)}
                                        placeholder="Enter Card Txn ID (10/12/15)"
                                        maxLength={15}
                                    />
                                </div>
                            </div>
                        )}

                        {isSplitPayment && (
                            <div className="payment-form-group-v2">
                                <label className="input-label-v2">MULTIPLE PAYMENT BREAKUP</label>
                                <div style={{ display: 'grid', gap: '8px' }}>
                                    {splitModes.map((mode) => {
                                        const splitAmount = Number(splitAmounts[mode]) || 0;
                                        return (
                                            <div key={mode} style={{ display: 'grid', gap: '6px' }}>
                                                <div className="premium-input-wrapper-v2">
                                                    <input
                                                        type="number"
                                                        className="premium-input-v2"
                                                        min="0"
                                                        placeholder={`${mode} amount`}
                                                        value={splitAmounts[mode] || ''}
                                                        onChange={(e) => handleSplitAmountChange(mode, e.target.value)}
                                                    />
                                                </div>

                                                {splitAmount > 0 && mode === 'UPI' && (
                                                    <div className="premium-input-wrapper-v2">
                                                        <input
                                                            type="text"
                                                            className="premium-input-v2"
                                                            placeholder="UPI UTR (12 digits)"
                                                            value={splitReferences.UPI || ''}
                                                            onChange={(e) => onSplitReferencesChange({ ...splitReferences, UPI: e.target.value })}
                                                            maxLength={12}
                                                        />
                                                    </div>
                                                )}

                                                {splitAmount > 0 && mode === 'Bank Transfer' && (
                                                    <div className="premium-input-wrapper-v2">
                                                        <input
                                                            type="text"
                                                            className="premium-input-v2"
                                                            placeholder="Bank Txn ID (10/12/15)"
                                                            value={splitReferences['Bank Transfer'] || ''}
                                                            onChange={(e) => onSplitReferencesChange({ ...splitReferences, 'Bank Transfer': e.target.value })}
                                                            maxLength={15}
                                                        />
                                                    </div>
                                                )}

                                                {splitAmount > 0 && mode === 'Card' && (
                                                    <div className="premium-input-wrapper-v2">
                                                        <input
                                                            type="text"
                                                            className="premium-input-v2"
                                                            placeholder="Card Txn ID (10/12/15)"
                                                            value={splitReferences.Card || ''}
                                                            onChange={(e) => onSplitReferencesChange({ ...splitReferences, Card: e.target.value })}
                                                            maxLength={15}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Used Modes: {splitUsedModesCount} (minimum 2)</span>
                                    <strong>Total: {cs}{splitTotal.toFixed(2)}</strong>
                                </div>
                                <div style={{ marginTop: '2px', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', color: splitRemaining > 0 ? '#b45309' : '#166534' }}>
                                    <span>Remaining Amount</span>
                                    <strong>{cs}{splitRemaining.toFixed(2)}</strong>
                                </div>
                                {splitHasMismatch && (
                                    <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#b91c1c', fontWeight: 700 }}>
                                        Split total must match Grand Total before save.
                                    </div>
                                )}
                            </div>
                        )}

                        {!isSplitPayment && paymentMode !== 'Cash' && paymentMode !== 'UPI' && paymentMode !== 'Bank Transfer' && paymentMode !== 'Card' && (
                            <div className="payment-form-group-v2">
                                <label className="input-label-v2">TRANSACTION ID</label>
                                <div className="premium-input-wrapper-v2">
                                    <input
                                        type="text"
                                        className="premium-input-v2"
                                        value={transactionId}
                                        onChange={(e) => onTransactionIdChange(e.target.value)}
                                        placeholder="Enter transaction ID"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="payment-form-group-v2">
                            <label className="input-label-v2">ADVANCE / PAID AMOUNT</label>
                            <div className="premium-input-wrapper-v2">
                                <input
                                    type="number"
                                    className="premium-input-v2"
                                    value={paidAmount}
                                    onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0;
                                        if (value > totalAmount) {
                                            onPaidAmountChange(totalAmount);
                                        } else {
                                            onPaidAmountChange(e.target.value);
                                        }
                                    }}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="payment-form-group-v2">
                            <label className="input-label-v2">DISCOUNT</label>
                            <div className="discount-toggle-v2">
                                <button
                                    type="button"
                                    className={`discount-toggle-btn-v2 ${manualDiscountType === 'FLAT' ? 'active' : ''}`}
                                    onClick={() => onManualDiscountTypeChange('FLAT')}
                                >
                                    {cs}
                                </button>
                                <button
                                    type="button"
                                    className={`discount-toggle-btn-v2 ${manualDiscountType === 'PERCENTAGE' ? 'active' : ''}`}
                                    onClick={() => onManualDiscountTypeChange('PERCENTAGE')}
                                >
                                    %
                                </button>
                            </div>
                            <div className="premium-input-wrapper-v2 discount-input-wrap-v2">
                                {manualDiscountType === 'FLAT' ? (
                                    <span className="currency-prefix-v2">{cs}</span>
                                ) : (
                                    <span className="percent-prefix-v2">%</span>
                                )}
                                <input
                                    type="number"
                                    className="premium-input-v2"
                                    min="0"
                                    max={manualDiscountType === 'PERCENTAGE' ? 100 : grossTotal}
                                    value={manualDiscountValue}
                                    onChange={(e) => {
                                        const rawValue = e.target.value;
                                        if (rawValue === '') {
                                            onManualDiscountChange('');
                                            return;
                                        }

                                        const value = Math.max(0, parseFloat(rawValue) || 0);
                                        const capped = manualDiscountType === 'PERCENTAGE'
                                            ? Math.min(value, 100)
                                            : Math.min(value, grossTotal);
                                        onManualDiscountChange(capped);
                                    }}
                                    placeholder={manualDiscountType === 'PERCENTAGE' ? 'Enter discount %' : 'Enter discount amount'}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="card-body-right">
                        <div className="payment-progress-container-v2">
                            <div className="progress-bar-bg-v2">
                                <div
                                    className="progress-bar-fill-v2"
                                    style={{ width: `${paidPercentage}%` }}
                                ></div>
                            </div>
                            <span className="progress-label-v2">{paidPercentage}% Collected</span>
                        </div>

                        <div className="toggle-group-v2">
                            <div className="premium-checkbox-row">
                                <input
                                    type="checkbox"
                                    id="taxExempt"
                                    checked={taxExempt}
                                    onChange={(e) => onTaxExemptChange(e.target.checked)}
                                />
                                <label htmlFor="taxExempt">Tax Exempt</label>
                            </div>

                            <div className="premium-checkbox-row">
                                <input
                                    type="checkbox"
                                    id="markPaid"
                                    checked={isFullyPaid}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            onPaidAmountChange(totalAmount);
                                        } else {
                                            onPaidAmountChange(0);
                                        }
                                    }}
                                />
                                <label htmlFor="markPaid">Mark as Fully Paid</label>
                            </div>
                        </div>

                        <div className={`due-box-v2 ${balanceDue > 0 ? 'has-due' : 'is-clear'}`}>
                            <span className="due-icon">⚠️</span>
                            <span className="due-label">DUE: {cs}{balanceDue.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>

                {manualDiscount > 0 && (
                    <div className="discount-applied-note-v2">
                        Discount Applied: {cs}{manualDiscount.toLocaleString('en-IN')} ({manualDiscountPercent.toFixed(2)}%)
                    </div>
                )}
            </div>
        </div>
    );
};

export default BillingSummary;

