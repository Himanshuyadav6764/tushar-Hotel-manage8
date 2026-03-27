import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    FaBars,
    FaHotel,
    FaMapMarkerAlt,
    FaPhone,
    FaFileInvoice,
    FaStar,
    FaClock,
    FaUser,
    FaEnvelope,
    FaLock,
    FaPlus,
    FaEye,
    FaEyeSlash
} from 'react-icons/fa';
import { MdDashboard, MdLogout } from 'react-icons/md';
import './SuperAdminDashboard.css';

const ADMIN_SCREEN_OPTIONS = [
    'Dashboard',
    'Reservations',
    'Rooms (Dashboard)',
    'Rooms (New Reservation)',
    'Room Service',
    'Housekeeping',
    'Reservation Card',
    'Food Order',
    'Cashier Section (Table)',
    'Cashier Section (Room Service)',
    'Cashier Section (Take Away)',
    'Table View',
    'KOT Order',
    'View order',
    'Customer List',
    'Cashier Logs',
    'Payment Logs',
    'Reports',
    'Property Configuration',
    'CRM Model',
    'Settings'
];

const PROPERTY_SETUP_OPTIONS = [
    'Property Setup (All)',
    'Property Setup - Discount',
    'Property Setup - Generate Room QR'
];

const PROPERTY_CONFIG_OPTIONS = [
    'Property Configuration (All)',
    'Property Configuration - Floor Setup',
    'Property Configuration - Room Facilities Type',
    'Property Configuration - Meal Type',
    'Property Configuration - Reservation Type',
    'Property Configuration - Extra Charges',
    'Property Configuration - Complimentary Services',
    'Property Configuration - Customer Identity',
    'Property Configuration - Booking Source',
    'Property Configuration - Business Source',
    'Property Configuration - Maintenance Block',
    'Property Configuration - Table Management',
    'Property Configuration - Company Settings'
];

const REPORT_OPTIONS = [
    'Reports (All)',
    'Reports - Sales',
    'Reports - Payments',
    'Reports - Rooms',
    'Reports - Kitchen',
    'Reports - GST',
    'Reports - Staff',
    'Reports - Billing',
    'Reports - Reservations',
    'Reports - Analytics'
];

const expandPermissionSelections = (labels = []) => {
    const selected = new Set(labels);

    if (selected.has('Property Setup (All)')) {
        PROPERTY_SETUP_OPTIONS.forEach((label) => selected.add(label));
        selected.add('Property Setup');
    }

    if (selected.has('Property Configuration (All)')) {
        PROPERTY_CONFIG_OPTIONS.forEach((label) => selected.add(label));
        selected.add('Property Configuration');
    }

    if (selected.has('Reports (All)')) {
        REPORT_OPTIONS.forEach((label) => selected.add(label));
        selected.add('Reports');
    }

    return Array.from(selected);
};

const MultiPermissionPicker = ({
    title,
    options,
    selectedOptions,
    setSelectedOptions,
    onAdd,
    description
}) => {
    const allLabel = options.find((label) => /\(All\)/i.test(label));

    const toggleOption = (label) => {
        setSelectedOptions((prev) => {
            const prevSet = new Set(prev);

            if (allLabel && label === allLabel) {
                if (prevSet.has(allLabel)) {
                    return [];
                }
                return [...options];
            }

            if (prevSet.has(label)) {
                prevSet.delete(label);
            } else {
                prevSet.add(label);
            }

            if (allLabel) {
                const allChildrenSelected = options
                    .filter((item) => item !== allLabel)
                    .every((item) => prevSet.has(item));

                if (allChildrenSelected) {
                    prevSet.add(allLabel);
                } else {
                    prevSet.delete(allLabel);
                }
            }

            return Array.from(prevSet);
        });
    };

    return (
        <div className="multi-permission-picker" style={{ marginTop: '14px' }}>
            <label className="mpp-title" style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '700',
                color: '#1f2937',
                marginBottom: '8px'
            }}>
                {title}
            </label>

            <div className="mpp-box" style={{
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                background: '#fff',
                overflow: 'hidden'
            }}>
                <div className="mpp-head" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '10px 12px',
                    borderBottom: '1px solid #f1f5f9',
                    background: '#f8fafc'
                }}>
                    <div className="mpp-count" style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                        {selectedOptions.length} selected
                    </div>
                    <div className="mpp-actions" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => setSelectedOptions([...options])}
                            className="mpp-btn mpp-btn-neutral"
                            style={{
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#334155',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                padding: '5px 8px',
                                cursor: 'pointer'
                            }}
                        >
                            Select All
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedOptions([])}
                            className="mpp-btn mpp-btn-neutral"
                            style={{
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#334155',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                padding: '5px 8px',
                                cursor: 'pointer'
                            }}
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={onAdd}
                            className="mpp-btn mpp-btn-primary"
                            style={{
                                border: 'none',
                                background: '#e11d48',
                                color: '#fff',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '700',
                                padding: '6px 10px',
                                cursor: 'pointer'
                            }}
                        >
                            Add Selected
                        </button>
                    </div>
                </div>

                <div className="mpp-options" style={{
                    padding: '10px',
                    maxHeight: '170px',
                    overflowY: 'auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '8px'
                }}>
                    {options.map((label) => {
                        const checked = selectedOptions.includes(label);
                        return (
                            <label
                                key={label}
                                className="mpp-option"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '13px',
                                    color: '#1f2937',
                                    cursor: 'pointer',
                                    background: checked ? '#fff1f2' : '#fff',
                                    border: checked ? '1px solid #fb7185' : '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    padding: '8px 10px'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleOption(label)}
                                    style={{ cursor: 'pointer' }}
                                />
                                <span>{label}</span>
                            </label>
                        );
                    })}
                </div>
            </div>

            <p className="mpp-description" style={{
                margin: '8px 0 0 0',
                fontSize: '12px',
                color: '#6b7280'
            }}>
                {description}
            </p>
        </div>
    );
};

const CreateHotel = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const [selectedPropertySetupOptions, setSelectedPropertySetupOptions] = useState([]);
    const [selectedPropertyConfigOptions, setSelectedPropertyConfigOptions] = useState([]);
    const [selectedReportOptions, setSelectedReportOptions] = useState([]);

    const [formData, setFormData] = useState({
        hotelName: '',
        address: '',
        gstNumber: '',
        phone: '',
        subscriptionPlan: 'basic',
        subscriptionDuration: '12',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        adminPhone: '',
        adminPermissions: []
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
        setError('');
    };

    const toggleAdminPermission = (permissionLabel) => {
        setFormData((prev) => {
            const alreadySelected = prev.adminPermissions.includes(permissionLabel);
            const nextPermissions = alreadySelected
                ? prev.adminPermissions.filter((item) => item !== permissionLabel)
                : [...prev.adminPermissions, permissionLabel];

            return {
                ...prev,
                adminPermissions: nextPermissions
            };
        });
        setError('');
    };

    const addSelectedPermissions = (labels) => {
        if (!Array.isArray(labels) || labels.length === 0) return;
        setFormData((prev) => {
            const nextPermissions = [...new Set([...prev.adminPermissions, ...expandPermissionSelections(labels)])];
            return {
                ...prev,
                adminPermissions: nextPermissions
            };
        });
        setError('');
    };

    const addPropertySetupPermission = () => {
        addSelectedPermissions(selectedPropertySetupOptions);
    };

    const addPropertyConfigPermission = () => {
        addSelectedPermissions(selectedPropertyConfigOptions);
    };

    const addReportsPermission = () => {
        addSelectedPermissions(selectedReportOptions);
    };

    const validateForm = () => {
        // Validate hotel name
        if (formData.hotelName.trim().length < 3) {
            setError('Hotel name must be at least 3 characters long');
            return false;
        }

        // Validate address
        if (formData.address.trim().length < 10) {
            setError('Please provide a complete address');
            return false;
        }

        // Validate phone if provided
        if (formData.phone && !/^\+?[0-9\s-]{10,}$/.test(formData.phone)) {
            setError('Please enter a valid phone number');
            return false;
        }

        // Validate admin name
        if (formData.adminName.trim().length < 3) {
            setError('Admin name must be at least 3 characters long');
            return false;
        }

        // Validate admin email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.adminEmail)) {
            setError('Please enter a valid email address');
            return false;
        }

        // Validate admin phone if provided
        if (formData.adminPhone && !/^\+?[0-9\s-]{10,}$/.test(formData.adminPhone)) {
            setError('Please enter a valid admin phone number');
            return false;
        }

        // Validate admin password
        if (formData.adminPassword.length < 6) {
            setError('Password must be at least 6 characters long');
            return false;
        }

        // Validate at least one screen permission for admin
        if (!Array.isArray(formData.adminPermissions) || formData.adminPermissions.length === 0) {
            setError('Please select at least one screen access for admin');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate form
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const token = user?.token;
            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };

            await axios.post(
                '/api/super-admin/create-hotel',
                formData,
                config
            );

            setSuccess('Hotel and admin created successfully! Redirecting...');
            
            // Reset form  
            setFormData({
                hotelName: '',
                address: '',
                gstNumber: '',
                phone: '',
                subscriptionPlan: 'basic',
                subscriptionDuration: '12',
                adminName: '',
                adminEmail: '',
                adminPassword: '',
                adminPhone: '',
                adminPermissions: []
            });
            setShowAdminPassword(false);
            setSelectedPropertySetupOptions([]);
            setSelectedPropertyConfigOptions([]);
            setSelectedReportOptions([]);

            setTimeout(() => {
                navigate('/super-admin/hotels');
            }, 2000);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Error creating hotel. Please try again.';
            setError(errorMessage);
            console.error('Error creating hotel:', err);
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name) => {
        if (!name) return 'SA';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="sa-container">
            {/* Sidebar */}
            <aside className={`sa-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sa-sidebar-header">
                    <span style={{ fontSize: '24px', color: '#e11d48' }}>⚡</span>
                    <h2>SUPER ADMIN</h2>
                    <button
                        type="button"
                        className="sa-sidebar-close"
                        onClick={() => setSidebarOpen(false)}
                        aria-label="Close sidebar"
                    >
                        ×
                    </button>
                </div>

                <nav className="sa-nav">
                    <button
                        className="sa-nav-item"
                        onClick={() => navigate('/super-admin/dashboard')}
                    >
                        <MdDashboard />
                        Dashboard
                    </button>
                    <button
                        className="sa-nav-item"
                        onClick={() => navigate('/super-admin/hotels')}
                    >
                        <FaHotel />
                        Hotels
                    </button>
                    <button
                        className="sa-nav-item active"
                    >
                        <FaPlus />
                        Create Hotel
                    </button>
                    <button
                        className="sa-nav-item"
                        onClick={() => navigate('/super-admin/activity-monitoring')}
                    >
                        <FaClock />
                        Activity Monitoring
                    </button>
                    <button
                        className="sa-nav-item"
                        onClick={handleLogout}
                    >
                        <MdLogout />
                        Logout
                    </button>
                </nav>
            </aside>

            {sidebarOpen && (
                <div className="sa-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Main Content */}
            <main className="sa-main">
                {/* Header */}
                <header className="sa-header sa-header-unified">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {!sidebarOpen && (
                            <button className="sa-icon-btn sa-menu-toggle" onClick={() => setSidebarOpen(true)}>
                                <FaBars />
                            </button>
                        )}
                        <div className="sa-header-logo">
                            <FaHotel style={{ color: '#e11d48' }} />
                            <span>BIREENA ATITHI</span>
                        </div>
                    </div>

                    <div className="sa-header-actions">
                        <div className="sa-profile">
                            {getInitials(user?.name)}
                        </div>
                    </div>
                </header>

                {/* Dashboard Content */}
                <div className="sa-content">
                    <h3 className="sa-section-title">Create New Hotel</h3>

                    {/* Create Hotel Form */}
                    <div className="sa-card create-hotel-card" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                        {error && (
                            <div style={{
                                padding: '16px',
                                marginBottom: '24px',
                                background: '#fee2e2',
                                border: '1px solid #ef4444',
                                borderRadius: '8px',
                                color: '#E31E24',
                                fontSize: '14px',
                                fontWeight: '500'
                            }}>
                                {error}
                            </div>
                        )}

                        {success && (
                            <div style={{
                                padding: '16px',
                                marginBottom: '24px',
                                background: '#d1fae5',
                                border: '1px solid #10b981',
                                borderRadius: '8px',
                                color: '#047857',
                                fontSize: '14px',
                                fontWeight: '500'
                            }}>
                                {success}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="create-hotel-form" style={{ padding: '24px' }}>
                            {/* Hotel Information Section */}
                            <div className="create-hotel-section" style={{ marginBottom: '32px' }}>
                                <h3 className="create-hotel-heading" style={{
                                    fontSize: '18px',
                                    fontWeight: '700',
                                    color: '#1f2937',
                                    marginBottom: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderBottom: '2px solid #e5e7eb',
                                    paddingBottom: '12px'
                                }}>
                                    <FaHotel style={{ marginRight: '10px', color: '#EF4444' }} />
                                    Hotel Information
                                </h3>
                                
                                <div className="create-hotel-grid create-hotel-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div className="create-hotel-field" style={{ marginBottom: '16px' }}>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: '#374151',
                                            marginBottom: '8px'
                                        }}>
                                            <FaHotel style={{ marginRight: '6px', fontSize: '14px' }} />
                                            Hotel Name <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="hotelName"
                                            value={formData.hotelName}
                                            onChange={handleChange}
                                            required
                                            placeholder="Enter hotel name"
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                transition: 'all 0.2s',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

                                    <div className="create-hotel-field" style={{ marginBottom: '16px' }}>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: '#374151',
                                            marginBottom: '8px'
                                        }}>
                                            <FaPhone style={{ marginRight: '6px', fontSize: '14px' }} />
                                            Phone
                                        </label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="+91 1234567890"
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                transition: 'all 0.2s',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="create-hotel-field" style={{ marginBottom: '16px' }}>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: '#374151',
                                        marginBottom: '8px'
                                    }}>
                                        <FaMapMarkerAlt style={{ marginRight: '6px', fontSize: '14px' }} />
                                        Address <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                                    </label>
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        required
                                        rows="3"
                                        placeholder="Enter complete address"
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            transition: 'all 0.2s',
                                            outline: 'none',
                                            fontFamily: 'inherit',
                                            resize: 'vertical'
                                        }}
                                    ></textarea>
                                </div>

                                <div className="create-hotel-field" style={{ marginBottom: '16px' }}>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: '#374151',
                                        marginBottom: '8px'
                                    }}>
                                        <FaFileInvoice style={{ marginRight: '6px', fontSize: '14px' }} />
                                        GST Number
                                    </label>
                                    <input
                                        type="text"
                                        name="gstNumber"
                                        value={formData.gstNumber}
                                        onChange={handleChange}
                                        placeholder="Enter GST number"
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            transition: 'all 0.2s',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Subscription Section */}
                            <div className="create-hotel-section" style={{ marginBottom: '32px' }}>
                                <h3 className="create-hotel-heading" style={{
                                    fontSize: '18px',
                                    fontWeight: '700',
                                    color: '#1f2937',
                                    marginBottom: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderBottom: '2px solid #e5e7eb',
                                    paddingBottom: '12px'
                                }}>
                                    <FaStar style={{ marginRight: '10px', color: '#EF4444' }} />
                                    Subscription Details
                                </h3>
                                
                                <div className="create-hotel-grid create-hotel-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div className="create-hotel-field" style={{ marginBottom: '16px' }}>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: '#374151',
                                            marginBottom: '8px'
                                        }}>
                                            <FaStar style={{ marginRight: '6px', fontSize: '14px' }} />
                                            Subscription Plan <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                                        </label>
                                        <select
                                            name="subscriptionPlan"
                                            value={formData.subscriptionPlan}
                                            onChange={handleChange}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                transition: 'all 0.2s',
                                                outline: 'none',
                                                cursor: 'pointer',
                                                backgroundColor: 'white'
                                            }}
                                        >
                                            <option value="basic">Basic Plan</option>
                                            <option value="premium">Premium Plan</option>
                                        </select>
                                    </div>

                                    <div className="create-hotel-field" style={{ marginBottom: '16px' }}>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: '#374151',
                                            marginBottom: '8px'
                                        }}>
                                            <FaClock style={{ marginRight: '6px', fontSize: '14px' }} />
                                            Duration (Months) <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                                        </label>
                                        <select
                                            name="subscriptionDuration"
                                            value={formData.subscriptionDuration}
                                            onChange={handleChange}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                transition: 'all 0.2s',
                                                outline: 'none',
                                                cursor: 'pointer',
                                                backgroundColor: 'white'
                                            }}
                                        >
                                            <option value="1">1 Month</option>
                                            <option value="3">3 Months</option>
                                            <option value="6">6 Months</option>
                                            <option value="12">12 Months</option>
                                            <option value="24">24 Months</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Admin Information Section */}
                            <div className="create-hotel-section" style={{ marginBottom: '32px' }}>
                                <h3 className="create-hotel-heading" style={{
                                    fontSize: '18px',
                                    fontWeight: '700',
                                    color: '#1f2937',
                                    marginBottom: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderBottom: '2px solid #e5e7eb',
                                    paddingBottom: '12px'
                                }}>
                                    <FaUser style={{ marginRight: '10px', color: '#EF4444' }} />
                                    Admin Details
                                </h3>
                                
                                <div className="create-hotel-grid create-hotel-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div className="create-hotel-field" style={{ marginBottom: '16px' }}>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: '#374151',
                                            marginBottom: '8px'
                                        }}>
                                            <FaUser style={{ marginRight: '6px', fontSize: '14px' }} />
                                            Admin Name <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="adminName"
                                            value={formData.adminName}
                                            onChange={handleChange}
                                            required
                                            placeholder="Enter admin name"
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                transition: 'all 0.2s',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

                                    <div className="create-hotel-field" style={{ marginBottom: '16px' }}>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: '#374151',
                                            marginBottom: '8px'
                                        }}>
                                            <FaPhone style={{ marginRight: '6px', fontSize: '14px' }} />
                                            Admin Phone
                                        </label>
                                        <input
                                            type="tel"
                                            name="adminPhone"
                                            value={formData.adminPhone}
                                            onChange={handleChange}
                                            placeholder="+91 1234567890"
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                transition: 'all 0.2s',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="create-hotel-grid create-hotel-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div className="create-hotel-field" style={{ marginBottom: '16px' }}>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: '#374151',
                                            marginBottom: '8px'
                                        }}>
                                            <FaEnvelope style={{ marginRight: '6px', fontSize: '14px' }} />
                                            Admin Email <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                                        </label>
                                        <input
                                            type="email"
                                            name="adminEmail"
                                            value={formData.adminEmail}
                                            onChange={handleChange}
                                            required
                                            placeholder="admin@hotel.com"
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                transition: 'all 0.2s',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

                                    <div className="create-hotel-field" style={{ marginBottom: '16px' }}>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: '#374151',
                                            marginBottom: '8px'
                                        }}>
                                            <FaLock style={{ marginRight: '6px', fontSize: '14px' }} />
                                            Admin Password <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type={showAdminPassword ? 'text' : 'password'}
                                                name="adminPassword"
                                                value={formData.adminPassword}
                                                onChange={handleChange}
                                                required
                                                placeholder="Enter secure password"
                                                minLength="8"
                                                pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$"
                                                title="Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
                                                autoComplete="new-password"
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 44px 12px 16px',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: '8px',
                                                    fontSize: '14px',
                                                    transition: 'all 0.2s',
                                                    outline: 'none'
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowAdminPassword((prev) => !prev)}
                                                aria-label={showAdminPassword ? 'Hide admin password' : 'Show admin password'}
                                                style={{
                                                    position: 'absolute',
                                                    right: '10px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    color: '#6b7280',
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                {showAdminPassword ? <FaEyeSlash /> : <FaEye />}
                                            </button>
                                        </div>
                                        <p style={{
                                            margin: '8px 0 0 0',
                                            fontSize: '12px',
                                            color: '#6b7280'
                                        }}>
                                            Use minimum 8 characters with at least 1 uppercase, 1 lowercase, 1 number, and 1 special symbol.
                                        </p>
                                    </div>
                                </div>

                                <div style={{ marginTop: '8px' }}>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: '#374151',
                                        marginBottom: '10px'
                                    }}>
                                        Assign Admin Screen Access <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                                    </label>
                                    <p style={{
                                        margin: '0 0 12px 0',
                                        fontSize: '12px',
                                        color: '#6b7280'
                                    }}>
                                        Admin ko sirf selected screens hi dikhenge.
                                    </p>

                                    <div className="create-hotel-permissions-grid" style={{
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '10px',
                                        padding: '14px',
                                        background: '#fafafa',
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                        gap: '10px'
                                    }}>
                                        {ADMIN_SCREEN_OPTIONS.map((permissionLabel) => {
                                            const checked = formData.adminPermissions.includes(permissionLabel);
                                            return (
                                                <label
                                                    key={permissionLabel}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        fontSize: '13px',
                                                        color: '#1f2937',
                                                        cursor: 'pointer',
                                                        background: checked ? '#fee2e2' : '#fff',
                                                        border: checked ? '1px solid #ef4444' : '1px solid #e5e7eb',
                                                        borderRadius: '8px',
                                                        padding: '8px 10px'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleAdminPermission(permissionLabel)}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                    <span>{permissionLabel}</span>
                                                </label>
                                            );
                                        })}
                                    </div>

                                    <MultiPermissionPicker
                                        title="Property Setup Options"
                                        options={PROPERTY_SETUP_OPTIONS}
                                        selectedOptions={selectedPropertySetupOptions}
                                        setSelectedOptions={setSelectedPropertySetupOptions}
                                        onAdd={addPropertySetupPermission}
                                        description="Ek sath multiple Property Setup options select karke Add Selected se permissions add karein."
                                    />

                                    <MultiPermissionPicker
                                        title="Property Configuration Options"
                                        options={PROPERTY_CONFIG_OPTIONS}
                                        selectedOptions={selectedPropertyConfigOptions}
                                        setSelectedOptions={setSelectedPropertyConfigOptions}
                                        onAdd={addPropertyConfigPermission}
                                        description="Property Configuration ke bahut saare options ek sath choose karke admin ko access de sakte hain."
                                    />

                                    <MultiPermissionPicker
                                        title="Reports Options"
                                        options={REPORT_OPTIONS}
                                        selectedOptions={selectedReportOptions}
                                        setSelectedOptions={setSelectedReportOptions}
                                        onAdd={addReportsPermission}
                                        description="Reports ke liye bhi multiple select supported hai, select karke Add Selected karein."
                                    />
                                </div>
                            </div>

                            {/* Submit Buttons */}
                            <div className="create-hotel-actions" style={{ 
                                display: 'flex', 
                                gap: '16px', 
                                justifyContent: 'flex-end',
                                marginTop: '32px',
                                paddingTop: '24px',
                                borderTop: '2px solid #e5e7eb'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => navigate('/super-admin/hotels')}
                                    disabled={loading}
                                    className="create-hotel-btn create-hotel-btn-cancel"
                                    style={{
                                        padding: '12px 32px',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        background: 'white',
                                        color: '#64748b',
                                        opacity: loading ? 0.5 : 1
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="create-hotel-btn create-hotel-btn-submit"
                                    style={{
                                        padding: '12px 32px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        background: 'linear-gradient(135deg, #EF4444 0%, #E31E24 100%)',
                                        color: 'white',
                                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                        opacity: loading ? 0.7 : 1
                                    }}
                                >
                                    {loading ? 'Creating...' : 'Create Hotel'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CreateHotel;
