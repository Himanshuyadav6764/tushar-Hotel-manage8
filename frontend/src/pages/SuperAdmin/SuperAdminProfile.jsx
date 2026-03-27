import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { apiCall } from '../../config/api';
import '../Profile/MyProfile.css';

const SuperAdminProfile = () => {
    const { user, updateUser } = useAuth();

    // Form state
    const [formData, setFormData] = useState({
        fullName: user?.name || '',
        email: user?.username || user?.email || '',
        role: 'Super Administrator',
        image: user?.image || ''
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [showPasswordError, setShowPasswordError] = useState('');
    const [showPasswordSuccess, setShowPasswordSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [updateError, setUpdateError] = useState('');
    const [updateSuccess, setUpdateSuccess] = useState('');

    // Fetch fresh profile data on mount
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await apiCall('/api/super-admin/profile');
                const data = await response.json();
                if (data && updateUser) {
                    updateUser(data);
                }
            } catch (error) {
                console.error('Failed to sync profile:', error);
            }
        };
        fetchProfile();
    }, []);

    // Keep form data in sync with AuthContext user
    useEffect(() => {
        if (user) {
            setFormData({
                fullName: user.name || '',
                email: user.username || user.email || '',
                role: 'Super Administrator',
                image: user.image || ''
            });
            setPhotoPreview(user.image || null);
        }
    }, [user]);

    // Account activity data
    const accountActivity = {
        lastLogin: user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'N/A',
        lastLoginIP: '192.168.1.100', // Mock IP or should come from user object if available
        accountCreated: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'
    };

    // Get user initials
    const getUserInitials = (name) => {
        const names = name?.trim().split(' ') || [];
        if (names.length >= 2) {
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }
        return name ? name.substring(0, 2).toUpperCase() : 'SA';
    };

    // Handle form input changes
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };

    // Handle password input changes
    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordData({
            ...passwordData,
            [name]: value
        });
    };

    // Handle photo upload
    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file size (limit to 2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert('File is too large. Max size is 2MB.');
                return;
            }

            // Check file type
            if (!file.type.match('image.*')) {
                alert('Please select an image file (PNG, JPG, etc).');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result);
                // Trigger edit mode so the "Save Changes" button becomes visible
                setEditMode(true);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle save profile changes
    const handleSaveChanges = async () => {
        try {
            setLoading(true);
            setUpdateError('');
            setUpdateSuccess('');

            const response = await apiCall('/api/super-admin/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.fullName,
                    image: photoPreview // Send the base64 string
                })
            });

            const data = await response.json();

            if (data.user) {
                setUpdateSuccess('Profile updated successfully!');
                // Update the local auth context if possible
                if (updateUser) {
                    updateUser(data.user);
                } else {
                    // Fallback: manually update localStorage if updateUser is not available
                    const savedUser = JSON.parse(localStorage.getItem('authUser') || '{}');
                    const newUser = { ...savedUser, ...data.user };
                    localStorage.setItem('authUser', JSON.stringify(newUser));
                    // Note: This won't trigger re-render in other components unless AuthContext listens to LS
                }
                setEditMode(false);
            } else {
                setUpdateError(data.message || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Update profile error:', error);
            setUpdateError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Handle password update
    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        setShowPasswordError('');
        setShowPasswordSuccess('');

        // Validation
        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
            setShowPasswordError('All password fields are required');
            return;
        }

        if (passwordData.newPassword.length < 8) {
            setShowPasswordError('New password must be at least 8 characters');
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setShowPasswordError('New passwords do not match');
            return;
        }

        try {
            setLoading(true);
            const response = await apiCall('/api/super-admin/change-password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                })
            });

            const data = await response.json();

            if (response.status === 200) {
                setShowPasswordSuccess('Password changed successfully!');
                setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
            } else {
                setShowPasswordError(data.message || 'Failed to change password');
            }
        } catch (error) {
            setShowPasswordError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }

        setTimeout(() => {
            setShowPasswordSuccess('');
            setShowPasswordError('');
        }, 5000);
    };

    // Handle cancel
    const handleCancel = () => {
        setEditMode(false);
        setFormData({
            fullName: user?.name || '',
            email: user?.username || user?.email || '',
            role: 'Super Administrator',
            image: user?.image || ''
        });
        setPhotoPreview(user?.image || null);
        setUpdateError('');
        setUpdateSuccess('');
    };

    return (
        <div className="my-profile-container" style={{ padding: '0' }}>
            {/* Page Header */}
            <motion.div 
                className="profile-header"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <div className="header-content">
                    <h1 className="header-title">My Profile</h1>
                    <p className="header-subtitle">Manage your super admin account settings</p>
                </div>
                <div className="breadcrumb">
                    <span>Dashboard</span> / <span className="breadcrumb-active">My Profile</span>
                </div>
            </motion.div>

            {/* Profile Content */}
            <div className="profile-content">
                {/* CARD 1: Profile Overview */}
                <motion.div 
                    className="profile-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                >
                    <div className="card-header">
                        <h2>Profile Overview</h2>
                    </div>
                    <div className="profile-overview">
                        {/* Left: Avatar */}
                        <div className="avatar-section">
                            <div className="avatar-container">
                                {photoPreview ? (
                                    <img 
                                        src={photoPreview} 
                                        alt="Profile" 
                                        className="avatar-image"
                                    />
                                ) : (
                                    <div className="avatar-initials">
                                        {getUserInitials(formData.fullName)}
                                    </div>
                                )}
                            </div>
                            <label htmlFor="photo-upload" className="upload-photo-btn">
                                📷 Upload Photo
                            </label>
                            <input
                                id="photo-upload"
                                type="file"
                                accept="image/png, image/jpeg, image/jpg"
                                onChange={handlePhotoUpload}
                                style={{ display: 'none' }}
                            />
                        </div>

                        {/* Right: Profile Info */}
                        <div className="profile-info">
                            <div className="info-row">
                                <span className="info-label">Full Name</span>
                                <span className="info-value">{formData.fullName}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Role</span>
                                <span className="role-badge" style={{ background: 'linear-gradient(135deg, #EF4444 0%, #E31E24 100%)', color: 'white' }}>
                                    {formData.role}
                                </span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Email</span>
                                <span className="info-value">{formData.email}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* CARD 2: Personal Information */}
                <motion.div 
                    className="profile-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                >
                    <div className="card-header">
                        <h2>Personal Information</h2>
                        {!editMode ? (
                            <button
                                className="edit-btn"
                                onClick={() => setEditMode(true)}
                            >
                                ✏️ Edit
                            </button>
                        ) : (
                            <button
                                className="edit-btn active"
                                onClick={handleCancel}
                            >
                                ✕ Cancel
                            </button>
                        )}
                    </div>

                    <div className="form-content">
                        {updateError && (
                            <div className="alert alert-error">
                                ⚠️ {updateError}
                            </div>
                        )}

                        {updateSuccess && (
                            <div className="alert alert-success">
                                ✓ {updateSuccess}
                            </div>
                        )}
                        <div className="form-grid">
                            {/* Full Name */}
                            <div className="form-group">
                                <label className="form-label">
                                    Full Name <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="fullName"
                                    className={`form-input ${!editMode ? 'disabled' : ''}`}
                                    value={formData.fullName}
                                    onChange={handleFormChange}
                                    disabled={!editMode}
                                    placeholder="Enter your full name"
                                />
                                <span className="helper-text">Your legal name as super administrator</span>
                            </div>

                            {/* Email Address (Disabled) */}
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input
                                    type="email"
                                    name="email"
                                    className="form-input disabled"
                                    value={formData.email}
                                    disabled
                                    placeholder="email@example.com"
                                />
                                <span className="helper-text">Email cannot be changed. Contact support if needed.</span>
                            </div>

                            {/* Role (Disabled) */}
                            <div className="form-group">
                                <label className="form-label">Role</label>
                                <input
                                    type="text"
                                    name="role"
                                    className="form-input disabled"
                                    value={formData.role}
                                    disabled
                                    placeholder="Super Administrator"
                                />
                                <span className="helper-text">Highest level of system access</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* CARD 3: Security Settings */}
                <motion.div 
                    className="profile-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                >
                    <div className="card-header">
                        <h2>🔐 Security Settings</h2>
                    </div>

                    <div className="form-content">
                        {showPasswordError && (
                            <div className="alert alert-error">
                                ⚠️ {showPasswordError}
                            </div>
                        )}

                        {showPasswordSuccess && (
                            <div className="alert alert-success">
                                ✓ {showPasswordSuccess}
                            </div>
                        )}

                        <form onSubmit={handlePasswordUpdate}>
                            <div className="form-grid-single">
                                {/* Current Password */}
                                <div className="form-group">
                                    <label className="form-label">
                                        Current Password <span className="required">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        name="currentPassword"
                                        className="form-input"
                                        value={passwordData.currentPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Enter your current password"
                                    />
                                </div>

                                {/* New Password */}
                                <div className="form-group">
                                    <label className="form-label">
                                        New Password <span className="required">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        name="newPassword"
                                        className="form-input"
                                        value={passwordData.newPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Enter new password"
                                    />
                                    <span className="helper-text">Minimum 8 characters with uppercase, lowercase, and numbers</span>
                                </div>

                                {/* Confirm New Password */}
                                <div className="form-group">
                                    <label className="form-label">
                                        Confirm New Password <span className="required">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        className="form-input"
                                        value={passwordData.confirmPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Re-enter new password"
                                    />
                                </div>
                            </div>

                            <div className="security-actions">
                                <button type="submit" className="btn btn-primary">
                                    Update Password
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>

                {/* CARD 4: Account Activity */}
                <motion.div 
                    className="profile-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 }}
                >
                    <div className="card-header">
                        <h2>📊 Account Activity</h2>
                    </div>

                    <div className="activity-content">
                        <div className="activity-row">
                            <span className="activity-label">Last Login</span>
                            <span className="activity-value">{accountActivity.lastLogin}</span>
                        </div>
                        <div className="activity-row">
                            <span className="activity-label">Last Login IP</span>
                            <span className="activity-value">{accountActivity.lastLoginIP}</span>
                        </div>
                        <div className="activity-row">
                            <span className="activity-label">Account Created</span>
                            <span className="activity-value">{accountActivity.accountCreated}</span>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Action Buttons - Fixed at bottom for visibility */}
            {editMode && (
                <motion.div 
                    className="action-buttons-sticky"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                >
                    <div className="sticky-content">
                        <div className="pending-indicator">
                            <span className="dot"></span>
                            You have unsaved changes
                        </div>
                        <div className="button-group">
                            <button className="btn btn-secondary" onClick={handleCancel} disabled={loading}>
                                Cancel
                            </button>
                            <button className="btn btn-primary btn-glow" onClick={handleSaveChanges} disabled={loading}>
                                {loading ? (
                                    <><span className="spinner"></span> Saving...</>
                                ) : (
                                    'Save Profile Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default SuperAdminProfile;
