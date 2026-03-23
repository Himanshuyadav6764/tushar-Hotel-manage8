import { useState, useEffect } from 'react';
import './HousekeepingView.css';
import API_URL_CONFIG from '../config/api';

const HousekeepingView = () => {
    const API_URL = `${API_URL_CONFIG}/api/housekeeping`;
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [viewType, setViewType] = useState('list'); // 'list' or 'grid'
    const [pendingMarkedRooms, setPendingMarkedRooms] = useState({});
    const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768);

    // Fetch pending tasks on mount
    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/list`);
            const data = await response.json();
            if (data.success) {
                setTasks(data.data);
                // Keep only room keys that still exist in pending list.
                setPendingMarkedRooms((prev) => {
                    const next = {};
                    const currentRooms = new Set((data.data || []).map((t) => String(t.roomNumber)));
                    Object.keys(prev).forEach((roomNo) => {
                        if (currentRooms.has(roomNo) && prev[roomNo]) {
                            next[roomNo] = true;
                        }
                    });
                    return next;
                });
            }
        } catch (error) {
            console.error('Error fetching housekeeping tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    // Auto-hide toast after 3 seconds
    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => setShowToast(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    // Keep layout responsive when viewport changes.
    useEffect(() => {
        const handleResize = () => {
            setIsMobileView(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Filter tasks based on search query
    const filteredTasks = tasks.filter(task =>
        task.roomNumber.includes(searchQuery)
    );

    // Mark room as clean
    const handleMarkClean = async (taskId, roomNumber) => {
        try {
            const response = await fetch(`${API_URL}/mark-clean`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, roomNumber })
            });
            const data = await response.json();

            if (data.success) {
                setToastMessage(`Room ${roomNumber} is now Clean!`);
                setShowToast(true);
                // Remove from current pending list immediately for snappy UX.
                setTasks((prev) => prev.filter((t) => String(t._id) !== String(taskId)));
                setPendingMarkedRooms((prev) => {
                    const next = { ...prev };
                    delete next[String(roomNumber)];
                    return next;
                });
                // Background refresh for consistency.
                fetchTasks();

                // Play success sound if available
                if (window.soundManager) {
                    window.soundManager.play('success');
                }
            } else {
                alert(data.message || 'Error updating status');
            }
        } catch (error) {
            console.error('Error marking clean:', error);
            alert('Server error while updating status');
        }
    };

    // Mark room/task as pending for follow-up
    const handleMarkPending = async (taskId, roomNumber) => {
        try {
            const response = await fetch(`${API_URL}/mark-pending`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, roomNumber })
            });
            const data = await response.json();

            if (data.success) {
                setToastMessage(`Room ${roomNumber} moved to Pending`);
                setShowToast(true);
                setPendingMarkedRooms((prev) => ({
                    ...prev,
                    [String(roomNumber)]: true
                }));
                fetchTasks();
            } else {
                alert(data.message || 'Error updating pending status');
            }
        } catch (error) {
            console.error('Error marking pending:', error);
            alert('Server error while updating status');
        }
    };

    return (
        <div className="housekeeping-view-container">
            {/* Header */}
            <div className="housekeeping-header">
                <div className="header-title">
                    <h2>🧹 Housekeeping Dashboard</h2>
                    <p>Track and manage room cleaning tasks</p>
                </div>
            </div>

            {/* Controls */}
            <div className="housekeeping-controls">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Search by room number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value.replace(/\D/g, ''))}
                        className="search-input"
                    />
                    <span className="search-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="7"></circle>
                            <line x1="16.65" y1="16.65" x2="21" y2="21"></line>
                        </svg>
                    </span>
                </div>
                <div className="view-controls">
                    <div className="view-toggle">
                        <button
                            className={`view-btn ${viewType === 'grid' ? 'active' : ''}`}
                            onClick={() => setViewType('grid')}
                            title="Grid View"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="3" width="7" height="7" rx="1" />
                                <rect x="3" y="14" width="7" height="7" rx="1" />
                                <rect x="14" y="14" width="7" height="7" rx="1" />
                            </svg>
                        </button>
                        <button
                            className={`view-btn ${viewType === 'list' ? 'active' : ''}`}
                            onClick={() => setViewType('list')}
                            title="List View"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="8" y1="6" x2="21" y2="6" />
                                <line x1="8" y1="12" x2="21" y2="12" />
                                <line x1="8" y1="18" x2="21" y2="18" />
                                <line x1="3" y1="6" x2="3.01" y2="6" />
                                <line x1="3" y1="12" x2="3.01" y2="12" />
                                <line x1="3" y1="18" x2="3.01" y2="18" />
                            </svg>
                        </button>
                    </div>
                    <button className="btn-refresh" onClick={fetchTasks} disabled={loading}>
                        {loading ? '🔄 Loading...' : '🔄 Refresh List'}
                    </button>
                </div>
            </div>

            {/* Table / Grid View */}
            {viewType === 'list' && !isMobileView ? (
                <div className="housekeeping-table-container">
                    <table className="housekeeping-table">
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Room No</th>
                                <th>Status</th>
                                <th>Requested At</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="no-data">Loading tasks...</td>
                                </tr>
                            ) : filteredTasks.length > 0 ? (
                                filteredTasks.map((task, index) => (
                                    <tr key={task._id}>
                                        <td>{index + 1}</td>
                                        <td className="room-no">{task.roomNumber}</td>
                                        <td>
                                            <span className="status-pill dirty">Needs Cleaning</span>
                                        </td>
                                        <td>{new Date(task.createdAt).toLocaleString()}</td>
                                        <td>
                                            <div className="hk-action-buttons">
                                                <button
                                                    className={`action-btn pending-btn ${pendingMarkedRooms[String(task.roomNumber)] ? 'is-dimmed' : ''}`}
                                                    onClick={() => handleMarkPending(task._id, task.roomNumber)}
                                                    title="Mark as Pending"
                                                    disabled={!!pendingMarkedRooms[String(task.roomNumber)]}
                                                >
                                                    ⏳ Pending
                                                </button>
                                                <button
                                                    className="action-btn clean-btn"
                                                    onClick={() => handleMarkClean(task._id, task.roomNumber)}
                                                    title="Mark as Clean"
                                                >
                                                    ✨ Mark Clean
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="no-data">
                                        {searchQuery ? 'No matching rooms found' : 'All rooms are clean! ✨'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : viewType === 'list' && isMobileView ? (
                <div className="housekeeping-mobile-list">
                    {loading ? (
                        <div className="grid-loading">Loading tasks...</div>
                    ) : filteredTasks.length > 0 ? (
                        filteredTasks.map((task, index) => (
                            <div key={task._id} className="mobile-list-card">
                                <div className="mobile-list-card-top">
                                    <div className="mobile-list-room">Room {task.roomNumber}</div>
                                    <span className="card-status dirty">Needs Cleaning</span>
                                </div>
                                <div className="mobile-list-meta">
                                    <span>S.No: {index + 1}</span>
                                    <span>{new Date(task.createdAt).toLocaleString()}</span>
                                </div>
                                <div className="mobile-list-actions">
                                    <button
                                        className={`card-action-btn pending ${pendingMarkedRooms[String(task.roomNumber)] ? 'is-dimmed' : ''}`}
                                        onClick={() => handleMarkPending(task._id, task.roomNumber)}
                                        disabled={!!pendingMarkedRooms[String(task.roomNumber)]}
                                    >
                                        ⏳ Pending
                                    </button>
                                    <button
                                        className="card-action-btn"
                                        onClick={() => handleMarkClean(task._id, task.roomNumber)}
                                    >
                                        ✨ Mark Clean
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="grid-empty">
                            {searchQuery ? 'No matching rooms found' : 'All rooms are clean! ✨'}
                        </div>
                    )}
                </div>
            ) : (
                <div className="housekeeping-grid-container">
                    {loading ? (
                        <div className="grid-loading">Loading tasks...</div>
                    ) : filteredTasks.length > 0 ? (
                        filteredTasks.map((task, index) => (
                            <div key={task._id} className="grid-card">
                                <div className="card-header">
                                    <div className="room-badge">Room {task.roomNumber}</div>
                                    <span className="card-status dirty">Needs Cleaning</span>
                                </div>
                                <div className="card-body">
                                    <div className="card-info">
                                        <span className="info-label">S.No:</span>
                                        <span className="info-value">{index + 1}</span>
                                    </div>
                                    <div className="card-info">
                                        <span className="info-label">Requested:</span>
                                        <span className="info-value">{new Date(task.createdAt).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}</span>
                                    </div>
                                </div>
                                <div className="card-footer">
                                    <div className="card-actions-row">
                                        <button
                                            className={`card-action-btn pending ${pendingMarkedRooms[String(task.roomNumber)] ? 'is-dimmed' : ''}`}
                                            onClick={() => handleMarkPending(task._id, task.roomNumber)}
                                            disabled={!!pendingMarkedRooms[String(task.roomNumber)]}
                                        >
                                            ⏳ Pending
                                        </button>
                                        <button
                                            className="card-action-btn"
                                            onClick={() => handleMarkClean(task._id, task.roomNumber)}
                                        >
                                            ✨ Mark Clean
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="grid-empty">
                            {searchQuery ? 'No matching rooms found' : 'All rooms are clean! ✨'}
                        </div>
                    )}
                </div>
            )}

            {/* Success Toast */}
            {showToast && (
                <div className="toast-success">
                    <span>✔️</span> {toastMessage}
                </div>
            )}
        </div>
    );
};

export default HousekeepingView;
