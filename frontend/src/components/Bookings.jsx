import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import API_URL, { apiCall } from '../config/api';
import BookingRow from './BookingRow';
import EditReservationModal from './EditReservationModal';
import BookingActionsManager from './BookingActionsManager';
import './Bookings.css';

const Bookings = () => {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [filteredBookings, setFilteredBookings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('All');
    const [showAddBookingModal, setShowAddBookingModal] = useState(false);
    const [showEditBookingModal, setShowEditBookingModal] = useState(false);
    const [showEditReservationModal, setShowEditReservationModal] = useState(false);
    const [currentBooking, setCurrentBooking] = useState(null);
    const [selectedReservation, setSelectedReservation] = useState(null);
    const [bookingErrorMessage, setBookingErrorMessage] = useState('');

    // More Options State
    const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
    const [currentAction, setCurrentAction] = useState(null);
    const [actionBooking, setActionBooking] = useState(null);

    const [bookingFormData, setBookingFormData] = useState({
        bookingId: '',
        guestName: '',
        roomNumber: '',
        roomType: '',
        checkInDate: '',
        checkOutDate: '',
        status: 'Upcoming'
    });

    const statusOptions = ['All', 'Upcoming', 'Checked-in', 'Checked-out', 'Cancelled'];

    // Load bookings from MongoDB API
    useEffect(() => {
        fetchBookingsFromAPI();
    }, []);

    const fetchBookingsFromAPI = async () => {
        try {
            // Clear old localStorage data
            localStorage.removeItem('hotelBookings');

            const response = await apiCall(`/api/bookings/list`);
            const data = await response.json();
            if (data.success) {
                setBookings(data.data);
            }
        } catch (error) {
            console.error('Error fetching bookings from database:', error);
            setBookings([]);
        }
    };

    // Filter bookings based on search and status
    useEffect(() => {
        let filtered = [...bookings];

        if (searchQuery) {
            filtered = filtered.filter(booking =>
                booking.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                booking.bookingId.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (selectedStatus !== 'All') {
            filtered = filtered.filter(booking => booking.status === selectedStatus);
        }

        setFilteredBookings(filtered);
    }, [searchQuery, selectedStatus, bookings]);

    const handleAddBooking = () => {
        navigate('/admin/add-booking');
    };

    const handleEditBooking = (booking) => {
        // Set data for EditReservationModal
        setSelectedReservation({
            ...booking,
            id: booking._id, // Ensure ID is available
            guestPhone: booking.mobileNumber || '000000000',
            createdAt: booking.createdAt || new Date()
        });
        setShowEditReservationModal(true);
    };

    const handleDeleteBooking = async (id) => {
        if (confirm('Are you sure you want to delete this booking?')) {
            try {
                const response = await apiCall(`/api/bookings/delete/${id}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    await fetchBookingsFromAPI();
                } else {
                    alert(data.message || 'Failed to delete booking');
                }
            } catch (error) {
                console.error('Error deleting booking:', error);
                alert('Failed to delete booking. Please try again.');
            }
        }
    };

    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        setBookingErrorMessage('');

        if (!bookingFormData.guestName || !bookingFormData.roomNumber || !bookingFormData.checkInDate) {
            setBookingErrorMessage('All required fields must be filled');
            return;
        }

        try {
            if (showAddBookingModal) {
                // Generate unique booking ID
                const bookingId = 'BKG' + Date.now().toString().slice(-6);

                const newBooking = {
                    bookingId: bookingId,
                    guestName: bookingFormData.guestName,
                    mobileNumber: '9999999999', // Placeholder - should be added to form
                    roomNumber: bookingFormData.roomNumber,
                    roomType: bookingFormData.roomType || 'Single',
                    checkInDate: bookingFormData.checkInDate,
                    checkOutDate: bookingFormData.checkOutDate || bookingFormData.checkInDate,
                    numberOfGuests: 1,
                    numberOfNights: 1,
                    pricePerNight: 1500,
                    totalAmount: 1500,
                    advancePaid: 0,
                    status: bookingFormData.status || 'Upcoming'
                };

                const response = await apiCall(`/api/bookings/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newBooking)
                });

                const data = await response.json();

                if (!data.success) {
                    setBookingErrorMessage(data.message || 'Failed to add booking');
                    return;
                }

                await fetchBookingsFromAPI();
                setShowAddBookingModal(false);
            } else if (showEditBookingModal) {
                const updatedBooking = {
                    guestName: bookingFormData.guestName,
                    roomNumber: bookingFormData.roomNumber,
                    roomType: bookingFormData.roomType,
                    checkInDate: bookingFormData.checkInDate,
                    checkOutDate: bookingFormData.checkOutDate,
                    status: bookingFormData.status
                };

                const response = await apiCall(`/api/bookings/update/${currentBooking._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedBooking)
                });

                const data = await response.json();

                if (!data.success) {
                    setBookingErrorMessage(data.message || 'Failed to update booking');
                    return;
                }

                await fetchBookingsFromAPI();
                setShowEditBookingModal(false);
            }

            setBookingFormData({
                bookingId: '',
                guestName: '',
                roomNumber: '',
                roomType: '',
                checkInDate: '',
                checkOutDate: '',
                status: 'Upcoming'
            });
            setCurrentBooking(null);
        } catch (error) {
            console.error('Error submitting booking:', error);
            setBookingErrorMessage('Failed to save booking. Please try again.');
        }
    };

    const handleExportCSV = () => {
        if (filteredBookings.length === 0) {
            alert('No bookings to export');
            return;
        }

        // CSV Headers
        const headers = ['Booking ID', 'Guest Name', 'Mobile', 'Room No', 'Room Type', 'Check-in Date', 'Check-out Date', 'Status', 'Total Amount', 'Advance Paid'];

        // CSV Rows
        const rows = filteredBookings.map(booking => [
            booking._id || booking.id || '',
            booking.guestName || '',
            booking.mobileNumber || '',
            booking.roomNumber || '',
            booking.roomType || '',
            booking.checkInDate ? new Date(booking.checkInDate).toLocaleDateString() : '',
            booking.checkOutDate ? new Date(booking.checkOutDate).toLocaleDateString() : '',
            booking.status || '',
            booking.totalAmount || '0',
            booking.advancePaid || '0'
        ]);

        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `bookings_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Upcoming':
                return 'status-upcoming';
            case 'Checked-in':
                return 'status-checkedin';
            case 'Checked-out':
                return 'status-checkedout';
            case 'Cancelled':
                // Handle More Options action selection
                const handleMoreOptionsAction = (actionType, booking) => {
                    setCurrentAction(actionType);
                    setActionBooking(booking);
                    setActionDrawerOpen(true);
                };

                // Handle action success - refresh bookings
                const handleActionSuccess = async (updatedBooking) => {
                    await fetchBookingsFromAPI(); // Refresh the bookings list
                };

                return 'status-cancelled';
            default:
                return '';
        }
    };

    return (
        <div className="bookings-section">
            {/* Bookings Header */}
            <div className="section-header">
                <div className="header-title">
                    <h2>📅 Bookings</h2>
                    <p>Manage all hotel reservations</p>
                </div>
                <div className="header-actions">
                    <button className="export-csv-btn" onClick={handleExportCSV}>
                        📥 Export CSV
                    </button>
                    <button className="add-booking-btn" onClick={handleAddBooking}>
                        + Add Booking
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bookings-controls">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Guest name / Mobile number"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                    />
                </div>

                <div className="filter-group">
                    <input
                        type="date"
                        className="filter-input date-input"
                        placeholder="Check-in date"
                    />
                </div>

                <div className="filter-group">
                    <select
                        className="filter-input status-filter"
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                    >
                        {statusOptions.map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Bookings Table */}
            <div className="bookings-table-wrapper">
                <table className="bookings-table">
                    <thead>
                        <tr>
                            <th className="text-left">Booking ID</th>
                            <th className="text-left">Guest Name</th>
                            <th className="text-center">Room No</th>
                            <th className="text-left">Room Type</th>
                            <th className="text-center">Check-in Date</th>
                            <th onMoreOptions={handleMoreOptionsAction}
                                className="text-center">Status</th>
                            <th className="text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBookings.length > 0 ? (
                            filteredBookings.map((booking) => (
                                <BookingRow
                                    key={booking.id}
                                    booking={booking}
                                    onEdit={handleEditBooking}
                                    onDelete={handleDeleteBooking}
                                />
                            ))
                        ) : (
                            <tr>
                                <td colSpan="7" className="no-data">
                                    No bookings found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Booking Modal */}
            {showAddBookingModal && (
                <div className="modal-overlay" onClick={() => setShowAddBookingModal(false)}>
                    <motion.div
                        className="modal-content booking-modal"
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="modal-header">
                            <h2>Add New Booking</h2>
                            <button className="modal-close" onClick={() => setShowAddBookingModal(false)}>
                                ✕
                            </button>
                        </div>

                        {bookingErrorMessage && (
                            <div className="error-alert">
                                ⚠️ {bookingErrorMessage}
                            </div>
                        )}

                        <form onSubmit={handleBookingSubmit}>
                            <div className="form-group">
                                <label>BOOKING ID *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., BKG001"
                                    value={bookingFormData.bookingId}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, bookingId: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>GUEST NAME *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter guest name"
                                    value={bookingFormData.guestName}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, guestName: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>ROOM NUMBER *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., 101"
                                    value={bookingFormData.roomNumber}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, roomNumber: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>ROOM TYPE</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., Deluxe King"
                                    value={bookingFormData.roomType}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, roomType: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>CHECK-IN DATE *</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={bookingFormData.checkInDate}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, checkInDate: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>CHECK-OUT DATE</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={bookingFormData.checkOutDate}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, checkOutDate: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>STATUS</label>
                                <select
                                    className="form-input"
                                    value={bookingFormData.status}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, status: e.target.value })}
                                >
                                    <option value="Upcoming">Upcoming</option>
                                    <option value="Checked-in">Checked-in</option>
                                    <option value="Checked-out">Checked-out</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setShowAddBookingModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-submit">
                                    Add Booking
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Edit Booking Modal */}
            {showEditBookingModal && (
                <div className="modal-overlay" onClick={() => setShowEditBookingModal(false)}>
                    <motion.div
                        className="modal-content booking-modal"
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="modal-header">
                            <h2>Edit Booking</h2>
                            <button className="modal-close" onClick={() => setShowEditBookingModal(false)}>
                                ✕
                            </button>
                        </div>

                        {bookingErrorMessage && (
                            <div className="error-alert">
                                ⚠️ {bookingErrorMessage}
                            </div>
                        )}

                        <form onSubmit={handleBookingSubmit}>
                            <div className="form-group">
                                <label>BOOKING ID *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., BKG001"
                                    value={bookingFormData.bookingId}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, bookingId: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>GUEST NAME *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter guest name"
                                    value={bookingFormData.guestName}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, guestName: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>ROOM NUMBER *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., 101"
                                    value={bookingFormData.roomNumber}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, roomNumber: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>ROOM TYPE</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., Deluxe King"
                                    value={bookingFormData.roomType}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, roomType: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>CHECK-IN DATE *</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={bookingFormData.checkInDate}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, checkInDate: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>CHECK-OUT DATE</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={bookingFormData.checkOutDate}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, checkOutDate: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>STATUS</label>
                                <select
                                    className="form-input"
                                    value={bookingFormData.status}
                                    onChange={(e) => setBookingFormData({ ...bookingFormData, status: e.target.value })}
                                >
                                    <option value="Upcoming">Upcoming</option>
                                    <option value="Checked-in">Checked-in</option>
                                    <option value="Checked-out">Checked-out</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setShowEditBookingModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-submit">
                                    Update Booking
                                </button>
                            </div>


                            {/* More Options Action Drawer */}
                            <BookingActionsManager
                                isOpen={actionDrawerOpen}
                                onClose={() => {
                                    setActionDrawerOpen(false);
                                    setCurrentAction(null);
                                    setActionBooking(null);
                                }}
                                actionType={currentAction}
                                booking={actionBooking}
                                onSuccess={handleActionSuccess}
                            />
                        </form>
                    </motion.div>
                </div>
            )}
            {/* Edit Reservation Modal with Full Features */}
            <EditReservationModal
                isOpen={showEditReservationModal}
                onClose={() => {
                    setShowEditReservationModal(false);
                    setSelectedReservation(null);
                    fetchBookingsFromAPI(); // Refresh list after closing
                }}
                reservation={selectedReservation}
                onRefresh={fetchBookingsFromAPI}
            />
        </div>
    );
};

export default Bookings;

