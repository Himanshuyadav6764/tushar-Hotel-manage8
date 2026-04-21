import React, { useState, useEffect, useRef } from 'react';
import './DiscountManagement.css';
import { useSettings } from '../../context/SettingsContext';
import { buildLinkedAppliesToOptions, getAllChargeOptions } from '../../utils/chargeTypeOptions';

const DiscountManagement = () => {
    const { getCurrencySymbol, settings } = useSettings();
    const cs = getCurrencySymbol();
    const maxDiscount = parseFloat(settings?.discountRules?.maxDiscount) || 0;
    const maxDiscountType = settings?.discountRules?.maxDiscountType || 'PERCENTAGE';
    const [discounts, setDiscounts] = useState([]);
    const [selectedDiscount, setSelectedDiscount] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        type: 'PERCENTAGE',
        value: '',
        appliesTo: ['ROOM'],
        autoApply: false,
        status: 'ACTIVE',
        description: ''
    });
    const [formErrors, setFormErrors] = useState({});
    const [openMenuId, setOpenMenuId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showAppliesTo, setShowAppliesTo] = useState(false);
    const [showDiscountTypeDropdown, setShowDiscountTypeDropdown] = useState(false);
    const menuRef = useRef(null);
    const discountTypeRef = useRef(null);

    const [applyToOptions, setApplyToOptions] = useState(() => buildLinkedAppliesToOptions(getAllChargeOptions()));
    const [isAddingApplyTo, setIsAddingApplyTo] = useState(false);
    const [newApplyTo, setNewApplyTo] = useState('');

    // Load discounts from localStorage on mount
    useEffect(() => {
        const syncApplyToOptions = () => {
            const linked = buildLinkedAppliesToOptions(getAllChargeOptions());
            setApplyToOptions(linked);
        };

        syncApplyToOptions();
        window.addEventListener('storage', syncApplyToOptions);

        const storedDiscounts = localStorage.getItem('discounts');
        if (storedDiscounts) {
            setDiscounts(JSON.parse(storedDiscounts));
        } else {
            // Sample initial data
            const sampleDiscounts = [
                {
                    id: 1,
                    name: 'Early Bird Special',
                    type: 'PERCENTAGE',
                    value: 15,
                    appliesTo: ['ROOM'],
                    autoApply: false,
                    status: 'ACTIVE',
                    description: '15% discount for bookings made 30 days in advance'
                },
                {
                    id: 2,
                    name: 'Weekend Food Offer',
                    type: 'FLAT',
                    value: 500,
                    appliesTo: ['FOOD'],
                    autoApply: true,
                    status: 'ACTIVE',
                    description: 'Flat ₹500 off on food orders during weekend'
                },
                {
                    id: 3,
                    name: 'Spa Package Discount',
                    type: 'PERCENTAGE',
                    value: 20,
                    appliesTo: ['SPA'],
                    autoApply: false,
                    status: 'INACTIVE',
                    description: '20% off on spa services package'
                }
            ];
            setDiscounts(sampleDiscounts);
            localStorage.setItem('discounts', JSON.stringify(sampleDiscounts));
        }

        return () => {
            window.removeEventListener('storage', syncApplyToOptions);
        };
    }, []);

    useEffect(() => {
        if (showModal) {
            setApplyToOptions(buildLinkedAppliesToOptions(getAllChargeOptions()));
        }
    }, [showModal]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpenMenuId(null);
            }

            if (discountTypeRef.current && !discountTypeRef.current.contains(event.target)) {
                setShowDiscountTypeDropdown(false);
            }
        };

        if (openMenuId !== null) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openMenuId]);

    const saveToLocalStorage = (data) => {
        localStorage.setItem('discounts', JSON.stringify(data));
    };

    const handleAddApplyTo = () => {
        if (!newApplyTo.trim()) return;
        const id = newApplyTo.trim().toUpperCase().replace(/\s+/g, '_');

        if (applyToOptions.some(opt => opt.id === id)) {
            // Already exists, just select it if not selected
            if (!formData.appliesTo.includes(id)) {
                setFormData({ ...formData, appliesTo: [...formData.appliesTo, id] });
            }
            setIsAddingApplyTo(false);
            setNewApplyTo('');
            return;
        }

        const newOption = { id: id, label: newApplyTo.trim() };
        setApplyToOptions([...applyToOptions, newOption]);
        setFormData({ ...formData, appliesTo: [...formData.appliesTo, id] });
        setIsAddingApplyTo(false);
        setNewApplyTo('');
    };

    const validateForm = () => {
        const errors = {};

        if (!formData.name.trim()) {
            errors.name = 'Discount name is required';
        }

        if (!formData.value || formData.value <= 0) {
            errors.value = 'Please enter a valid discount value';
        }

        if (formData.type === 'PERCENTAGE' && formData.value > 100) {
            errors.value = 'Percentage cannot exceed 100%';
        }

        // Enforce company max discount limit
        if (maxDiscount > 0 && formData.value > 0) {
            if (formData.type === 'PERCENTAGE' && maxDiscountType === 'PERCENTAGE') {
                if (parseFloat(formData.value) > maxDiscount) {
                    errors.value = `Discount cannot exceed the company max limit of ${maxDiscount}%`;
                }
            } else if (formData.type === 'FLAT' && maxDiscountType === 'FLAT') {
                if (parseFloat(formData.value) > maxDiscount) {
                    errors.value = `Discount cannot exceed the company max limit of ${cs}${maxDiscount}`;
                }
            }
        }

        if (formData.appliesTo.length === 0) {
            errors.appliesTo = 'Please select at least one category';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveDiscount = () => {
        if (!validateForm()) {
            return;
        }

        let updatedDiscounts;

        if (isEditMode && selectedDiscount) {
            // Update existing discount
            updatedDiscounts = discounts.map(discount =>
                discount.id === selectedDiscount.id
                    ? { ...formData, id: discount.id }
                    : discount
            );
        } else {
            // Add new discount
            const newDiscount = {
                ...formData,
                id: Date.now()
            };
            updatedDiscounts = [...discounts, newDiscount];
        }

        setDiscounts(updatedDiscounts);
        saveToLocalStorage(updatedDiscounts);
        handleResetForm();
        setShowModal(false);
    };

    const handleEditDiscount = (discount) => {
        setShowModal(true);
        setSelectedDiscount(discount);
        setIsEditMode(true);
        setFormData({
            name: discount.name,
            type: discount.type,
            value: discount.value,
            appliesTo: [...discount.appliesTo],
            autoApply: discount.autoApply,
            status: discount.status,
            description: discount.description
        });
        setFormErrors({});
        setOpenMenuId(null);
    };

    const handleCreateDiscount = () => {
        handleResetForm();
        setShowModal(true);
    };

    const handleToggleStatus = (id) => {
        const updatedDiscounts = discounts.map(discount =>
            discount.id === id
                ? { ...discount, status: discount.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
                : discount
        );
        setDiscounts(updatedDiscounts);
        saveToLocalStorage(updatedDiscounts);
    };

    const handleRemoveDiscount = (id) => {
        const updatedDiscounts = discounts.filter(discount => discount.id !== id);
        setDiscounts(updatedDiscounts);
        saveToLocalStorage(updatedDiscounts);
        setOpenMenuId(null);

        // If the deleted discount was selected, reset form
        if (selectedDiscount && selectedDiscount.id === id) {
            handleResetForm();
        }
    };

    const toggleMenu = (id) => {
        setOpenMenuId(openMenuId === id ? null : id);
    };

    const handleResetForm = () => {
        setFormData({
            name: '',
            type: 'PERCENTAGE',
            value: '',
            appliesTo: ['ROOM'],
            autoApply: false,
            status: 'ACTIVE',
            description: ''
        });
        setSelectedDiscount(null);
        setIsEditMode(false);
        setFormErrors({});
        setIsAddingApplyTo(false);
        setNewApplyTo('');
    };

    const handleCheckboxChange = (optionId) => {
        setFormData(prev => ({
            ...prev,
            appliesTo: prev.appliesTo.includes(optionId)
                ? prev.appliesTo.filter(id => id !== optionId)
                : [...prev.appliesTo, optionId]
        }));
    };

    const handleDeleteApplyToOption = (optionId) => {
        if (optionId === 'ROOM' || optionId === 'FOOD') {
            return;
        }

        setApplyToOptions(prev => prev.filter(option => option.id !== optionId));
        setFormData(prev => ({
            ...prev,
            appliesTo: prev.appliesTo.filter(id => id !== optionId)
        }));
    };

    return (
        <div className="discount-management-page">
            <div className="dining-header">
                <div className="header-content">
                    <h1 className="page-title">Discount Management</h1>
                    <p className="subtitle">Manage discount rules and offers for your hotel</p>
                </div>
                <button
                    className="add-table-btn"
                    onClick={handleCreateDiscount}
                >
                    + CREATE DISCOUNT
                </button>
            </div>

            <div className="discount-main-layout">
                {/* FULL WIDTH - Discount List */}
                <div className="discount-left-section">
                    <div className="discount-list-header">
                        <h2>Discount Rules</h2>
                        <span className="discount-count">{discounts.length} {discounts.length === 1 ? 'Discount' : 'Discounts'}</span>
                    </div>

                    <div className="discount-table-container">
                        <table className="discount-table">
                            <thead>
                                <tr>
                                    <th>Discount Name</th>
                                    <th>Type</th>
                                    <th>Value</th>
                                    <th>Applies To</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {discounts.length > 0 ? (
                                    discounts.map(discount => (
                                        <tr
                                            key={discount.id}
                                            className={selectedDiscount?.id === discount.id ? 'selected-row' : ''}
                                        >
                                            <td>
                                                <div className="discount-name-cell">
                                                    <span className="discount-name">{discount.name}</span>
                                                    {discount.autoApply && (
                                                        <span className="auto-apply-badge">Auto</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`type-badge ${discount.type.toLowerCase()}`}>
                                                    {discount.type === 'PERCENTAGE' ? 'Percentage' : 'Flat Amount'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="discount-value">
                                                    {discount.type === 'PERCENTAGE'
                                                        ? `${discount.value}%`
                                                        : `${cs}${discount.value}`}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="applies-to-tags">
                                                    {discount.appliesTo.map((category, idx) => (
                                                        <span key={idx} className="category-tag">
                                                            {applyToOptions.find(opt => opt.id === category)?.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td>
                                                <button
                                                    className={`status-toggle ${discount.status.toLowerCase()}`}
                                                    onClick={() => handleToggleStatus(discount.id)}
                                                >
                                                    <span className="status-indicator"></span>
                                                    {discount.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                                </button>
                                            </td>
                                            <td className="actions-cell">
                                                <div className="action-menu-wrapper" ref={openMenuId === discount.id ? menuRef : null}>
                                                    <button
                                                        className="btn-menu"
                                                        onClick={() => toggleMenu(discount.id)}
                                                    >
                                                        ⋮
                                                    </button>
                                                    {openMenuId === discount.id && (
                                                        <div className="action-menu-dropdown">
                                                            <button
                                                                className="menu-item"
                                                                onClick={() => {
                                                                    handleEditDiscount(discount);
                                                                    setOpenMenuId(null);
                                                                }}
                                                            >
                                                                ✏️ Edit
                                                            </button>
                                                            <button
                                                                className="menu-item remove"
                                                                onClick={() => handleRemoveDiscount(discount.id)}
                                                            >
                                                                🗑️ Remove
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="no-data">
                                            <div className="no-data-content">
                                                <span className="no-data-icon">📋</span>
                                                <p>No discounts created yet</p>
                                                <p className="no-data-hint">Create your first discount using the button above</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                {/* Centered Premium Modal */}
                {showModal && (
                    <div className="add-payment-overlay">
                        <div className="add-payment-modal add-discount-premium">
                            <div className="premium-payment-header">
                                <div className="header-icon-wrap">
                                    <span style={{ fontSize: '20px' }}>🏷️</span>
                                </div>
                                <div className="header-text">
                                    <h3>{isEditMode ? 'Edit Discount' : 'Create Discount'}</h3>
                                    <span>OFFERS & RULES</span>
                                </div>
                                <button className="premium-close-btn" onClick={() => setShowModal(false)}>✕</button>
                            </div>

                            <div className="add-payment-body scrollable-modal-body">
                                <div className="discount-form">
                                    {/* Discount Name */}
                                    <div className="payment-field-group">
                                        <label className="field-label-premium">DISCOUNT NAME <span className="required">*</span></label>
                                        <input
                                            type="text"
                                            placeholder="e.g., Early Bird Special"
                                            value={formData.name}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (/^[A-Za-z\s]*$/.test(value)) {
                                                    setFormData({ ...formData, name: value });
                                                }
                                            }}
                                            className={`premium-input ${formErrors.name ? 'error' : ''}`}
                                        />
                                        {formErrors.name && <span className="error-message">{formErrors.name}</span>}
                                    </div>

                                    {/* Discount Type */}
                                    <div className="payment-field-group">
                                        <label className="field-label-premium">DISCOUNT TYPE <span className="required">*</span></label>
                                        <div className="discount-type-dropdown" ref={discountTypeRef}>
                                            <button
                                                type="button"
                                                className="premium-input discount-type-trigger"
                                                onClick={() => setShowDiscountTypeDropdown((prev) => !prev)}
                                            >
                                                <span>{formData.type === 'PERCENTAGE' ? 'Percentage (%)' : `Flat Amount (${cs})`}</span>
                                                <span className={`discount-type-arrow ${showDiscountTypeDropdown ? 'open' : ''}`}>▼</span>
                                            </button>

                                            {showDiscountTypeDropdown && (
                                                <div className="discount-type-options">
                                                    <button
                                                        type="button"
                                                        className="discount-type-option"
                                                        onClick={() => {
                                                            setFormData({ ...formData, type: 'PERCENTAGE', value: '' });
                                                            setShowDiscountTypeDropdown(false);
                                                        }}
                                                    >
                                                        Percentage (%)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="discount-type-option"
                                                        onClick={() => {
                                                            setFormData({ ...formData, type: 'FLAT', value: '' });
                                                            setShowDiscountTypeDropdown(false);
                                                        }}
                                                    >
                                                        Flat Amount ({cs})
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Discount Value */}
                                    <div className="payment-field-group">
                                        <label className="field-label-premium">
                                            DISCOUNT VALUE <span className="required">*</span>
                                            {formData.type === 'PERCENTAGE' && (
                                                <span style={{ color: '#d41424', fontSize: '0.7rem', marginLeft: '8px' }}>
                                                    (0-{maxDiscountType === 'PERCENTAGE' && maxDiscount > 0 ? maxDiscount : 100}%)
                                                </span>
                                            )}
                                            {formData.type === 'FLAT' && maxDiscountType === 'FLAT' && maxDiscount > 0 && (
                                                <span style={{ color: '#d41424', fontSize: '0.7rem', marginLeft: '8px' }}> (Max {cs}{maxDiscount})</span>
                                            )}
                                        </label>
                                        <div className="premium-input-wrap">
                                            {formData.type === 'FLAT' && <span className="input-prefix" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: '1', color: '#64748b', fontWeight: 'bold' }}>{cs}</span>}
                                            <input
                                                type="number"
                                                placeholder={formData.type === 'PERCENTAGE' ? 'Enter percentage' : 'Enter amount'}
                                                value={formData.value}
                                                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                                style={{ paddingLeft: formData.type === 'FLAT' ? '30px' : '16px' }}
                                                className={`premium-input ${formErrors.value ? 'error' : ''}`}
                                            />
                                            {formData.type === 'PERCENTAGE' && <span className="input-suffix" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 'bold' }}>%</span>}
                                        </div>
                                        {formErrors.value && <span className="error-message">{formErrors.value}</span>}
                                    </div>

                                    {/* Applies To */}
                                    <div className="payment-field-group">
                                        <label className="field-label-premium">APPLIES TO <span className="required">*</span></label>
                                        {!isAddingApplyTo ? (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <div
                                                    className="premium-input"
                                                    onClick={() => setShowAppliesTo(!showAppliesTo)}
                                                    style={{ flex: 1, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                >
                                                    <span>
                                                        {formData.appliesTo.length > 0
                                                            ? `${formData.appliesTo.length} selected`
                                                            : 'Select categories'}
                                                    </span>
                                                    <span>{showAppliesTo ? '▲' : '▼'}</span>
                                                </div>
                                                <button
                                                    className="btn-primary"
                                                    onClick={() => setIsAddingApplyTo(true)}
                                                    style={{ width: '45px', minWidth: '45px', padding: '0' }}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    type="text"
                                                    className="premium-input"
                                                    placeholder="Enter new category..."
                                                    value={newApplyTo}
                                                    onChange={(e) => setNewApplyTo(e.target.value)}
                                                    autoFocus
                                                    style={{ flex: 1 }}
                                                />
                                                <button
                                                    className="btn-primary"
                                                    onClick={handleAddApplyTo}
                                                    style={{ width: '45px', minWidth: '45px', padding: '0' }}
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-secondary"
                                                    onClick={() => { setIsAddingApplyTo(false); setNewApplyTo(''); }}
                                                    style={{ width: '45px', minWidth: '45px', padding: '0' }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                        {showAppliesTo && !isAddingApplyTo && (
                                            <div className="checkbox-grid-group-premium">
                                                {applyToOptions.map(option => (
                                                    <div key={option.id} className={`checkbox-item-premium ${formData.appliesTo.includes(option.id) ? 'checked' : ''}`}>
                                                        <label className="checkbox-label-row">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.appliesTo.includes(option.id)}
                                                                onChange={() => handleCheckboxChange(option.id)}
                                                            />
                                                            <span className="checkbox-label">{option.label}</span>
                                                        </label>
                                                        <button
                                                            type="button"
                                                            className="checkbox-delete-btn"
                                                            onClick={() => handleDeleteApplyToOption(option.id)}
                                                            disabled={option.locked}
                                                            title="Delete category"
                                                            aria-label={`Delete ${option.label}`}
                                                        >
                                                            x
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {formErrors.appliesTo && <span className="error-message">{formErrors.appliesTo}</span>}
                                    </div>

                                    {/* Description */}
                                    <div className="payment-field-group">
                                        <label className="field-label-premium">DESCRIPTION</label>
                                        <div className="premium-input-wrap">
                                            <textarea
                                                className="premium-input premium-textarea"
                                                placeholder="Add description or terms and conditions..."
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                rows="2"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="payment-modal-footer">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowModal(false)}
                                >
                                    CANCEL
                                </button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={handleSaveDiscount}
                                >
                                    {isEditMode ? 'UPDATE DISCOUNT' : 'SAVE DISCOUNT'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DiscountManagement;
