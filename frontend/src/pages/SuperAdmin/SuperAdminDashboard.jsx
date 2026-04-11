import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    FaHotel,
    FaShieldAlt,
    FaExclamationTriangle,
    FaClock,
    FaHistory,
    FaChevronRight,
    FaBars,
    FaBuilding,
    FaPlus,
    FaUser,
    FaFilter,
    FaTimes,
    FaCheck,
    FaBan,
    FaRedo,
    FaEdit
} from 'react-icons/fa';
import { MdDashboard, MdLogout } from 'react-icons/md';
import LogoNew from '../../assets/logo_new.jpg';
import './SuperAdminDashboard.css';

const SuperAdminDashboard = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeView, setActiveView] = useState('dashboard');

    // Data States
    const [hotels, setHotels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statistics, setStatistics] = useState({
        totalHotels: 0,
        activeHotels: 0,
        suspended: 0,
        expiringSoon: 0
    });

    // Search & Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterPlan, setFilterPlan] = useState('all');
    const [showFilters, setShowFilters] = useState(false);

    // Notification States
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);

    // Subscription Management States
    const [actionLoading, setActionLoading] = useState(null);

    // Fetch Data
    const fetchDashboardData = async () => {
        try {
            const token = user?.token;
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            // Fetch dashboard statistics
            const statsResponse = await axios.get('/api/super-admin/dashboard', config);
            setStatistics(statsResponse.data);

            // Fetch hotels list
            const hotelsResponse = await axios.get('/api/super-admin/hotels', config);
            setHotels(hotelsResponse.data);

            setLoading(false);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load dashboard data');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [user]);

    // Generate Notifications
    useEffect(() => {
        if (hotels.length > 0) {
            const notifs = [];
            hotels.forEach(hotel => {
                const daysLeft = getDaysLeft(hotel.subscription?.expiryDate);

                if (daysLeft < 0) {
                    notifs.push({
                        id: hotel._id,
                        type: 'expired',
                        message: `${hotel.name}'s subscription has expired`,
                        hotel: hotel.name,
                        priority: 'high'
                    });
                } else if (daysLeft <= 7) {
                    notifs.push({
                        id: hotel._id,
                        type: 'expiring',
                        message: `${hotel.name}'s subscription expires in ${daysLeft} days`,
                        hotel: hotel.name,
                        priority: 'medium'
                    });
                }

                if (!hotel.subscription?.active) {
                    notifs.push({
                        id: hotel._id + '_suspended',
                        type: 'suspended',
                        message: `${hotel.name} is currently suspended`,
                        hotel: hotel.name,
                        priority: 'high'
                    });
                }
            });
            setNotifications(notifs);
        }
    }, [hotels]);

    // Filter Hotels based on search and filters
    const filteredHotels = useMemo(() => {
        return hotels.filter(hotel => {
            // Search filter
            const matchesSearch = searchTerm === '' ||
                hotel.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                hotel.adminId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                hotel.adminId?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                hotel.phone?.includes(searchTerm);

            // Status filter
            const matchesStatus = filterStatus === 'all' ||
                (filterStatus === 'active' && hotel.subscription?.active) ||
                (filterStatus === 'suspended' && !hotel.subscription?.active) ||
                (filterStatus === 'expiring' && getDaysLeft(hotel.subscription?.expiryDate) <= 7 && getDaysLeft(hotel.subscription?.expiryDate) >= 0);

            // Plan filter
            const matchesPlan = filterPlan === 'all' || hotel.subscription?.plan === filterPlan;

            return matchesSearch && matchesStatus && matchesPlan;
        });
    }, [hotels, searchTerm, filterStatus, filterPlan]);

    // Subscription Management Functions
    const handleExtendSubscription = async (hotelId, days = 30) => {
        if (!window.confirm(`Extend subscription by ${days} days?`)) return;

        setActionLoading(hotelId);
        try {
            const token = user?.token;
            await axios.post(
                `/api/super-admin/hotel/${hotelId}/extend-subscription`,
                { days },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            await fetchDashboardData();
            alert('Subscription extended successfully!');
        } catch (err) {
            alert('Failed to extend subscription: ' + (err.response?.data?.message || err.message));
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleStatus = async (hotelId, currentStatus) => {
        const action = currentStatus ? 'suspend' : 'activate';
        if (!window.confirm(`Are you sure you want to ${action} this hotel?`)) return;

        setActionLoading(hotelId);
        try {
            const token = user?.token;
            await axios.patch(
                `/api/super-admin/hotel/${hotelId}/toggle-status`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            await fetchDashboardData();
            alert(`Hotel ${action}d successfully!`);
        } catch (err) {
            alert(`Failed to ${action} hotel: ` + (err.response?.data?.message || err.message));
        } finally {
            setActionLoading(null);
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilterStatus('all');
        setFilterPlan('all');
    };

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    const getInitials = (name) => {
        if (!name) return 'SA';
        const parts = name.trim().split(' ').filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getDaysLeft = (dateString) => {
        if (!dateString) return 0;
        const diff = new Date(dateString) - new Date();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    if (loading) return <div className="sa-loading">Loading Dashboard...</div>;

    return (
        <div className="sa-container">
            {/* Sidebar */}
            <aside className={`sa-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sa-sidebar-header">
                    <span style={{ fontSize: '24px', color: '#d41424' }}>⚡</span>
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
                        className={`sa-nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveView('dashboard')}
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
                        className="sa-nav-item"
                        onClick={() => navigate('/super-admin/hotels/create')}
                    >
                        <FaPlus />
                        Create Hotel
                    </button>
                    <button
                        className="sa-nav-item"
                        onClick={() => navigate('/super-admin/activity-monitoring')}
                    >
                        <FaHistory />
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
                            <img src={LogoNew} alt="BIREENA ATITHI" className="project-logo-main" />
                        </div>
                    </div>

                    <div className="sa-header-actions">
                        <div className="sa-profile" onClick={() => navigate('/super-admin/profile')} style={{ cursor: 'pointer', overflow: 'hidden' }}>
                            {user?.image ? (
                                <img src={user.image} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                getInitials(user?.name)
                            )}
                        </div>
                    </div>
                </header>

                <div className="sa-content">
                    {activeView === 'dashboard' ? (
                        <>
                            <h3 className="sa-section-title">Hotel Statistics</h3>
                            <div className="sa-stats-grid">
                                <div className="sa-stat-card">
                                    <FaBuilding className="sa-stat-icon-large" />
                                    <div className="sa-stat-content">
                                        <div className="sa-stat-icon-wrapper">
                                            <FaBuilding />
                                        </div>
                                        <div className="sa-stat-label">Total Hotels</div>
                                        <div className="sa-stat-value">{statistics.totalHotels}</div>
                                    </div>
                                </div>
                                <div className="sa-stat-card">
                                    <FaShieldAlt className="sa-stat-icon-large" />
                                    <div className="sa-stat-content">
                                        <div className="sa-stat-icon-wrapper">
                                            <FaShieldAlt />
                                        </div>
                                        <div className="sa-stat-label">Active Hotels</div>
                                        <div className="sa-stat-value">{statistics.activeHotels}</div>
                                    </div>
                                </div>
                                <div className="sa-stat-card">
                                    <FaExclamationTriangle className="sa-stat-icon-large" />
                                    <div className="sa-stat-content">
                                        <div className="sa-stat-icon-wrapper">
                                            <FaExclamationTriangle />
                                        </div>
                                        <div className="sa-stat-label">Suspended Hotels</div>
                                        <div className="sa-stat-value">{statistics.suspended}</div>
                                    </div>
                                </div>
                                <div className="sa-stat-card">
                                    <FaClock className="sa-stat-icon-large" />
                                    <div className="sa-stat-content">
                                        <div className="sa-stat-icon-wrapper">
                                            <FaClock />
                                        </div>
                                        <div className="sa-stat-label">Expiring Soon</div>
                                        <div className="sa-stat-value">{statistics.expiringSoon}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="search-filter-section">
                                <div className="search-bar">
                                    <input
                                        type="text"
                                        placeholder="Search hotels..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                                        className="search-input"
                                    />
                                </div>
                                <button
                                    className="filter-toggle-btn"
                                    onClick={() => setShowFilters(!showFilters)}
                                    aria-expanded={showFilters}
                                >
                                    <FaFilter /> Filters
                                </button>
                            </div>

                            {showFilters && (
                                <div className="filter-options">
                                    <div className="filter-group">
                                        <label htmlFor="status-filter">Status</label>
                                        <select
                                            id="status-filter"
                                            value={filterStatus}
                                            onChange={(e) => setFilterStatus(e.target.value)}
                                        >
                                            <option value="all">All</option>
                                            <option value="active">Active</option>
                                            <option value="suspended">Suspended</option>
                                            <option value="expiring">Expiring Soon</option>
                                        </select>
                                    </div>

                                    <div className="filter-group">
                                        <label htmlFor="plan-filter">Plan</label>
                                        <select
                                            id="plan-filter"
                                            value={filterPlan}
                                            onChange={(e) => setFilterPlan(e.target.value)}
                                        >
                                            <option value="all">All Plans</option>
                                            <option value="basic">Basic</option>
                                            <option value="premium">Premium</option>
                                            <option value="enterprise">Enterprise</option>
                                        </select>
                                    </div>

                                    <button className="clear-filters-btn" onClick={clearFilters}>
                                        <FaTimes /> Clear Filters
                                    </button>

                                    <div className="filter-results">{filteredHotels.length} result(s)</div>
                                </div>
                            )}

                            <div className="sa-card">
                                <div className="sa-card-header">
                                    <div className="sa-card-title">Subscription Status</div>
                                </div>
                                <div className="table-responsive subscription-table-scroll">
                                    <table className="sa-table">
                                        <thead>
                                            <tr>
                                                <th>Hotel Details</th>
                                                <th>Admin Contact</th>
                                                <th>Subscription</th>
                                                <th style={{ textAlign: 'center' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredHotels.length > 0 ? (
                                                filteredHotels.slice(0, 5).map((hotel) => {
                                                    const daysLeft = getDaysLeft(hotel.subscription?.expiryDate);
                                                    const isExpiring = daysLeft < 7 && daysLeft >= 0;
                                                    const isExpired = daysLeft < 0;
                                                    const isActive = hotel.subscription?.active;
                                                    return (
                                                        <tr key={hotel._id}>
                                                            <td>
                                                                <div className="font-bold">{hotel.name}</div>
                                                                <div className="text-xs opacity-70">
                                                                    {hotel.subscription?.plan.toUpperCase()}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div>{hotel.adminId?.name || 'No Admin'}</div>
                                                                <div className="text-xs opacity-70">{hotel.adminId?.email || '-'}</div>
                                                            </td>
                                                            <td>
                                                                <div className={isExpired || isExpiring ? 'text-red' : 'text-green'}>
                                                                    {formatDate(hotel.subscription?.expiryDate)}
                                                                </div>
                                                                <div className="text-xs">{daysLeft} days left</div>
                                                            </td>
                                                            <td>
                                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                                    <button onClick={() => handleExtendSubscription(hotel._id)}><FaRedo /></button>
                                                                    <button onClick={() => handleToggleStatus(hotel._id, isActive)}>
                                                                        {isActive ? <FaBan /> : <FaCheck />}
                                                                    </button>
                                                                    <button onClick={() => navigate(`/super-admin/hotel/${hotel._id}`)}><FaEdit /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No hotels found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            </main>
        </div>
    );
};

export default SuperAdminDashboard;

