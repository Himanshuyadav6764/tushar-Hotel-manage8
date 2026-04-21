import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_URL, { apiCall } from '../../config/api';
import {
    FaBars,
    FaHotel,
    FaPlus,
    FaHistory,
    FaExclamationTriangle,
    FaSearch,
    FaPause,
    FaPlay,
    FaTrashAlt
} from 'react-icons/fa';
import { MdDashboard, MdLogout } from 'react-icons/md';
import './SuperAdminDashboard.css';

const ActivityMonitoring = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [error, setError] = useState('');

    const [activityLogs, setActivityLogs] = useState([]);
    const [activityPagination, setActivityPagination] = useState({ total: 0, page: 1, pages: 1, limit: 25 });
    const [suspiciousSummary, setSuspiciousSummary] = useState({
        totalSuspicious: 0,
        reasonsBreakdown: [],
        categoryBreakdown: [],
        topSourceIps: [],
        authOrBookingSuspicious: [],
        logs: []
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [suspiciousOnly, setSuspiciousOnly] = useState(false);
    const [periodFilter, setPeriodFilter] = useState('24h');

    const getAuthConfig = () => ({
        headers: {
            Authorization: `Bearer ${user?.token}`
        }
    });

    const fetchActivityLogs = async () => {
        try {
            const endpoint = `/api/super-admin/activity-logs?limit=25&page=1${categoryFilter !== 'all' ? `&category=${categoryFilter}` : ''}${suspiciousOnly ? `&suspicious=true` : ''}`;
            const response = await apiCall(endpoint);
            const data = await response.json();
            setActivityLogs(data?.logs || []);
            setActivityPagination(data?.pagination || { total: 0, page: 1, pages: 1, limit: 25 });
        } catch (error) {
            console.error('Failed to fetch activity logs:', error);
        }
    };

    const fetchSuspiciousSummary = async () => {
        try {
            const response = await apiCall(`/api/super-admin/suspicious-activities?period=${periodFilter}&limit=25`);
            const data = await response.json();
            setSuspiciousSummary(data || {
                totalSuspicious: 0,
                reasonsBreakdown: [],
                categoryBreakdown: [],
                topSourceIps: [],
                authOrBookingSuspicious: [],
                logs: []
            });
        } catch (error) {
            console.error('Failed to fetch suspicious summary:', error);
        }
    };

    const fetchMonitoringStatus = async () => {
        try {
            const resp = await apiCall('/api/super-admin/monitoring-status');
            const data = await resp.json();
            if (data.success) {
                console.log('Current system pause status:', data.isPaused);
                setIsPaused(data.isPaused);
            }
        } catch (err) {
            console.error('Failed to fetch system status:', err);
        }
    };

    const fetchAll = async () => {
        try {
            setLoading(true);
            setError('');
            await Promise.all([fetchActivityLogs(), fetchSuspiciousSummary(), fetchMonitoringStatus()]);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch monitoring data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user?.token) return;
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.token, categoryFilter, suspiciousOnly, periodFilter]);

    const filteredLogs = useMemo(() => {
        if (!searchTerm.trim()) return activityLogs;
        const q = searchTerm.toLowerCase();
        return activityLogs.filter((log) => {
            const row = [
                log.action,
                log.category,
                log.method,
                log.path,
                log.userEmail,
                log.userRole,
                ...(log.suspiciousReasons || [])
            ].join(' ').toLowerCase();

            return row.includes(q);
        });
    }, [activityLogs, searchTerm]);

    const getInitials = (name) => {
        if (!name) return 'SA';
        return String(name)
            .split(' ')
            .map((part) => part[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const formatDateTime = (value) => {
        if (!value) return '-';
        return new Date(value).toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSuspiciousDetection = async () => {
        console.log('Toggling monitoring. Current isPaused:', isPaused);
        try {
            setActionLoading(true);
            const resp = await apiCall('/api/super-admin/monitoring-toggle', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pause: !isPaused })
            });
            const data = await resp.json();
            if (data.success) {
                console.log('Toggle success:', data.isPaused);
                setIsPaused(data.isPaused);
            } else {
                setError(data.message || 'Failed to toggle monitoring');
            }
        } catch (err) {
            console.error('Toggle error:', err);
            setError('Failed to switch monitoring state');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteAllLogs = async () => {
        console.log('Initiating wipe of all logs...');
        try {
            setActionLoading(true);
            setError('');
            const response = await apiCall('/api/super-admin/activity-logs/clear-all', {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.success) {
                console.log('Wipe complete. Rows deleted:', data.deletedCount);
                await fetchAll();
                setShowDeleteConfirm(false);
            } else {
                setError(data.message || 'Server rejected the delete request');
            }
        } catch (err) {
            console.error('Delete all error:', err);
            setError('Failed to delete logs: Network error or server unreachable');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return <div className="sa-loading">Loading activity monitoring...</div>;
    }

    return (
        <div className="sa-container">
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
                    <button className="sa-nav-item" onClick={() => navigate('/super-admin/dashboard')}>
                        <MdDashboard />
                        Dashboard
                    </button>
                    <button className="sa-nav-item" onClick={() => navigate('/super-admin/hotels')}>
                        <FaHotel />
                        Hotels
                    </button>
                    <button className="sa-nav-item" onClick={() => navigate('/super-admin/hotels/create')}>
                        <FaPlus />
                        Create Hotel
                    </button>
                    <button className="sa-nav-item active" onClick={() => navigate('/super-admin/activity-monitoring')}>
                        <FaHistory />
                        Activity Monitoring
                    </button>
                    <button className="sa-nav-item" onClick={handleLogout}>
                        <MdLogout />
                        Logout
                    </button>
                </nav>
            </aside>

            {sidebarOpen && (
                <div className="sa-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
            )}

            <main className="sa-main">
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
                        <div className="sa-profile">{getInitials(user?.name)}</div>
                    </div>
                </header>

                <div className="sa-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                        <h3 className="sa-section-title" style={{ marginBottom: 0 }}>Activity Monitoring</h3>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                           <button 
                                className={`sa-btn-${isPaused ? 'success' : 'warning'}`} 
                                style={{ 
                                    padding: '8px 16px', 
                                    background: isPaused ? '#059669' : '#eab308', 
                                    color: '#fff', 
                                    border: 'none', 
                                    borderRadius: '6px', 
                                    cursor: 'pointer', 
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    opacity: actionLoading ? 0.7 : 1
                                }}
                                onClick={toggleSuspiciousDetection}
                                disabled={actionLoading}
                            >
                                {isPaused ? <FaPlay /> : <FaPause />}
                                {isPaused ? 'Resume Detection' : 'Pause Detection'}
                            </button>

                            <button 
                                className="sa-btn-danger" 
                                style={{ 
                                    padding: '8px 16px', 
                                    background: '#d41424', 
                                    color: '#fff', 
                                    border: 'none', 
                                    borderRadius: '6px', 
                                    cursor: 'pointer', 
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    opacity: actionLoading ? 0.7 : 1
                                }}
                                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                                disabled={actionLoading}
                            >
                                <FaTrashAlt />
                                Delete All Logs
                            </button>
                        </div>
                    </div>

                    {showDeleteConfirm && (
                        <div style={{
                            padding: '16px',
                            background: '#fff5f5',
                            border: '1px solid #fecaca',
                            borderRadius: '12px',
                            marginBottom: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                             <div style={{ fontWeight: 700, color: '#b40f1d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FaExclamationTriangle />
                                DANGER ZONE: CONFIRM LOG DELETION
                             </div>
                             <p style={{ margin: 0, fontSize: '0.9rem', color: '#7f1d1d' }}>
                                This action will permanently remove all activity records and suspicious logs from the system. This cannot be undone. 
                                Are you sure you want to proceed?
                             </p>
                             <div style={{ display: 'flex', gap: '10px' }}>
                                <button 
                                    onClick={handleDeleteAllLogs}
                                    style={{ background: '#d41424', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? 'Deleting...' : 'YES, DELETE EVERYTHING'}
                                </button>
                                <button 
                                    onClick={() => setShowDeleteConfirm(false)}
                                    style={{ background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    CANCEL
                                </button>
                             </div>
                        </div>
                    )}

                    {isPaused && (
                         <div style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid #fef08a',
                            background: '#fefce8',
                            color: '#854d0e',
                            marginBottom: '16px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <FaPause />
                            Suspicious Activity Detection is currently PAUSED. New requests will be logged but not analyzed for threats.
                        </div>
                    )}

                    {error && (
                        <div style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid #fecaca',
                            background: '#fee2e2',
                            color: '#b40f1d',
                            marginBottom: '16px'
                        }}>
                            {error}
                        </div>
                    )}

                    <div className="sa-stats-grid" style={{ marginBottom: '20px' }}>
                        <div className="sa-stat-card">
                            <div className="sa-stat-content">
                                <div className="sa-stat-label">Total Activity Logs</div>
                                <div className="sa-stat-value">{activityPagination.total || 0}</div>
                            </div>
                        </div>
                        <div className="sa-stat-card">
                            <div className="sa-stat-content">
                                <div className="sa-stat-label">Suspicious (Selected Period)</div>
                                <div className="sa-stat-value">{suspiciousSummary.totalSuspicious || 0}</div>
                            </div>
                        </div>
                        <div className="sa-stat-card">
                            <div className="sa-stat-content">
                                <div className="sa-stat-label">Top Threat Type</div>
                                <div className="sa-stat-value" style={{ fontSize: '1.1rem' }}>
                                    {suspiciousSummary.reasonsBreakdown?.[0]?._id || 'None'}
                                </div>
                            </div>
                        </div>
                        <div className="sa-stat-card">
                            <div className="sa-stat-content">
                                <div className="sa-stat-label">Top Source IP</div>
                                <div className="sa-stat-value" style={{ fontSize: '1.1rem' }}>
                                    {suspiciousSummary.topSourceIps?.[0]?._id || '-'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="sa-card" style={{ marginBottom: '20px', padding: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                            <div style={{ position: 'relative' }}>
                                <FaSearch style={{ position: 'absolute', left: '10px', top: '12px', color: '#64748b' }} />
                                <input
                                    type="text"
                                    placeholder="Search action/path/user..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ width: '100%', padding: '10px 10px 10px 34px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                                />
                            </div>
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                            >
                                <option value="all">All Categories</option>
                                <option value="auth">Auth</option>
                                <option value="booking">Booking</option>
                                <option value="reservation">Reservation</option>
                                <option value="billing">Billing</option>
                                <option value="admin">Admin</option>
                                <option value="system">System</option>
                            </select>
                            <select
                                value={periodFilter}
                                onChange={(e) => setPeriodFilter(e.target.value)}
                                style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                            >
                                <option value="1h">Last 1 hour</option>
                                <option value="24h">Last 24 hours</option>
                                <option value="7d">Last 7 days</option>
                                <option value="30d">Last 30 days</option>
                            </select>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#334155' }}>
                                <input
                                    type="checkbox"
                                    checked={suspiciousOnly}
                                    onChange={(e) => setSuspiciousOnly(e.target.checked)}
                                />
                                Suspicious only
                            </label>
                        </div>
                    </div>

                    <div className="sa-card" style={{ marginBottom: '20px' }}>
                        <div className="sa-card-header">
                            <div className="sa-card-title">Recent Activity Logs</div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="sa-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Time</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>User</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Category</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Action</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Request</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Suspicious</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                                                No activity logs found
                                            </td>
                                        </tr>
                                    ) : filteredLogs.map((log) => (
                                        <tr key={log._id} style={{ borderTop: '1px solid #eef2f7' }}>
                                            <td style={{ padding: '10px' }}>{formatDateTime(log.createdAt)}</td>
                                            <td style={{ padding: '10px' }}>{log.userEmail || 'anonymous'}</td>
                                            <td style={{ padding: '10px', textTransform: 'capitalize' }}>{log.category || '-'}</td>
                                            <td style={{ padding: '10px' }}>{log.action || '-'}</td>
                                            <td style={{ padding: '10px' }}>{log.method} {log.path}</td>
                                            <td style={{ padding: '10px' }}>{log.statusCode}</td>
                                            <td style={{ padding: '10px' }}>
                                                {log.suspicious ? (
                                                    <span style={{ color: '#b40f1d', fontWeight: 700 }}>
                                                        <FaExclamationTriangle style={{ marginRight: '6px' }} />
                                                        {log.suspiciousReasons?.join(', ') || 'yes'}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#059669', fontWeight: 700 }}>No</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="sa-card">
                        <div className="sa-card-header">
                            <div className="sa-card-title">Suspicious Reason Breakdown</div>
                        </div>
                        <div style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                            {(suspiciousSummary.reasonsBreakdown || []).length === 0 ? (
                                <div style={{ color: '#64748b' }}>No suspicious patterns detected for selected period.</div>
                            ) : (suspiciousSummary.reasonsBreakdown || []).map((item) => (
                                <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #fee2e2', borderRadius: '8px', padding: '10px 12px', background: '#fff7f7' }}>
                                    <span style={{ color: '#7f1d1d', fontWeight: 600 }}>{item._id}</span>
                                    <span style={{ color: '#b40f1d', fontWeight: 700 }}>{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="sa-stats-grid" style={{ marginTop: '20px' }}>
                        <div className="sa-card" style={{ padding: '0' }}>
                            <div className="sa-card-header">
                                <div className="sa-card-title">Suspicious by Category</div>
                            </div>
                            <div style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                                {(suspiciousSummary.categoryBreakdown || []).length === 0 ? (
                                    <div style={{ color: '#64748b' }}>No suspicious category data.</div>
                                ) : (suspiciousSummary.categoryBreakdown || []).map((item) => (
                                    <div key={item._id || 'unknown'} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                                        <span style={{ color: '#1e293b', fontWeight: 600, textTransform: 'capitalize' }}>{item._id || 'unknown'}</span>
                                        <span style={{ color: '#0f172a', fontWeight: 700 }}>{item.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="sa-card" style={{ padding: '0' }}>
                            <div className="sa-card-header">
                                <div className="sa-card-title">Auth/Booking Risk Split</div>
                            </div>
                            <div style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                                {(suspiciousSummary.authOrBookingSuspicious || []).length === 0 ? (
                                    <div style={{ color: '#64748b' }}>No auth/booking suspicious patterns.</div>
                                ) : (suspiciousSummary.authOrBookingSuspicious || []).map((item) => (
                                    <div key={item._id || 'unknown'} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                                        <span style={{ color: '#1e293b', fontWeight: 600, textTransform: 'capitalize' }}>{item._id || 'unknown'}</span>
                                        <span style={{ color: '#0f172a', fontWeight: 700 }}>{item.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="sa-card" style={{ marginTop: '20px' }}>
                        <div className="sa-card-header">
                            <div className="sa-card-title">Top Suspicious Source IPs</div>
                        </div>
                        <div style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                            {(suspiciousSummary.topSourceIps || []).length === 0 ? (
                                <div style={{ color: '#64748b' }}>No suspicious source IPs in selected period.</div>
                            ) : (suspiciousSummary.topSourceIps || []).map((item) => (
                                <div key={item._id || 'unknown-ip'} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #fee2e2', borderRadius: '8px', padding: '10px 12px', background: '#fffafa' }}>
                                    <span style={{ color: '#7f1d1d', fontWeight: 600 }}>{item._id || 'unknown'}</span>
                                    <span style={{ color: '#b40f1d', fontWeight: 700 }}>{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ActivityMonitoring;
