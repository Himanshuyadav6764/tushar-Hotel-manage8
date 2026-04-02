import React, { useState, useEffect, useRef } from 'react';
import './TableManagement.css';
import ReservationModal from '../../components/ReservationModal';
import ReservationListModal from '../../components/ReservationListModal';
import { useSettings } from '../../context/SettingsContext';
import API_URL_CONFIG, { apiCall } from '../../config/api';

const TableManagement = () => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    // Tables Data
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [availableTypes, setAvailableTypes] = useState([]);

    // Filter States
    const [statusFilter, setStatusFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All Types');
    const [searchQuery, setSearchQuery] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Add Table Modal State
    const [showAddTableModal, setShowAddTableModal] = useState(false);
    const [newTableData, setNewTableData] = useState({
        tableName: '',
        capacity: 4,
        type: 'General'
    });
    const [newTableType, setNewTableType] = useState('');
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const typeDropdownRef = useRef(null);

    // Close type dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
                setShowTypeDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Open Add Table Modal
    const openAddTableModal = () => {
        // Reset form to defaults
        setNewTableData({ tableName: '', capacity: 4, type: 'General' });
        setNewTableType('');
        setShowAddTableModal(true);
    };

    // Close Add Table Modal
    const closeAddTableModal = () => {
        setShowAddTableModal(false);
        setNewTableData({ tableName: '', capacity: 4, type: 'General' });
        setNewTableType('');
    };

    // Split Modal State
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [splitTableId, setSplitTableId] = useState(null);
    const [splitParts, setSplitParts] = useState(2);
    const [splitSubTables, setSplitSubTables] = useState([]);
    const [isSplitSubmitting, setIsSplitSubmitting] = useState(false);
    const [closeSplitConfirmTable, setCloseSplitConfirmTable] = useState(null);

    // Reservation Modal State
    const [showReservationModal, setShowReservationModal] = useState(false);
    const [selectedTableForReservation, setSelectedTableForReservation] = useState(null);

    // Reservation List Modal State
    const [showReservationListModal, setShowReservationListModal] = useState(false);
    const [selectedTableForList, setSelectedTableForList] = useState(null);

    // Waiters List
    const waiters = ['Rahul', 'Aman', 'Suresh', 'Priya', 'Kavita'];

    // Fetch Tables
    const fetchTables = async () => {
        try {
            // setLoading(true); // Don't show loading on every refresh to avoid flicker
            const response = await apiCall(`/api/tables/list`);
            const data = await response.json();
            if (data.success) {
                console.log('📊 Fetched tables:', data.data.length, 'tables');
                console.log('📋 Table types found:', [...new Set(data.data.map(t => t.type || 'General'))]);
                setTables(data.data);
            }
        } catch (error) {
            console.error('Error fetching tables:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchTables();
        const interval = setInterval(fetchTables, 10000); // 10s auto refresh
        return () => clearInterval(interval);
    }, []);

    // Update available types whenever tables change
    useEffect(() => {
        const types = [...new Set(tables.map(t => t.type || 'General'))].sort();
        console.log('🔄 Tables updated! Total tables:', tables.length);
        console.log('🏷️ Extracted types:', types);
        setAvailableTypes(types);
    }, [tables]);

    // Get unique table types with counts
    const getTableTypes = () => {
        const types = [...new Set(tables.map(t => t.type || 'General'))];
        return types.sort();
    };

    // Get count of tables for each type
    const getTypeCount = (type) => {
        return tables.filter(t => (t.type || 'General') === type).length;
    };

    // Filter tables based on selected filters
    const getFilteredTables = () => {
        return tables.filter(table => {
            // Status filter
            if (statusFilter !== 'All' && table.status !== statusFilter) return false;

            // Type filter
            if (typeFilter !== 'All Types' && table.type !== typeFilter) return false;

            // Search query
            if (searchQuery && !table.tableName.toLowerCase().includes(searchQuery.toLowerCase())) return false;

            return true;
        });
    };

    // Group filtered tables by type
    const getGroupedTables = () => {
        const filtered = getFilteredTables();
        const grouped = {};

        filtered.forEach(table => {
            const type = table.type || 'General';
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(table);
        });

        // Sort tables within each group by table number
        Object.keys(grouped).forEach(type => {
            grouped[type].sort((a, b) => {
                const numA = parseInt(a.tableName.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.tableName.replace(/\D/g, '')) || 0;
                return numA - numB;
            });
        });

        return grouped;
    };

    // Get icon for table type
    const getTypeIcon = (type) => {
        const icons = {
            'General': '🍽️',
            'AC': '❄️',
            'Non-AC': '🌡️',
            'Garden': '🌳',
            'VIP': '⭐',
            'Outdoor': '☀️',
            'Private': '🔒'
        };
        return icons[type] || '🍽️';
    };

    // Calculate stats
    const getStats = () => {
        const filtered = getFilteredTables();
        return {
            available: filtered.filter(t => t.status === 'Available').length,
            occupied: filtered.filter(t => t.status === 'Running' || t.status === 'Occupied').length,
            upcoming: filtered.filter(t => t.reservations && t.reservations.length > 0).length,
            revenue: filtered.reduce((sum, t) => sum + (t.runningOrderAmount || 0), 0)
        };
    };

    // Handle Menu Action
    const handleMenuAction = (action, table) => {
        console.log(`Action: ${action} on Table: ${table.tableName}`);
        if (action === 'Split Table') {
            openSplitModal(table);
        } else if (action === 'Close Split') {
            handleCloseSplit(table);
        } else if (action === 'Reserve Table') {
            setSelectedTableForReservation(table);
            setShowReservationModal(true);
        } else if (action === 'Reservation List') {
            setSelectedTableForList(table);
            setShowReservationListModal(true);
        }
    };

    const executeCloseSplit = async (table) => {
        if (!table?.isSplitChild) {
            setErrorMessage('Only split child tables can be closed from this action.');
            setTimeout(() => setErrorMessage(''), 3000);
            return;
        }

        try {
            const response = await apiCall(`/api/tables/${table._id}/close-split`, {
                method: 'POST'
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to close split table');
            }

            setSuccessMessage(data.message || 'Split table closed successfully');
            setTimeout(() => setSuccessMessage(''), 3000);
            fetchTables();
        } catch (error) {
            console.error('Error closing split table:', error);
            setErrorMessage(error.message || 'Failed to close split table.');
            setTimeout(() => setErrorMessage(''), 3500);
        }
    };

    const handleCloseSplit = (table) => {
        if (!table?.isSplitChild) {
            setErrorMessage('Only split child tables can be closed from this action.');
            setTimeout(() => setErrorMessage(''), 3000);
            return;
        }
        setCloseSplitConfirmTable(table);
    };

    const handleConfirmCloseSplit = async () => {
        if (!closeSplitConfirmTable) return;
        const targetTable = closeSplitConfirmTable;
        setCloseSplitConfirmTable(null);
        await executeCloseSplit(targetTable);
    };

    // Open Split Modal
    const openSplitModal = (table) => {
        setSplitTableId(table._id);
        setSplitParts(2);
        const initialSubTables = [
            { name: `${table.tableName}-A`, guests: Math.ceil(table.capacity / 2), waiter: waiters[0] },
            { name: `${table.tableName}-B`, guests: Math.floor(table.capacity / 2), waiter: waiters[1] }
        ];
        setSplitSubTables(initialSubTables);
        setShowSplitModal(true);
    };

    // Handle Split Parts Change
    const handleSplitPartsChange = (e) => {
        const parts = parseInt(e.target.value);
        setSplitParts(parts);

        const currentTable = tables.find(t => t._id === splitTableId);
        if (!currentTable) return;

        const newSubTables = [];
        const capacityPerTable = Math.floor(currentTable.capacity / parts);
        let remainingCapacity = currentTable.capacity;

        for (let i = 0; i < parts; i++) {
            const suffix = String.fromCharCode(65 + i);
            const cap = i === parts - 1 ? remainingCapacity : capacityPerTable;
            remainingCapacity -= cap;

            newSubTables.push({
                name: `${currentTable.tableName}-${suffix}`,
                guests: cap > 0 ? cap : 1,
                waiter: waiters[i % waiters.length]
            });
        }
        setSplitSubTables(newSubTables);
    };

    // Handle Sub Table Change
    const handleSubTableChange = (index, field, value) => {
        const updated = [...splitSubTables];
        updated[index][field] = value;
        setSplitSubTables(updated);
    };

    // Submit Split
    const handleSplitSubmit = async () => {
        const currentTable = tables.find(t => t._id === splitTableId);
        if (!currentTable) {
            setErrorMessage('Selected table not found. Please refresh and try again.');
            setTimeout(() => setErrorMessage(''), 3000);
            return;
        }

        const normalizedSubTables = splitSubTables.map((sub) => ({
            name: String(sub.name || '').trim(),
            guests: Number(sub.guests) || 0,
            waiter: String(sub.waiter || '').trim()
        }));

        if (normalizedSubTables.some((sub) => !sub.name || sub.guests < 1)) {
            setErrorMessage('Each split table needs a name and minimum 1 seat.');
            setTimeout(() => setErrorMessage(''), 3000);
            return;
        }

        const totalGuests = normalizedSubTables.reduce((sum, sub) => sum + sub.guests, 0);
        if (totalGuests !== Number(currentTable.capacity || 0)) {
            setErrorMessage(`Total seats (${totalGuests}) must be exactly ${currentTable.capacity}.`);
            setTimeout(() => setErrorMessage(''), 3500);
            return;
        }

        setIsSplitSubmitting(true);
        try {
            const response = await apiCall(`/api/tables/${splitTableId}/split`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    splitParts,
                    subTables: normalizedSubTables
                })
            });
            let data = null;
            try {
                data = await response.json();
            } catch {
                data = { success: false, message: 'Invalid server response while splitting table' };
            }

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Split failed');
            }

            const createdSubTables = Array.isArray(data.data) ? data.data : [];
            setTables((prev) => {
                const filtered = prev.filter((table) => table._id !== splitTableId);
                return [...filtered, ...createdSubTables];
            });

            setSuccessMessage(data.message || `Table split into ${createdSubTables.length} cards successfully`);
            setTimeout(() => setSuccessMessage(''), 3000);

            // Make sure freshly split child cards are visible even when filters were narrowing results.
            setStatusFilter('All');
            setTypeFilter('All Types');
            setSearchQuery('');

            setShowSplitModal(false);
            setSplitTableId(null);
            setSplitSubTables([]);

            // Re-sync from backend to ensure stable ordering and latest data.
            fetchTables();
        } catch (error) {
            console.error('Error splitting table:', error);
            setErrorMessage(error.message || 'Failed to split table. Please try again.');
            setTimeout(() => setErrorMessage(''), 3500);
        } finally {
            setIsSplitSubmitting(false);
        }
    };

    // Submit Reservation
    const handleReservationSubmit = async (formData) => {
        try {
            const response = await apiCall(`/api/tables/${selectedTableForReservation._id}/reserve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                setSuccessMessage('Table reserved successfully!');
                setTimeout(() => setSuccessMessage(''), 2000);
                setShowReservationModal(false);
                fetchTables();
            } else {
                setErrorMessage(`Failed to reserve: ${data.message}`);
                setTimeout(() => setErrorMessage(''), 3000);
            }
        } catch (error) {
            console.error('Error reserving table:', error);
            setErrorMessage('Failed to reserve table. Please check connection.');
            setTimeout(() => setErrorMessage(''), 3000);
        }
    };

    // Handle Cancel Reservation
    const handleCancelReservation = async (reservationId) => {
        if (!window.confirm('Are you sure you want to cancel this reservation?')) return;

        try {
            const tableId = selectedTableForList._id;
            const response = await apiCall(`/api/tables/${tableId}/reserve/${reservationId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (data.success) {
                setSuccessMessage('Reservation cancelled successfully');
                setTimeout(() => setSuccessMessage(''), 2000);
                fetchTables();
                // Update local list to reflect change immediately in modal
                setSelectedTableForList(prev => ({
                    ...prev,
                    reservations: prev.reservations.map(r =>
                        r._id === reservationId ? { ...r, status: 'Cancelled' } : r
                    )
                }));
            } else {
                setErrorMessage(`Failed to cancel: ${data.message}`);
                setTimeout(() => setErrorMessage(''), 3000);
            }
        } catch (error) {
            console.error('Error cancelling reservation:', error);
            setErrorMessage('Error cancelling reservation.');
            setTimeout(() => setErrorMessage(''), 3000);
        }
    };

    // Handle Add New Type
    const handleAddNewType = () => {
        if (newTableType.trim()) {
            const trimmedType = newTableType.trim();
            console.log('➕ Adding new table type:', trimmedType);
            setNewTableData({ ...newTableData, type: trimmedType });
            setNewTableType('');
        }
    };

    // Handle Cancel New Type
    const handleCancelNewType = () => {
        setNewTableType('');
    };

    // Handle Delete Table Type from dropdown
    const handleDeleteTableType = (typeToDelete) => {
        const tablesWithType = tables.filter(t => (t.type || 'General') === typeToDelete);
        if (tablesWithType.length > 0) {
            setErrorMessage(`Cannot delete "${typeToDelete}" type because ${tablesWithType.length} table(s) are using it.`);
            setTimeout(() => setErrorMessage(''), 4000);
            return;
        }
        setAvailableTypes(prev => prev.filter(t => t !== typeToDelete));
        if (newTableData.type === typeToDelete) {
            setNewTableData({ ...newTableData, type: 'General' });
        }
    };

    // Handle Add Table Submit
    const handleAddTableSubmit = async () => {
        try {
            // Validate input
            if (!newTableData.tableName.trim()) {
                setErrorMessage('Please enter a table name/number');
                setTimeout(() => setErrorMessage(''), 3000);
                return;
            }

            if (!newTableData.capacity || newTableData.capacity < 1) {
                setErrorMessage('Please enter a valid capacity (minimum 1)');
                setTimeout(() => setErrorMessage(''), 3000);
                return;
            }

            // Check if table name already exists in the same type
            const tableType = newTableData.type;
            const duplicateInSameType = tables.find(
                t => t.tableName.toLowerCase() === newTableData.tableName.trim().toLowerCase() &&
                    (t.type || 'General') === tableType
            );

            if (duplicateInSameType) {
                setErrorMessage(`Table "${newTableData.tableName}" already exists in "${tableType}" type.`);
                setTimeout(() => setErrorMessage(''), 4000);
                return;
            }

            const tableNumber = tables.length > 0 ? Math.max(...tables.map(t => t.tableNumber || 0)) + 1 : 1;

            const payload = {
                tableName: newTableData.tableName.trim(),
                capacity: parseInt(newTableData.capacity) || 4,
                type: tableType,
                tableNumber,
                status: 'Available'
            };

            console.log('Creating table with payload:', payload);

            const response = await apiCall(`/api/tables`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                setSuccessMessage(`Table "${newTableData.tableName}" created successfully!`);
                setTimeout(() => setSuccessMessage(''), 2500);

                // Close modal first
                closeAddTableModal();

                // Force a fresh fetch from server with promise completion
                await fetchTables();

                // Wait for React to finish state updates and re-render
                await new Promise(resolve => setTimeout(resolve, 200));

                // Now update filters
                setTypeFilter(tableType);
                setStatusFilter('All');
            } else {
                console.error('❌ Failed to create table:', data.message);
                setErrorMessage(`Failed to create table: ${data.message}`);
                setTimeout(() => setErrorMessage(''), 3000);
            }
        } catch (error) {
            console.error('Error creating table:', error);
            setErrorMessage('Failed to create table. Please check connection.');
            setTimeout(() => setErrorMessage(''), 3000);
        }
    };

    if (loading && tables.length === 0) {
        return <div style={{ padding: '50px', textAlign: 'center', color: '#666' }}>Loading tables...</div>;
    }

    const stats = getStats();
    const groupedTables = getGroupedTables();
    const tableTypes = availableTypes.length > 0 ? availableTypes : getTableTypes();

    // Debug: Log available types on every render
    console.log('🎯 Available table types in dropdown:', tableTypes);
    console.log('📊 Available types state:', availableTypes);
    console.log('🔍 Current type filter:', typeFilter);
    console.log('📦 Total tables in state:', tables.length);

    return (
        <div className="table-management-container">
            {successMessage && (
                <div className="success-note-overlay">
                    <div className="success-note" style={{ background: '#10b981' }}>
                        <span className="success-icon">✓</span>
                        {successMessage}
                    </div>
                </div>
            )}
            {errorMessage && (
                <div className="success-note-overlay">
                    <div className="success-note" style={{ background: '#ef4444' }}>
                        <span className="success-icon">✕</span>
                        {errorMessage}
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="dining-header">
                <div className="header-content">
                    <h1 className="page-title">Dining Dashboard</h1>
                    <p className="subtitle">Manage your restaurant tables and reservations</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className="add-table-btn"
                        onClick={() => {
                            console.log('🔄 Manual Refresh - Current tables:', tables.length);
                            console.log('📋 Current types:', availableTypes);
                            console.log('📦 All table data:', tables);
                            console.log(`Tables: ${tables.length}\nTypes: ${availableTypes.join(', ')}`);
                            fetchTables();
                        }}
                        style={{ background: '#3b82f6' }}
                    >
                        🔄 DEBUG
                    </button>
                    <button className="add-table-btn" onClick={openAddTableModal}>
                        + ADD TABLE
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card available">
                    <span className="stat-label">Available Tables</span>
                    <span className="stat-value">{stats.available}</span>
                </div>
                <div className="stat-card occupied">
                    <span className="stat-label">Occupied (Running)</span>
                    <span className="stat-value">{stats.occupied}</span>
                </div>
                <div className="stat-card upcoming">
                    <span className="stat-label">Upcoming Reservations</span>
                    <span className="stat-value">{stats.upcoming}</span>
                </div>
                <div className="stat-card revenue">
                    <span className="stat-label">Revenue Today</span>
                    <span className="stat-value">{cs}{stats.revenue}</span>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-container">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Search table number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                    />
                </div>
                <div className="filter-buttons">
                    <button
                        className={`filter-btn ${statusFilter === 'All' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('All')}
                    >
                        All
                    </button>
                    <button
                        className={`filter-btn ${statusFilter === 'Available' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('Available')}
                    >
                        Available
                    </button>
                    <button
                        className={`filter-btn ${statusFilter === 'Running' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('Running')}
                    >
                        Running
                    </button>
                    <button
                        className={`filter-btn ${statusFilter === 'Billed' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('Billed')}
                    >
                        Billed
                    </button>
                    <button
                        className={`filter-btn ${statusFilter === 'Reserved' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('Reserved')}
                    >
                        Reserved
                    </button>
                </div>
                <select
                    className="type-dropdown"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    key={`type-filter-${tableTypes.join('-')}`}
                >
                    <option value="All Types">All Types ({tables.length})</option>
                    {tableTypes.map(type => {
                        console.log('🎨 Rendering dropdown option for type:', type);
                        return (
                            <option key={type} value={type}>
                                {type} ({getTypeCount(type)})
                            </option>
                        );
                    })}
                </select>
            </div>

            {/* Grouped Tables by Type */}
            <div className="tables-sections">
                {Object.keys(groupedTables).length > 0 ? (
                    Object.keys(groupedTables).sort().map(type => (
                        <div key={type} className="table-section">
                            <div className="section-header">
                                <h2 className="section-title">
                                    <span className="section-icon">{getTypeIcon(type)}</span>
                                    <span>{type}</span>
                                    <span className="section-count">({groupedTables[type].length} tables)</span>
                                </h2>
                            </div>
                            <div className="tables-grid">
                                {groupedTables[type].map(table => (
                                    <TableCard key={table._id} table={table} onMenuAction={handleMenuAction} />
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="no-tables">
                        <p>No tables found matching the filters.</p>
                    </div>
                )}
            </div>

            {/* Add Table Drawer (Right Side) */}
            {/* Add Table Modal */}
            {showAddTableModal && (
                <div className="add-payment-overlay" onClick={closeAddTableModal}>
                    <div className="add-payment-modal add-table-premium" onClick={(e) => e.stopPropagation()}>
                        {/* Modern Premium Header */}
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M3 12h18"></path></svg>
                            </div>
                            <div className="header-text">
                                <h3>Add New Table</h3>
                                <span>Create dining capacity</span>
                            </div>
                            <button className="premium-close-btn" onClick={closeAddTableModal}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="add-payment-body">
                            {/* Table Name Field */}
                            <div className="payment-field-group">
                                <label className="field-label-premium">TABLE NAME / NUMBER <span className="req-star">*</span></label>
                                <div className="input-with-icon-premium">
                                    <span className="field-icon">🍽️</span>
                                    <input
                                        type="text"
                                        placeholder="e.g., T15, VIP-1"
                                        value={newTableData.tableName}
                                        onChange={(e) => setNewTableData({ ...newTableData, tableName: e.target.value })}
                                        className="premium-input-field"
                                    />
                                </div>
                            </div>

                            {/* Capacity Field */}
                            <div className="payment-field-group">
                                <label className="field-label-premium">CAPACITY <span className="req-star">*</span></label>
                                <div className="input-with-icon-premium">
                                    <span className="field-icon">👥</span>
                                    <input
                                        type="number"
                                        placeholder="e.g., 4"
                                        min="1"
                                        value={newTableData.capacity}
                                        onChange={(e) => setNewTableData({ ...newTableData, capacity: parseInt(e.target.value) })}
                                        className="premium-input-field"
                                    />
                                </div>
                            </div>

                            {/* Table Type Field */}
                            <div className="payment-field-group">
                                <label className="field-label-premium">TABLE TYPE <span className="req-star">*</span></label>

                                {newTableType === '' ? (
                                    <div className="type-selection-container">
                                        <div className="custom-premium-select" ref={typeDropdownRef}>
                                            <div
                                                className="select-trigger-premium"
                                                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                                            >
                                                <span>{newTableData.type || 'Select Table Type'}</span>
                                                <span className="select-arrow">{showTypeDropdown ? '▲' : '▼'}</span>
                                            </div>

                                            {showTypeDropdown && (
                                                <div className="select-dropdown-options-premium">
                                                    <div
                                                        className="select-option-premium create-new-type-btn"
                                                        onClick={() => { setNewTableType(' '); setShowTypeDropdown(false); }}
                                                    >
                                                        + CREATE NEW TYPE
                                                    </div>
                                                    {['General', 'AC', 'Non-AC', 'Garden'].map(type => (
                                                        <div
                                                            key={type}
                                                            className={`select-option-premium ${newTableData.type === type ? 'active' : ''}`}
                                                            onClick={() => { setNewTableData({ ...newTableData, type }); setShowTypeDropdown(false); }}
                                                        >
                                                            {type}
                                                        </div>
                                                    ))}
                                                    {tableTypes.filter(t => !['General', 'AC', 'Non-AC', 'Garden'].includes(t)).map(type => (
                                                        <div
                                                            key={type}
                                                            className={`select-option-premium ${newTableData.type === type ? 'active' : ''}`}
                                                            onClick={() => { setNewTableData({ ...newTableData, type }); setShowTypeDropdown(false); }}
                                                        >
                                                            <span>{type}</span>
                                                            <button
                                                                type="button"
                                                                className="type-delete-small"
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteTableType(type); }}
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="new-type-input-group-premium">
                                        <input
                                            type="text"
                                            className="premium-input-field"
                                            placeholder="Enter new type (e.g. Roof Top)"
                                            value={newTableType.trim()}
                                            onChange={(e) => setNewTableType(e.target.value)}
                                            autoFocus
                                        />
                                        <div className="type-actions-group">
                                            <button className="action-btn-p success" onClick={handleAddNewType}>✓</button>
                                            <button className="action-btn-p cancel" onClick={handleCancelNewType}>✕</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Help Text */}
                            <div className="premium-help-card">
                                <div className="help-icon">💡</div>
                                <div className="help-text">
                                    Creating specific types helps in filtering your dining dashboard efficiently.
                                </div>
                            </div>
                        </div>

                        {/* Modern Premium Footer */}
                        <div className="payment-modal-footer">
                            <button className="btn-secondary" onClick={closeAddTableModal}>
                                Cancel
                            </button>
                            <button className="btn-primary" onClick={handleAddTableSubmit}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
                                Create Table
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Reservation Creation Modal */}
            {showReservationModal && selectedTableForReservation && (
                <ReservationModal
                    table={{ name: selectedTableForReservation.tableName, seats: selectedTableForReservation.capacity }}
                    onClose={() => setShowReservationModal(false)}
                    onReserve={handleReservationSubmit}
                />
            )}

            {/* Reservation List Modal */}
            {showReservationListModal && selectedTableForList && (
                <ReservationListModal
                    table={selectedTableForList}
                    onClose={() => setShowReservationListModal(false)}
                    onCancel={handleCancelReservation}
                    onAdd={() => {
                        setShowReservationListModal(false);
                        handleMenuAction('Reserve Table', selectedTableForList);
                    }}
                />
            )}

            {closeSplitConfirmTable && (
                <div className="add-payment-overlay" onClick={() => setCloseSplitConfirmTable(null)}>
                    <div className="add-payment-modal" onClick={(e) => e.stopPropagation()} style={{ width: '460px' }}>
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 9v4"></path>
                                    <path d="M12 17h.01"></path>
                                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                </svg>
                            </div>
                            <div className="header-text">
                                <h3>Close Split Table</h3>
                                <span>{closeSplitConfirmTable.parentTableName || closeSplitConfirmTable.tableName}</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => setCloseSplitConfirmTable(null)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="add-payment-body">
                            <div className="split-feedback-card error" style={{ marginBottom: 0 }}>
                                This will remove all split cards and restore the parent table.
                            </div>
                        </div>

                        <div className="payment-modal-footer">
                            <button className="btn-secondary" onClick={() => setCloseSplitConfirmTable(null)}>CANCEL</button>
                            <button className="btn-primary" onClick={handleConfirmCloseSplit}>CONFIRM CLOSE SPLIT</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Split Modal */}
            {showSplitModal && (
                <div className="add-payment-overlay" onClick={() => setShowSplitModal(false)}>
                    <div className="add-payment-modal split-table-premium" onClick={(e) => e.stopPropagation()}>
                        {/* Modern Premium Header */}
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"></path></svg>
                            </div>
                            <div className="header-text">
                                <h3>Split Table - {tables.find(t => t._id === splitTableId)?.tableName}</h3>
                                <span>TABLE CONFIGURATION</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => setShowSplitModal(false)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="add-payment-body">
                            {/* Capacity Info */}
                            <div className="split-info-card">
                                <div className="info-item">
                                    <span className="label">Total Capacity</span>
                                    <span className="value">{tables.find(t => t._id === splitTableId)?.capacity || 0}</span>
                                </div>
                                <div className="info-divider"></div>
                                <div className="info-item">
                                    <span className="label">Current Guests</span>
                                    <span className="value">{tables.find(t => t._id === splitTableId)?.guests || 0}</span>
                                </div>
                            </div>

                            {/* Split Configuration */}
                            <div className="payment-field-group">
                                <label className="field-label-premium">SPLIT INTO</label>
                                <div className="input-with-icon-premium">
                                    <span className="field-icon">🔗</span>
                                    <select
                                        className="premium-input-field"
                                        value={splitParts}
                                        onChange={handleSplitPartsChange}
                                        style={{ appearance: 'none', paddingLeft: '40px' }}
                                    >
                                        <option value={2}>2 Sub-tables</option>
                                        <option value={3}>3 Sub-tables</option>
                                        <option value={4}>4 Sub-tables</option>
                                    </select>
                                </div>
                            </div>

                            {/* Sub Tables Grid */}
                            <div className="sub-tables-premium-container">
                                {splitSubTables.map((sub, index) => (
                                    <div key={index} className="sub-table-premium-row">
                                        <div className="sub-name-tag">{sub.name}</div>
                                        <div className="sub-field-group">
                                            <input
                                                type="number"
                                                className="sub-input-premium"
                                                value={sub.guests}
                                                min="1"
                                                onChange={(e) => handleSubTableChange(index, 'guests', parseInt(e.target.value))}
                                                placeholder="Seats"
                                            />
                                        </div>
                                        <div className="sub-field-group">
                                            <select
                                                className="sub-select-premium"
                                                value={sub.waiter}
                                                onChange={(e) => handleSubTableChange(index, 'waiter', e.target.value)}
                                            >
                                                {waiters.map(w => <option key={w} value={w}>{w}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="payment-modal-footer">
                            <button className="btn-secondary" onClick={() => setShowSplitModal(false)}>CANCEL</button>
                            <button className="btn-primary" onClick={handleSplitSubmit} disabled={isSplitSubmitting}>
                                <span>CONFIRM SPLIT</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TableCard = ({ table, onMenuAction }) => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleAction = (action) => {
        onMenuAction(action, table);
        setShowMenu(false);
    };

    // Determine Logic for Status Display
    let displayStatus = table.status;
    let timeInfo = table.duration || '-';
    let statusClass = table.status.toLowerCase();

    // Specific logic for reserved tables
    if (table.reservations && table.reservations.length > 0) {
        // Find nearest upcoming reservation
        const now = new Date();
        const upcoming = table.reservations
            .filter(r => new Date(`${r.date}T${r.endTime}`) > now)
            .sort((a, b) => new Date(`${a.date}T${a.startTime}`) - new Date(`${b.date}T${b.startTime}`));

        if (upcoming.length > 0) {
            const nextRes = upcoming[0];
            const start = new Date(`${nextRes.date}T${nextRes.startTime}`);
            const end = new Date(`${nextRes.date}T${nextRes.endTime}`);

            if (now >= start && now <= end) {
                displayStatus = 'Reserved Active';
                statusClass = 'reserved-active';
                timeInfo = `Until ${nextRes.endTime}`;
            } else if (now < start && (start - now) < 2 * 60 * 60 * 1000) { // Within 2 hours
                // displayStatus = `Reserved ${nextRes.startTime}`;
                // statusClass = 'reserved-upcoming';
            }
        }
    }

    return (
        <div className={`table-card ${statusClass}`}>
            <div className="card-header">
                <span className="table-number">
                    {table.tableName}
                    {table.isSplitChild && <span className="split-chip">Split</span>}
                </span>
                <div className="menu-container" ref={menuRef}>
                    <div className="menu-trigger" onClick={() => setShowMenu(!showMenu)}>
                        ⋮
                    </div>
                    {showMenu && (
                        <div className="context-menu">
                            <div className="menu-item" onClick={() => handleAction('Reserve Table')}>
                                <span>📅</span> Reserve Table
                            </div>
                            <div className="menu-item" onClick={() => handleAction('Reservation List')}>
                                <span>📋</span> Reservation List
                            </div>
                            {!table.isSplitChild && (
                                <div className="menu-item" onClick={() => handleAction('Split Table')}>
                                    <span>🪓</span> Split Table
                                </div>
                            )}
                            {table.isSplitChild && (
                                <div className="menu-item" onClick={() => handleAction('Close Split')}>
                                    <span>🧩</span> Close Split
                                </div>
                            )}
                            <div className="menu-item" onClick={() => handleAction('Move Guests')}>
                                <span>➡️</span> Move Guests
                            </div>
                            <div className="menu-item" onClick={() => handleAction('Merge Table')}>
                                <span>🔗</span> Merge Table
                            </div>
                            <div className="menu-item" onClick={() => handleAction('Close Table')}>
                                <span>❌</span> Close Table
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="card-body">
                <div className="info-row">
                    <span className="seats-info">
                        👥 Seats: {table.capacity}
                    </span>
                    <span className={`status-badge status-${statusClass}`}>
                        {displayStatus}
                    </span>
                </div>

                <div className="info-row">
                    <span className="amount">{cs} {table.runningOrderAmount || 0}</span>
                    <span className="duration">{timeInfo}</span>
                </div>

                {table.assignedWaiter && (
                    <div className="info-row split-meta-row">
                        <span className="split-meta-text">Waiter: {table.assignedWaiter}</span>
                        {table.parentTableName && <span className="split-meta-text">From: {table.parentTableName}</span>}
                    </div>
                )}
            </div>

            <div className="card-footer">
                <span>
                    {displayStatus === 'Available' ? 'Ready to serve' :
                        displayStatus === 'Reserved Active' ? 'Reserved Guest' : 'In Service'}
                </span>
                {displayStatus !== 'Available' && <span>›</span>}
            </div>
        </div>
    );
};

export default TableManagement;

