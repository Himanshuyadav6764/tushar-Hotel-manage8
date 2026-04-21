import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import soundManager from '../../utils/soundManager';
import API_URL, { apiCall } from '../../config/api';
import FoodMenuDashboard from '../FoodMenu/FoodMenuDashboard';
import FoodOrderPage from '../../components/FoodOrderPage';
import ViewOrderPage from '../../components/ViewOrderPage';
import AdminLayout from '../../components/AdminLayout';
import FoodPaymentReport from '../FoodPaymentReport/FoodPaymentReport';
import Customers from '../Customers/Customers';
import DashboardHome from '../DashboardHome/DashboardHome';
import MyProfile from '../Profile/MyProfile';
import ReservationStayManagement from "../../components/ReservationStayManagement";
import GuestMealService from '../GuestMealService/GuestMealService';
import DiscountManagement from '../DiscountManagement/DiscountManagement';
import CashierReport from '../CashierReport/CashierReport';
import CashierSection from '../Cashier/CashierSection';
import StayOverview from '../../components/StayOverview';
import RoomSetup from '../RoomSetup/RoomSetup';
import CRMModel from '../CRMModel/CRMModel';

import RoomFacilityType from '../RoomFacilityType/RoomFacilityType';
import MealType from '../MealType/MealType';
import ReservationType from '../ReservationType/ReservationType';
import ExtraCharge from '../ExtraCharge/ExtraCharge';
import ComplimentaryService from '../ComplimentaryService/ComplimentaryService';
import CustomerIdentity from '../CustomerIdentity/CustomerIdentity';
import BookingSource from '../BookingSource/BookingSource';
import BusinessSource from '../BusinessSource/BusinessSource';
import MaintenanceBlock from '../MaintenanceBlock/MaintenanceBlock';


import FloorSetup from '../FloorSetup/FloorSetup';
import TableManagement from '../TableManagement/TableManagement';
import RoomService from '../../components/RoomService';
import HousekeepingView from '../../components/HousekeepingView';
import CompanySettings from '../CompanySettings/CompanySettings';
import UniversalReport from '../Reports/UniversalReport';
import StaffReport from '../Reports/StaffReport';
import ReservationReport from '../Reports/ReservationReport';
import './AdminDashboard.css';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);

    // Determine initial active menu based on permissions
    const getInitialMenu = () => {
        // Priority 1: State passed via navigation (e.g. from GuestMealService 'Send')
        if (location.state && location.state.activeMenu) {
            return location.state.activeMenu;
        }

        const path = location.pathname;
        // Strip prefix (/admin or /staff)
        const cleanPath = path.replace(/^\/(admin|staff)/, '');

        if (cleanPath === '/dashboard' || cleanPath === '' || cleanPath === '/') return 'dashboard';

        // Match path to menu items
        const menuMap = {
            '/rooms': 'rooms',
            '/reservations': 'reservations',
            '/guest-meal-service': 'guest-meal-service',
            '/food-menu': 'food-menu',
            '/customers': 'customers',
            '/cashier-section': 'cashier-section',
            '/food-order': 'food-order',
            '/view-order': 'view-order',
            '/reservation-card': 'reservation-card',
            '/crm-model': 'crm-model',
            '/room-service': 'room-service',
            '/housekeeping': 'housekeeping'
        };

        for (const [route, menu] of Object.entries(menuMap)) {
            if (cleanPath.startsWith(route)) return menu;
        }

        return 'dashboard';
    };

    const [activeMenu, setActiveMenu] = useState(getInitialMenu());
    const [reservationView, setReservationView] = useState('dashboard'); // State for Reservation Sub-views
    const [showViewProfile, setShowViewProfile] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [openConfigDropdown, setOpenConfigDropdown] = useState(false);
    const [openReservationDropdown, setOpenReservationDropdown] = useState(false); // State for Reservation Dropdown
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    // Rooms management states
    const [rooms, setRooms] = useState([]);
    const [filteredRooms, setFilteredRooms] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

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
    const [showAddRoomModal, setShowAddRoomModal] = useState(false);
    const [showEditRoomModal, setShowEditRoomModal] = useState(false);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [roomFormData, setRoomFormData] = useState({
        roomNumber: '',
        roomType: '',
        price: '',
        capacity: '',
        floor: '',
        isSmartRoom: false,
        dynamicRateEnabled: false,
        weekendMultiplier: 1.2,
        seasonalMultiplier: 1.1
    });
    const [roomErrorMessage, setRoomErrorMessage] = useState('');
    const [currentPricing, setCurrentPricing] = useState(null);
    const [priceOption, setPriceOption] = useState('custom'); // 'min', 'mid', 'max', 'custom'

    // Room Details Panel states
    const [selectedRoomIdForPanel, setSelectedRoomIdForPanel] = useState(null);
    const [isRoomPanelOpen, setIsRoomPanelOpen] = useState(false);

    // Generate Room QR states
    const [selectedStore, setSelectedStore] = useState('Testing 3.0');
    const [showQRStoreDropdown, setShowQRStoreDropdown] = useState(false);
    const [selectedQRCategory, setSelectedQRCategory] = useState('');
    const [selectedQRRoom, setSelectedQRRoom] = useState('');
    const [showQRCategoryDropdown, setShowQRCategoryDropdown] = useState(false);
    const [showQRRoomDropdown, setShowQRRoomDropdown] = useState(false);
    const [qrSearchTable, setQRSearchTable] = useState('');
    const [qrRoomsData, setQRRoomsData] = useState([]);
    const [filteredQRRooms, setFilteredQRRooms] = useState([]);
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrModalData, setQRModalData] = useState(null);
    const [qrLoading, setQRLoading] = useState(false);
    const qrCategoryDropdownRef = useRef(null);
    const qrRoomDropdownRef = useRef(null);
    const qrStoreDropdownRef = useRef(null);

    // Room type categories
    const statusOptions = ['All Status', 'Available', 'Booked', 'Occupied', 'Under Maintenance'];

    const [posGuestDetails, setPosGuestDetails] = useState(null);

    // Set active menu based on URL path or State
    useEffect(() => {
        const path = location.pathname;

        // Priority to state passed via navigation (e.g. from RoomService or StayOverview or Cashier or GuestMealService)
        if (location.state && location.state.activeMenu) {
            console.log('AdminDashboard: setting activeMenu from state:', location.state.activeMenu);
            setActiveMenu(location.state.activeMenu);

            // Check for passed customer details (e.g. from Cashier New Order)
            if (location.state.customerName) {
                setPosGuestDetails({
                    guestName: location.state.customerName,
                    phoneNumber: location.state.customerPhone,
                    roomNumber: 'Take Away', // Distinct from POS generic
                    mode: location.state.orderMode // Pass mode if available
                });
            } else if (location.state.room) {
                // From GuestMealService (Dining Dashboard)
                setPosGuestDetails(location.state.room);
            }
            return;
        }

        // Handle viewMode from navigation state
        if (location.state && location.state.viewMode) {
            setReservationView(location.state.viewMode);
        }

        if (path.includes('/reservations')) setActiveMenu('reservations');
        else if (path.includes('/rooms')) setActiveMenu('rooms');
        else if (path.includes('/guest-meal-service')) setActiveMenu('guest-meal-service');
        else if (path.includes('/food-menu')) setActiveMenu('food-menu');
        else if (path.includes('/customers')) setActiveMenu('customers');
        else if (path.includes('/crm-model')) setActiveMenu('crm-model');
        else if (path.includes('/stay-overview')) setActiveMenu('stay-overview');
        else if (path.includes('/reservation-stay-management')) setActiveMenu('reservations');
        else if (path.includes('/view-reservation')) setActiveMenu('reservations');
        else if (path.includes('/room-service')) setActiveMenu('room-service');
        else if (path.includes('/housekeeping')) setActiveMenu('housekeeping');
        else if (path.includes('/view-order')) setActiveMenu('view-order');
        else if (path.includes('/dashboard')) setActiveMenu('dashboard');
        else if (path.includes('/cashier-section')) setActiveMenu('cashier-section');
        else if (path.includes('/cashier-report')) setActiveMenu('cashier-report');
        else if (path.includes('/food-payment-report')) setActiveMenu('food-payment-report');
        else if (path.includes('/my-profile')) setActiveMenu('my-profile');

        // Property Setup
        else if (path.includes('/discount')) setActiveMenu('discount');
        else if (path.includes('/generate-room-qr')) setActiveMenu('generate-room-qr');

        // Property Configuration
        else if (path.includes('/room-setup')) setActiveMenu('rooms');
        else if (path.includes('/floor-setup')) setActiveMenu('floor-setup');

        else if (path.includes('/room-facilities-type')) setActiveMenu('room-facilities-type');
        else if (path.includes('/meal-type')) setActiveMenu('meal-type');
        else if (path.includes('/reservation-type')) setActiveMenu('reservation-type');
        else if (path.includes('/extra-charges')) setActiveMenu('extra-charges');
        else if (path.includes('/complimentary-services')) setActiveMenu('complimentary-services');
        else if (path.includes('/customer-identity')) setActiveMenu('customer-identity');
        else if (path.includes('/booking-source')) setActiveMenu('booking-source');
        else if (path.includes('/business-source')) setActiveMenu('business-source');
        else if (path.includes('/maintenance-block')) setActiveMenu('maintenance-block');
        else if (path.includes('/table-management')) setActiveMenu('table-management');
        else if (path.includes('/food-order')) setActiveMenu('food-order');
        else if (path.includes('/reservation-card')) setActiveMenu('reservation-card');
        else if (path.includes('/company-settings')) setActiveMenu('company');
        else if (path.includes('/reports-')) {
            const reportType = path.split('/').pop();
            setActiveMenu(reportType);
        }

    }, [location]);

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

    const [exactMatch, setExactMatch] = useState(true);

    const fetchRoomsFromAPI = async (forceFilters = null) => {
        try {
            // Clear old localStorage data
            localStorage.removeItem('hotelRooms');

            const currentFilters = forceFilters || filters;
            const queryParams = new URLSearchParams();

            if (currentFilters.floor && currentFilters.floor !== 'All') queryParams.append('floor', currentFilters.floor);
            if (currentFilters.roomType && currentFilters.roomType !== 'All') queryParams.append('roomType', currentFilters.roomType);
            if (currentFilters.bedType && currentFilters.bedType !== 'All') queryParams.append('bedType', currentFilters.bedType);
            if (currentFilters.status && currentFilters.status !== 'All') queryParams.append('status', currentFilters.status);

            const response = await apiCall(`/api/rooms/list?${queryParams.toString()}`);
            const data = await response.json();
            if (data.success) {
                setRooms(data.data);
                setExactMatch(data.exactMatch !== false);
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
    }, [activeMenu]);

    // Filter rooms based on search and filters
    // Filter rooms based on search and filters
    useEffect(() => {
        fetchRoomsFromAPI();
    }, [filters]);

    // Local filter for search query only
    useEffect(() => {
        let filtered = [...rooms];

        // Search filter
        if (searchQuery) {
            filtered = filtered.filter(room =>
                room.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                room.roomType.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        setFilteredRooms(filtered);
    }, [rooms, searchQuery]);

    // Filter QR rooms based on search and category
    useEffect(() => {
        let filtered = [...rooms];

        if (qrSearchTable) {
            filtered = filtered.filter(room =>
                room.roomNumber.toLowerCase().includes(qrSearchTable.toLowerCase()) ||
                room.roomType.toLowerCase().includes(qrSearchTable.toLowerCase())
            );
        }

        if (selectedQRCategory) {
            filtered = filtered.filter(room => {
                const roomType = room.roomType.toLowerCase();
                const category = selectedQRCategory.toLowerCase();
                return roomType.includes(category);
            });
        }

        if (selectedQRRoom) {
            filtered = filtered.filter(room => room.roomNumber === selectedQRRoom);
        }

        setFilteredQRRooms(filtered);
    }, [rooms, qrSearchTable, selectedQRCategory, selectedQRRoom]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (qrStoreDropdownRef.current && !qrStoreDropdownRef.current.contains(event.target)) {
                setShowQRStoreDropdown(false);
            }
            if (qrCategoryDropdownRef.current && !qrCategoryDropdownRef.current.contains(event.target)) {
                setShowQRCategoryDropdown(false);
            }
            if (qrRoomDropdownRef.current && !qrRoomDropdownRef.current.contains(event.target)) {
                setShowQRRoomDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Function to get user initials
    const getUserInitials = (name) => {
        if (!name) return '??';
        const names = name.split(' ');
        if (names.length >= 2) {
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const handleLogout = () => {
        // Use context logout to clear authUser and state
        logout();
        // Clear legacy/extra keys if any
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');

        // Force reload and redirect to login to ensure clean state
        window.location.href = '/login';
    };

    const handleViewProfile = () => {
        setActiveMenu('my-profile');
        setShowProfileDropdown(false);
        navigate('/admin/my-profile');
    };

    const handleChangePassword = () => {
        setShowChangePassword(true);
        setShowProfileDropdown(false);
    };

    const handlePasswordChange = (e) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        // Password change logic should ideally be handled by an API call
        // For now, we'll disable the client-side local check as userData is deprecated
        /*
        if (passwordData.currentPassword !== userData.password) {
            setPasswordError('Current password is incorrect');
            return;
        }
        */

        // Validate new password
        if (passwordData.newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters');
            return;
        }

        // Validate confirm password
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        // Update password functionality requires backend API integration
        alert('Password change requires backend API call. Coming soon!');
        /*
        const updatedUserData = {
            ...user,
            password: passwordData.newPassword
        };
        localStorage.setItem('authUser', JSON.stringify(updatedUserData));
        */

        // Show success message
        setPasswordSuccess('Password changed successfully!');

        // Reset form after 2 seconds
        setTimeout(() => {
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
            setShowChangePassword(false);
            setPasswordSuccess('');
        }, 2000);
    };

    // Unified menu items are now managed in Sidebar.jsx


    const handleMenuClick = (menuId) => {
        const prefix = '/admin';
        // Immediately update active menu to avoid UI blink during navigation
        const setMenuNow = (menu) => {
            if (menu) setActiveMenu(menu);
        };

        // Handle Sub-menu routing for Reservation Dropdown
        if (menuId === 'reservations-dashboard') {
            setMenuNow('reservations');
            navigate(`${prefix}/reservations`, { state: { viewMode: 'dashboard' } });
        } else if (menuId === 'new-reservation') {
            setMenuNow('reservations');
            navigate(`${prefix}/reservations`, { state: { viewMode: 'form' } });
        } else if (menuId === 'housekeeping') {
            setMenuNow('housekeeping');
            navigate(`${prefix}/housekeeping`);
        } else if (menuId === 'room-service') {
            setMenuNow('room-service');
            navigate(`${prefix}/room-service`);
        } else if (menuId === 'online-order-nav') {
            setMenuNow('online-order-nav');
            navigate(`${prefix}/view-order`, {
                state: { activeFilter: 'Online Order', activeMenu: 'online-order-nav' }
            });
        } else if (menuId === 'food-order') {
            setMenuNow('food-order');
            navigate(`${prefix}/food-order`);
        } else if (menuId === 'reservation-card') {
            setMenuNow('reservation-card');
            navigate(`${prefix}/reservation-card`);
        }
        // Handle main menu items with navigation
        else if (menuId === 'dashboard') { setMenuNow('dashboard'); navigate(`${prefix}/dashboard`); }
        else if (menuId === 'rooms') {
            // Reset search and filters when switching menus
            setSearchQuery('');
            setFilters({
                floor: 'All',
                roomType: 'All',
                bedType: 'All',
                status: 'All'
            });
            setMenuNow('rooms');
            navigate(`${prefix}/rooms`);
        }
        else if (menuId === 'reservations') {
            toggleDropdown('reservations');
        }
        else if (menuId === 'cashier-section') { setMenuNow('cashier-section'); navigate(`${prefix}/cashier-section`); }
        else if (menuId === 'guest-meal-service') { setMenuNow('guest-meal-service'); navigate(`${prefix}/guest-meal-service`); }
        else if (menuId === 'food-menu') { setMenuNow('food-menu'); navigate(`${prefix}/food-menu`); }
        else if (menuId === 'customers') { setMenuNow('customers'); navigate(`${prefix}/customers`); }
        else if (menuId === 'crm-model') { setMenuNow('crm-model'); navigate(`${prefix}/crm-model`); }
        else if (menuId === 'cashier-report') { setMenuNow('cashier-report'); navigate(`${prefix}/cashier-report`); }
        else if (menuId === 'food-payment-report') { setMenuNow('food-payment-report'); navigate(`${prefix}/food-payment-report`); }
        else if (menuId === 'view-order') { setMenuNow('view-order'); navigate(`${prefix}/view-order`); }
        else if (menuId.startsWith('reports-')) { const reportMenu = menuId; setMenuNow(reportMenu); navigate(`${prefix}/${menuId}`); }

        // Property Setup
        else if (menuId === 'discount') { setMenuNow('discount'); navigate(`${prefix}/discount`); }
        else if (menuId === 'generate-room-qr') { setMenuNow('generate-room-qr'); navigate(`${prefix}/generate-room-qr`); }

        // Property Config

        else if (menuId === 'floor-setup') { setMenuNow('floor-setup'); navigate(`${prefix}/floor-setup`); }
        else if (menuId === 'room-facilities') { setMenuNow('room-facilities'); navigate(`${prefix}/room-facilities`); }
        else if (menuId === 'room-facilities-type') { setMenuNow('room-facilities-type'); navigate(`${prefix}/room-facilities-type`); }
        else if (menuId === 'meal-type') { setMenuNow('meal-type'); navigate(`${prefix}/meal-type`); }
        else if (menuId === 'reservation-type') { setMenuNow('reservation-type'); navigate(`${prefix}/reservation-type`); }
        else if (menuId === 'extra-charges') { setMenuNow('extra-charges'); navigate(`${prefix}/extra-charges`); }
        else if (menuId === 'complimentary-services') { setMenuNow('complimentary-services'); navigate(`${prefix}/complimentary-services`); }
        else if (menuId === 'customer-identity') { setMenuNow('customer-identity'); navigate(`${prefix}/customer-identity`); }
        else if (menuId === 'booking-source') { setMenuNow('booking-source'); navigate(`${prefix}/booking-source`); }
        else if (menuId === 'business-source') { setMenuNow('business-source'); navigate(`${prefix}/business-source`); }
        else if (menuId === 'maintenance-block') { setMenuNow('maintenance-block'); navigate(`${prefix}/maintenance-block`); }
        else if (menuId === 'table-management') { setMenuNow('table-management'); navigate(`${prefix}/table-management`); }
        else if (menuId === 'company' || menuId === 'company-settings') { setMenuNow('company'); navigate(`${prefix}/company-settings`); }
        else if (menuId === 'hotel-customer') {
            // Future implementation
            alert('Coming Soon');
        }
        else if (menuId === 'housekeeping-config') {
            // Future implementation
            alert('Coming Soon');
        }
        else if (menuId === 'screen-field-rule') {
            // Future implementation
            alert('Coming Soon');
        }
    };

    // Helper to toggle specific dropdowns
    const toggleDropdown = (id) => {
        if (id === 'proper-configuration') {
            setOpenConfigDropdown(!openConfigDropdown);
        } else if (id === 'reservations') {
            setOpenReservationDropdown(!openReservationDropdown);
        }
    };


    // Generate/View QR Code for Room
    const handleViewQR = async (room) => {
        setQRLoading(true);
        try {
            const response = await apiCall(`/api/qr/generate/${room._id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                setQRModalData({
                    room: room,
                    qrCode: data.data.qrCode,
                    qrData: data.data.qrData
                });
                setShowQRModal(true);
            } else {
                alert('Failed to generate QR code: ' + data.message);
            }
        } catch (error) {
            console.error('Error generating QR:', error);
            alert('Failed to generate QR code. Please try again.');
        } finally {
            setQRLoading(false);
        }
    };

    // Download QR Code
    const handleDownloadQR = () => {
        if (!qrModalData) return;

        const link = document.createElement('a');
        link.download = `Room-${qrModalData.room.roomNumber}-QR.png`;
        link.href = qrModalData.qrCode;
        link.click();
    };

    // Room management functions
    const getAllRoomTypes = () => {
        const types = ['All Types'];
        roomTypes.forEach(type => {
            types.push(type.name);
        });
        return types;
    };

    const handleAddRoom = () => {
        setRoomFormData({
            roomNumber: '',
            roomType: '',
            price: '',
            capacity: '',
            floor: '',
            bedType: 'Double',
            status: 'Available',
            isSmartRoom: false
        });
        setRoomErrorMessage('');
        setPriceOption('custom');
        setCurrentPricing(null);
        setShowAddRoomModal(true);
    };

    const handleEditRoom = (room) => {
        setCurrentRoom(room);
        setRoomFormData({
            roomNumber: room.roomNumber,
            roomType: room.roomType,
            price: room.price.toString(),
            capacity: room.capacity.toString(),
            floor: room.floor || '',
            bedType: room.bedType || 'Double',
            status: room.status || 'Available',
            isSmartRoom: room.isSmartRoom || false
        });
        setRoomErrorMessage('');
        setPriceOption('custom');
        setShowEditRoomModal(true);
    };

    const handleRoomSubmit = async (e) => {
        e.preventDefault();
        setRoomErrorMessage('');

        if (!roomFormData.roomNumber || !roomFormData.roomType || !roomFormData.price || !roomFormData.capacity || !roomFormData.floor) {
            setRoomErrorMessage('All fields are required');
            return;
        }

        try {
            if (showAddRoomModal) {
                const newRoom = {
                    roomNumber: roomFormData.roomNumber,
                    roomType: roomFormData.roomType,
                    floor: roomFormData.floor,
                    capacity: parseInt(roomFormData.capacity),
                    price: parseInt(roomFormData.price),
                    bedType: roomFormData.bedType,
                    status: roomFormData.status,
                    isSmartRoom: roomFormData.isSmartRoom,

                };

                const response = await apiCall(`/api/rooms/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newRoom)
                });

                const data = await response.json();

                if (!data.success) {
                    setRoomErrorMessage(data.message || 'Failed to add room');
                    return;
                }

                soundManager.play('success');
                await fetchRoomsFromAPI();
                setShowAddRoomModal(false);
            } else if (showEditRoomModal) {
                const updatedRoom = {
                    roomNumber: roomFormData.roomNumber,
                    roomType: roomFormData.roomType,
                    floor: roomFormData.floor,
                    capacity: parseInt(roomFormData.capacity),
                    price: parseInt(roomFormData.price),
                    bedType: roomFormData.bedType,
                    status: roomFormData.status,
                    isSmartRoom: roomFormData.isSmartRoom,

                };

                const response = await apiCall(`/api/rooms/update/${currentRoom._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedRoom)
                });

                const data = await response.json();

                if (!data.success) {
                    setRoomErrorMessage(data.message || 'Failed to update room');
                    return;
                }

                await fetchRoomsFromAPI();
                soundManager.play('success');
                setShowEditRoomModal(false);
            }

            setRoomFormData({
                roomNumber: '',
                roomType: '',
                price: '',
                capacity: '',
                floor: '',
                isSmartRoom: false,
                dynamicRateEnabled: false,
                weekendMultiplier: 1.2,
                seasonalMultiplier: 1.1
            });
            setCurrentRoom(null);
        } catch (error) {
            console.error('Error submitting room:', error);
            setRoomErrorMessage('Failed to save room. Please try again.');
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

    const handleComingSoon = () => {
        alert('Coming Soon!');
    };

    const handleRoomClick = (room) => {
        setSelectedRoomIdForPanel(room._id);
        setIsRoomPanelOpen(true);
    };

    const handleUpdateRoomStatusPanel = (updatedRoom) => {
        setRooms(prevRooms => prevRooms.map(r => r._id === updatedRoom._id ? updatedRoom : r));
        if (updatedRoom.status === 'Under Maintenance' || updatedRoom.status === 'Dirty') {
            soundManager.play('alert');
        } else if (updatedRoom.status === 'Available') {
            soundManager.play('success');
        }
    };

    const handleQuickBook = (room) => {
        setIsRoomPanelOpen(false);
        navigate('/admin/reservations', {
            state: {
                viewMode: 'form',
                prefilledData: {
                    roomId: room._id,
                    roomNumber: room.roomNumber,
                    roomType: room.roomType,
                    floor: room.floor,
                    bedType: room.bedType,
                    price: room.price,
                    capacity: room.capacity
                },
                autoOpenGuestModal: true
            }
        });
        setActiveMenu('reservations');
        setReservationView('form');
    };

    return (
        <AdminLayout
            activeMenu={activeMenu}
            onMenuClick={handleMenuClick}
            onLogout={handleLogout}
            noPadding={
                activeMenu === 'stay-overview' ||
                activeMenu === 'view-order' ||
                activeMenu === 'online-order-nav' ||
                activeMenu === 'food-order' ||
                activeMenu === 'reservation-card' ||
                activeMenu === 'company' ||
                activeMenu === 'cashier-section' ||
                activeMenu?.startsWith('reports-')
            }
        >


            {/* Dashboard View */}
            {
                activeMenu === 'dashboard' && (
                    <DashboardHome />
                )
            }

            {/* Rooms View */}
            {
                activeMenu === 'rooms' && (
                    <RoomSetup />
                )
            }



            {/* Reservation & Stay Management View */}
            {
                activeMenu === 'reservations' && (
                    <ReservationStayManagement viewMode={reservationView} />
                )
            }

            {/* Food Order POS View */}
            {
                activeMenu === 'food-order' && (
                    <div style={{ position: 'relative', height: 'calc(100vh - 60px)', width: '100%' }}>
                        <FoodOrderPage
                            room={posGuestDetails || location.state?.room || (location.state?.orderMode === 'takeaway' ? {
                                roomNumber: 'Take Away',
                                guestName: location.state?.customerName || 'Walk-in',
                                phoneNumber: location.state?.customerPhone,
                                mode: 'takeaway'
                            } : { roomNumber: 'POS', guestName: 'Walk-in / Direct' })}
                            onClose={() => {
                                if (location.state?.source === 'room-service') {
                                    navigate('/admin/room-service');
                                } else if (location.state?.source === 'table-order') {
                                    navigate('/admin/guest-meal-service');
                                } else {
                                    setActiveMenu('reservations');
                                    setReservationView('roomservice');
                                }
                                setPosGuestDetails(null);
                            }}
                        />
                    </div>
                )
            }

            {/* Guest Meal Service View */}
            {
                activeMenu === 'guest-meal-service' && (
                    <GuestMealService />
                )
            }

            {/* Room Service View */}
            {
                activeMenu === 'room-service' && (
                    <RoomService />
                )
            }

            {/* Housekeeping View */}
            {
                activeMenu === 'housekeeping' && (
                    <HousekeepingView />
                )
            }

            {/* Food Menu View */}
            {
                activeMenu === 'food-menu' && (
                    <FoodMenuDashboard />
                )
            }

            {/* Table Management POS View */}
            {
                activeMenu === 'table-management' && (
                    <TableManagement />
                )
            }

            {/* Food Payment Report View */}
            {activeMenu === 'food-payment-report' && (
                <FoodPaymentReport />
            )}

            {/* Cashier Report View */}
            {activeMenu === 'cashier-report' && (
                <CashierReport />
            )}

            {/* Cashier Section View (New) */}
            {activeMenu === 'cashier-section' && (
                <CashierSection />
            )}

            {/* Staff Report (dedicated) */}
            {activeMenu === 'reports-staff' && (
                <StaffReport />
            )}

            {/* Reservation Report (dedicated) */}
            {activeMenu === 'reports-reservations' && (
                <ReservationReport />
            )}

            {/* Universal Reports (all except staff & reservations) */}
            {activeMenu?.startsWith('reports-') && activeMenu !== 'reports-staff' && activeMenu !== 'reports-reservations' && (
                <UniversalReport type={activeMenu} />
            )}

            {/* Stay Overview View (Image 1) */}
            {activeMenu === 'stay-overview' && (
                <StayOverview />
            )}

            {/* Proper Configuration Options */}
            {
                activeMenu === 'discount' && (
                    <DiscountManagement />
                )
            }

            {/* View Order Page */}
            {
                (activeMenu === 'view-order' || activeMenu === 'online-order-nav') && (
                    <ViewOrderPage />
                )
            }

            {/* Reservation Card Management View - Calendar/Timeline */}
            {
                activeMenu === 'reservation-card' && (
                    <StayOverview />
                )
            }

            {
                activeMenu === 'generate-room-qr' && (
                    <div className="content-section generate-qr-section">
                        <div className="qr-header">
                            <div className="qr-header-title">
                                <span className="qr-icon">📱</span>
                                <h1>Generate Room QR</h1>
                            </div>
                        </div>

                        <div className="qr-filters-card">
                            <div className="qr-filters-row">
                                <div className="qr-filter-group">
                                    <label>Select Store</label>
                                    <div className="qr-custom-select-wrapper" ref={qrStoreDropdownRef}>
                                        <button
                                            type="button"
                                            className="qr-select qr-custom-select"
                                            onClick={() => {
                                                setShowQRStoreDropdown((prev) => !prev);
                                                setShowQRCategoryDropdown(false);
                                                setShowQRRoomDropdown(false);
                                            }}
                                        >
                                            <span>{selectedStore}</span>
                                            <span className={`qr-custom-arrow ${showQRStoreDropdown ? 'open' : ''}`}>▼</span>
                                        </button>

                                        {showQRStoreDropdown && (
                                            <div className="qr-custom-options">
                                                {['Testing 3.0', 'Store 1', 'Store 2'].map((store) => (
                                                    <button
                                                        key={store}
                                                        type="button"
                                                        className="qr-custom-option"
                                                        onClick={() => {
                                                            setSelectedStore(store);
                                                            setShowQRStoreDropdown(false);
                                                        }}
                                                    >
                                                        {store}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="qr-filters-row qr-filters-row-multi">
                                <div className="qr-filter-group">
                                    <label>Category</label>
                                    <div className="qr-custom-select-wrapper" ref={qrCategoryDropdownRef}>
                                        <button
                                            type="button"
                                            className="qr-select qr-custom-select"
                                            onClick={() => {
                                                setShowQRCategoryDropdown((prev) => !prev);
                                                setShowQRRoomDropdown(false);
                                            }}
                                        >
                                            <span>{selectedQRCategory || 'Select Category'}</span>
                                            <span className={`qr-custom-arrow ${showQRCategoryDropdown ? 'open' : ''}`}>▼</span>
                                        </button>

                                        {showQRCategoryDropdown && (
                                            <div className="qr-custom-options">
                                                <button
                                                    type="button"
                                                    className="qr-custom-option"
                                                    onClick={() => {
                                                        setSelectedQRCategory('');
                                                        setSelectedQRRoom('');
                                                        setShowQRCategoryDropdown(false);
                                                    }}
                                                >
                                                    Select Category
                                                </button>
                                                {[...new Set(rooms.map(room => room.roomType))].map(type => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        className="qr-custom-option"
                                                        onClick={() => {
                                                            setSelectedQRCategory(type);
                                                            setSelectedQRRoom('');
                                                            setShowQRCategoryDropdown(false);
                                                        }}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="qr-filter-group">
                                    <label>Room</label>
                                    <div className="qr-custom-select-wrapper" ref={qrRoomDropdownRef}>
                                        <button
                                            type="button"
                                            className="qr-select qr-custom-select"
                                            onClick={() => {
                                                if (!selectedQRCategory) return;
                                                setShowQRRoomDropdown((prev) => !prev);
                                                setShowQRCategoryDropdown(false);
                                            }}
                                            disabled={!selectedQRCategory}
                                        >
                                            <span>{selectedQRRoom || 'Select Room'}</span>
                                            <span className={`qr-custom-arrow ${showQRRoomDropdown ? 'open' : ''}`}>▼</span>
                                        </button>

                                        {showQRRoomDropdown && selectedQRCategory && (
                                            <div className="qr-custom-options">
                                                <button
                                                    type="button"
                                                    className="qr-custom-option"
                                                    onClick={() => {
                                                        setSelectedQRRoom('');
                                                        setShowQRRoomDropdown(false);
                                                    }}
                                                >
                                                    Select Room
                                                </button>
                                                {rooms
                                                    .filter(room => !selectedQRCategory || room.roomType === selectedQRCategory)
                                                    .map(room => (
                                                        <button
                                                            key={room._id}
                                                            type="button"
                                                            className="qr-custom-option"
                                                            onClick={() => {
                                                                setSelectedQRRoom(room.roomNumber);
                                                                setShowQRRoomDropdown(false);
                                                            }}
                                                        >
                                                            {room.roomNumber}
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="qr-filter-group qr-search-group">
                                    <label>Search</label>
                                    <div className="qr-search-wrapper">
                                        <input
                                            type="text"
                                            className="qr-search-input"
                                            placeholder="Search Table"
                                            value={qrSearchTable}
                                            onChange={(e) => setQRSearchTable(e.target.value.replace(/[^a-zA-Z0-9\s]/g, ''))}
                                        />
                                        <span className="qr-search-icon">🔍</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="qr-table-card">
                            <div className="qr-table-container">
                                <table className="qr-table">
                                    <thead>
                                        <tr>
                                            <th>Category</th>
                                            <th>Room Name</th>
                                            <th style={{ textAlign: 'center' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredQRRooms.length > 0 ? (
                                            filteredQRRooms.map((room) => (
                                                <tr key={room._id}>
                                                    <td>
                                                        <span className="qr-category-badge">
                                                            {room.roomType}
                                                        </span>
                                                    </td>
                                                    <td className="qr-room-name">{room.roomNumber}</td>
                                                    <td>
                                                        <div className="qr-action-buttons">
                                                            <button
                                                                className="qr-table-action-btn qr-view-btn"
                                                                title="Generate/View QR"
                                                                onClick={() => handleViewQR(room)}
                                                                disabled={qrLoading}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                                    <circle cx="12" cy="12" r="3"></circle>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="3" className="qr-table-empty">
                                                    {rooms.length === 0 ? 'No rooms available' : 'No rooms found matching your search'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }





            {/* Room Facilities Type View */}
            {
                activeMenu === 'room-facilities-type' && (
                    <RoomFacilityType />
                )
            }

            {/* Meal Type View */}
            {
                activeMenu === 'meal-type' && (
                    <MealType />
                )
            }

            {/* Reservation Type View */}
            {
                activeMenu === 'reservation-type' && (
                    <ReservationType />
                )
            }

            {/* Extra Charges View */}
            {
                activeMenu === 'extra-charges' && (
                    <ExtraCharge />
                )
            }

            {/* Complimentary Services View */}
            {
                activeMenu === 'complimentary-services' && (
                    <ComplimentaryService />
                )
            }

            {/* Customer Identity View */}
            {
                activeMenu === 'customer-identity' && (
                    <CustomerIdentity />
                )
            }

            {/* Booking Source View */}
            {
                activeMenu === 'booking-source' && (
                    <BookingSource />
                )
            }

            {/* Business Source View */}
            {
                activeMenu === 'business-source' && (
                    <BusinessSource />
                )
            }

            {/* Maintenance Block View */}
            {
                activeMenu === 'maintenance-block' && (
                    <MaintenanceBlock />
                )
            }



            {/* Floor Setup View */}
            {
                activeMenu === 'floor-setup' && (
                    <FloorSetup />
                )
            }



            {/* CRM Model View */}
            {
                activeMenu === 'crm-model' && (
                    <CRMModel />
                )
            }

            {/* Customers View */}
            {
                activeMenu === 'customers' && (
                    <Customers />
                )
            }

            {/* My Profile View */}
            {
                activeMenu === 'my-profile' && (
                    <MyProfile />
                )
            }

            {/* Company Settings View */}
            {
                activeMenu === 'company' && (
                    <CompanySettings />
                )
            }

            {/* View Profile Modal */}
            {
                showViewProfile && (
                    <div className="modal-overlay" onClick={() => setShowViewProfile(false)}>
                        <motion.div
                            className="modal-content"
                            onClick={(e) => e.stopPropagation()}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="modal-header">
                                <h2>View Profile</h2>
                                <button className="modal-close" onClick={() => setShowViewProfile(false)}>
                                    ✕
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="profile-avatar-section">
                                    <div className="profile-avatar-large">
                                        {getUserInitials(user?.name || 'Admin')}
                                    </div>
                                </div>
                                <div className="profile-details">
                                    <div className="detail-row">
                                        <span className="detail-label">Email:</span>
                                        <span className="detail-value">{user?.email || 'N/A'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Role:</span>
                                        <span className="detail-value role-badge">{user?.role || 'User'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowViewProfile(false)}>
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )
            }

            {/* Change Password Modal */}
            {
                showChangePassword && (
                    <div className="modal-overlay" onClick={() => setShowChangePassword(false)}>
                        <motion.div
                            className="modal-content"
                            onClick={(e) => e.stopPropagation()}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="modal-header">
                                <h2>Change Password</h2>
                                <button className="modal-close" onClick={() => setShowChangePassword(false)}>
                                    ✕
                                </button>
                            </div>
                            <form onSubmit={handlePasswordChange}>
                                <div className="modal-body">
                                    {passwordError && (
                                        <div className="alert alert-error">
                                            {passwordError}
                                        </div>
                                    )}
                                    {passwordSuccess && (
                                        <div className="alert alert-success">
                                            {passwordSuccess}
                                        </div>
                                    )}
                                    <div className="form-group">
                                        <label>Current Password</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={passwordData.currentPassword}
                                            onChange={(e) => setPasswordData({
                                                ...passwordData,
                                                currentPassword: e.target.value
                                            })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>New Password</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={passwordData.newPassword}
                                            onChange={(e) => setPasswordData({
                                                ...passwordData,
                                                newPassword: e.target.value
                                            })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Confirm New Password</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={passwordData.confirmPassword}
                                            onChange={(e) => setPasswordData({
                                                ...passwordData,
                                                confirmPassword: e.target.value
                                            })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowChangePassword(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        Update Password
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )
            }

            {/* Add Room Modal */}
            {
                showAddRoomModal && (
                    <div className="modal-overlay" onClick={() => setShowAddRoomModal(false)}>
                        <motion.div
                            className="modal-content room-modal"
                            onClick={(e) => e.stopPropagation()}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="modal-header">
                                <h2>Add New Room</h2>
                                <button className="modal-close" onClick={() => setShowAddRoomModal(false)}>
                                    ✕
                                </button>
                            </div>

                            {roomErrorMessage && (
                                <div className="error-alert">
                                    ⚠️ {roomErrorMessage}
                                </div>
                            )}

                            <form onSubmit={handleRoomSubmit}>
                                <div className="form-group">
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g., 101, 102"
                                        value={roomFormData.roomNumber}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, roomNumber: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>FLOOR *</label>
                                    <select
                                        className="form-input"
                                        value={roomFormData.floor}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, floor: e.target.value })}
                                    >
                                        <option value="">-- Select Floor --</option>
                                        {floors.map(floor => (
                                            <option key={floor._id} value={floor.name}>{floor.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>ROOM TYPE *</label>
                                    <select
                                        className="form-input"
                                        value={roomFormData.roomType}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, roomType: e.target.value })}
                                    >
                                        <option value="">-- Select Room Type --</option>
                                        {getAllRoomTypes().filter(t => t !== 'All Types').map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>BED TYPE *</label>
                                    <select
                                        className="form-input"
                                        value={roomFormData.bedType}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, bedType: e.target.value })}
                                    >
                                        {bedTypes.map(type => (
                                            <option key={type._id} value={type.name}>{type.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>STATUS *</label>
                                    <select
                                        className="form-input"
                                        value={roomFormData.status}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, status: e.target.value })}
                                    >
                                        {statusOptions.slice(1).map(status => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>PRICE PER NIGHT ({cs}) *</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="Enter Amount"
                                        value={roomFormData.price}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, price: e.target.value })}
                                    />
                                </div>



                                <div className="form-group">
                                    <label>ROOM CAPACITY *</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="1"
                                        value={roomFormData.capacity}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, capacity: e.target.value })}
                                    />
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="btn-cancel" onClick={() => setShowAddRoomModal(false)}>
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-submit"
                                    >
                                        Add Room
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )
            }

            {/* Edit Room Modal */}
            {
                showEditRoomModal && (
                    <div className="modal-overlay" onClick={() => setShowEditRoomModal(false)}>
                        <motion.div
                            className="modal-content room-modal"
                            onClick={(e) => e.stopPropagation()}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="modal-header">
                                <h2>Edit Room</h2>
                                <button className="modal-close" onClick={() => setShowEditRoomModal(false)}>
                                    ✕
                                </button>
                            </div>

                            {roomErrorMessage && (
                                <div className="error-alert">
                                    ⚠️ {roomErrorMessage}
                                </div>
                            )}

                            <form onSubmit={handleRoomSubmit}>
                                <div className="form-group">
                                    <label>ROOM NUMBER *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g., 101, 102"
                                        value={roomFormData.roomNumber}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, roomNumber: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>ROOM TYPE *</label>
                                    <select
                                        className="form-input"
                                        value={roomFormData.roomType}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, roomType: e.target.value })}
                                    >
                                        <option value="">-- Select Room Type --</option>
                                        {getAllRoomTypes().filter(t => t !== 'All Types').map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>BED TYPE *</label>
                                    <select
                                        className="form-input"
                                        value={roomFormData.bedType}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, bedType: e.target.value })}
                                    >
                                        {bedTypes.map(type => (
                                            <option key={type._id} value={type.name}>{type.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>STATUS *</label>
                                    <select
                                        className="form-input"
                                        value={roomFormData.status}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, status: e.target.value })}
                                    >
                                        {statusOptions.slice(1).map(status => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                </div>

                                {currentPricing && (
                                    <div className="pricing-info" style={{ borderRadius: '8px', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Allowed Range</span>
                                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b' }}>{cs}{currentPricing.minPrice} – {cs}{currentPricing.maxPrice}</span>
                                        </div>
                                        <div className="range-bar" style={{ height: '6px', background: '#e2e8f0', borderRadius: '10px', position: 'relative', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', background: '#ff4d4d', width: '100%' }}></div>
                                        </div>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>PRICE PER NIGHT ({cs}) *</label>
                                    <select
                                        className="form-input"
                                        value={priceOption}
                                        onChange={(e) => {
                                            const opt = e.target.value;
                                            setPriceOption(opt);
                                            if (currentPricing) {
                                                if (opt === 'min') setRoomFormData({ ...roomFormData, price: currentPricing.minPrice.toString() });
                                                else if (opt === 'mid') setRoomFormData({ ...roomFormData, price: Math.round((currentPricing.minPrice + currentPricing.maxPrice) / 2).toString() });
                                                else if (opt === 'max') setRoomFormData({ ...roomFormData, price: currentPricing.maxPrice.toString() });
                                            }
                                        }}
                                        style={{ marginBottom: '10px' }}
                                    >
                                        <option value="custom">Custom Price</option>
                                        {currentPricing && (
                                            <>
                                                <option value="min">Suggested Min ({cs}{currentPricing.minPrice})</option>
                                                <option value="mid">Mid Price ({cs}{Math.round((currentPricing.minPrice + currentPricing.maxPrice) / 2)})</option>
                                                <option value="max">Suggested Max ({cs}{currentPricing.maxPrice})</option>
                                            </>
                                        )}
                                    </select>

                                    <input
                                        type="number"
                                        className="form-input"
                                        style={{ borderColor: (currentPricing && (roomFormData.price < currentPricing.minPrice || roomFormData.price > currentPricing.maxPrice)) ? '#d41424' : '#e2e8f0' }}
                                        placeholder="Enter Amount"
                                        value={roomFormData.price}
                                        onChange={(e) => {
                                            setRoomFormData({ ...roomFormData, price: e.target.value });
                                            setPriceOption('custom');
                                        }}
                                        disabled={priceOption !== 'custom'}
                                    />





                                    {currentPricing && (roomFormData.price < currentPricing.minPrice || roomFormData.price > currentPricing.maxPrice) && (
                                        <p style={{ color: '#d41424', fontSize: '11px', marginTop: '5px', fontWeight: '600' }}>
                                            ⚠️ Price must be between {cs}{currentPricing.minPrice} and {cs}{currentPricing.maxPrice}
                                        </p>
                                    )}
                                </div>



                                <div className="form-group">
                                    <label>ROOM CAPACITY *</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="1"
                                        value={roomFormData.capacity}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, capacity: e.target.value })}
                                    />
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="btn-cancel" onClick={() => setShowEditRoomModal(false)}>
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-submit"
                                        disabled={currentPricing && (roomFormData.price < currentPricing.minPrice || roomFormData.price > currentPricing.maxPrice)}
                                        style={{ opacity: (currentPricing && (roomFormData.price < currentPricing.minPrice || roomFormData.price > currentPricing.maxPrice)) ? 0.5 : 1 }}
                                    >
                                        Update Room
                                    </button>
                                </div>
                            </form>
                        </motion.div >
                    </div >
                )
            }

            {/* QR Code Modal */}
            {
                showQRModal && qrModalData && (
                    <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
                        <motion.div
                            className="modal-content qr-modal-content"
                            onClick={(e) => e.stopPropagation()}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="qr-modal-header">
                                <div>
                                    <h2>Room QR Code</h2>
                                    <p className="qr-room-info">Room {qrModalData.room.roomNumber} – {qrModalData.room.roomType}</p>
                                </div>
                                <button
                                    className="qr-close-btn"
                                    onClick={() => setShowQRModal(false)}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="qr-modal-body">
                                {/* QR Code and Scan Instructions - Top Section */}
                                <div className="qr-top-section">
                                    <div className="qr-code-wrapper">
                                        <img src={qrModalData.qrCode} alt="Room QR Code" className="qr-code-img" />
                                    </div>
                                    <div className="qr-scan-instructions">
                                        <h4>Scan Instructions</h4>
                                        <p>To order from your Room {qrModalData.room.roomNumber}</p>
                                        <p className="qr-scan-highlight">Please scan this QR code on your mobile phone</p>
                                    </div>
                                </div>

                                {/* Room Details Section */}
                                <div className="qr-details-section">
                                    <div className="qr-detail-item">
                                        <span className="qr-detail-label">ROOM NUMBER:</span>
                                        <span className="qr-detail-value">{qrModalData.room.roomNumber}</span>
                                    </div>
                                    <div className="qr-detail-item">
                                        <span className="qr-detail-label">CATEGORY:</span>
                                        <span className="qr-detail-value">{qrModalData.room.roomType}</span>
                                    </div>
                                    <div className="qr-detail-item">
                                        <span className="qr-detail-label">STATUS:</span>
                                        <span className={`qr-status-badge status-${qrModalData.room.status?.toLowerCase()}`}>
                                            {qrModalData.room.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="qr-buttons-section">
                                    <button className="qr-action-btn btn-red" onClick={handleDownloadQR}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="7 10 12 15 17 10"></polyline>
                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                        </svg>
                                        QR
                                    </button>
                                    <button className="qr-action-btn btn-blue" onClick={() => window.print()}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                            <rect x="6" y="14" width="12" height="8"></rect>
                                        </svg>
                                        Print
                                    </button>
                                    <button className="qr-action-btn btn-green" onClick={() => handleViewQR(qrModalData.room)} disabled={qrLoading}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="23 4 23 10 17 10"></polyline>
                                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                                        </svg>
                                        Regenerate
                                    </button>
                                </div>

                                {/* Note Section */}
                                <div className="qr-note-section">
                                    <p><strong>Note:</strong> Please make sure to generate every room's QR separately.</p>
                                    <p>You can still use mobile QR scan, or open order flow directly from the link below.</p>
                                    {qrModalData?.qrData?.scanUrl && (
                                        <p>
                                            <a
                                                href={qrModalData.qrData.scanUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Click here to order
                                            </a>
                                        </p>
                                    )}
                                </div>

                                {/* Branding Footer */}
                                <div className="qr-branding-footer">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#94A3B8" stroke="#94A3B8" strokeWidth="2" />
                                        <path d="M2 17L12 22L22 17" stroke="#94A3B8" strokeWidth="2" />
                                        <path d="M2 12L12 17L22 12" stroke="#94A3B8" strokeWidth="2" />
                                    </svg>
                                    <span>CoaRoom</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )
            }

        </AdminLayout >
    );
};

export default AdminDashboard;
