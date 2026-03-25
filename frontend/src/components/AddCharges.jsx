import React, { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import './AddCharges.css';
import { DEFAULT_CHARGE_OPTIONS, getAllChargeOptions } from '../utils/chargeTypeOptions';

// Maps a charge type value to its discount category used in discount rules
const CHARGE_CATEGORY_MAP = {
    laundry: 'LAUNDRY',
    dry_cleaning: 'LAUNDRY',
    spa_wellness: 'SPA',
    gym_access: 'SPA',
    pool_access: 'SPA',
    bar: 'FOOD',
};

const AddCharges = ({ onClose, onAdd, reservation }) => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        folio: reservation ? `${reservation.roomNumber} - ${reservation.guestName}` : '102 - Guest',
        chargeType: '',
        currency: 'INR',
        amount: '',
        quantity: '1',
        description: '',
        comment: ''
    });

    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Discount states
    const [discountType, setDiscountType] = useState('PERCENTAGE');
    const [discountValue, setDiscountValue] = useState('');
    const [discountSource, setDiscountSource] = useState('');

    const [chargeOptions, setChargeOptions] = useState(() => getAllChargeOptions());
    const [showAddCustom, setShowAddCustom] = useState(false);
    const [newCustomLabel, setNewCustomLabel] = useState('');
    const [showChargeDropdown, setShowChargeDropdown] = useState(false);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showChargeDropdown && !e.target.closest('.modern-select-wrapper')) {
                setShowChargeDropdown(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showChargeDropdown]);

    useEffect(() => {
        const normalizedType = String(formData.chargeType || '').toUpperCase();
        const mappedCategory = CHARGE_CATEGORY_MAP[formData.chargeType];
        const matchedCategories = [mappedCategory, normalizedType].filter(Boolean);

        if (matchedCategories.length === 0) {
            setDiscountValue('');
            setDiscountSource('');
            setDiscountType('PERCENTAGE');
            return;
        }
        try {
            const discounts = JSON.parse(localStorage.getItem('discounts') || '[]');
            const matchByCategory = (discount) =>
                discount.status === 'ACTIVE' &&
                Array.isArray(discount.appliesTo) &&
                discount.appliesTo.some(category => matchedCategories.includes(String(category || '').toUpperCase()));

            // Priority: auto-apply discounts first. If none found, fall back to any active matching discount.
            const match = discounts.find(
                d => d.status === 'ACTIVE' && d.autoApply &&
                    Array.isArray(d.appliesTo) &&
                    d.appliesTo.some(category => matchedCategories.includes(String(category || '').toUpperCase()))
            ) || discounts.find(matchByCategory);

            if (match) {
                setDiscountType(match.type === 'FLAT' ? 'FLAT' : 'PERCENTAGE');
                setDiscountValue(String(match.value));
                setDiscountSource(match.name);
            } else {
                setDiscountValue('');
                setDiscountSource('');
                setDiscountType('PERCENTAGE');
            }
        } catch { }
    }, [formData.chargeType]);

    const totalAmount = (parseFloat(formData.amount) || 0) * (parseInt(formData.quantity) || 1);
    const discAmt = discountValue
        ? discountType === 'PERCENTAGE'
            ? Math.round(totalAmount * (parseFloat(discountValue) || 0) / 100)
            : parseFloat(discountValue) || 0
        : 0;
    const netAmount = Math.max(0, totalAmount - discAmt);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    };

    const handleAddCustomChargeType = () => {
        const trimmed = newCustomLabel.trim();
        if (!trimmed) return;
        const value = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        if (chargeOptions.some(o => o.value === value)) {
            alert('A charge type with this name already exists.');
            return;
        }
        const newOpt = { value, label: trimmed, isCustom: true, icon: '🏷️' };
        const updated = [...chargeOptions, newOpt];
        setChargeOptions(updated);
        const custom = updated.filter(o => o.isCustom);
        localStorage.setItem('customChargeTypes', JSON.stringify(custom));
        setNewCustomLabel('');
        setShowAddCustom(false);
        handleChange('chargeType', value);
    };

    const handleRemoveChargeOption = (optionValue) => {
        const updated = chargeOptions.filter(o => o.value !== optionValue);
        setChargeOptions(updated);
        
        // Update localStorage for custom types
        const custom = updated.filter(o => o.isCustom);
        localStorage.setItem('customChargeTypes', JSON.stringify(custom));
        
        // Clear form if this option was selected
        if (formData.chargeType === optionValue) {
            handleChange('chargeType', '');
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.date) newErrors.date = 'Required';
        if (!formData.chargeType) newErrors.chargeType = 'Required';
        if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = 'Invalid';
        if (!formData.quantity || parseInt(formData.quantity) <= 0) newErrors.quantity = 'Invalid';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        setIsSubmitting(true);
        try {
            const chargeData = {
                id: Date.now(),
                ...formData,
                amount: parseFloat(formData.amount),
                quantity: parseInt(formData.quantity),
                totalAmount, discAmt, netAmount,
                discountType: discountValue ? discountType : null,
                discountValue: discountValue ? Number(discountValue) : 0,
                discountSource: discountSource || '',
                timestamp: new Date().toISOString()
            };
            if (onAdd) await onAdd(chargeData);
            setTimeout(() => onClose(), 500);
        } catch (error) {
            console.error(error);
            setIsSubmitting(false);
        }
    };

    const balance = reservation ? (
        reservation.balanceDue !== undefined ? reservation.balanceDue :
            (reservation.remainingAmount || (reservation.totalAmount - (reservation.paidAmount || reservation.advancePaid || 0)))
    ) : 0;

    return (
        <div className="add-payment-overlay" onClick={onClose}>
            <div className="add-payment-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="premium-payment-header">
                    <div className="header-icon-wrap">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"></path></svg>
                    </div>
                    <div className="header-text">
                        <h3>Add Charges</h3>
                        <span>Apply extra services to folio</span>
                    </div>
                    <button className="premium-close-btn" onClick={onClose}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="add-payment-body">
                    {/* Reservation Card */}
                    {reservation && (
                        <div className="payment-summary-card">
                            <div className="summary-header">
                                <span className="ref-tag">FOLIO DETAILS</span>
                                <span className="ref-number">{reservation.bookingId || 'BKG-552'}</span>
                            </div>
                            <div className="summary-details">
                                <div className="detail-col">
                                    <label>Guest</label>
                                    <p className="truncate-text">{reservation.guestName || 'Valued Guest'}</p>
                                </div>
                                <div className="detail-col-group">
                                    <div className="detail-sub-col">
                                        <label>Room</label>
                                        <p>{reservation.roomNumber || '102'}</p>
                                    </div>
                                    <div className="detail-sub-col text-right">
                                        <label>Current Balance</label>
                                        <p className="balance-text-bold">{cs}{balance.toLocaleString('en-IN')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Form Content */}
                    <div className="payment-field-group">
                        <label className="field-label-premium">Service Date</label>
                        <input type="date" value={formData.date} onChange={(e) => handleChange('date', e.target.value)} />
                    </div>

                    <div className="payment-field-group">
                        <label className="field-label-premium">Select Charge Type</label>
                        <div className="modern-select-wrapper" style={{ position: 'relative' }}>
                            <button
                                type="button"
                                className="premium-dropdown-select"
                                onClick={() => setShowChargeDropdown(!showChargeDropdown)}
                                style={{ textAlign: 'left', background: 'white', border: '1px solid #d1d5db', cursor: 'pointer' }}
                            >
                                {formData.chargeType ? chargeOptions.find(o => o.value === formData.chargeType)?.label || 'Choose a service...' : 'Choose a service...'}
                            </button>
                            <div className="select-arrow">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                            
                            {showChargeDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '1px solid #d1d5db',
                                    borderTop: 'none',
                                    borderRadius: '0 0 6px 6px',
                                    zIndex: 10,
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}>
                                    {chargeOptions.map((opt, idx) => (
                                        <div
                                            key={opt.value}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '12px 16px',
                                                borderBottom: idx < chargeOptions.length - 1 ? '1px solid #f0f0f0' : 'none',
                                                cursor: 'pointer',
                                                background: formData.chargeType === opt.value ? '#f0f9ff' : 'white'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = formData.chargeType === opt.value ? '#e0f2fe' : '#f5f5f5'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = formData.chargeType === opt.value ? '#f0f9ff' : 'white'}
                                        >
                                            <span
                                                onClick={() => {
                                                    handleChange('chargeType', opt.value);
                                                    setShowChargeDropdown(false);
                                                }}
                                                style={{ flex: 1, fontSize: '14px' }}
                                            >
                                                {opt.icon} {opt.label}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveChargeOption(opt.value);
                                                }}
                                                style={{
                                                    background: '#fee2e2',
                                                    border: '1px solid #fca5a5',
                                                    color: '#dc2626',
                                                    width: '26px',
                                                    height: '26px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    transition: 'all 0.2s'
                                                }}
                                                title="Remove this option"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                    
                                    <div
                                        onClick={() => { setShowAddCustom(true); setShowChargeDropdown(false); }}
                                        style={{
                                            padding: '12px 16px',
                                            background: '#fef2f2',
                                            color: '#e11d48',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            borderTop: '1px solid #f0f0f0'
                                        }}
                                    >
                                        ＋ Add Custom Type...
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {showAddCustom && (
                        <div className="custom-type-entry animate-in">
                            <input
                                value={newCustomLabel}
                                onChange={(e) => setNewCustomLabel(e.target.value)}
                                placeholder="Minibar, Extra Bed, etc..."
                            />
                            <button onClick={handleAddCustomChargeType}>Add</button>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div className="payment-field-group" style={{ flex: 2 }}>
                            <label className="field-label-premium">Amount per unit</label>
                            <div className="amount-input-container">
                                <span className="currency-indicator">{cs}</span>
                                <input
                                    type="number"
                                    className="amount-input-field"
                                    value={formData.amount}
                                    onChange={(e) => handleChange('amount', e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="payment-field-group" style={{ flex: 1 }}>
                            <label className="field-label-premium">Qty</label>
                            <input
                                type="number"
                                value={formData.quantity}
                                onChange={(e) => handleChange('quantity', e.target.value)}
                                min="1"
                            />
                        </div>
                    </div>

                    {/* Discount Box */}
                    <div className="new-balance-preview animate-in discount-ui-box" style={{ background: '#f0f9ff', borderColor: '#bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="preview-label discount-ui-label" style={{ color: '#0369a1', flex: 1 }}>
                            <div>Discount</div>
                            {discountSource && <span className="discount-auto-source">(Auto: {discountSource})</span>}
                        </div>
                        <div className="discount-ui-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div className="disc-toggle">
                                <button className={discountType === 'PERCENTAGE' ? 'active' : ''} onClick={() => setDiscountType('PERCENTAGE')}>%</button>
                                <button className={discountType === 'FLAT' ? 'active' : ''} onClick={() => setDiscountType('FLAT')}>{cs}</button>
                            </div>
                            <input
                                type="number"
                                className="disc-val-input"
                                value={discountValue}
                                onChange={(e) => setDiscountValue(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    {totalAmount > 0 && (
                        <div className="gross-net-preview animate-in">
                            <div className="preview-row">
                                <span>Gross Total</span>
                                <span>{cs}{totalAmount.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="preview-row net">
                                <span>Net Charge</span>
                                <span>{cs}{netAmount.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    )}

                    <div className="payment-field-group">
                        <label className="field-label-premium">Short Description</label>
                        <input value={formData.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="e.g. Laundry 2 shirts" />
                    </div>
                </div>

                <div className="payment-modal-footer">
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <div className="spinner-small" /> : 'Confirm Charge'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddCharges;
