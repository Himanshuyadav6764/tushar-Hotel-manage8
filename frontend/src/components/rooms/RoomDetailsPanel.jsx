import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import API_URL, { apiCall } from '../../config/api';
import './RoomDetailsPanel.css';
import { useSettings } from '../../context/SettingsContext';

const RoomDetailsPanel = ({ roomId, isOpen, onClose, onUpdateStatus, onEdit, onQuickBook, computedStatus, canManageRooms, canBook, canManageStatus }) => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [room, setRoom] = useState(null);
    const [roomFacilities, setRoomFacilities] = useState([]);
    const [roomBookings, setRoomBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (roomId && isOpen) {
            fetchRoomDetails();
        }
    }, [roomId, isOpen]);

    const fetchRoomDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            // Parallel fetch for room details and facility types
            const [roomRes, facilitiesRes] = await Promise.all([
                apiCall(`/api/rooms/${roomId}`),
                apiCall(`/api/facility-types/list`)
            ]);

            const roomData = await roomRes.json();
            const facilitiesData = await facilitiesRes.json();

            if (roomData.success) {
                const fetchedRoom = roomData.data;
                setRoom(fetchedRoom);

                // Fetch bookings for this room
                fetchBookingsForRoom(fetchedRoom.roomNumber);

                // Live Fetch logic: Match room type with facility type setup (Image 2 logic)
                if (facilitiesData.success && facilitiesData.data) {
                    const matchedFacilityType = facilitiesData.data.find(
                        type => type.name.toLowerCase() === fetchedRoom.roomType.toLowerCase()
                    );

                    if (matchedFacilityType && matchedFacilityType.description) {
                        // Split by comma as shown in Image 2
                        const facilityList = matchedFacilityType.description.split(',').map(f => f.trim());
                        setRoomFacilities(facilityList);
                    } else {
                        // Fallback to room's own facilities if any
                        setRoomFacilities(fetchedRoom.facilities || []);
                    }
                }
            } else {
                setError(roomData.message || 'Failed to fetch room details');
            }
        } catch (err) {
            console.error('Error fetching room details:', err);
            setError('Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    const fetchBookingsForRoom = async (roomNumber) => {
        try {
            const response = await apiCall(`/api/bookings/room/${roomNumber}`);
            const data = await response.json();
            if (data.success) {
                // Filter out checked out and cancelled to show only active/future bookings
                const activeBookings = data.data.filter(b =>
                    !['Checked-out', 'CheckedOut', 'CHECKED_OUT', 'Cancelled', 'NoShow', 'No-Show'].includes(b.status)
                );
                setRoomBookings(activeBookings);
            }
        } catch (err) {
            console.error('Error fetching room bookings:', err);
        }
    };

    const handleBlockForMaintenance = async () => {
        if (!room) return;
        try {
            const response = await apiCall(`/api/rooms/status/${room._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Under Maintenance' })
            });
            const data = await response.json();
            if (data.success) {
                setRoom(data.data);
                if (onUpdateStatus) onUpdateStatus(data.data);
                alert('Room blocked for maintenance');
            }
        } catch (err) {
            console.error('Error blocking room:', err);
            alert('Failed to block room');
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Available': return { color: '#10b981', bg: '#ecfdf5', label: 'AVAILABLE' };
            case 'Occupied': return { color: '#d41424', bg: '#fef2f2', label: 'OCCUPIED' };
            case 'Booked': return { color: '#f59e0b', bg: '#fffbeb', label: 'BOOKED' };
            case 'Under Maintenance': return { color: '#6b7280', bg: '#f3f4f6', label: 'MAINTENANCE' };
            default: return { color: '#000', bg: '#fff', label: status };
        }
    };

    const panelVariants = {
        hidden: { x: '100%', opacity: 0 },
        visible: { x: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 200 } },
        exit: { x: '100%', opacity: 0, transition: { ease: 'easeInOut', duration: 0.3 } }
    };

    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 }
    };

    if (!isOpen && !room) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay */}
                    <motion.div
                        className="room-panel-overlay"
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={onClose}
                    />

                    {/* Side Panel */}
                    <motion.div
                        className="room-details-panel"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        {/* Header */}
                        <div className="panel-header">
                            <div className="header-icon-wrap">
                                <span role="img" aria-label="room">ℹ️</span>
                            </div>
                            <div className="header-text">
                                <h2>ROOM DETAILS – Room {room?.roomNumber || '...'}</h2>
                                <span style={{ fontSize: '11px', opacity: 0.9, textTransform: 'uppercase' }}>Live Preview & Actions</span>
                            </div>
                            <button className="panel-close-btn" onClick={onClose}>✕</button>
                        </div>

                        <div className="panel-body">
                            {loading ? (
                                <div className="panel-loading">
                                    <div className="spinner"></div>
                                    <p>Gathering room details...</p>
                                </div>
                            ) : error ? (
                                <div className="panel-error">
                                    <span>⚠️</span>
                                    <p>{error}</p>
                                    <button onClick={fetchRoomDetails}>Try Again</button>
                                </div>
                            ) : room ? (
                                <>
                                    {/* Basic Info Section */}
                                    <div className="panel-section">
                                        <h3 className="section-title">🔹 BASIC INFORMATION</h3>
                                        <div className="info-grid">
                                            <div className="info-item">
                                                <label>Room Number</label>
                                                <span>{room.roomNumber}</span>
                                            </div>
                                            <div className="info-item">
                                                <label>Room Type</label>
                                                <span>{room.roomType}</span>
                                            </div>
                                            <div className="info-item">
                                                <label>Floor</label>
                                                <span>{room.floor || 'N/A'}</span>
                                            </div>
                                            <div className="info-item">
                                                <label>Capacity</label>
                                                <span>{room.capacity} Persons</span>
                                            </div>
                                            <div className="info-item">
                                                <label>Price Per Night</label>
                                                <span className="price">{cs}{room.price?.toLocaleString()}</span>
                                            </div>
                                            <div className="info-item full-width">
                                                <label>Status</label>
                                                <span className="status-badge" style={{
                                                    color: getStatusStyle(computedStatus || room.status).color,
                                                    backgroundColor: getStatusStyle(computedStatus || room.status).bg,
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700',
                                                    display: 'inline-block',
                                                    border: `1px solid ${getStatusStyle(computedStatus || room.status).color}`
                                                }}>
                                                    {getStatusStyle(computedStatus || room.status).label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Advanced Details Section */}
                                    <div className="panel-section">
                                        <h3 className="section-title">🔹 ADVANCED DETAILS</h3>
                                        <div className="info-grid">
                                            <div className="info-item">
                                                <label>Room View Type</label>
                                                <span>{room.roomViewType || 'City View'}</span>
                                            </div>
                                            <div className="info-item">
                                                <label>Smoking Policy</label>
                                                <span>{room.smokingPolicy || 'Non-Smoking'}</span>
                                            </div>
                                            <div className="info-item">
                                                <label>Room Size</label>
                                                <span>{room.roomSize || '0'} sq ft</span>
                                            </div>
                                            <div className="info-item">
                                                <label>Smart Room</label>
                                                <span className={`toggle-label ${room.isSmartRoom ? 'yes' : 'no'}`}>
                                                    {room.isSmartRoom ? 'YES' : 'NO'}
                                                </span>
                                            </div>
                                            <div className="info-item">
                                                <label>Dynamic Rate</label>
                                                <span className={`toggle-label ${room.dynamicRateEnabled ? 'yes' : 'no'}`}>
                                                    {room.dynamicRateEnabled ? 'ENABLED' : 'DISABLED'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Facilities Section */}
                                    <div className="panel-section">
                                        <h3 className="section-title">🔹 FACILITIES</h3>
                                        <div className="facilities-grid-modern">
                                            {roomFacilities && roomFacilities.length > 0 ? (
                                                roomFacilities.map((fac, idx) => (
                                                    <div key={idx} className="facility-box-modern">
                                                        <span className="check-icon">
                                                            {fac.toLowerCase().includes('wi-fi') ? '📶' : '✔️'}
                                                        </span>
                                                        <span className="facility-text">{fac.trim()}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="no-data">No facilities listed for this room type</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Booking Schedule Section */}
                                    <div className="panel-section">
                                        <h3 className="section-title">📅 BOOKING SCHEDULE</h3>
                                        <div className="bookings-schedule-container">
                                            {roomBookings && roomBookings.length > 0 ? (
                                                <div className="booking-list">
                                                    {roomBookings.map((booking, idx) => (
                                                        <div key={idx} className={`booking-schedule-item ${['IN_HOUSE', 'Checked-in', 'Occupied'].includes(booking.status) ? 'current' : 'upcoming'}`}>
                                                            <div className="booking-period">
                                                                <span className="dates">
                                                                    {new Date(booking.checkInDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                                    {' - '}
                                                                    {new Date(booking.checkOutDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                                </span>
                                                                <span className="booking-status-tag">
                                                                    {['IN_HOUSE', 'Checked-in', 'Occupied'].includes(booking.status) ? 'Current' : 'Confirmed'}
                                                                </span>
                                                            </div>
                                                            <div className="guest-mini-info">
                                                                <span className="guest-name">{booking.guestName}</span>
                                                                <span className="nights">{booking.numberOfNights || 1} Night(s)</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="no-bookings-placeholder">
                                                    <div className="calendar-icon">📅</div>
                                                    <p>No active or upcoming bookings for this room.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>

                        {/* Actions Footer */}
                        <div className="panel-actions-footer">
                            {canManageRooms && (
                                <>
                                    <button className="panel-action-btn edit" onClick={() => onEdit(room)}>
                                        ✏️ Edit Room
                                    </button>
                                </>
                            )}
                            {canManageStatus && (
                                <button
                                    className="panel-action-btn block"
                                    onClick={handleBlockForMaintenance}
                                    disabled={room?.status === 'Under Maintenance'}
                                >
                                    🛠️ Block for Maintenance
                                </button>
                            )}
                            {canBook && (
                                <button
                                    className="panel-action-btn quick-book"
                                    onClick={() => onQuickBook(room)}
                                    disabled={(computedStatus || room?.status) !== 'Available'}
                                >
                                    ⚡ Quick Book
                                </button>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default RoomDetailsPanel;
