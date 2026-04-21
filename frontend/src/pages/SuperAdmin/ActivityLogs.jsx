import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    FaHotel,
    FaFilter,
    FaTimes,
    FaExclamationTriangle,
    FaCheckCircle,
    FaClock,
    FaUser,
    FaDownload,
    FaBars,
    FaPlus,
    FaHistory,
    FaExclamationCircle
} from 'react-icons/fa';
import { MdDashboard, MdLogout } from 'react-icons/md';
import './SuperAdminDashboard.css';

/**
 * REASONING FOR ACTIVITY LOGS PAGE:
 * 
 * 1. TRANSPARENCY: Super admins can see all actions performed in the system
 * 2. SECURITY MONITORING: Detect unusual patterns or unauthorized activities
 * 3. COMPLIANCE: Meet audit requirements for action tracking
 * 4. TROUBLESHOOTING: Debug issues by reviewing historical actions
 * 5. ACCOUNTABILITY: Track who did what and when
 */

const ActivityLogs = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    
    // UI States
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Data States
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState(null);
    
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [filterTargetType, setFilterTargetType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPeriod, setFilterPeriod] = useState('7d');
    const [showFilters, setShowFilters] = useState(false);
    
    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit] = useState(50);

    // Fetch Logs
    const fetchLogs = async () => {
        try {
            const token = user?.token;
            const config = {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    page: currentPage,
                    limit,
                    ...(filterAction && { action: filterAction }),
                    ...(filterTargetType && { targetType: filterTargetType }),
                    ...(filterStatus && { status: filterStatus })
                }
            };

            const response = await axios.get('/api/super-admin/audit-logs', config);
            setLogs(response.data.logs);
            setTotalPages(response.data.pagination.pages);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching logs:', err);
            setError('Failed to load activity logs');
            setLoading(false);
        }
    };

    // Fetch Statistics
    const fetchStats = async () => {
        try {
            const token = user?.token;
            const config = {
                headers: { Authorization: `Bearer ${token}` },
                params: { period: filterPeriod }
            };

            const response = await axios.get('/api/super-admin/audit-stats', config);
            setStats(response.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    useEffect(() => {
        fetchLogs();
        fetchStats();
    }, [currentPage, filterAction, filterTargetType, filterStatus, filterPeriod, user]);

    // Utility Functions
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getActionIcon = (action) => {
        if (action.includes('created')) return <FaPlus className="action-icon success" />;
        if (action.includes('deleted')) return <FaTimes className="action-icon danger" />;
        if (action.includes('suspended')) return <FaExclamationTriangle className="action-icon warning" />;
        if (action.includes('activated')) return <FaCheckCircle className="action-icon success" />;
        if (action.includes('renewed')) return <FaClock className="action-icon primary" />;
        if (action.includes('updated')) return <FaCheckCircle className="action-icon info" />;
        return <FaHistory className="action-icon" />;
    };

    const getStatusBadge = (status) => {
        switch(status) {
            case 'success':
                return <span className="badge badge-success">Success</span>;
            case 'failed':
                return <span className="badge badge-danger">Failed</span>;
            case 'pending':
                return <span className="badge badge-warning">Pending</span>;
            default:
                return <span className="badge badge-secondary">{status}</span>;
        }
    };

    const getActionLabel = (action) => {
        return action.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    const handleExport = () => {
        const csvData = logs.map(log => ({
            Date: formatDate(log.createdAt),
            User: log.userEmail,
            Action: getActionLabel(log.action),
            Target: log.targetType,
            Status: log.status,
            IP: log.ipAddress || '-'
        }));

        const headers = Object.keys(csvData[0] || {});
        const csv = [
            headers.join(','),
            ...csvData.map(row => headers.map(h => `"${row[h]}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const clearFilters = () => {
        setFilterAction('');
        setFilterTargetType('');
        setFilterStatus('');
        setSearchTerm('');
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getInitials = (name) => {
        if (!name) return 'SA';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    if (loading) return <div className="sa-loading">Loading Activity Logs...</div>;

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
                        onClick={() => navigate('/super-admin/activity-logs')}
                    >
                        <FaHistory />
                        Activity Logs
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
                            <FaHotel style={{ color: '#d41424' }} />
                            <span>BIREENA ATITHI</span>
                        </div>
                    </div>

                    <div className="sa-header-actions">
                        <div className="sa-profile">
                            {getInitials(user?.name)}
                        </div>
                    </div>
                </header>

                <div className="sa-content">
                    {/* Statistics Cards */}
                    {stats && (
                        <div className="sa-stats-grid">
                            <div className="sa-stat-card">
                                <div className="sa-stat-content">
                                    <div className="sa-stat-icon-wrapper">
                                        <FaHistory />
                                    </div>
                                    <div className="sa-stat-label">Total Actions</div>
                                    <div className="sa-stat-value">{stats.totalActions}</div>
                                    <div className="text-xs opacity-70">Last {filterPeriod}</div>
                                </div>
                            </div>
                            <div className="sa-stat-card">
                                <div className="sa-stat-content">
                                    <div className="sa-stat-icon-wrapper">
                                        <FaExclamationCircle />
                                    </div>
                                    <div className="sa-stat-label">Failed Actions</div>
                                    <div className="sa-stat-value">{stats.failedActions}</div>
                                    <div className="text-xs opacity-70">
                                        {stats.totalActions > 0 ? 
                                            `${((stats.failedActions / stats.totalActions) * 100).toFixed(1)}% failure rate` : 
                                            '0% failure rate'}
                                    </div>
                                </div>
                            </div>
                            <div className="sa-stat-card">
                                <div className="sa-stat-content">
                                    <div className="sa-stat-icon-wrapper">
                                        <FaUser />
                                    </div>
                                    <div className="sa-stat-label">Active Users</div>
                                    <div className="sa-stat-value">{stats.actionsByUser?.length || 0}</div>
                                    <div className="text-xs opacity-70">Performing actions</div>
                                </div>
                            </div>
                            <div className="sa-stat-card">
                                <div className="sa-stat-content">
                                    <div className="sa-stat-icon-wrapper">
                                        <FaExclamationTriangle />
                                    </div>
                                    <div className="sa-stat-label">Critical Actions</div>
                                    <div className="sa-stat-value">{stats.criticalActions?.length || 0}</div>
                                    <div className="text-xs opacity-70">Requires attention</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Bar */}
                    <div className="action-bar activity-action-bar">
                        <div className="search-bar">
                            <input
                                type="text"
                                placeholder="Search logs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                                className="search-input"
                            />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <select
                                value={filterPeriod}
                                onChange={(e) => setFilterPeriod(e.target.value)}
                                className="filter-select"
                            >
                                <option value="24h">Last 24 Hours</option>
                                <option value="7d">Last 7 Days</option>
                                <option value="30d">Last 30 Days</option>
                            </select>

                            <button
                                className="filter-toggle-btn"
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <FaFilter /> Filters
                            </button>
                            
                            <button
                                className="action-btn secondary"
                                onClick={handleExport}
                            >
                                <FaDownload /> Export CSV
                            </button>
                        </div>
                    </div>

                    {/* Filters Panel */}
                    {showFilters && (
                        <div className="filters-panel">
                            <div className="filters-grid">
                                <div>
                                    <label>Action Type</label>
                                    <select
                                        value={filterAction}
                                        onChange={(e) => setFilterAction(e.target.value)}
                                        className="filter-select"
                                    >
                                        <option value="">All Actions</option>
                                        <option value="hotel_created">Hotel Created</option>
                                        <option value="hotel_suspended">Hotel Suspended</option>
                                        <option value="hotel_activated">Hotel Activated</option>
                                        <option value="subscription_renewed">Subscription Renewed</option>
                                        <option value="profile_updated">Profile Updated</option>
                                        <option value="password_changed">Password Changed</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label>Target Type</label>
                                    <select
                                        value={filterTargetType}
                                        onChange={(e) => setFilterTargetType(e.target.value)}
                                        className="filter-select"
                                    >
                                        <option value="">All Types</option>
                                        <option value="hotel">Hotel</option>
                                        <option value="subscription">Subscription</option>
                                        <option value="admin">Admin</option>
                                        <option value="profile">Profile</option>
                                        <option value="system">System</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label>Status</label>
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="filter-select"
                                    >
                                        <option value="">All Status</option>
                                        <option value="success">Success</option>
                                        <option value="failed">Failed</option>
                                        <option value="pending">Pending</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <button onClick={clearFilters} className="action-btn secondary">
                                    Clear Filters
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Logs Table */}
                    <div className="sa-card">
                        <div className="table-responsive">
                            <table className="sa-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}></th>
                                        <th>Date & Time</th>
                                        <th>User</th>
                                        <th>Action</th>
                                        <th>Target</th>
                                        <th>Status</th>
                                        <th>IP Address</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.length > 0 ? (
                                        logs
                                            .filter(log => 
                                                !searchTerm || 
                                                log.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                log.targetName?.toLowerCase().includes(searchTerm.toLowerCase())
                                            )
                                            .map((log) => (
                                                <tr key={log._id}>
                                                    <td>
                                                        {getActionIcon(log.action)}
                                                    </td>
                                                    <td>
                                                        <div className="font-bold">{formatDate(log.createdAt)}</div>
                                                    </td>
                                                    <td>
                                                        <div>{log.userId?.name || 'Unknown'}</div>
                                                        <div className="text-xs opacity-70">{log.userEmail}</div>
                                                    </td>
                                                    <td>
                                                        <div className="font-bold">{getActionLabel(log.action)}</div>
                                                    </td>
                                                    <td>
                                                        <div>
                                                            <span className={`badge badge-${log.targetType === 'hotel' ? 'primary' : 'secondary'}`}>
                                                                {log.targetType}
                                                            </span>
                                                        </div>
                                                        {log.targetName && (
                                                            <div className="text-xs opacity-70">{log.targetName}</div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {getStatusBadge(log.status)}
                                                        {log.errorMessage && (
                                                            <div className="text-xs text-red">{log.errorMessage}</div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div className="text-xs">{log.ipAddress || '-'}</div>
                                                    </td>
                                                </tr>
                                            ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                                                <div style={{ opacity: 0.5 }}>
                                                    <FaHistory style={{ fontSize: '48px', marginBottom: '16px' }} />
                                                    <p>No activity logs found</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="pagination-btn"
                                >
                                    Previous
                                </button>
                                
                                <div className="pagination-info">
                                    Page {currentPage} of {totalPages}
                                </div>
                                
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="pagination-btn"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ActivityLogs;

