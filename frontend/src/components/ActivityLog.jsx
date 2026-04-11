import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getLogsByRole, exportLogs, initializeLogsIfEmpty } from '../utils/activityLogger';
import { motion, AnimatePresence } from 'framer-motion';
import './ActivityLog.css';

const ActivityLog = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [filters, setFilters] = useState({
        action: 'all',
        dateRange: 'all'
    });
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Initialize logs if empty
        initializeLogsIfEmpty();

        // Load logs based on user role
        const userLogs = getLogsByRole(user.role, user.id);
        setLogs(userLogs);
        setFilteredLogs(userLogs);
    }, [user.role, user.id]);

    useEffect(() => {
        // Apply filters
        let filtered = [...logs];

        // Filter by action type
        if (filters.action !== 'all') {
            filtered = filtered.filter(log => log.action === filters.action);
        }

        // Filter by date range
        if (filters.dateRange !== 'all') {
            const now = new Date();
            const rangeDate = new Date();

            switch (filters.dateRange) {
                case 'today':
                    rangeDate.setHours(0, 0, 0, 0);
                    break;
                case 'week':
                    rangeDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    rangeDate.setMonth(now.getMonth() - 1);
                    break;
                default:
                    break;
            }

            filtered = filtered.filter(log => new Date(log.timestamp) >= rangeDate);
        }

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(log =>
                log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.userName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredLogs(filtered);
    }, [filters, searchTerm, logs]);

    const handleExport = () => {
        // Headers for CSV
        const headers = ['Timestamp', 'User Name', 'Role', 'Action', 'Module', 'Description'];
        
        // Map logs to CSV rows
        const rows = filteredLogs.map(log => {
            const date = new Date(log.timestamp).toLocaleString();
            const desc = log.description ? `"${log.description.replace(/"/g, '""')}"` : '';
            return [
                date,
                log.userName,
                log.userRole,
                log.action,
                log.module,
                desc
            ];
        });

        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.join(',') + '\n';
        });

        // Download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Get unique action types from logs
    const actionTypes = ['all', ...new Set(logs.map(log => log.action))];

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getActionIcon = (action) => {
        if (action.includes('Login')) return '🔐';
        if (action.includes('Created')) return '✨';
        if (action.includes('Updated')) return '✏️';
        if (action.includes('Deleted') || action.includes('Removed')) return '🗑️';
        if (action.includes('Invoice') || action.includes('Payment')) return '💰';
        if (action.includes('KOT')) return '🍽️';
        if (action.includes('Password')) return '🔑';
        if (action.includes('Permission')) return '⚙️';
        return '📝';
    };

    const getActionColor = (action) => {
        if (action.includes('Login')) return '#10b981';
        if (action.includes('Created')) return '#3b82f6';
        if (action.includes('Updated')) return '#f59e0b';
        if (action.includes('Deleted') || action.includes('Removed')) return '#d41424';
        if (action.includes('Invoice') || action.includes('Payment')) return '#8b5cf6';
        if (action.includes('KOT')) return '#ec4899';
        if (action.includes('Password')) return '#f97316';
        return '#6b7280';
    };

    return (
        <div className="activity-log-container">
            <div className="activity-log-header">
                <div className="header-left">
                    <h2>📊 Activity Logs</h2>
                    <p className="header-subtitle">
                        {user.role === 'Super Admin' || user.role === 'Admin'
                            ? 'Viewing all system activities'
                            : 'Viewing your activities'}
                    </p>
                </div>
                <motion.button
                    className="export-btn"
                    onClick={handleExport}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    📥 Export Logs
                </motion.button>
            </div>

            <div className="activity-log-filters">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Search activities..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                    />
                </div>

                <select
                    value={filters.action}
                    onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                >
                    {actionTypes.map(action => (
                        <option key={action} value={action}>
                            {action === 'all' ? 'All Actions' : action}
                        </option>
                    ))}
                </select>

                <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last Month</option>
                </select>
            </div>

            <div className="activity-log-stats">
                <div className="stat-card">
                    <span className="stat-value">{filteredLogs.length}</span>
                    <span className="stat-label">Total Activities</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">
                        {new Set(filteredLogs.map(l => l.action)).size}
                    </span>
                    <span className="stat-label">Action Types</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">
                        {new Set(filteredLogs.map(l => l.module)).size}
                    </span>
                    <span className="stat-label">Modules</span>
                </div>
            </div>

            <div className="activity-log-list">
                <AnimatePresence>
                    {filteredLogs.length === 0 ? (
                        <motion.div
                            className="no-logs"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <span className="no-logs-icon">📭</span>
                            <p>No activity logs found</p>
                            <small>Try adjusting your filters</small>
                        </motion.div>
                    ) : (
                        filteredLogs.map((log, index) => (
                            <motion.div
                                key={log.id}
                                className="log-item"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <div className="log-icon" style={{ background: `${getActionColor(log.action)}20` }}>
                                    <span style={{ fontSize: '24px' }}>{getActionIcon(log.action)}</span>
                                </div>
                                <div className="log-content">
                                    <div className="log-header">
                                        <span className="log-action" style={{ color: getActionColor(log.action) }}>
                                            {log.action}
                                        </span>
                                        <span className="log-time">{formatTimestamp(log.timestamp)}</span>
                                    </div>
                                    <p className="log-description">{log.description}</p>
                                    <div className="log-meta">
                                        <span className="log-user">👤 {log.userName}</span>
                                        <span className="log-role">🏷️ {log.userRole}</span>
                                        <span className="log-module">📂 {log.module}</span>
                                    </div>
                                    {log.details && (
                                        <details className="log-details">
                                            <summary>View Details</summary>
                                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                        </details>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ActivityLog;

