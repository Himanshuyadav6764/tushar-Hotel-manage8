import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API_URL, { apiCall } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import ReservationListModal from '../../components/ReservationListModal';
import OrderNotificationPanel from '../../components/OrderNotificationPanel';
import './GuestMealService.css';

// MenuItem helper component for premium feel
const MenuItem = ({ icon, label, onClick, color = '#111827', weight = '500' }) => (
    <div
        onMouseDown={onClick}
        className="menu-item-hover"
        style={{
            padding: '8px 10px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            fontSize: '0.84rem',
            cursor: 'pointer',
            borderRadius: '8px',
            color: color,
            fontWeight: weight,
            transition: 'background 0.2s ease'
        }}
    >
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        {label}
    </div>
);

const GuestMealService = () => {
    // Add internal animation styles
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes fadeInScale {
                from { opacity: 0; transform: scale(0.95) translateY(-10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .menu-item-hover:hover {
                background-color: #f3f4f6;
            }
            @keyframes blink {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(1.2); }
                100% { opacity: 1; transform: scale(1); }
            }
            .blink-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                display: inline-block;
                position: absolute;
                top: 15px;
                right: 50px;
                animation: blink 1.5s infinite ease-in-out;
                box-shadow: 0 0 8px rgba(0,0,0,0.2);
                border: 2px solid white;
            }
            .blink-yellow { background-color: #fca5a5; box-shadow: 0 0 10px #fca5a5; }   /* Pending - Reddish/Yellow per user request? User said Pending -> Yellow blink. Preparing -> Red blink. */
            /* Wait, user said Pending -> Yellow, Preparing -> Red. Let's fix colors. */
            .blink-yellow-real { background-color: #fbbf24; box-shadow: 0 0 10px #fbbf24; }
            .blink-red-real { background-color: #ef4444; box-shadow: 0 0 10px #ef4444; }
            .blink-green-real { background-color: #22c55e; box-shadow: 0 0 10px #22c55e; }
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.02); }
                100% { transform: scale(1); }
            }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .context-menu::-webkit-scrollbar {
                width: 6px;
            }
            .context-menu::-webkit-scrollbar-thumb {
                background: #fecaca;
                border-radius: 999px;
            }
            .context-menu::-webkit-scrollbar-track {
                background: transparent;
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);
    // --- STATE MANAGEMENT ---
    const navigate = useNavigate();
    const { user } = useAuth();
    const {
        settings,
        getCurrencySymbol,
        formatDate,
        formatTime,
        getCurrentDateISO,
        getCurrentTime24,
        toTime24,
        timeToMinutes,
        isPastDateTime
    } = useSettings();
    const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';
    const permissionLabels = Array.isArray(user?.permissions) ? user.permissions : [];
    const hasExplicitAssignments = !isSuperAdmin && permissionLabels.length > 0;
    const canOpenCashierTableBilling = isSuperAdmin || (
        hasExplicitAssignments
            ? permissionLabels.includes('Cashier Section (Table)')
            : user?.role !== 'staff'
    );
    const cs = getCurrencySymbol();

    const getNowContext = useCallback(() => {
        const dateISO = getCurrentDateISO();
        const time24 = getCurrentTime24();
        const minutes = timeToMinutes(time24) ?? 0;

        return { dateISO, time24, minutes };
    }, [getCurrentDateISO, getCurrentTime24, timeToMinutes]);

    const computeEndTime = useCallback((startTime) => {
        const normalizedStart = toTime24(startTime);
        const startMinutes = timeToMinutes(normalizedStart);
        if (startMinutes === null) return '';

        const startHour = Math.floor(startMinutes / 60);
        let durationMins = 60;
        if (startHour >= 17 || startHour < 4) durationMins = 120;
        else if (startHour >= 11) durationMins = 90;

        const endMinutes = startMinutes + durationMins;
        const endHour = Math.floor((endMinutes / 60) % 24);
        const endMinute = endMinutes % 60;

        return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
    }, [toTime24, timeToMinutes]);

    // Tables State
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filteredTables, setFilteredTables] = useState([]);

    // Filters & Search
    const [statusFilter, setStatusFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All');
    const [locationFilter, setLocationFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [showTypeFilterDropdown, setShowTypeFilterDropdown] = useState(false);
    const [showLocationFilterDropdown, setShowLocationFilterDropdown] = useState(false);
    const typeFilterDropdownRef = useRef(null);
    const locationFilterDropdownRef = useRef(null);

    // Modals
    const [showAddTableModal, setShowAddTableModal] = useState(false);
    const [isEditTableMode, setIsEditTableMode] = useState(false);
    const [editingTableId, setEditingTableId] = useState(null);
    const [showWalkInModal, setShowWalkInModal] = useState(false);
    const [walkInTargetTable, setWalkInTargetTable] = useState(null);
    const [walkInGuestCount, setWalkInGuestCount] = useState('');
    // Table Types State
    const [tableTypes, setTableTypes] = useState(['General', 'AC', 'Non-AC', 'Garden']);
    const [isAddingTableType, setIsAddingTableType] = useState(false);
    const [newTableType, setNewTableType] = useState('');
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const typeDropdownRef = useRef(null);
    const selectedTypeRef = useRef('');
    const [tableTypeDeleteWarning, setTableTypeDeleteWarning] = useState(null);
    const [tableLocations, setTableLocations] = useState(['Main Hall', 'Garden', 'Rooftop', 'Poolside']);
    const [isAddingTableLocation, setIsAddingTableLocation] = useState(false);
    const [newTableLocation, setNewTableLocation] = useState('');
    const [showLocationDropdown, setShowLocationDropdown] = useState(false);
    const locationDropdownRef = useRef(null);
    const selectedLocationRef = useRef('');
    const [tableLocationDeleteWarning, setTableLocationDeleteWarning] = useState(null);

    const findCaseInsensitiveMatch = (items, value) => {
        const target = String(value || '').trim().toLowerCase();
        if (!target) return null;
        return items.find(item => String(item || '').trim().toLowerCase() === target) || null;
    };

    const [newTableData, setNewTableData] = useState({
        tableName: '',
        type: '',
        capacity: '',
        location: ''
    });

    const patchNewTableData = useCallback((patch) => {
        setNewTableData(prev => ({ ...prev, ...patch }));
    }, []);

    const isRunningTable = useCallback((table) => {
        const state = String(table?.calculatedStatus || table?.status || '').toLowerCase();
        return ['running', 'occupied', 'billed'].includes(state) || !!table?.currentOrderId;
    }, []);

    const getRunningSinceTs = useCallback((table) => {
        const stamp =
            table?.currentOrderStartedAt ||
            table?.runningSince ||
            table?.occupiedAt ||
            table?.updatedAt ||
            table?.createdAt;
        const ts = stamp ? new Date(stamp).getTime() : Number.NaN;
        return Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;
    }, []);

    const getTableSortNumber = useCallback((tableName) => {
        const raw = String(tableName || '');
        const match = raw.match(/\d+/);
        return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
    }, []);

    const sortTablesForDisplay = useCallback((list) => {
        return [...list].sort((a, b) => {
            const aRunning = isRunningTable(a);
            const bRunning = isRunningTable(b);

            if (aRunning !== bRunning) return aRunning ? -1 : 1;

            if (aRunning && bRunning) {
                const aStarted = getRunningSinceTs(a);
                const bStarted = getRunningSinceTs(b);
                if (aStarted !== bStarted) return aStarted - bStarted;
            }

            const numA = getTableSortNumber(a.tableName);
            const numB = getTableSortNumber(b.tableName);
            if (numA !== numB) return numA - numB;

            return String(a.tableName || '').localeCompare(String(b.tableName || ''), undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [getRunningSinceTs, getTableSortNumber, isRunningTable]);

    const closeTableFormModal = useCallback(() => {
        setShowAddTableModal(false);
        setTableTypeDeleteWarning(null);
        setIsAddingTableType(false);
        setNewTableType('');
        setShowTypeDropdown(false);
        setTableLocationDeleteWarning(null);
        setIsAddingTableLocation(false);
        setNewTableLocation('');
        setShowLocationDropdown(false);
        setIsEditTableMode(false);
        setEditingTableId(null);
        setNewTableData({ tableName: '', type: '', capacity: '', location: '' });
        selectedTypeRef.current = '';
        selectedLocationRef.current = '';
    }, []);

    const openCreateTableModal = () => {
        setIsEditTableMode(false);
        setEditingTableId(null);
        setNewTableData({ tableName: '', type: '', capacity: '', location: '' });
        selectedTypeRef.current = '';
        selectedLocationRef.current = '';
        setTableTypeDeleteWarning(null);
        setTableLocationDeleteWarning(null);
        setShowAddTableModal(true);
    };

    const openEditTableModal = (table) => {
        if (!table) return;

        const tableType = table.type || 'General';
        if (tableType && !tableTypes.includes(tableType)) {
            setTableTypes(prev => [...new Set([...prev, tableType])]);
        }

        const tableLocation = table.location || 'Main Hall';
        if (tableLocation && !tableLocations.includes(tableLocation)) {
            setTableLocations(prev => [...new Set([...prev, tableLocation])]);
        }

        setIsEditTableMode(true);
        setEditingTableId(table.tableId || table._id);
        setNewTableData({
            tableName: table.tableName || '',
            type: tableType,
            capacity: table.capacity ? String(table.capacity) : '',
            location: tableLocation
        });
        selectedTypeRef.current = tableType;
        selectedLocationRef.current = tableLocation;
        setTableTypeDeleteWarning(null);
        setTableLocationDeleteWarning(null);
        setShowAddTableModal(true);
    };

    // Close type dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
                setShowTypeDropdown(false);
            }
            if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target)) {
                setShowLocationDropdown(false);
            }
            if (typeFilterDropdownRef.current && !typeFilterDropdownRef.current.contains(e.target)) {
                setShowTypeFilterDropdown(false);
            }
            if (locationFilterDropdownRef.current && !locationFilterDropdownRef.current.contains(e.target)) {
                setShowLocationFilterDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!tableTypeDeleteWarning) return;

        const timer = setTimeout(() => setTableTypeDeleteWarning(null), 5000);
        return () => clearTimeout(timer);
    }, [tableTypeDeleteWarning]);

    useEffect(() => {
        if (!tableLocationDeleteWarning) return;

        const timer = setTimeout(() => setTableLocationDeleteWarning(null), 5000);
        return () => clearTimeout(timer);
    }, [tableLocationDeleteWarning]);

    // Move Guest State
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moveSourceTable, setMoveSourceTable] = useState(null);
    const [moveTargetTableId, setMoveTargetTableId] = useState('');

    // Reserve Table State
    const [showReserveModal, setShowReserveModal] = useState(false);
    const [reserveTargetTable, setReserveTargetTable] = useState(null);
    const [reserveFormData, setReserveFormData] = useState({
        name: '',
        date: '',
        startTime: '',
        endTime: '',
        guests: '',
        phone: '',
        source: 'Phone',
        advancePayment: 0
    });

    // Merge Table State
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [mergeSelectedTargetIds, setMergeSelectedTargetIds] = useState([]);
    const [mergeSourceTable, setMergeSourceTable] = useState(null);
    const [mergeSourceGuests, setMergeSourceGuests] = useState(0);

    // Close Table State
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [closeTableData, setCloseTableData] = useState(null);

    // Split Modal State
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [splitTableId, setSplitTableId] = useState(null);
    const [splitParts, setSplitParts] = useState(2);
    // Verify User State
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [verifyPhoneInput, setVerifyPhoneInput] = useState('');
    const [verifyTableId, setVerifyTableId] = useState(null);
    const [selectedVerifyMatchKey, setSelectedVerifyMatchKey] = useState('');
    const [showCancelReservationPanel, setShowCancelReservationPanel] = useState(false);
    const [cancelPanelTarget, setCancelPanelTarget] = useState(null);
    const [cancelPanelForm, setCancelPanelForm] = useState({
        guestName: '',
        phone: '',
        reason: '',
        charge: '0',
        note: ''
    });

    const [splitSubTables, setSplitSubTables] = useState([]);
    // Reservation List State
    const [showReservationListModal, setShowReservationListModal] = useState(false);
    const [reservationListTable, setReservationListTable] = useState(null);
    const [reservationSearchQuery, setReservationSearchQuery] = useState('');

    const [stats, setStats] = useState({
        total: 0,
        available: 0,
        running: 0,
        billed: 0,
        reserved: 0,
        revenue: 0,
        upcomingCount: 0
    });

    // Time Availability Filter State
    const [filterDate, setFilterDate] = useState(() => getCurrentDateISO());
    const [filterTime, setFilterTime] = useState(() => getCurrentTime24());
    // Persisted "Applied" filters
    const [appliedDate, setAppliedDate] = useState(() => getCurrentDateISO());
    const [appliedTime, setAppliedTime] = useState(() => getCurrentTime24());
    const [isTimeFilterActive, setIsTimeFilterActive] = useState(false);

    // Fetch tables on mount and periodically
    useEffect(() => {
        fetchTables();
        const interval = setInterval(fetchTables, 15000); // Refresh every 15 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchTables = async () => {
        try {
            const response = await apiCall(`/api/guest-meal/tables`);
            const data = await response.json();
            if (data.success) {
                setTables(data.data);
                // Extract unique types
                const types = [...new Set(data.data.map(t => t.type))]
                    .filter(t => t && !t.toLowerCase().includes('burr'));
                // Merge with default types
                setTableTypes(prev => {
                    const merged = [...new Set([...prev, ...types])]
                        .filter(t => !t.toLowerCase().includes('burr'));
                    return merged;
                });

                const locations = [...new Set(data.data.map(t => t.location || 'Main Hall'))]
                    .filter(loc => !!String(loc || '').trim());
                setTableLocations(prev => [...new Set([...prev, ...locations])]);
            } else {
                console.error("Failed to fetch tables", data);
            }
        } catch (error) {
            console.error('Error fetching tables:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- TOAST NOTIFICATION ---
    const [toast, setToast] = useState({ show: false, message: '', subtext: '' });
    const [cancelSuccessNote, setCancelSuccessNote] = useState({ show: false, message: '', subtext: '' });
    const cancelSuccessTimerRef = useRef(null);

    const showToast = (message, subtext = '') => {
        setToast({ show: true, message, subtext });
        setTimeout(() => setToast({ show: false, message: '', subtext: '' }), 2000);
    };

    const showCancelSuccessNote = (message, subtext = '') => {
        if (cancelSuccessTimerRef.current) {
            clearTimeout(cancelSuccessTimerRef.current);
            cancelSuccessTimerRef.current = null;
        }

        setCancelSuccessNote({ show: true, message, subtext });
        cancelSuccessTimerRef.current = setTimeout(() => {
            setCancelSuccessNote({ show: false, message: '', subtext: '' });
            cancelSuccessTimerRef.current = null;
        }, 6000);
    };

    useEffect(() => {
        return () => {
            if (cancelSuccessTimerRef.current) {
                clearTimeout(cancelSuccessTimerRef.current);
                cancelSuccessTimerRef.current = null;
            }
        };
    }, []);

    const handleSendToCashier = async (e, table) => {
        e.stopPropagation();
        if (!canOpenCashierTableBilling) {
            showToast('Role not assigned', 'Cashier Section (Table) permission is required.');
            return;
        }
        if (!table.currentOrderId) {
            showToast('No Order', 'This table has no active order to send.');
            return;
        }

        // Prevent sending if already sent (pending payment/billed)
        if (table.status === 'Billed' || table.orderStatus === 'Pending Payment') {
            showToast('Already Sent', 'Bill is already with cashier');
            return;
        }

        try {
            const orderId = table.currentOrderId._id || table.currentOrderId;

            console.log(`Sending order ${orderId} to cashier...`);
            const response = await apiCall(`/api/guest-meal/orders/${orderId}/send-to-cashier`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            if (data.success) {
                showToast('Send Successful', 'Bill sent to cashier');
                fetchTables(); // Refresh UI

                console.log('Navigation state:', { activeMenu: 'cashier-section', refresh: true });
                // Navigate to cashier section directly
                navigate('/admin/cashier-section', {
                    state: { activeMenu: 'cashier-section', cashierMode: 'Table', refresh: true }
                });
            } else {
                showToast('Send Failed', data.message || 'Error occurred');
            }
        } catch (error) {
            console.error('Error sending to cashier:', error);
            showToast('Send Failed', 'Error sending to cashier');
        }
    };

    // Periodic stats refresh
    useEffect(() => {
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        try {
            const response = await apiCall(`/api/guest-meal/analytics/dashboard`);
            const data = await response.json();
            if (data.success) {
                const s = data.data;
                setStats({
                    total: s.totalTables || 0,
                    available: s.availableTables || 0,
                    running: s.runningTables || 0,
                    billed: s.billedTables || 0,
                    revenue: s.totalRevenue || 0,
                    upcomingCount: s.totalOrders || 0, // Using total orders today as proxy or similar
                    reserved: s.billedTables || 0 // Assuming reserved might be mapped elsewhere or just keeping billed for now
                });
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const isTimeOverlap = (start1, end1, start2, end2) => {
        if (!start1 || !end1 || !start2 || !end2) return false;
        const [s1h, s1m] = start1.split(':').map(Number);
        const [e1h, e1m] = end1.split(':').map(Number);
        const [s2h, s2m] = start2.split(':').map(Number);
        const [e2h, e2m] = end2.split(':').map(Number);

        const s1 = s1h * 60 + s1m;
        const e1 = e1h * 60 + e1m;
        const s2 = s2h * 60 + s2m;
        const e2 = e2h * 60 + e2m;

        return s1 < e2 && s2 < e1;
    };

    const checkReservationConflict = (table, formData) => {
        if (!table || !table.reservations) return null;
        return table.reservations.find(res =>
            String(res.status || '').toLowerCase() !== 'cancelled' &&
            !getReservationTimelineMeta(res).isExpiredFromView &&
            res.id !== formData.id &&
            res.date === formData.date &&
            isTimeOverlap(res.startTime, res.endTime, formData.startTime, formData.endTime)
        );
    };

    // Reserve Table State removed

    // Waiters List
    const waiters = ['Rahul', 'Aman', 'Suresh', 'Priya', 'Kavita'];

    const handleDeleteTable = async (table) => {
        if (table.currentOrderId || ['Running', 'Occupied', 'Billed'].includes(table.status)) {
            showToast('Delete Blocked', 'Please close active order before deleting table.');
            return;
        }

        try {
            const targetId = table.tableId || table._id;
            const response = await apiCall(`/api/guest-meal/tables/${targetId}`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                showToast('Table Deleted', `${table.tableName} removed successfully.`);
                fetchTables();
            } else {
                showToast('Delete Failed', data.message || 'Unable to delete table.');
            }
        } catch (error) {
            console.error('Delete table error:', error);
            showToast('Delete Failed', 'Server error while deleting table.');
        }
    };

    const openWalkInModal = (table) => {
        setWalkInTargetTable(table);
        setWalkInGuestCount(String(table?.capacity || 1));
        setShowWalkInModal(true);
    };

    const closeWalkInModal = () => {
        setShowWalkInModal(false);
        setWalkInTargetTable(null);
        setWalkInGuestCount('');
    };

    const handleWalkInSubmit = async () => {
        if (!walkInTargetTable) return;

        const guests = Math.max(1, Number(walkInGuestCount) || Number(walkInTargetTable.capacity) || 1);

        try {
            const targetId = walkInTargetTable.tableId || walkInTargetTable._id;
            const response = await apiCall(`/api/guest-meal/tables/${targetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'Occupied',
                    currentOrderGuestCount: guests,
                    currentOrderGuestName: 'Walk-in'
                })
            });
            const data = await response.json();
            if (data.success) {
                setTables(prev => prev.map(t => (t.tableId || t._id) === targetId ? {
                    ...data.data,
                    tableId: data.data._id || data.data.tableId
                } : t));
                showToast('Walk-in Started', `${walkInTargetTable.tableName} opened for ${guests} guests.`);
                closeWalkInModal();
            } else {
                showToast('Walk-in Failed', data.message || 'Unable to start walk-in.');
            }
        } catch (err) {
            console.error('Walk-in error:', err);
            showToast('Walk-in Failed', 'Network error while opening walk-in.');
        }
    };

    // Handle Menu Action
    const handleMenuAction = (action, table) => {
        if (action === 'Split Table') {
            openSplitModal(table);
        } else if (action === 'Edit Table') {
            openEditTableModal(table);
        } else if (action === 'Delete Table') {
            handleDeleteTable(table);
        } else if (action === 'Reserve Table') {
            openReserveModal(table);
        } else if (action === 'Move Guests') {
            openMoveModal(table);
        } else if (action === 'Merge Table') {
            openMergeModal(table);
        } else if (action === 'Close Table') {
            openCloseModal(table);
        } else if (action === 'Verify User') {
            openVerifyModal(table);
        } else if (action === 'Reservation List') {
            openReservationListModal(table);
        } else if (action === 'Walk-in') {
            openWalkInModal(table);
        } else if (action === 'Release Table') {
            handleReleaseTable(table);
        } else if (action === 'Create Order' || action === 'Continue' || action === 'View Bill') {
            handleTableClick(table);
        }
    };

    const openReservationListModal = (table) => {
        setReservationListTable(table);
        setShowReservationListModal(true);
    };

    // Verify User Logic
    const openVerifyModal = (table = null) => {
        setVerifyTableId(table ? (table.tableId || table._id) : null);
        setVerifyPhoneInput('');
        setSelectedVerifyMatchKey('');
        setShowCancelReservationPanel(false);
        setCancelPanelTarget(null);
        setShowVerifyModal(true);
    };

    const handleVerifyUser = async () => {
        const inputDigits = normalizePhoneDigits(verifyPhoneInput);
        const verifyMatches = getVerifyMatches(verifyPhoneInput);
        const exactReservationMatches = verifyMatches.filter(
            (m) => m.type === 'reservation' && normalizePhoneDigits(m.phone) === inputDigits
        );

        const selectedReservationMatch = exactReservationMatches.find(
            (m) => getVerifyMatchKey(m) === selectedVerifyMatchKey
        );
        const matchedReservation = selectedReservationMatch || exactReservationMatches[0] || null;
        const tableToVerify = matchedReservation
            ? tables.find((t) => (t.tableId || t._id) === matchedReservation.tableId)
            : null;

        if (!tableToVerify || !matchedReservation) {
            showToast('Verification Failed', 'No matching reservation found for this phone number.');
            return;
        }

        if (!matchedReservation.canVerify) {
            showToast('Verification Blocked', 'Only active or upcoming reservations can be verified.');
            return;
        }

        // Verified! Just seat the guest as 'Occupied'
        setShowVerifyModal(false);

        try {
            const targetId = tableToVerify.tableId || tableToVerify._id;
            const response = await apiCall(`/api/guest-meal/tables/${targetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'Occupied',
                    currentOrderGuestName: matchedReservation.name,
                    currentOrderGuestPhone: matchedReservation.phone,
                    currentOrderGuestCount: matchedReservation.guests
                })
            });

            const data = await response.json();
            if (data.success) {
                setTables(prev => prev.map(t => (t.tableId || t._id) === targetId ? {
                    ...data.data,
                    tableId: data.data._id || data.data.tableId
                } : t));

                setToast({
                    show: true,
                    message: "Guest Verified",
                    subtext: `${matchedReservation.name} seated at Table ${tableToVerify.tableName}`
                });
                setTimeout(() => setToast({ show: false, message: '', subtext: '' }), 3000);
                // Update local state to Occupied (Guest is seated/verified but hasn't ordered yet)
                setTables(prev => prev.map(t => (t.tableId === tableToVerify.tableId || t._id === tableToVerify._id) ? { ...t, status: 'Occupied' } : t));

                // Navigate with guest details
                navigate('/admin/food-order', {
                    state: {
                        activeMenu: 'food-order',
                        orderMode: 'dinein',
                        source: 'table-order',
                        room: {
                            roomNumber: tableToVerify.tableName,
                            guestName: matchedReservation.name,
                            guestPhone: matchedReservation.phone,
                            id: tableToVerify.tableId || tableToVerify._id
                        }
                    }
                });
            }
        } catch (error) {
            console.error("Error verifying user:", error);
            showToast('Verification Failed', 'Network error during verification.');
        }
    };

    const normalizePhoneDigits = (value = '') => String(value).replace(/\D/g, '');

    const parseReservationDateTime = useCallback((dateValue, timeValue) => {
        if (!dateValue || !timeValue) return null;
        const normalizedTime = toTime24(timeValue);
        if (!normalizedTime || !normalizedTime.includes(':')) return null;

        const [year, month, day] = String(dateValue).split('-').map(Number);
        const [hour, minute] = normalizedTime.split(':').map(Number);
        if ([year, month, day, hour, minute].some(Number.isNaN)) return null;

        return new Date(year, month - 1, day, hour, minute, 0, 0);
    }, [toTime24]);

    const getReservationTimelineMeta = useCallback((reservation = {}) => {
        const nowTs = Date.now();
        const retentionCutoffTs = nowTs - (24 * 60 * 60 * 1000);

        const startDateTime = parseReservationDateTime(reservation.date, reservation.startTime);
        const endDateTime = parseReservationDateTime(reservation.date, reservation.endTime || reservation.startTime);

        const startTs = startDateTime ? startDateTime.getTime() : 0;
        const endTs = endDateTime ? endDateTime.getTime() : startTs;
        const status = String(reservation.status || 'Upcoming').trim();
        const normalizedStatus = status.toLowerCase();
        const isCancelled = normalizedStatus === 'cancelled';
        const isExpiredFromView = endTs > 0 && endTs < retentionCutoffTs;

        const isInSession = startTs > 0 && endTs > 0 && nowTs >= startTs && nowTs <= endTs;
        const isFuture = startTs > nowTs;
        const isPast = endTs > 0 && endTs < nowTs;
        const canVerify = !isCancelled && !isPast && !isExpiredFromView;

        let statusLabel = status || 'Upcoming';
        if (isCancelled) {
            statusLabel = 'Cancelled';
        } else if (isInSession) {
            statusLabel = 'In Session';
        } else if (isFuture) {
            statusLabel = 'Reserved';
        } else if (isPast) {
            statusLabel = 'Completed';
        }

        return {
            startTs,
            endTs,
            isCancelled,
            isExpiredFromView,
            isFuture,
            isPast,
            isInSession,
            canVerify,
            statusLabel
        };
    }, [parseReservationDateTime]);

    const getVerifyMatchKey = (match) => {
        if (!match) return '';
        return `${match.type}-${match.tableId}-${normalizePhoneDigits(match.phone)}-${match.sortValue}`;
    };

    const getVerifyMatches = (phoneInput) => {
        const inputDigits = normalizePhoneDigits(phoneInput);
        if (inputDigits.length < 3) return [];

        const sourceTables = verifyTableId
            ? tables.filter(t => (t.tableId || t._id) === verifyTableId)
            : tables;

        const reservationMatches = [];
        const runningMatches = [];

        sourceTables.forEach((t) => {
            const tName = t.tableName;
            const reservations = t.reservations || [];

            reservations.forEach((r, index) => {
                const resDigits = normalizePhoneDigits(r.phone);
                if (!resDigits) return;
                const isMatch = resDigits.includes(inputDigits) || inputDigits.includes(resDigits);
                if (!isMatch) return;

                const timelineMeta = getReservationTimelineMeta(r);
                if (timelineMeta.isExpiredFromView) return;

                const sortGroup = timelineMeta.isFuture || timelineMeta.isInSession ? 1 : 2;
                const sortValue = timelineMeta.isFuture || timelineMeta.isInSession
                    ? (timelineMeta.startTs || (Date.now() + index))
                    : -(timelineMeta.endTs || Date.now());

                reservationMatches.push({
                    type: 'reservation',
                    tableId: t.tableId || t._id,
                    tableName: tName,
                    _id: r._id,
                    id: r.id,
                    name: r.name,
                    phone: r.phone,
                    guests: r.guests,
                    date: r.date,
                    startTime: r.startTime,
                    endTime: r.endTime,
                    advancePayment: r.advancePayment,
                    status: r.status || 'Upcoming',
                    statusLabel: timelineMeta.statusLabel,
                    canVerify: timelineMeta.canVerify,
                    sortGroup,
                    sortValue,
                });
            });

            const tableStatus = (t.status || '').toLowerCase();
            const isRunningState = ['running', 'occupied', 'billed'].includes(tableStatus) || !!t.currentOrderId;
            const runningDigits = normalizePhoneDigits(t.currentOrderGuestPhone || '');

            if (isRunningState && runningDigits && (runningDigits.includes(inputDigits) || inputDigits.includes(runningDigits))) {
                const runningTs = t.updatedAt ? new Date(t.updatedAt).getTime() : Date.now();
                runningMatches.push({
                    type: 'running',
                    tableId: t.tableId || t._id,
                    tableName: tName,
                    name: t.currentOrderGuestName || 'Guest',
                    phone: t.currentOrderGuestPhone,
                    guests: t.currentOrderGuestCount || 0,
                    date: null,
                    startTime: null,
                    endTime: null,
                    advancePayment: 0,
                    statusLabel: 'Currently Running',
                    canVerify: false,
                    sortGroup: 0,
                    sortValue: -runningTs,
                });
            }
        });

        return [...reservationMatches, ...runningMatches]
            .sort((a, b) => {
                if (a.sortGroup !== b.sortGroup) return a.sortGroup - b.sortGroup;
                const nameA = String(a.name || '').trim().toLowerCase();
                const nameB = String(b.name || '').trim().toLowerCase();
                if (nameA !== nameB) return nameA.localeCompare(nameB);
                return a.sortValue - b.sortValue;
            });
    };

    useEffect(() => {
        setSelectedVerifyMatchKey('');
    }, [verifyPhoneInput, verifyTableId]);

    // Open Split Modal
    const openSplitModal = (table) => {
        setSplitTableId(table.tableId || table._id);
        setSplitParts(2);

        const guests = table.guests || table.capacity;
        const initialSubTables = [
            { name: `${table.tableName}-A`, guests: Math.ceil(guests / 2), waiter: waiters[0] },
            { name: `${table.tableName}-B`, guests: Math.floor(guests / 2), waiter: waiters[1] }
        ];

        setSplitSubTables(initialSubTables);
        setShowSplitModal(true);
    };

    // Handle Split Parts Change
    const handleSplitPartsChange = (e) => {
        const parts = parseInt(e.target.value, 10);
        setSplitParts(parts);

        const currentTable = tables.find(t => (t.tableId || t._id) === splitTableId);
        if (!currentTable) return;

        const baseGuests = currentTable.guests || currentTable.capacity || parts;
        const guestsPerTable = Math.floor(baseGuests / parts);
        let remainingGuests = baseGuests;

        const newSubTables = [];
        for (let i = 0; i < parts; i++) {
            const suffix = String.fromCharCode(65 + i);
            const guests = i === parts - 1 ? remainingGuests : guestsPerTable;
            remainingGuests -= guests;

            newSubTables.push({
                name: `${currentTable.tableName}-${suffix}`,
                guests: guests > 0 ? guests : 1,
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
    const handleSplitSubmit = () => {
        showToast('Split Ready', 'Split configuration saved.');
        setShowSplitModal(false);
    };

    // Move Guests
    const openMoveModal = (table) => {
        setMoveSourceTable(table);
        setMoveTargetTableId('');
        setShowMoveModal(true);
    };

    const handleMoveSubmit = () => {
        if (!moveSourceTable || !moveTargetTableId) return;

        const updatedTables = tables.map(t => {
            if ((t.tableId || t._id) === (moveSourceTable.tableId || moveSourceTable._id)) {
                return { ...t, status: 'Available', guests: 0, amount: 0, duration: 0 };
            }

            if ((t.tableId || t._id) === moveTargetTableId) {
                return {
                    ...t,
                    status: 'Running',
                    guests: moveSourceTable.guests,
                    amount: moveSourceTable.amount,
                    duration: moveSourceTable.duration
                };
            }

            return t;
        });

        setTables(updatedTables);
        setShowMoveModal(false);
        showToast('Guests Moved', 'Guests moved to selected table.');
    };

    const getValidMoveTargets = () => {
        if (!moveSourceTable) return [];
        return tables.filter(t =>
            t.status === 'Available' &&
            t.tableId !== moveSourceTable.tableId &&
            t.capacity >= (moveSourceTable.guests || 1)
        );
    };

    // --- RESERVE TABLE LOGIC ---
    const openReserveModal = (table, reservation = null) => {
        setReserveTargetTable(table);
        if (reservation) {
            setReserveFormData({
                id: reservation.id,
                name: reservation.name,
                date: reservation.date,
                startTime: reservation.startTime,
                endTime: reservation.endTime,
                guests: reservation.guests,
                phone: reservation.phone,
                source: reservation.source || 'Phone',
                note: reservation.note || '',
                advancePayment: reservation.advancePayment || 0
            });
        } else {
            const nowCtx = getNowContext();
            const startTimeStr = nowCtx.time24;
            const endTimeStr = computeEndTime(startTimeStr);

            setReserveFormData({
                name: '',
                date: nowCtx.dateISO,
                startTime: startTimeStr,
                endTime: endTimeStr,
                guests: table.capacity, // Default to capacity
                phone: '',
                source: 'Phone',
                advancePayment: 0
            });
        }
        setShowReserveModal(true);
    };

    const handleReserveSubmit = async () => {
        if (!reserveTargetTable || !reserveFormData.name || !reserveFormData.startTime || !reserveFormData.endTime || !reserveFormData.source) {
            showToast('Validation Error', 'Please fill all required fields.');
            return;
        }

        // --- VALIDATIONS ---
        // 1. Phone Validation (10 digits)
        if (reserveFormData.phone && !/^\d{10}$/.test(reserveFormData.phone)) {
            showToast('Validation Error', 'Phone number must be exactly 10 digits.');
            return;
        }

        // 2. Name Validation (Alphabets only)
        if (!/^[a-zA-Z\s]+$/.test(reserveFormData.name)) {
            showToast('Validation Error', 'Guest name should only contain alphabets.');
            return;
        }

        // 3. Duration Validation (Min 30 mins)
        const normalizedStartTime = toTime24(reserveFormData.startTime);
        const normalizedEndTime = toTime24(reserveFormData.endTime);
        const startTotal = timeToMinutes(normalizedStartTime);
        const endTotal = timeToMinutes(normalizedEndTime);

        if (startTotal === null || endTotal === null) {
            showToast('Validation Error', 'Please enter a valid reservation time.');
            return;
        }

        if (endTotal <= startTotal) {
            showToast('Validation Error', 'End time must be after start time.');
            return;
        }

        if (endTotal - startTotal < 30) {
            showToast('Validation Error', 'Reservation duration must be at least 30 minutes.');
            return;
        }

        // 4. Past Time Validation
        const nowCtx = getNowContext();
        if (reserveFormData.date < nowCtx.dateISO) {
            showToast('Validation Error', 'Cannot book a reservation for a past date.');
            return;
        }

        if (isPastDateTime(reserveFormData.date, normalizedStartTime)) {
            showToast('Validation Error', 'Cannot book a reservation for a past time.');
            return;
        }

        const normalizedFormData = {
            ...reserveFormData,
            startTime: normalizedStartTime,
            endTime: normalizedEndTime
        };

        // 5. Time Conflict Validation matches user request: "same time pe do log na kare"
        // Also checks explicit overlap range
        const conflict = checkReservationConflict(reserveTargetTable, normalizedFormData);
        if (conflict) {
            showToast('Reservation Conflict', `${conflict.startTime} - ${conflict.endTime} already booked by ${conflict.name}`);
            return;
        }

        try {
            const isEditing = !!reserveFormData.id;
            let payload = {};

            if (isEditing) {
                // If editing, send the whole modified array
                const updatedReservations = (reserveTargetTable.reservations || []).map(r =>
                    r.id === reserveFormData.id ? { ...normalizedFormData } : r
                );
                payload = { reservations: updatedReservations };
            } else {
                const newReservation = {
                    id: Date.now().toString(), // Simple ID
                    ...normalizedFormData
                };
                payload = { newReservation };
            }

            const targetId = reserveTargetTable.tableId || reserveTargetTable._id;
            const response = await apiCall(`/api/guest-meal/tables/${targetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (data.success) {
                // Ensure data from server is augmented for frontend state consistency
                const updatedTable = {
                    ...data.data,
                    tableId: data.data._id || data.data.tableId
                };

                setTables(prev => prev.map(t => (t.tableId || t._id) === targetId ? updatedTable : t));
                if (reservationListTable && (reservationListTable.tableId || reservationListTable._id) === targetId) {
                    setReservationListTable(updatedTable);
                }
                setShowReserveModal(false);
            } else {
                showToast('Reservation Failed', data.message || 'Failed to reserve table.');
            }
        } catch (error) {
            console.error("Error reserving table:", error);
            showToast('Reservation Failed', 'Network error.');
        }
    };

    const handleCancelReservation = async (table, reservation, cancelDetails = {}) => {
        if (!table || !reservation) return;

        const targetId = table.tableId || table._id;
        const reservationId = reservation._id || reservation.id;
        const reason = String(cancelDetails.reason || '').trim();
        const note = String(cancelDetails.note || '').trim();
        const charge = Number(cancelDetails.charge || 0);

        if (!reason) {
            showToast('Cancellation Failed', 'Cancellation reason is required.');
            return;
        }

        try {
            const updatedReservations = (table.reservations || []).map(r => {
                const rowId = r._id || r.id;
                if (String(rowId) !== String(reservationId)) return r;

                return {
                    ...r,
                    name: reservation.name || reservation.guestName || r.name || r.guestName || '',
                    guestName: reservation.guestName || reservation.name || r.guestName || r.name || '',
                    phone: reservation.phone || r.phone || '',
                    status: 'Cancelled',
                    cancellationReason: reason,
                    cancellationNote: note,
                    cancellationCharge: Number.isFinite(charge) ? charge : 0,
                    cancelledAt: new Date().toISOString(),
                    cancelledBy: cancelDetails.source || 'Front Desk',
                };
            });

            const response = await apiCall(`/api/guest-meal/tables/${targetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservations: updatedReservations })
            });

            const data = await response.json();
            if (!data.success) {
                showToast('Cancellation Failed', data.message || 'Could not cancel reservation.');
                return;
            }

            const normalizedUpdatedTable = {
                ...data.data,
                tableId: data.data._id || data.data.tableId
            };

            setTables(prev => prev.map(t => (t.tableId || t._id) === targetId ? normalizedUpdatedTable : t));
            if (reservationListTable && (reservationListTable.tableId || reservationListTable._id) === targetId) {
                setReservationListTable(normalizedUpdatedTable);
            }

            const cancelledGuest = reservation.name || reservation.guestName || 'Guest';
            const chargeText = `${cs}${(Number.isFinite(charge) ? charge : 0).toFixed(2)}`;
            const notePart = note ? ` | Note: ${note}` : '';
            showCancelSuccessNote('Reservation Cancelled', `${cancelledGuest} | Charge: ${chargeText}${notePart}`);
        } catch (error) {
            console.error("Error cancelling reservation:", error);
            showToast('Cancellation Failed', 'Network error while cancelling reservation.');
        }
    };

    const handleCancelFromVerifyModal = () => {
        const inputDigits = normalizePhoneDigits(verifyPhoneInput);
        if (inputDigits.length !== 10) {
            showToast('Cancellation Failed', 'Enter valid 10 digit phone first.');
            return;
        }

        const verifyMatches = getVerifyMatches(verifyPhoneInput);
        const exactReservationMatches = verifyMatches.filter(
            (m) => m.type === 'reservation' && normalizePhoneDigits(m.phone) === inputDigits
        );
        const selectedReservationMatch = exactReservationMatches.find(
            (m) => getVerifyMatchKey(m) === selectedVerifyMatchKey
        );
        const matchedReservation = selectedReservationMatch || exactReservationMatches[0] || null;

        if (!matchedReservation) {
            showToast('Cancellation Failed', 'No reservation found for this phone.');
            return;
        }

        if (String(matchedReservation.status || '').toLowerCase() === 'cancelled') {
            showToast('Already Cancelled', 'This reservation is already cancelled.');
            return;
        }

        if (!matchedReservation.canVerify) {
            showToast('Cancellation Blocked', 'Only active or upcoming reservations can be cancelled from verify panel.');
            return;
        }

        const tableToCancel = tables.find((t) => (t.tableId || t._id) === matchedReservation.tableId);
        if (!tableToCancel) {
            showToast('Cancellation Failed', 'Table not found for selected reservation.');
            return;
        }

        const fullReservation = (tableToCancel.reservations || []).find(
            r => String(r._id || r.id) === String(matchedReservation._id || matchedReservation.id)
        ) || matchedReservation;

        setCancelPanelTarget({
            table: tableToCancel,
            reservation: fullReservation,
        });
        setCancelPanelForm({
            guestName: String(fullReservation.name || fullReservation.guestName || '').trim(),
            phone: String(fullReservation.phone || '').trim(),
            reason: 'Guest requested cancellation',
            charge: '0',
            note: ''
        });
        setShowCancelReservationPanel(true);
    };

    const submitCancelFromPanel = async () => {
        if (!cancelPanelTarget?.table || !cancelPanelTarget?.reservation) return;

        const reason = String(cancelPanelForm.reason || '').trim();
        const guestName = String(cancelPanelForm.guestName || '').trim();
        const phone = String(cancelPanelForm.phone || '').trim();
        const charge = Number(cancelPanelForm.charge || 0);

        if (!reason) {
            showToast('Cancellation Failed', 'Please enter cancellation reason.');
            return;
        }

        if (!guestName) {
            showToast('Cancellation Failed', 'Please enter guest name.');
            return;
        }

        if (!/^\d{10}$/.test(phone)) {
            showToast('Cancellation Failed', 'Please enter valid 10 digit number.');
            return;
        }

        if (!Number.isFinite(charge) || charge < 0) {
            showToast('Cancellation Failed', 'Cancellation charge should be zero or positive.');
            return;
        }

        const reservationWithContact = {
            ...cancelPanelTarget.reservation,
            name: guestName,
            guestName,
            phone
        };

        await handleCancelReservation(cancelPanelTarget.table, reservationWithContact, {
            reason,
            charge,
            note: String(cancelPanelForm.note || '').trim(),
            source: 'Verify Modal'
        });

        setShowCancelReservationPanel(false);
        setCancelPanelTarget(null);
    };





    // --- MERGE TABLE LOGIC ---
    const openMergeModal = (table) => {
        setMergeSourceTable(table);
        setMergeSourceGuests(table.guests || 0);
        setMergeSelectedTargetIds([]);
        setShowMergeModal(true);
    };

    const handleMergeSubmit = async () => {
        if (!mergeSourceTable || mergeSelectedTargetIds.length === 0) return;

        try {
            const response = await apiCall(`/api/guest-meal/tables/merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceTableId: mergeSourceTable.tableId,
                    targetTableIds: mergeSelectedTargetIds
                })
            });

            const data = await response.json();
            if (data.success) {
                // Refresh data
                fetchTables();
                setShowMergeModal(false);

                // Navigate to POS with the updated table info
                navigate('/admin/food-order', {
                    state: {
                        activeMenu: 'food-order',
                        orderMode: 'dinein',
                        room: {
                            roomNumber: data.data.tableName,
                            guestName: 'Merged Table',
                            guestPhone: '',
                            id: data.data._id
                        }
                    }
                });
            } else {
                throw new Error(data.message || "Failed to merge tables");
            }

        } catch (error) {
            console.error("Merge error:", error);
            showToast('Merge Failed', error.message || 'Failed to merge tables.');
        }
    };

    // --- CLOSE TABLE LOGIC ---
    const openCloseModal = (table) => {
        setCloseTableData(table);
        setShowCloseModal(true);
    };

    const handleCloseSubmit = async () => {
        if (!closeTableData) return;

        try {
            // Step 1: Close the order if it exists
            if (closeTableData.currentOrderId) {
                const orderId = closeTableData.currentOrderId._id || closeTableData.currentOrderId;
                try {
                    const closeOrderResponse = await apiCall(`/api/guest-meal/orders/${orderId}/close`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const closeOrderData = await closeOrderResponse.json();
                    if (!closeOrderData.success) {
                        console.warn('Failed to close order:', closeOrderData.message);
                    }
                } catch (orderError) {
                    console.error('Error closing order:', orderError);
                    // Continue with table closure even if order close fails
                }
            }

            // Handle Split Tables: If it's a split table, we need to close the PARENT table in the DB
            // and then refresh the UI to show the parent table again instead of its splits.
            if (String(closeTableData.tableId).startsWith('SPLIT-') && closeTableData.parentTableId) {
                const response = await apiCall(`/api/guest-meal/tables/${closeTableData.parentTableId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'Available',
                        guests: 0,
                        currentOrderId: null,
                        runningOrderAmount: 0,
                        orderStartTime: null
                    })
                });

                if (response.ok) {
                    fetchTables();
                    setShowCloseModal(false);
                    showToast('Success', 'Table closed successfully');
                    return;
                }
            }

            // If the table is merged, we should release it back to its original state
            if (closeTableData.mergedTableIds && closeTableData.mergedTableIds.length > 0) {
                await apiCall(`/api/guest-meal/tables/${closeTableData.tableId}/release`, {
                    method: 'POST'
                });
            }

            // Determine handling based on reservation
            let updatePayload = {
                status: 'Available',
                guests: 0,
                currentOrderId: null,
                runningOrderAmount: 0,
                orderStartTime: null
            };

            // Smart Reservation Handling
            if (closeTableData.reservation && closeTableData.reservation.startTime && closeTableData.reservation.endTime) {
                const currentVal = getNowContext().minutes;

                const [startH, startM] = closeTableData.reservation.startTime.split(':').map(Number);
                const [endH, endM] = closeTableData.reservation.endTime.split(':').map(Number);

                const startVal = startH * 60 + startM;
                const endVal = endH * 60 + endM;

                if (currentVal >= endVal) {
                    updatePayload.reservation = null;
                } else if (currentVal < startVal) {
                    // Future reservation - keep it
                } else {
                    updatePayload.reservation = null;
                }
            } else {
                updatePayload.reservation = null;
            }

            const response = await apiCall(`/api/guest-meal/tables/${closeTableData.tableId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });
            const data = await response.json();
            if (data.success) {
                fetchTables(); // Refresh all tables to see unmerged ones
                setShowCloseModal(false);
                showToast('Success', 'Table closed successfully');
            } else {
                showToast('Close Failed', data.message || 'Failed to close table.');
            }
        } catch (error) {
            console.error(error);
            showToast('Close Failed', error.message || 'Error closing table.');
        }
    };

    const handleReleaseTable = async (table) => {
        try {
            const response = await apiCall(`/api/guest-meal/tables/${table.tableId}/release`, {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                fetchTables();
            } else {
                showToast('Release Failed', data.message || 'Failed to release table.');
            }
        } catch (error) {
            console.error("Error releasing table:", error);
            showToast('Release Failed', 'Network error.');
        }
    };



    // Auto-update reservation status based on time
    // Check for reservations (Run every minute)
    useEffect(() => {
        const checkReservations = () => {
            const nowCtx = getNowContext();
            const currentVal = nowCtx.minutes;
            const todayStr = nowCtx.dateISO;

            setTables(prevTables => {
                return prevTables.map(t => {
                    // Skip if Running or Billed (Active Session)
                    if (t.status === 'Running' || t.status === 'Billed') return t;

                    const reservations = (t.reservations || []).filter(res => {
                        const timeline = getReservationTimelineMeta(res);
                        return !timeline.isCancelled && !timeline.isExpiredFromView;
                    });

                    // Check if ANY reservation is active NOW
                    let isActive = false;
                    let activeReservation = null;

                    for (const res of reservations) {
                        // Check Date (assuming format YYYY-MM-DD or ignoring date if simple time)
                        // If no date, assume today. If date exists, check it.
                        if (res.date && res.date !== todayStr) continue;

                        const [startH, startM] = res.startTime.split(':').map(Number);
                        const [endH, endM] = res.endTime.split(':').map(Number);
                        const startVal = startH * 60 + startM;
                        const endVal = endH * 60 + endM;

                        if (currentVal >= startVal && currentVal < endVal) {
                            isActive = true;
                            activeReservation = res;
                            break;
                        }
                    }

                    if (isActive) {
                        if (t.status !== 'Reserved') return { ...t, status: 'Reserved', reservation: activeReservation };
                    } else {
                        // If logic dictates it should be Available (and currently Reserved for past slot)
                        if (t.status === 'Reserved') return { ...t, status: 'Available', reservation: null };
                    }
                    return t;
                });
            });
        };

        const interval = setInterval(checkReservations, 60000); // Check every minute
        checkReservations(); // Initial check

        return () => clearInterval(interval);
    }, [getNowContext, getReservationTimelineMeta]);



    // Filter Logic
    useEffect(() => {
        const nowCtx = getNowContext();
        const todayStr = nowCtx.dateISO;
        const currentVal = nowCtx.minutes;
        const appliedFilterMinutes = timeToMinutes(toTime24(appliedTime));

        // Create working copy with dynamic status calculation and exclude merged templates
        let tableList = tables.filter(t => !t.tableName.startsWith('_MERGED_')).map(table => {
            // Check for current active reservation
            const activeRes = (table.reservations || []).find(res => {
                const timeline = getReservationTimelineMeta(res);
                if (timeline.isCancelled || timeline.isExpiredFromView) return false;
                if (res.date !== todayStr) return false;
                const [sH, sM] = res.startTime.split(':').map(Number);
                const [eH, eM] = res.endTime.split(':').map(Number);
                const startVal = sH * 60 + sM;
                const endVal = eH * 60 + eM;
                return currentVal >= startVal && currentVal < endVal;
            });

            let calculatedStatus = table.status;
            // Auto-promote to Reserved if there's an active reservation and table is Available
            if (activeRes && (table.status === 'Available' || table.status === 'Reserved')) {
                calculatedStatus = 'Reserved';
            }

            return { ...table, calculatedStatus, activeReservation: activeRes };
        });

        // Apply Status Filter using calculatedStatus
        if (statusFilter !== 'All') {
            tableList = tableList.filter(table => table.calculatedStatus === statusFilter);
        }

        // Filter by Type
        if (typeFilter !== 'All') {
            tableList = tableList.filter(table => table.type === typeFilter);
        }

        // Filter by Location
        if (locationFilter !== 'All') {
            tableList = tableList.filter(table => (table.location || 'Main Hall') === locationFilter);
        }

        // --- Time Availability Filter Logic ---
        if (isTimeFilterActive) {
            const isSelectedTimeNearNow =
                appliedDate === todayStr &&
                appliedFilterMinutes !== null &&
                Math.abs(appliedFilterMinutes - currentVal) < 30;

            tableList = tableList.filter(table => {
                const hasConflict = (table.reservations || []).some(res => {
                    const timeline = getReservationTimelineMeta(res);
                    if (timeline.isCancelled || timeline.isExpiredFromView) return false;
                    if (res.date !== appliedDate) return false;
                    const [startH, startM] = res.startTime.split(':').map(Number);
                    const [endH, endM] = res.endTime.split(':').map(Number);
                    const startTotal = startH * 60 + startM;
                    const endTotal = endH * 60 + endM;
                    const filterTotal = appliedFilterMinutes;
                    if (filterTotal === null) return false;
                    return filterTotal >= startTotal && filterTotal < endTotal;
                });

                if (hasConflict) return false;
                if (isSelectedTimeNearNow && (table.status === 'Running' || table.status === 'Billed')) return false;
                return true;
            });
        }

        // Search Table or User
        if (searchQuery) {
            tableList = tableList.filter(table => {
                const query = searchQuery.toLowerCase();
                const tableMatch = table.tableName.toLowerCase().includes(query);
                const guestMatch = table.reservation?.name?.toLowerCase().includes(query);
                const phoneMatch = table.reservation?.phone?.includes(searchQuery);
                const allReservationsMatch = table.reservations?.some(r =>
                    r.name?.toLowerCase().includes(query) ||
                    r.phone?.includes(searchQuery)
                );
                return tableMatch || guestMatch || phoneMatch || allReservationsMatch;
            });
        }
        setFilteredTables(sortTablesForDisplay(tableList));

        // Update stats
        const upcomingCount = tables.reduce((count, table) => {
            const todayRes = (table.reservations || []).filter(r => r.date === todayStr && String(r.status || '').toLowerCase() !== 'cancelled');
            // Count reservations that haven't happened yet (start time > now)
            return count + todayRes.filter(r => {
                const [h, m] = r.startTime.split(':').map(Number);
                return (h * 60 + m) > currentVal;
            }).length;
        }, 0);

        // Combined Revenue: Backend (Closed) + Current Active Table Total
        const activeRevenue = tables.reduce((acc, t) => acc + (t.amount || 0), 0);

        // Calculate availability for the stats based on the APPLIED time
        let availableCount = tables.filter(t => t.status === 'Available').length;

        if (isTimeFilterActive) {
            const isSelectedTimeNearNow =
                appliedDate === todayStr &&
                appliedFilterMinutes !== null &&
                Math.abs(appliedFilterMinutes - currentVal) < 30;

            availableCount = tables.filter(table => {
                const hasConflict = (table.reservations || []).some(res => {
                    const timeline = getReservationTimelineMeta(res);
                    if (timeline.isCancelled || timeline.isExpiredFromView) return false;
                    if (res.date !== appliedDate) return false;
                    const [startH, startM] = res.startTime.split(':').map(Number);
                    const [endH, endM] = res.endTime.split(':').map(Number);
                    const startTotal = startH * 60 + startM;
                    const endTotal = endH * 60 + endM;
                    const filterTotal = appliedFilterMinutes;
                    if (filterTotal === null) return false;
                    return filterTotal >= startTotal && filterTotal < endTotal;
                });
                if (hasConflict) return false;
                if (isSelectedTimeNearNow && (table.status === 'Running' || table.status === 'Billed')) return false;
                return true;
            }).length;
        }

        setStats(prev => ({
            ...prev,
            total: tables.length,
            available: availableCount,
            running: tables.filter(t => t.status === 'Running').length,
            billed: tables.filter(t => t.status === 'Billed').length,
            reserved: tableList.filter(t => t.calculatedStatus === 'Reserved').length,
            upcomingCount: upcomingCount,
            revenue: prev.revenue
        }));
    }, [statusFilter, typeFilter, locationFilter, searchQuery, tables, appliedDate, appliedTime, isTimeFilterActive, getNowContext, timeToMinutes, toTime24, getReservationTimelineMeta, sortTablesForDisplay]);

    const formatDuration = (minutes) => {
        if (minutes === 0) return '--';
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
    };

    const handleTableClick = async (table) => {
        if (!settings.posEnabled) {
            showToast('POS Disabled', 'Enable POS from Company Settings to create orders.');
            return;
        }
        // If table is Available, make it Running (Check-in / Walk-in)
        // If table is Reserved, check time window
        if (table.status === 'Reserved') {
            if (table.reservation && table.reservation.startTime && table.reservation.endTime) {
                const currentVal = getNowContext().minutes;
                const [startH, startM] = table.reservation.startTime.split(':').map(Number);
                const [endH, endM] = table.reservation.endTime.split(':').map(Number);
                const startVal = startH * 60 + startM;
                const endVal = endH * 60 + endM;

                if ((currentVal >= startVal && currentVal < endVal) || table.isReservationHold) {
                    openVerifyModal(table);
                    return;
                }
            }
        }

        // Determine guest details if they exist
        let guestName = 'Walk-in';
        let guestPhone = '';

        if (table.reservation) {
            guestName = table.reservation.name || 'Walk-in';
            guestPhone = table.reservation.phone || '';
        } else if (table.guestName) {
            guestName = table.guestName;
            guestPhone = table.guestPhone || '';
        }

        if (table.status === 'Occupied') {
            try {
                // Update status to Running via API immediately
                await apiCall(`/api/guest-meal/tables/${table.tableId || table._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'Running' })
                });

                // Update local state for immediate feedback
                setTables(prev => prev.map(t => (t.tableId === table.tableId || t._id === table._id) ? { ...t, status: 'Running' } : t));
            } catch (error) {
                console.error("Error updating table status:", error);
            }
        }

        // Navigate to food order
        navigate('/admin/food-order', {
            state: {
                activeMenu: 'food-order',
                orderMode: 'dinein', // Lock to Dine In only
                source: 'table-order', // Indicate it's from table management
                room: {
                    roomNumber: table.tableName,
                    guestName: guestName,
                    guestPhone: guestPhone,
                    id: table.tableId || table._id,
                    orderId: table.currentOrderId
                }
            }
        });
    };

    const handleAddTableType = () => {
        if (!newTableType.trim()) return;
        const type = newTableType.trim();
        const existingType = findCaseInsensitiveMatch(tableTypes, type);
        const selectedType = existingType || type;

        if (!existingType) {
            setTableTypes(prev => [...prev, type]);
        }
        setNewTableData(prev => ({ ...prev, type: selectedType }));
        selectedTypeRef.current = selectedType;

        setTableTypeDeleteWarning(null);
        setIsAddingTableType(false);
        setNewTableType('');
    };

    const handleAddTableLocation = () => {
        if (!newTableLocation.trim()) return;
        const location = newTableLocation.trim();
        const existingLocation = findCaseInsensitiveMatch(tableLocations, location);
        const selectedLocation = existingLocation || location;

        if (!existingLocation) {
            setTableLocations(prev => [...prev, location]);
        }
        setNewTableData(prev => ({ ...prev, location: selectedLocation }));
        selectedLocationRef.current = selectedLocation;

        setTableLocationDeleteWarning(null);
        setIsAddingTableLocation(false);
        setNewTableLocation('');
    };

    const handleCreateTable = async () => {
        if (!newTableData.tableName || !newTableData.capacity) return;

        try {
            const normalizedType = (newTableData.type || '').trim() || 'General';
            const selectedType = String(selectedTypeRef.current || newTableData.type || '').trim() || 'General';
            const draftLocation = isAddingTableLocation
                ? newTableLocation
                : (selectedLocationRef.current || newTableData.location);
            const normalizedLocation = String(draftLocation || '').trim() || 'Main Hall';

            if (!newTableData.location && normalizedLocation && normalizedLocation !== 'Main Hall') {
                setNewTableData(prev => ({ ...prev, location: normalizedLocation }));
            }

            const tablePayload = {
                tableName: (newTableData.tableName || '').trim(),
                capacity: parseInt(newTableData.capacity),
                type: selectedType,
                location: normalizedLocation
            };

            const response = await apiCall(
                isEditTableMode && editingTableId
                    ? `${API_URL}/api/guest-meal/tables/${editingTableId}`
                    : `${API_URL}/api/guest-meal/tables`,
                {
                    method: isEditTableMode ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tablePayload)
                });

            const data = await response.json();

            if (data.success) {
                // Determine if we need to add the type to the list (handled by state visually, but backend saves it)
                if (!findCaseInsensitiveMatch(tableTypes, selectedType)) {
                    setTableTypes(prev => [...prev, selectedType]);
                }
                if (!findCaseInsensitiveMatch(tableLocations, normalizedLocation)) {
                    setTableLocations(prev => [...prev, normalizedLocation]);
                }

                if (locationFilter !== 'All' && locationFilter !== normalizedLocation) {
                    setLocationFilter('All');
                }

                // Refresh tables from backend to ensure consistent state
                fetchTables();

                showToast(
                    isEditTableMode ? 'Table Updated' : 'Table Created',
                    isEditTableMode ? `${newTableData.tableName} updated successfully.` : `${newTableData.tableName} added successfully.`
                );

                closeTableFormModal();
            } else {
                showToast(
                    isEditTableMode ? 'Update Failed' : 'Create Failed',
                    data.message || 'Unknown error'
                );
            }
        } catch (error) {
            console.error(`Error ${isEditTableMode ? 'updating' : 'creating'} table:`, error);
            showToast(
                isEditTableMode ? 'Update Failed' : 'Create Failed',
                'Network error or server is down'
            );
        }
    };

    const todayDateKey = getCurrentDateISO();
    const cancellationRevenueToday = tables.reduce((sum, table) => {
        const tableCancellationRevenue = (table.reservations || []).reduce((inner, reservation) => {
            if (String(reservation.status || '').toLowerCase() !== 'cancelled') return inner;

            const charge = Number(reservation.cancellationCharge || 0);
            if (!Number.isFinite(charge) || charge <= 0) return inner;

            let isTodayCancellation = false;
            if (reservation.cancelledAt) {
                const cancelledAt = new Date(reservation.cancelledAt);
                if (!Number.isNaN(cancelledAt.getTime())) {
                    const key = `${cancelledAt.getFullYear()}-${String(cancelledAt.getMonth() + 1).padStart(2, '0')}-${String(cancelledAt.getDate()).padStart(2, '0')}`;
                    isTodayCancellation = key === todayDateKey;
                }
            }

            if (!isTodayCancellation && reservation.date === todayDateKey) {
                isTodayCancellation = true;
            }

            return isTodayCancellation ? inner + charge : inner;
        }, 0);

        return sum + tableCancellationRevenue;
    }, 0);

    const activeTableRevenue = tables.reduce((acc, table) => acc + (Number(table.amount) || 0), 0);
    const revenueTodayTotal = Math.floor((Number(stats.revenue) || 0) + activeTableRevenue + cancellationRevenueToday);

    return (
        <div className="gms-wrapper">
            {/* Header / Stats */}
            <div className="gms-header">
                <div className="gms-header-top">
                    <div className="gms-header-content">
                        <h1 className="gms-page-title">Dining Dashboard</h1>
                        <p className="gms-subtitle">Manage your restaurant tables and reservations</p>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                        <OrderNotificationPanel scope="table-view" />
                        <button
                            className="btn btn-primary add-table-btn-gms"
                            onClick={openCreateTableModal}
                        >
                            + ADD TABLE
                        </button>
                    </div>
                </div>

                <div className="gms-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '12px', border: '1px solid #dcfce7' }}>
                        <div style={{ fontSize: '0.875rem', color: '#166534', fontWeight: '600' }}>Available Tables</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', marginTop: '8px' }}>{stats.available}</div>
                    </div>
                    <div style={{ background: '#fef2f2', padding: '20px', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                        <div style={{ fontSize: '0.875rem', color: '#991b1b', fontWeight: '600' }}>Occupied (Running)</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', marginTop: '8px' }}>{stats.running}</div>
                    </div>
                    <div style={{ background: '#fff7ed', padding: '20px', borderRadius: '12px', border: '1px solid #ffedd5' }}>
                        <div style={{ fontSize: '0.875rem', color: '#9a3412', fontWeight: '600' }}>Upcoming Reservations</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', marginTop: '8px' }}>{stats.upcomingCount}</div>
                    </div>
                    <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '12px', border: '1px solid #dbeafe' }}>
                        <div style={{ fontSize: '0.875rem', color: '#1e40af', fontWeight: '600' }}>Revenue Today</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', marginTop: '8px' }}>{cs}{revenueTodayTotal}</div>
                        {cancellationRevenueToday > 0 && (
                            <div style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: '700', marginTop: '4px' }}>
                                includes cancellation: +{cs}{cancellationRevenueToday.toFixed(2)}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="gms-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '20px' }}>
                <div className="gms-time-calendar-wrapper" style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, maxWidth: '600px' }}>
                    <div style={{ position: 'relative', flex: '1' }}>
                        <input
                            type="date"
                            value={filterDate}
                            min={getCurrentDateISO()}
                            onChange={(e) => {
                                const selected = e.target.value;
                                setFilterDate(selected);
                                // If today is selected, ensure time isn't in the past
                                const nowCtx = getNowContext();
                                if (selected === nowCtx.dateISO) {
                                    if ((timeToMinutes(filterTime) ?? 0) < nowCtx.minutes) {
                                        setFilterTime(nowCtx.time24);
                                    }
                                }
                            }}
                            style={{
                                width: '100%',
                                padding: '12px 16px 12px 40px',
                                borderRadius: '12px',
                                border: '2px solid #e5e7eb',
                                outline: 'none',
                                background: '#fff',
                                fontWeight: '700',
                                color: '#111827'
                            }}
                        />
                        <span style={{ position: 'absolute', left: '14px', top: '12px', color: '#E31E24' }}>📅</span>
                    </div>

                    <div style={{ position: 'relative', flex: '0.6' }}>
                        <input
                            type="time"
                            value={filterTime}
                            onChange={(e) => {
                                const selectedTime = e.target.value;
                                const nowCtx = getNowContext();
                                if (filterDate === nowCtx.dateISO) {
                                    if ((timeToMinutes(selectedTime) ?? 0) < nowCtx.minutes) {
                                        showToast('Invalid Time', 'You cannot select a past time for today.');
                                        setFilterTime(nowCtx.time24);
                                        return;
                                    }
                                }
                                setFilterTime(selectedTime);
                            }}
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 40px',
                                borderRadius: '12px',
                                border: '2px solid #e5e7eb',
                                outline: 'none',
                                background: '#fff',
                                fontWeight: '700',
                                color: '#111827'
                            }}
                        />
                        <span style={{ position: 'absolute', left: '14px', top: '12px', color: '#E31E24' }}>⏰</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => {
                                setAppliedDate(filterDate);
                                setAppliedTime(filterTime);
                                setIsTimeFilterActive(true);
                            }}
                            style={{
                                padding: '12px 24px',
                                background: '#E31E24',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontWeight: '800',
                                boxShadow: '0 4px 10px rgba(220, 38, 38, 0.2)'
                            }}
                        >Apply Filter</button>

                        <button
                            onClick={() => {
                                const nowCtx = getNowContext();
                                setFilterDate(nowCtx.dateISO);
                                setFilterTime(nowCtx.time24);
                                setAppliedDate(nowCtx.dateISO);
                                setAppliedTime(nowCtx.time24);
                                setStatusFilter('All');
                                setTypeFilter('All');
                                setLocationFilter('All');
                                setShowTypeFilterDropdown(false);
                                setShowLocationFilterDropdown(false);
                                setSearchQuery('');
                                setIsTimeFilterActive(false);
                            }}
                            style={{
                                padding: '12px',
                                background: '#fef2f2',
                                color: '#E31E24',
                                border: '1px solid #fee2e2',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontWeight: '800'
                            }}
                            title="Reset to Now"
                        >⚡</button>
                    </div>

                </div>

                <div className="gms-verify-quick" style={{ flex: '0 0 auto' }}>
                    <button
                        onClick={() => openVerifyModal()}
                        style={{
                            padding: '12px 24px',
                            background: '#fef2f2',
                            color: '#E31E24',
                            border: '2px solid #fee2e2',
                            borderRadius: '12px',
                            fontWeight: '800',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.1)'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <span style={{ fontSize: '1.1rem' }}>🔍</span> Verify User
                    </button>
                </div>

                <div className="gms-filters" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {['All', 'Available', 'Running', 'Billed', 'Reserved'].map(status => (
                        <button
                            key={status}
                            onClick={() => {
                                setStatusFilter(status);
                                setShowTypeFilterDropdown(false);
                                setShowLocationFilterDropdown(false);
                            }}
                            style={{
                                padding: '8px 16px', borderRadius: '10px', border: '1px solid #e5e7eb',
                                background: statusFilter === status ? '#E31E24' : '#fff',
                                color: statusFilter === status ? '#fff' : '#6b7280',
                                fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s',
                                fontSize: '0.85rem'
                            }}
                        >
                            {status}
                        </button>
                    ))}
                    <div className="gms-filter-separator" style={{ width: '1px', background: '#e5e7eb', height: '24px', margin: '0 8px' }}></div>
                    <div className="gms-filter-dropdown" ref={typeFilterDropdownRef}>
                        <button
                            type="button"
                            className="gms-filter-trigger"
                            onClick={() => {
                                setShowTypeFilterDropdown(prev => !prev);
                                setShowLocationFilterDropdown(false);
                            }}
                            aria-expanded={showTypeFilterDropdown}
                        >
                            <span>{typeFilter === 'All' ? 'All Types' : typeFilter}</span>
                            <span className={`gms-filter-arrow ${showTypeFilterDropdown ? 'open' : ''}`}>▼</span>
                        </button>
                        {showTypeFilterDropdown && (
                            <div className="gms-filter-menu">
                                <button
                                    type="button"
                                    className={`gms-filter-option ${typeFilter === 'All' ? 'active' : ''}`}
                                    onClick={() => {
                                        setTypeFilter('All');
                                        setShowTypeFilterDropdown(false);
                                    }}
                                >
                                    All Types
                                </button>
                                {tableTypes.map(type => (
                                    <button
                                        type="button"
                                        key={type}
                                        className={`gms-filter-option ${typeFilter === type ? 'active' : ''}`}
                                        onClick={() => {
                                            setTypeFilter(type);
                                            setShowTypeFilterDropdown(false);
                                        }}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="gms-filter-dropdown" ref={locationFilterDropdownRef}>
                        <button
                            type="button"
                            className="gms-filter-trigger"
                            onClick={() => {
                                setShowLocationFilterDropdown(prev => !prev);
                                setShowTypeFilterDropdown(false);
                            }}
                            aria-expanded={showLocationFilterDropdown}
                        >
                            <span>{locationFilter === 'All' ? 'All Locations' : locationFilter}</span>
                            <span className={`gms-filter-arrow ${showLocationFilterDropdown ? 'open' : ''}`}>▼</span>
                        </button>
                        {showLocationFilterDropdown && (
                            <div className="gms-filter-menu">
                                <button
                                    type="button"
                                    className={`gms-filter-option ${locationFilter === 'All' ? 'active' : ''}`}
                                    onClick={() => {
                                        setLocationFilter('All');
                                        setShowLocationFilterDropdown(false);
                                    }}
                                >
                                    All Locations
                                </button>
                                {[...new Set([
                                    ...tableLocations,
                                    ...tables.map(t => t.location || 'Main Hall')
                                ])]
                                    .filter(loc => String(loc || '').trim())
                                    .map(loc => (
                                        <button
                                            type="button"
                                            key={loc}
                                            className={`gms-filter-option ${locationFilter === loc ? 'active' : ''}`}
                                            onClick={() => {
                                                setLocationFilter(loc);
                                                setShowLocationFilterDropdown(false);
                                            }}
                                        >
                                            {loc}
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>
            </div >

            {/* Table Grid */}
            {
                filteredTables.length === 0 ? (
                    <div className="gms-empty">
                        <div className="empty-illustration">📭</div>
                        <p className="empty-text">No tables match your filter</p>
                    </div>
                ) : (
                    <div className="gms-grid">
                        {filteredTables.map((table) => (
                            <TableCard
                                key={table.tableId}
                                table={table}
                                formatDuration={formatDuration}
                                onMenuAction={handleMenuAction}
                                onDeleteTable={handleDeleteTable}
                                onCardClick={() => handleTableClick(table)}
                                onSendToCashier={handleSendToCashier}
                            />
                        ))}
                    </div>
                )
            }

            {/* Add Table Modal (Premium Drawer Style) */}
            {showAddTableModal && (
                <div className="add-payment-overlay" onClick={closeTableFormModal}>
                    <div className="add-payment-modal add-table-premium" onClick={e => e.stopPropagation()}>
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="3" y1="9" x2="21" y2="9"></line>
                                    <line x1="9" y1="21" x2="9" y2="9"></line>
                                </svg>
                            </div>
                            <div className="header-text">
                                <h3>{isEditTableMode ? 'Edit Table' : 'Add New Table'}</h3>
                                <span>Restaurant Setup</span>
                            </div>
                            <button className="premium-close-btn" onClick={closeTableFormModal}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="add-payment-body">
                            {/* Table Name */}
                            <div className="payment-field-group">
                                <label className="field-label-premium">Table Name / Number</label>
                                <div className="input-with-icon-premium">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                    <input
                                        type="text"
                                        className="premium-input-field"
                                        placeholder="e.g., T15, VIP-1"
                                        value={newTableData.tableName}
                                        onChange={e => patchNewTableData({ tableName: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Capacity */}
                            <div className="payment-field-group">
                                <label className="field-label-premium">Table Capacity</label>
                                <div className="input-with-icon-premium">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                    <input
                                        type="number"
                                        className="premium-input-field"
                                        placeholder="Number of seats"
                                        min="1"
                                        value={newTableData.capacity}
                                        onChange={e => patchNewTableData({ capacity: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Table Type */}
                            <div className="payment-field-group">
                                <label className="field-label-premium">Environment / Type</label>
                                <div className="type-selection-container">
                                    {!isAddingTableType ? (
                                        <div className="custom-premium-select" ref={typeDropdownRef}>
                                            <div
                                                className={`select-trigger-premium ${showTypeDropdown ? 'active' : ''}`}
                                                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                                            >
                                                <div className="trigger-content">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                                    <span>{newTableData.type || 'Select Table Type'}</span>
                                                </div>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showTypeDropdown ? 'rotate(180deg)' : 'none', transition: '0.3s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            </div>

                                            {showTypeDropdown && (
                                                <div className="select-dropdown-options-premium">
                                                    {tableTypes.map(type => (
                                                        <div
                                                            key={type}
                                                            className={`select-option-premium ${newTableData.type === type ? 'selected' : ''}`}
                                                            onClick={() => {
                                                                patchNewTableData({ type });
                                                                selectedTypeRef.current = type;
                                                                setShowTypeDropdown(false);
                                                            }}
                                                        >
                                                            <span>{type}</span>
                                                            <div className="type-delete-wrap" onClick={(e) => e.stopPropagation()}>
                                                                {tableTypeDeleteWarning === type && (
                                                                    <div className="type-delete-warning-inline">
                                                                        <span>Are you sure want to delete?</span>
                                                                        <div className="type-delete-warning-actions">
                                                                            <button
                                                                                type="button"
                                                                                className="type-delete-warning-yes"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setTableTypes(tableTypes.filter(t => t !== type));
                                                                                    if (newTableData.type === type) {
                                                                                        patchNewTableData({ type: '' });
                                                                                    }
                                                                                    setTableTypeDeleteWarning(null);
                                                                                }}
                                                                                title="Yes"
                                                                            >
                                                                                Yes
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="type-delete-warning-no"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setTableTypeDeleteWarning(null);
                                                                                }}
                                                                                title="No"
                                                                            >
                                                                                No
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div
                                                                    className="type-delete-small"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setTableTypeDeleteWarning(type);
                                                                    }}
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button
                                                        className="add-new-type-action-btn"
                                                        onClick={() => {
                                                            setShowLocationDropdown(false);
                                                            setIsAddingTableType(true);
                                                        }}
                                                    >
                                                        + Create New Type
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="new-type-input-group-premium">
                                            <input
                                                type="text"
                                                className="premium-input-field"
                                                placeholder="New type name..."
                                                value={newTableType}
                                                onChange={e => setNewTableType(e.target.value)}
                                                autoFocus
                                            />
                                            <button className="action-btn-p confirm" onClick={handleAddTableType}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            </button>
                                            <button className="action-btn-p cancel" onClick={() => setIsAddingTableType(false)}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Location */}
                            <div className="payment-field-group">
                                <label className="field-label-premium">Location</label>
                                <div className="type-selection-container">
                                    {!isAddingTableLocation ? (
                                        <div className="custom-premium-select" ref={locationDropdownRef}>
                                            <div
                                                className={`select-trigger-premium ${showLocationDropdown ? 'active' : ''}`}
                                                onClick={() => {
                                                    setShowTypeDropdown(false);
                                                    setShowLocationDropdown(!showLocationDropdown);
                                                }}
                                            >
                                                <div className="trigger-content">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                                    <span>{newTableData.location || 'Select Location'}</span>
                                                </div>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showLocationDropdown ? 'rotate(180deg)' : 'none', transition: '0.3s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            </div>

                                            {showLocationDropdown && (
                                                <div className="select-dropdown-options-premium">
                                                    {tableLocations.map(location => (
                                                        <div
                                                            key={location}
                                                            className={`select-option-premium ${newTableData.location === location ? 'selected' : ''}`}
                                                            onClick={() => {
                                                                patchNewTableData({ location });
                                                                selectedLocationRef.current = location;
                                                                setShowLocationDropdown(false);
                                                            }}
                                                        >
                                                            <span>{location}</span>
                                                            <div className="type-delete-wrap" onClick={(e) => e.stopPropagation()}>
                                                                {tableLocationDeleteWarning === location && (
                                                                    <div className="type-delete-warning-inline">
                                                                        <span>Are you sure want to delete?</span>
                                                                        <div className="type-delete-warning-actions">
                                                                            <button
                                                                                type="button"
                                                                                className="type-delete-warning-yes"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setTableLocations(tableLocations.filter(loc => loc !== location));
                                                                                    if (newTableData.location === location) {
                                                                                        patchNewTableData({ location: '' });
                                                                                    }
                                                                                    setTableLocationDeleteWarning(null);
                                                                                }}
                                                                                title="Yes"
                                                                            >
                                                                                Yes
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="type-delete-warning-no"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setTableLocationDeleteWarning(null);
                                                                                }}
                                                                                title="No"
                                                                            >
                                                                                No
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div
                                                                    className="type-delete-small"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setTableLocationDeleteWarning(location);
                                                                    }}
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button
                                                        className="add-new-type-action-btn"
                                                        onClick={() => {
                                                            setShowTypeDropdown(false);
                                                            setIsAddingTableLocation(true);
                                                        }}
                                                    >
                                                        + Create New Location
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="new-type-input-group-premium">
                                            <input
                                                type="text"
                                                className="premium-input-field"
                                                placeholder="New location name..."
                                                value={newTableLocation}
                                                onChange={e => setNewTableLocation(e.target.value)}
                                                autoFocus
                                            />
                                            <button className="action-btn-p confirm" onClick={handleAddTableLocation}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            </button>
                                            <button className="action-btn-p cancel" onClick={() => setIsAddingTableLocation(false)}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Help Card */}
                            <div className="premium-help-card">
                                <div className="help-icon">💡</div>
                                <div className="help-content">
                                    <h4>Design Tip</h4>
                                    <p>Unique table names help waiters identify zones faster. (e.g., Garden-1, Roof-2)</p>
                                </div>
                            </div>
                        </div>

                        <div className="payment-modal-footer">
                            <button className="btn-secondary" onClick={closeTableFormModal}>
                                CANCEL
                            </button>
                            <button className="btn-primary" onClick={handleCreateTable}>
                                {isEditTableMode ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                )}
                                {isEditTableMode ? 'SAVE TABLE' : 'CREATE TABLE'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Walk-in Modal */}
            {showWalkInModal && walkInTargetTable && (
                <div className="add-payment-overlay" onClick={closeWalkInModal}>
                    <div className="add-payment-modal" onClick={(e) => e.stopPropagation()} style={{ width: '420px' }}>
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </div>
                            <div className="header-text">
                                <h3>Open Walk-in Table</h3>
                                <span>{walkInTargetTable.tableName}</span>
                            </div>
                            <button className="premium-close-btn" onClick={closeWalkInModal}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="add-payment-body">
                            <div style={{ padding: '14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', marginBottom: '18px', color: '#991b1b', fontWeight: '600' }}>
                                Start a walk-in order for this table by entering guest count.
                            </div>

                            <div className="payment-field-group" style={{ marginBottom: 0 }}>
                                <label className="field-label-premium">GUEST COUNT</label>
                                <div className="input-with-icon-premium">
                                    <span className="field-icon">👥</span>
                                    <input
                                        type="number"
                                        min="1"
                                        className="premium-input-field"
                                        value={walkInGuestCount}
                                        onChange={(e) => setWalkInGuestCount(e.target.value.replace(/[^0-9]/g, ''))}
                                        onKeyDown={(e) => {
                                            if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                                                e.preventDefault();
                                            }
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleWalkInSubmit();
                                            }
                                        }}
                                        autoFocus
                                    />
                                </div>
                                <p className="hint-text-premium">Default is table capacity: {walkInTargetTable.capacity || 1}</p>
                            </div>
                        </div>

                        <div className="payment-modal-footer">
                            <button className="btn-secondary" onClick={closeWalkInModal}>CANCEL</button>
                            <button className="btn-primary" onClick={handleWalkInSubmit}>START WALK-IN</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Split Table Modal */}
            {
                showSplitModal && (
                    <div className="add-payment-overlay" onClick={() => setShowSplitModal(false)}>
                        <div className="add-payment-modal split-table-premium" onClick={(e) => e.stopPropagation()}>
                            {/* Modern Premium Header */}
                            <div className="premium-payment-header">
                                <div className="header-icon-wrap">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"></path></svg>
                                </div>
                                <div className="header-text">
                                    <h3>Split Table - {tables.find(t => t.tableId === splitTableId)?.tableName}</h3>
                                    <span>TABLE CONFIGURATION</span>
                                </div>
                                <button className="premium-close-btn" onClick={() => setShowSplitModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <div className="add-payment-body">
                                {/* Capacity Summary Info */}
                                <div className="split-info-card">
                                    <div className="info-item">
                                        <span className="label">Total Capacity</span>
                                        <span className="value">{tables.find(t => t.tableId === splitTableId)?.capacity || 0}</span>
                                    </div>
                                    <div className="info-divider"></div>
                                    <div className="info-item">
                                        <span className="label">Current Guests</span>
                                        <span className="value">{tables.find(t => t.tableId === splitTableId)?.guests || 0}</span>
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
                                <button className="btn-primary" onClick={handleSplitSubmit}>
                                    <span>CONFIRM SPLIT</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }





            {/* Move Guest Modal */}
            {
                showMoveModal && moveSourceTable && (
                    <div className="add-payment-overlay" onClick={() => setShowMoveModal(false)}>
                        <div className="add-payment-modal" onClick={(e) => e.stopPropagation()} style={{ width: '420px' }}>
                            {/* Premium Header */}
                            <div className="premium-payment-header">
                                <div className="header-icon-wrap">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
                                </div>
                                <div className="header-text">
                                    <h3>Move Guests</h3>
                                    <span>TABLE TRANSFER</span>
                                </div>
                                <button className="premium-close-btn" onClick={() => setShowMoveModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <div className="add-payment-body">
                                {/* From → To Cards */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                        <div className="field-label-premium" style={{ marginBottom: '8px' }}>FROM</div>
                                        <div className="input-with-icon-premium" style={{ justifyContent: 'center', flexDirection: 'column', gap: '4px', padding: '16px 12px' }}>
                                            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#111827' }}>{moveSourceTable.tableName}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{moveSourceTable.guests} Guests</div>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '1.5rem', color: '#e11d48', fontWeight: '700' }}>→</div>

                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                        <div className="field-label-premium" style={{ marginBottom: '8px' }}>TO</div>
                                        <div style={{ background: '#fff8f1', borderRadius: '16px', border: '2px dashed #e11d48', minHeight: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <select
                                                value={moveTargetTableId}
                                                onChange={(e) => setMoveTargetTableId(e.target.value)}
                                                style={{ width: '100%', border: 'none', background: 'transparent', padding: '16px', fontSize: '1.1rem', fontWeight: '800', textAlign: 'center', outline: 'none', color: '#e11d48', cursor: 'pointer' }}
                                            >
                                                <option value="">Table?</option>
                                                {getValidMoveTargets().map(t => (
                                                    <option key={t.tableId} value={t.tableId}>{t.tableName}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {moveTargetTableId && (
                                    <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '12px 16px', borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center', color: '#92400e', fontSize: '0.85rem', fontWeight: '600' }}>
                                        <span>ℹ️</span> Moving all orders and guests to <strong style={{ marginLeft: '4px' }}>{tables.find(t => t.tableId === moveTargetTableId)?.tableName}</strong>.
                                    </div>
                                )}

                                <div className="payment-modal-footer" style={{ margin: '0 -24px -24px', paddingTop: '20px' }}>
                                    <button className="btn-secondary" onClick={() => setShowMoveModal(false)}>CANCEL</button>
                                    <button
                                        className="btn-primary"
                                        style={{ opacity: moveTargetTableId ? 1 : 0.4 }}
                                        disabled={!moveTargetTableId}
                                        onClick={handleMoveSubmit}
                                    >
                                        <span>CONFIRM MOVE</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Reserve Table Modal (Center Premium Dialog) */}
            {
                showReserveModal && reserveTargetTable && (
                    <div className="add-payment-overlay" onClick={() => setShowReserveModal(false)}>
                        <div className="add-payment-modal reserve-table-premium" onClick={(e) => e.stopPropagation()} style={{ width: '480px' }}>
                            {/* Modern Premium Header */}
                            <div className="premium-payment-header">
                                <div className="header-icon-wrap">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                </div>
                                <div className="header-text">
                                    <h3>{reserveFormData.id ? 'Modify' : 'Reserve'} Table – {reserveTargetTable.tableName}</h3>
                                    <span>RESERVATION DETAILS</span>
                                </div>
                                <button className="premium-close-btn" onClick={() => setShowReserveModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <div className="add-payment-body">
                                {/* Guest Phone Field */}
                                <div className="payment-field-group">
                                    <label className="field-label-premium">GUEST MOBILE NUMBER <span className="req-star">*</span></label>
                                    <div className="input-with-icon-premium">
                                        <span className="field-icon">📱</span>
                                        <input
                                            type="tel"
                                            placeholder="Enter 10 digit number"
                                            maxLength={10}
                                            className="premium-input-field"
                                            value={reserveFormData.phone}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                // Auto-fill name if phone exists in any table's reservations
                                                let existingName = '';
                                                tables.forEach(t => {
                                                    const res = (t.reservations || []).find(r => r.phone === val);
                                                    if (res) existingName = res.name;
                                                });
                                                setReserveFormData({ ...reserveFormData, phone: val, name: existingName || reserveFormData.name });
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Guest Name Field */}
                                <div className="payment-field-group">
                                    <label className="field-label-premium">GUEST NAME <span className="req-star">*</span></label>
                                    <div className="input-with-icon-premium">
                                        <span className="field-icon">👤</span>
                                        <input
                                            type="text"
                                            placeholder="Enter Guest Name (Alphabets only)"
                                            className="premium-input-field"
                                            value={reserveFormData.name}
                                            onChange={e => {
                                                if (/^[a-zA-Z\s]*$/.test(e.target.value)) {
                                                    setReserveFormData({ ...reserveFormData, name: e.target.value });
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="payment-row-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    {/* Date */}
                                    <div className="payment-field-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label-premium">DATE <span className="req-star">*</span></label>
                                        <div className="input-with-icon-premium">
                                            <span className="field-icon">📅</span>
                                            <input
                                                type="date"
                                                min={getCurrentDateISO()} // Restrict past dates
                                                className="premium-input-field"
                                                value={reserveFormData.date}
                                                onChange={e => setReserveFormData({ ...reserveFormData, date: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Session */}
                                    <div className="payment-field-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label-premium">TIME (SESSION) <span className="req-star">*</span></label>
                                        <div className="premium-time-range">
                                            <input
                                                type="time"
                                                className="time-input"
                                                value={reserveFormData.startTime}
                                                onChange={e => {
                                                    const newStart = e.target.value;
                                                    const nowCtx = getNowContext();
                                                    const normalizedStart = toTime24(newStart);

                                                    if (reserveFormData.date === nowCtx.dateISO && (timeToMinutes(normalizedStart) ?? 0) < nowCtx.minutes) {
                                                        showToast('Invalid Time', 'You cannot book a reservation for a past time.');
                                                        return;
                                                    }
                                                    const endTimeStr = computeEndTime(normalizedStart);

                                                    setReserveFormData({
                                                        ...reserveFormData,
                                                        startTime: normalizedStart,
                                                        endTime: endTimeStr
                                                    });
                                                }}
                                            />
                                        </div>
                                        {reserveFormData.endTime && (
                                            <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#10b981', fontWeight: '700' }}>
                                                Session End: {reserveFormData.endTime}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="payment-row-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px' }}>
                                    {/* Guests Count */}
                                    <div className="payment-field-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label-premium">GUESTS COUNT <span className="req-star">*</span></label>
                                        <div className="input-with-icon-premium">
                                            <span className="field-icon">👥</span>
                                            <input
                                                type="number"
                                                min="1"
                                                className="premium-input-field"
                                                value={reserveFormData.guests}
                                                onChange={e => {
                                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                                    setReserveFormData({ ...reserveFormData, guests: val !== '' ? parseInt(val) : '' });
                                                }}
                                                onKeyDown={(e) => {
                                                    if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="payment-field-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label-premium">RESERVATION SOURCE</label>
                                        <div className="input-with-icon-premium">
                                            <span className="field-icon">🛎️</span>
                                            <select
                                                className="premium-input-field"
                                                style={{
                                                    appearance: 'none',
                                                    background: 'transparent url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E") no-repeat right 0px center',
                                                    backgroundSize: '16px',
                                                    paddingRight: '16px'
                                                }}
                                                value={reserveFormData.source}
                                                onChange={e => setReserveFormData({ ...reserveFormData, source: e.target.value })}
                                            >
                                                <option value="Phone">Phone Number</option>
                                                <option value="Walk-In">Walk In</option>
                                                <option value="Online">Online</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="payment-field-group" style={{ marginTop: '20px' }}>
                                    <label className="field-label-premium">SPECIAL NOTE</label>
                                    <div className="input-with-icon-premium">
                                        <span className="field-icon">📝</span>
                                        <input
                                            type="text"
                                            placeholder="e.g. Birthday, Anniversary..."
                                            className="premium-input-field"
                                            value={reserveFormData.note || ''}
                                            onChange={e => setReserveFormData({ ...reserveFormData, note: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                        ADVANCE PAYMENT
                                        {reserveFormData.advancePayment > 0 && <span style={{ color: '#10b981', fontSize: '10px' }}>Amount Added ✅</span>}
                                    </label>
                                    <div className="input-with-icon-premium">
                                        <span className="field-icon" style={{ color: '#059669', background: '#ecfdf5' }}>{cs}</span>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            min="0"
                                            className="premium-input-field has-value"
                                            style={{ border: '1.5px solid #10b981' }}
                                            value={reserveFormData.advancePayment || ''}
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                setReserveFormData({ ...reserveFormData, advancePayment: val !== '' ? parseFloat(val) : '' });
                                            }}
                                            onKeyDown={(e) => {
                                                if (['-', '+', 'e', 'E'].includes(e.key)) {
                                                    e.preventDefault();
                                                }
                                            }}
                                        />
                                    </div>
                                    <p className="hint-text-premium">* Enter the advance amount collected from the guest.</p>
                                </div>

                                {(() => {
                                    const conflict = checkReservationConflict(reserveTargetTable, reserveFormData);
                                    if (conflict) {
                                        return (
                                            <div style={{ marginTop: '12px', padding: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#E31E24', fontSize: '0.85rem', fontWeight: '600' }}>
                                                ⚠️ Reservation Overlap Detected: <br />
                                                {conflict.startTime} - {conflict.endTime} ({conflict.name})
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                <div className="payment-modal-footer">
                                    <button className="btn-secondary" onClick={() => setShowReserveModal(false)}>CANCEL</button>
                                    <button className="btn-primary" onClick={handleReserveSubmit}>
                                        <span>{reserveFormData.id ? 'SAVE CHANGES' : 'RESERVE TABLE'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Merge Table Modal */}
            {
                showMergeModal && mergeSourceTable && (
                    <div className="add-payment-overlay" onClick={() => setShowMergeModal(false)}>
                        <div className="add-payment-modal" onClick={(e) => e.stopPropagation()} style={{ width: '460px' }}>
                            {/* Premium Header */}
                            <div className="premium-payment-header">
                                <div className="header-icon-wrap">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 8v8M9 12h6"></path></svg>
                                </div>
                                <div className="header-text">
                                    <h3>Merge Multiple Tables</h3>
                                    <span>TABLE COMBINATION</span>
                                </div>
                                <button className="premium-close-btn" onClick={() => setShowMergeModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <div className="add-payment-body" style={{ overflow: 'hidden', flexDirection: 'column', display: 'flex', gap: '16px', padding: '24px', flex: 1, minHeight: 0 }}>
                                {/* Merging Into badge */}
                                <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)', borderRadius: '14px', border: '1px solid #fee2e2' }}>
                                    <div className="field-label-premium" style={{ color: '#991b1b', marginBottom: '4px' }}>MERGING INTO</div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#e11d48' }}>{mergeSourceTable.tableName.replace('_MERGED_', '')}</div>
                                </div>

                                {/* Table list label */}
                                <label className="field-label-premium">SELECT TABLES TO MERGE</label>

                                {/* Scrollable list */}
                                <div style={{ border: '2px solid #f1f5f9', borderRadius: '14px', padding: '8px', overflowY: 'auto', maxHeight: '260px', flex: 1 }}>
                                    {tables
                                        .filter(t => t.tableId !== mergeSourceTable.tableId && !t.tableName.startsWith('_MERGED_'))
                                        .map(t => {
                                            const isSelected = mergeSelectedTargetIds.includes(t.tableId);
                                            return (
                                                <div
                                                    key={t.tableId}
                                                    onClick={() => {
                                                        setMergeSelectedTargetIds(prev =>
                                                            prev.includes(t.tableId)
                                                                ? prev.filter(id => id !== t.tableId)
                                                                : [...prev, t.tableId]
                                                        );
                                                    }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '12px',
                                                        padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                                                        background: isSelected ? '#fff1f2' : 'transparent',
                                                        border: isSelected ? '1px solid #fecaca' : '1px solid transparent',
                                                        transition: 'all 0.2s ease',
                                                        marginBottom: '4px'
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '22px', height: '22px', borderRadius: '6px',
                                                        border: `2px solid ${isSelected ? '#e11d48' : '#d1d5db'}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        background: isSelected ? '#e11d48' : '#fff',
                                                        flexShrink: 0,
                                                        transition: 'all 0.2s ease'
                                                    }}>
                                                        {isSelected && <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>✓</span>}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: '700', color: '#111827', fontSize: '0.95rem' }}>{t.tableName}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Capacity: {t.capacity} | Status: {t.status}</div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                </div>

                                {/* Result summary */}
                                {mergeSelectedTargetIds.length > 0 && (
                                    <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                                        <div className="field-label-premium" style={{ marginBottom: '4px' }}>RESULTING TABLE NAME</div>
                                        <div style={{ fontWeight: '800', color: '#111827', fontSize: '1rem' }}>
                                            {[mergeSourceTable, ...tables.filter(t => mergeSelectedTargetIds.includes(t.tableId))].map(t => t.tableName.replace('_MERGED_', '')).join(', ')}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', alignItems: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
                                            <span style={{ color: '#6b7280', fontWeight: '600', fontSize: '0.85rem' }}>Total Capacity:</span>
                                            <span style={{ fontWeight: '900', color: '#e11d48', fontSize: '1.1rem' }}>
                                                {mergeSourceTable.capacity + tables.filter(t => mergeSelectedTargetIds.includes(t.tableId)).reduce((sum, t) => sum + (t.capacity || 4), 0)} Persons
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="payment-modal-footer" style={{ margin: '0 -24px -24px' }}>
                                    <button className="btn-secondary" onClick={() => setShowMergeModal(false)}>CANCEL</button>
                                    <button
                                        className="btn-primary"
                                        style={{ opacity: mergeSelectedTargetIds.length === 0 ? 0.4 : 1 }}
                                        disabled={mergeSelectedTargetIds.length === 0}
                                        onClick={handleMergeSubmit}
                                    >
                                        <span>MERGE {mergeSelectedTargetIds.length + 1} TABLES</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Reservation List Modal */}
            {
                showReservationListModal && reservationListTable && (
                    <ReservationListModal
                        table={reservationListTable}
                        onClose={() => setShowReservationListModal(false)}
                        onCancel={(reservation, cancelDetails) => handleCancelReservation(reservationListTable, reservation, cancelDetails)}
                        onAdd={() => {
                            setShowReservationListModal(false);
                            openReserveModal(reservationListTable);
                        }}
                    />
                )
            }

            {/* Verify User Modal (Premium Center Dialog) */}
            {
                showVerifyModal && (
                    <div className="add-payment-overlay" onClick={() => setShowVerifyModal(false)}>
                        <div className="add-payment-modal" onClick={(e) => e.stopPropagation()} style={{ width: '480px' }}>
                            {/* Premium Header */}
                            <div className="premium-payment-header">
                                <div className="header-icon-wrap">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                </div>
                                <div className="header-text">
                                    <h3>Verify Reservation</h3>
                                    <span>GUEST PHONE VERIFICATION</span>
                                </div>
                                <button className="premium-close-btn" onClick={() => setShowVerifyModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <div className="add-payment-body">
                                {cancelSuccessNote.show && (
                                    <div style={{
                                        marginBottom: '12px',
                                        background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
                                        border: '1px solid #86efac',
                                        borderLeft: '4px solid #16a34a',
                                        borderRadius: '12px',
                                        padding: '10px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '10px'
                                    }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 800, color: '#166534', fontSize: '0.86rem' }}>{cancelSuccessNote.message}</div>
                                            {cancelSuccessNote.subtext && (
                                                <div style={{ color: '#15803d', fontSize: '0.76rem', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cancelSuccessNote.subtext}</div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setCancelSuccessNote({ show: false, message: '', subtext: '' })}
                                            style={{
                                                background: '#dcfce7',
                                                border: '1px solid #86efac',
                                                color: '#166534',
                                                cursor: 'pointer',
                                                width: '26px',
                                                height: '26px',
                                                borderRadius: '8px',
                                                fontSize: '1rem',
                                                fontWeight: 800,
                                                lineHeight: 1,
                                                flexShrink: 0
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}

                                {/* Phone Input */}
                                <div className="payment-field-group">
                                    <label className="field-label-premium">ENTER LINKED PHONE NUMBER <span className="req-star">*</span></label>
                                    <div className="input-with-icon-premium">
                                        <span className="field-icon">📱</span>
                                        <input
                                            type="tel"
                                            placeholder="e.g. 9876543210"
                                            className="premium-input-field"
                                            value={verifyPhoneInput}
                                            onChange={(e) => setVerifyPhoneInput(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {(() => {
                                    const verifyMatches = getVerifyMatches(verifyPhoneInput);
                                    const selectedMatch = verifyMatches.find(
                                        (m) => getVerifyMatchKey(m) === selectedVerifyMatchKey
                                    );
                                    const primaryMatch = selectedMatch || verifyMatches[0];

                                    if (!verifyPhoneInput || normalizePhoneDigits(verifyPhoneInput).length < 3) {
                                        return (
                                            <div style={{ textAlign: 'center', marginTop: '32px', color: '#9ca3af' }}>
                                                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📱</div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>Waiting for guest phone number...</div>
                                            </div>
                                        );
                                    }

                                    if (primaryMatch) {
                                        const primaryIsCancelled = String(primaryMatch.statusLabel || primaryMatch.status || '').toLowerCase().includes('cancel');
                                        const cardTheme = primaryIsCancelled
                                            ? {
                                                bg: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
                                                border: '1px solid #fecdd3',
                                                shadow: '0 4px 12px rgba(190, 24, 93, 0.08)',
                                                title: '#9f1239',
                                                badgeBg: '#be123c',
                                                statusBg: '#ffe4e6',
                                                statusBorder: '#fda4af',
                                                statusText: '#9f1239',
                                                divider: '#fda4af',
                                                altBg: 'rgba(255,255,255,0.7)',
                                                selectedBg: 'rgba(253, 164, 175, 0.22)',
                                                selectedBorder: '1px solid #fb7185'
                                            }
                                            : {
                                                bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                                                border: '1px solid #bbf7d0',
                                                shadow: '0 4px 12px rgba(22, 101, 52, 0.05)',
                                                title: '#166534',
                                                badgeBg: '#166534',
                                                statusBg: '#ecfdf5',
                                                statusBorder: '#86efac',
                                                statusText: '#166534',
                                                divider: '#86efac',
                                                altBg: 'rgba(255,255,255,0.55)',
                                                selectedBg: 'rgba(134, 239, 172, 0.35)',
                                                selectedBorder: '1px solid #4ade80'
                                            };

                                        return (
                                            <div style={{
                                                marginTop: '16px',
                                                padding: '16px',
                                                background: cardTheme.bg,
                                                borderRadius: '16px',
                                                border: cardTheme.border,
                                                boxShadow: cardTheme.shadow
                                            }}>
                                                <div style={{ color: cardTheme.title, fontWeight: '900', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                                                    {primaryIsCancelled ? '⛔ Cancelled Reservation' : `✅ ${primaryMatch.type === 'running' ? 'Running Guest Found' : 'Latest Reservation Found'}`}
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                    <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#111827' }}>{primaryMatch.name}</div>
                                                    <div style={{ padding: '5px 10px', background: cardTheme.badgeBg, color: '#fff', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800' }}>
                                                        Table {primaryMatch.tableName}
                                                    </div>
                                                </div>

                                                {primaryMatch.type === 'reservation' && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                        <div style={{ background: cardTheme.altBg, padding: '10px', borderRadius: '10px' }}>
                                                            <div style={{ fontSize: '0.68rem', color: cardTheme.title, fontWeight: '800', textTransform: 'uppercase' }}>Date</div>
                                                            <div style={{ fontWeight: '700', color: '#111827' }}>{formatDate(primaryMatch.date)}</div>
                                                        </div>
                                                        <div style={{ background: cardTheme.altBg, padding: '10px', borderRadius: '10px' }}>
                                                            <div style={{ fontSize: '0.68rem', color: cardTheme.title, fontWeight: '800', textTransform: 'uppercase' }}>Session</div>
                                                            <div style={{ fontWeight: '700', color: '#111827' }}>{formatTime(primaryMatch.startTime)}{primaryMatch.endTime ? ` - ${formatTime(primaryMatch.endTime)}` : ''}</div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ fontSize: '0.86rem', color: '#4b5563', fontWeight: '600' }}>
                                                        Guests: <span style={{ color: '#111827', fontWeight: '800' }}>{primaryMatch.guests} Persons</span>
                                                    </div>
                                                    <div style={{ color: cardTheme.statusText, fontWeight: '900', fontSize: '0.88rem', background: cardTheme.statusBg, border: `1px solid ${cardTheme.statusBorder}`, borderRadius: '999px', padding: '4px 10px' }}>
                                                        {primaryMatch.statusLabel}
                                                    </div>
                                                </div>

                                                {primaryMatch.type === 'reservation' && primaryMatch.advancePayment > 0 && (
                                                    <div style={{ marginTop: '8px', color: cardTheme.title, fontWeight: '900', fontSize: '0.95rem', textAlign: 'right' }}>
                                                        {cs}{primaryMatch.advancePayment} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>Paid</span>
                                                    </div>
                                                )}

                                                {verifyMatches.length > 1 && (
                                                    <div style={{ marginTop: '10px', borderTop: `1px dashed ${cardTheme.divider}`, paddingTop: '8px' }}>
                                                        {verifyMatches.slice(1, 5).map((m, idx) => (
                                                            <div
                                                                key={getVerifyMatchKey(m)}
                                                                onClick={() => setSelectedVerifyMatchKey(getVerifyMatchKey(m))}
                                                                style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    background: selectedVerifyMatchKey === getVerifyMatchKey(m) ? cardTheme.selectedBg : cardTheme.altBg,
                                                                    borderRadius: '9px',
                                                                    padding: '8px 10px',
                                                                    marginTop: idx === 0 ? 0 : '6px',
                                                                    cursor: 'pointer',
                                                                    border: selectedVerifyMatchKey === getVerifyMatchKey(m) ? cardTheme.selectedBorder : '1px solid transparent',
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                    <span style={{ fontWeight: '800', fontSize: '0.88rem', color: '#0f172a' }}>{m.name}</span>
                                                                    <span style={{ fontSize: '0.74rem', color: '#475569' }}>Table {m.tableName} • {m.statusLabel}</span>
                                                                </div>
                                                                <span style={{ fontSize: '0.74rem', fontWeight: '700', color: cardTheme.title }}>#{idx + 2}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    if (normalizePhoneDigits(verifyPhoneInput).length >= 10) {
                                        return (
                                            <div style={{ marginTop: '16px', padding: '20px', background: '#fff', borderRadius: '16px', border: '2px dashed #fee2e2', color: '#991b1b', fontSize: '0.95rem', textAlign: 'center' }}>
                                                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>❌</div>
                                                <div style={{ fontWeight: '700' }}>No active reservation found</div>
                                                <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '4px' }}>Please double check the phone number</div>
                                            </div>
                                        );
                                    }

                                    return null;
                                })()}

                                <div className="payment-modal-footer" style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.5fr', gap: '10px' }}>
                                    <button
                                        className="btn-secondary"
                                        style={{
                                            minHeight: '44px',
                                            borderRadius: '10px',
                                            fontWeight: 800,
                                            letterSpacing: '0.03em'
                                        }}
                                        onClick={() => setShowVerifyModal(false)}
                                    >
                                        CLOSE
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        style={{
                                            borderColor: '#fca5a5',
                                            color: '#b91c1c',
                                            background: '#fff5f5',
                                            minHeight: '44px',
                                            borderRadius: '10px',
                                            fontWeight: 800,
                                            letterSpacing: '0.02em'
                                        }}
                                        onClick={handleCancelFromVerifyModal}
                                    >
                                        <span>✂ CUT / CANCEL</span>
                                    </button>
                                    <button
                                        className="btn-primary"
                                        style={{
                                            minHeight: '44px',
                                            borderRadius: '10px',
                                            fontWeight: 900,
                                            letterSpacing: '0.02em',
                                            opacity: (() => {
                                                const inputDigits = normalizePhoneDigits(verifyPhoneInput);
                                                if (inputDigits.length !== 10) return 0.5;
                                                return getVerifyMatches(verifyPhoneInput).some(
                                                    m => m.type === 'reservation' && normalizePhoneDigits(m.phone) === inputDigits && m.canVerify
                                                ) ? 1 : 0.5;
                                            })(),
                                            boxShadow: '0 8px 18px rgba(220, 38, 38, 0.24)'
                                        }}
                                        onClick={handleVerifyUser}
                                        disabled={(() => {
                                            const inputDigits = normalizePhoneDigits(verifyPhoneInput);
                                            if (inputDigits.length !== 10) return true;
                                            return !getVerifyMatches(verifyPhoneInput).some(
                                                m => m.type === 'reservation' && normalizePhoneDigits(m.phone) === inputDigits && m.canVerify
                                            );
                                        })()}
                                    >
                                        <span>VERIFY &amp; OPEN TABLE</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {showCancelReservationPanel && (
                            <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    position: 'fixed',
                                    top: 0,
                                    right: 0,
                                    width: '380px',
                                    height: '100vh',
                                    background: 'linear-gradient(180deg, #fff5f5 0%, #ffffff 100%)',
                                    borderLeft: '2px solid #fecdd3',
                                    boxShadow: '-12px 0 30px rgba(225, 29, 72, 0.2)',
                                    zIndex: 12000,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    animation: 'slideInRight 0.25s ease-out'
                                }}
                            >
                                <div style={{ background: '#E31E24', color: '#fff', padding: '18px 16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '1.05rem', fontWeight: 900 }}>Cancel Reservation</div>
                                            <div style={{ fontSize: '0.74rem', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cut / Cancel Panel</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setShowCancelReservationPanel(false);
                                                setCancelPanelTarget(null);
                                            }}
                                            style={{ border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer', fontSize: '1rem', fontWeight: 700 }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>

                                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                                    <label className="field-label-premium" style={{ color: '#9f1239' }}>Guest Name</label>
                                    <input
                                        className="premium-input-field"
                                        value={cancelPanelForm.guestName}
                                        onChange={(e) => setCancelPanelForm(prev => ({ ...prev, guestName: e.target.value }))}
                                        placeholder="Enter guest name"
                                    />

                                    <label className="field-label-premium" style={{ color: '#9f1239', marginTop: '4px' }}>Phone Number</label>
                                    <input
                                        className="premium-input-field"
                                        value={cancelPanelForm.phone}
                                        onChange={(e) => {
                                            const digits = String(e.target.value || '').replace(/\D/g, '').slice(0, 10);
                                            setCancelPanelForm(prev => ({ ...prev, phone: digits }));
                                        }}
                                        placeholder="10 digit phone"
                                    />

                                    <label className="field-label-premium" style={{ color: '#9f1239', marginTop: '4px' }}>Cancellation Charge</label>
                                    <input
                                        className="premium-input-field"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={cancelPanelForm.charge}
                                        onChange={(e) => setCancelPanelForm(prev => ({ ...prev, charge: e.target.value }))}
                                        placeholder="0"
                                    />

                                    <label className="field-label-premium" style={{ color: '#9f1239', marginTop: '4px' }}>Reason</label>
                                    <input
                                        className="premium-input-field"
                                        value={cancelPanelForm.reason}
                                        onChange={(e) => setCancelPanelForm(prev => ({ ...prev, reason: e.target.value }))}
                                        placeholder="Cancellation reason"
                                    />

                                    <label className="field-label-premium" style={{ color: '#9f1239', marginTop: '4px' }}>Note (Optional)</label>
                                    <textarea
                                        className="premium-input-field"
                                        value={cancelPanelForm.note}
                                        onChange={(e) => setCancelPanelForm(prev => ({ ...prev, note: e.target.value }))}
                                        placeholder="Additional details"
                                        rows={3}
                                        style={{ resize: 'vertical', minHeight: '78px' }}
                                    />

                                    <div style={{ marginTop: '6px', padding: '12px', borderRadius: '10px', background: '#fff1f2', border: '1px solid #fecdd3', color: '#881337', fontWeight: 700, fontSize: '0.82rem' }}>
                                        Added charge will be counted in cancellation revenue and reservation reports.
                                    </div>
                                </div>

                                <div style={{ marginTop: 'auto', padding: '14px 16px', borderTop: '1px solid #fecdd3', display: 'flex', gap: '10px', background: '#fff' }}>
                                    <button
                                        className="btn-secondary"
                                        style={{ flex: 1 }}
                                        onClick={() => {
                                            setShowCancelReservationPanel(false);
                                            setCancelPanelTarget(null);
                                        }}
                                    >
                                        Back
                                    </button>
                                    <button
                                        className="btn-primary"
                                        style={{ flex: 1, background: '#E31E24' }}
                                        onClick={submitCancelFromPanel}
                                    >
                                        Confirm Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {/* Toast Notification */}
            {
                toast.show && (
                    <div style={{
                        position: 'fixed', top: '40px', left: '50%', transform: 'translateX(-50%)',
                        background: '#10b981', color: 'white', padding: '12px 24px', borderRadius: '50px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        zIndex: 9999, display: 'flex', alignItems: 'center', gap: '8px',
                        animation: 'fadeInScale 0.3s ease-out'
                    }}>
                        <span style={{ fontSize: '1.2rem' }}>✅</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{toast.message}</div>
                            {toast.subtext && <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{toast.subtext}</div>}
                        </div>
                        <button
                            onClick={() => setToast({ ...toast, show: false })}
                            style={{
                                background: 'none', border: 'none', color: 'white',
                                cursor: 'pointer', fontSize: '1.5rem', padding: '0 4px',
                                marginLeft: '8px', opacity: 0.8, display: 'flex', alignItems: 'center'
                            }}
                        >
                            &times;
                        </button>
                    </div>
                )
            }

            {/* Close Table Modal */}
            {
                showCloseModal && closeTableData && (
                    <div className="modal-overlay">
                        <div className="modal-content" style={{ width: 'min(420px, calc(100vw - 24px))', padding: '0', overflow: 'hidden' }}>
                            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>Settlement Summary</h2>
                                <button className="close-btn" onClick={() => setShowCloseModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.8rem', cursor: 'pointer', color: '#9ca3af', padding: '0 4px' }}>&times;</button>
                            </div>

                            <div style={{ padding: '24px' }}>
                                <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <span style={{ color: '#6b7280' }}>Table Number</span>
                                        <span style={{ fontWeight: '800', color: '#111827' }}>{closeTableData.tableName}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <span style={{ color: '#6b7280' }}>Guest Count</span>
                                        <span style={{ fontWeight: '700' }}>{closeTableData.guests} Persons</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <span style={{ color: '#6b7280' }}>Session Time</span>
                                        <span style={{ fontWeight: '700' }}>{formatDuration(closeTableData.duration)}</span>
                                    </div>
                                    <div style={{ height: '1px', background: '#e5e7eb', margin: '8px 0' }}></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                                        <span style={{ color: '#111827', fontWeight: '600' }}>Total Amount</span>
                                        <span style={{ fontWeight: '900', color: '#E31E24', fontSize: '1.5rem' }}>{cs}{closeTableData.amount}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', background: '#f0fdf4', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600' }}>
                                    <span>✅</span> Payment has been fully settled
                                </div>
                            </div>

                            <div className="modal-footer settlement-modal-footer" style={{ padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
                                <button className="btn btn-secondary settlement-modal-action-btn" onClick={() => setShowCloseModal(false)}>Back</button>
                                <button className="btn btn-primary settlement-modal-action-btn settlement-modal-primary-btn" onClick={handleCloseSubmit}>Close & Release Table</button>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
};

const TableCard = ({ table, formatDuration, onMenuAction, onDeleteTable, onCardClick, onSendToCashier }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [showDeleteWarning, setShowDeleteWarning] = useState(false);
    const menuRef = useRef(null);
    const { settings, getCurrencySymbol, formatTime } = useSettings();
    const cs = getCurrencySymbol();

    // Helper logic to find nearest upcoming reservation
    const getNextReservation = () => {
        if (!table.reservations || table.reservations.length === 0) return null;

        const nowTs = Date.now();
        const retentionCutoffTs = nowTs - (24 * 60 * 60 * 1000);

        const toDateTime = (dateValue, timeValue) => {
            if (!dateValue || !timeValue) return null;
            const [year, month, day] = String(dateValue).split('-').map(Number);
            const [hour, minute] = String(timeValue).split(':').map(Number);
            if ([year, month, day, hour, minute].some(Number.isNaN)) return null;
            return new Date(year, month - 1, day, hour, minute, 0, 0);
        };

        // Filter: only future reservations for operational view.
        const future = table.reservations.filter(res => {
            if (String(res.status || '').toLowerCase() === 'cancelled') return false;

            const startDateTime = toDateTime(res.date, res.startTime);
            const endDateTime = toDateTime(res.date, res.endTime || res.startTime);
            if (!startDateTime) return false;

            if (endDateTime && endDateTime.getTime() < retentionCutoffTs) return false;
            return startDateTime.getTime() > nowTs;
        });

        if (future.length === 0) return null;

        // Sort by nearest upcoming date/time first.
        future.sort((a, b) => {
            const dtA = toDateTime(a.date, a.startTime);
            const dtB = toDateTime(b.date, b.startTime);
            return (dtA ? dtA.getTime() : 0) - (dtB ? dtB.getTime() : 0);
        });

        return future[0];
    };

    const nextRes = getNextReservation();

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
                setShowDeleteWarning(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleMenuClick = (e) => {
        e.stopPropagation();
        setShowMenu((prev) => {
            const next = !prev;
            if (!next) setShowDeleteWarning(false);
            return next;
        });
    };

    const handleAction = (action, e) => {
        e.stopPropagation();
        onMenuAction(action, table);
        setShowDeleteWarning(false);
        setShowMenu(false);
    };

    const handleDeleteMenuClick = (e) => {
        e.stopPropagation();
        setShowDeleteWarning(true);
    };

    const handleDeleteConfirm = async (e) => {
        e.stopPropagation();
        await onDeleteTable?.(table);
        setShowDeleteWarning(false);
        setShowMenu(false);
    };

    // Table Color Logic
    const getStatusStyles = (status) => {
        switch (status) {
            case 'Available': return { badge: '#10b981', bg: '#fff', border: '#e5e7eb' };
            case 'Reserved': return { badge: '#f97316', bg: '#fff7ed', border: '#fdba74' };
            case 'Running': return { badge: '#10b981', bg: '#f0fdf4', border: '#bcfced' };
            case 'Occupied': return { badge: '#fbbf24', bg: '#fffbeb', border: '#fde68a' };
            case 'Billed': return { badge: '#ef4444', bg: '#fef2f2', border: '#fecaca' };
            case 'Pending': return { badge: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' };
            default: return { badge: '#6b7280', bg: '#fff', border: '#e5e7eb' };
        }
    };

    let computedStatus = table.calculatedStatus || table.status;
    if (table.orderStatus === 'Pending Payment') {
        computedStatus = 'Pending';
    }
    const statusToUse = computedStatus;
    const styles = getStatusStyles(statusToUse);

    const [elapsedTime, setElapsedTime] = useState(table.duration || 0);

    useEffect(() => {
        let interval;
        if (statusToUse === 'Running' || statusToUse === 'Billed') {
            if (table.orderStartTime) {
                const startTime = new Date(table.orderStartTime).getTime();
                const now = new Date().getTime();
                setElapsedTime(Math.floor((now - startTime) / 1000));
            }

            interval = setInterval(() => {
                if (table.orderStartTime) {
                    const startTime = new Date(table.orderStartTime).getTime();
                    const now = new Date().getTime();
                    setElapsedTime(Math.floor((now - startTime) / 1000));
                } else {
                    setElapsedTime(prev => prev + 1);
                }
            }, 1000);
        } else {
            setElapsedTime(0);
        }
        return () => clearInterval(interval);
    }, [statusToUse, table.orderStartTime]);

    const formatLiveDuration = (seconds) => {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    // Helper for source labels
    const getSourceLabel = (src) => {
        if (src === 'Phone') return 'Phone Number';
        if (src === 'Walk-In') return 'Walk In';
        return src || 'Phone';
    };

    return (
        <div
            className={`table-item ${statusToUse.toLowerCase()}`}
            style={{
                background: styles.bg,
                border: `1px solid ${styles.border}`,
                borderRadius: '16px',
                boxShadow: showMenu ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                padding: '16px',
                position: 'relative',
                zIndex: showMenu ? 2200 : 1,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'default',
                transform: showMenu ? 'translateY(-2px)' : 'none'
            }}
        >
            {statusToUse !== 'Available' && statusToUse !== 'Reserved' && table.orderStatus === 'Pending' && <div className="blink-dot blink-yellow-real" title="Order Pending"></div>}
            {statusToUse !== 'Available' && statusToUse !== 'Reserved' && (table.orderStatus === 'Preparing' || table.orderStatus === 'Ready') && <div className="blink-dot blink-red-real" title="Preparing"></div>}
            {statusToUse !== 'Available' && statusToUse !== 'Reserved' && table.orderStatus === 'Served' && <div className="blink-dot blink-green-real" title="Ready / Served"></div>}

            <div className="table-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="table-id" style={{ fontWeight: '800', fontSize: '1.3rem', color: '#111827' }}>{table.tableName}</span>
                    <span className={`status-tag`} style={{
                        background: `${styles.badge}20`,
                        color: styles.badge,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        textTransform: 'uppercase'
                    }}>
                        {statusToUse}
                    </span>
                </div>

                <div className="menu-container" ref={menuRef} style={{ position: 'relative' }}>
                    <div className="menu-trigger" onClick={handleMenuClick} style={{
                        fontSize: '1.5rem', color: '#9ca3af', cursor: 'pointer', padding: '0 4px'
                    }}>
                        ⋮
                    </div>
                    {showMenu && (
                        <div className="context-menu" onMouseDown={(e) => e.stopPropagation()} style={{
                            position: 'absolute', top: 'calc(100% + 5px)', right: '0', zIndex: 5000,
                            background: '#fff', borderRadius: '14px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                            border: '1px solid #f3f4f6', minWidth: '168px', maxWidth: '178px',
                            maxHeight: '224px', overflowY: 'auto', overflowX: 'hidden',
                            animation: 'fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                            <div className="menu-group" style={{ padding: '6px' }}>
                                <MenuItem icon="📅" label="Reserve Table" onClick={(e) => handleAction('Reserve Table', e)} />
                                <MenuItem icon="📝" label="Reservation List" onClick={(e) => handleAction('Reservation List', e)} />
                            </div>

                            <div style={{ height: '1px', background: '#f3f4f6', margin: '0 6px' }}></div>

                            <div className="menu-group" style={{ padding: '6px' }}>
                                {(table.status === 'Available' || table.status === 'Reserved') && (
                                    <>
                                        <MenuItem icon="🚶" label="Walk-in" color="#10b981" weight="600" onClick={(e) => handleAction('Walk-in', e)} />
                                        {settings.billingRules?.splitBill !== false && (
                                            <MenuItem icon="✂" label="Split Table" onClick={(e) => handleAction('Split Table', e)} />
                                        )}
                                        <MenuItem icon="↔" label="Move Guests" onClick={(e) => handleAction('Move Guests', e)} />
                                        {settings.billingRules?.mergeTable !== false && (
                                            <MenuItem icon="🔗" label="Merge Table" onClick={(e) => handleAction('Merge Table', e)} />
                                        )}
                                    </>
                                )}

                                {table.status === 'Running' && (
                                    <>
                                        <MenuItem icon="↔" label="Move Guests" onClick={(e) => handleAction('Move Guests', e)} />
                                        {settings.billingRules?.mergeTable !== false && (
                                            <MenuItem icon="🔗" label="Merge Table" onClick={(e) => handleAction('Merge Table', e)} />
                                        )}
                                        {(table.amount === 0 || !table.currentOrderId) && (
                                            <MenuItem icon="↺" label="Release Table" color="#E31E24" onClick={(e) => handleAction('Release Table', e)} />
                                        )}
                                        <MenuItem icon="✓" label="Close Table" color="#E31E24" onClick={(e) => handleAction('Close Table', e)} />
                                    </>
                                )}

                                {(table.reservations && table.reservations.length > 0) && (
                                    <MenuItem icon="🔍" label="Verify User" onClick={(e) => handleAction('Verify User', e)} />
                                )}

                                {table.status === 'Billed' && (
                                    <MenuItem icon="✓" label="Close Table" color="#E31E24" onClick={(e) => handleAction('Close Table', e)} />
                                )}

                                {((table.mergedTableIds && table.mergedTableIds.length > 0) || (table.tableName && table.tableName.includes(','))) && (
                                    <MenuItem icon="🔓" label="Release Table" color="#E31E24" weight="700" onClick={(e) => handleAction('Release Table', e)} />
                                )}
                            </div>

                            <div style={{ height: '1px', background: '#f3f4f6', margin: '0 6px' }}></div>

                            <div className="menu-group" style={{ padding: '6px' }}>
                                <MenuItem icon="✏️" label="Edit Table" onClick={(e) => handleAction('Edit Table', e)} />
                                <div>
                                    <MenuItem icon="🗑️" label="Delete Table" color="#E31E24" weight="700" onClick={handleDeleteMenuClick} />
                                    {showDeleteWarning && (
                                        <div style={{
                                            marginTop: '6px',
                                            padding: '8px 10px',
                                            borderRadius: '10px',
                                            border: '1px solid #fecaca',
                                            background: '#fff1f2',
                                            color: '#991b1b',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            display: 'inline-flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            gap: '8px',
                                            width: '100%',
                                            boxShadow: '0 12px 24px rgba(239, 68, 68, 0.2)',
                                            zIndex: 1
                                        }}>
                                            <span>Are you sure want to delete?</span>
                                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                <button
                                                    type="button"
                                                    onClick={handleDeleteConfirm}
                                                    style={{
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        padding: '4px 10px',
                                                        background: '#dc2626',
                                                        color: '#fff',
                                                        cursor: 'pointer',
                                                        fontWeight: 700,
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    Yes
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowDeleteWarning(false);
                                                    }}
                                                    style={{
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        padding: '4px 10px',
                                                        background: '#fee2e2',
                                                        color: '#7f1d1d',
                                                        cursor: 'pointer',
                                                        fontWeight: 700,
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    No
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="table-body">
                <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>🪑</span> Seats: {table.capacity}
                </div>

                <div className="table-metrics" style={{ minHeight: '60px' }}>
                    {statusToUse === 'Available' ? (
                        <>
                            <div style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: '600', marginBottom: '4px' }}>Ready for guests</div>
                            {nextRes && (() => {
                                const toDateTime = (dateValue, timeValue) => {
                                    if (!dateValue || !timeValue) return null;
                                    const [year, month, day] = String(dateValue).split('-').map(Number);
                                    const [hour, minute] = String(timeValue).split(':').map(Number);
                                    if ([year, month, day, hour, minute].some(Number.isNaN)) return null;
                                    return new Date(year, month - 1, day, hour, minute, 0, 0);
                                };

                                const nextDt = toDateTime(nextRes.date, nextRes.startTime);
                                const diff = nextDt ? Math.max(0, Math.round((nextDt.getTime() - Date.now()) / 60000)) : 0;
                                const isNear = diff > 0 && diff <= 30;

                                return (
                                    <div style={{
                                        fontSize: '0.8rem',
                                        color: isNear ? '#E31E24' : '#6b7280',
                                        marginTop: '8px',
                                        padding: '6px 10px',
                                        background: isNear ? '#fef2f2' : '#f9fafb',
                                        borderRadius: '8px',
                                        border: isNear ? '1px solid #fecaca' : '1px dashed #e5e7eb',
                                        animation: isNear ? 'pulse 2s infinite' : 'none'
                                    }}>
                                        {isNear ? '⚠️ Arriving Soon: ' : 'Next: '}
                                        <span style={{ fontWeight: '800', color: isNear ? '#b91c1c' : '#4b5563' }}>
                                            {formatTime(nextRes.startTime)} ({diff}m)
                                        </span>
                                        <div style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.8 }}>{nextRes.name} ({getSourceLabel(nextRes.source)})</div>
                                    </div>
                                );
                            })()}
                        </>
                    ) : statusToUse === 'Reserved' ? (
                        <div style={{ padding: '10px', background: '#fff7ed', borderRadius: '12px', border: '1px solid #ffedd5' }}>
                            <div style={{ fontSize: '0.75rem', color: '#c2410c', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reservation Active</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#111827', marginTop: '4px' }}>
                                {formatTime(table.activeReservation?.startTime)} - {formatTime(table.activeReservation?.endTime)}
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#9a3412', marginTop: '2px' }}>
                                {table.activeReservation?.name} ({getSourceLabel(table.activeReservation?.source)})
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ padding: '6px', background: '#fff', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Amount</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{cs}{table.amount || table.runningOrderAmount || 0}</div>
                            </div>
                            <div style={{ padding: '6px', background: '#fff', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Time</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{formatLiveDuration(elapsedTime)}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="table-action" style={{
                marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={onCardClick}>
                    <span style={{ color: '#E31E24', fontWeight: '700', fontSize: '0.9rem' }}>
                        {(table.status === 'Available' || table.status === 'Occupied') ? 'Tap to Order' : 'Manage Order'}
                    </span>
                    <span style={{ fontSize: '1.2rem', color: '#E31E24', fontWeight: '800' }}>→</span>
                </div>

                {(statusToUse === 'Running') && (
                    <button
                        onClick={(e) => onSendToCashier(e, table)}
                        title="Send final bill to cashier"
                        style={{
                            padding: '8px 16px', borderRadius: '8px',
                            background: '#E31E24', color: 'white', border: 'none',
                            fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem',
                            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Send
                    </button>
                )}
            </div>
        </div>
    );
};

export default GuestMealService;
