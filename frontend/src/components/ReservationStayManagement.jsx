import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import API_URL_CONFIG, { apiCall } from '../config/api';
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
    const bookingApiCall = useCallback((path, options = {}) => {
        return apiCall(`${API_URL}${path}`, options);
    }, [API_URL]);
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
    const [errors, setErrors] = useState({});
    const [isSavingReservation, setIsSavingReservation] = useState(false);
    const [fromRoomsPage, setFromRoomsPage] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [cardViewMode, setCardViewMode] = useState('grid'); // 'grid' or 'list'

    const getLocalDateKey = (value = new Date()) => {
        const d = new Date(value);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const getDateCandidates = (value) => {
        if (!value) return [];

        const keys = new Set();
        if (typeof value === 'string') {
            const isoDate = value.match(/^(\d{4}-\d{2}-\d{2})/);
            if (isoDate?.[1]) keys.add(isoDate[1]);
        }

        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) {
            keys.add(getLocalDateKey(d));
            keys.add(d.toISOString().split('T')[0]);
        }

        return Array.from(keys);
    };

    const getBookingDayKey = (value) => {
        const candidates = getDateCandidates(value);
        return candidates.length > 0 ? candidates[0] : null;
    };

    const normalizeBookingStatus = (status) => String(status || '').trim().toUpperCase().replace('-', '_');
    const isCheckedInStatus = (status) => ['CHECKED_IN', 'CHECKEDIN', 'IN_HOUSE'].includes(normalizeBookingStatus(status));
    const isCheckedOutStatus = (status) => ['CHECKED_OUT', 'CHECKEDOUT'].includes(normalizeBookingStatus(status));
    const isUpcomingStatus = (status) => ['UPCOMING', 'CONFIRMED', 'PENDING', 'RESERVED'].includes(normalizeBookingStatus(status));

    const matchesTabFilter = useCallback((reservation, tab, todayStr, oneMonthAgoStr) => {
        const status = normalizeBookingStatus(reservation?.status);
        const checkInDay = getBookingDayKey(reservation?.checkInDate);
        const checkOutDay = getBookingDayKey(reservation?.checkOutDate);

        if (tab === 'all') return true;
        if (tab === 'reserved') return isUpcomingStatus(status);
        if (tab === 'in-house') return isCheckedInStatus(status);
        if (tab === 'checked-out') return isCheckedOutStatus(status) && Boolean(checkOutDay) && checkOutDay >= oneMonthAgoStr;
        if (tab === 'arrival') return isUpcomingStatus(status) && checkInDay === todayStr;
        if (tab === 'departure') return isCheckedInStatus(status) && Boolean(checkOutDay) && checkOutDay <= todayStr;
        return true;
    }, []);

    // Filter reservations
    const filteredReservations = useMemo(() => {
        const todayStr = getCurrentDateISO();
        const oneMonthAgoStr = getDateISOWithOffset(-30);

        return reservations.filter((r) => matchesTabFilter(r, activeTab, todayStr, oneMonthAgoStr));
    }, [reservations, activeTab, getCurrentDateISO, getDateISOWithOffset, matchesTabFilter]);

    // Calculate real-time counts for tabs
    const counts = useMemo(() => {
        const todayStr = getCurrentDateISO();
        const oneMonthAgoStr = getDateISOWithOffset(-30);
        const countSource = searchQuery.trim().length > 0 ? searchResults : reservations;

        return {
            all: countSource.length,
            reserved: countSource.filter((r) => matchesTabFilter(r, 'reserved', todayStr, oneMonthAgoStr)).length,
            'in-house': countSource.filter((r) => matchesTabFilter(r, 'in-house', todayStr, oneMonthAgoStr)).length,
            'checked-out': countSource.filter((r) => matchesTabFilter(r, 'checked-out', todayStr, oneMonthAgoStr)).length,
            arrival: countSource.filter((r) => matchesTabFilter(r, 'arrival', todayStr, oneMonthAgoStr)).length,
            departure: countSource.filter((r) => matchesTabFilter(r, 'departure', todayStr, oneMonthAgoStr)).length
        };
    }, [reservations, searchQuery, searchResults, getCurrentDateISO, getDateISOWithOffset, matchesTabFilter]);

    const normalizeCategoryKey = (value) => {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    };

    // Helper function to convert room type name to category ID
    const getCategoryIdFromRoomType = (roomType) => {
        if (!roomType) return '';

        const normalizedInput = normalizeCategoryKey(roomType);
        const matchedType = facilityTypes.find((type) => normalizeCategoryKey(type.name) === normalizedInput);
        if (matchedType) return matchedType.name;

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

        return roomType;
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
                    apiCall(`/api/rooms/${data.roomId}`)
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

    useEffect(() => {
        const interval = setInterval(() => {
            fetchReservationsFromAPI();
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    const fetchReservationsFromAPI = async () => {
        try {
            setLoading(true);

            // Fetch from both endpoints
            const [bookingsResponse, reservationsResponse] = await Promise.all([
                bookingApiCall(`/list`).catch(() => ({ ok: false })),
                apiCall(`/api/reservations/list`).catch(() => ({ ok: false }))
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
                                checkInTime: reservation.checkInTime || getCurrentTime24(),
                                checkOutDate: reservation.checkOutDate ? (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date(reservation.checkOutDate)) : '',
                                checkOutTime: reservation.checkOutTime || getCurrentTime24(),
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

        const num = (value, fallback = 0) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };

        const nights = Math.max(1, num(booking.numberOfNights ?? duration.nights, 1));
        const roomCount = Math.max(1, Array.isArray(booking.rooms) && booking.rooms.length > 0
            ? booking.rooms.length
            : num(booking.numberOfRooms, 1));

        const pricePerNight = num(
            booking.pricePerNight ?? booking.roomRate ?? booking.ratePerNight ?? billing.roomRate ?? billing.pricePerNight,
            0
        );

        const roomChargesFromRows = Array.isArray(booking.rooms) && booking.rooms.length > 0
            ? booking.rooms.reduce((sum, r) => {
                const rate = num(r.ratePerNight ?? r.roomRate ?? r.pricePerNight ?? r.price, 0);
                return sum + (rate * nights);
            }, 0)
            : (pricePerNight * nights * roomCount);

        const discountFromRows = Array.isArray(booking.rooms) && booking.rooms.length > 0
            ? booking.rooms.reduce((sum, r) => sum + num(r.discount ?? r.discountAmount, 0), 0)
            : 0;

        const roomCharges = num(
            booking.roomCharges ?? booking.baseRoomCharges ?? billing.roomCharges ?? billing.roomChargesAmount,
            roomChargesFromRows
        );

        const explicitDiscountAmount = num(
            booking.discount ?? booking.discountAmount ?? billing.discount ?? billing.discountAmount,
            discountFromRows
        );

        const serviceChargeAmount = num(
            booking.serviceChargeAmount ?? booking.serviceCharge ?? billing.serviceCharge ?? billing.serviceChargeAmount,
            0
        );

        const taxAmount = num(
            booking.taxAmount ?? booking.tax ?? billing.tax ?? billing.taxAmount,
            0
        );

        const computedTotal = Math.max(0, roomCharges + serviceChargeAmount + taxAmount - explicitDiscountAmount);
        const totalAmount = num(billing.totalAmount ?? booking.totalAmount, computedTotal);
        const derivedDiscountFromTotal = Math.max(0, (roomCharges + serviceChargeAmount + taxAmount) - totalAmount);
        const discountAmount = explicitDiscountAmount > 0 ? explicitDiscountAmount : derivedDiscountFromTotal;
        const paidAmount = num(booking.advancePaid ?? booking.paidAmount ?? billing.paidAmount, 0);
        const balanceDue = num(booking.remainingAmount ?? booking.balanceDue ?? billing.balanceAmount, Math.max(0, totalAmount - paidAmount));

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
            checkInTime: booking.actualCheckIn
                ? new Date(booking.actualCheckIn).toTimeString().slice(0, 5)
                : (booking.scheduledCheckInTime || booking.checkInTime || '14:00'),
            checkOutDate: booking.checkOutDate ? (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date(booking.checkOutDate)) : '',
            checkOutTime: booking.actualCheckOut
                ? new Date(booking.actualCheckOut).toTimeString().slice(0, 5)
                : (booking.scheduledCheckOutTime || booking.checkOutTime || '11:00'),
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
                    categoryId: getCategoryIdFromRoomType(r.roomType) || '',
                    roomNumber: r.roomNumber || '',
                    mealPlan: r.mealPlan || 'CP',
                    adultsCount: num(r.adults ?? r.adultsCount, 1),
                    childrenCount: num(r.children ?? r.childrenCount, 0),
                    ratePerNight: num(r.ratePerNight ?? r.roomRate ?? r.pricePerNight ?? r.price, 0),
                    discount: num(r.discount ?? r.discountAmount, 0)
                }))
                : [{
                    id: 1,
                    categoryId: getCategoryIdFromRoomType(booking.roomType) || '',
                    roomNumber: booking.roomNumber || '',
                    mealPlan: 'CP',
                    adultsCount: num(booking.numberOfAdults ?? duration.adults, 1),
                    childrenCount: num(booking.numberOfChildren ?? duration.children, 0),
                    ratePerNight: pricePerNight,
                    discount: 0
                }],
            nights: nights,
            status: booking.status === 'Upcoming' ? 'RESERVED' :
                booking.status === 'Checked-in' || booking.status === 'IN_HOUSE' || booking.status === 'CheckedIn' ? 'IN_HOUSE' :
                    booking.status === 'Checked-out' || booking.status === 'CHECKED_OUT' || booking.status === 'CheckedOut' ? 'CHECKED_OUT' : 'RESERVED',
            roomCharges: roomCharges,
            discount: discountAmount,
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
            results = searchResults.filter((r) => matchesTabFilter(r, activeTab, todayStr, oneMonthAgoStr));
        }

        // Return sorted (newest first)
        return [...results].sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));
    }, [searchQuery, searchResults, filteredReservations, activeTab, getCurrentDateISO, getDateISOWithOffset, matchesTabFilter]);



    // Room Facility Types
    const [facilityTypes, setFacilityTypes] = useState([]);

    // Fetch facility types
    const fetchFacilityTypes = async () => {
        try {
            const response = await apiCall(`/api/facility-types/list`);
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
            const response = await apiCall(`/api/meal-types/list`);
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
            const response = await apiCall(`/api/booking-sources/list`);
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
            const response = await apiCall(`/api/reservation-types/list`);
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
            const response = await apiCall(`/api/business-sources/list`);
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
    const [checkInTime, setCheckInTime] = useState(prefilledData?.checkInTime || getCurrentTime24());
    const [checkOutDate, setCheckOutDate] = useState(prefilledData?.checkOutDate || '');
    const [checkOutTime, setCheckOutTime] = useState(prefilledData?.checkOutTime || getCurrentTime24());
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

    const getAuthHeaders = () => {
        const headers = {};
        try {
            const savedUser = localStorage.getItem('authUser');
            if (!savedUser) return headers;

            const parsed = JSON.parse(savedUser);
            if (parsed?.token) headers.Authorization = `Bearer ${parsed.token}`;
            if (parsed?.hotelId) headers['x-hotel-id'] = parsed.hotelId;
            if (parsed?.dbName) headers['x-tenant-db'] = parsed.dbName;
        } catch (error) {
            console.warn('Failed to parse authUser for guest list headers:', error);
        }
        return headers;
    };

    // Fetch guests from API
    const fetchGuestsFromAPI = async () => {
        try {
            const response = await apiCall(`/api/guests/list`, {
                headers: getAuthHeaders()
            });
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
    const [splitAmounts, setSplitAmounts] = useState({ Cash: '', UPI: '', Card: '', 'Bank Transfer': '' });
    const [splitReferences, setSplitReferences] = useState({ UPI: '', Card: '', 'Bank Transfer': '' });
    const [upiUtr, setUpiUtr] = useState('');
    const [bankTransactionId, setBankTransactionId] = useState('');
    const [cardTransactionId, setCardTransactionId] = useState('');
    const [taxExempt, setTaxExempt] = useState(false);
    const [manualDiscountType, setManualDiscountType] = useState('FLAT');
    const [manualDiscountValue, setManualDiscountValue] = useState('');

    const normalizeUtrInput = (value) => String(value || '').replace(/\D/g, '').slice(0, 12);
    const normalizeTxnInput = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    const isValidUtr = (value) => /^\d{12}$/.test(String(value || ''));
    const isValidTxnId = (value) => /^(?:[A-Z0-9]{10}|[A-Z0-9]{12}|[A-Z0-9]{15})$/.test(String(value || ''));

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

    // Read draft on mount
    useEffect(() => {
        if (view === 'form' && !isEditingMode && !prefilledData) {
            const draftRaw = sessionStorage.getItem('draft_reservation_form');
            if (draftRaw) {
                try {
                    const draft = JSON.parse(draftRaw);
                    if (draft.reservationType) setReservationType(draft.reservationType);
                    if (draft.bookingSource) setBookingSource(draft.bookingSource);
                    if (draft.businessSource) setBusinessSource(draft.businessSource);
                    if (draft.referenceNumber) setReferenceNumber(draft.referenceNumber);
                    if (draft.arrivalFrom) setArrivalFrom(draft.arrivalFrom);
                    if (draft.purposeOfVisit) setPurposeOfVisit(draft.purposeOfVisit);
                    if (draft.checkInDate) setCheckInDate(draft.checkInDate);
                    if (draft.checkInTime) setCheckInTime(draft.checkInTime);
                    if (draft.checkOutDate) setCheckOutDate(draft.checkOutDate);
                    if (draft.checkOutTime) setCheckOutTime(draft.checkOutTime);
                    if (draft.flexibleCheckout !== undefined) setFlexibleCheckout(draft.flexibleCheckout);
                    if (draft.rooms?.length) setRooms(draft.rooms);
                    if (draft.guestsData?.length) setSelectedGuests(draft.guestsData);
                    if (draft.paidAmount !== undefined) setPaidAmount(draft.paidAmount);
                    if (draft.paymentMode) setPaymentMode(draft.paymentMode);
                    if (draft.taxExempt !== undefined) setTaxExempt(draft.taxExempt);
                    if (draft.manualDiscountType) setManualDiscountType(draft.manualDiscountType);
                    if (draft.manualDiscountValue !== undefined) setManualDiscountValue(draft.manualDiscountValue);
                } catch (e) {
                    console.error('Error parsing draft reservation form', e);
                }
            }
        }
    }, [view, isEditingMode, prefilledData]);

    // Sync form state to draft
    useEffect(() => {
        if (view === 'form' && !isEditingMode && !prefilledData && !isSavingReservation) {
            const draft = {
                reservationType, bookingSource, businessSource, referenceNumber, arrivalFrom, purposeOfVisit,
                checkInDate, checkInTime, checkOutDate, checkOutTime, flexibleCheckout,
                rooms, guestsData: selectedGuests, paidAmount, paymentMode, taxExempt, manualDiscountType, manualDiscountValue
            };
            sessionStorage.setItem('draft_reservation_form', JSON.stringify(draft));
        }
    }, [view, isEditingMode, prefilledData, isSavingReservation, reservationType, bookingSource, businessSource, referenceNumber, arrivalFrom, purposeOfVisit, checkInDate, checkInTime, checkOutDate, checkOutTime, flexibleCheckout, rooms, selectedGuests, paidAmount, paymentMode, taxExempt, manualDiscountType, manualDiscountValue]);

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
                    const matchedType = facilityTypes.find((t) => normalizeCategoryKey(t.name) === normalizeCategoryKey(room.categoryId));
                    const isValid = Boolean(matchedType);

                    if (room.categoryId !== '' && !isValid) {
                        // If invalid (e.g. was using hardcoded ID), switch to empty
                        return {
                            ...room,
                            categoryId: ''
                        };
                    }

                    if (room.categoryId !== '' && matchedType && room.categoryId !== matchedType.name) {
                        // Normalize legacy slug values to the exact facility type name so select can display properly.
                        return {
                            ...room,
                            categoryId: matchedType.name
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

        const taxEnabled = Boolean(settings.inclusiveTax);
        const taxResult = calculateRoomTaxBySlab({
            rooms,
            nights,
            taxExempt,
            inclusiveTax: taxEnabled,
            roomGstSlabs: settings.roomGstSlabs,
            fallbackRoomGst: settings.roomGst
        });
        const roomCharges = taxResult.roomCharges;
        const totalDiscount = taxResult.totalDiscount;
        const subtotal = taxResult.subtotal;
        const taxAmount = taxResult.taxAmount;
        const serviceChargePct = parseFloat(settings.roomServiceCharge) || 0;
        const serviceChargeAmount = subtotal > 0 ? Math.round((subtotal * serviceChargePct) / 100) : 0;
        const preDiscountGrossTotal = subtotal + taxAmount + serviceChargeAmount;

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
        const taxLabel = (!taxEnabled)
            ? 'Tax (disabled)'
            : taxExempt
            ? 'Tax (exempt)'
            : `Tax (${taxResult.effectiveRate.toFixed(2)}% slab avg.)`;

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

    const parsedAdvancePaid = Number(paidAmount);
    const hasPositiveAdvancePayment = Number.isFinite(parsedAdvancePaid) && parsedAdvancePaid > 0;
    const isCreateReservationBlocked = !isEditingMode && !hasPositiveAdvancePayment;
    const isCheckInBlocked = !hasPositiveAdvancePayment;

    // Handle View Invoice
    const handleViewInvoice = useCallback((invoiceId) => {
        const invoice = invoices.find(inv => inv.invoiceId === invoiceId);
        if (invoice) {
            setCurrentInvoice(invoice);
            setShowInvoiceModal(true);
        }
    }, [invoices]);

    // Handle More Options action selection
    const handleMoreOptionsAction = useCallback(async (actionType, bookingSpec) => {
        const targetReservation = bookingSpec || selectedReservation;
        if (!targetReservation) return;
        const bookingId = targetReservation.id || targetReservation._id;

        let sourceReservation = targetReservation;
        try {
            if (bookingId) {
                const latestResp = await bookingApiCall(`/${bookingId}`);
                const latestJson = await latestResp.json();
                if (latestResp.ok && latestJson?.success && latestJson?.data) {
                    sourceReservation = { ...targetReservation, ...latestJson.data };
                }
            }
        } catch (fetchErr) {
            console.warn('Unable to refresh latest booking before opening action drawer:', fetchErr);
        }

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

        // Calculate correct billing totals for action drawers/print flows.
        const transactions = sourceReservation.transactions || [];
        const isMultiRoom = sourceReservation.rooms && sourceReservation.rooms.length > 1;
        const toNum = (value, fallback = 0) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        
        // 1. Calculate Core Room Charges
        let roomCharges = 0;
        if (isMultiRoom) {
                roomCharges = sourceReservation.rooms.reduce((sum, room) => {
                const rate = toNum(room.ratePerNight ?? room.roomRate ?? room.pricePerNight ?? room.price, 0);
                    const discount = toNum(room.discount ?? room.discountAmount, 0);
                    return sum + (rate * (sourceReservation.nights || 1)) - discount;
            }, 0);
        } else {
            roomCharges = toNum(sourceReservation.roomCharges, 0) ||
                ((toNum(sourceReservation.rooms?.[0]?.ratePerNight ?? sourceReservation.rooms?.[0]?.roomRate ?? sourceReservation.pricePerNight, 0) * (sourceReservation.nights || 1))
                    - toNum(sourceReservation.rooms?.[0]?.discount ?? sourceReservation.discount, 0));
        }

        const discountAmount = toNum(sourceReservation.discount ?? sourceReservation.discountAmount ?? sourceReservation.totalDiscount, 0);
        const taxAmount = toNum(sourceReservation.tax ?? sourceReservation.taxAmount, 0);
        const serviceChargeAmount = toNum(
            sourceReservation.serviceCharge ?? sourceReservation.serviceChargeAmount,
            Math.max(0, roomCharges - discountAmount) * ((parseFloat(settings.roomServiceCharge) || 0) / 100)
        );

        // 2. Folio Charges
        const totalFolioCharges = transactions
            .filter(t => t.type?.toLowerCase() === 'charge' && 
                        !['Room Tariff', 'Room Rent', 'Room Charges'].includes(t.particulars))
            .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

        // 3. Paid Amount
        const totalPaid = transactions
            .filter(t => t.type?.toLowerCase() === 'payment')
            .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

        const latestPaymentTx = [...transactions]
            .filter((t) => t.type?.toLowerCase() === 'payment')
            .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())[0];

        const paymentModeUsed = sourceReservation.paymentMode || latestPaymentTx?.method || 'Cash';

        const calculatedTotal = Math.max(0, roomCharges + serviceChargeAmount + taxAmount - discountAmount + totalFolioCharges);
        const calculatedBalance = Math.max(0, calculatedTotal - totalPaid);

        const storedTotal = toNum(sourceReservation.totalAmount, 0);
        const storedPaid = toNum(sourceReservation.paidAmount, 0);
        const storedBalance = toNum(sourceReservation.balanceDue, 0);
        const derivedStoredBalance = Math.max(0, storedTotal - storedPaid);

        const folioBalances = {};
        const baseFolioEntries = [
            { folioId: 0 },
            ...((Array.isArray(sourceReservation.additionalGuests) ? sourceReservation.additionalGuests : []).map((_, index) => ({ folioId: index + 1 })))
        ];

        baseFolioEntries.forEach(({ folioId }) => {
            const folioTxns = transactions.filter((t) => Number(t?.folioId || 0) === Number(folioId));
            const summary = folioTxns.reduce((acc, transaction) => {
                const typeLc = String(transaction?.type || '').toLowerCase();
                const amountAbs = Math.abs(Number(transaction?.amount) || 0);
                if (typeLc === 'payment') {
                    acc.payments += amountAbs;
                } else if (typeLc === 'discount') {
                    acc.discounts += amountAbs;
                } else {
                    acc.charges += amountAbs;
                }
                return acc;
            }, { charges: 0, discounts: 0, payments: 0 });

            const folioGrandTotal = Math.max(0, summary.charges - summary.discounts);
            folioBalances[folioId] = Math.max(0, folioGrandTotal - summary.payments);
        });

        // Prefer canonical folio module balances when available (PRIMARY -> folioId 0, SECONDARY -> folioId 1..n).
        try {
            if (bookingId) {
                const folioResp = await apiCall(`/api/folio/reservation/${bookingId}`);
                const folioJson = await folioResp.json();
                if (folioResp.ok && folioJson?.success) {
                    const folioList = Array.isArray(folioJson?.allFolios)
                        ? folioJson.allFolios
                        : (Array.isArray(folioJson?.data) ? folioJson.data : [folioJson?.data].filter(Boolean));

                    const typeOf = (folio) => String(folio?.type || '').trim().toUpperCase();
                    const primaryFolio = folioList.find((f) => ['PRIMARY', 'MAIN', 'PRIMARY_FOLIO'].includes(typeOf(f)))
                        || folioList.find((f) => !['SECONDARY', 'COMPANY'].includes(typeOf(f)))
                        || folioList[0];
                    if (primaryFolio) {
                        folioBalances[0] = Math.max(0, toNum(primaryFolio?.balance, folioBalances[0] ?? 0));
                    }

                    const secondaryFolios = folioList.filter((f) => f !== primaryFolio);
                    secondaryFolios.forEach((folio, idx) => {
                        const folioId = idx + 1;
                        folioBalances[folioId] = Math.max(0, toNum(folio?.balance, folioBalances[folioId] ?? 0));
                    });
                }
            }
        } catch (folioErr) {
            console.warn('Unable to refresh folio balances from folio module:', folioErr);
        }

        // Prefer the most reliable outstanding numbers across card-computed and stored payload values.
        const resolvedTotal = Math.max(storedTotal, calculatedTotal);
        const resolvedPaid = Math.max(storedPaid, totalPaid);
        const resolvedBalance = Math.max(storedBalance, derivedStoredBalance, calculatedBalance, Math.max(0, resolvedTotal - resolvedPaid));
        const shouldLockAddPaymentToFolio = actionType === 'add-payment';

        // Keep primary folio (Shekhar/current guest) aligned with booking's authoritative remaining amount.
        const authoritativePrimaryBalance = Math.max(0, toNum(
            sourceReservation?.folioRemainingAmount
            ?? sourceReservation?.billing?.remainingAmount
            ?? sourceReservation?.billing?.balanceDue
            ?? sourceReservation?.remainingAmount
            ?? sourceReservation?.balanceDue,
            resolvedBalance
        ));
        if (shouldLockAddPaymentToFolio) {
            // Add Payment must match folio ledger balance shown in Folio Operations.
            folioBalances[0] = Math.max(0, toNum(folioBalances[0], 0));
        } else {
            folioBalances[0] = Math.max(toNum(folioBalances[0], 0), authoritativePrimaryBalance);
        }

        const primaryFolioRemaining = Math.max(0, toNum(folioBalances[0], resolvedBalance));
        const actionRemaining = shouldLockAddPaymentToFolio ? primaryFolioRemaining : resolvedBalance;

        // Convert reservation to booking format for the actions
        const bookingData = {
            _id: sourceReservation.id,
            bookingId: sourceReservation.referenceNumber,
            guestName: sourceReservation.guestName,
            mobileNumber: sourceReservation.guestPhone,
            email: sourceReservation.guestEmail,
            roomNumber: sourceReservation.rooms?.[0]?.roomNumber || '',
            roomType: sourceReservation.rooms?.[0]?.categoryId?.replace(/-/g, ' ').toUpperCase() || '',
            checkInDate: sourceReservation.checkInDate,
            checkInTime: sourceReservation.checkInTime || getCurrentTime24(),
            checkOutDate: sourceReservation.checkOutDate,
            checkOutTime: sourceReservation.checkOutTime || getCurrentTime24(),
            numberOfNights: sourceReservation.nights,
            numberOfAdults: sourceReservation.rooms?.[0]?.adultsCount || 1,
            numberOfChildren: sourceReservation.rooms?.[0]?.childrenCount || 0,
            numberOfGuests: sourceReservation.rooms?.[0]?.adultsCount || 1, // Fallback
            childrenCount: sourceReservation.rooms?.[0]?.childrenCount || 0, // Explicit for form
            pricePerNight: toNum(sourceReservation.rooms?.[0]?.ratePerNight ?? sourceReservation.rooms?.[0]?.roomRate ?? sourceReservation.pricePerNight, 0),
            roomCharges: toNum(sourceReservation.roomCharges, roomCharges),
            serviceCharge: toNum(sourceReservation.serviceCharge ?? sourceReservation.serviceChargeAmount, serviceChargeAmount),
            discount: discountAmount,
            tax: taxAmount,
            totalAmount: resolvedTotal,
            paidAmount: resolvedPaid,
            advancePaid: resolvedPaid,
            folioRemainingAmount: actionRemaining,
            balanceDue: actionRemaining,
            remainingAmount: actionRemaining,
            folioBalances,
            billing: {
                totalAmount: resolvedTotal,
                paidAmount: resolvedPaid,
                balanceAmount: actionRemaining,
                balanceDue: actionRemaining,
                remainingAmount: actionRemaining,
                roomCharges: toNum(sourceReservation.roomCharges, roomCharges),
                serviceCharge: toNum(sourceReservation.serviceCharge ?? sourceReservation.serviceChargeAmount, serviceChargeAmount),
                discount: discountAmount,
                tax: taxAmount
            },
            paymentMode: paymentModeUsed,
            status: sourceReservation.status === 'RESERVED' ? 'Upcoming' :
                sourceReservation.status === 'IN_HOUSE' ? 'Checked-in' :
                    sourceReservation.status === 'CHECKED_OUT' ? 'Checked-out' : 'Upcoming',
            idProofType: sourceReservation.idProofType,
            idNumber: sourceReservation.idNumber || sourceReservation.idProofNumber,
            idProofNumber: sourceReservation.idNumber || sourceReservation.idProofNumber,
            vehicleNumber: sourceReservation.vehicleNumber,
            additionalGuests: sourceReservation.additionalGuests || [],
            visitors: sourceReservation.visitors || [],
            transactions: transactions
        };

        // Open BookingActionsManager drawer for all actions (including print)
        setCurrentAction(actionType);
        setActionBooking(bookingData);
        setActionDrawerOpen(true);
    }, [selectedReservation, settings.roomServiceCharge, API_URL]);

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
                    serviceChargeAmount: reservation.serviceCharge || reservation.serviceChargeAmount || 0,
                    totalDiscount: reservation.discount || 0,
                    subtotal: (reservation.roomCharges || 0) + (reservation.serviceCharge || reservation.serviceChargeAmount || 0) - (reservation.discount || 0),
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
                serviceChargeAmount: reservation.serviceCharge || reservation.serviceChargeAmount || 0,
                totalDiscount: reservation.discount,
                subtotal: (reservation.roomCharges || 0) + (reservation.serviceCharge || reservation.serviceChargeAmount || 0) - (reservation.discount || 0),
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
                const response = await bookingApiCall(`/status/${reservation.id}`, {
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
                try {
                    const checkInPayload = {
                        arrivalDate: reservation.checkInDate || getCurrentDateISO(),
                        checkInTime: reservation.checkInTime || reservation.scheduledCheckInTime || getCurrentTime24(),
                        idProofType: reservation.idProofType,
                        idNumber: reservation.idNumber || reservation.idProofNumber,
                        adults: reservation.rooms?.[0]?.adultsCount || reservation.duration?.adults || 1,
                        children: reservation.rooms?.[0]?.childrenCount || reservation.duration?.children || 0,
                        vehicleNumber: reservation.vehicleNumber || '',
                        remarks: reservation.notes || reservation.specialRequests || ''
                    };

                    // Try reservation check-in endpoint first, then booking check-in, then status update fallback.
                    let response = await apiCall(`/api/reservations/checkin/${reservationId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(checkInPayload)
                    });

                    if (!response.ok) {
                        response = await bookingApiCall(`/check-in/${reservationId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(checkInPayload)
                        });
                    }

                    if (!response.ok) {
                        response = await bookingApiCall(`/status/${reservationId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'Checked-in' })
                        });
                    }

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok || !data.success) {
                        throw new Error(data.message || 'Check-in failed');
                    }

                    await fetchReservationsFromAPI();
                    setActiveTab('in-house');
                    return;
                } catch (error) {
                    console.error('Error checking in:', error);
                    alert(error.message || 'Failed to check-in guest');
                    return;
                }
            }
        }

        try {
            // Map UI status to MongoDB booking status
            const bookingStatus = newStatus === 'RESERVED' ? 'Upcoming' :
                newStatus === 'IN_HOUSE' ? 'Checked-in' :
                    newStatus === 'CHECKED_OUT' ? 'Checked-out' :
                        'Upcoming';

            const response = await bookingApiCall(`/status/${reservationId}`, {
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
    }, [displayReservations, getCurrentDateISO, getCurrentTime24, fetchReservationsFromAPI]);

    // Reset Form
    const resetForm = useCallback(() => {
        sessionStorage.removeItem('draft_reservation_form'); // Clear draft
        setIsEditingMode(false);
        setEditingReservationId(null);
        setReservationType('');
        setBookingSource('');
        setBusinessSource('');
        setReferenceNumber('');
        setArrivalFrom('');
        setPurposeOfVisit('');
        setCheckInDate('');
        setCheckInTime(getCurrentTime24());
        setCheckOutDate('');
        setCheckOutTime(getCurrentTime24());
        setFlexibleCheckout(false);
        setRooms([{ id: 1, categoryId: '', roomNumber: '', mealPlan: '', adultsCount: '', childrenCount: '', baseRate: 0, ratePerNight: 0, discount: 0 }]);
        setSelectedGuests([]);
        setPaidAmount(0);
        setPaymentMode('Cash');
        setTransactionId('');
        setSplitAmounts({ Cash: '', UPI: '', Card: '', 'Bank Transfer': '' });
        setSplitReferences({ UPI: '', Card: '', 'Bank Transfer': '' });
        setUpiUtr('');
        setBankTransactionId('');
        setCardTransactionId('');
        setTaxExempt(false);
        setManualDiscountType('FLAT');
        setManualDiscountValue('');
        setShowGuestModal(false);
        setShowInvoiceModal(false);
        setCurrentInvoice(null);
        setFromRoomsPage(false);
        setPrefilledData(null);
        setErrors({});
        setIsSavingReservation(false);
    }, [getCurrentTime24]);

    // Handle Save Reservation
    const handleSaveReservation = async (e, status = 'RESERVED') => {
        if (e && e.preventDefault) e.preventDefault();

        if (isSavingReservation) return;
        setErrors({});

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

        const needsAdvanceForAction = status === 'IN_HOUSE' || (!isEditingMode && status === 'RESERVED');
        if (needsAdvanceForAction && !hasPositiveAdvancePayment) {
            alert('Please enter a positive Advance / Paid Amount before Check-in or Create Reservation.');
            return;
        }

        if (paymentMode === 'UPI' && !isValidUtr(upiUtr)) {
            alert('UPI payment ke liye valid 12-digit UTR number required hai.');
            return;
        }

        if (paymentMode === 'Bank Transfer' && !isValidTxnId(bankTransactionId)) {
            alert('Bank Transfer ke liye valid Transaction ID required hai (A-Z/0-9, length 10/12/15).');
            return;
        }

        if (paymentMode === 'Card' && !isValidTxnId(cardTransactionId)) {
            alert('Card payment ke liye valid Transaction ID required hai (A-Z/0-9, length 10/12/15).');
            return;
        }

        const activeSplitRows = paymentMode === 'Multiple Payment'
            ? ['Cash', 'UPI', 'Card', 'Bank Transfer']
                .map(mode => ({
                    mode,
                    amount: parseFloat(splitAmounts[mode]) || 0,
                    referenceId: mode === 'UPI'
                        ? normalizeUtrInput(splitReferences.UPI)
                        : mode === 'Bank Transfer'
                            ? normalizeTxnInput(splitReferences['Bank Transfer'])
                            : mode === 'Card'
                                ? normalizeTxnInput(splitReferences.Card)
                                : ''
                }))
                .filter(row => row.amount > 0)
            : [];

        if (paymentMode === 'Multiple Payment') {
            if (activeSplitRows.length < 2) {
                alert('Multiple payment me kam se kam 2 payment modes enter karein.');
                return;
            }

            const splitTotal = activeSplitRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
            const targetTotal = Number(billingData.totalAmount) || 0;
            if (Math.abs(splitTotal - targetTotal) > 0.01) {
                alert(`Split total (${splitTotal.toFixed(2)}) aur Grand Total (${targetTotal.toFixed(2)}) same hona chahiye.`);
                return;
            }

            if (activeSplitRows.some(row => row.mode === 'UPI') && !isValidUtr(splitReferences.UPI)) {
                alert('Split UPI payment ke liye valid 12-digit UTR number required hai.');
                return;
            }

            if (activeSplitRows.some(row => row.mode === 'Bank Transfer') && !isValidTxnId(splitReferences['Bank Transfer'])) {
                alert('Split Bank Transfer ke liye valid Transaction ID required hai (A-Z/0-9, length 10/12/15).');
                return;
            }

            if (activeSplitRows.some(row => row.mode === 'Card') && !isValidTxnId(splitReferences.Card)) {
                alert('Split Card payment ke liye valid Transaction ID required hai (A-Z/0-9, length 10/12/15).');
                return;
            }
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

        const resolvedTransactionId = paymentMode === 'UPI'
            ? normalizeUtrInput(upiUtr)
            : paymentMode === 'Bank Transfer'
                ? normalizeTxnInput(bankTransactionId)
                : paymentMode === 'Card'
                    ? normalizeTxnInput(cardTransactionId)
                    : paymentMode === 'Multiple Payment'
                        ? activeSplitRows.map(row => `${row.mode}:${row.amount}${row.referenceId ? `@${row.referenceId}` : ''}`).join('; ')
                        : (transactionId || '');

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
            paymentMode: paymentMode === 'Multiple Payment' ? 'Mixed' : paymentMode,
            transactionId: resolvedTransactionId,
            paymentSplits: paymentMode === 'Multiple Payment' ? activeSplitRows : [],
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

        const parseJsonSafe = async (response) => {
            const raw = await response.text();
            try {
                return JSON.parse(raw);
            } catch {
                return {
                    success: false,
                    message: raw || `Request failed with status ${response.status}`
                };
            }
        };

        try {
            setIsSavingReservation(true);
            if (isEditingMode) {
                // Update existing booking
                const response = await bookingApiCall(`/update/${editingReservationId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookingData)
                });

                const data = await parseJsonSafe(response);
                if (response.ok && data.success) {
                    await fetchReservationsFromAPI();
                    setSuccessMessage('Reservation updated successfully!');
                    setTimeout(() => {
                        setSuccessMessage('');
                        setView('dashboard');
                        setActiveTab(status === 'IN_HOUSE' ? 'in-house' : 'reserved');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }, 1500);
                } else {
                    setErrors({ submit: `Error: ${data.message || 'Unable to update reservation'}` });
                    return;
                }
            } else {
                // Create new booking
                const response = await bookingApiCall(`/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookingData)
                });

                const data = await parseJsonSafe(response);
                if (response.ok && data.success) {
                    await fetchReservationsFromAPI(); // Refresh list
                    setSuccessMessage('Reservation created successfully!');
                    setTimeout(() => {
                        setSuccessMessage('');
                        setView('dashboard');
                        setActiveTab(status === 'IN_HOUSE' ? 'in-house' : 'reserved');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }, 1500);
                } else {
                    console.error('Server returned error:', data);
                    const backendMessage = data?.message
                        || data?.error
                        || (Array.isArray(data?.errors) && data.errors[0]?.msg)
                        || (response?.status ? `Request failed with status ${response.status}` : '')
                        || 'Unknown error';
                    setErrors({ submit: `Error creating reservation: ${backendMessage}` });
                    return;
                }
            }

            resetForm();
        } catch (error) {
            console.error('Error saving reservation:', error);
            setErrors({ submit: `Failed to save reservation: ${error.message}` });
        } finally {
            setIsSavingReservation(false);
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
        setPaymentMode(reservation.paymentMode === 'Mixed' ? 'Multiple Payment' : reservation.paymentMode);
        setTransactionId(reservation.transactionId || '');
        const incomingSplits = Array.isArray(reservation.paymentSplits) ? reservation.paymentSplits : [];
        const prefilledSplitAmounts = { Cash: '', UPI: '', Card: '', 'Bank Transfer': '' };
        const prefilledSplitReferences = { UPI: '', Card: '', 'Bank Transfer': '' };
        incomingSplits.forEach(split => {
            const mode = String(split?.mode || '').trim();
            const amount = Number(split?.amount) || 0;
            if (prefilledSplitAmounts[mode] !== undefined && amount > 0) {
                prefilledSplitAmounts[mode] = String(amount);
            }
            if (mode === 'UPI' && split?.referenceId) prefilledSplitReferences.UPI = normalizeUtrInput(split.referenceId);
            if (mode === 'Bank Transfer' && split?.referenceId) prefilledSplitReferences['Bank Transfer'] = normalizeTxnInput(split.referenceId);
            if (mode === 'Card' && split?.referenceId) prefilledSplitReferences.Card = normalizeTxnInput(split.referenceId);
        });
        setSplitAmounts(prefilledSplitAmounts);
        setSplitReferences(prefilledSplitReferences);
        setUpiUtr('');
        setBankTransactionId('');
        setCardTransactionId('');
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
            const response = await bookingApiCall(`/delete/${reservationId}`, {
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

                        {errors.submit && (
                            <div className="error-alert" role="alert">
                                {errors.submit}
                            </div>
                        )}

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
                                splitAmounts={splitAmounts}
                                onSplitAmountsChange={setSplitAmounts}
                                splitReferences={splitReferences}
                                onSplitReferencesChange={(nextRefs) => setSplitReferences({
                                    UPI: normalizeUtrInput(nextRefs?.UPI),
                                    Card: normalizeTxnInput(nextRefs?.Card),
                                    'Bank Transfer': normalizeTxnInput(nextRefs?.['Bank Transfer'])
                                })}
                                upiUtr={upiUtr}
                                onUpiUtrChange={(value) => setUpiUtr(normalizeUtrInput(value))}
                                bankTransactionId={bankTransactionId}
                                onBankTransactionIdChange={(value) => setBankTransactionId(normalizeTxnInput(value))}
                                cardTransactionId={cardTransactionId}
                                onCardTransactionIdChange={(value) => setCardTransactionId(normalizeTxnInput(value))}
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
                                    disabled={isSavingReservation || isCheckInBlocked}
                                >
                                    {isSavingReservation ? 'Processing...' : '✓ Check-In'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={(e) => handleSaveReservation(e, 'RESERVED')}
                                    disabled={isSavingReservation || isCreateReservationBlocked}
                                >
                                    {isSavingReservation ? 'Saving...' : (isEditingMode ? 'Update Reservation' : 'Create Reservation')}
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
                                            style={{ padding: '0.8rem 2rem', borderRadius: '10px', backgroundColor: '#d41424', borderColor: '#d41424' }}
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
                    <>
                        <div className="details-sheet-backdrop" onClick={() => setSelectedReservation(null)} />
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
                    </>
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
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            padding: '1rem',
                            overflowY: 'auto'
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
                                position: 'relative',
                                margin: '0 auto'
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
            paymentMode: (() => {
                const latestPayment = [...(booking.transactions || [])]
                    .filter((t) => t.type?.toLowerCase() === 'payment')
                    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())[0];
                return booking.paymentMode || billing.paymentMode || latestPayment?.method || 'Cash';
            })(),
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


