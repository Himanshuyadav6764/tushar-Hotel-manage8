import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API_URL, { apiCall } from '../config/api';
import RoomDetailsPanel from './rooms/RoomDetailsPanel';
import './StayOverview.css';
import './StayOverviewModals.css';
import { useSettings } from '../context/SettingsContext';

const StayOverview = () => {
    const navigate = useNavigate();
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [rooms, setRooms] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState('2026-02-01'); // Start from Feb 1st 2026 as per image
    const timelineRef = useRef(null);

    // Navigation handlers
    const handleNavigateToReservation = () => {
        // Navigate to reservation page with 'form' view (Create New Reservation)
        navigate('/admin/reservation-stay-management', { state: { viewMode: 'form' } });
    };

    const handleNavigateToViewReservation = () => {
        // Navigate to reservation page with 'dashboard' view (View Reservations)
        navigate('/admin/reservation-stay-management', { state: { viewMode: 'dashboard' } });
    };

    const handleNavigateToRoomService = () => {
        // Navigate to reservation page with 'roomservice' view
        navigate('/admin/reservation-stay-management', { state: { viewMode: 'roomservice' } });
    };

    const handleNavigateToCRMModel = () => {
        navigate('/admin/crm-model');
    };

    // Date navigation handlers
    const handleToday = () => {
        const today = new Date();
        const formattedDate = today.toLocaleDateString('en-CA');
        setSelectedDate(formattedDate);
    };

    const handlePrevious = () => {
        const currentDate = new Date(selectedDate);
        currentDate.setDate(currentDate.getDate() - 1);
        const formattedDate = currentDate.toLocaleDateString('en-CA');
        setSelectedDate(formattedDate);
    };

    const handleNext = () => {
        const currentDate = new Date(selectedDate);
        currentDate.setDate(currentDate.getDate() + 1);
        const formattedDate = currentDate.toLocaleDateString('en-CA');
        setSelectedDate(formattedDate);
    };

    // Modal states for Quick Reservation flow
    const [showDateModal, setShowDateModal] = useState(false);
    const [showQuickReservationModal, setShowQuickReservationModal] = useState(false);
    const [selectedCellData, setSelectedCellData] = useState({
        date: '',
        roomNumber: '',
        roomType: '',
        price: 0
    });
    const [quickReservationData, setQuickReservationData] = useState({
        arrivalDate: '',
        arrivalTime: '01:51 PM',
        departureDate: '',
        departureTime: '01:51 PM',
        category: '',
        roomNumber: ''
    });

    // Room Details Panel states
    const [selectedRoomIdForPanel, setSelectedRoomIdForPanel] = useState(null);
    const [isRoomPanelOpen, setIsRoomPanelOpen] = useState(false);

    // Handle clicking on an available date cell
    const handleDateCellClick = (date, room) => {
        // Only allow clicking on available (empty) cells
        const reservation = getReservationForRoomDate(room.roomNumber, date);
        if (reservation) return; // Cell is occupied, don't open modal

        const formattedDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;

        setSelectedCellData({
            date: formattedDate,
            roomNumber: room.roomNumber,
            roomType: room.roomType || 'Standard Room',
            price: room.price || 0
        });
        setShowDateModal(true);
    };

    // Handle "Quick Reservation" button click from Date Modal
    const handleQuickReservationClick = () => {
        // Pre-fill quick reservation form with selected cell data
        const dateObj = new Date(selectedCellData.date.split('-').reverse().join('-'));
        const arrivalDate = dateObj.toLocaleDateString('en-CA');

        // Set departure date to next day
        const departureObj = new Date(dateObj);
        departureObj.setDate(departureObj.getDate() + 1);
        const departureDate = departureObj.toLocaleDateString('en-CA');

        setQuickReservationData({
            arrivalDate,
            arrivalTime: '01:51 PM',
            departureDate,
            departureTime: '01:51 PM',
            category: selectedCellData.roomType,
            roomNumber: selectedCellData.roomNumber
        });

        setShowDateModal(false);
        setShowQuickReservationModal(true);
    };

    // Handle "Confirm" button click from Quick Reservation Modal
    const handleQuickReservationConfirm = () => {
        // Navigate to Create New Reservation with pre-filled data
        navigate('/admin/reservation-stay-management', {
            state: {
                viewMode: 'form',
                autoOpenGuestModal: true, // Auto-open guest creation modal
                prefilledData: {
                    checkInDate: quickReservationData.arrivalDate,
                    checkInTime: quickReservationData.arrivalTime,
                    checkOutDate: quickReservationData.departureDate,
                    checkOutTime: quickReservationData.departureTime,
                    roomType: quickReservationData.category,
                    roomNumber: quickReservationData.roomNumber
                }
            }
        });
    };

    // Handle "Cancel" button click
    const handleModalCancel = () => {
        setShowDateModal(false);
        setShowQuickReservationModal(false);
        setSelectedCellData({
            date: '',
            roomNumber: '',
            roomType: '',
            price: 0
        });
        setQuickReservationData({
            arrivalDate: '',
            arrivalTime: '01:51 PM',
            departureDate: '',
            departureTime: '01:51 PM',
            category: '',
        });
    };

    const handleRoomClick = (room) => {
        setSelectedRoomIdForPanel(room._id);
        setIsRoomPanelOpen(true);
    };

    const handleUpdateRoomStatus = (updatedRoom) => {
        setRooms(prevRooms => prevRooms.map(r => r._id === updatedRoom._id ? updatedRoom : r));
    };

    const handleEditRoomFromPanel = (room) => {
        setIsRoomPanelOpen(false);
        // Navigate to room setup or open edit modal if available here
        navigate('/admin/rooms', { state: { editRoomId: room._id } });
    };

    const handleQuickBookFromPanel = (room) => {
        setIsRoomPanelOpen(false);
        // Navigate to create reservation with prefilled room and selected dates
        navigate('/admin/reservation-stay-management', {
            state: {
                viewMode: 'form',
                autoOpenGuestModal: true,
                prefilledData: {
                    roomNumber: room.roomNumber,
                    roomType: room.roomType,
                    price: room.price,
                    checkInDate: selectedDate, // Start date of current view
                    checkOutDate: new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() + 1)).toLocaleDateString('en-CA')
                }
            }
        });
    };

    // Timeline Configuration
    const daysToShow = 25;
    const startDate = useMemo(() => {
        const d = new Date(selectedDate);
        return d;
    }, [selectedDate]);

    const dateRange = useMemo(() => {
        const dates = [];
        for (let i = 0; i < daysToShow; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            dates.push(d);
        }
        return dates;
    }, [startDate]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [roomsRes, bookingsRes, reservationsRes] = await Promise.all([
                apiCall(`/api/rooms/list`),
                apiCall(`/api/bookings/list`),
                apiCall(`/api/reservations/list`)
            ]);

            const roomsData = await roomsRes.json();
            const bookingsData = await bookingsRes.json();
            const reservationsData = await reservationsRes.json();

            console.log('📊 Fetched Rooms:', roomsData.data?.length || 0);
            console.log('📊 Fetched Bookings:', bookingsData.data?.length || 0);
            console.log('📊 Fetched Reservations:', reservationsData.data?.length || 0);

            if (roomsData.success && roomsData.data) {
                // Mark rooms as dirty based on status or random for demo
                const updatedRooms = roomsData.data.map((r, i) => ({
                    ...r,
                    isDirty: r.status === 'Dirty' || (i % 7 === 0 && r.status === 'Available')
                }));
                setRooms(updatedRooms);

                // Log room prices for debugging
                console.log('💰 Room Prices Loaded:');
                updatedRooms.forEach(r => {
                    console.log(`  Room ${r.roomNumber} (${r.roomType}): ${cs}${r.price || 'NOT SET'}`);
                });
            }

            let allBookings = [];
            const uniqueIds = new Set();

            // Helper to add unique records
            const addUniqueBookings = (data, isReservation = false) => {
                if (!data || !Array.isArray(data)) return;

                data.forEach(item => {
                    if (item._id && !uniqueIds.has(item._id)) {
                        uniqueIds.add(item._id);

                        const mappedItem = {
                            ...item,
                            bookingId: item.bookingId || item.referenceId || item._id,
                            guestName: item.guestName,
                            roomNumber: item.roomNumber || 'TBD',
                            numberOfNights: item.numberOfNights || item.nights ||
                                Math.ceil((new Date(item.checkOutDate) - new Date(item.checkInDate)) / (1000 * 60 * 60 * 24)) || 1,
                            checkInDate: item.checkInDate,
                            checkOutDate: item.checkOutDate,
                            status: item.status
                        };

                        if (isReservation) {
                            mappedItem.mobileNumber = item.phone;
                        }

                        allBookings.push(mappedItem);
                    }
                });
            };

            // Add bookings
            if (bookingsData.success) {
                addUniqueBookings(bookingsData.data);
            }

            // Add reservations (new endpoint)
            if (reservationsData.success) {
                addUniqueBookings(reservationsData.data, true);
            }

            console.log('📊 Total Unique Combined Bookings:', allBookings.length);
            setReservations(allBookings);
        } catch (error) {
            console.error('❌ Error fetching stay overview data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate Stats - LIVE from actual data
    const stats = useMemo(() => {
        const totalRooms = rooms.length;

        // 1. Count All Reserved (Future Bookings that haven't checked in)
        const reservedList = reservations.filter(r =>
            ['Upcoming', 'RESERVED', 'Confirmed', 'Reserved'].includes(r.status)
        );
        const reservedCount = reservedList.length;

        // 2. Count All In-House (Guests currently checked in)
        const inHouseList = reservations.filter(r =>
            ['Checked-in', 'IN_HOUSE', 'CheckedIn'].includes(r.status)
        );
        const inHouseCount = inHouseList.length;

        // 3. Calculate Vacant (Proper PMS logic: Total - Reserved - InHouse)
        // If a room has multiple reservations, this might go negative, so we clamp at 0
        const vacantCount = Math.max(0, totalRooms - reservedCount - inHouseCount);

        // 4. Dirty Rooms
        const dirtyCount = rooms.filter(r => r.isDirty || r.status === 'Dirty').length;

        // 5. Checkouts Today (Based on selected calendar date)
        const targetDate = new Date(selectedDate);
        targetDate.setHours(0, 0, 0, 0);
        const targetDateStr = targetDate.toLocaleDateString('en-CA');

        const checkoutCount = reservations.filter(r => {
            const checkOutDate = new Date(r.checkOutDate).toLocaleDateString('en-CA');
            return checkOutDate === targetDateStr && ['Checked-in', 'IN_HOUSE', 'CheckedIn'].includes(r.status);
        }).length;

        // 6. Functional Overdue Calculation
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const overdueCount = reservations.filter(r => {
            const checkIn = new Date(r.checkInDate);
            const checkOut = new Date(r.checkOutDate);
            checkIn.setHours(0, 0, 0, 0);
            checkOut.setHours(0, 0, 0, 0);

            // Case 1: Reserved but arrival date passed
            const isLateArrival = ['Upcoming', 'RESERVED', 'Confirmed', 'Reserved'].includes(r.status) && checkIn < today;
            // Case 2: In-house but departure date passed
            const isLateDeparture = ['Checked-in', 'IN_HOUSE', 'CheckedIn'].includes(r.status) && checkOut < today;

            return isLateArrival || isLateDeparture;
        }).length;

        return {
            all: totalRooms,
            vacant: vacantCount,
            inHouse: inHouseCount,
            reserved: reservedCount,
            overdue: overdueCount,
            checkout: checkoutCount,
            dirty: dirtyCount
        };
    }, [rooms, reservations, selectedDate]);

    // Group rooms by category - LIVE from actual room types
    const groupedRooms = useMemo(() => {
        if (rooms.length === 0) return {};

        const groups = {};
        rooms.forEach(room => {
            const cat = room.roomType || 'Standard Room';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(room);
        });

        return groups;
    }, [rooms]);

    const getReservationForRoomDate = (roomNumber, date) => {
        return reservations.find(res => {
            const hasRoom = res.roomNumber === roomNumber ||
                (res.rooms && res.rooms.some(r => r.roomNumber === roomNumber));

            const checkIn = new Date(res.checkInDate);
            const checkOut = new Date(res.checkOutDate);
            const d = new Date(date);

            d.setHours(0, 0, 0, 0);
            checkIn.setHours(0, 0, 0, 0);
            checkOut.setHours(0, 0, 0, 0);

            return hasRoom && d >= checkIn && d < checkOut;
        });
    };

    if (loading) return <div className="stay-overview-loading">Loading Stay Overview...</div>;

    return (
        <div className="stay-overview-container">
            {/* Top Navigation Bar */}
            <div className="stay-top-nav">
                <div className="date-selector-wrapper">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="date-picker-input-modern"
                    />
                </div>

                <div className="nav-buttons-group">
                    <button className="nav-btn nav-btn-reservation" onClick={handleNavigateToReservation}>Reservation</button>
                    <button className="nav-btn nav-btn-view" onClick={handleNavigateToViewReservation}>View Reservation</button>
                    <button className="nav-btn nav-btn-room-service" onClick={handleNavigateToRoomService}>Room Service</button>
                    <button className="nav-gear-btn" onClick={handleNavigateToCRMModel} title="Open CRM Model">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                        <span style={{ marginLeft: '4px' }}>◆</span>
                    </button>
                </div>
            </div>

            {/* Status Filters Bar */}
            <div className="status-filters-bar">
                <div className="status-pill all">
                    ALL <span className="count-mini">{stats.all}</span>
                </div>
                <div className="status-pill vacant">
                    VACANT ({stats.vacant}) <span className="count-circle">{stats.vacant}</span>
                </div>
                <div className="status-pill in-house">
                    IN HOUSE <span className="count-circle">{stats.inHouse}</span>
                </div>
                <div className="status-pill reserved">
                    RESERVED <span className="count-circle">{stats.reserved}</span>
                </div>
                <div className="status-pill overdue">
                    OVER DUE <span className="count-circle">{stats.overdue}</span>
                </div>
                <div className="status-pill dirty">
                    DIRTY <span className="count-circle">{stats.dirty}</span>
                </div>

                <div className="timeline-nav-group">
                    <button className="timeline-action-btn" onClick={handleToday}>Today</button>
                    <button className="timeline-action-btn previous" onClick={handlePrevious}>Previous</button>
                    <button className="timeline-action-btn next" onClick={handleNext}>Next</button>
                </div>
            </div>

            {/* Main Timeline Table */}
            <div className="timeline-grid-wrapper" ref={timelineRef}>
                <table className="timeline-table">
                    <thead>
                        <tr>
                            <th className="room-col-header sticky-left"></th>
                            {dateRange.map((date, idx) => (
                                <th key={idx} className="date-header_cell">
                                    <div className="date-header_content">
                                        <div className="day-name_mini">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                        <div className="day-num_large">{date.getDate()}</div>
                                        <div className="month-name_mini">{date.toLocaleDateString('en-US', { month: 'short' })}</div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(groupedRooms).map(([category, catRooms]) => (
                            <React.Fragment key={category}>
                                <tr className="category-row">
                                    <td className="sticky-left category-name_cell">
                                        <span className="warning-icon_red">⚠️</span> {category}
                                    </td>
                                    {dateRange.map((_, idx) => {
                                        // Calculate average price for this category
                                        const avgPrice = catRooms.length > 0
                                            ? Math.round(catRooms.reduce((sum, r) => sum + (r.price || 0), 0) / catRooms.length)
                                            : 0;

                                        return (
                                            <td key={idx} className="category-data_cell">
                                                <div className="info-box">
                                                    <div className="mini-num">{catRooms.length}</div>
                                                    <div className="mini-price">{cs}{avgPrice.toFixed(2)}</div>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                                {catRooms.map(room => (
                                    <tr key={room.roomNumber} className="room-data-row">
                                        <td
                                            className="sticky-left room-name_cell"
                                            onClick={() => handleRoomClick(room)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="room-name_wrapper">
                                                <div className="room-id-container">
                                                    <span className="room-number_text">{room.roomNumber}</span>
                                                    {room.isDirty && <span className="dirty-broom-icon" title="Dirty / Needs Cleaning">🧹</span>}
                                                </div>
                                                <span className={`room-status-indicator ${room.status === 'Available' ? 'available' : 'warning'}`}>⚠️</span>
                                            </div>
                                        </td>
                                        {dateRange.map((date, idx) => {
                                            const reservation = getReservationForRoomDate(room.roomNumber, date);
                                            const checkInDate = reservation ? new Date(reservation.checkInDate) : null;
                                            const isCheckInDay = checkInDate && checkInDate.getDate() === date.getDate() && checkInDate.getMonth() === date.getMonth();

                                            return (
                                                <td
                                                    key={idx}
                                                    className={`grid-cell ${!reservation ? 'available-cell' : ''}`}
                                                    onClick={() => !reservation && handleDateCellClick(date, room)}
                                                    style={{ cursor: !reservation ? 'pointer' : 'default' }}
                                                >
                                                    {isCheckInDay && (
                                                        <div
                                                            className={`booking-strip ${
                                                                // Overdue logic for strip color
                                                                (() => {
                                                                    const today = new Date();
                                                                    today.setHours(0, 0, 0, 0);
                                                                    const checkIn = new Date(reservation.checkInDate);
                                                                    const checkOut = new Date(reservation.checkOutDate);
                                                                    checkIn.setHours(0, 0, 0, 0);
                                                                    checkOut.setHours(0, 0, 0, 0);

                                                                    // Overdue Check
                                                                    const isOverdue =
                                                                        ((reservation.status === 'Upcoming' || reservation.status === 'RESERVED' || reservation.status === 'Confirmed' || reservation.status === 'Reserved') && checkIn < today) ||
                                                                        ((reservation.status === 'Checked-in' || reservation.status === 'IN_HOUSE' || reservation.status === 'CheckedIn') && checkOut < today);

                                                                    if (isOverdue) return 'overdue-stay';
                                                                    if (reservation.status === 'Checked-in' || reservation.status === 'IN_HOUSE' || reservation.status === 'CheckedIn') return 'active-stay';
                                                                    return 'reserved-stay';
                                                                })()
                                                                }`}
                                                            style={{
                                                                width: `calc(${reservation.numberOfNights * 100}% - 12px)`,
                                                                zIndex: 10
                                                            }}
                                                            title={`${reservation.guestName} (${reservation.numberOfNights} Nights)`}
                                                        >
                                                            {reservation.guestName}
                                                            {reservation.numberOfNights > 2 && <span className="night-badge">{reservation.numberOfNights}</span>}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Date Modal (Image 1) - Shows when clicking on available cell */}
            {showDateModal && (
                <div className="modal-overlay-stay" onClick={handleModalCancel}>
                    <div className="modal-content-stay" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-stay">
                            <span>Date: {selectedCellData.date}</span>
                            <span style={{ marginLeft: '40px' }}>Room No: {selectedCellData.roomNumber}</span>
                        </div>
                        <div className="modal-actions-stay">
                            <button className="btn-quick-reservation" onClick={handleQuickReservationClick}>
                                Quick Reservation
                            </button>
                            <button className="btn-cancel-stay" onClick={handleModalCancel}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Reservation Modal (Image 2) - Shows after clicking Quick Reservation */}
            {showQuickReservationModal && (
                <div className="modal-overlay-stay" onClick={handleModalCancel}>
                    <div className="modal-content-quick" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-quick">
                            <h3>Quick Reservation</h3>
                            <button className="modal-close-btn" onClick={handleModalCancel}>×</button>
                        </div>
                        <div className="modal-body-quick">
                            <div className="form-row-quick">
                                <div className="form-group-quick">
                                    <label>Arrival Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        value={`${quickReservationData.arrivalDate}T${quickReservationData.arrivalTime.replace(' ', '').toLowerCase()}`}
                                        onChange={(e) => {
                                            const [date, time] = e.target.value.split('T');
                                            setQuickReservationData({
                                                ...quickReservationData,
                                                arrivalDate: date,
                                                arrivalTime: time
                                            });
                                        }}
                                        className="input-datetime-quick"
                                    />
                                </div>
                                <div className="form-group-quick">
                                    <label>Departure Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        value={`${quickReservationData.departureDate}T${quickReservationData.departureTime.replace(' ', '').toLowerCase()}`}
                                        onChange={(e) => {
                                            const [date, time] = e.target.value.split('T');
                                            setQuickReservationData({
                                                ...quickReservationData,
                                                departureDate: date,
                                                departureTime: time
                                            });
                                        }}
                                        className="input-datetime-quick"
                                    />
                                </div>
                            </div>
                            <div className="form-row-quick">
                                <div className="form-group-quick">
                                    <label>Category</label>
                                    <input
                                        type="text"
                                        value={quickReservationData.category}
                                        onChange={(e) => setQuickReservationData({
                                            ...quickReservationData,
                                            category: e.target.value
                                        })}
                                        className="input-text-quick"
                                        placeholder="Room Category"
                                    />
                                </div>
                                <div className="form-group-quick">
                                    <label>Room No</label>
                                    <input
                                        type="text"
                                        value={quickReservationData.roomNumber}
                                        onChange={(e) => setQuickReservationData({
                                            ...quickReservationData,
                                            roomNumber: e.target.value
                                        })}
                                        className="input-text-quick"
                                        placeholder="Room Number"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer-quick">
                            <button className="btn-confirm-quick" onClick={handleQuickReservationConfirm}>
                                Confirm
                            </button>
                            <button className="btn-cancel-quick" onClick={handleModalCancel}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <RoomDetailsPanel
                roomId={selectedRoomIdForPanel}
                isOpen={isRoomPanelOpen}
                onClose={() => setIsRoomPanelOpen(false)}
                onUpdateStatus={handleUpdateRoomStatus}
                onEdit={handleEditRoomFromPanel}
                onQuickBook={handleQuickBookFromPanel}
            />
        </div>
    );
};

// Simple React Fragment fallback
import React from 'react';

export default StayOverview;
