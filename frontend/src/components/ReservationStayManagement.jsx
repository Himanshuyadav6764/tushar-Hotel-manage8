import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import API_URL_CONFIG from '../config/api';
import { searchBookings } from '../services/searchService';
import './ReservationStayManagement.css';
import './CreateGuestForm.css';
import RoomRow from './RoomRow';
import GuestModal from './GuestModal';
import BillingSummary from './BillingSummary';
import ReservationCard from './ReservationCard';
import InvoiceGenerator from './InvoiceGenerator';
import InvoiceView from './InvoiceView';
import './InvoiceView.css';
import EditReservationModal from './EditReservationModal';
import MoreOptionsMenu from './MoreOptionsMenu';
import ConfirmationModal from './ConfirmationModal';

import BookingActionsManager from './BookingActionsManager';
import HousekeepingView from './HousekeepingView';
import RoomService from './RoomService';
import { useSettings } from '../context/SettingsContext';
import { calculateRoomTaxBySlab } from '../utils/roomTax';

const ReservationStayManagement = ({ viewMode = 'dashboard' }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const {
        getCurrencySymbol,
        settings,
        formatDate,
        formatTime,
        getCurrentDateISO,
        getCurrentTime24,
        getDateISOWithOffset,
        toTime24,
        isPastDateTime
    } = useSettings();
    const cs = getCurrencySymbol();

    // Permission Helper
    const hasRoomPermission = (type) => {
        if (!user) return false;
        if (user.role !== 'staff') return true; // Admin has full access

        const permissions = user.permissions || [];
        if (type === 'Housekeeping') return permissions.includes('Housekeeping') || permissions.includes('Rooms (Housekeeping)');
        if (type === 'Room Service') return permissions.includes('Room Service') || permissions.includes('Rooms (Room Service)');
        if (type === 'New Reservation') return permissions.includes('Reservations') || permissions.includes('Rooms (New Reservation)');
        return false;
    };
    const API_URL = `${API_URL_CONFIG}/api/bookings`;
    const [view, setView] = useState(viewMode); // 'dashboard', 'form', 'housekeeping', or 'roomservice'
    const [prefilledData, setPrefilledData] = useState(null);

    // Search State (Moved to top to prevent "Cannot access 'searchQuery' before initialization")
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    // Reservation/Booking Data
    const [reservations, setReservations] = useState([]);
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'reserved', 'in-house', 'checked-out'
    const [isEditingMode, setIsEditingMode] = useState(false);
    const [editingReservationId, setEditingReservationId] = useState(null);
    const [selectedReservation, setSelectedReservation] = useState(null);
    const [showBookingHistory, setShowBookingHistory] = useState(false);
    const [loading, setLoading] = useState(true);
    const [successMessage, setSuccessMessage] = useState('');
    const [fromRoomsPage, setFromRoomsPage] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [cardViewMode, setCardViewMode] = useState('grid'); // 'grid' or 'list'

    // Filter reservations
    const filteredReservations = useMemo(() => {
        const todayStr = getCurrentDateISO();
        const oneMonthAgoStr = getDateISOWithOffset(-30);

        return reservations.filter(r => {
            if (activeTab === 'all') return true;
            if (activeTab === 'reserved') return r.status === 'RESERVED';
            if (activeTab === 'in-house') return r.status === 'IN_HOUSE';
            if (activeTab === 'checked-out') return r.status === 'CHECKED_OUT' && r.checkOutDate >= oneMonthAgoStr;
            if (activeTab === 'arrival') return r.checkInDate === todayStr && r.status === 'RESERVED';
            if (activeTab === 'departure') return r.checkOutDate <= todayStr && r.status === 'IN_HOUSE';
            return true;
        });
    }, [reservations, activeTab, getCurrentDateISO, getDateISOWithOffset]);

    // Calculate real-time counts for tabs
    const counts = useMemo(() => {
        const todayStr = getCurrentDateISO();
        const oneMonthAgoStr = getDateISOWithOffset(-30);

        return {
            all: reservations.length,
            reserved: reservations.filter(r => r.status === 'RESERVED').length,
            'in-house': reservations.filter(r => r.status === 'IN_HOUSE').length,
            'checked-out': reservations.filter(r => r.status === 'CHECKED_OUT' && r.checkOutDate >= oneMonthAgoStr).length,
            arrival: reservations.filter(r => r.checkInDate === todayStr && r.status === 'RESERVED').length,
            departure: reservations.filter(r => r.checkOutDate <= todayStr && r.status === 'IN_HOUSE').length
        };
    }, [reservations, getCurrentDateISO, getDateISOWithOffset]);

    // Helper function to convert room type name to category ID
    const getCategoryIdFromRoomType = (roomType) => {
        // Use exact name if it's one of the common types we see in the UI
        if (['AC / Non-AC', 'Deluxe Room', 'Standard Room', 'Suite Double', 'Deluxe AC Double', 'Premium'].includes(roomType)) {
            return roomType;
        }

        const typeMapping = {
            'Deluxe Room': 'deluxe-ac-double',
            'Club AC Double Room': 'club-ac-double',
            'Suite Double Room': 'suite-double',
            'Suite Single Room': 'suite-single',
            'Standard Room': 'standard-room',
            'Deluxe AC Double': 'deluxe-ac-double'
        };

        if (typeMapping[roomType]) return typeMapping[roomType];

        return roomType?.toLowerCase().replace(/ /g, '-').replace(/\//g, '-') || 'deluxe-ac-double';
    };

    // Sync internal view state with prop changes
    useEffect(() => {
        if (viewMode) {
            setView(viewMode);
        }

        // FEATURE: Consolidate Navigation State Handling (Pre-filling)
        // Check if we have specific data to consume
        if (location.state && (location.state.prefilledData || location.state.autoOpenGuestModal)) {
            const data = location.state.prefilledData;

            if (data) {
                console.log('📝 Pre-filling form with data:', data);
                setPrefilledData(data);
                setFromRoomsPage(true);

                // Prefill Rooms State
                setRooms([{
                    id: 1,
                    categoryId: data.roomType ? getCategoryIdFromRoomType(data.roomType) : '',
                    roomNumber: data.roomNumber || '',
                    mealPlan: '',
                    adultsCount: data.capacity || 1,
                    childrenCount: 0,
                    baseRate: data.price || 0,
                    ratePerNight: data.price || 0,
                    discount: 0
                }]);

                // Set Dates if available
                const todayDate = getCurrentDateISO();
                const tomorrowDate = getDateISOWithOffset(1);
                setCheckInDate(data.checkInDate || todayDate);
                if (data.checkInTime) setCheckInTime(data.checkInTime);
                setCheckOutDate(data.checkOutDate || tomorrowDate);
                if (data.checkOutTime) setCheckOutTime(data.checkOutTime);

                // Fetch full details if roomId exists
                if (data.roomId) {
                    fetch(`${API_URL_CONFIG}/api/rooms/${data.roomId}`)
                        .then(res => res.json())
                        .then(resData => {
                            if (resData.success) {
                                const room = resData.data;
                                setRooms([{
                                    id: 1,
                                    categoryId: room.roomType ? getCategoryIdFromRoomType(room.roomType) : '',
                                    roomNumber: room.roomNumber,
                                    mealPlan: '',
                                    adultsCount: room.capacity || 1,
                                    childrenCount: 0,
                                    baseRate: room.price || 0,
                                    ratePerNight: room.price || 0,
                                    discount: 0
                                }]);
                            }
                        });
                }
            }

            // Auto-open guest modal if requested
            if (location.state.autoOpenGuestModal) {
                console.log('🎯 Auto-opening Create Guest modal...');
                setTimeout(() => setShowGuestModal(true), 300);
            }

            // IMPORTANT: Clear navigation state once consumed but keep fromRoomsPage flag
            // Use replace: true so it doesn't add to history
            navigate('.', { replace: true, state: { processed: true } });
        } else if (!location.state || !location.state.processed) {
            // Only reset if we don't have a 'processed' flag in state
            // and we aren't coming from another pre-fill
            if (viewMode === 'form' && !isEditingMode) {
                setFromRoomsPage(false);
            }
        }
    }, [viewMode, location, navigate]);

    // Permission-based Auto-redirect
    useEffect(() => {
        if (user?.role === 'staff' && view === 'dashboard') {
            const hasNewRes = hasRoomPermission('New Reservation');
            const hasHousekeeping = hasRoomPermission('Housekeeping');
            const hasRoomService = hasRoomPermission('Room Service');

            if (!hasNewRes) {
                if (hasHousekeeping) setView('housekeeping');
                else if (hasRoomService) setView('roomservice');
            }
        }
    }, [user, view]);




    // Initial Fetch for data dependencies
    useEffect(() => {
        fetchReservationsFromAPI();
        fetchGuestsFromAPI();
        fetchMealTypes();
    }, []);

    const fetchReservationsFromAPI = async () => {
        try {
            setLoading(true);

            // Fetch from both endpoints
            const [bookingsResponse, reservationsResponse] = await Promise.all([
                fetch(`${API_URL}/list`).catch(() => ({ ok: false })),
                fetch(`${API_URL_CONFIG}/api/reservations/list`).catch(() => ({ ok: false }))
            ]);

            let allReservations = [];
            const uniqueIds = new Set();

            // Process bookings data
            if (bookingsResponse.ok) {
                const bookingsData = await bookingsResponse.json();
                if (bookingsData.success && bookingsData.data) {
                    bookingsData.data.forEach(booking => {
                        if (!uniqueIds.has(booking._id)) {
                            allReservations.push(mapBookingToReservation(booking));
                            uniqueIds.add(booking._id);
                        }
                    });
                }
            }

            // Process reservations data (new endpoint)
            if (reservationsResponse.ok) {
                const reservationsData = await reservationsResponse.json();
                if (reservationsData.success && reservationsData.data) {
                    reservationsData.data.forEach(reservation => {
                        if (!uniqueIds.has(reservation._id)) {
                            allReservations.push({
                                id: reservation._id || `res-${Math.random()}`,
                                reservationType: reservation.reservationType || 'Confirm',
                                bookingSource: reservation.bookingSource || 'Direct',
                                businessSource: reservation.businessSource || 'Walk-In',
                                referenceNumber: reservation.referenceId,
                                arrivalFrom: reservation.arrivalFrom || '',
                                purposeOfVisit: reservation.purposeOfVisit || '',
                                guestId: reservation._id,
                                guestName: reservation.guestName,
                                guestEmail: reservation.email,
                                guestPhone: reservation.phone,
                                additionalGuests: reservation.additionalGuests || [],
                                checkInDate: reservation.checkInDate ? (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date(reservation.checkInDate)) : '',
                                checkInTime: '14:00',
                                checkOutDate: reservation.checkOutDate ? (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date(reservation.checkOutDate)) : '',
                                checkOutTime: '11:00',
                                flexibleCheckout: false,
                                roomNumber: reservation.roomNumber,
                                roomType: reservation.roomType,
                                rooms: [{
                                    id: 1,
                                    categoryId: 'deluxe-ac-double',
                                    roomNumber: '',
                                    mealPlan: 'CP',
                                    adultsCount: 2,
                                    childrenCount: 0,
                                    ratePerNight: Math.round(reservation.amount / (reservation.nights || 1)),
                                    discount: 0
                                }],
                                nights: reservation.nights || 1,
                                status: reservation.status,
                                roomCharges: reservation.amount ? Math.round(reservation.amount / 1.12) : 0,
                                discount: 0,
                                tax: reservation.amount ? (reservation.amount - Math.round(reservation.amount / 1.12)) : 0,
                                totalAmount: reservation.amount,
                                paidAmount: reservation.paid || 0,
                                balanceDue: reservation.balance || 0,
                                paymentMode: 'Cash',
                                taxExempt: false,
                                idProofType: reservation.idProofType,
                                idNumber: reservation.idNumber,
                                idProofNumber: reservation.idNumber,
                                vehicleNumber: reservation.vehicleNumber,
                                createdAt: reservation.createdAt || new Date().toISOString(),
                                updatedAt: reservation.updatedAt || new Date().toISOString()
                            });
                            uniqueIds.add(reservation._id);
                        }
                    });
                }
            }

            console.log('Fetched and mapped reservations:', allReservations);
            setReservations(allReservations);
        } catch (error) {
            console.error('Error fetching reservations:', error);
            setReservations([]);
        } finally {
            setLoading(false);
        }
    };

    const mapBookingToReservation = (booking) => {
        // Extract billing data safely (handle nested billing object from new schema)
        const billing = booking.billing || {};
        const duration = booking.duration || {};

        const totalAmount = booking.totalAmount || billing.totalAmount || 0;
        const paidAmount = booking.advancePaid || billing.paidAmount || 0;
        const balanceDue = booking.remainingAmount || billing.balanceAmount || (totalAmount - paidAmount);
        const nights = booking.numberOfNights || duration.nights || 1;
        const pricePerNight = booking.pricePerNight || billing.roomRate || 0;
        const serviceChargeAmount = Number(booking.serviceChargeAmount ?? billing.serviceCharge ?? 0) || 0;
        const taxAmount = Number(booking.taxAmount ?? billing.tax ?? 0) || 0;

        const roomChargesFromRows = Array.isArray(booking.rooms) && booking.rooms.length > 0
            ? booking.rooms.reduce((sum, r) => sum + ((Number(r.ratePerNight) || 0) * nights), 0)
            : (pricePerNight * nights);

        const discountFromRows = Array.isArray(booking.rooms) && booking.rooms.length > 0
            ? booking.rooms.reduce((sum, r) => sum + (Number(r.discount) || 0), 0)
            : 0;

        return {
            id: booking._id || `booking-${Math.random()}`,
            reservationType: booking.reservationType || 'Confirm',
            bookingSource: booking.bookingSource || booking.source || 'Direct',
            businessSource: booking.businessSource || 'Walk-In',
            referenceNumber: booking.referenceId || booking.bookingId || booking._id,
            guestId: booking._id,
            guestName: booking.guestName,
            guestEmail: booking.email || '',
            guestPhone: booking.mobileNumber,
            additionalGuests: booking.additionalGuests || [],
            visitors: booking.visitors || [],
            checkInDate: booking.checkInDate ? (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date(booking.checkInDate)) : '',
            checkInTime: booking.actualCheckIn ? new Date(booking.actualCheckIn).toTimeString().slice(0, 5) : (booking.scheduledCheckInTime || '14:00'),
            checkOutDate: booking.checkOutDate ? (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date(booking.checkOutDate)) : '',
            checkOutTime: booking.actualCheckOut ? new Date(booking.actualCheckOut).toTimeString().slice(0, 5) : (booking.scheduledCheckOutTime || '11:00'),
            actualCheckIn: booking.actualCheckIn,
            actualCheckOut: booking.actualCheckOut,
            flexibleCheckout: false,
            status: booking.status,
            roomNumber: booking.roomNumber,
            roomType: booking.roomType,
            idProofType: booking.idProofType,
            idNumber: booking.idNumber,
            vehicleNumber: booking.vehicleNumber,
            rooms: booking.rooms && booking.rooms.length > 0
                ? booking.rooms.map((r, idx) => ({
                    id: idx + 1,
                    categoryId: r.roomType?.toLowerCase().replace(/ /g, '-') || 'deluxe-ac-double',
                    roomNumber: r.roomNumber || '',
                    mealPlan: r.mealPlan || 'CP',
                    adultsCount: r.adults || 1,
                    childrenCount: r.children || 0,
                    ratePerNight: r.ratePerNight || 0,
                    discount: r.discount || 0
                }))
                : [{
                    id: 1,
                    categoryId: booking.roomType?.toLowerCase().replace(/ /g, '-') || 'deluxe-ac-double',
                    roomNumber: booking.roomNumber || '',
                    mealPlan: 'CP',
                    adultsCount: booking.numberOfAdults || duration.adults || 1,
                    childrenCount: booking.numberOfChildren || duration.children || 0,
                    ratePerNight: pricePerNight,
                    discount: 0
                }],
            nights: nights,
            status: booking.status === 'Upcoming' ? 'RESERVED' :
                booking.status === 'Checked-in' || booking.status === 'IN_HOUSE' || booking.status === 'CheckedIn' ? 'IN_HOUSE' :
                    booking.status === 'Checked-out' || booking.status === 'CHECKED_OUT' || booking.status === 'CheckedOut' ? 'CHECKED_OUT' : 'RESERVED',
            roomCharges: roomChargesFromRows,
            discount: discountFromRows,
            tax: taxAmount,
            serviceCharge: serviceChargeAmount,
            totalAmount: totalAmount,
            paidAmount: paidAmount,
            balanceDue: balanceDue,
            paymentMode: 'Cash',
            taxExempt: false,
            invoiceId: booking.invoiceId,
            idProofType: booking.idProofType,
            idNumber: booking.idNumber || booking.idProofNumber,
            idProofNumber: booking.idNumber || booking.idProofNumber,
            vehicleNumber: booking.vehicleNumber,
            auditTrail: booking.auditTrail || [],
            transactions: booking.transactions || [],
            notes: booking.checkInRemarks || '',
            specialRequests: booking.specialRequests || booking.remarks || '',
            cancellationDetails: booking.cancellationDetails || {},
            noShowDetails: booking.noShowDetails || {},
            voidDetails: booking.voidDetails || {},
            createdAt: booking.createdAt || new Date().toISOString(),
            updatedAt: booking.updatedAt || new Date().toISOString()
        };
    };

    // Debounce Search Logic
    useEffect(() => {
        // Feature: Debounced Search
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.trim().length > 0) {
                setIsSearching(true);
                try {
                    const result = await searchBookings(searchQuery);
                    if (result.success) {
                        const mappedResults = result.data.map(mapBookingToReservation);
                        setSearchResults(mappedResults);
                    }
                } catch (error) {
                    console.error('Search error:', error);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    // Determine which reservations to display (Original or Search Results)
    const displayReservations = useMemo(() => {
        let results = filteredReservations;

        if (searchQuery.trim().length > 0) {
            const todayStr = getCurrentDateISO();
            const oneMonthAgoStr = getDateISOWithOffset(-30);

            // Further filter search results by active tab
            results = searchResults.filter(r => {
                if (activeTab === 'all') return true;
                if (activeTab === 'reserved') return r.status === 'RESERVED';
                if (activeTab === 'in-house') return r.status === 'IN_HOUSE';
                if (activeTab === 'checked-out') {
                    return r.status === 'CHECKED_OUT' && r.checkOutDate >= oneMonthAgoStr;
                }

                if (activeTab === 'arrival') return r.checkInDate === todayStr && r.status === 'RESERVED';
                if (activeTab === 'departure') return r.checkOutDate <= todayStr && r.status === 'IN_HOUSE';
                return true;
            });
        }

        return results;
    }, [searchQuery, searchResults, filteredReservations, activeTab, getCurrentDateISO, getDateISOWithOffset]);



    // Room Facility Types
    const [facilityTypes, setFacilityTypes] = useState([]);

    // Fetch facility types
    const fetchFacilityTypes = async () => {
        try {
            const response = await fetch(`${API_URL_CONFIG}/api/facility-types/list`);
            const data = await response.json();
            if (data.success) {
                setFacilityTypes(data.data);
            }
        } catch (error) {
            console.error('Error fetching facility types:', error);
        }
    };

    useEffect(() => {
        fetchFacilityTypes();
    }, []);

    // Meal Types
    const [mealTypes, setMealTypes] = useState([]);

    // Fetch meal types from API
    const fetchMealTypes = async () => {
        try {
            const response = await fetch(`${API_URL_CONFIG}/api/meal-types/list`);
            const data = await response.json();
            if (data.success && data.data) {
                setMealTypes(data.data);
            }
        } catch (error) {
            console.error('Error fetching meal types:', error);
        }
    };

    useEffect(() => {
        fetchMealTypes();
    }, []);

    // Booking Sources
    const [bookingSources, setBookingSources] = useState([]);

    const fetchBookingSources = async () => {
        try {
            const response = await fetch(`${API_URL_CONFIG}/api/booking-sources/list`);
            const data = await response.json();
            if (data.success) {
                setBookingSources(data.data);
            }
        } catch (error) {
            console.error('Error fetching booking sources:', error);
        }
    };

    useEffect(() => {
        fetchBookingSources();
    }, []);

    // Validate booking source when booking sources load
    useEffect(() => {
        if (bookingSources.length > 0) {
            const isCurrentValid = bookingSources.some(source => source.name === bookingSource);
            if (bookingSource !== '' && !isCurrentValid) {
                setBookingSource(''); // Invalidate if not found
            }
        }
    }, [bookingSources]);

    // Reservation Types (Dynamic)
    const [reservationTypesList, setReservationTypesList] = useState([]);

    const fetchReservationTypesList = async () => {
        try {
            const response = await fetch(`${API_URL_CONFIG}/api/reservation-types/list`);
            const data = await response.json();
            if (data.success) {
                setReservationTypesList(data.data);
            }
        } catch (error) {
            console.error('Error fetching reservation types:', error);
        }
    };

    useEffect(() => {
        fetchReservationTypesList();
    }, []);

    // Validate reservation type when list loads
    useEffect(() => {
        if (reservationTypesList.length > 0) {
            const isCurrentValid = reservationTypesList.some(type => type.name === reservationType);
            if (reservationType !== '' && !isCurrentValid) {
                setReservationType('');
            }
        }
    }, [reservationTypesList]);

    // Business Sources (Dynamic)
    const [businessSourcesList, setBusinessSourcesList] = useState([]);

    const fetchBusinessSourcesList = async () => {
        try {
            const response = await fetch(`${API_URL_CONFIG}/api/business-sources/list`);
            const data = await response.json();
            if (data.success) {
                setBusinessSourcesList(data.data);
            }
        } catch (error) {
            console.error('Error fetching business sources:', error);
        }
    };

    useEffect(() => {
        fetchBusinessSourcesList();
    }, []);

    // Validate business source when list loads
    useEffect(() => {
        if (businessSourcesList.length > 0) {
            const isCurrentValid = businessSourcesList.some(source => source.name === businessSource);
            if (businessSource !== '' && !isCurrentValid) {
                setBusinessSource('');
            }
        }
    }, [businessSourcesList]);



    // Current Date for Calendar Restriction
    const today = getCurrentDateISO();

    // Form State - Reservation Meta
    const [reservationType, setReservationType] = useState('');
    const [bookingSource, setBookingSource] = useState('');
    const [businessSource, setBusinessSource] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [arrivalFrom, setArrivalFrom] = useState('');
    const [purposeOfVisit, setPurposeOfVisit] = useState('');

    // Form State - Stay Details (with pre-fill support)
    const [checkInDate, setCheckInDate] = useState(prefilledData?.checkInDate || '');
    const [checkInTime, setCheckInTime] = useState(prefilledData?.checkInTime || '14:00');
    const [checkOutDate, setCheckOutDate] = useState(prefilledData?.checkOutDate || '');
    const [checkOutTime, setCheckOutTime] = useState(prefilledData?.checkOutTime || '11:00');
    const [flexibleCheckout, setFlexibleCheckout] = useState(false);

    // Form State - Room Details (with pre-fill support)
    const [rooms, setRooms] = useState([{
        id: 1,
        categoryId: '',
        roomNumber: '',
        mealPlan: '',
        adultsCount: '',
        childrenCount: '',
        baseRate: 0,
        ratePerNight: 0,
        discount: 0
    }]);

    // Form State - Guest Information
    const [selectedGuests, setSelectedGuests] = useState([]);
    const [showGuestModal, setShowGuestModal] = useState(false);
    const [guests, setGuests] = useState([]);

    // Fetch guests from API
    const fetchGuestsFromAPI = async () => {
        try {
            const response = await fetch(`${API_URL_CONFIG}/api/guests/list`);
            const data = await response.json();

            if (data.success && data.data) {
                setGuests(data.data);
            }
        } catch (error) {
            console.error('Error fetching guests:', error);
            // Fallback to dummy data if API fails
            setGuests(getDummyGuests());
        }
    };

    // Billing State
    const [paidAmount, setPaidAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [transactionId, setTransactionId] = useState('');
    const [taxExempt, setTaxExempt] = useState(false);
    const [manualDiscountType, setManualDiscountType] = useState('FLAT');
    const [manualDiscountValue, setManualDiscountValue] = useState('');

    // Invoice State
    const [invoices, setInvoices] = useState([]);
    const [currentInvoice, setCurrentInvoice] = useState(null);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [invoiceGenerationInProgress, setInvoiceGenerationInProgress] = useState(false);

    // More Options Menu State
    // More Options Menu State (Removed)


    // Action Drawer State for More Options
    const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
    const [currentAction, setCurrentAction] = useState(null);
    const [actionBooking, setActionBooking] = useState(null);
    const [showPaymentAlert, setShowPaymentAlert] = useState(false);
    const [paymentAlertMessage, setPaymentAlertMessage] = useState('');

    // Amend Stay State
    // Amend Stay State (Removed)


    // Update form fields when prefilledData changes
    useEffect(() => {
        if (prefilledData) {
            console.log('📝 Applying prefilledData to form fields:', prefilledData);

            if (prefilledData.checkInDate) setCheckInDate(prefilledData.checkInDate);
            if (prefilledData.checkInTime) setCheckInTime(prefilledData.checkInTime);
            if (prefilledData.checkOutDate) setCheckOutDate(prefilledData.checkOutDate);
            if (prefilledData.checkOutTime) setCheckOutTime(prefilledData.checkOutTime);

            if (prefilledData.roomType || prefilledData.roomNumber) {
                setRooms([{
                    id: 1,
                    categoryId: prefilledData.roomType ? getCategoryIdFromRoomType(prefilledData.roomType) : '',
                    roomNumber: prefilledData.roomNumber || '',
                    mealPlan: '',
                    adultsCount: 1,
                    childrenCount: 0,
                    baseRate: prefilledData.price || 0,
                    ratePerNight: prefilledData.price || 0,
                    discount: 0
                }]);
            }
        }
    }, [prefilledData]);

    // Print Modal State
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printType, setPrintType] = useState('');
    const [printBooking, setPrintBooking] = useState(null);
    const [showPrintMenu, setShowPrintMenu] = useState(false);
    const printMenuRef = useRef(null);

    useEffect(() => {
        const handleClickOutsidePrintMenu = (event) => {
            if (printMenuRef.current && !printMenuRef.current.contains(event.target)) {
                setShowPrintMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutsidePrintMenu);
        return () => document.removeEventListener('mousedown', handleClickOutsidePrintMenu);
    }, []);

    // Room Categories (using facility types from above)
    const roomCategories = useMemo(() => {
        if (facilityTypes.length === 0) {
            // Fallback to hardcoded if no dynamic types loaded yet, to prevent crashes
            return {
                'deluxe-ac-double': { name: 'Deluxe AC Double', baseRate: 3000 },
                'deluxe-ac-single': { name: 'Deluxe AC Single', baseRate: 2000 },
                'deluxe-non-ac': { name: 'Deluxe Non-AC', baseRate: 1500 },
                'club-ac-double': { name: 'Club AC Double', baseRate: 4000 },
                'club-ac-single': { name: 'Club AC Single', baseRate: 2800 },
                'suite': { name: 'Executive Suite', baseRate: 5500 }
            };
        }

        const categories = {};
        facilityTypes.forEach(type => {
            // Using name as key for simplicity and mapping
            // In a real app with prices, we might need more data from backend
            categories[type.name] = {
                name: type.name,
                baseRate: 0 // Default rate as we don't have it in facility type model
            };
        });
        return categories;
    }, [facilityTypes]);

    // Calculate nights
    const calculateNights = useCallback(() => {
        if (!checkInDate || !checkOutDate) return 0;
        const [inYear, inMonth, inDay] = checkInDate.split('-').map(Number);
        const [outYear, outMonth, outDay] = checkOutDate.split('-').map(Number);
        const inDate = Date.UTC(inYear, (inMonth || 1) - 1, inDay || 1);
        const outDate = Date.UTC(outYear, (outMonth || 1) - 1, outDay || 1);
        return Math.max(1, Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24)));
    }, [checkInDate, checkOutDate]);

    const nights = calculateNights();

    // Validate room categories when facility types load
    useEffect(() => {
        if (facilityTypes.length > 0) {
            setRooms(prevRooms => {
                return prevRooms.map(room => {
                    // Check if current categoryId (which acts as key) exists in the new facilityTypes list
                    const isValid = facilityTypes.some(t => t.name === room.categoryId);

                    if (room.categoryId !== '' && !isValid) {
                        // If invalid (e.g. was using hardcoded ID), switch to empty
                        return {
                            ...room,
                            categoryId: ''
                        };
                    }
                    return room;
                });
            });
        }
    }, [facilityTypes]);

    // Validate meal plans when meal types load
    useEffect(() => {
        if (mealTypes.length > 0) {
            setRooms(prevRooms => {
                return prevRooms.map(room => {
                    // Check if current mealPlan exists in mealTypes
                    if (room.mealPlan) {
                        const isValid = mealTypes.some(mt => mt.shortCode === room.mealPlan);
                        if (!isValid) {
                            return { ...room, mealPlan: '' };
                        }
                    }
                    return room;
                });
            });
        }
    }, [mealTypes]);

    // Calculate billing
    const billingData = useMemo(() => {
        let configuredDiscounts = [];
        try {
            configuredDiscounts = JSON.parse(localStorage.getItem('discounts') || '[]');
        } catch {
            configuredDiscounts = [];
        }

        const taxResult = calculateRoomTaxBySlab({
            rooms,
            nights,
            taxExempt,
            inclusiveTax: settings.inclusiveTax,
            roomGstSlabs: settings.roomGstSlabs,
            fallbackRoomGst: settings.roomGst
        });
        const roomCharges = taxResult.roomCharges;
        const totalDiscount = taxResult.totalDiscount;
        const subtotal = taxResult.subtotal;
        const isInclusive = settings.inclusiveTax;
        const taxAmount = taxResult.taxAmount;
        const serviceChargePct = parseFloat(settings.roomServiceCharge) || 0;
        const serviceChargeAmount = subtotal > 0 ? Math.round((subtotal * serviceChargePct) / 100) : 0;
        const preDiscountGrossTotal = (isInclusive || taxExempt ? subtotal : subtotal + taxAmount) + serviceChargeAmount;

        const activeDiscountRules = configuredDiscounts.filter(rule => {
            if (rule?.status !== 'ACTIVE') return false;
            const applies = Array.isArray(rule?.appliesTo) ? rule.appliesTo : [];
            return applies.some(category => ['ROOM', 'BILL', 'ROOM_CHARGES'].includes(category));
        });

        let autoDiscountAmount = 0;
        const autoDiscountNames = [];

        activeDiscountRules.forEach(rule => {
            const applies = Array.isArray(rule?.appliesTo) ? rule.appliesTo : [];
            const appliesToBill = applies.includes('BILL');
            const baseAmount = appliesToBill ? preDiscountGrossTotal : roomCharges;

            let currentDiscount = 0;
            if (rule.type === 'PERCENTAGE') {
                currentDiscount = (baseAmount * (Number(rule.value) || 0)) / 100;
            } else {
                currentDiscount = Number(rule.value) || 0;
            }

            if (currentDiscount > 0) {
                autoDiscountAmount += currentDiscount;
                autoDiscountNames.push(rule.name);
            }
        });

        autoDiscountAmount = Math.min(autoDiscountAmount, preDiscountGrossTotal);
        const grossAfterAutoDiscount = Math.max(0, preDiscountGrossTotal - autoDiscountAmount);

        const discountInput = Math.max(0, Number(manualDiscountValue) || 0);
        const rawManualDiscount = manualDiscountType === 'PERCENTAGE'
            ? (grossAfterAutoDiscount * Math.min(discountInput, 100)) / 100
            : discountInput;
        const appliedManualDiscount = Math.min(rawManualDiscount, grossAfterAutoDiscount);
        const manualDiscountPercent = grossAfterAutoDiscount > 0 ? (appliedManualDiscount / grossAfterAutoDiscount) * 100 : 0;
        const totalAmount = Math.max(0, grossAfterAutoDiscount - appliedManualDiscount);
        const balanceDue = Math.max(0, totalAmount - (paidAmount || 0));
        const taxLabel = taxExempt
            ? 'Tax (exempt)'
            : `Tax (${taxResult.effectiveRate.toFixed(2)}% slab avg.)${isInclusive ? ' (incl.)' : ''}`;

        return {
            roomCharges,
            totalDiscount: totalDiscount + autoDiscountAmount + appliedManualDiscount,
            roomLevelDiscount: totalDiscount,
            autoDiscountAmount,
            autoDiscountNames,
            manualDiscount: appliedManualDiscount,
            manualDiscountType,
            manualDiscountValue: manualDiscountValue === ''
                ? ''
                : (manualDiscountType === 'PERCENTAGE' ? Math.min(discountInput, 100) : Math.min(discountInput, grossAfterAutoDiscount)),
            manualDiscountPercent,
            subtotal,
            taxAmount,
            taxLabel,
            serviceChargeAmount,
            serviceChargePct,
            grossTotal: grossAfterAutoDiscount,
            preDiscountGrossTotal,
            totalAmount,
            paidAmount: paidAmount || 0,
            balanceDue,
            paymentMode
        };
    }, [rooms, nights, paidAmount, paymentMode, taxExempt, manualDiscountType, manualDiscountValue, settings.roomGst, settings.roomGstSlabs, settings.roomServiceCharge, settings.inclusiveTax]);

    // Handle View Invoice
    const handleViewInvoice = useCallback((invoiceId) => {
        const invoice = invoices.find(inv => inv.invoiceId === invoiceId);
        if (invoice) {
            setCurrentInvoice(invoice);
            setShowInvoiceModal(true);
        }
    }, [invoices]);

    // Handle More Options action selection
    const handleMoreOptionsAction = useCallback((actionType, bookingSpec) => {
        const targetReservation = bookingSpec || selectedReservation;
        if (!targetReservation) return;

        // Keep check-in inside page flow (no popup drawer).
        if (actionType === 'check-in') {
            handleEditReservation(targetReservation);
            return;
        }

        // NEW: Intercept View Invoice action to open modal directly
        if (actionType === 'view-invoice') {
            console.log('📦 handleMoreOptionsAction: Intercepting view-invoice...');
            handleGenerateInvoice({
                ...targetReservation,
                actionType: 'viewInvoice',
                isProforma: targetReservation.status === 'IN_HOUSE'
            });
            return;
        }

        // Calculate correct billing totals (matching ReservationCard logic)
        const transactions = targetReservation.transactions || [];
        const isMultiRoom = targetReservation.rooms && targetReservation.rooms.length > 1;
        
        // 1. Calculate Core Room Charges
        let roomCharges = 0;
        if (isMultiRoom) {
            roomCharges = targetReservation.rooms.reduce((sum, room) => {
                return sum + ((room.ratePerNight || 0) * (targetReservation.nights || 1)) - (room.discount || 0);
            }, 0);
        } else {
            roomCharges = targetReservation.roomCharges || 
                         ((targetReservation.rooms?.[0]?.ratePerNight || 0) * (targetReservation.nights || 1)) - (targetReservation.rooms?.[0]?.discount || 0);
        }

        // 2. Folio Charges
        const totalFolioCharges = transactions
            .filter(t => t.type?.toLowerCase() === 'charge' && 
                        !['Room Tariff', 'Room Rent', 'Room Charges'].includes(t.particulars))
            .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

        // 3. Paid Amount
        const totalPaid = transactions
            .filter(t => t.type?.toLowerCase() === 'payment')
            .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

        const calculatedTotal = roomCharges + totalFolioCharges;
        const calculatedBalance = calculatedTotal - totalPaid;

        // Convert reservation to booking format for the actions
        const bookingData = {
            _id: targetReservation.id,
            bookingId: targetReservation.referenceNumber,
            guestName: targetReservation.guestName,
            mobileNumber: targetReservation.guestPhone,
            email: targetReservation.guestEmail,
            roomNumber: targetReservation.rooms?.[0]?.roomNumber || '',
            roomType: targetReservation.rooms?.[0]?.categoryId?.replace(/-/g, ' ').toUpperCase() || '',
            checkInDate: targetReservation.checkInDate,
            checkInTime: targetReservation.checkInTime || '14:00',
            checkOutDate: targetReservation.checkOutDate,
            checkOutTime: targetReservation.checkOutTime || '11:00',
            numberOfNights: targetReservation.nights,
            numberOfAdults: targetReservation.rooms?.[0]?.adultsCount || 1,
            numberOfChildren: targetReservation.rooms?.[0]?.childrenCount || 0,
            numberOfGuests: targetReservation.rooms?.[0]?.adultsCount || 1, // Fallback
            childrenCount: targetReservation.rooms?.[0]?.childrenCount || 0, // Explicit for form
            pricePerNight: targetReservation.rooms?.[0]?.ratePerNight || 0,
            totalAmount: calculatedTotal,
            advancePaid: totalPaid,
            remainingAmount: calculatedBalance,
            status: targetReservation.status === 'RESERVED' ? 'Upcoming' :
                targetReservation.status === 'IN_HOUSE' ? 'Checked-in' :
                    targetReservation.status === 'CHECKED_OUT' ? 'Checked-out' : 'Upcoming',
            idProofType: targetReservation.idProofType,
            idNumber: targetReservation.idNumber || targetReservation.idProofNumber,
            idProofNumber: targetReservation.idNumber || targetReservation.idProofNumber,
            vehicleNumber: targetReservation.vehicleNumber,
            additionalGuests: targetReservation.additionalGuests || [],
            visitors: targetReservation.visitors || [],
            transactions: transactions
        };

        // Open BookingActionsManager drawer for all actions (including print)
        setCurrentAction(actionType);
        setActionBooking(bookingData);
        setActionDrawerOpen(true);
    }, [selectedReservation]);

    const handlePrintConfirm = (type, booking) => {
        // Implement actual print logic here
        // For now, we'll close the modal and simulate the action
        console.log(`Executing ${type} for booking ${booking.id}`);

        // You can add specific print logic here if needed
        if (type === 'print-invoice') {
            // Logic to print invoice
            // maybe calling onGenerateInvoice?
            if (booking.status === 'CHECKED_OUT' || booking.status === 'IN_HOUSE') {
                handleGenerateInvoice(booking);
            } else {
                alert("Invoice unavailable for this status");
            }
        } else {
            window.print(); // Simple fallback
        }

        setShowPrintModal(false);
    };

    // Handle action success
    const handleActionSuccess = async (updatedBooking) => {
        // Optimistic UI update
        if (updatedBooking && updatedBooking._id) {
            const mappedReservation = mapBookingToReservation(updatedBooking);

            setReservations(prev =>
                prev.map(r => (r.id === mappedReservation.id || r._id === mappedReservation.id) ? mappedReservation : r)
            );

            // Also update selectedReservation if it matches
            if (selectedReservation && (selectedReservation.id === mappedReservation.id)) {
                setSelectedReservation(mappedReservation);
            }
        }

        // Fetch fresh data from API to ensure sync
        await fetchReservationsFromAPI();
    };


    // Handle Generate Invoice
    const handleGenerateInvoice = useCallback(async (reservation) => {
        if (reservation.actionType === 'viewInvoice') {
            try {
                console.log('🔍 handleGenerateInvoice: View mode triggered', reservation);

                // 1. Try to find in local invoices state
                let existingInvoice = invoices.find(inv =>
                    (reservation.invoiceId && inv.invoiceId === reservation.invoiceId) ||
                    (inv.reservationId === reservation.id)
                );

                if (existingInvoice) {
                    console.log('✅ handleGenerateInvoice: Found existing invoice', existingInvoice);
                    setCurrentInvoice(existingInvoice);
                    setShowInvoiceModal(true);
                    return;
                }

                // 2. Regenerate preview
                console.log('⚡ handleGenerateInvoice: No local invoice found, regenerating preview...');
                const billingDataForInvoice = {
                    roomCharges: reservation.roomCharges || 0,
                    totalDiscount: reservation.discount || 0,
                    subtotal: (reservation.roomCharges || 0) - (reservation.discount || 0),
                    taxAmount: reservation.tax || 0,
                    totalAmount: reservation.totalAmount || 0,
                    paidAmount: reservation.paidAmount || 0,
                    balanceDue: reservation.balanceDue || 0,
                    paymentMode: reservation.paymentMode || 'Cash'
                };

                const invoice = reservation.isProforma
                    ? InvoiceGenerator.generateProformaInvoice(reservation, billingDataForInvoice, settings)
                    : InvoiceGenerator.generateInvoice(reservation, billingDataForInvoice, settings);

                if (reservation.invoiceId) invoice.invoiceId = reservation.invoiceId;
                if (!reservation.isProforma) invoice.invoiceStatus = 'FINAL';

                setCurrentInvoice(invoice);
                setShowInvoiceModal(true);
            } catch (error) {
                console.error('❌ Error in viewInvoice logic:', error);
                alert('Could not open invoice view: ' + error.message);
            }
            return;
        }

        if (reservation.status !== 'IN_HOUSE' && reservation.status !== 'CHECKED_OUT') {
            alert('Invoice can only be generated during check-out');
            return;
        }

        // Check for pending balance - Prevent Check-out if not fully paid (only if mandatorySettlement is enabled)
        if (reservation.status === 'IN_HOUSE' && reservation.balanceDue > 0.5 && settings.billingRules?.mandatorySettlement !== false) {
            setPaymentAlertMessage(
                `Payment Pending! \n\nGuest: ${reservation.guestName} \nRoom: ${reservation.roomNumber} \n\nOutstanding Balance: ${cs}${reservation.balanceDue?.toLocaleString('en-IN')} \n\nPlease settle the full bill in the Folio section before proceeding with check-out.`
            );
            setShowPaymentAlert(true);
            return;
        }

        setInvoiceGenerationInProgress(true);

        try {
            const billingDataForInvoice = {
                roomCharges: reservation.roomCharges,
                totalDiscount: reservation.discount,
                subtotal: reservation.roomCharges - reservation.discount,
                taxAmount: reservation.tax,
                totalAmount: reservation.totalAmount,
                paidAmount: reservation.paidAmount,
                balanceDue: reservation.balanceDue,
                paymentMode: reservation.paymentMode
            };

            // Track actual checkout time
            const checkoutData = {
                ...reservation,
                checkOutDate: reservation.status === 'IN_HOUSE' ? getCurrentDateISO() : reservation.checkOutDate,
                checkOutTime: reservation.status === 'IN_HOUSE' ? getCurrentTime24() : reservation.checkOutTime
            };
            const invoice = InvoiceGenerator.generateInvoice(checkoutData, billingDataForInvoice, settings);
            await InvoiceGenerator.saveInvoice(invoice);

            setInvoices([...invoices, invoice]);
            setCurrentInvoice(invoice);

            // Persist status change to Database
            try {
                const response = await fetch(`${API_URL}/status/${reservation.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'Checked-out',
                        invoiceId: invoice.invoiceId
                    })
                });

                const responseData = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(responseData.message || 'Failed to update checkout status');
                }

                // Refresh list from server to stay in sync
                await fetchReservationsFromAPI();
                // Auto switch to Checked Out tab to show the plate as requested
                setActiveTab('checked-out');

                alert('Guest Checked-out successfully. Invoice generated and saved.');
            } catch (error) {
                console.error('Error updating status in DB:', error);

                // Still try to update locally and refresh
                try {
                    await fetchReservationsFromAPI();
                } catch (e) {
                    // ignore refresh error
                }

                // Show specific error from backend
                if (error.message && error.message.includes('Pending payment')) {
                    alert(error.message);
                } else {
                    // Fallback to local update
                    setReservations(reservations.map(r =>
                        r.id === reservation.id ? {
                            ...r,
                            status: 'CHECKED_OUT',
                            invoiceId: invoice.invoiceId,
                            updatedAt: new Date().toISOString()
                        } : r
                    ));
                    alert('Checkout completed. ' + (error.message || ''));
                }
            }
        } finally {
            setInvoiceGenerationInProgress(false);
        }
    }, [invoices, reservations, handleViewInvoice]);

    // Handle Update Status
    const handleUpdateReservationStatus = useCallback(async (reservationId, newStatus) => {
        if (newStatus === 'IN_HOUSE') {
            const reservation = displayReservations.find(r => r.id === reservationId);
            if (reservation) {
                handleMoreOptionsAction('check-in', reservation);
                return;
            }
        }

        try {
            // Map UI status to MongoDB booking status
            const bookingStatus = newStatus === 'RESERVED' ? 'Upcoming' :
                newStatus === 'IN_HOUSE' ? 'Checked-in' :
                    newStatus === 'CHECKED_OUT' ? 'Checked-out' :
                        'Upcoming';

            const response = await fetch(`${API_URL}/status/${reservationId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: bookingStatus })
            });

            const data = await response.json();
            if (data.success) {
                await fetchReservationsFromAPI();
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status');
        }
    }, [displayReservations, handleMoreOptionsAction]);

    // Reset Form
    const resetForm = useCallback(() => {
        setIsEditingMode(false);
        setEditingReservationId(null);
        setReservationType('');
        setBookingSource('');
        setBusinessSource('');
        setReferenceNumber('');
        setArrivalFrom('');
        setPurposeOfVisit('');
        setCheckInDate('');
        setCheckInTime('14:00');
        setCheckOutDate('');
        setCheckOutTime('11:00');
        setFlexibleCheckout(false);
        setRooms([{ id: 1, categoryId: '', roomNumber: '', mealPlan: '', adultsCount: '', childrenCount: '', baseRate: 0, ratePerNight: 0, discount: 0 }]);
        setSelectedGuests([]);
        setPaidAmount(0);
        setPaymentMode('Cash');
        setTransactionId('');
        setTaxExempt(false);
        setManualDiscountType('FLAT');
        setManualDiscountValue('');
        setShowGuestModal(false);
        setShowInvoiceModal(false);
        setCurrentInvoice(null);
        setFromRoomsPage(false);
        setPrefilledData(null);
    }, []);

    // Handle Save Reservation
    const handleSaveReservation = async (e, status = 'RESERVED') => {
        if (e && e.preventDefault) e.preventDefault();

        if (selectedGuests.length === 0) {
            alert('Please select at least one guest');
            return;
        }

        if (!checkInDate || !checkOutDate) {
            alert('Please enter check-in and check-out dates');
            return;
        }

        if (checkOutDate <= checkInDate) {
            alert('Check-out date must be after check-in date');
            return;
        }

        // Map all rooms to backend format
        const mappedRooms = rooms.map(room => ({
            roomType: room.categoryId?.replace(/-/g, ' ').toUpperCase() || 'STANDARD',
            roomNumber: room.roomNumber || 'TBD',
            ratePerNight: Number(room.ratePerNight) || 0,
            mealPlan: room.mealPlan || 'CP',
            adults: Number(room.adultsCount) || 1,
            children: Number(room.childrenCount) || 0,
            discount: Number(room.discount) || 0,
            total: (Number(room.ratePerNight) * (Number(nights) || 1)) - (Number(room.discount) || 0)
        }));

        const totalGuests = mappedRooms.reduce((sum, r) => sum + r.adults + r.children, 0);

        const bookingData = {
            guestName: selectedGuests[0].fullName || selectedGuests[0].name || selectedGuests[0].guestName,
            mobileNumber: selectedGuests[0].mobile || selectedGuests[0].phone || selectedGuests[0].mobileNumber,
            email: selectedGuests[0].email || selectedGuests[0].guestEmail,
            idProofType: selectedGuests[0].idProof?.type || selectedGuests[0].idType || 'Aadhaar',
            idNumber: selectedGuests[0].idProof?.number || selectedGuests[0].idNumber || '',
            vehicleNumber: selectedGuests[0].vehicleNumber || '',
            additionalGuests: selectedGuests.slice(1).map(g => ({
                name: g.fullName || g.name || g.guestName,
                mobile: g.mobile || g.phone || g.mobileNumber,
                email: g.email || g.guestEmail,
                gender: g.gender || '',
                nationality: g.nationality || 'Indian',
                dob: g.dob || '',
                address: (typeof g.address === 'object' ? g.address?.line : g.address) || '',
                city: g.city || g.address?.city || '',
                state: g.state || g.address?.state || '',
                country: g.country || g.address?.country || 'India',
                pinCode: g.pinCode || g.address?.pinCode || '',
                idProofType: g.idProof?.type || g.idType || '',
                idProofNumber: g.idProof?.number || g.idNumber || '',
                vehicleNumber: g.vehicleNumber || '',
                companyName: g.companyName || ''
            })),
            totalGuestProfiles: selectedGuests.length,
            rooms: mappedRooms,
            isMulti: mappedRooms.length > 1,
            roomType: mappedRooms[0].roomType, // Primary room for legacy support
            roomNumber: mappedRooms[0].roomNumber,
            numberOfGuests: totalGuests > 0 ? totalGuests : 1,
            checkInDate,
            checkOutDate,
            numberOfNights: Number(nights) || 1,
            pricePerNight: mappedRooms[0].ratePerNight,
            discountAmount: Number(billingData.totalDiscount) || 0,
            autoDiscountAmount: Number(billingData.autoDiscountAmount) || 0,
            autoDiscountNames: billingData.autoDiscountNames || [],
            manualDiscountAmount: Number(billingData.manualDiscount) || 0,
            manualDiscountType: billingData.manualDiscountType,
            manualDiscountValue: Number(billingData.manualDiscountValue) || 0,
            taxAmount: Number(billingData.taxAmount) || 0,
            serviceChargeAmount: Number(billingData.serviceChargeAmount) || 0,
            totalAmount: Number(billingData.totalAmount) || 0,
            advancePaid: Number(billingData.paidAmount) || 0,
            paymentMode: paymentMode,
            transactionId: transactionId || '',
            status: status === 'IN_HOUSE' ? 'Checked-in' : 'Upcoming',
            reservationType: reservationType || 'Confirm',
            bookingSource: bookingSource || 'Direct',
            businessSource: businessSource || 'Walk-In',
            arrivalFrom: arrivalFrom || '',
            purposeOfVisit: purposeOfVisit || '',
            scheduledCheckInTime: checkInTime,
            scheduledCheckOutTime: checkOutTime,
            referenceId: referenceNumber || `REF-${Date.now()}`
        };

        console.log('Sending multi-room booking data:', bookingData);

        try {
            if (isEditingMode) {
                // Update existing booking
                const response = await fetch(`${API_URL}/update/${editingReservationId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookingData)
                });

                const data = await response.json();
                if (data.success) {
                    await fetchReservationsFromAPI();
                    setSuccessMessage('Reservation updated successfully!');
                    setTimeout(() => {
                        setSuccessMessage('');
                        navigate('/admin/dashboard');
                    }, 1500);
                } else {
                    setErrors({ submit: `Error: ${data.message}` });
                    return;
                }
            } else {
                // Create new booking
                const response = await fetch(`${API_URL}/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookingData)
                });

                const data = await response.json();
                if (data.success) {
                    await fetchReservationsFromAPI(); // Refresh list
                    setSuccessMessage('Reservation created successfully!');
                    setTimeout(() => {
                        setSuccessMessage('');
                        navigate('/admin/dashboard');
                    }, 1500);
                } else {
                    console.error('Server returned error:', data);
                    setErrors({ submit: `Error creating reservation: ${data.message || 'Unknown error'}` });
                    return;
                }
            }

            resetForm();
        } catch (error) {
            console.error('Error saving reservation:', error);
            setErrors({ submit: `Failed to save reservation: ${error.message}` });
        }
    };

    // Handle Edit
    const handleEditReservation = (reservation) => {
        setEditingReservationId(reservation.id);
        setIsEditingMode(true);
        setReservationType(reservation.reservationType);
        setBookingSource(reservation.bookingSource);
        setBusinessSource(reservation.businessSource);
        setReferenceNumber(reservation.referenceNumber);
        setArrivalFrom(reservation.arrivalFrom);
        setPurposeOfVisit(reservation.purposeOfVisit);
        setCheckInDate(reservation.checkInDate);
        setCheckInTime(reservation.checkInTime);
        setCheckOutDate(reservation.checkOutDate);
        setCheckOutTime(reservation.checkOutTime);
        setFlexibleCheckout(reservation.flexibleCheckout);
        setRooms(JSON.parse(JSON.stringify(reservation.rooms)));
        setSelectedGuests([{
            id: reservation.guestId,
            name: reservation.guestName,
            email: reservation.guestEmail,
            phone: reservation.guestPhone
        }]);
        setPaidAmount(reservation.paidAmount);
        setPaymentMode(reservation.paymentMode);
        setTransactionId(reservation.transactionId || '');
        setTaxExempt(reservation.taxExempt);
        setManualDiscountType(reservation.manualDiscountType || 'FLAT');
        setManualDiscountValue(
            reservation.manualDiscountValue !== undefined
                ? reservation.manualDiscountValue
                : (reservation.manualDiscountAmount || 0)
        );
        setView('form');
    };

    // Handle Delete
    const handleDeleteReservation = async (reservationId) => {
        // Removed confirm pop section

        try {
            const response = await fetch(`${API_URL}/delete/${reservationId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (data.success) {
                await fetchReservationsFromAPI();
                // Removed success alert
            } else {
                setErrors({ submit: `Error: ${data.message}` });
            }
        } catch (error) {
            console.error('Error deleting reservation:', error);
            setErrors({ submit: 'Failed to delete reservation' });
        }
    };


    // Convert 24-hour to 12-hour format
    const convertTo12Hour = (time24) => {
        if (!time24) return { time: '12:00', period: 'PM' };
        const [hours, minutes] = time24.split(':');
        let hour = parseInt(hours);
        const period = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return { time: `${hour.toString().padStart(2, '0')}:${minutes}`, period };
    };

    // Convert 12-hour to 24-hour format
    const convertTo24Hour = (time12, period) => {
        if (!time12) return '00:00';
        const [hours, minutes] = time12.split(':');
        let hour = parseInt(hours);
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}:${minutes}`;
    };



    // Room Service View
    if (view === 'roomservice') {
        if (!hasRoomPermission('Room Service')) {
            return (
                <div className="reservation-management-container">
                    <div className="error-alert">Unknown Permission: You do not have access to Room Service.</div>
                    <button className="reservation-back-btn" onClick={() => setView('dashboard')}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        <span>Back to Dashboard</span>
                    </button>
                </div>
            );
        }
        return (
            <div className="reservation-management-container">
                <div className="reservation-header">
                    <div className="reservation-form-top-nav">
                        <button className="reservation-back-btn" onClick={() => setView('dashboard')}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            <span>Back to Dashboard</span>
                        </button>
                    </div>
                </div>
                <RoomService />
            </div>
        );
    }

    // Housekeeping View
    if (view === 'housekeeping') {
        if (!hasRoomPermission('Housekeeping')) {
            return (
                <div className="reservation-management-container">
                    <div className="error-alert">Unknown Permission: You do not have access to Housekeeping.</div>
                    <button className="reservation-back-btn" onClick={() => setView('dashboard')}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        <span>Back to Dashboard</span>
                    </button>
                </div>
            );
        }
        return (
            <div className="reservation-management-container">
                <div className="reservation-header">
                    <div className="reservation-form-top-nav">
                        <button className="reservation-back-btn" onClick={() => setView('dashboard')}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            <span>Back to Dashboard</span>
                        </button>
                    </div>
                </div>
                <HousekeepingView />
            </div>
        );
    }

    if (view === 'form') {
        if (!isEditingMode && !hasRoomPermission('New Reservation')) {
            return (
                <div className="reservation-management-container">
                    <div className="error-alert">Unknown Permission: You do not have access to create New Reservations.</div>
                    <button className="reservation-back-btn" onClick={() => setView('dashboard')}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        <span>Back to Dashboard</span>
                    </button>
                </div>
            );
        }
        return (
            <div className="reservation-management-container">
                {successMessage && (
                    <div className="success-note-overlay">
                        <motion.div 
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="success-note"
                        >
                            <span className="success-icon">✓</span>
                            {successMessage}
                        </motion.div>
                    </div>
                )}
                <div className="reservation-header form-view-header-compact">
                    <div className="reservation-form-top-nav">
                        <button className="reservation-back-btn" onClick={() => { resetForm(); setView('dashboard'); }}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            <span>Back to Dashboard</span>
                        </button>
                    </div>
                </div>
                <div className="form-container">
                    <div className="form-main">
                        <h1>{isEditingMode ? 'Edit Reservation' : 'Create New Reservation'}</h1>

                        <div className="reservation-form-view">
                            {/* Reservation Details Section */}
                            <div className="form-section">
                                <h3 className="section-title">📋 Reservation Details</h3>
                                <div className="form-grid-2">
                                    <div className="form-row">
                                        <label>Reservation Type</label>
                                        <select value={reservationType} onChange={(e) => setReservationType(e.target.value)}>
                                            <option value="">Select Reservation Type</option>
                                            {reservationTypesList.length > 0 ? (
                                                reservationTypesList.map((type, idx) => (
                                                    <option key={type._id || `restype-${idx}`} value={type.name}>
                                                        {type.name}
                                                    </option>
                                                ))
                                            ) : (
                                                <>
                                                    <option value="Confirm">Confirm</option>
                                                    <option value="Provisional">Provisional</option>
                                                    <option value="Tentative">Tentative</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                    <div className="form-row">
                                        <label>Booking Source</label>
                                        <select value={bookingSource} onChange={(e) => setBookingSource(e.target.value)}>
                                            <option value="">Select Booking Source</option>
                                            {bookingSources.length > 0 ? (
                                                bookingSources.map((source, idx) => (
                                                    <option key={source._id || `bsource-${idx}`} value={source.name}>
                                                        {source.name}
                                                    </option>
                                                ))
                                            ) : (
                                                <>
                                                    <option value="Direct">Direct</option>
                                                    <option value="OTA">OTA</option>
                                                    <option value="Travel Agent">Travel Agent</option>
                                                    <option value="Corporate">Corporate</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                    <div className="form-row">
                                        <label>Business Source</label>
                                        <select value={businessSource} onChange={(e) => setBusinessSource(e.target.value)}>
                                            <option value="">Select Business Source</option>
                                            {businessSourcesList.length > 0 ? (
                                                businessSourcesList.map((source, idx) => (
                                                    <option key={source._id || `busource-${idx}`} value={source.name}>
                                                        {source.name}
                                                    </option>
                                                ))
                                            ) : (
                                                <>
                                                    <option value="Walk-In">Walk-In</option>
                                                    <option value="Phone">Phone</option>
                                                    <option value="Email">Email</option>
                                                    <option value="Website">Website</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                    <div className="form-row">
                                        <label>Reference Number</label>
                                        <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Booking reference..." />
                                    </div>
                                    <div className="form-row">
                                        <label>Arrival From</label>
                                        <input type="text" value={arrivalFrom} onChange={(e) => setArrivalFrom(e.target.value)} placeholder="Arrival city/place..." />
                                    </div>
                                    <div className="form-row">
                                        <label>Purpose of Visit</label>
                                        <input type="text" value={purposeOfVisit} onChange={(e) => setPurposeOfVisit(e.target.value)} placeholder="Purpose of stay..." />
                                    </div>
                                </div>
                            </div>

                            {/* Guest Selection Section */}
                            <div className="form-section">
                                <h3 className="section-title">👤 Guest Information</h3>
                                {selectedGuests.length > 0 ? (
                                    <div className="guest-selection">
                                        {selectedGuests.map((guest, idx) => (
                                            <div className="selected-guest-card" key={guest._id || guest.id || guest.guestId || idx}>
                                                <div className="guest-info">
                                                    {idx === 0 && <span className="guest-primary-badge">Primary</span>}
                                                    <p className="guest-name">{guest.fullName || guest.name}</p>
                                                    <p className="guest-details">{guest.mobile || guest.phone} | {guest.email}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn-remove-guest"
                                                    onClick={() => setSelectedGuests(prev => prev.filter((_, i) => i !== idx))}
                                                    title="Remove guest"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                        <div className="guest-selection-footer">
                                            <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowGuestModal(true)}>
                                                + Add / Change Guests
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="no-guest-selected">
                                        <p>No guest selected</p>
                                        <div className="guest-selection-footer">
                                            <button type="button" className="btn btn-primary select-create-guest-btn" onClick={() => setShowGuestModal(true)}>
                                                + Select or Create Guest
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <GuestModal
                                    isOpen={showGuestModal}
                                    onClose={() => setShowGuestModal(false)}
                                    onSelectGuest={(result) => {
                                        if (Array.isArray(result)) {
                                            setSelectedGuests(result);
                                        } else {
                                            setSelectedGuests([result]);
                                        }
                                    }}
                                    guests={guests}
                                    onRefreshGuests={fetchGuestsFromAPI}
                                    autoOpenCreate={location.state?.autoOpenGuestModal || false}
                                    multiSelect={true}
                                    preSelectedGuests={selectedGuests}
                                />
                            </div>

                            {/* Stay Details Section */}
                            <div className="form-section">
                                <h3 className="section-title">🏨  Stay Details</h3>
                                <div className="form-grid-2">
                                    <div className="form-row">
                                        <label>Check-In Date</label>
                                        <input
                                            type="date"
                                            value={checkInDate}
                                            min={today}
                                            onChange={(e) => {
                                                const nextCheckInDate = e.target.value;
                                                setCheckInDate(nextCheckInDate);

                                                if (nextCheckInDate === getCurrentDateISO() && isPastDateTime(nextCheckInDate, checkInTime)) {
                                                    setCheckInTime(getCurrentTime24());
                                                }

                                                if (checkOutDate && checkOutDate < nextCheckInDate) {
                                                    setCheckOutDate(nextCheckInDate);
                                                }
                                            }}
                                            required
                                            readOnly={fromRoomsPage}
                                            className={fromRoomsPage ? 'locked-input' : ''}
                                        />
                                    </div>
                                    <div className="form-row">
                                        <label>Check-In Time</label>
                                        <input
                                            type="time"
                                            value={checkInTime}
                                            onChange={(e) => {
                                                const nextTime = toTime24(e.target.value);
                                                if (checkInDate === getCurrentDateISO() && isPastDateTime(checkInDate, nextTime)) {
                                                    alert('Check-in time cannot be in the past for today.');
                                                    setCheckInTime(getCurrentTime24());
                                                    return;
                                                }
                                                setCheckInTime(nextTime);
                                            }}
                                        />
                                    </div>
                                    <div className="form-row">
                                        <label>Check-Out Date</label>
                                        <input
                                            type="date"
                                            value={checkOutDate}
                                            min={checkInDate || today}
                                            onChange={(e) => setCheckOutDate(e.target.value)}
                                            required
                                            readOnly={fromRoomsPage}
                                            className={fromRoomsPage ? 'locked-input' : ''}
                                        />
                                    </div>
                                    <div className="form-row">
                                        <label>Check-Out Time</label>
                                        <input
                                            type="time"
                                            value={checkOutTime}
                                            onChange={(e) => setCheckOutTime(toTime24(e.target.value))}
                                        />
                                    </div>
                                </div>
                                <label className="checkbox-label">
                                    <input type="checkbox" checked={flexibleCheckout} onChange={(e) => setFlexibleCheckout(e.target.checked)} />
                                    Flexible Checkout
                                </label>
                            </div>

                            {/* Rooms Section */}
                            <div className="form-section">
                                <h3 className="section-title">🛏️ Room Details ({nights} nights)</h3>
                                <div className="rooms-list">
                                    {rooms.map((room, index) => (
                                        <RoomRow
                                            key={index}
                                            room={room}
                                            index={index}
                                            nights={nights}
                                            roomCategories={roomCategories}
                                            readOnly={fromRoomsPage && index === 0}
                                            onUpdate={(idx, updatedRoom) => {
                                                const newRooms = [...rooms];
                                                newRooms[idx] = updatedRoom;
                                                setRooms(newRooms);
                                            }}
                                            onRemove={(idx) => setRooms(rooms.filter((_, i) => i !== idx))}
                                            mealTypes={mealTypes}
                                            checkInDate={checkInDate}
                                        />
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-add-room"
                                    onClick={() => setRooms([...rooms, {
                                        id: rooms.length + 1,
                                        categoryId: '',
                                        roomNumber: '',
                                        mealPlan: '',
                                        adultsCount: '',
                                        childrenCount: '',
                                        ratePerNight: '',
                                        discount: ''
                                    }])}
                                >
                                    + Add Room
                                </button>
                            </div>

                            {/* Billing Summary Panel moved above actions */}
                            <BillingSummary
                                roomCharges={billingData.roomCharges}
                                discount={billingData.roomLevelDiscount}
                                autoDiscount={billingData.autoDiscountAmount}
                                autoDiscountNames={billingData.autoDiscountNames}
                                manualDiscount={billingData.manualDiscount}
                                manualDiscountType={billingData.manualDiscountType}
                                manualDiscountValue={billingData.manualDiscountValue}
                                manualDiscountPercent={billingData.manualDiscountPercent}
                                tax={billingData.taxAmount}
                                taxLabel={billingData.taxLabel}
                                serviceCharge={billingData.serviceChargeAmount}
                                serviceChargeLabel={`Service Charge (${billingData.serviceChargePct}%)`}
                                totalAmount={billingData.totalAmount}
                                grossTotal={billingData.grossTotal}
                                paidAmount={paidAmount}
                                balanceDue={billingData.balanceDue}
                                paymentMode={paymentMode}
                                onPaymentModeChange={setPaymentMode}
                                onPaidAmountChange={setPaidAmount}
                                onManualDiscountChange={setManualDiscountValue}
                                onManualDiscountTypeChange={setManualDiscountType}
                                onTaxExemptChange={setTaxExempt}
                                taxExempt={taxExempt}
                                transactionId={transactionId}
                                onTransactionIdChange={setTransactionId}
                            />

                            {/* Form Actions */}
                            <div className="form-actions">
                                <button type="button" className="btn btn-outline" onClick={() => { resetForm(); setView('dashboard'); }}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ backgroundColor: '#28a745', borderColor: '#28a745', marginRight: '1rem' }}
                                    onClick={(e) => handleSaveReservation(e, 'IN_HOUSE')}
                                >
                                    ✓ Check-In
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={(e) => handleSaveReservation(e, 'RESERVED')}
                                >
                                    {isEditingMode ? 'Update Reservation' : 'Create Reservation'}
                                </button>
                            </div>
                        </div>

                        {/* Guest Booking History Section - Premium Design */}
                        <div className="booking-history-container premium-card-wide">
                            <button
                                type="button"
                                className="history-header-btn"
                                onClick={() => setShowBookingHistory(!showBookingHistory)}
                            >
                                <div className="header-title-group">
                                    <div className="header-icon-circle">
                                        <span className="clock-icon">🕒</span>
                                    </div>
                                    <span className="header-text">Previous Booking History</span>
                                </div>
                                <span className={`chevron-icon ${showBookingHistory ? 'expanded' : ''}`}>▼</span>
                            </button>

                            <AnimatePresence>
                                {showBookingHistory && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="history-table-wrapper"
                                    >
                                        <table className="history-table">
                                            <thead>
                                                <tr>
                                                    <th>Res ID</th>
                                                    <th>Room</th>
                                                    <th>Dates</th>
                                                    <th className="text-right">Amount</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[
                                                    { id: 'RES-001', roomCategory: 'Deluxe Double', checkIn: '15 Oct', checkOut: '18 Oct', amount: `${cs}9,500`, status: 'paid' },
                                                    { id: 'RES-002', roomCategory: 'Club AC Single', checkIn: '20 Aug', checkOut: '23 Aug', amount: `${cs}7,200`, status: 'paid' },
                                                    { id: 'RES-003', roomCategory: 'Suite Double', checkIn: '10 May', checkOut: '13 May', amount: `${cs}215,000`, status: 'overdue' },
                                                    { id: 'RES-004', roomCategory: 'Club AC Double', checkIn: '3 Mar', checkOut: '8 Mar', amount: `${cs}112,000`, status: 'overdue' }
                                                ].map(booking => (
                                                    <tr key={booking.id} className="history-row">
                                                        <td className="res-id">{booking.id}</td>
                                                        <td className="room-type">{booking.roomCategory}</td>
                                                        <td className="dates">{booking.checkIn} - {booking.checkOut}</td>
                                                        <td className={`amount text-right ${booking.status}`}>
                                                            {booking.status === 'overdue' ? cs : ''}{booking.amount}
                                                        </td>
                                                        <td className="row-action">
                                                            <span className="arrow-right">›</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Invoice Modal */}
                <AnimatePresence>
                    {showInvoiceModal && currentInvoice && (
                        <div className="invoice-modal-overlay">
                            <div className="invoice-modal-content">
                                <InvoiceView
                                    invoice={currentInvoice}
                                    onClose={() => setShowInvoiceModal(false)}
                                    onPrint={() => console.log('Print invoice')}
                                    isModal={true}
                                />
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // Dashboard View
    return (
        <div className="reservation-management-container">
            {/* Header */}
            <div className="reservation-header">
                <div className="header-title">
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.5rem 0' }}>
                        🏨 Reservations & Stay Management
                    </h2>
                    <p>Manage guest reservations, check-ins, check-outs, and billing</p>

                    {/* Powerful Real-time Search Bar - Perfectly placed below subtitle */}
                    <div className="search-container">
                        <div className="search-wrapper">
                            <span className="search-icon" style={{ position: 'absolute', left: '15px', color: '#9ca3af', fontSize: '1.1rem' }}>🔍</span>
                            <input
                                type="text"
                                placeholder="Search by Guest Name, Mobile Number, or Room Number"
                                className="search-ref-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                            />
                            {isSearching && (
                                <div className="search-spinner" style={{ position: 'absolute', right: '15px' }}>
                                    <div className="spinner-mini"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="header-actions">
                    {hasRoomPermission('New Reservation') && (
                        <button className="btn btn-primary" onClick={() => setView('form')}>
                            <span style={{ marginRight: '0.5rem' }}>📅</span>
                            + New Reservation
                        </button>
                    )}
                    {hasRoomPermission('Housekeeping') && (
                        <button className="btn btn-primary" onClick={() => setView('housekeeping')}>
                            <span style={{ marginRight: '0.5rem' }}>🧹</span>
                            Housekeeping View
                        </button>
                    )}
                    {hasRoomPermission('Room Service') && (
                        <button className="btn btn-primary" onClick={() => setView('roomservice')}>
                            <span style={{ marginRight: '0.5rem' }}>🔔</span>
                            Room Service
                        </button>
                    )}
                </div>
            </div>

            <div className="tabs-toolbar">
                {/* Tabs */}
                <div className="reservation-tabs">
                    {['all', 'reserved', 'in-house', 'checked-out', 'arrival', 'departure'].map(tab => (
                        <button
                            key={tab}
                            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'all' ? 'All Reservations' : tab.replace('-', ' ').toUpperCase()}
                            <span style={{ marginLeft: '0.5rem' }}>({counts[tab] || 0})</span>
                        </button>
                    ))}
                </div>

                {/* View Toggle */}
                <div className="view-toggle-container">
                    <div className="view-toggle">
                        <button
                            className={`view-toggle-btn ${cardViewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setCardViewMode('grid')}
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
                            className={`view-toggle-btn ${cardViewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setCardViewMode('list')}
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
                </div>
            </div>

            {/* Reservation Cards and Details Panel */}
            <div className="reservation-content-layout">
                <div className={`${cardViewMode === 'grid' ? 'reservation-cards-grid' : 'reservation-cards-list'} ${selectedReservation ? 'with-details' : ''}`}>
                    <AnimatePresence mode="popLayout">
                        {displayReservations.length > 0 ? (
                            displayReservations.map(reservation => (
                                <motion.div
                                    key={reservation.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        scale: searchQuery ? 1.02 : 1,
                                        boxShadow: searchQuery ? '0 10px 25px -5px rgba(220, 53, 69, 0.1), 0 8px 10px -6px rgba(220, 53, 69, 0.1)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <ReservationCard
                                        reservation={reservation}
                                        onUpdateStatus={handleUpdateReservationStatus}
                                        onEdit={handleEditReservation}
                                        onGenerateInvoice={handleGenerateInvoice}
                                        onSelect={(res) => {
                                            setSelectedReservation(res);
                                        }}
                                        isSelected={selectedReservation?.id === reservation.id}
                                    />
                                </motion.div>
                            ))
                        ) : (
                            <div className="no-data-message" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem 2rem', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #e2e8f0', margin: '1rem' }}>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div style={{ fontSize: '5rem', marginBottom: '1.5rem', opacity: 0.3, filter: 'grayscale(0.5)' }}>
                                        🕵️‍♂️
                                    </div>
                                    <h3 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '0.5rem', fontWeight: '700' }}>
                                        No reservations found
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
                                        {searchQuery ? `We couldn't find any matches for "${searchQuery}". Please check the spelling or try searching by room number or mobile number.` : 'There are no reservations matching this status at the moment.'}
                                    </p>
                                    {searchQuery && (
                                        <button
                                            className="btn btn-primary"
                                            style={{ padding: '0.8rem 2rem', borderRadius: '10px', backgroundColor: '#ef4444', borderColor: '#ef4444' }}
                                            onClick={() => setSearchQuery('')}
                                        >
                                            Clear Search & View All
                                        </button>
                                    )}
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Details Panel */}
                {selectedReservation && (
                    <div className="reservation-details-panel">
                        <div className="details-header">
                            <button
                                className="close-details-btn-top"
                                onClick={() => setSelectedReservation(null)}
                            >
                                ✕
                            </button>
                            <div className="details-guest-info">
                                <div className="guest-info-row">
                                    <span className="guest-icon">👤</span>
                                    <span className="guest-name-header">{selectedReservation.guestName}</span>
                                </div>
                                <div className="guest-info-row">
                                    <span className="phone-icon">📞</span>
                                    <span className="phone-number">{selectedReservation.guestPhone}</span>
                                </div>
                            </div>
                            <div className="details-header-top">
                                <div className="header-tabs">
                                    <button
                                        className="tab-option active"
                                        onClick={() => setShowEditModal(true)}
                                    >
                                        Edit Reservation
                                    </button>

                                    <div className="relative inline-block ml-2 mr-2">
                                        <MoreOptionsMenu
                                            buttonLabel="More Options"
                                            buttonClassName="tab-option"
                                            reservationStatus={selectedReservation?.status}
                                            onAction={(action) => handleMoreOptionsAction(action, selectedReservation)}
                                        />
                                    </div>

                                    <div className="print-menu-wrap" ref={printMenuRef}>
                                        <button
                                            className={`print-menu-trigger ${showPrintMenu ? 'active' : ''}`}
                                            onClick={() => setShowPrintMenu(!showPrintMenu)}
                                        >
                                            <svg className="print-menu-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                            <span>Print</span>
                                            <span className={`print-menu-arrow ${showPrintMenu ? 'open' : ''}`}>▼</span>
                                        </button>
                                        {showPrintMenu && (
                                            <div className="print-menu-dropdown">
                                                {[
                                                    { action: 'print-summary', icon: '📄', label: 'Print Summary', color: '#2563eb' },
                                                    { action: 'print-invoice', icon: '🧾', label: 'Print Invoice', color: '#16a34a' },
                                                    { action: 'print-grc', icon: '📋', label: 'Print GRC', color: '#9333ea' },
                                                    { action: 'print-grc-all', icon: '🗂️', label: 'Print GRC All', color: '#b45309' },
                                                ].map((item, i) => (
                                                    <button
                                                        key={item.action}
                                                        className="print-menu-item"
                                                        onClick={() => {
                                                            setShowPrintMenu(false);
                                                            handleMoreOptionsAction(item.action, selectedReservation);
                                                        }}
                                                    >
                                                        <span
                                                            className="print-menu-item-icon"
                                                            style={{ background: `${item.color}15` }}
                                                        >
                                                            {item.icon}
                                                        </span>
                                                        <span className="print-menu-item-label">{item.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="details-content">
                            <table className="details-table">
                                <tbody>
                                    <tr>
                                        <td className="details-label">Reservation Number</td>
                                        <td className="details-value">{selectedReservation.id}</td>
                                    </tr>
                                    <tr>
                                        <td className="details-label">Status</td>
                                        <td className="details-value">
                                            <span className={`status-badge-small ${selectedReservation.status.toLowerCase()}`}>
                                                {selectedReservation.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="details-label">Arrival Date</td>
                                        <td className="details-value">{formatDate(selectedReservation.checkInDate)}</td>
                                    </tr>
                                    <tr>
                                        <td className="details-label">Departure Date</td>
                                        <td className="details-value">{formatDate(selectedReservation.checkOutDate)}</td>
                                    </tr>
                                    <tr>
                                        <td className="details-label">Booking Date</td>
                                        <td className="details-value">{formatDate(selectedReservation.createdAt)}</td>
                                    </tr>
                                    <tr>
                                        <td className="details-label">Arrival Time</td>
                                        <td className="details-value">{formatTime(selectedReservation.checkInTime || selectedReservation.scheduledCheckInTime || '') || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="details-label">Departure Time</td>
                                        <td className="details-value">{formatTime(selectedReservation.checkOutTime || selectedReservation.scheduledCheckOutTime || '') || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="details-label">Reservation Type</td>
                                        <td className="details-value">{selectedReservation.reservationType}</td>
                                    </tr>
                                    <tr>
                                        <td className="details-label">Level Type</td>
                                        <td className="details-value">{selectedReservation.rooms?.[0]?.categoryId?.replace(/-/g, ' ').toUpperCase() || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td className="details-label">Room / Occupancy</td>
                                        <td className="details-value">{selectedReservation.rooms?.[0]?.adultsCount || 0} Adult(s), {selectedReservation.rooms?.[0]?.childrenCount || 0} Child(ren)</td>
                                    </tr>
                                    <tr>
                                        <td className="details-label">Total Bills</td>
                                        <td className="details-value details-value-highlight">{cs}{selectedReservation.totalAmount?.toLocaleString('en-IN') || '0'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>



            {/* Edit Reservation Modal */}
            <EditReservationModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                reservation={selectedReservation}
                onRefresh={fetchReservationsFromAPI}
            />

            {/* Invoice Modal */}
            <AnimatePresence>
                {showInvoiceModal && currentInvoice && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 99999,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '1rem'
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            style={{
                                backgroundColor: '#fff',
                                borderRadius: '1rem',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                maxWidth: '1000px',
                                width: '100%',
                                maxHeight: '90vh',
                                overflow: 'hidden',
                                position: 'relative'
                            }}
                        >
                            <InvoiceView
                                invoice={currentInvoice}
                                isModal={true}
                                onClose={() => {
                                    console.log('🏁 Closing Invoice Modal');
                                    setShowInvoiceModal(false);
                                }}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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

            {/* Premium Payment Alert Modal */}
            {showPaymentAlert && (
                <ConfirmationModal
                    isOpen={showPaymentAlert}
                    onClose={() => setShowPaymentAlert(false)}
                    onConfirm={() => setShowPaymentAlert(false)}
                    title="Checkout Restricted"
                    message={paymentAlertMessage}
                    confirmText="Okay, Got it"
                    cancelText={null}
                    variant="danger"
                    icon="⚠️"
                />
            )}
        </div>
    );
};

// Dummy Data Functions
function getDummyReservations() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonth = new Date(today);
    nextMonth.setDate(nextMonth.getDate() + 30);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    return [
        {
            id: 'RES-001',
            reservationType: 'Confirm',
            bookingSource: 'Direct',
            businessSource: 'Walk-In',
            referenceNumber: 'WEB-2024-001',
            arrivalFrom: 'Delhi',
            purposeOfVisit: 'Leisure',
            guestId: 'G-001',
            guestName: 'Rajesh Kumar',
            guestEmail: 'rajesh@email.com',
            guestPhone: '9876543210',
            checkInDate: today.toISOString().split('T')[0],
            checkInTime: '14:00',
            checkOutDate: tomorrow.toISOString().split('T')[0],
            checkOutTime: '11:00',
            flexibleCheckout: false,
            rooms: [{ id: 1, categoryId: 'deluxe-ac-double', mealPlan: 'CP', adultsCount: 2, childrenCount: 1, ratePerNight: 3000, discount: 0 }],
            nights: 1,
            status: 'RESERVED',
            roomCharges: 3000,
            discount: 0,
            tax: 360,
            totalAmount: 3360,
            paidAmount: 1680,
            balanceDue: 1680,
            paymentMode: 'Card',
            taxExempt: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: 'RES-002',
            reservationType: 'Confirm',
            bookingSource: 'OTA',
            businessSource: 'Phone',
            referenceNumber: 'OTA-2024-045',
            arrivalFrom: 'Mumbai',
            purposeOfVisit: 'Business',
            guestId: 'G-002',
            guestName: 'Priya Singh',
            guestEmail: 'priya@email.com',
            guestPhone: '8765432109',
            checkInDate: today.toISOString().split('T')[0],
            checkInTime: '16:00',
            checkOutDate: nextWeek.toISOString().split('T')[0],
            checkOutTime: '11:00',
            flexibleCheckout: true,
            rooms: [{ id: 1, categoryId: 'club-ac-single', mealPlan: 'MAP', adultsCount: 1, childrenCount: 0, ratePerNight: 2800, discount: 100 }],
            nights: 7,
            status: 'IN_HOUSE',
            roomCharges: 19600,
            discount: 700,
            tax: 2268,
            totalAmount: 21168,
            paidAmount: 21168,
            balanceDue: 0,
            paymentMode: 'Online',
            taxExempt: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: 'RES-003',
            reservationType: 'Confirm',
            bookingSource: 'RefCode',
            businessSource: 'Email',
            referenceNumber: 'REF-2024-089',
            arrivalFrom: 'Bangalore',
            purposeOfVisit: 'Business',
            guestId: 'G-003',
            guestName: 'Amit Patel',
            guestEmail: 'amit@email.com',
            guestPhone: '7654321098',
            checkInDate: yesterday.toISOString().split('T')[0],
            checkInTime: '15:00',
            checkOutDate: today.toISOString().split('T')[0],
            checkOutTime: '11:00',
            flexibleCheckout: false,
            rooms: [{ id: 1, categoryId: 'suite', mealPlan: 'FB', adultsCount: 2, childrenCount: 0, ratePerNight: 5500, discount: 500 }],
            nights: 1,
            status: 'CHECKED_OUT',
            roomCharges: 5500,
            discount: 500,
            tax: 600,
            totalAmount: 5600,
            paidAmount: 5600,
            balanceDue: 0,
            paymentMode: 'Cash',
            taxExempt: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: 'RES-004',
            reservationType: 'Confirm',
            bookingSource: 'Direct',
            businessSource: 'Walk-In',
            referenceNumber: 'WEB-2024-156',
            arrivalFrom: 'Hyderabad',
            purposeOfVisit: 'Leisure',
            guestId: 'G-004',
            guestName: 'Neha Verma',
            guestEmail: 'neha@email.com',
            guestPhone: '6543210987',
            checkInDate: nextMonth.toISOString().split('T')[0],
            checkInTime: '14:00',
            checkOutDate: new Date(nextMonth.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            checkOutTime: '11:00',
            flexibleCheckout: true,
            rooms: [{ id: 1, categoryId: 'deluxe-ac-single', mealPlan: 'CP', adultsCount: 1, childrenCount: 0, ratePerNight: 2000, discount: 100 }],
            nights: 3,
            status: 'RESERVED',
            roomCharges: 6000,
            discount: 300,
            tax: 684,
            totalAmount: 6384,
            paidAmount: 3200,
            balanceDue: 3184,
            paymentMode: 'Card',
            taxExempt: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: 'RES-005',
            reservationType: 'Confirm',
            bookingSource: 'OTA',
            businessSource: 'Phone',
            referenceNumber: 'OTA-2024-201',
            arrivalFrom: 'Pune',
            purposeOfVisit: 'Business',
            guestId: 'G-005',
            guestName: 'Vikram Sharma',
            guestEmail: 'vikram.sharma@email.com',
            guestPhone: '5432109876',
            checkInDate: lastWeek.toISOString().split('T')[0],
            checkInTime: '14:00',
            checkOutDate: yesterday.toISOString().split('T')[0],
            checkOutTime: '11:00',
            flexibleCheckout: false,
            rooms: [{ id: 1, categoryId: 'club-ac-double', mealPlan: 'MAP', adultsCount: 2, childrenCount: 0, ratePerNight: 4000, discount: 200 }],
            nights: 6,
            status: 'CHECKED_OUT',
            roomCharges: 24000,
            discount: 1200,
            tax: 2736,
            totalAmount: 25536,
            paidAmount: 25536,
            balanceDue: 0,
            paymentMode: 'Online',
            taxExempt: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: 'RES-006',
            reservationType: 'Confirm',
            bookingSource: 'Direct',
            businessSource: 'Walk-In',
            referenceNumber: 'WEB-2024-267',
            arrivalFrom: 'Gurgaon',
            purposeOfVisit: 'Leisure',
            guestId: 'G-006',
            guestName: 'Anjali Kapoor',
            guestEmail: 'anjali.kapoor@email.com',
            guestPhone: '4321098765',
            checkInDate: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            checkInTime: '15:00',
            checkOutDate: new Date(today.getTime() + 17 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            checkOutTime: '11:00',
            flexibleCheckout: false,
            rooms: [{ id: 1, categoryId: 'deluxe-ac-double', mealPlan: 'CP', adultsCount: 2, childrenCount: 2, ratePerNight: 3000, discount: 300 }],
            nights: 3,
            status: 'RESERVED',
            roomCharges: 9000,
            discount: 900,
            tax: 972,
            totalAmount: 9072,
            paidAmount: 4536,
            balanceDue: 4536,
            paymentMode: 'Card',
            taxExempt: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ];
}

function getDummyGuests() {
    return [
        {
            guestId: 'G-001',
            fullName: 'Rajesh Kumar',
            email: 'rajesh@email.com',
            mobile: '9876543210',
            gender: 'Male',
            nationality: 'Indian',
            address: { line: '123 Main Street', city: 'Mumbai', state: 'Maharashtra', country: 'India', pinCode: '400001' },
            idProof: { type: 'Aadhaar', number: '1234-5678-9012' },
            bookingCount: 5,
            createdAt: new Date().toISOString()
        },
        {
            guestId: 'G-002',
            fullName: 'Priya Singh',
            email: 'priya@email.com',
            mobile: '8765432109',
            gender: 'Female',
            nationality: 'Indian',
            address: { line: '456 Park Avenue', city: 'Delhi', state: 'Delhi', country: 'India', pinCode: '110001' },
            idProof: { type: 'Passport', number: 'P5678901' },
            bookingCount: 3,
            createdAt: new Date().toISOString()
        },
        {
            guestId: 'G-003',
            fullName: 'Amit Patel',
            email: 'amit@email.com',
            mobile: '7654321098',
            gender: 'Male',
            nationality: 'Indian',
            address: { line: '789 Business Park', city: 'Bangalore', state: 'Karnataka', country: 'India', pinCode: '560001' },
            idProof: { type: 'Driving License', number: 'DL-9876543' },
            bookingCount: 8,
            createdAt: new Date().toISOString()
        },
        {
            guestId: 'G-004',
            fullName: 'Neha Verma',
            email: 'neha@email.com',
            mobile: '6543210987',
            gender: 'Female',
            nationality: 'Indian',
            address: { line: '321 Corporate Street', city: 'Hyderabad', state: 'Telangana', country: 'India', pinCode: '500001' },
            idProof: { type: 'Voter ID', number: 'V1234567890' },
            bookingCount: 4,
            createdAt: new Date().toISOString()
        },
        {
            guestId: 'G-005',
            fullName: 'Vikram Sharma',
            email: 'vikram.sharma@email.com',
            mobile: '5432109876',
            gender: 'Male',
            nationality: 'Indian',
            address: { line: '555 Tech Avenue', city: 'Pune', state: 'Maharashtra', country: 'India', pinCode: '411001' },
            idProof: { type: 'Aadhaar', number: '9876-5432-1098' },
            bookingCount: 6,
            createdAt: new Date().toISOString()
        },
        {
            guestId: 'G-006',
            fullName: 'Anjali Kapoor',
            email: 'anjali.kapoor@email.com',
            mobile: '4321098765',
            gender: 'Female',
            nationality: 'Indian',
            address: { line: '888 Luxury Heights', city: 'Gurgaon', state: 'Haryana', country: 'India', pinCode: '122001' },
            idProof: { type: 'Passport', number: 'P1234567' },
            bookingCount: 2,
            createdAt: new Date().toISOString()
        },
        {
            guestId: 'G-007',
            fullName: 'Sujit Ghosh',
            email: 'sujit.ghosh@email.com',
            mobile: '3210987654',
            gender: 'Male',
            nationality: 'Indian',
            address: { line: '999 Business District', city: 'Kolkata', state: 'West Bengal', country: 'India', pinCode: '700001' },
            idProof: { type: 'Driving License', number: 'DL-1234567' },
            bookingCount: 7,
            createdAt: new Date().toISOString()
        },
        {
            guestId: 'G-008',
            fullName: 'Deepika Desai',
            email: 'deepika.desai@email.com',
            mobile: '2109876543',
            gender: 'Female',
            nationality: 'Indian',
            address: { line: '111 Marina Bay', city: 'Chennai', state: 'Tamil Nadu', country: 'India', pinCode: '600001' },
            idProof: { type: 'Voter ID', number: 'V9876543210' },
            bookingCount: 3,
            createdAt: new Date().toISOString()
        },
        {
            guestId: 'G-009',
            fullName: 'Rohan Mehta',
            email: 'rohan.mehta@email.com',
            mobile: '1098765432',
            gender: 'Male',
            nationality: 'Indian',
            address: { line: '222 Golden Gate', city: 'Ahmedabad', state: 'Gujarat', country: 'India', pinCode: '380001' },
            idProof: { type: 'Aadhaar', number: '5432-1098-7654' },
            bookingCount: 5,
            createdAt: new Date().toISOString()
        },
        {
            guestId: 'G-010',
            fullName: 'Meera Iyer',
            email: 'meera.iyer@email.com',
            mobile: '9012345678',
            gender: 'Female',
            nationality: 'Indian',
            address: { line: '333 Coastal View', city: 'Kochi', state: 'Kerala', country: 'India', pinCode: '682001' },
            idProof: { type: 'Passport', number: 'P9876543' },
            bookingCount: 4,
            createdAt: new Date().toISOString()
        }
    ];
}

export default ReservationStayManagement;


