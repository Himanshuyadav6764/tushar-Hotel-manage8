import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RoleBadge from './RoleBadge';
import { hasModuleAccess, MODULES } from '../config/rbac';
import './AdminNavbar.css';
import Logo from '../assets/logo_new.jpg';

const AdminNavbar = ({
    sidebarOpen,
    setSidebarOpen,
    showSidebarToggle = true,
    title = "BIREENA ATITHI"
}) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth(); // Get current user and logout function
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);

    // Dynamic user initials
    const userInitials = user?.name ? (
        user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    ) : "ST";

    const handleLogout = () => {
        logout(); // Use centralized logout from AuthContext
        navigate('/login');
    };

    const handleViewProfile = () => {
        navigate('/admin/my-profile');
        setShowProfileDropdown(false);
    };

    const topBarTitle = user?.role === 'staff' ? "STAFF PORTAL" : title;

    return (
        <div className={`top-bar ${sidebarOpen ? 'sidebar-open' : ''}`}>
            <div className="top-bar-left">
                {showSidebarToggle && !sidebarOpen && (
                    <button className="hamburger-menu" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                )}
                {!sidebarOpen && (
                    <div className="top-bar-logo">
                        <img src={Logo} alt={topBarTitle} className="top-bar-logo-img" />
                    </div>
                )}

            </div>

            <div className="top-bar-right">
                {/* 1. Stay Overview Icon */}
                {hasModuleAccess(user, MODULES.RESERVATIONS) && (
                    <button className="top-icon-btn" title="Reservations" onClick={() => navigate('/admin/stay-overview')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                    </button>
                )}

                {/* 2. Guest Meal Service Icon */}
                {hasModuleAccess(user, MODULES.GUEST_MEAL_SERVICE) && (
                    <button className="top-icon-btn" title="Orders" onClick={() => navigate('/admin/guest-meal-service')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                            <path d="M3 6h18" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                    </button>
                )}

                {/* Role Badge */}
                <RoleBadge />

                {/* Avatar with Profile Dropdown */}
                <div className="profile-dropdown-wrapper">
                    <div
                        className="profile-trigger"
                        onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                        title="Profile"
                    >
                        <div className="profile-avatar">
                            {userInitials}
                        </div>
                        <svg className="profile-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </div>

                    {showProfileDropdown && (
                        <div className="profile-dropdown">
                            <button className="dropdown-item" onClick={handleViewProfile}>
                                👤 My Profile
                            </button>
                            <button className="dropdown-item logout" onClick={handleLogout}>
                                🚪 Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminNavbar;
