import React, { useState, useEffect } from 'react';
import API_URL_CONFIG, { apiCall } from '../config/api';
import './OutletCurrentStatus.css';

const OutletCurrentStatus = () => {
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('Dine In');

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 15000); // Auto-refresh every 15s
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        try {
            const response = await apiCall(`/api/guest-meal/analytics/outlet-status`);
            const data = await response.json();
            if (data.success) {
                setStatusData(data.data);
            }
        } catch (error) {
            console.error('Error fetching outlet status:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !statusData) {
        return <div className="outlet-loading">Fetching live outlet status...</div>;
    }

    const tables = { total: 0, occupied: 0, available: 0, ...statusData?.tables };
    const rooms = { total: 0, occupied: 0, pendingOrders: 0, ...statusData?.rooms };
    const kitchen = { 
        pending: 0, preparing: 0, ready: 0, avgPrepTime: 0, 
        load: 'Low', staffLoad: 'Normal', delayRisk: 'Minimal', 
        ...statusData?.kitchen 
    };
    const roomKitchen = { 
        pending: 0, preparing: 0, ready: 0, avgPrepTime: 0, 
        load: 'Low', staffLoad: 'Normal', delayRisk: 'Minimal', 
        ...statusData?.roomKitchen 
    };
    const takeAway = { total: 0, pending: 0, ready: 0, completionRate: 0, ...statusData?.takeAway };
    const taKitchen = { 
        pending: 0, preparing: 0, ready: 0, avgPrepTime: 0, 
        load: 'Low', staffLoad: 'Normal', delayRisk: 'Minimal', 
        ...statusData?.taKitchen 
    };
    const online = { total: 0, pending: 0, ready: 0, completed: 0, completionRate: 0, ...statusData?.online };
    const onlineKitchen = {
        pending: 0, preparing: 0, ready: 0, avgPrepTime: 0,
        load: 'Low', staffLoad: 'Normal', delayRisk: 'Minimal',
        ...statusData?.onlineKitchen
    };

    return (
        <div className="outlet-status-container">
            <div className="outlet-header">
                <div className="title-section">
                    <h1>Live Outlet Dashboard</h1>
                    <p>Real-time monitoring of restaurant floor and kitchen load</p>
                </div>
                <div className="live-indicator">
                    <span className="dot"></span>
                    LIVE
                </div>
            </div>

            {/* Section Filters */}
            <div className="status-type-filters">
                {['All', 'Dine In', 'Room Order', 'Take Away', 'Online Order'].map(filter => (
                    <button
                        key={filter}
                        className={`status-filter-btn ${activeFilter === filter ? 'active' : ''}`}
                        onClick={() => setActiveFilter(filter)}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            {activeFilter === 'Dine In' || activeFilter === 'All' ? (
                <div className="outlet-grid">
                    {/* SECTION 1: FLOOR STATUS */}
                    <div className="dashboard-section">
                        <div className="section-header">
                            <span className="icon">🪑</span>
                            <h3>Floor / Table Status</h3>
                        </div>
                        <div className="stats-row">
                            <div className="status-card highlight-blue">
                                <div className="status-value">{tables.total}</div>
                                <div className="status-label">Total Tables</div>
                            </div>
                            <div className="status-card highlight-red">
                                <div className="status-value">{tables.occupied}</div>
                                <div className="status-label">Occupied</div>
                            </div>
                            <div className="status-card highlight-green">
                                <div className="status-value">{tables.available}</div>
                                <div className="status-label">Available</div>
                            </div>
                        </div>
                        <div className="occupancy-meter">
                            <div className="meter-label">
                                <span>Occupancy Rate</span>
                                <span>{Math.round((tables.occupied / (tables.total || 1)) * 100)}%</span>
                            </div>
                            <div className="meter-bg">
                                <div
                                    className="meter-fill"
                                    style={{ width: `${(tables.occupied / (tables.total || 1)) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: KITCHEN LOAD */}
                    <div className="dashboard-section">
                        <div className="section-header">
                            <span className="icon">👨‍🍳</span>
                            <h3>Kitchen Live Load</h3>
                        </div>
                        <div className="stats-row">
                            <div className="status-card highlight-orange">
                                <div className="status-value">{kitchen.pending}</div>
                                <div className="status-label">KOT Pending</div>
                            </div>
                            <div className="status-card highlight-yellow">
                                <div className="status-value">{kitchen.preparing}</div>
                                <div className="status-label">Preparing</div>
                            </div>
                            <div className="status-card highlight-green">
                                <div className="status-value">{kitchen.ready}</div>
                                <div className="status-label">Ready</div>
                            </div>
                        </div>
                        <div className="prep-time-metric">
                            <div className="metric-icon">⏱</div>
                            <div className="metric-details">
                                <span className="label">Avg. Prep Time</span>
                                <span className="value">{kitchen.avgPrepTime} mins</span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: OPERATIONAL HEALTH */}
                    <div className="dashboard-section full-width">
                        <div className="section-header">
                            <span className="icon">📈</span>
                            <h3>Operational Indicators</h3>
                        </div>
                        <div className="indicators-row">
                            <div className="indicator-col">
                                <div className="indicator-label">Kitchen Load</div>
                                <div className={`indicator-tag load-${(kitchen.load || 'Low').toLowerCase()}`}>
                                    {kitchen.load}
                                </div>
                            </div>
                            <div className="indicator-col">
                                <div className="indicator-label">Staff Load</div>
                                <div className={`indicator-tag staff-${(kitchen.staffLoad || 'Normal').toLowerCase()}`}>
                                    {kitchen.staffLoad}
                                </div>
                            </div>
                            <div className="indicator-col">
                                <div className="indicator-label">Delay Risk</div>
                                <div className={`indicator-tag risk-${(kitchen.delayRisk || 'Minimal').toLowerCase()}`}>
                                    {kitchen.delayRisk}
                                </div>
                            </div>
                        </div>
                        <div className="operational-tips">
                            <span className="tip-icon">💡</span>
                            <p>
                                {kitchen.delayRisk === 'High'
                                    ? "Critical: Suggest inform guests about possible delays."
                                    : kitchen.delayRisk === 'Moderate'
                                        ? "Notice: Kitchen is busy, monitor preparation timers."
                                        : "Healthy: Operations are running smoothly."}
                            </p>
                        </div>
                    </div>
                </div>
            ) : activeFilter === 'Room Order' ? (
                <div className="outlet-grid">
                    {/* SECTION 1: ROOM STATUS */}
                    <div className="dashboard-section">
                        <div className="section-header">
                            <span className="icon">🛏️</span>
                            <h3>Room Status</h3>
                        </div>
                        <div className="stats-row">
                            <div className="status-card highlight-blue">
                                <div className="status-value">{rooms.total}</div>
                                <div className="status-label">Total Rooms</div>
                            </div>
                            <div className="status-card highlight-orange">
                                <div className="status-value">{rooms.pendingOrders}</div>
                                <div className="status-label">Pending Orders</div>
                            </div>
                            <div className="status-card highlight-pink">
                                <div className="status-value">{rooms.occupied}</div>
                                <div className="status-label">Occupied</div>
                            </div>
                        </div>
                        <div className="occupancy-meter">
                            <div className="meter-label">
                                <span>Occupancy Rate</span>
                                <span>{Math.round((rooms.occupied / (rooms.total || 1)) * 100)}%</span>
                            </div>
                            <div className="meter-bg">
                                <div
                                    className="meter-fill"
                                    style={{ width: `${(rooms.occupied / (rooms.total || 1)) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: ROOM KITCHEN LOAD */}
                    <div className="dashboard-section">
                        <div className="section-header">
                            <span className="icon">🍱</span>
                            <h3>Kitchen Live Load</h3>
                        </div>
                        <div className="stats-row">
                            <div className="status-card highlight-orange">
                                <div className="status-value">{roomKitchen.pending}</div>
                                <div className="status-label">KOT Pending</div>
                            </div>
                            <div className="status-card highlight-yellow">
                                <div className="status-value">{roomKitchen.preparing}</div>
                                <div className="status-label">Preparing</div>
                            </div>
                            <div className="status-card highlight-green">
                                <div className="status-value">{roomKitchen.ready}</div>
                                <div className="status-label">Ready</div>
                            </div>
                        </div>
                        <div className="prep-time-metric highlight-pink">
                            <div className="metric-icon">⏱</div>
                            <div className="metric-details">
                                <span className="label">Avg. Prep Time</span>
                                <span className="value">{roomKitchen.avgPrepTime} mins</span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: OPERATIONAL HEALTH */}
                    <div className="dashboard-section full-width">
                        <div className="section-header">
                            <span className="icon">📊</span>
                            <h3>Operational Indicators</h3>
                        </div>
                        <div className="indicators-row">
                            <div className="indicator-col">
                                <div className="indicator-label">Kitchen Load</div>
                                <div className={`indicator-tag load-${(roomKitchen.load || 'Low').toLowerCase()}`}>
                                    {roomKitchen.load}
                                </div>
                            </div>
                            <div className="indicator-col">
                                <div className="indicator-label">Staff Load</div>
                                <div className={`indicator-tag staff-${(roomKitchen.staffLoad || 'Normal').toLowerCase()}`}>
                                    {roomKitchen.staffLoad}
                                </div>
                            </div>
                            <div className="indicator-col">
                                <div className="indicator-label">Delay Risk</div>
                                <div className={`indicator-tag risk-${(roomKitchen.delayRisk || 'Minimal').toLowerCase()}`}>
                                    {roomKitchen.delayRisk}
                                </div>
                            </div>
                        </div>
                        <div className="operational-tips">
                            <span className="tip-icon">💡</span>
                            <p>
                                {roomKitchen.delayRisk === 'High'
                                    ? "Critical: Room service demand is high. Inform guests of longer wait times."
                                    : "Healthy: Room service operations are running smoothly."}
                            </p>
                        </div>
                    </div>
                </div>
            ) : activeFilter === 'Take Away' ? (
                <div className="outlet-grid">
                    {/* SECTION 1: TAKE-AWAY QUEUE */}
                    <div className="dashboard-section">
                        <div className="section-header">
                            <span className="icon">🛍️</span>
                            <h3>Order Queue</h3>
                        </div>
                        <div className="stats-row">
                            <div className="status-card highlight-blue">
                                <div className="status-value">{takeAway.total}</div>
                                <div className="status-label">Total Orders</div>
                            </div>
                            <div className="status-card highlight-orange">
                                <div className="status-value">{takeAway.pending}</div>
                                <div className="status-label">Pending / In-progress</div>
                            </div>
                            <div className="status-card highlight-green">
                                <div className="status-value">{takeAway.ready}</div>
                                <div className="status-label">Ready for Pickup</div>
                            </div>
                        </div>
                        <div className="occupancy-meter">
                            <div className="meter-label">
                                <span>Order Completion Rate</span>
                                <span>{takeAway.completionRate}%</span>
                            </div>
                            <div className="meter-bg">
                                <div
                                    className="meter-fill"
                                    style={{ width: `${takeAway.completionRate}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: KITCHEN LIVE LOAD (TAKE-AWAY) */}
                    <div className="dashboard-section">
                        <div className="section-header">
                            <span className="icon">👨‍🍳</span>
                            <h3>Kitchen Live Load</h3>
                        </div>
                        <div className="stats-row">
                            <div className="status-card highlight-orange">
                                <div className="status-value">{taKitchen.pending}</div>
                                <div className="status-label">KOT Pending</div>
                            </div>
                            <div className="status-card highlight-yellow">
                                <div className="status-value">{taKitchen.preparing}</div>
                                <div className="status-label">Preparing</div>
                            </div>
                            <div className="status-card highlight-green">
                                <div className="status-value">{taKitchen.ready}</div>
                                <div className="status-label">Ready</div>
                            </div>
                        </div>
                        <div className="prep-time-metric">
                            <div className="metric-icon">⏱</div>
                            <div className="metric-details">
                                <span className="label">Avg. Prep Time</span>
                                <span className="value">{taKitchen.avgPrepTime} mins</span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: OPERATIONAL INDICATORS */}
                    <div className="dashboard-section full-width">
                        <div className="section-header">
                            <span className="icon">📊</span>
                            <h3>Operational Indicators</h3>
                        </div>
                        <div className="indicators-row">
                            <div className="indicator-col">
                                <div className="indicator-label">Kitchen Load</div>
                                <div className={`indicator-tag load-${(taKitchen.load || 'Low').toLowerCase()}`}>
                                    {taKitchen.load}
                                </div>
                            </div>
                            <div className="indicator-col">
                                <div className="indicator-label">Staff Load</div>
                                <div className={`indicator-tag staff-${(taKitchen.staffLoad || 'Normal').toLowerCase()}`}>
                                    {taKitchen.staffLoad}
                                </div>
                            </div>
                            <div className="indicator-col">
                                <div className="indicator-label">Delay Risk</div>
                                <div className={`indicator-tag risk-${(taKitchen.delayRisk || 'Minimal').toLowerCase()}`}>
                                    {taKitchen.delayRisk}
                                </div>
                            </div>
                        </div>
                        <div className="operational-tips">
                            <span className="tip-icon">💡</span>
                            <p>
                                {taKitchen.delayRisk === 'High'
                                    ? "Critical: Take-away volume is high. Monitor pickup timers closely."
                                    : "Healthy: Operations are running smoothly."}
                            </p>
                        </div>
                    </div>
                </div>
            ) : activeFilter === 'Online Order' ? (
                <div className="outlet-grid">
                    <div className="dashboard-section">
                        <div className="section-header">
                            <span className="icon">🌐</span>
                            <h3>Online Order Queue</h3>
                        </div>
                        <div className="stats-row">
                            <div className="status-card highlight-blue">
                                <div className="status-value">{online.total}</div>
                                <div className="status-label">Total Orders</div>
                            </div>
                            <div className="status-card highlight-orange">
                                <div className="status-value">{online.pending}</div>
                                <div className="status-label">Pending</div>
                            </div>
                            <div className="status-card highlight-green">
                                <div className="status-value">{online.completed}</div>
                                <div className="status-label">Completed</div>
                            </div>
                        </div>
                        <div className="occupancy-meter">
                            <div className="meter-label">
                                <span>Completion Rate</span>
                                <span>{online.completionRate}%</span>
                            </div>
                            <div className="meter-bg">
                                <div className="meter-fill" style={{ width: `${online.completionRate}%` }}></div>
                            </div>
                        </div>
                    </div>
                    <div className="dashboard-section">
                        <div className="section-header">
                            <span className="icon">👨‍🍳</span>
                            <h3>Kitchen Live Load</h3>
                        </div>
                        <div className="stats-row">
                            <div className="status-card highlight-orange">
                                <div className="status-value">{onlineKitchen.pending}</div>
                                <div className="status-label">KOT Pending</div>
                            </div>
                            <div className="status-card highlight-yellow">
                                <div className="status-value">{onlineKitchen.preparing}</div>
                                <div className="status-label">Preparing</div>
                            </div>
                            <div className="status-card highlight-green">
                                <div className="status-value">{onlineKitchen.ready}</div>
                                <div className="status-label">Ready</div>
                            </div>
                        </div>
                        <div className="prep-time-metric">
                            <div className="metric-icon">⏱</div>
                            <div className="metric-details">
                                <span className="label">Avg. Prep Time</span>
                                <span className="value">{onlineKitchen.avgPrepTime} mins</span>
                            </div>
                        </div>
                    </div>
                    <div className="dashboard-section full-width">
                        <div className="section-header">
                            <span className="icon">📊</span>
                            <h3>Operational Indicators</h3>
                        </div>
                        <div className="indicators-row">
                            <div className="indicator-col">
                                <div className="indicator-label">Kitchen Load</div>
                                <div className={`indicator-tag load-${(onlineKitchen.load || 'Low').toLowerCase()}`}>{onlineKitchen.load}</div>
                            </div>
                            <div className="indicator-col">
                                <div className="indicator-label">Staff Load</div>
                                <div className={`indicator-tag staff-${(onlineKitchen.staffLoad || 'Normal').toLowerCase()}`}>{onlineKitchen.staffLoad}</div>
                            </div>
                            <div className="indicator-col">
                                <div className="indicator-label">Delay Risk</div>
                                <div className={`indicator-tag risk-${(onlineKitchen.delayRisk || 'Minimal').toLowerCase()}`}>{onlineKitchen.delayRisk}</div>
                            </div>
                        </div>
                        <div className="operational-tips">
                            <span className="tip-icon">💡</span>
                            <p>
                                {onlineKitchen.delayRisk === 'High'
                                    ? "Critical: Online queue is high. Keep dispatch and kitchen sync active."
                                    : onlineKitchen.delayRisk === 'Moderate'
                                        ? "Notice: Online demand is moderate. Monitor prep timers closely."
                                        : "Healthy: Online order operations are running smoothly."}
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="no-data-placeholder">
                    <div className="placeholder-icon">📊</div>
                    <h3>{activeFilter} Analytics</h3>
                    <p>Live stats for {activeFilter} are currently being processed.</p>
                </div>
            )}
        </div>
    );
};

export default OutletCurrentStatus;
