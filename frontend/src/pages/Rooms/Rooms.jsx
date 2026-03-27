import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import API_URL, { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';
import './Rooms.css';

const Rooms = () => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [filteredRooms, setFilteredRooms] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

    // Dynamic Filter State
    const [filters, setFilters] = useState({
        floor: 'All',
        roomType: 'All',
        bedType: 'All',
        status: 'All'
    });

    // Dynamic Data State
    const [roomTypes, setRoomTypes] = useState([]);
    const [bedTypes, setBedTypes] = useState([]);
    const [floors, setFloors] = useState([]);

    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [pendingDeleteRoomId, setPendingDeleteRoomId] = useState(null);
    const [deletingRoomId, setDeletingRoomId] = useState(null);

    // Status Options (Static for now, or match RoomSetup)
    const statusOptions = ['Available', 'Booked', 'Occupied', 'Under Maintenance'];

    // Custom Room Types State (Deprecated in favor of dynamic types, but kept for modal compatibility if needed, though we will try to use dynamic)
    const [customRoomTypes, setCustomRoomTypes] = useState([]);
    const [isAddingRoomType, setIsAddingRoomType] = useState(false);
    const [newRoomType, setNewRoomType] = useState('');
    const [showFloorFilterDropdown, setShowFloorFilterDropdown] = useState(false);
    const [showRoomTypeFilterDropdown, setShowRoomTypeFilterDropdown] = useState(false);
    const [showBedTypeFilterDropdown, setShowBedTypeFilterDropdown] = useState(false);
    const [showStatusFilterDropdown, setShowStatusFilterDropdown] = useState(false);
    const [showAddFloorDropdown, setShowAddFloorDropdown] = useState(false);
    const [showEditFloorDropdown, setShowEditFloorDropdown] = useState(false);

    const floorFilterDropdownRef = useRef(null);
    const roomTypeFilterDropdownRef = useRef(null);
    const bedTypeFilterDropdownRef = useRef(null);
    const statusFilterDropdownRef = useRef(null);
    const addFloorDropdownRef = useRef(null);
    const editFloorDropdownRef = useRef(null);

    // Load rooms from MongoDB API
    useEffect(() => {
        fetchRoomsFromAPI();
    }, []);

    // Auto-refresh rooms data every 60 seconds to show real-time updates
    useEffect(() => {
        const interval = setInterval(() => {
            fetchRoomsFromAPI();
        }, 60000); // Refresh every 60 seconds

        return () => clearInterval(interval);
    }, []);

    // Refresh when page becomes visible (user switches back to tab)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                fetchRoomsFromAPI();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    const fetchRoomsFromAPI = async () => {
        try {
            // Clear old localStorage data first
            localStorage.removeItem('hotelRooms');

            const response = await apiCall(`/api/rooms/list`);
            const data = await response.json();
            if (data.success) {
                setRooms(data.data);
            }
        } catch (error) {
            console.error('Error fetching rooms from database:', error);
            setRooms([]);
        }
    };

    // Fetch Room Types
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

    useEffect(() => {
        fetchRoomTypes();
        fetchBedTypes();
        fetchFloors();
    }, []);

    useEffect(() => {
        if (!pendingDeleteRoomId) return;
        const timer = setTimeout(() => setPendingDeleteRoomId(null), 5000);
        return () => clearTimeout(timer);
    }, [pendingDeleteRoomId]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (floorFilterDropdownRef.current && !floorFilterDropdownRef.current.contains(event.target)) {
                setShowFloorFilterDropdown(false);
            }
            if (roomTypeFilterDropdownRef.current && !roomTypeFilterDropdownRef.current.contains(event.target)) {
                setShowRoomTypeFilterDropdown(false);
            }
            if (bedTypeFilterDropdownRef.current && !bedTypeFilterDropdownRef.current.contains(event.target)) {
                setShowBedTypeFilterDropdown(false);
            }
            if (statusFilterDropdownRef.current && !statusFilterDropdownRef.current.contains(event.target)) {
                setShowStatusFilterDropdown(false);
            }
            if (addFloorDropdownRef.current && !addFloorDropdownRef.current.contains(event.target)) {
                setShowAddFloorDropdown(false);
            }
            if (editFloorDropdownRef.current && !editFloorDropdownRef.current.contains(event.target)) {
                setShowEditFloorDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Save draft form data to localStorage whenever it changes
    useEffect(() => {
        if (showAddModal) {
            localStorage.setItem('roomFormDraft', JSON.stringify(formData));
        }
    }, [formData, showAddModal]);

    // Filter rooms based on search and filters
    useEffect(() => {
        let filtered = [...rooms];

        // Search filter
        if (searchQuery) {
            filtered = filtered.filter(room =>
                room.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                room.roomType.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Floor Filter
        if (filters.floor !== 'All') {
            filtered = filtered.filter(room => room.floor === filters.floor);
        }

        // Room Type Filter
        if (filters.roomType !== 'All') {
            filtered = filtered.filter(room => room.roomType === filters.roomType);
        }

        // Bed Type Filter
        if (filters.bedType !== 'All') {
            filtered = filtered.filter(room => room.bedType === filters.bedType);
        }



        // Status filter
        if (filters.status !== 'All') {
            filtered = filtered.filter(room => room.status === filters.status);
        }

        setFilteredRooms(filtered);
    }, [rooms, searchQuery, filters]);

    // Get all room types for filter dropdown
    const getAllRoomTypes = () => {
        const types = ['All Types'];
        Object.values(roomTypeCategories).forEach(category => {
            types.push(...category);
        });
        types.push(...customRoomTypes);
        return types;
    };


    const handleAddRoomType = () => {
        if (!newRoomType.trim()) return;
        const type = newRoomType.trim();
        // Check if exists in predefined or custom
        const allTypes = getAllRoomTypes();
        if (!allTypes.includes(type)) {
            setCustomRoomTypes([...customRoomTypes, type]);
            setFormData({ ...formData, roomType: type });
        } else {
            setFormData({ ...formData, roomType: type });
        }
        setIsAddingRoomType(false);
        setNewRoomType('');
    };

    const handleAddFilterType = () => {
        if (!newFilterType.trim()) return;
        const type = newFilterType.trim();
        const allTypes = getAllRoomTypes();
        if (!allTypes.includes(type)) {
            setCustomRoomTypes([...customRoomTypes, type]);
            setSelectedType(type);
        } else {
            setSelectedType(type);
        }
        setIsAddingFilterType(false);
        setNewFilterType('');
    };

    const handleAddRoom = () => {
        // Load saved draft from localStorage to preserve user's work
        const draft = loadDraftData();
        setFormData(draft);
        setErrorMessage('');
        setShowAddModal(true);
    };

    const handleEditRoom = (room) => {
        setCurrentRoom(room);
        setFormData({
            roomNumber: room.roomNumber,
            roomType: room.roomType,
            floor: room.floor || '',
            price: room.price.toString(),
            capacity: room.capacity.toString()
        });
        setErrorMessage('');
        setShowEditModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        // Validate
        if (!formData.roomNumber || !formData.roomType || !formData.price || !formData.capacity || !formData.floor) {
            setErrorMessage('All fields are required');
            return;
        }

        try {
            if (showAddModal) {
                // Add new room via API
                const newRoom = {
                    roomNumber: formData.roomNumber,
                    roomType: formData.roomType,
                    capacity: parseInt(formData.capacity),
                    price: parseInt(formData.price),
                    status: 'Available',
                    floor: formData.floor
                };

                const response = await apiCall(`/api/rooms/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newRoom)
                });

                const data = await response.json();

                if (!data.success) {
                    setErrorMessage(data.message || 'Failed to add room');
                    return;
                }

                await fetchRoomsFromAPI();
                setShowAddModal(false);
            } else if (showEditModal) {
                // Edit existing room via API
                const updatedRoom = {
                    roomNumber: formData.roomNumber,
                    roomType: formData.roomType,
                    capacity: parseInt(formData.capacity),
                    price: parseInt(formData.price),
                    floor: formData.floor
                };

                const response = await apiCall(`/api/rooms/update/${currentRoom._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedRoom)
                });

                const data = await response.json();

                if (!data.success) {
                    setErrorMessage(data.message || 'Failed to update room');
                    return;
                }

                await fetchRoomsFromAPI();
                setShowEditModal(false);
            }

            // Clear form data and draft only after successful submission
            const emptyForm = { roomNumber: '', roomType: '', price: '', capacity: '', floor: '' };
            setFormData(emptyForm);
            localStorage.setItem('roomFormDraft', JSON.stringify(emptyForm));
            setCurrentRoom(null);
            setIsAddingRoomType(false);
            setNewRoomType('');
        } catch (error) {
            console.error('Error submitting room:', error);
            setErrorMessage('Failed to save room. Please try again.');
        }
    };

    const handleDeleteRoom = async (room) => {
        const roomId = room?._id || room?.id;
        if (!roomId) return;

        setDeletingRoomId(roomId);
        try {
            const response = await apiCall(`/api/rooms/delete/${roomId}`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                await fetchRoomsFromAPI();
            }
        } catch (error) {
            console.error('Error deleting room:', error);
        } finally {
            setDeletingRoomId(null);
            setPendingDeleteRoomId(null);
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Available':
                return 'status-available';
            case 'Booked':
                return 'status-booked';
            case 'Occupied':
                return 'status-occupied';
            case 'Under Maintenance':
                return 'status-maintenance';
            default:
                return '';
        }
    };

    const getRoomTypeShort = (roomType) => {
        return roomType.replace('Room', '').trim();
    };

    const floorFilterLabel = filters.floor === 'All' ? 'Floor: All' : filters.floor;
    const roomTypeFilterLabel = filters.roomType === 'All' ? 'Room Type: All' : filters.roomType;
    const bedTypeFilterLabel = filters.bedType === 'All' ? 'Bed Type: All' : filters.bedType;
    const statusFilterLabel = filters.status === 'All' ? 'Status: All' : filters.status;

    return (
        <div className="rooms-page">
            <style>{`
                /* Force visibility for all form inputs and selects in Rooms page */
                .rooms-page input,
                .rooms-page input[type="text"],
                .rooms-page input[type="number"],
                .rooms-page select,
                .rooms-page textarea,
                .room-modal input,
                .room-modal input[type="text"],
                .room-modal input[type="number"],
                .room-modal select,
                .room-modal .form-input,
                .room-modal select.form-input,
                .room-modal input.form-input {
                    color: #000000 !important;
                    -webkit-text-fill-color: #000000 !important;
                    font-weight: 600 !important;
                    background-color: #ffffff !important;
                    opacity: 1 !important;
                }
                
                .rooms-page select option,
                .room-modal select option {
                    color: #000000 !important;
                    background-color: #ffffff !important;
                    font-weight: 600 !important;
                }
                
                .rooms-page select optgroup,
                .room-modal select optgroup {
                    color: #000000 !important;
                    background-color: #f3f4f6 !important;
                    font-weight: 700 !important;
                }
                
                .rooms-page input::placeholder,
                .room-modal input::placeholder {
                    color: #9ca3af !important;
                    -webkit-text-fill-color: #9ca3af !important;
                    opacity: 0.7 !important;
                }
                
                .rooms-page input:-webkit-autofill,
                .room-modal input:-webkit-autofill {
                    -webkit-box-shadow: 0 0 0 1000px white inset !important;
                    -webkit-text-fill-color: #000000 !important;
                }
            `}</style>
            {/* Header */}
            <div className="rooms-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate('/admin/dashboard')}>
                        ←
                    </button>
                    <h1>🛏️ Rooms</h1>
                </div>
                <div className="header-right">
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
                    <button className="add-room-btn" onClick={handleAddRoom}>
                        + Add Room
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="rooms-controls">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Search room..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                    />
                </div>

                <div className="filters-row" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="filter-dropdown" ref={floorFilterDropdownRef}>
                        <button
                            type="button"
                            className="filter-dropdown-trigger"
                            onClick={() => setShowFloorFilterDropdown((prev) => !prev)}
                            aria-expanded={showFloorFilterDropdown}
                        >
                            <span>{floorFilterLabel}</span>
                            <span className={`filter-dropdown-arrow ${showFloorFilterDropdown ? 'open' : ''}`}>▼</span>
                        </button>
                        {showFloorFilterDropdown && (
                            <div className="filter-dropdown-options">
                                <button type="button" className="filter-dropdown-option" onClick={() => { setFilters({ ...filters, floor: 'All' }); setShowFloorFilterDropdown(false); }}>
                                    Floor: All
                                </button>
                                {floors.map((floor) => (
                                    <button
                                        type="button"
                                        key={floor._id}
                                        className="filter-dropdown-option"
                                        onClick={() => { setFilters({ ...filters, floor: floor.name }); setShowFloorFilterDropdown(false); }}
                                    >
                                        {floor.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="filter-dropdown" ref={roomTypeFilterDropdownRef}>
                        <button
                            type="button"
                            className="filter-dropdown-trigger"
                            onClick={() => setShowRoomTypeFilterDropdown((prev) => !prev)}
                            aria-expanded={showRoomTypeFilterDropdown}
                        >
                            <span>{roomTypeFilterLabel}</span>
                            <span className={`filter-dropdown-arrow ${showRoomTypeFilterDropdown ? 'open' : ''}`}>▼</span>
                        </button>
                        {showRoomTypeFilterDropdown && (
                            <div className="filter-dropdown-options">
                                <button type="button" className="filter-dropdown-option" onClick={() => { setFilters({ ...filters, roomType: 'All' }); setShowRoomTypeFilterDropdown(false); }}>
                                    Room Type: All
                                </button>
                                {roomTypes.map((type) => (
                                    <button
                                        type="button"
                                        key={type._id}
                                        className="filter-dropdown-option"
                                        onClick={() => { setFilters({ ...filters, roomType: type.name }); setShowRoomTypeFilterDropdown(false); }}
                                    >
                                        {type.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="filter-dropdown" ref={bedTypeFilterDropdownRef}>
                        <button
                            type="button"
                            className="filter-dropdown-trigger"
                            onClick={() => setShowBedTypeFilterDropdown((prev) => !prev)}
                            aria-expanded={showBedTypeFilterDropdown}
                        >
                            <span>{bedTypeFilterLabel}</span>
                            <span className={`filter-dropdown-arrow ${showBedTypeFilterDropdown ? 'open' : ''}`}>▼</span>
                        </button>
                        {showBedTypeFilterDropdown && (
                            <div className="filter-dropdown-options">
                                <button type="button" className="filter-dropdown-option" onClick={() => { setFilters({ ...filters, bedType: 'All' }); setShowBedTypeFilterDropdown(false); }}>
                                    Bed Type: All
                                </button>
                                {bedTypes.map((type) => (
                                    <button
                                        type="button"
                                        key={type._id}
                                        className="filter-dropdown-option"
                                        onClick={() => { setFilters({ ...filters, bedType: type.name }); setShowBedTypeFilterDropdown(false); }}
                                    >
                                        {type.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="filter-dropdown" ref={statusFilterDropdownRef}>
                        <button
                            type="button"
                            className="filter-dropdown-trigger"
                            onClick={() => setShowStatusFilterDropdown((prev) => !prev)}
                            aria-expanded={showStatusFilterDropdown}
                        >
                            <span>{statusFilterLabel}</span>
                            <span className={`filter-dropdown-arrow ${showStatusFilterDropdown ? 'open' : ''}`}>▼</span>
                        </button>
                        {showStatusFilterDropdown && (
                            <div className="filter-dropdown-options">
                                <button type="button" className="filter-dropdown-option" onClick={() => { setFilters({ ...filters, status: 'All' }); setShowStatusFilterDropdown(false); }}>
                                    Status: All
                                </button>
                                {statusOptions.map((status) => (
                                    <button
                                        type="button"
                                        key={status}
                                        className="filter-dropdown-option"
                                        onClick={() => { setFilters({ ...filters, status }); setShowStatusFilterDropdown(false); }}
                                    >
                                        {status === 'Under Maintenance' ? 'Maintenance' : status}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Rooms Grid/List */}
            <div className={viewMode === 'grid' ? 'rooms-grid' : 'rooms-list'}>
                <AnimatePresence>
                    {filteredRooms.map((room) => {
                        const roomId = room._id || room.id;
                        return (
                            <motion.div
                                key={roomId}
                                className={`${viewMode === 'grid' ? 'room-card' : 'room-list-item'} ${getStatusClass(room.status)} ${pendingDeleteRoomId === roomId ? 'room-card-delete-open' : ''}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                {viewMode === 'grid' ? (
                                    // Grid View
                                    <>
                                        <div className="room-card-header">
                                            <h3>Room {room.roomNumber}</h3>
                                            <div className="room-card-actions-top" onClick={(e) => e.stopPropagation()}>
                                                {room.status === 'Available' && (
                                                    <button className="icon-btn" onClick={() => handleEditRoom(room)} title="Edit">
                                                        ✏️
                                                    </button>
                                                )}
                                                <div className="room-delete-wrap">
                                                    {pendingDeleteRoomId === roomId && (
                                                        <div className="room-delete-warning">
                                                            <span>Are you sure want to delete?</span>
                                                            <div className="room-delete-warning-actions">
                                                                <button
                                                                    type="button"
                                                                    className="room-delete-warning-yes"
                                                                    onClick={() => handleDeleteRoom(room)}
                                                                    disabled={deletingRoomId === roomId}
                                                                    title="Yes"
                                                                >
                                                                    Yes
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="room-delete-warning-no"
                                                                    onClick={() => setPendingDeleteRoomId(null)}
                                                                    title="No"
                                                                >
                                                                    No
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <button
                                                        className="icon-btn"
                                                        onClick={() => setPendingDeleteRoomId(roomId)}
                                                        title="Delete"
                                                        disabled={deletingRoomId === roomId}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="room-card-body">
                                            <p className="room-type">{getRoomTypeShort(room.roomType)}</p>
                                            {(room.roomViewType || room.smokingPolicy) && (
                                                <p className="room-details-extra">
                                                    {room.roomViewType && `${room.roomViewType}`}
                                                    {room.roomViewType && room.smokingPolicy && ' | '}
                                                    {room.smokingPolicy && `${room.smokingPolicy}`}
                                                    {room.isSmartRoom && ' ⚡'}
                                                </p>
                                            )}
                                            <p className="room-capacity">Capacity: {room.capacity} persons</p>
                                            <p className="room-price">{cs}{room.price}/night</p>
                                        </div>
                                        <div className="room-card-footer">
                                            <span className={`room-status ${getStatusClass(room.status)}`}>
                                                {room.status}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    // List View
                                    <>
                                        <div className="room-list-main">
                                            <div className="room-list-number">
                                                <h3>Room {room.roomNumber}</h3>
                                            </div>
                                            <div className="room-list-type">
                                                <span className="label">Type</span>
                                                <span className="value">{getRoomTypeShort(room.roomType)}</span>
                                            </div>
                                            <div className="room-list-capacity">
                                                <span className="label">Capacity</span>
                                                <span className="value">{room.capacity} persons</span>
                                            </div>
                                            <div className="room-list-price">
                                                <span className="label">Price</span>
                                                <span className="value">{cs}{room.price}/night</span>
                                            </div>
                                            <div className="room-list-status">
                                                <span className={`room-status ${getStatusClass(room.status)}`}>
                                                    {room.status}
                                                </span>
                                            </div>
                                            <div className="room-list-actions">
                                                {room.status === 'Available' && (
                                                    <button className="edit-btn" onClick={() => handleEditRoom(room)}>
                                                        ✏️ Edit
                                                    </button>
                                                )}
                                                <div className="room-delete-wrap" onClick={(e) => e.stopPropagation()}>
                                                    {pendingDeleteRoomId === roomId && (
                                                        <div className="room-delete-warning">
                                                            <span>Are you sure want to delete?</span>
                                                            <div className="room-delete-warning-actions">
                                                                <button
                                                                    type="button"
                                                                    className="room-delete-warning-yes"
                                                                    onClick={() => handleDeleteRoom(room)}
                                                                    disabled={deletingRoomId === roomId}
                                                                    title="Yes"
                                                                >
                                                                    Yes
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="room-delete-warning-no"
                                                                    onClick={() => setPendingDeleteRoomId(null)}
                                                                    title="No"
                                                                >
                                                                    No
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <button
                                                        className="icon-btn"
                                                        onClick={() => setPendingDeleteRoomId(roomId)}
                                                        title="Delete"
                                                        disabled={deletingRoomId === roomId}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {filteredRooms.length === 0 && (
                <div className="no-rooms">
                    <p>No rooms found</p>
                </div>
            )}

            {/* Add Room Modal */}
            {showAddModal && (
                <div className="add-payment-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="add-payment-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <span role="img" aria-label="room">🏠</span>
                            </div>
                            <div className="header-text">
                                <h3>Add New Room</h3>
                                <span>Room Configuration</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => setShowAddModal(false)}>×</button>
                        </div>

                        {errorMessage && (
                            <div className="error-alert">
                                ⚠️ {errorMessage}
                            </div>
                        )}

                        <div className="add-payment-body">
                            <form onSubmit={handleSubmit} id="add-room-form">
                                <div className="payment-field-group">
                                    <label className="field-label-premium">ROOM NUMBER *</label>
                                    <div className="premium-input-wrapper">
                                        <div className="input-icon-prefix">🚪</div>
                                        <input
                                            type="text"
                                            placeholder="e.g., 101, 102"
                                            value={formData.roomNumber}
                                            onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value.replace(/\D/g, '') })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">FLOOR *</label>
                                    <div className="premium-input-wrapper" ref={addFloorDropdownRef}>
                                        <div className="input-icon-prefix">🏢</div>
                                        <button
                                            type="button"
                                            className="premium-dropdown-trigger"
                                            onClick={() => setShowAddFloorDropdown((prev) => !prev)}
                                            aria-expanded={showAddFloorDropdown}
                                        >
                                            <span>{formData.floor || '-- Select Floor --'}</span>
                                            <span className={`filter-dropdown-arrow ${showAddFloorDropdown ? 'open' : ''}`}>▼</span>
                                        </button>
                                        {showAddFloorDropdown && (
                                            <div className="premium-dropdown-options">
                                                <button type="button" className="premium-dropdown-option" onClick={() => { setFormData({ ...formData, floor: '' }); setShowAddFloorDropdown(false); }}>
                                                    -- Select Floor --
                                                </button>
                                                {floors.map((floor) => (
                                                    <button
                                                        type="button"
                                                        key={floor._id}
                                                        className="premium-dropdown-option"
                                                        onClick={() => { setFormData({ ...formData, floor: floor.name }); setShowAddFloorDropdown(false); }}
                                                    >
                                                        {floor.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">ROOM TYPE *</label>
                                    <div className="premium-input-wrapper">
                                        <div className="input-icon-prefix">🛌</div>
                                        {!isAddingRoomType ? (
                                            <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                                                <select
                                                    value={formData.roomType}
                                                    onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                                                    style={{ flex: 1 }}
                                                    required
                                                >
                                                    <option value="">-- Select Room Type --</option>
                                                    {Object.entries(roomTypeCategories).map(([category, types]) => (
                                                        <optgroup key={category} label={category}>
                                                            {types.map(type => (
                                                                <option key={type} value={type}>{type}</option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                    {customRoomTypes.length > 0 && (
                                                        <optgroup label="Custom Types">
                                                            {customRoomTypes.map(type => (
                                                                <option key={type} value={type}>{type}</option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                </select>
                                                <button
                                                    type="button"
                                                    className="btn-primary"
                                                    onClick={() => setIsAddingRoomType(true)}
                                                    style={{ width: '42px', height: '42px', padding: '0', display: 'flex', alignItems: 'center', justifySelf: 'center', marginTop: '4px', marginRight: '4px', borderRadius: '8px' }}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '8px', flex: 1, padding: '4px' }}>
                                                <input
                                                    type="text"
                                                    placeholder="Enter new room type..."
                                                    value={newRoomType}
                                                    onChange={(e) => setNewRoomType(e.target.value)}
                                                    autoFocus
                                                    style={{ flex: 1 }}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn-primary"
                                                    onClick={handleAddRoomType}
                                                    style={{ width: '36px', height: '36px', padding: '0', borderRadius: '8px' }}
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-secondary"
                                                    onClick={() => { setIsAddingRoomType(false); setNewRoomType(''); }}
                                                    style={{ width: '36px', height: '36px', padding: '0', borderRadius: '8px' }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">PRICE PER NIGHT ({cs}) *</label>
                                    <div className="premium-input-wrapper">
                                        <div className="input-icon-prefix">{cs}</div>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={formData.price}
                                            onChange={(e) => {
                                                const val = Math.max(0, Number(e.target.value));
                                                setFormData({ ...formData, price: val.toString() });
                                            }}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">ROOM CAPACITY *</label>
                                    <div className="premium-input-wrapper">
                                        <div className="input-icon-prefix">👥</div>
                                        <input
                                            type="number"
                                            placeholder="1"
                                            value={formData.capacity}
                                            onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="payment-modal-footer">
                            <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                                CANCEL
                            </button>
                            <button type="submit" form="add-room-form" className="btn-primary">
                                ADD ROOM
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Room Modal */}
            {showEditModal && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <motion.div
                        className="modal-content room-modal"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h2>Edit Room</h2>
                            <button className="modal-close" onClick={() => setShowEditModal(false)}>
                                ✕
                            </button>
                        </div>

                        {errorMessage && (
                            <div className="error-alert">
                                ⚠️ {errorMessage}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>ROOM NUMBER *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., 101, 102"
                                    value={formData.roomNumber}
                                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value.replace(/\D/g, '') })}
                                />
                            </div>

                            <div className="form-group">
                                <label>FLOOR *</label>
                                <div className="edit-floor-dropdown" ref={editFloorDropdownRef}>
                                    <button
                                        type="button"
                                        className="edit-floor-dropdown-trigger"
                                        onClick={() => setShowEditFloorDropdown((prev) => !prev)}
                                        aria-expanded={showEditFloorDropdown}
                                    >
                                        <span>{formData.floor || '-- Select Floor --'}</span>
                                        <span className={`filter-dropdown-arrow ${showEditFloorDropdown ? 'open' : ''}`}>▼</span>
                                    </button>
                                    {showEditFloorDropdown && (
                                        <div className="edit-floor-dropdown-options">
                                            <button type="button" className="edit-floor-dropdown-option" onClick={() => { setFormData({ ...formData, floor: '' }); setShowEditFloorDropdown(false); }}>
                                                -- Select Floor --
                                            </button>
                                            {floors.map((floor) => (
                                                <button
                                                    type="button"
                                                    key={floor._id}
                                                    className="edit-floor-dropdown-option"
                                                    onClick={() => { setFormData({ ...formData, floor: floor.name }); setShowEditFloorDropdown(false); }}
                                                >
                                                    {floor.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>ROOM TYPE *</label>
                                {!isAddingRoomType ? (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <select
                                            className="form-input"
                                            value={formData.roomType}
                                            onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                                            style={{ flex: 1 }}
                                        >
                                            <option value="">-- Select Room Type --</option>
                                            {Object.entries(roomTypeCategories).map(([category, types]) => (
                                                <optgroup key={category} label={category}>
                                                    {types.map(type => (
                                                        <option key={type} value={type}>{type}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                            {customRoomTypes.length > 0 && (
                                                <optgroup label="Custom Types">
                                                    {customRoomTypes.map(type => (
                                                        <option key={type} value={type}>{type}</option>
                                                    ))}
                                                </optgroup>
                                            )}
                                        </select>
                                        <button
                                            type="button"
                                            className="add-room-btn"
                                            onClick={() => setIsAddingRoomType(true)}
                                            style={{ width: '42px', padding: '0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            +
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Enter new room type..."
                                            value={newRoomType}
                                            onChange={(e) => setNewRoomType(e.target.value)}
                                            autoFocus
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            type="button"
                                            className="btn-submit"
                                            onClick={handleAddRoomType}
                                            style={{ width: '42px', padding: '0' }}
                                        >
                                            ✓
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-cancel"
                                            onClick={() => { setIsAddingRoomType(false); setNewRoomType(''); }}
                                            style={{ width: '42px', padding: '0' }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label>PRICE PER NIGHT ({cs}) *</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="0"
                                    value={formData.price}
                                    onChange={(e) => {
                                        const val = Math.max(0, Number(e.target.value));
                                        setFormData({ ...formData, price: val.toString() });
                                    }}
                                />
                            </div>

                            <div className="form-group">
                                <label>ROOM CAPACITY *</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="1"
                                    value={formData.capacity}
                                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setShowEditModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-submit">
                                    Update Room
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default Rooms;

