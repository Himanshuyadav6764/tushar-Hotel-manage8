import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { hasPermission, MODULES, PERMISSIONS } from '../../config/rbac';
import './RoomSetup.css';
import API_URL, { apiCall } from '../../config/api';
import RoomDetailsPanel from '../../components/rooms/RoomDetailsPanel';

const DEFAULT_ROOM_VIEW_TYPES = ['City View', 'Pool View', 'Garden View', 'Sea View'];

const RoomSetup = () => {
    const navigate = useNavigate();
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [rooms, setRooms] = useState([]);
    const [roomTypes, setRoomTypes] = useState([]); // State for dynamic room types
    const [bedTypes, setBedTypes] = useState([]); // State for dynamic bed types
    const [floors, setFloors] = useState([]); // State for dynamic floors
    const [taxOptions, setTaxOptions] = useState([]); // State for dynamic tax options
    const [reservations, setReservations] = useState([]); // All bookings/reservations
    const [maintenanceBlocks, setMaintenanceBlocks] = useState([]); // Maintenance blocks
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [roomViewTypes, setRoomViewTypes] = useState(() => {
        try {
            const saved = localStorage.getItem('roomViewTypes');
            const parsed = JSON.parse(saved || '[]');
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        } catch (e) {
            console.warn('Unable to read room view types from localStorage:', e);
        }
        return DEFAULT_ROOM_VIEW_TYPES;
    });
    const [showRoomViewDropdown, setShowRoomViewDropdown] = useState(false);
    const [newRoomViewType, setNewRoomViewType] = useState('');

    const { user } = useAuth();
    const canManageRooms = hasPermission(user, MODULES.PROPERTY_CONFIG, PERMISSIONS.EDIT);
    const canBook = hasPermission(user, MODULES.RESERVATIONS, PERMISSIONS.CREATE);
    const canManageStatus = hasPermission(user, MODULES.ROOMS, PERMISSIONS.EDIT);


    // Date Range State
    const [startDate, setStartDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toLocaleDateString('en-CA');
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [viewMonth, setViewMonth] = useState(new Date());
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

    const getDaysInMonth = (year, month) => {
        const date = new Date(year, month, 1);
        const days = [];
        const firstDay = date.getDay(); // 0 is Sunday, 1 is Monday
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
        for (let i = 0; i < adjustedFirstDay; i++) {
            days.push(null);
        }
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    };

    const handleDateClick = (date) => {
        if (!date) return;
        const dateStr = date.toLocaleDateString('en-CA');
        if (!startDate || (startDate && endDate)) {
            setStartDate(dateStr);
            setEndDate(null);
        } else {
            if (dateStr < startDate) {
                setStartDate(dateStr);
                setEndDate(null);
            } else if (dateStr === startDate) {
                return;
            } else {
                setEndDate(dateStr);
            }
        }
    };

    const isDateInRange = (date) => {
        if (!date || !startDate || !endDate) return false;
        const dateStr = date.toLocaleDateString('en-CA');
        return dateStr > startDate && dateStr < endDate;
    };

    const isDateSelected = (date, type) => {
        if (!date) return false;
        const dateStr = date.toLocaleDateString('en-CA');
        if (type === 'start') return dateStr === startDate;
        if (type === 'end') return dateStr === endDate;
        return false;
    };

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
    const [currentRoom, setCurrentRoom] = useState(null);
    const [formData, setFormData] = useState({
        roomNumber: '',
        floor: '',
        roomType: '',
        bedType: '',
        capacity: 2,
        basePrice: '',
        status: 'Available',
        // PHASE 2 UPGRADE: Enterprise-level fields
        roomViewType: 'City View',
        smokingPolicy: 'Non-Smoking',
        roomSize: 0,
        isSmartRoom: false,
        dynamicRateEnabled: false
    });

    // Filters State
    const [filters, setFilters] = useState({
        floor: 'All',
        roomType: 'All',
        bedType: 'All',
        taxMapping: 'All',
        status: 'All'
    });

    // Delete Warning State
    const [pendingDeleteRoomId, setPendingDeleteRoomId] = useState(null);
    const [deletingRoomId, setDeletingRoomId] = useState(null);

    const datePickerRef = useRef(null);
    const roomViewDropdownRef = useRef(null);

    useEffect(() => {
        localStorage.setItem('roomViewTypes', JSON.stringify(roomViewTypes));
    }, [roomViewTypes]);

    useEffect(() => {
        const handleClickOutsideRoomView = (event) => {
            if (roomViewDropdownRef.current && !roomViewDropdownRef.current.contains(event.target)) {
                setShowRoomViewDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutsideRoomView);
        return () => document.removeEventListener('mousedown', handleClickOutsideRoomView);
    }, []);

    // Close date picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
                setShowDatePicker(false);
            }
        };

        if (showDatePicker) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDatePicker]);

    // Fetch Room Types (Facility Types)
    const fetchRoomTypes = async () => {
        try {
            const response = await apiCall(`/api/facility-types/list`);
            const data = await response.json();
            if (data.success) {
                setRoomTypes(data.data);
            }
        } catch (error) {
            console.error('Error fetching room types:', error);
        }
    };

    // Fetch Floors
    const fetchFloors = async () => {
        try {
            const response = await apiCall(`/api/floors/list`);
            const data = await response.json();
            if (data.success) {
                setFloors(data.data);
            }
        } catch (error) {
            console.error('Error fetching floors:', error);
        }
    };

    // Fetch Bed Types
    const fetchBedTypes = async () => {
        try {
            const response = await apiCall(`/api/bed-types/list`);
            const data = await response.json();
            if (data.success) {
                setBedTypes(data.data);
            }
        } catch (error) {
            console.error('Error fetching bed types:', error);
        }
    };

    // Fetch Tax Options from LocalStorage
    const fetchTaxOptions = () => {
        try {
            const storedMappings = localStorage.getItem('taxMappings');
            const storedTaxes = localStorage.getItem('taxes');

            if (storedMappings && storedTaxes) {
                const mappings = JSON.parse(storedMappings);
                const taxes = JSON.parse(storedTaxes);

                // Filter for 'Room Charges' (usually ROOM service type) and ACTIVE status
                const activeRoomMappings = mappings.filter(m =>
                    (m.serviceType === 'ROOM' || m.serviceType === 'Room Charges') &&
                    m.status === 'ACTIVE'
                );

                const options = activeRoomMappings.map(mapping => {
                    const taxNames = mapping.taxIds.map(id => {
                        const tax = taxes.find(t => t.id === id);
                        return tax ? tax.name : '';
                    }).filter(name => name !== '').join(', ');

                    return {
                        id: mapping.id,
                        label: taxNames || 'No Taxes'
                    };
                });

                setTaxOptions(options);
            }
        } catch (error) {
            console.error('Error fetching tax options:', error);
        }
    };

    // Fetch Reservations & Bookings
    const fetchReservations = async () => {
        try {
            const [bookingsRes, reservationsRes] = await Promise.all([
                apiCall(`/api/bookings/list`),
                apiCall(`/api/reservations/list`)
            ]);
            const b = await bookingsRes.json();
            const r = await reservationsRes.json();

            let all = [];
            if (b.success && b.data) all = [...all, ...b.data];
            if (r.success && r.data) {
                const mappedR = r.data.map(item => ({
                    ...item,
                    checkInDate: item.checkInDate,
                    checkOutDate: item.checkOutDate,
                    roomNumber: item.roomNumber
                }));
                all = [...all, ...mappedR];
            }
            setReservations(all);
        } catch (err) {
            console.error('Error fetching reservations:', err);
        }
    };

    // Fetch Maintenance Blocks
    const fetchMaintenanceBlocks = async () => {
        try {
            const response = await apiCall(`/api/maintenance-blocks/list`);
            const data = await response.json();
            if (data.success) {
                setMaintenanceBlocks(data.data);
            }
        } catch (error) {
            console.error('Error fetching maintenance blocks:', error);
        }
    };

    // Fetch Rooms
    const fetchRooms = async () => {
        try {
            setLoading(true);
            const response = await apiCall(`/api/rooms/list`);
            const data = await response.json();
            if (data.success) {
                const transformedRooms = data.data.map(room => ({
                    ...room,
                    id: room._id,
                    floor: room.floor || 'Ground Floor',
                    bedType: room.bedType || 'Double',
                    basePrice: `${cs} ${room.price}`,
                    capacity: { adults: room.capacity, children: 0 }
                }));
                setRooms(transformedRooms);
            } else {
                setError('Failed to fetch rooms');
            }
        } catch (err) {
            setError('Error connecting to server');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
        fetchRoomTypes();
        fetchBedTypes();
        fetchFloors();
        fetchTaxOptions();
        fetchReservations();
        fetchMaintenanceBlocks();
    }, []);

    useEffect(() => {
        if (!pendingDeleteRoomId) return;

        const timer = setTimeout(() => setPendingDeleteRoomId(null), 5000);
        return () => clearTimeout(timer);
    }, [pendingDeleteRoomId]);

    // Availability Helper
    const getRoomStatusForRange = (roomNumber) => {
        // 1. Check Maintenance Blocks first (Priority)
        const maintenanceOverlap = maintenanceBlocks.find(block => {
            if (String(block.room) !== String(roomNumber)) return false;
            if (block.status === 'Completed') return false;

            const blockStart = new Date(block.startDate).setHours(0, 0, 0, 0);
            const blockEnd = new Date(block.endDate).setHours(0, 0, 0, 0);
            const selStart = new Date(startDate).setHours(0, 0, 0, 0);
            const selEnd = new Date(endDate).setHours(0, 0, 0, 0);

            // Maintenance block should show if any part of it overlaps with selected range
            // Inclusive check for maintenance as it usually blocks the whole day
            return (blockStart <= selEnd && blockEnd >= selStart);
        });

        if (maintenanceOverlap) return 'Under Maintenance';

        const overlap = reservations.find(res => {
            const hasRoom = res.roomNumber === roomNumber ||
                (res.rooms && res.rooms.some(r => r.roomNumber === roomNumber));

            if (!hasRoom) return false;

            // Skip inactive/completed bookings
            const inactiveStatuses = ['Checked-out', 'CHECKED_OUT', 'CheckedOut', 'Cancelled', 'NoShow', 'No-Show', 'Void'];
            if (inactiveStatuses.includes(res.status)) return false;

            // Standard overlap logic: (S1 < E2) AND (E1 > S2)
            const resStart = new Date(res.checkInDate).setHours(0, 0, 0, 0);
            const resEnd = new Date(res.checkOutDate).setHours(0, 0, 0, 0);
            const selStart = new Date(startDate).setHours(0, 0, 0, 0);
            const selEnd = new Date(endDate).setHours(0, 0, 0, 0);

            return (resStart < selEnd && resEnd > selStart);
        });

        if (overlap) {
            const occStatuses = ['Checked-in', 'IN_HOUSE', 'CheckedIn', 'Occupied'];
            return occStatuses.includes(overlap.status) ? 'Occupied' : 'Reserved';
        }
        return 'Available';
    };

    // Filter Logic
    const filteredRooms = rooms.filter(room => {
        const currentStatus = getRoomStatusForRange(room.roomNumber);
        return (
            (filters.floor === 'All' || room.floor === filters.floor) &&
            (filters.roomType === 'All' || room.roomType === filters.roomType) &&
            (filters.bedType === 'All' || room.bedType === filters.bedType) &&
            (filters.status === 'All' || currentStatus === filters.status)
        );
    }).map(room => ({
        ...room,
        computedStatus: getRoomStatusForRange(room.roomNumber)
    }));

    // Handle Form Input Change
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setFormData({ ...formData, [name]: value });
    };

    const handleAddRoomViewTypeInline = () => {
        const newType = String(newRoomViewType || '').trim();
        if (!newType) return;

        const exists = roomViewTypes.some(type => type.toLowerCase() === newType.toLowerCase());
        if (exists) {
            alert('This view type already exists.');
            return;
        }

        const updatedTypes = [...roomViewTypes, newType];
        setRoomViewTypes(updatedTypes);
        setFormData(prev => ({ ...prev, roomViewType: newType }));
        setNewRoomViewType('');
    };

    const handleDeleteRoomViewTypeInline = (typeToDelete) => {
        if (roomViewTypes.length <= 1) {
            alert('At least one room view type is required.');
            return;
        }

        const confirmed = window.confirm(`Delete "${typeToDelete}" view type?`);
        if (!confirmed) return;

        const updatedTypes = roomViewTypes.filter(type => type !== typeToDelete);
        setRoomViewTypes(updatedTypes);

        setFormData(prev => ({
            ...prev,
            roomViewType: prev.roomViewType === typeToDelete ? (updatedTypes[0] || 'City View') : prev.roomViewType
        }));
    };

    // Open Modal
    const openModal = (mode, room = null) => {
        setModalMode(mode);
        if (mode === 'edit' && room) {
            setCurrentRoom(room);
            setFormData({
                roomNumber: room.roomNumber,
                floor: room.floor,
                roomType: room.roomType,
                bedType: room.bedType,
                capacity: room.capacity.adults, // extract number
                basePrice: room.price || room.basePrice.replace(/^[^\d]*/, '').replace(',', ''),
                status: room.status,
                // PHASE 2 UPGRADE: Populate enterprise fields (with fallback for backward compatibility)
                roomViewType: room.roomViewType || 'City View',
                smokingPolicy: room.smokingPolicy || 'Non-Smoking',
                roomSize: room.roomSize || 0,
                isSmartRoom: room.isSmartRoom || false,
                dynamicRateEnabled: room.dynamicRateEnabled || false
            });

            if (room.roomViewType && !roomViewTypes.includes(room.roomViewType)) {
                setRoomViewTypes(prev => [...prev, room.roomViewType]);
            }
            setShowRoomViewDropdown(false);
            setNewRoomViewType('');
        } else {
            // Find first available floor
            let defaultFloor = '';
            if (floors.length > 0) {
                const availableFloor = floors.find(floor => {
                    const currentCount = rooms.filter(r => r.floor === floor.name).length;
                    return currentCount < floor.roomCount;
                });
                defaultFloor = availableFloor ? availableFloor.name : '';
            }

            setFormData({
                roomNumber: '',
                floor: defaultFloor,
                roomType: roomTypes.length > 0 ? roomTypes[0].name : '',
                bedType: bedTypes.length > 0 ? bedTypes[0].name : '',
                capacity: 2,
                basePrice: '',
                status: 'Available',
                // PHASE 2 UPGRADE: Default values for enterprise fields
                roomViewType: roomViewTypes[0] || 'City View',
                smokingPolicy: 'Non-Smoking',
                roomSize: 0,
                isSmartRoom: false,
                dynamicRateEnabled: false
            });
            setShowRoomViewDropdown(false);
            setNewRoomViewType('');
        }
        setIsModalOpen(true);
    };

    // Handle Submit
    const handleSubmit = async (e) => {
        e.preventDefault();

        const payload = {
            roomNumber: formData.roomNumber,
            floor: formData.floor,
            roomType: formData.roomType,
            price: Number(formData.basePrice),
            capacity: Number(formData.capacity),
            status: formData.status,
            // PHASE 2 UPGRADE: Include enterprise fields in payload
            roomViewType: formData.roomViewType,
            smokingPolicy: formData.smokingPolicy,
            roomSize: Number(formData.roomSize),
            isSmartRoom: formData.isSmartRoom,
            dynamicRateEnabled: formData.dynamicRateEnabled
        };

        try {
            let response;
            if (modalMode === 'add') {
                response = await apiCall(`/api/rooms/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                response = await apiCall(`/api/rooms/update/${currentRoom.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const data = await response.json();
            if (data.success) {
                setIsModalOpen(false);
                fetchRooms(); // Refresh list
            } else {
                alert(data.message || 'Operation failed');
            }
        } catch (error) {
            alert('Error submitting form');
            console.error(error);
        }
    };

    // Handle Delete Click
    const handleDeleteClick = async (id) => {
        setDeletingRoomId(id);
        try {
            const response = await apiCall(`/api/rooms/delete/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                fetchRooms();
            }
        } catch (error) {
            console.error('Error deleting room:', error);
        } finally {
            setDeletingRoomId(null);
            setPendingDeleteRoomId(null);
        }
    };

    // Room Details Panel State
    const [selectedRoomIdForPanel, setSelectedRoomIdForPanel] = useState(null);
    const [selectedRoomStatusForPanel, setSelectedRoomStatusForPanel] = useState(null);
    const [isRoomPanelOpen, setIsRoomPanelOpen] = useState(false);

    // Handle Room Click
    const handleRoomClick = (room) => {
        setSelectedRoomIdForPanel(room.id);
        setSelectedRoomStatusForPanel(room.computedStatus);
        setIsRoomPanelOpen(true);
    };

    // Handle Quick Book from Panel
    const handleQuickBook = (room) => {
        setIsRoomPanelOpen(false);

        // Extract price numerical value
        const cleanPrice = typeof room.price === 'number' ? room.price :
            (room.basePrice ? Number(room.basePrice.replace(/[^\d.-]/g, '')) : 0);

        navigate('/admin/reservation-stay-management', {
            state: {
                viewMode: 'form',
                autoOpenGuestModal: true,
                prefilledData: {
                    roomNumber: room.roomNumber,
                    roomType: room.roomType,
                    price: cleanPrice,
                    checkInDate: startDate,
                    checkOutDate: endDate,
                    capacity: room.capacity?.adults || room.capacity || 2
                }
            }
        });
    };

    return (
        <div className="room-setup-container">
            <RoomDetailsPanel
                roomId={selectedRoomIdForPanel}
                computedStatus={selectedRoomStatusForPanel}
                isOpen={isRoomPanelOpen}
                onClose={() => setIsRoomPanelOpen(false)}
                onUpdateStatus={(updatedRoom) => {
                    // Update the room in the local state
                    setRooms(prevRooms => prevRooms.map(r => r.id === updatedRoom._id ? { ...r, ...updatedRoom, id: updatedRoom._id } : r));
                }}
                onEdit={(room) => {
                    setIsRoomPanelOpen(false);
                    // RoomDetailsPanel passes the room object.
                    // We need to re-format it if needed, or ensure openModal handles it.
                    // openModal expects a room object similar to what's in the rooms list.
                    // The rooms list has 'basePrice' with '₹ ', but RoomDetailsPanel might pass raw price.

                    // Let's ensure consistency. The 'room' passed from RoomDetailsPanel is likely from /api/rooms/:id
                    // which has `price` as number.
                    // Our openModal logic handles: basePrice: room.price || room.basePrice...

                    // We need to make sure we pass the full room object that openModal expects.
                    // Ideally, we should find the room from our local state to ensure it has all the transformed UI fields
                    const roomFromState = rooms.find(r => r.id === room._id || r.id === room.id);
                    openModal('edit', roomFromState || room);
                }}
                onQuickBook={handleQuickBook}
                canManageRooms={canManageRooms}
                canBook={canBook}
                canManageStatus={canManageStatus}
            />
            {/* Header Section */}
            <header className="room-setup-header">
                <h2><span role="img" aria-label="bed">🛏️</span> Rooms Management</h2>
            </header>

            {/* Controls Bar */}
            <div className="controls-bar">
                <div className="date-range-picker-wrapper" ref={datePickerRef}>
                    <div className="date-range-picker" onClick={() => setShowDatePicker(!showDatePicker)}>
                        📅 {new Date(startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} – {new Date(endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        <span style={{ marginLeft: '10px' }}>▼</span>
                    </div>

                    {showDatePicker && (
                        <div className="date-picker-dropdown" onClick={(e) => e.stopPropagation()}>
                            <div className="calendar-container">
                                {[0, 1].map((offset) => {
                                    const monthDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + offset, 1);
                                    const monthDays = getDaysInMonth(monthDate.getFullYear(), monthDate.getMonth());

                                    return (
                                        <div key={offset} className="calendar-month">
                                            <div className="calendar-header">
                                                {offset === 0 ? (
                                                    <button className="nav-btn" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>
                                                        ‹
                                                    </button>
                                                ) : <div />}
                                                <h4>{monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h4>
                                                {offset === 1 ? (
                                                    <button className="nav-btn" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>
                                                        ›
                                                    </button>
                                                ) : <div />}
                                            </div>
                                            <div className="days-grid">
                                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                                    <div key={d} className="day-name">{d}</div>
                                                ))}
                                                {monthDays.map((date, idx) => {
                                                    if (!date) return <div key={`empty-${idx}`} className="day-cell empty" />;

                                                    const isStart = isDateSelected(date, 'start');
                                                    const isEnd = isDateSelected(date, 'end');
                                                    const inRange = isDateInRange(date);
                                                    const isPast = date.toLocaleDateString('en-CA') < new Date().toLocaleDateString('en-CA');

                                                    return (
                                                        <div
                                                            key={date.toLocaleDateString('en-CA')}
                                                            className={`day-cell ${isStart ? 'selected-start' : ''} ${isEnd ? 'selected-end' : ''} ${inRange ? 'in-range' : ''} ${isPast ? 'disabled' : ''}`}
                                                            onClick={() => !isPast && handleDateClick(date)}
                                                        >
                                                            {date.getDate()}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="calendar-footer">
                                <div className="selected-info">
                                    Selected: <b>{startDate ? new Date(startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '...'}</b>
                                    {endDate && <> to <b>{new Date(endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</b></>}
                                </div>
                                <button className="dp-apply-btn" onClick={() => setShowDatePicker(false)}>Apply</button>
                            </div>
                        </div>
                    )}
                </div>

                <select className="filter-select" value={filters.floor} onChange={(e) => setFilters({ ...filters, floor: e.target.value })}>
                    <option value="All">Floor: All</option>
                    {floors.map(floor => (
                        <option key={floor._id} value={floor.name}>{floor.name}</option>
                    ))}
                </select>

                <select className="filter-select" value={filters.roomType} onChange={(e) => setFilters({ ...filters, roomType: e.target.value })}>
                    <option value="All">Room Type: All</option>
                    {roomTypes.map(type => (
                        <option key={type._id} value={type.name}>{type.name}</option>
                    ))}
                </select>

                <select className="filter-select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                    <option value="All">Status: All</option>
                    <option value="Available">Available</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Occupied">Occupied</option>
                    <option value="Under Maintenance">Maintenance</option>
                </select>

                <div className="view-toggle">
                    <button
                        className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setViewMode('grid')}
                        title="Grid View"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                        </svg>
                    </button>
                    <button
                        className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setViewMode('list')}
                        title="List View"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="3" y1="6" x2="4" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="3" y1="12" x2="4" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="3" y1="18" x2="4" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {canManageRooms && (
                    <button className="add-room-btn" onClick={() => openModal('add')}>+ Add Room</button>
                )}
            </div>

            {/* Sub-Header Section */}
            <div className="sub-header">
                <div className="status-info-bar">
                    <span className="status-dot-green"></span>
                    Available rooms between {new Date(startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} – {new Date(endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                </div>
            </div>

            {/* Room Cards Grid/List */}
            <div className="room-setup-grid-container">
                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>Loading rooms...</div>
                ) : error ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>{error}</div>
                ) : (
                    <div className={viewMode === 'grid' ? 'room-cards-grid' : 'room-cards-list'}>
                        {filteredRooms.length > 0 ? (
                            filteredRooms.map((room) => {
                                const statusClass =
                                    room.computedStatus === 'Available' ? 'status-available' :
                                        room.computedStatus === 'Occupied' ? 'status-occupied' :
                                            room.computedStatus === 'Reserved' ? 'status-reserved' :
                                                'status-maintenance';

                                return (
                                    <div
                                        className={`room-card ${statusClass} ${pendingDeleteRoomId === room.id ? 'room-card-delete-open' : ''}`}
                                        key={room.id}
                                        onClick={() => handleRoomClick(room)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {viewMode === 'grid' ? (
                                            // Grid View
                                            <>
                                                <div className="room-card-header">
                                                    <h4>Room {room.roomNumber}</h4>
                                                    {(room.housekeepingStatus === 'dirty' || room.housekeepingStatus === 'pending') && (
                                                        <div className={`dirty-badge ${room.housekeepingStatus === 'pending' ? 'pending' : ''}`}>
                                                            {room.housekeepingStatus === 'pending' ? 'PENDING' : 'DIRTY'}
                                                        </div>
                                                    )}
                                                    <div className="card-actions">
                                                        {canManageRooms && (
                                                            <>
                                                                <button
                                                                    className="icon-btn"
                                                                    onClick={(e) => { e.stopPropagation(); openModal('edit', room); }}
                                                                    title="Edit"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <div className="room-delete-wrap" onClick={(e) => e.stopPropagation()}>
                                                                    {pendingDeleteRoomId === room.id && (
                                                                        <div className="room-delete-warning">
                                                                            <span>Are you sure want to delete?</span>
                                                                            <div className="room-delete-warning-actions">
                                                                                <button
                                                                                    type="button"
                                                                                    className="room-delete-warning-yes"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDeleteClick(room.id);
                                                                                    }}
                                                                                    title="Yes"
                                                                                >
                                                                                    Yes
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    className="room-delete-warning-no"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setPendingDeleteRoomId(null);
                                                                                    }}
                                                                                    title="No"
                                                                                >
                                                                                    No
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <button
                                                                        className="icon-btn"
                                                                        onClick={(e) => { e.stopPropagation(); setPendingDeleteRoomId(room.id); }}
                                                                        title="Delete"
                                                                        disabled={deletingRoomId === room.id}
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="room-card-body">
                                                    <div className="room-type">{room.roomType}</div>
                                                    <p className="room-info">Capacity: {room.capacity.adults} persons</p>
                                                    <p className="room-type" style={{ marginTop: 'auto' }}>{room.basePrice}/night</p>
                                                </div>
                                                <div className="room-card-footer">
                                                    <span className="status-pill">{room.computedStatus}</span>
                                                    {canBook && (
                                                        <button
                                                            className="book-btn"
                                                            onClick={(e) => { e.stopPropagation(); handleQuickBook(room); }}
                                                            disabled={room.computedStatus !== 'Available'}
                                                            style={{ opacity: room.computedStatus !== 'Available' ? 0.5 : 1 }}
                                                        >
                                                            💼 Book
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            // List View
                                            <div className="room-list-layout">
                                                <div className="room-list-number">
                                                    <h4>Room {room.roomNumber}</h4>
                                                    {(room.housekeepingStatus === 'dirty' || room.housekeepingStatus === 'pending') && (
                                                        <div className={`dirty-badge-small ${room.housekeepingStatus === 'pending' ? 'pending' : ''}`}>
                                                            {room.housekeepingStatus === 'pending' ? 'PENDING' : 'DIRTY'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="room-list-type">
                                                    <span className="label">Type</span>
                                                    <span className="value">{room.roomType}</span>
                                                </div>
                                                <div className="room-list-capacity">
                                                    <span className="label">Capacity</span>
                                                    <span className="value">{room.capacity.adults} persons</span>
                                                </div>
                                                <div className="room-list-price">
                                                    <span className="label">Price</span>
                                                    <span className="value">{room.basePrice}/night</span>
                                                </div>
                                                <div className="room-list-status">
                                                    <span className="status-pill">{room.computedStatus}</span>
                                                </div>
                                                <div className="room-list-actions">
                                                    {canBook && (
                                                        <button
                                                            className="book-btn"
                                                            onClick={(e) => { e.stopPropagation(); handleQuickBook(room); }}
                                                            disabled={room.computedStatus !== 'Available'}
                                                            style={{ opacity: room.computedStatus !== 'Available' ? 0.5 : 1 }}
                                                        >
                                                            💼 Book
                                                        </button>
                                                    )}
                                                    {canManageRooms && (
                                                        <>
                                                            <button
                                                                className="icon-btn"
                                                                onClick={(e) => { e.stopPropagation(); openModal('edit', room); }}
                                                                title="Edit"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <div className="room-delete-wrap" onClick={(e) => e.stopPropagation()}>
                                                                {pendingDeleteRoomId === room.id && (
                                                                    <div className="room-delete-warning">
                                                                        <span>Are you sure want to delete?</span>
                                                                        <div className="room-delete-warning-actions">
                                                                            <button
                                                                                type="button"
                                                                                className="room-delete-warning-yes"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteClick(room.id);
                                                                                }}
                                                                                title="Yes"
                                                                            >
                                                                                Yes
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="room-delete-warning-no"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setPendingDeleteRoomId(null);
                                                                                }}
                                                                                title="No"
                                                                            >
                                                                                No
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <button
                                                                    className="icon-btn"
                                                                    onClick={(e) => { e.stopPropagation(); setPendingDeleteRoomId(room.id); }}
                                                                    title="Delete"
                                                                    disabled={deletingRoomId === room.id}
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="no-rooms-message">No rooms found matching filters.</div>
                        )}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="legend-container">
                <div className="legend-item"><span className="legend-dot green"></span> Available</div>
                <div className="legend-item"><span className="legend-dot yellow"></span> Reserved</div>
                <div className="legend-item"><span className="legend-dot red"></span> Occupied</div>
                <div className="legend-item"><span className="legend-dot blue"></span> Maintenance</div>
            </div>

            {/* Add/Edit Modal */}
            {
                isModalOpen && (
                    <div className="add-payment-overlay" onClick={() => setIsModalOpen(false)}>
                        <div className="add-payment-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="premium-payment-header">
                                <div className="header-icon-wrap">
                                    <span role="img" aria-label="room">🏠</span>
                                </div>
                                <div className="header-text">
                                    <h3>{modalMode === 'add' ? 'Add New Room' : 'Edit Room'}</h3>
                                    <span>Room Configuration</span>
                                </div>
                                <button className="premium-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
                            </div>
                            <div className="add-payment-body">
                                <form onSubmit={handleSubmit} id="room-setup-form">
                                    <div className="payment-field-group">
                                        <label className="field-label-premium">ROOM NUMBER *</label>
                                        <div className="premium-input-wrapper">
                                            <div className="input-icon-prefix">🚪</div>
                                            <input
                                                type="text"
                                                name="roomNumber"
                                                value={formData.roomNumber}
                                                onChange={(e) => {
                                                    const cleanedValue = e.target.value.replace(/[^a-zA-Z0-9\s\-\/]/g, '');
                                                    setFormData({ ...formData, roomNumber: cleanedValue });
                                                }}
                                                required
                                                placeholder="e.g., 101, A101, Deluxe-1"
                                            />
                                        </div>
                                    </div>

                                    <div className="payment-field-group">
                                        <label className="field-label-premium">FLOOR *</label>
                                        <div className="premium-input-wrapper">
                                            <div className="input-icon-prefix">🏢</div>
                                            <select
                                                name="floor"
                                                value={formData.floor}
                                                onChange={handleInputChange}
                                                required
                                            >
                                                <option value="">-- Select Floor --</option>
                                                {floors.map(floor => (
                                                    <option key={floor._id} value={floor.name}>{floor.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="payment-field-group">
                                        <label className="field-label-premium">ROOM TYPE *</label>
                                        <div className="premium-input-wrapper">
                                            <div className="input-icon-prefix">🛌</div>
                                            <select
                                                name="roomType"
                                                value={formData.roomType}
                                                onChange={handleInputChange}
                                                required
                                            >
                                                <option value="">-- Select Room Type --</option>
                                                {roomTypes.map(type => (
                                                    <option key={type._id} value={type.name}>{type.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="payment-field-group">
                                        <label className="field-label-premium">ROOM CAPACITY *</label>
                                        <div className="premium-input-wrapper">
                                            <div className="input-icon-prefix">👥</div>
                                            <input
                                                type="number"
                                                name="capacity"
                                                value={formData.capacity}
                                                onChange={handleInputChange}
                                                required
                                                min="1"
                                                placeholder="2"
                                            />
                                        </div>
                                    </div>

                                    <div className="payment-field-group">
                                        <label className="field-label-premium">BASE PRICE ({cs}) *</label>
                                        <div className="premium-input-wrapper">
                                            <div className="input-icon-prefix">{cs}</div>
                                            <input
                                                type="number"
                                                name="basePrice"
                                                value={formData.basePrice}
                                                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                                                required
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="payment-field-group">
                                        <label className="field-label-premium">ROOM VIEW TYPE</label>
                                        <div className="premium-input-wrapper room-view-wrapper" ref={roomViewDropdownRef}>
                                            <div className="input-icon-prefix">🌅</div>
                                            <button
                                                type="button"
                                                className="room-view-trigger"
                                                onClick={() => setShowRoomViewDropdown(prev => !prev)}
                                            >
                                                <span>{formData.roomViewType || 'Select view type'}</span>
                                                <span className={`room-view-arrow ${showRoomViewDropdown ? 'open' : ''}`}>▾</span>
                                            </button>

                                            {showRoomViewDropdown && (
                                                <div className="room-view-dropdown">
                                                    <div className="room-view-options-list">
                                                        {roomViewTypes.map((viewType) => (
                                                            <div
                                                                key={viewType}
                                                                className={`room-view-option-row ${formData.roomViewType === viewType ? 'selected' : ''}`}
                                                                onClick={() => {
                                                                    setFormData(prev => ({ ...prev, roomViewType: viewType }));
                                                                    setShowRoomViewDropdown(false);
                                                                }}
                                                            >
                                                                <span className="room-view-option-text">{viewType}</span>
                                                                <button
                                                                    type="button"
                                                                    className="room-view-option-delete"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteRoomViewTypeInline(viewType);
                                                                    }}
                                                                    title="Delete this view type"
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="room-view-add-row">
                                                        <input
                                                            type="text"
                                                            value={newRoomViewType}
                                                            onChange={(e) => setNewRoomViewType(e.target.value)}
                                                            placeholder="Add new view type"
                                                            className="room-view-add-input"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleAddRoomViewTypeInline();
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="room-view-add-btn"
                                                            onClick={handleAddRoomViewTypeInline}
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="payment-field-group">
                                        <label className="field-label-premium">SMOKING POLICY</label>
                                        <div className="premium-input-wrapper">
                                            <div className="input-icon-prefix">🚭</div>
                                            <select
                                                name="smokingPolicy"
                                                value={formData.smokingPolicy}
                                                onChange={handleInputChange}
                                            >
                                                <option value="Non-Smoking">Non-Smoking</option>
                                                <option value="Smoking Allowed">Smoking Allowed</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="payment-field-group">
                                        <label className="field-label-premium">ROOM SIZE (SQ FT)</label>
                                        <div className="premium-input-wrapper">
                                            <div className="input-icon-prefix">📐</div>
                                            <input
                                                type="number"
                                                name="roomSize"
                                                value={formData.roomSize}
                                                onChange={handleInputChange}
                                                placeholder="e.g., 250"
                                            />
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div className="payment-modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    CANCEL
                                </button>
                                <button type="submit" form="room-setup-form" className="btn-primary">
                                    {modalMode === 'add' ? 'ADD ROOM' : 'UPDATE ROOM'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default RoomSetup;
