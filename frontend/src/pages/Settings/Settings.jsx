import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Settings.css';

const Settings = () => {
    const [activeTab, setActiveTab] = useState('view-staff');
    const [searchTerm, setSearchTerm] = useState('');
    const [staffData, setStaffData] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [managingPermissions, setManagingPermissions] = useState(null);
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        email: '',
        password: '',
        confirmPassword: '',
        permissions: []
    });

    const [availablePermissions, setAvailablePermissions] = useState([
        'Dashboard',
        'Reservations',
        'Housekeeping',
        'Room Service',
        'Reservation Card',
        'Food Order',
        'Online Order',
        'Cashier Section (Table)',
        'Cashier Section (Room Service)',
        'Cashier Section (Take Away)',
        'Cashier Section (Online Order)',
        'Table View',
        'KOT Order',
        'Customer List',
        'Cashier Logs',
        'Payment Logs',
        'Reports',
        'Reports (All)',
        'Reports - Sales',
        'Reports - Payments',
        'Reports - Rooms',
        'Reports - Kitchen',
        'Reports - GST',
        'Reports - Staff',
        'Reports - Billing',
        'Reports - Reservations',
        'Reports - Analytics',
        'Property Setup',
        'Property Setup (All)',
        'Property Setup - Discount',
        'Property Setup - Generate Room QR',
        'Property Configuration',
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
        'Property Configuration - Company Settings',
        'Property Configuration - Food Menu',
        'CRM Model',
        'Add Staff'
    ]);
    const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);


    // Load staff from backend
    const fetchStaff = async () => {
        try {
            const response = await axios.get('/api/staff');
            const mappedStaff = response.data.map(staff => ({
                id: staff._id,
                fullName: staff.name,
                phone: staff.phone,
                email: staff.username,
                active: staff.isActive,
                permissions: staff.permissions || []
            }));
            setStaffData(mappedStaff);
        } catch (error) {
            console.error('Error fetching staff from database:', error);
            setStaffData([]); // Clear list on error or show empty
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const saveToLocalStorage = (data) => {
        localStorage.setItem('staffMembers', JSON.stringify(data));
    };

    const handleAddStaff = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            alert('Password and Confirm Password do not match!');
            return;
        }
        try {
            await axios.post('/api/staff', {
                fullName: formData.fullName,
                phone: formData.phone,
                email: formData.email,
                password: formData.password,
                permissions: formData.permissions
            });
            fetchStaff();
            setShowAddModal(false);
            resetForm();
        } catch (error) {
            alert(error.response?.data?.message || 'Error adding staff');
        }
    };

    const handleEditStaff = (staff) => {
        setEditingStaff(staff);
        setFormData({
            fullName: staff.fullName,
            phone: staff.phone,
            email: staff.email,
            password: '',
            confirmPassword: '',
            permissions: staff.permissions
        });
        setShowEditModal(true);
    };

    const handleUpdateStaff = async (e) => {
        e.preventDefault();
        if (formData.password && formData.password !== formData.confirmPassword) {
            alert('Password and Confirm Password do not match!');
            return;
        }
        try {
            await axios.put(`/api/staff/${editingStaff.id}`, {
                fullName: formData.fullName,
                phone: formData.phone,
                email: formData.email,
                password: formData.password || undefined,
                permissions: formData.permissions
            });
            fetchStaff();
            setShowEditModal(false);
            setEditingStaff(null);
            resetForm();
        } catch (error) {
            alert(error.response?.data?.message || 'Error updating staff');
        }
    };

    const handleDeleteStaff = async (id) => {
        if (!window.confirm('Are you sure you want to delete this staff member?')) return;
        try {
            await axios.delete(`/api/staff/${id}`);
            fetchStaff();
        } catch (error) {
            alert(error.response?.data?.message || 'Error deleting staff');
        }
    };

    const handleToggleActive = async (id) => {
        try {
            await axios.put(`/api/staff/toggle/${id}`);
            fetchStaff();
        } catch (error) {
            alert(error.response?.data?.message || 'Error toggling status');
        }
    };

    const handleManagePermissions = (staff) => {
        setManagingPermissions(staff);
    };

    const handleTogglePermissionForStaff = (permission) => {
        if (!managingPermissions) return;

        const currentPermissions = managingPermissions.permissions || [];
        const updatedPermissions = currentPermissions.includes(permission)
            ? currentPermissions.filter(p => p !== permission)
            : [...currentPermissions, permission];

        const updatedStaff = {
            ...managingPermissions,
            permissions: updatedPermissions
        };

        setManagingPermissions(updatedStaff);
    };

    const handleSavePermissions = async () => {
        if (!managingPermissions) return;
        try {
            await axios.put(`/api/staff/${managingPermissions.id}`, {
                permissions: managingPermissions.permissions
            });
            fetchStaff();
            setManagingPermissions(null);
        } catch (error) {
            alert(error.response?.data?.message || 'Error saving permissions');
        }
    };

    const handlePermissionToggle = (permission) => {
        if (formData.permissions.includes(permission)) {
            setFormData({
                ...formData,
                permissions: formData.permissions.filter(p => p !== permission)
            });
        } else {
            setFormData({
                ...formData,
                permissions: [...formData.permissions, permission]
            });
        }
    };

    const resetForm = () => {
        setFormData({
            fullName: '',
            phone: '',
            email: '',
            password: '',
            confirmPassword: '',
            permissions: []
        });
        setIsPermissionsOpen(false);
    };

    const filteredStaff = staffData.filter(staff =>
        staff.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.phone.includes(searchTerm)
    );

    return (
        <div className="settings-page">
            <div className="settings-header">
                <h1>👨‍💼 Add Staff</h1>
            </div>

            {/* Tabs */}
            <div className="settings-tabs">
                <button
                    className={`settings-tab ${activeTab === 'view-staff' ? 'active' : ''}`}
                    onClick={() => setActiveTab('view-staff')}
                >
                    View Staff
                </button>
                <button
                    className={`settings-tab ${activeTab === 'permissions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('permissions')}
                >
                    Permissions
                </button>
            </div>

            {/* View Staff Section */}
            {activeTab === 'view-staff' && !managingPermissions && (
                <>
                    <div className="settings-toolbar">
                        <div className="search-wrapper-staff">
                            <svg className="search-icon-staff" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                            <input
                                type="text"
                                placeholder="Search by name or phone number..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                                className="settings-search-input"
                            />
                        </div>
                        <button
                            className="add-staff-btn"
                            onClick={() => { setShowAddModal(true); }}
                        >
                            <span className="btn-icon">+</span>
                            <span>Add New Staff</span>
                        </button>
                    </div>
                    <div className="settings-table-container">
                        <table className="settings-table">
                            <thead>
                                <tr>
                                    <th>FULL NAME</th>
                                    <th>PHONE</th>
                                    <th>ACTIVE</th>
                                    <th>PERMISSIONS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStaff.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="no-data">
                                            No staff members found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStaff.map((staff) => (
                                        <tr key={staff.id}>
                                            <td>
                                                <div className="staff-info">
                                                    <span className="staff-name">{staff.fullName}</span>
                                                    <span className="staff-email">{staff.email}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="phone-number">{staff.phone}</span>
                                            </td>
                                            <td>
                                                <span className={`active-badge ${staff.active ? 'yes' : 'no'}`}>
                                                    <span className="badge-dot">{staff.active ? '●' : '●'}</span>
                                                    {staff.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="permissions-cell">
                                                {staff.permissions.length > 0 ? (
                                                    <div className="permissions-tags">
                                                        {staff.permissions.slice(0, 2).map((perm, idx) => (
                                                            <span key={idx} className="permission-tag">{perm}</span>
                                                        ))}
                                                        {staff.permissions.length > 2 && (
                                                            <span className="permission-tag-more">+{staff.permissions.length - 2}</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="no-permissions">No permissions</span>
                                                )}
                                            </td>
                                            <td className="actions-cell">
                                                <button
                                                    className="action-btn edit-btn"
                                                    onClick={() => handleEditStaff(staff)}
                                                    title="Edit Staff"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="action-btn permission-btn"
                                                    onClick={() => handleManagePermissions(staff)}
                                                    title="Edit Permissions"
                                                >
                                                    🔐
                                                </button>
                                                <button
                                                    className="action-btn delete-btn"
                                                    onClick={() => handleDeleteStaff(staff.id)}
                                                    title="Delete Staff"
                                                >
                                                    🗑️
                                                </button>
                                                <button
                                                    className="action-btn toggle-btn"
                                                    onClick={() => handleToggleActive(staff.id)}
                                                    title={staff.active ? 'Deactivate Staff' : 'Activate Staff'}
                                                >
                                                    {staff.active ? '✓' : '✗'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Manage Permissions View */}
            {managingPermissions && activeTab === 'view-staff' && (
                <div className="manage-permissions-container">
                    <div className="manage-permissions-header">
                        <div className="staff-details">
                            <h2>Manage Permissions</h2>
                            <p className="staff-meta">Staff: <strong>{managingPermissions.fullName}</strong> | Phone: <strong>{managingPermissions.phone}</strong></p>
                        </div>
                        <button
                            className="back-to-list-btn"
                            onClick={() => setManagingPermissions(null)}
                        >
                            ← Back to List
                        </button>
                    </div>

                    <div className="permissions-management-grid">
                        {availablePermissions.map((permission, index) => {
                            const isChecked = managingPermissions.permissions?.includes(permission) || false;
                            return (
                                <div key={index} className="permission-checkbox-card">
                                    <label className="permission-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleTogglePermissionForStaff(permission)}
                                            className="permission-checkbox-input"
                                        />
                                        <div className="permission-checkbox-content">
                                            <span className="permission-checkbox-icon">🔐</span>
                                            <span className="permission-checkbox-text">{permission}</span>
                                        </div>
                                    </label>
                                </div>
                            );
                        })}
                    </div>

                    <div className="permissions-actions">
                        <button
                            className="btn-cancel"
                            onClick={() => setManagingPermissions(null)}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn-submit"
                            onClick={handleSavePermissions}
                        >
                            Save Permissions
                        </button>
                    </div>
                </div>
            )}

            {/* Permissions View */}
            {activeTab === 'permissions' && (
                <div className="permissions-info-section">
                    <h2>Available Permissions</h2>
                    <div className="permissions-grid">
                        {availablePermissions.map((permission, index) => {
                            const staffWithPermission = staffData.filter(staff =>
                                staff.permissions.includes(permission)
                            );
                            return (
                                <div key={index} className="permission-card">
                                    <div className="permission-header">
                                        <span className="permission-icon">🔐</span>
                                        <span className="permission-name">{permission}</span>
                                    </div>
                                    <div className="permission-staff-count">
                                        <span className="staff-count-badge">
                                            {staffWithPermission.length} {staffWithPermission.length === 1 ? 'Staff' : 'Staff Members'}
                                        </span>
                                    </div>
                                    {staffWithPermission.length > 0 ? (
                                        <div className="permission-staff-list">
                                            {staffWithPermission.map(staff => (
                                                <div key={staff.id} className="staff-chip">
                                                    <span className="staff-chip-name">{staff.fullName}</span>
                                                    <span className={`staff-chip-status ${staff.active ? 'active' : 'inactive'}`}>
                                                        {staff.active ? '●' : '○'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="no-staff-assigned">
                                            <span>No staff assigned</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Add/Edit Staff Modal */}
            {(showAddModal || showEditModal) && (
                <div className="modal-overlay" onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{showEditModal ? '✏️ Edit Staff Member' : '➕ Add New Staff'}</h2>
                            <button
                                className="modal-close"
                                onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={showEditModal ? handleUpdateStaff : handleAddStaff}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Full Name *</label>
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Phone Number *</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Email *</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Password {!showEditModal && '*'}</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required={!showEditModal}
                                        placeholder={showEditModal ? 'Leave blank to keep current' : ''}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Confirm Password {!showEditModal && '*'}</label>
                                    <input
                                        type="password"
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        required={!showEditModal}
                                        placeholder={showEditModal ? 'Leave blank to keep current' : ''}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Permissions</label>
                                    <div className="permissions-dropdown-container" style={{ position: 'relative' }}>
                                        <div
                                            className="permissions-dropdown-trigger"
                                            onClick={() => setIsPermissionsOpen(!isPermissionsOpen)}
                                            style={{
                                                padding: '10px',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                background: '#fff'
                                            }}
                                        >
                                            <span className="selected-count">
                                                {formData.permissions.length > 0
                                                    ? `${formData.permissions.length} Permissions Selected`
                                                    : 'Select Permissions'}
                                            </span>
                                            <span className={`dropdown-arrow`}>{isPermissionsOpen ? '▲' : '▼'}</span>
                                        </div>

                                        {isPermissionsOpen && (
                                            <div className="permissions-dropdown-content" style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                right: 0,
                                                background: '#fff',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                marginTop: '5px',
                                                zIndex: 1000,
                                                padding: '10px',
                                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                            }}>
                                                <div className="permissions-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                    {availablePermissions.map(permission => (
                                                        <div
                                                            key={permission}
                                                            className={`permission-item ${formData.permissions.includes(permission) ? 'selected' : ''}`}
                                                            onClick={() => handlePermissionToggle(permission)}
                                                            style={{
                                                                background: formData.permissions.includes(permission) ? '#dcfce7' : 'transparent',
                                                                color: formData.permissions.includes(permission) ? '#166534' : 'inherit',
                                                                cursor: 'pointer',
                                                                padding: '8px',
                                                                margin: '4px 0',
                                                                borderRadius: '4px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                border: formData.permissions.includes(permission) ? '1px solid #bbf7d0' : '1px solid transparent'
                                                            }}
                                                        >
                                                            <span>{permission}</span>
                                                            {formData.permissions.includes(permission) && <span>✓</span>}
                                                        </div>
                                                    ))}
                                                </div>

                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-submit">
                                    {showEditModal ? 'Update Staff' : 'Add Staff'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;

