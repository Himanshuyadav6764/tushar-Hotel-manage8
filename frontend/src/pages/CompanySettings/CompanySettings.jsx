import React, { useState, useEffect } from 'react';
import './CompanySettings.css';
import API_URL, { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_ROOM_GST_SLABS, normalizeRoomGstSlabs } from '../../utils/roomTax';

const toBoolean = (value, fallback = false) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
    }
    if (typeof value === 'number') return value === 1;
    return fallback;
};

const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const BLOCKED_UPLOAD_EXTENSIONS = /\.(exe|js)$/i;

const validateImageUploadFile = (file, fieldLabel) => {
    if (!file) return `${fieldLabel}: File not found`;

    const fileName = String(file.name || '').trim();
    const mimeType = String(file.type || '').toLowerCase();

    if (BLOCKED_UPLOAD_EXTENSIONS.test(fileName)) {
        return `${fieldLabel}: Executable files (.exe/.js) are not allowed`;
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
        return `${fieldLabel}: Only JPG and PNG files are allowed`;
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        return `${fieldLabel}: File size must be 2MB or less`;
    }

    return null;
};

const CompanySettings = () => {
    const { settings: globalSettings, fetchSettings: refreshGlobal, getCurrencySymbol } = useSettings();
    const { user } = useAuth();
    const cs = getCurrencySymbol();
    const [activeTab, setActiveTab] = useState('General');
    const [hotelData, setHotelData] = useState({
        hotelName: '',
        gstNumber: '',
        logoUrl: null,
        qrCodeUrl: null,
        address: '',
        city: '',
        state: '',
        pin: '',
        currency: 'INR (₹)',
        taxType: 'GST',
        cgst: '2.5',
        sgst: '2.5',
        serviceCharge: '10',
        invoicePrefix: 'INV-2026-',
        thankYouMessage: 'Thank you for visiting our hotel!',
        enableRoomPosting: true,
        posEnabled: true,
        displayLogoOnBill: true,
        printKOTHeader: true,
        autoIncrementInvoice: true,
        timezone: '(GMT+05:30) Kolkata',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12 Hour',
        billingInvoicePrefix: 'ATITHI',
        startingInvoiceNumber: '1001',
        panNumber: '',
        autoGenerateInvoice: true,
        billPrintFormat: 'Hotel Invoice',
        roomGst: '12',
        roomGstSlabs: DEFAULT_ROOM_GST_SLABS,
        foodGst: '5',
        roomServiceCharge: '5',
        inclusiveTax: true,
        paymentModes: {
            cash: true,
            upi: true,
            card: true,
            bankTransfer: true
        },
        billingRules: {
            autoPost: true,
            mandatorySettlement: true,
            splitBill: true,
            mergeTable: true,
            addToRoom: true
        },
        discountRules: {
            maxDiscount: '25',
            maxDiscountType: 'PERCENTAGE',
            managerApproval: true,
            couponEnabled: true
        }
    });
    const [saving, setSaving] = useState(false);

    // Load settings from API on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const res = await apiCall(`/api/hotel/settings`);
                const data = await res.json();
                if (data.success && data.data) {
                    const s = data.data;
                    setHotelData(prev => {
                        const normalizedServiceCharge = String(s.roomServiceCharge ?? s.serviceCharge ?? prev.roomServiceCharge);
                        const normalizedRoomPosting = toBoolean(
                            s.enableRoomPosting ?? s.billingRules?.autoPost,
                            prev.enableRoomPosting
                        );
                        return {
                            ...prev,
                            hotelName: s.name || prev.hotelName,
                            gstNumber: s.gstNumber || prev.gstNumber,
                            logoUrl: s.logoUrl || prev.logoUrl,
                            qrCodeUrl: s.qrCodeUrl || prev.qrCodeUrl,
                            address: s.address || prev.address,
                            city: s.city || prev.city,
                            state: s.state || prev.state,
                            pin: s.pin || prev.pin,
                            currency: s.currency || prev.currency,
                            taxType: s.taxType || prev.taxType,
                            cgst: String(s.cgst ?? prev.cgst),
                            sgst: String(s.sgst ?? prev.sgst),
                            serviceCharge: normalizedServiceCharge,
                            invoicePrefix: s.invoicePrefix || prev.invoicePrefix,
                            thankYouMessage: s.thankYouMessage || prev.thankYouMessage,
                            enableRoomPosting: normalizedRoomPosting,
                            posEnabled: s.posEnabled ?? prev.posEnabled,
                            displayLogoOnBill: s.displayLogoOnBill ?? prev.displayLogoOnBill,
                            printKOTHeader: s.printKOTHeader ?? prev.printKOTHeader,
                            autoIncrementInvoice: s.autoIncrementInvoice ?? prev.autoIncrementInvoice,
                            timezone: s.timezone || prev.timezone,
                            dateFormat: s.dateFormat || prev.dateFormat,
                            timeFormat: s.timeFormat || prev.timeFormat,
                            billingInvoicePrefix: s.billingInvoicePrefix || prev.billingInvoicePrefix,
                            startingInvoiceNumber: s.startingInvoiceNumber || prev.startingInvoiceNumber,
                            panNumber: s.panNumber || prev.panNumber,
                            autoGenerateInvoice: s.autoGenerateInvoice ?? prev.autoGenerateInvoice,
                            billPrintFormat: s.billPrintFormat || prev.billPrintFormat,
                            roomGst: String(s.roomGst ?? prev.roomGst),
                            roomGstSlabs: normalizeRoomGstSlabs(s.roomGstSlabs ?? prev.roomGstSlabs),
                            foodGst: String(s.foodGst ?? prev.foodGst),
                            roomServiceCharge: normalizedServiceCharge,
                            inclusiveTax: toBoolean(s.inclusiveTax, prev.inclusiveTax),
                            paymentModes: s.paymentModes || prev.paymentModes,
                            billingRules: {
                                ...prev.billingRules,
                                ...(s.billingRules || {}),
                                autoPost: normalizedRoomPosting
                            },
                            discountRules: s.discountRules ? {
                                maxDiscount: String(s.discountRules.maxDiscount ?? prev.discountRules.maxDiscount),
                                maxDiscountType: s.discountRules.maxDiscountType || prev.discountRules.maxDiscountType,
                                managerApproval: s.discountRules.managerApproval ?? prev.discountRules.managerApproval,
                                couponEnabled: s.discountRules.couponEnabled ?? prev.discountRules.couponEnabled
                            } : prev.discountRules
                        };
                    });
                }
            } catch (err) {
                console.error('Error loading settings:', err);
            }
        };
        loadSettings();
    }, []);

    // Rooms Management State
    const [rooms, setRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeRoomSubTab, setActiveRoomSubTab] = useState('Rooms List');

    const fetchRooms = async () => {
        try {
            setLoadingRooms(true);
            const response = await apiCall(`/api/rooms/list`);
            const data = await response.json();
            if (data.success) {
                setRooms(data.data);
            }
        } catch (err) {
            console.error('Error fetching rooms:', err);
        } finally {
            setLoadingRooms(false);
        }
    };

    const handleDeleteRoom = async (id) => {
        if (window.confirm('Are you sure you want to delete this room?')) {
            try {
                const response = await apiCall(`/api/rooms/delete/${id}`, {
                    method: 'DELETE'
                });
                const data = await response.json();
                if (data.success) {
                    fetchRooms();
                } else {
                    alert('Failed to delete room');
                }
            } catch (error) {
                alert('Error deleting room');
            }
        }
    };

    useEffect(() => {
        if (activeTab === 'Rooms') {
            fetchRooms();
        }
    }, [activeTab]);

    const handleInputChange = (e) => {
        let { name, value, type, checked } = e.target;
        const toNum = (val) => {
            const parsed = Number(val);
            return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
        };
        const toPctString = (val) => {
            const safe = Math.round(toNum(val) * 100) / 100;
            return String(safe);
        };

        // Apply validations based on field name
        if (name === 'gstNumber') {
            value = value.toUpperCase().slice(0, 15).replace(/[^A-Z0-9]/g, '');
        } else if (name === 'pin') {
            value = value.replace(/\D/g, '').slice(0, 6);
        } else if (name === 'panNumber') {
            value = value.toUpperCase().slice(0, 10).replace(/[^A-Z0-9]/g, '');
        }

        if (type === 'checkbox' && name === 'enableRoomPosting') {
            setHotelData(prev => ({
                ...prev,
                enableRoomPosting: checked,
                billingRules: {
                    ...prev.billingRules,
                    autoPost: checked
                }
            }));
            return;
        }

        if (name === 'roomServiceCharge' || name === 'serviceCharge') {
            setHotelData(prev => ({
                ...prev,
                roomServiceCharge: value,
                serviceCharge: value
            }));
            return;
        }

        if (name === 'cgst' || name === 'sgst') {
            setHotelData(prev => {
                const nextCgst = name === 'cgst' ? toNum(value) : toNum(prev.cgst);
                const nextSgst = name === 'sgst' ? toNum(value) : toNum(prev.sgst);
                const totalFoodGst = nextCgst + nextSgst;

                return {
                    ...prev,
                    cgst: toPctString(nextCgst),
                    sgst: toPctString(nextSgst),
                    foodGst: toPctString(totalFoodGst)
                };
            });
            return;
        }

        if (name === 'foodGst') {
            const totalFoodGst = toNum(value);
            const half = Math.round((totalFoodGst / 2) * 100) / 100;
            const secondHalf = Math.round((totalFoodGst - half) * 100) / 100;

            setHotelData(prev => ({
                ...prev,
                foodGst: toPctString(totalFoodGst),
                cgst: toPctString(half),
                sgst: toPctString(secondHalf)
            }));
            return;
        }

        setHotelData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const validationError = validateImageUploadFile(file, 'Logo');
        if (validationError) {
            alert(validationError);
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setHotelData(prev => ({ ...prev, logoUrl: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleQrCodeChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const validationError = validateImageUploadFile(file, 'QR Image');
        if (validationError) {
            alert(validationError);
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setHotelData(prev => ({ ...prev, qrCodeUrl: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleRoomGstSlabChange = (index, field, rawValue) => {
        const value = Math.max(0, Number(rawValue) || 0);
        setHotelData(prev => ({
            ...prev,
            roomGstSlabs: (prev.roomGstSlabs || DEFAULT_ROOM_GST_SLABS).map((slab, slabIndex) => {
                if (slabIndex !== index) return slab;
                return { ...slab, [field]: value };
            })
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = user?.token;
            const serviceChargeValue = parseFloat(hotelData.roomServiceCharge) || 0;
            const roomPostingEnabled = !!hotelData.enableRoomPosting;
            const normalizedRoomGstSlabs = normalizeRoomGstSlabs(hotelData.roomGstSlabs);
            const slabForStandardRoom = normalizedRoomGstSlabs.find(slab => 1001 >= slab.min && 1001 <= slab.max);
            const fallbackRoomGst = slabForStandardRoom?.rate ?? normalizedRoomGstSlabs[0]?.rate ?? (parseFloat(hotelData.roomGst) || 0);
            const payload = {
                name: hotelData.hotelName,
                address: hotelData.address,
                city: hotelData.city,
                state: hotelData.state,
                pin: hotelData.pin,
                gstNumber: hotelData.gstNumber,
                logoUrl: hotelData.logoUrl,
                qrCodeUrl: hotelData.qrCodeUrl,
                currency: hotelData.currency,
                timezone: hotelData.timezone,
                dateFormat: hotelData.dateFormat,
                timeFormat: hotelData.timeFormat,
                taxType: hotelData.taxType,
                cgst: parseFloat(hotelData.cgst) || 0,
                sgst: parseFloat(hotelData.sgst) || 0,
                serviceCharge: serviceChargeValue,
                roomGst: fallbackRoomGst,
                roomGstSlabs: normalizedRoomGstSlabs,
                foodGst: parseFloat(hotelData.foodGst) || 0,
                roomServiceCharge: serviceChargeValue,
                inclusiveTax: hotelData.inclusiveTax,
                invoicePrefix: hotelData.invoicePrefix,
                billingInvoicePrefix: hotelData.billingInvoicePrefix,
                startingInvoiceNumber: hotelData.startingInvoiceNumber,
                panNumber: hotelData.panNumber,
                autoGenerateInvoice: hotelData.autoGenerateInvoice,
                autoIncrementInvoice: hotelData.autoIncrementInvoice,
                billPrintFormat: hotelData.billPrintFormat,
                thankYouMessage: hotelData.thankYouMessage,
                enableRoomPosting: roomPostingEnabled,
                posEnabled: hotelData.posEnabled,
                displayLogoOnBill: hotelData.displayLogoOnBill,
                printKOTHeader: hotelData.printKOTHeader,
                paymentModes: hotelData.paymentModes,
                billingRules: {
                    ...hotelData.billingRules,
                    autoPost: roomPostingEnabled
                },
                discountRules: {
                    maxDiscount: parseFloat(hotelData.discountRules.maxDiscount) || 0,
                    maxDiscountType: hotelData.discountRules.maxDiscountType || 'PERCENTAGE',
                    managerApproval: hotelData.discountRules.managerApproval,
                    couponEnabled: hotelData.discountRules.couponEnabled
                }
            };
            const res = await apiCall(`/api/hotel/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                await refreshGlobal();
                alert('Settings saved successfully!');
            } else {
                alert(data.message || 'Failed to save settings');
            }
        } catch (err) {
            console.error('Error saving settings:', err);
            alert('Error saving settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="company-settings-container">
            <div className="company-settings-header">
                <div className="header-title">
                    <span className="lock-icon">🔒</span>
                    <h1>Company Settings</h1>
                    <span className="breadcrumb">Dashboard / Company</span>
                </div>
            </div>

            <div className="settings-tabs">
                {[
                    { name: 'General', icon: '⚙️' },
                    { name: 'Rooms', icon: '🏨' },
                    { name: 'Billing Setup', icon: '🛠️' }
                ].map(tab => (
                    <button
                        key={tab.name}
                        className={`tab-btn ${activeTab === tab.name ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.name)}
                    >
                        <span className="tab-icon">{tab.icon}</span>
                        {tab.name}
                    </button>
                ))}
            </div>

            <div className={`settings-content ${activeTab === 'General' ? 'settings-grid' : ''}`}>
                {activeTab === 'Rooms' && (
                    <div className="room-management-section">
                        <div className="section-header-row">
                            <h2>Room Management</h2>
                        </div>

                        <div className="management-toolbar">
                            <div className="sub-tabs">
                                {['Room Categories', 'Room Types', 'Rooms List'].map(sub => (
                                    <button
                                        key={sub}
                                        className={`sub-tab-btn ${activeRoomSubTab === sub ? 'active' : ''}`}
                                        onClick={() => setActiveRoomSubTab(sub)}
                                    >
                                        {sub === 'Room Categories' && <span className="btn-icon">🏨</span>}
                                        {sub}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="search-bar-container">
                            <div className="search-input-wrapper">
                                <span className="search-icon">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search Room Number / Name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                                />
                            </div>
                        </div>

                        <div className="rooms-table-card">
                            <table className="rooms-management-table">
                                <thead>
                                    <tr>
                                        <th>Room Number</th>
                                        <th>Category / Type</th>
                                        <th>Tariff <span className="sort-icon">↕</span></th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingRooms ? (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>Loading rooms...</td></tr>
                                    ) : rooms.length === 0 ? (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>No rooms found.</td></tr>
                                    ) : (
                                        rooms.filter(r =>
                                            r.roomNumber.toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            r.roomType.toLowerCase().includes(searchQuery.toLowerCase())
                                        ).map((room, idx) => (
                                            <tr key={room._id || idx}>
                                                <td><span className="bold-no">{room.roomNumber}</span></td>
                                                <td><span className="room-cat-inline">{room.roomType === 'Deluxe Room' ? '🏨' : '🛏️'} {room.roomType}</span></td>
                                                <td className="tariff-cell">{cs}{room.price} <span className="per-night">/ Night</span></td>
                                                <td>
                                                    <span className="status-pill available">
                                                        <span className="check">✓</span> AVAILABLE
                                                    </span>
                                                </td>
                                                <td className="actions-cell">
                                                    <button className="edit-action" onClick={() => alert('Edit functionality to be implemented or navigated to Room Setup')}>Edit</button>
                                                    <button className="delete-action" onClick={() => handleDeleteRoom(room._id)}>Delete</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}



                {activeTab === 'Billing Setup' && (
                    <div className="billing-setup-section">
                        <div className="section-header-row">
                            <h2>Billing Setup</h2>
                        </div>

                        <div className="billing-setup-grid">
                            {/* Row 1 */}
                            <div className="settings-card">
                                <h3 className="card-header-icon"><span className="red-icon">📄</span> Invoice Settings</h3>
                                <div className="billing-field-row">
                                    <label>Invoice Prefix</label>
                                    <input
                                        type="text"
                                        name="billingInvoicePrefix"
                                        value={hotelData.billingInvoicePrefix}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="billing-field-row">
                                    <label>Starting Invoice Number</label>
                                    <input
                                        type="text"
                                        name="startingInvoiceNumber"
                                        value={hotelData.startingInvoiceNumber}
                                        onChange={handleInputChange}
                                        className="short-input"
                                    />
                                </div>
                                <div className="billing-field-row">
                                    <label>GST Number</label>
                                    <input
                                        type="text"
                                        name="gstNumber"
                                        value={hotelData.gstNumber}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="billing-field-row">
                                    <label>PAN Number</label>
                                    <input
                                        type="text"
                                        name="panNumber"
                                        value={hotelData.panNumber}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="billing-field-row special">
                                    <label>Auto Generate Invoice</label>
                                    <div
                                        className={`toggle-switch ${hotelData.autoGenerateInvoice ? 'active' : ''}`}
                                        onClick={() => setHotelData(prev => ({ ...prev, autoGenerateInvoice: !prev.autoGenerateInvoice }))}
                                    >
                                        {hotelData.autoGenerateInvoice ? 'Yes' : 'No'} <div className="switch-knob"></div>
                                    </div>
                                </div>
                                <div className="billing-field-row">
                                    <label>Bill Print Format</label>
                                    <select
                                        name="billPrintFormat"
                                        value={hotelData.billPrintFormat}
                                        onChange={handleInputChange}
                                    >
                                        <option value="Hotel Invoice">Hotel Invoice</option>
                                        <option value="Standard Receipt">Standard Receipt</option>
                                    </select>
                                </div>
                            </div>

                            <div className="settings-card">
                                <h3 className="card-header-icon"><span className="red-icon">💰</span> Tax Configuration</h3>
                                <p className="tax-help-text">Room Rent GST is calculated based on the price of the room per night.</p>
                                {!hotelData.inclusiveTax && (
                                    <p className="tax-help-text" style={{ color: '#b45309', fontWeight: 700, marginTop: '-4px' }}>
                                        Tax is disabled. Enable Inclusive Tax to apply room and food taxes.
                                    </p>
                                )}
                                {(hotelData.roomGstSlabs || DEFAULT_ROOM_GST_SLABS).map((slab, index) => (
                                    <div className="billing-field-row tax-slab-row" key={`room-gst-slab-${index}`}>
                                        <div className="tax-slab-range-wrap">
                                            <input
                                                type="number"
                                                value={slab.min}
                                                onChange={(e) => handleRoomGstSlabChange(index, 'min', e.target.value)}
                                                min="0"
                                                disabled={!hotelData.inclusiveTax}
                                                className="tax-slab-input"
                                            />
                                            <span className="tax-slab-separator">-</span>
                                            <input
                                                type="number"
                                                value={slab.max}
                                                onChange={(e) => handleRoomGstSlabChange(index, 'max', e.target.value)}
                                                min="0"
                                                disabled={!hotelData.inclusiveTax}
                                                className="tax-slab-input"
                                            />
                                        </div>
                                        <div className="input-with-symbol-right tax-slab-rate-input-wrap">
                                            <input
                                                type="number"
                                                value={slab.rate}
                                                onChange={(e) => handleRoomGstSlabChange(index, 'rate', e.target.value)}
                                                min="0"
                                                max="100"
                                                disabled={!hotelData.inclusiveTax}
                                            />
                                            <span className="symbol-box">%</span>
                                        </div>
                                    </div>
                                ))}
                                <div className="billing-field-row">
                                    <label>Food GST %</label>
                                    <div className="input-with-symbol-right">
                                        <input
                                            type="number"
                                            name="foodGst"
                                            value={hotelData.foodGst}
                                            onChange={handleInputChange}
                                            min="0"
                                            max="50"
                                            disabled={!hotelData.inclusiveTax}
                                        />
                                        <span className="symbol-box">%</span>
                                    </div>
                                </div>
                                <div className="billing-field-row">
                                    <label>Service Charge %</label>
                                    <div className="input-with-symbol-right">
                                        <input
                                            type="number"
                                            name="roomServiceCharge"
                                            value={hotelData.roomServiceCharge}
                                            onChange={handleInputChange}
                                            min="0"
                                            max="100"
                                        />
                                        <span className="symbol-box">%</span>
                                    </div>
                                </div>
                                <div className="billing-field-row special">
                                    <label>Inclusive Tax</label>
                                    <div
                                        className={`toggle-switch ${hotelData.inclusiveTax ? 'active' : ''}`}
                                        onClick={() => setHotelData(prev => ({ ...prev, inclusiveTax: !prev.inclusiveTax }))}
                                    >
                                        {hotelData.inclusiveTax ? 'Yes' : 'No'} <div className="switch-knob"></div>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-card">
                                <h3 className="card-header-icon"><span className="red-icon">💳</span> Payment Modes</h3>
                                {[
                                    { label: 'Cash', icon: '💵', key: 'cash' },
                                    { label: 'UPI', icon: '📱', key: 'upi' },
                                    { label: 'Card', icon: '💳', key: 'card' },
                                    { label: 'Bank Transfer', icon: '🏦', key: 'bankTransfer' }
                                ].map((mode, i) => (
                                    <div key={i} className="billing-field-row special">
                                        <div className="label-with-icon">
                                            <span className="mode-icon">{mode.icon}</span>
                                            <label>{mode.label}</label>
                                        </div>
                                        <div
                                            className={`toggle-switch ${hotelData.paymentModes[mode.key] ? 'active' : ''}`}
                                            onClick={() => setHotelData(prev => ({
                                                ...prev,
                                                paymentModes: { ...prev.paymentModes, [mode.key]: !prev.paymentModes[mode.key] }
                                            }))}
                                        >
                                            {hotelData.paymentModes[mode.key] ? 'Yes' : 'No'} <div className="switch-knob"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Row 2 */}
                            <div className="settings-card">
                                <h3 className="card-header-icon"><span className="red-icon">🛏️</span> Room Billing Rules</h3>
                                {[
                                    { label: 'Auto Post to Room Folio', key: 'autoPost' },
                                    { label: 'Checkout Mandatory Settlement', key: 'mandatorySettlement' }
                                ].map((rule, i) => (
                                    <div key={i} className="billing-field-row special">
                                        <div className="label-with-check">
                                            <input
                                                type="checkbox"
                                                checked={hotelData.billingRules[rule.key]}
                                                onChange={() => setHotelData(prev => ({
                                                    ...prev,
                                                    billingRules: { ...prev.billingRules, [rule.key]: !prev.billingRules[rule.key] },
                                                    ...(rule.key === 'autoPost' ? { enableRoomPosting: !prev.billingRules[rule.key] } : {})
                                                }))}
                                            />
                                            <label>{rule.label}</label>
                                        </div>
                                        <div className={`status-badge-${hotelData.billingRules[rule.key] ? 'green' : 'red'}`}>
                                            {hotelData.billingRules[rule.key] ? 'Yes' : 'No'}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="settings-card">
                                <h3 className="card-header-icon"><span className="red-icon">🍴</span> Restaurant Billing Rules</h3>
                                {[
                                    { label: 'Split Bill Enabled', key: 'splitBill' },
                                    { label: 'Merge Table Billing', key: 'mergeTable' },
                                    { label: 'Add to Room Enabled', key: 'addToRoom' }
                                ].map((rule, i) => (
                                    <div key={i} className="billing-field-row special">
                                        <div className="label-with-check">
                                            <input
                                                type="checkbox"
                                                checked={hotelData.billingRules[rule.key]}
                                                onChange={() => setHotelData(prev => ({
                                                    ...prev,
                                                    billingRules: { ...prev.billingRules, [rule.key]: !prev.billingRules[rule.key] }
                                                }))}
                                            />
                                            <label>{rule.label}</label>
                                        </div>
                                        <div className={`status-badge-${hotelData.billingRules[rule.key] ? 'green' : 'red'}`}>
                                            {hotelData.billingRules[rule.key] ? 'Yes' : 'No'}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="settings-card">
                                <h3 className="card-header-icon"><span className="red-icon">🏷️</span> Discount & Approval</h3>
                                <div className="billing-field-row">
                                    <label>Max Discount</label>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <div className="input-with-symbol-right" style={{ flex: 1 }}>
                                            <input
                                                type="number"
                                                name="maxDiscount"
                                                min="0"
                                                max={hotelData.discountRules.maxDiscountType === 'PERCENTAGE' ? '100' : undefined}
                                                value={hotelData.discountRules.maxDiscount}
                                                onChange={(e) => setHotelData(prev => ({
                                                    ...prev,
                                                    discountRules: { ...prev.discountRules, maxDiscount: e.target.value }
                                                }))}
                                            />
                                            <span className="symbol-box">
                                                {hotelData.discountRules.maxDiscountType === 'FLAT' ? '₹' : '%'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                                            <button
                                                type="button"
                                                style={{
                                                    padding: '6px 12px', fontSize: '13px', fontWeight: '600',
                                                    border: 'none', cursor: 'pointer',
                                                    background: hotelData.discountRules.maxDiscountType !== 'FLAT' ? '#2563eb' : '#f3f4f6',
                                                    color: hotelData.discountRules.maxDiscountType !== 'FLAT' ? '#fff' : '#374151',
                                                    transition: 'all 0.2s'
                                                }}
                                                onClick={() => setHotelData(prev => ({
                                                    ...prev,
                                                    discountRules: { ...prev.discountRules, maxDiscountType: 'PERCENTAGE' }
                                                }))}
                                            >%</button>
                                            <button
                                                type="button"
                                                style={{
                                                    padding: '6px 12px', fontSize: '13px', fontWeight: '600',
                                                    border: 'none', cursor: 'pointer',
                                                    background: hotelData.discountRules.maxDiscountType === 'FLAT' ? '#2563eb' : '#f3f4f6',
                                                    color: hotelData.discountRules.maxDiscountType === 'FLAT' ? '#fff' : '#374151',
                                                    transition: 'all 0.2s'
                                                }}
                                                onClick={() => setHotelData(prev => ({
                                                    ...prev,
                                                    discountRules: { ...prev.discountRules, maxDiscountType: 'FLAT' }
                                                }))}
                                            >₹</button>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            <div className="settings-card no-bg-actions">
                                <div className="billing-actions-footer">
                                    <button className="save-billing-btn" onClick={handleSave}>Save Billing Settings <span className="arrow-btn">›</span></button>
                                    <button className="reset-billing-btn" onClick={() => alert('Settings reset to default')}>Reset Default</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'General' && (
                    <>
                        <div className="main-form-column">
                            <div className="settings-card">
                                <h3>Hotel Information</h3>
                                <div className="form-grid">
                                    <div className="form-group full-width">
                                        <label>Hotel Name</label>
                                        <input
                                            type="text"
                                            name="hotelName"
                                            value={hotelData.hotelName}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>GST Number</label>
                                        <input
                                            type="text"
                                            name="gstNumber"
                                            value={hotelData.gstNumber}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Logo</label>
                                        <div className="logo-upload-section">
                                            <div className="logo-preview-box">
                                                {hotelData.logoUrl ? (
                                                    <img src={hotelData.logoUrl} alt="Hotel Logo" className="logo-preview-img" />
                                                ) : (
                                                    <div className="hotel-logo-brand">
                                                        <div className="logo-icon-red">🏰</div>
                                                        <div className="logo-text-red">BIREENA ATITHI</div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="logo-actions">
                                                <input
                                                    type="file"
                                                    id="logo-upload"
                                                    onChange={handleLogoChange}
                                                    accept="image/png,image/jpeg"
                                                    style={{ display: 'none' }}
                                                />
                                                <button className="browse-btn" onClick={() => document.getElementById('logo-upload').click()}>
                                                    Browse File
                                                </button>
                                                <span className="upload-hint">Only JPG/PNG, max 2MB (recommended 200x60px)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-card">
                                <h3>Address & Contact</h3>
                                <div className="form-grid address-grid">
                                    <div className="form-group full-width">
                                        <label>Address Line 1</label>
                                        <input
                                            type="text"
                                            name="address"
                                            value={hotelData.address}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>City</label>
                                        <select name="city" value={hotelData.city} onChange={handleInputChange}>
                                            <option value="Mumbai">Mumbai</option>
                                            <option value="Delhi">Delhi</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>State</label>
                                        <select name="state" value={hotelData.state} onChange={handleInputChange}>
                                            <option value="Maharashtra">Maharashtra</option>
                                            <option value="Karnataka">Karnataka</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>PIN</label>
                                        <input
                                            type="text"
                                            name="pin"
                                            value={hotelData.pin}
                                            onChange={handleInputChange}
                                            placeholder="6-digit PIN"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="billing-rows">
                                <div className="settings-card compact-card">
                                    <h3>Regional & Display</h3>
                                    <div className="compact-row">
                                        <label>Default Currency</label>
                                        <select name="currency" value={hotelData.currency} onChange={handleInputChange}>
                                            <option value="INR (₹)">INR (₹)</option>
                                            <option value="USD ($)">USD ($)</option>
                                            <option value="EUR (€)">EUR (€)</option>
                                        </select>
                                    </div>
                                    <div className="compact-row">
                                        <label>Tax Type</label>
                                        <select name="taxType" value={hotelData.taxType} onChange={handleInputChange}>
                                            <option value="GST">GST</option>
                                            <option value="VAT">VAT</option>
                                        </select>
                                    </div>
                                    <div className="compact-row">
                                        <label>Time Format</label>
                                        <select name="timeFormat" value={hotelData.timeFormat} onChange={handleInputChange}>
                                            <option value="12 Hour">12 Hour</option>
                                            <option value="24 Hour">24 Hour</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="settings-card detailed-billing">
                                    <h3>Tax Details</h3>
                                    <div className="tax-inputs">
                                        <div className="tax-field">
                                            <label>CGST (%)</label>
                                            <div className="input-with-symbol">
                                                <span className="percent">%</span>
                                                <input
                                                    type="number"
                                                    name="cgst"
                                                    value={hotelData.cgst}
                                                    onChange={handleInputChange}
                                                    min="0"
                                                    max="50"
                                                />
                                            </div>
                                        </div>
                                        <div className="tax-field">
                                            <label>SGST (%)</label>
                                            <div className="input-with-symbol">
                                                <span className="percent">%</span>
                                                <input
                                                    type="number"
                                                    name="sgst"
                                                    value={hotelData.sgst}
                                                    onChange={handleInputChange}
                                                    min="0"
                                                    max="50"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bottom-cards-row">
                                <div className="settings-card">
                                    <div className="prefix-header">
                                        <h3>Invoice Prefix</h3>
                                        <input
                                            type="text"
                                            name="invoicePrefix"
                                            value={hotelData.invoicePrefix}
                                            onChange={handleInputChange}
                                            className="invoice-prefix-input"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginTop: '15px' }}>
                                        <label>Thank You Message</label>
                                        <textarea
                                            name="thankYouMessage"
                                            value={hotelData.thankYouMessage}
                                            onChange={handleInputChange}
                                            placeholder="Enter message to show on bills..."
                                        />
                                    </div>
                                    <div className="toggle-group-inline">
                                        <div className="toggle-item">
                                            <label className="checkbox-container">
                                                <input
                                                    type="checkbox"
                                                    name="enableRoomPosting"
                                                    checked={hotelData.enableRoomPosting}
                                                    onChange={handleInputChange}
                                                />
                                                <span className="checkmark"></span>
                                                Enable Room Posting
                                            </label>
                                            <span className={`toggle-status ${hotelData.enableRoomPosting ? 'yes' : 'no'}`}>
                                                {hotelData.enableRoomPosting ? 'Yes' : 'No'}
                                            </span>
                                        </div>
                                        <div className="toggle-item">
                                            <label className="checkbox-container">
                                                <input
                                                    type="checkbox"
                                                    name="posEnabled"
                                                    checked={hotelData.posEnabled}
                                                    onChange={handleInputChange}
                                                />
                                                <span className="checkmark"></span>
                                                POS Enabled
                                            </label>
                                            <span className={`toggle-status ${hotelData.posEnabled ? 'yes' : 'no'}`}>
                                                {hotelData.posEnabled ? 'Yes' : 'No'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="qr-upload-block">
                                        <label className="qr-upload-label">Bill QR Code (Manual Upload)</label>
                                        <div className="qr-upload-row">
                                            <div className="qr-preview-box">
                                                {hotelData.qrCodeUrl ? (
                                                    <img src={hotelData.qrCodeUrl} alt="Bill QR" className="qr-preview-img" />
                                                ) : (
                                                    <span className="qr-placeholder-text">No QR Added</span>
                                                )}
                                            </div>
                                            <div className="qr-upload-actions">
                                                <input
                                                    type="file"
                                                    id="qr-upload"
                                                    onChange={handleQrCodeChange}
                                                    accept="image/png,image/jpeg"
                                                    style={{ display: 'none' }}
                                                />
                                                <button
                                                    type="button"
                                                    className="browse-btn"
                                                    onClick={() => document.getElementById('qr-upload').click()}
                                                >
                                                    Upload QR Image
                                                </button>
                                                {hotelData.qrCodeUrl && (
                                                    <button
                                                        type="button"
                                                        className="remove-qr-btn"
                                                        onClick={() => setHotelData(prev => ({ ...prev, qrCodeUrl: null }))}
                                                    >
                                                        Remove QR
                                                    </button>
                                                )}
                                                <span className="upload-hint">Only JPG/PNG up to 2MB. Local browser se image select karke Save Changes karein.</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="sidebar-config-column">
                            <div className="logo-preview-card">
                                <div className="hotel-logo-brand large">
                                    {hotelData.logoUrl ? (
                                        <img src={hotelData.logoUrl} alt="Hotel Logo" className="logo-preview-img-large" />
                                    ) : (
                                        <>
                                            <div className="logo-icon-red">🏰</div>
                                            <div className="logo-text-red">BIREENA ATITHI</div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="config-toggles">
                                <div className="config-row">
                                    <label className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            name="enableRoomPosting"
                                            checked={hotelData.enableRoomPosting}
                                            onChange={handleInputChange}
                                        />
                                        <span className="checkmark"></span>
                                        Enable Room Posting
                                    </label>
                                    <span className={`toggle-pill ${hotelData.enableRoomPosting ? 'yes' : 'no'}`}>
                                        {hotelData.enableRoomPosting ? 'Yes' : 'No'}
                                    </span>
                                </div>
                                <div className="config-row">
                                    <label className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            name="posEnabled"
                                            checked={hotelData.posEnabled}
                                            onChange={handleInputChange}
                                        />
                                        <span className="checkmark"></span>
                                        POS Enabled
                                    </label>
                                    <span className={`toggle-pill ${hotelData.posEnabled ? 'yes' : 'no'}`}>
                                        {hotelData.posEnabled ? 'Yes' : 'No'}
                                    </span>
                                </div>
                            </div>

                            <div className="regional-settings">
                                <h3>Regional Settings</h3>
                                <div className="form-group">
                                    <div className="timezone-wrapper">
                                        <span className="globe-icon">🌐</span>
                                        <select name="timezone" value={hotelData.timezone} onChange={handleInputChange}>
                                            <option value="(GMT+05:30) Kolkata">(GMT+05:30) Kolkata</option>
                                            <option value="(GMT+00:00) London">(GMT+00:00) London</option>
                                            <option value="(GMT-05:00) New York">(GMT-05:00) New York</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="settings-line">
                                    <label>Date Format</label>
                                    <select name="dateFormat" value={hotelData.dateFormat} onChange={handleInputChange}>
                                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                    </select>
                                </div>
                                <div className="settings-line">
                                    <label>Time Format</label>
                                    <select name="timeFormat" value={hotelData.timeFormat} onChange={handleInputChange}>
                                        <option value="12 Hour">12 Hour</option>
                                        <option value="24 Hour">24 Hour</option>
                                    </select>
                                </div>
                            </div>

                            <div className="config-options">
                                <h3>Configuration Options</h3>
                                {[
                                    { label: 'Display Hotel Logo on Bill', key: 'displayLogoOnBill' },
                                    { label: 'Print KOT Header on KOT', key: 'printKOTHeader' },
                                    { label: 'Auto Increment Invoice Number', key: 'autoIncrementInvoice' }
                                ].map(opt => (
                                    <div key={opt.key} className="config-option-row">
                                        <label className="checkbox-container">
                                            <input
                                                type="checkbox"
                                                checked={hotelData[opt.key]}
                                                onChange={() => setHotelData({ ...hotelData, [opt.key]: !hotelData[opt.key] })}
                                            />
                                            <span className="checkmark"></span>
                                            {opt.label}
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <button className="save-changes-btn" onClick={handleSave}>
                                Save Changes
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CompanySettings;

