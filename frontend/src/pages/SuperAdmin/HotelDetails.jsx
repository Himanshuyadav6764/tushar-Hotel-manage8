import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    FaBars,
    FaBuilding,
    FaUser,
    FaEnvelope,
    FaPhone,
    FaMapMarkerAlt,
    FaFileInvoice,
    FaCalendarAlt,
    FaCheckCircle,
    FaTimesCircle,
    FaHotel,
    FaPlus,
    FaEdit,
    FaSave,
    FaEye,
    FaEyeSlash,
    FaLock,
    FaClock
} from 'react-icons/fa';
import { MdDashboard, MdLogout } from 'react-icons/md';
import './SuperAdminDashboard.css';

const ADMIN_SCREEN_OPTIONS = [
    'Dashboard', 'Reservations', 'Rooms (Dashboard)', 'Rooms (New Reservation)', 'Room Service', 'Housekeeping',
    'Reservation Card', 'Food Order', 'Cashier Section (Table)', 'Cashier Section (Room Service)', 'Cashier Section (Take Away)',
    'Table View', 'KOT Order', 'View order', 'Customer List', 'Cashier Logs', 'Payment Logs', 'Reports',
    'Reports (All)', 'Reports - Sales', 'Reports - Payments', 'Reports - Rooms', 'Reports - Kitchen', 'Reports - GST',
    'Reports - Staff', 'Reports - Billing', 'Reports - Reservations', 'Reports - Analytics',
    'Property Setup (All)', 'Property Setup - Discount', 'Property Setup - Generate Room QR',
    'Property Configuration', 'Property Configuration (All)', 'Property Configuration - Floor Setup',
    'Property Configuration - Room Facilities Type', 'Property Configuration - Meal Type', 'Property Configuration - Reservation Type',
    'Property Configuration - Extra Charges', 'Property Configuration - Complimentary Services', 'Property Configuration - Customer Identity',
    'Property Configuration - Booking Source', 'Property Configuration - Business Source', 'Property Configuration - Maintenance Block',
    'Property Configuration - Table Management', 'Property Configuration - Company Settings', 'CRM Model', 'Settings'
];

const inputStyle = {
    width: '100%',
    padding: '10px',
    border: '1px solid #d1d5db',
    borderRadius: '8px'
};

const HotelDetails = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();

    const [hotel, setHotel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [actionLoading, setActionLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [activeActionNote, setActiveActionNote] = useState('');
    const [renewDuration, setRenewDuration] = useState('12');
    const [upgradePlan, setUpgradePlan] = useState('premium');

    const [editMode, setEditMode] = useState(Boolean(location.state?.mode === 'edit'));
    const [showEditAdminPassword, setShowEditAdminPassword] = useState(false);
    const [revealedAdminPassword, setRevealedAdminPassword] = useState('');
    const [showRevealedAdminPassword, setShowRevealedAdminPassword] = useState(false);
    const [revealLoading, setRevealLoading] = useState(false);
    const [editForm, setEditForm] = useState({
        hotelName: '',
        address: '',
        gstNumber: '',
        phone: '',
        subscriptionPlan: 'basic',
        subscriptionStartDate: '',
        subscriptionExpiryDate: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        adminPhone: '',
        adminPermissions: []
    });

    const getInitials = (name) => (name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'SA');

    const toDateInput = (value) => {
        if (!value) return '';
        const dt = new Date(value);
        return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().split('T')[0];
    };

    const formatDate = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const hydrateEditForm = (payloadHotel) => {
        if (!payloadHotel) return;
        setEditForm({
            hotelName: payloadHotel.name || '',
            address: payloadHotel.address || '',
            gstNumber: payloadHotel.gstNumber || '',
            phone: payloadHotel.phone || '',
            subscriptionPlan: payloadHotel.subscription?.plan || 'basic',
            subscriptionStartDate: toDateInput(payloadHotel.subscription?.startDate),
            subscriptionExpiryDate: toDateInput(payloadHotel.subscription?.expiryDate),
            adminName: payloadHotel.adminId?.name || '',
            adminEmail: payloadHotel.adminId?.username || payloadHotel.adminId?.email || '',
            adminPassword: '',
            adminPhone: payloadHotel.adminId?.phone || '',
            adminPermissions: Array.isArray(payloadHotel.adminId?.permissions) ? payloadHotel.adminId.permissions : []
        });
    };

    const fetchHotelDetails = async () => {
        try {
            const token = user?.token;
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const response = await axios.get(`/api/super-admin/hotel/${id}`, config);
            setHotel(response.data);
            hydrateEditForm(response.data);
            setLoading(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Error fetching hotel details');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHotelDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleEditFieldChange = (e) => {
        const { name, value } = e.target;
        setEditForm((prev) => ({ ...prev, [name]: value }));
    };

    const toggleEditPermission = (label) => {
        setEditForm((prev) => ({
            ...prev,
            adminPermissions: prev.adminPermissions.includes(label)
                ? prev.adminPermissions.filter((item) => item !== label)
                : [...prev.adminPermissions, label]
        }));
    };

    const handleRevealAdminPassword = async () => {
        setRevealLoading(true);
        setError('');
        setSuccess('');

        try {
            const token = user?.token;
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const response = await axios.get(`/api/super-admin/hotel/${id}/admin-credentials`, config);
            const password = response?.data?.adminPassword || '';
            if (!password) {
                setError('Stored password not available for this hotel');
                return;
            }

            setRevealedAdminPassword(password);
            setShowRevealedAdminPassword(true);
            setSuccess('Admin password loaded successfully');
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to show admin password for this hotel');
        } finally {
            setRevealLoading(false);
        }
    };

    const handleSaveEdits = async () => {
        const trimmedHotelName = editForm.hotelName.trim();
        const trimmedAddress = editForm.address.trim();
        const trimmedAdminName = editForm.adminName.trim();
        const trimmedAdminEmail = editForm.adminEmail.trim().toLowerCase();

        if (!trimmedHotelName) {
            setError('Hotel name is required');
            return;
        }
        if (!trimmedAddress) {
            setError('Address is required');
            return;
        }
        if (!trimmedAdminName) {
            setError('Admin name is required');
            return;
        }
        if (!trimmedAdminEmail) {
            setError('Admin email is required');
            return;
        }

        setSaveLoading(true);
        setError('');
        setSuccess('');
        try {
            const token = user?.token;
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const payload = {
                hotelName: trimmedHotelName,
                address: trimmedAddress,
                gstNumber: editForm.gstNumber?.trim() || '',
                phone: editForm.phone?.trim() || '',
                subscriptionPlan: editForm.subscriptionPlan,
                subscriptionStartDate: editForm.subscriptionStartDate,
                subscriptionExpiryDate: editForm.subscriptionExpiryDate,
                adminName: trimmedAdminName,
                adminEmail: trimmedAdminEmail,
                adminPassword: editForm.adminPassword?.trim() || '',
                adminPhone: editForm.adminPhone?.trim() || '',
                adminPermissions: editForm.adminPermissions
            };

            const requestVariants = [
                () => axios.patch(`/api/super-admin/hotel/${id}`, payload, config),
                () => axios.patch(`/api/super-admin/hotels/${id}`, payload, config),
                () => axios.put(`/api/super-admin/hotel/${id}`, payload, config),
                () => axios.put(`/api/super-admin/hotels/${id}`, payload, config),
                () => axios.patch(`/api/superadmin/hotel/${id}`, payload, config),
                () => axios.put(`/api/superadmin/hotel/${id}`, payload, config)
            ];

            let response;
            let lastError;

            for (let index = 0; index < requestVariants.length; index += 1) {
                try {
                    response = await requestVariants[index]();
                    break;
                } catch (variantError) {
                    lastError = variantError;
                    const status = variantError?.response?.status;
                    const message = String(variantError?.response?.data?.error || variantError?.response?.data?.message || '').toLowerCase();
                    const shouldRetry = status === 404 || status === 405 || message.includes('route not found');
                    if (!shouldRetry || index === requestVariants.length - 1) {
                        throw variantError;
                    }
                }
            }

            if (!response) {
                const status = lastError?.response?.status;
                const message = String(lastError?.response?.data?.error || lastError?.response?.data?.message || '').toLowerCase();
                const isRouteMismatch = status === 404 || status === 405 || message.includes('route not found');

                if (!isRouteMismatch) {
                    throw lastError || new Error('Failed to update hotel details');
                }

                const settingsPayload = {
                    hotelId: id,
                    name: trimmedHotelName,
                    address: trimmedAddress,
                    gstNumber: editForm.gstNumber?.trim() || '',
                    phone: editForm.phone?.trim() || ''
                };

                await axios.put('/api/hotel/settings', settingsPayload, config);

                let permissionsSynced = false;
                const permissionRoutes = [
                    `/api/super-admin/hotel/${id}/admin-permissions`,
                    `/api/super-admin/hotel/${id}/permissions`,
                    `/api/super-admin/hotels/${id}/admin-permissions`
                ];

                for (let p = 0; p < permissionRoutes.length; p += 1) {
                    try {
                        await axios.patch(permissionRoutes[p], { permissions: editForm.adminPermissions }, config);
                        permissionsSynced = true;
                        break;
                    } catch (permErr) {
                        const permStatus = permErr?.response?.status;
                        const permMsg = String(permErr?.response?.data?.error || permErr?.response?.data?.message || '').toLowerCase();
                        const retryNext = permStatus === 404 || permStatus === 405 || permMsg.includes('route not found');
                        if (!retryNext) {
                            throw permErr;
                        }
                    }
                }

                await fetchHotelDetails();

                const adminChanged =
                    trimmedAdminName !== (hotel.adminId?.name || '').trim()
                    || trimmedAdminEmail !== ((hotel.adminId?.username || hotel.adminId?.email || '').trim().toLowerCase())
                    || (editForm.adminPhone?.trim() || '') !== ((hotel.adminId?.phone || '').trim());

                if (adminChanged || !permissionsSynced) {
                    setSuccess('Hotel details saved. Admin profile update route is unavailable on current backend.');
                } else {
                    setSuccess('Hotel details updated successfully');
                }

                setEditMode(false);
                return;
            }

            if (response.data?.hotel) {
                setHotel(response.data.hotel);
                hydrateEditForm(response.data.hotel);
            } else {
                await fetchHotelDetails();
            }

            setSuccess('Hotel details updated successfully');
            setShowEditAdminPassword(false);
            setRevealedAdminPassword('');
            setShowRevealedAdminPassword(false);
            setEditMode(false);
        } catch (err) {
            setError(
                err.response?.data?.message
                || err.response?.data?.error
                || err.message
                || 'Failed to update hotel details'
            );
        } finally {
            setSaveLoading(false);
        }
    };

    const handleSuspend = async () => {
        setActionLoading(true);
        try {
            const token = user?.token;
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.patch(`/api/super-admin/suspend/${id}`, {}, config);
            setSuccess('Hotel suspended successfully');
            setActiveActionNote('');
            await fetchHotelDetails();
        } catch (err) {
            setError(err.response?.data?.message || 'Error suspending hotel');
        } finally {
            setActionLoading(false);
        }
    };

    const handleActivate = async () => {
        setActionLoading(true);
        try {
            const token = user?.token;
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.patch(`/api/super-admin/activate/${id}`, {}, config);
            setSuccess('Hotel activated successfully');
            setActiveActionNote('');
            await fetchHotelDetails();
        } catch (err) {
            setError(err.response?.data?.message || 'Error activating hotel');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRenew = async () => {
        setActionLoading(true);
        try {
            const token = user?.token;
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.patch(`/api/super-admin/renew/${id}`, { duration: renewDuration }, config);
            setSuccess('Subscription renewed successfully');
            setActiveActionNote('');
            await fetchHotelDetails();
        } catch (err) {
            setError(err.response?.data?.message || 'Error renewing subscription');
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpgrade = async () => {
        setActionLoading(true);
        try {
            const token = user?.token;
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.patch(`/api/super-admin/upgrade-plan/${id}`, { plan: upgradePlan }, config);
            setSuccess('Subscription plan updated successfully');
            setActiveActionNote('');
            await fetchHotelDetails();
        } catch (err) {
            setError(err.response?.data?.message || 'Error updating plan');
        } finally {
            setActionLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (loading) {
        return <div className="sa-loading">Loading hotel details...</div>;
    }
    if (!hotel) {
        return <div className="sa-loading">Hotel not found</div>;
    }

    const daysRemaining = Math.ceil((new Date(hotel.subscription?.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    const isExpired = daysRemaining < 0;

    return (
        <div className="sa-container">
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
                    <button className="sa-nav-item" onClick={() => navigate('/super-admin/dashboard')}><MdDashboard />Dashboard</button>
                    <button className="sa-nav-item active" onClick={() => navigate('/super-admin/hotels')}><FaHotel />Hotels</button>
                    <button className="sa-nav-item" onClick={() => navigate('/super-admin/hotels/create')}><FaPlus />Create Hotel</button>
                    <button className="sa-nav-item" onClick={() => navigate('/super-admin/activity-monitoring')}><FaClock />Activity Monitoring</button>
                    <button className="sa-nav-item" onClick={handleLogout}><MdLogout />Logout</button>
                </nav>
            </aside>

            {sidebarOpen && (
                <div className="sa-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
            )}

            <main className="sa-main">
                <header className="sa-header sa-header-unified">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {!sidebarOpen && (
                            <button className="sa-icon-btn sa-menu-toggle" onClick={() => setSidebarOpen(true)}><FaBars /></button>
                        )}
                        <div className="sa-header-logo"><FaHotel style={{ color: '#e11d48' }} /><span>BIREENA ATITHI</span></div>
                    </div>
                    <div className="sa-header-actions"><div className="sa-profile">{getInitials(user?.name)}</div></div>
                </header>

                <div className="sa-content">
                    <h3 className="sa-section-title">Hotel Details</h3>

                    <div className="hotel-detail-toolbar">
                        {!editMode ? (
                            <button type="button" className="action-btn primary hotel-toolbar-btn" onClick={() => setEditMode(true)}><FaEdit /> Edit All</button>
                        ) : (
                            <>
                                <button type="button" className="action-btn secondary hotel-toolbar-btn" onClick={() => { hydrateEditForm(hotel); setEditMode(false); }}>Cancel</button>
                                <button type="button" className="action-btn primary hotel-toolbar-btn" disabled={saveLoading} onClick={handleSaveEdits}><FaSave /> {saveLoading ? 'Saving...' : 'Save Changes'}</button>
                            </>
                        )}
                    </div>

                    {error && <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', marginBottom: '12px' }}>{error}</div>}
                    {success && <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid #86efac', background: '#dcfce7', color: '#166534', marginBottom: '12px' }}>{success}</div>}

                    {activeActionNote && (
                        <div className="sa-card hotel-note-panel" style={{ marginBottom: '18px' }}>
                            <div className="hotel-note-header">
                                <h4>
                                    {activeActionNote === 'renew' && 'Subscription Renewal Note'}
                                    {activeActionNote === 'upgrade' && 'Subscription Plan Note'}
                                    {activeActionNote === 'suspend' && 'Suspend Confirmation Note'}
                                </h4>
                                <button className="icon-btn" type="button" onClick={() => setActiveActionNote('')}>
                                    <FaTimesCircle />
                                </button>
                            </div>

                            {activeActionNote === 'renew' && (
                                <div className="hotel-note-body">
                                    <p>Duration select karke direct renew karein. Koi popup nahi aayega.</p>
                                    <div className="hotel-note-controls">
                                        <select value={renewDuration} onChange={(e) => setRenewDuration(e.target.value)} style={inputStyle}>
                                            <option value="1">1 Month</option>
                                            <option value="3">3 Months</option>
                                            <option value="6">6 Months</option>
                                            <option value="12">12 Months</option>
                                            <option value="24">24 Months</option>
                                        </select>
                                        <button className="action-btn primary" type="button" disabled={actionLoading} onClick={handleRenew}>
                                            <FaCalendarAlt /> {actionLoading ? 'Renewing...' : 'Confirm Renewal'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeActionNote === 'upgrade' && (
                                <div className="hotel-note-body">
                                    <p>Plan choose karke update karein.</p>
                                    <div className="hotel-note-controls">
                                        <select value={upgradePlan} onChange={(e) => setUpgradePlan(e.target.value)} style={inputStyle}>
                                            <option value="basic">Basic</option>
                                            <option value="premium">Premium</option>
                                        </select>
                                        <button className="action-btn primary" type="button" disabled={actionLoading} onClick={handleUpgrade}>
                                            <FaCheckCircle /> {actionLoading ? 'Updating...' : 'Confirm Plan Change'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeActionNote === 'suspend' && (
                                <div className="hotel-note-body">
                                    <p>Suspended karne ke baad hotel access block ho jayega. Continue karein?</p>
                                    <div className="hotel-note-controls">
                                        <button className="action-btn secondary" type="button" onClick={() => setActiveActionNote('')}>Cancel</button>
                                        <button className="action-btn danger" type="button" disabled={actionLoading} onClick={handleSuspend}>
                                            <FaTimesCircle /> {actionLoading ? 'Suspending...' : 'Confirm Suspend'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                        <div className="sa-card">
                            <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #EF4444 0%, #E31E24 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px' }}><FaBuilding /></div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937', margin: 0 }}>Hotel Information</h3>
                                </div>
                                <button type="button" className="icon-btn hotel-edit-icon" title="Edit" onClick={() => setEditMode(true)}><FaEdit /></button>
                            </div>
                            <div style={{ padding: '24px', display: 'grid', gap: '12px' }}>
                                <div><div className="hotel-inline-label">HOTEL NAME</div>{editMode ? <input style={inputStyle} name="hotelName" value={editForm.hotelName} onChange={handleEditFieldChange} /> : <div className="hotel-inline-value-bold">{hotel.name}</div>}</div>
                                <div><div className="hotel-inline-label">ADDRESS</div>{editMode ? <textarea style={inputStyle} rows={2} name="address" value={editForm.address} onChange={handleEditFieldChange} /> : <div className="hotel-inline-value">{hotel.address}</div>}</div>
                                <div><div className="hotel-inline-label">GST NUMBER</div>{editMode ? <input style={inputStyle} name="gstNumber" value={editForm.gstNumber} onChange={handleEditFieldChange} /> : <div className="hotel-inline-value">{hotel.gstNumber || '-'}</div>}</div>
                                <div><div className="hotel-inline-label">PHONE</div>{editMode ? <input style={inputStyle} name="phone" value={editForm.phone} onChange={handleEditFieldChange} /> : <div className="hotel-inline-value">{hotel.phone || '-'}</div>}</div>
                            </div>
                        </div>

                        <div className="sa-card">
                            <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #EF4444 0%, #E31E24 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px' }}><FaUser /></div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937', margin: 0 }}>Admin Information</h3>
                                </div>
                                <button type="button" className="icon-btn hotel-edit-icon" title="Edit" onClick={() => setEditMode(true)}><FaEdit /></button>
                            </div>
                            <div style={{ padding: '24px', display: 'grid', gap: '12px' }}>
                                <div><div className="hotel-inline-label">NAME</div>{editMode ? <input style={inputStyle} name="adminName" value={editForm.adminName} onChange={handleEditFieldChange} /> : <div className="hotel-inline-value-bold">{hotel.adminId?.name || '-'}</div>}</div>
                                <div><div className="hotel-inline-label">EMAIL</div>{editMode ? <input style={inputStyle} name="adminEmail" value={editForm.adminEmail} onChange={handleEditFieldChange} /> : <div className="hotel-inline-value">{hotel.adminId?.email || hotel.adminId?.username || '-'}</div>}</div>
                                <div><div className="hotel-inline-label">PHONE</div>{editMode ? <input style={inputStyle} name="adminPhone" value={editForm.adminPhone} onChange={handleEditFieldChange} /> : <div className="hotel-inline-value">{hotel.adminId?.phone || '-'}</div>}</div>
                                <div>
                                    <div className="hotel-inline-label">PASSWORD</div>
                                    {editMode ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                                style={inputStyle}
                                                type={showEditAdminPassword ? 'text' : 'password'}
                                                name="adminPassword"
                                                value={editForm.adminPassword}
                                                onChange={handleEditFieldChange}
                                                placeholder="Leave blank to keep existing password"
                                            />
                                            <button
                                                type="button"
                                                className="icon-btn"
                                                onClick={() => setShowEditAdminPassword((prev) => !prev)}
                                                title={showEditAdminPassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showEditAdminPassword ? <FaEyeSlash /> : <FaEye />}
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <div className="hotel-inline-value" style={{ minWidth: '140px' }}>
                                                {revealedAdminPassword
                                                    ? (showRevealedAdminPassword ? revealedAdminPassword : '••••••••••••')
                                                    : '••••••••••••'}
                                            </div>
                                            <button
                                                type="button"
                                                className="icon-btn"
                                                disabled={revealLoading}
                                                onClick={revealedAdminPassword ? () => setShowRevealedAdminPassword((prev) => !prev) : handleRevealAdminPassword}
                                                title={revealedAdminPassword ? (showRevealedAdminPassword ? 'Hide password' : 'Show password') : 'Load stored password'}
                                            >
                                                {revealedAdminPassword
                                                    ? (showRevealedAdminPassword ? <FaEyeSlash /> : <FaEye />)
                                                    : <FaLock />}
                                            </button>
                                            {!revealedAdminPassword && (
                                                <button
                                                    type="button"
                                                    className="action-btn secondary"
                                                    disabled={revealLoading}
                                                    onClick={handleRevealAdminPassword}
                                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                                >
                                                    {revealLoading ? 'Loading...' : 'Show Password'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div className="hotel-inline-label">ASSIGNED SCREENS</div>
                                    {!editMode ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                                            {(hotel.adminId?.permissions || []).map((permission) => (
                                                <span key={permission} style={{ fontSize: '12px', fontWeight: '600', color: '#9f1239', background: '#ffe4e6', border: '1px solid #fecdd3', padding: '6px 10px', borderRadius: '999px' }}>{permission}</span>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px', maxHeight: '220px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginTop: '8px' }}>
                                            {ADMIN_SCREEN_OPTIONS.map((permissionLabel) => {
                                                const checked = editForm.adminPermissions.includes(permissionLabel);
                                                return (
                                                    <label key={permissionLabel} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', border: checked ? '1px solid #fb7185' : '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', background: checked ? '#fff1f2' : '#fff' }}>
                                                        <input type="checkbox" checked={checked} onChange={() => toggleEditPermission(permissionLabel)} />
                                                        <span>{permissionLabel}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="sa-card" style={{ marginBottom: '24px' }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #EF4444 0%, #E31E24 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px' }}><FaCalendarAlt /></div>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937', margin: 0 }}>Subscription Information</h3>
                            </div>
                            <button type="button" className="icon-btn hotel-edit-icon" title="Edit" onClick={() => setEditMode(true)}><FaEdit /></button>
                        </div>
                        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
                            <div>
                                <div className="hotel-inline-label">PLAN</div>
                                {editMode ? (
                                    <select style={inputStyle} name="subscriptionPlan" value={editForm.subscriptionPlan} onChange={handleEditFieldChange}>
                                        <option value="basic">Basic</option>
                                        <option value="premium">Premium</option>
                                    </select>
                                ) : <div className="hotel-inline-value-bold">{hotel.subscription?.plan || '-'}</div>}
                            </div>
                            <div>
                                <div className="hotel-inline-label">START DATE</div>
                                {editMode ? <input style={inputStyle} type="date" name="subscriptionStartDate" value={editForm.subscriptionStartDate} onChange={handleEditFieldChange} /> : <div className="hotel-inline-value">{formatDate(hotel.subscription?.startDate)}</div>}
                            </div>
                            <div>
                                <div className="hotel-inline-label">EXPIRY DATE</div>
                                {editMode ? <input style={inputStyle} type="date" name="subscriptionExpiryDate" value={editForm.subscriptionExpiryDate} onChange={handleEditFieldChange} /> : <div className="hotel-inline-value">{formatDate(hotel.subscription?.expiryDate)}</div>}
                            </div>
                            <div>
                                <div className="hotel-inline-label">DAYS REMAINING</div>
                                <div style={{ fontWeight: 700, color: isExpired ? '#dc2626' : daysRemaining <= 7 ? '#b45309' : '#059669' }}>{isExpired ? 'Expired' : `${daysRemaining} days`}</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {hotel.isActive ? (
                            <button className="action-btn danger" onClick={() => setActiveActionNote('suspend')} disabled={actionLoading}><FaTimesCircle /> Suspend Hotel</button>
                        ) : (
                            <button className="action-btn primary" onClick={handleActivate} disabled={actionLoading}><FaCheckCircle /> Activate Hotel</button>
                        )}
                        <button className="action-btn secondary" onClick={() => setActiveActionNote('renew')} disabled={actionLoading}><FaCalendarAlt /> Renew Subscription</button>
                        <button className="action-btn secondary" onClick={() => setActiveActionNote('upgrade')} disabled={actionLoading}><FaCheckCircle /> Change Plan</button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default HotelDetails;
