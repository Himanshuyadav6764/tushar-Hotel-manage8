import React, { useState, useEffect } from 'react';
import API_URL, { apiCall } from '../../config/api';
import BookingActionsManager from '../../components/BookingActionsManager';
import './Customers.css';

const PRINT_MENU_WIDTH = 230;
const PRINT_MENU_HEIGHT = 232;

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const pickNumber = (...values) => {
    for (const value of values) {
        if (value === null || value === undefined || value === '') continue;
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
};

const normalizeStatus = (value) => {
    const rawStatus = String(value || '').toUpperCase();
    if (rawStatus === 'CHECKED-IN' || rawStatus === 'IN_HOUSE' || rawStatus === 'CHECKED IN') return 'IN_HOUSE';
    if (rawStatus === 'CHECKED-OUT' || rawStatus === 'CHECKED OUT') return 'CHECKED_OUT';
    if (rawStatus === 'CANCELLED') return 'CANCELLED';
    return 'RESERVED';
};

const mapBookingToCustomer = (booking) => {
    const status = normalizeStatus(booking.status);
    const roomNum = booking.rooms?.[0]?.roomNumber || booking.roomNumber || 'TBD';

    return {
        id: booking._id || booking.id,
        name: booking.guestName || 'N/A',
        email: booking.email || booking.guestEmail || 'N/A',
        phone: booking.mobileNumber || booking.guestPhone || 'N/A',
        room: roomNum,
        checkIn: booking.checkInDate,
        checkOut: booking.checkOutDate,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        status,
        bookingNumber: booking.bookingNumber || booking.bookingId || booking.reservationNumber || booking.confirmationNo || booking._id || booking.id,
        reservationType: booking.reservationType || booking.bookingType || booking.type || 'N/A',
        bookingSource: booking.bookingSource || booking.businessSource || booking.source || 'Direct',
        paymentMode: booking.paymentMode || booking.billing?.paymentMode || 'N/A',
        adults: toNumber(booking.adults ?? booking.noOfAdults ?? booking.totalAdults ?? 1, 1),
        children: toNumber(booking.children ?? booking.noOfChildren ?? booking.totalChildren ?? 0, 0),
        roomCharges: toNumber(booking.roomCharge ?? booking.roomCharges ?? booking.roomTotal ?? booking.tariff ?? booking.billing?.roomCharges, 0),
        extraCharges: toNumber(booking.extraCharges ?? booking.additionalCharges ?? booking.serviceCharges, 0),
        discount: toNumber(booking.discountAmount ?? booking.discount, 0),
        totalAmount: toNumber(booking.totalAmount ?? booking.grandTotal ?? booking.billing?.totalAmount, 0),
        paidAmount: toNumber(booking.paidAmount ?? booking.totalPaid ?? booking.advanceAmount, 0),
        balanceAmount: toNumber(
            booking.folioRemainingAmount
            ?? booking.remainingAmount
            ?? booking.balanceDue
            ?? booking.dueAmount
            ?? booking.balanceAmount
            ?? booking.billing?.balanceAmount,
            0
        ),
        idType: booking.idType || booking.identityType || 'N/A',
        idNumber: booking.idNumber || booking.identityNumber || booking.aadharNumber || 'N/A',
        address: booking.address || booking.city || 'N/A',
        nationality: booking.nationality || 'N/A',
        rawBooking: booking,
        isCurrent: status === 'IN_HOUSE',
        isPast: status === 'CHECKED_OUT'
    };
};

const Customers = () => {
    const [activeTab, setActiveTab] = useState('current');
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sortBy, setSortBy] = useState('latest');
    const [customersData, setCustomersData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [openPrintMenu, setOpenPrintMenu] = useState(null);
    const [activePrintAction, setActivePrintAction] = useState(null);
    const [activePrintBooking, setActivePrintBooking] = useState(null);
    const [detailsLoadingId, setDetailsLoadingId] = useState(null);

    // Fetch bookings from API
    const fetchBookingsData = async () => {
        try {
            setIsLoading(true);

            // Fetch from both endpoints to get all data
            const [bookingsResponse, reservationsResponse] = await Promise.all([
                apiCall(`/api/bookings/list`).catch(err => ({ ok: false })),
                apiCall(`/api/reservations/list`).catch(err => ({ ok: false }))
            ]);

            let allBookings = [];

            // Process Bookings API
            if (bookingsResponse.ok) {
                try {
                    const bookingData = await bookingsResponse.json();
                    if (bookingData.success && Array.isArray(bookingData.data)) {
                        allBookings = [...allBookings, ...bookingData.data];
                    }
                } catch (e) { console.error("Error parsing bookings data", e); }
            }

            // Process Reservations API
            if (reservationsResponse.ok) {
                try {
                    const reservationData = await reservationsResponse.json();
                    if (reservationData.success && Array.isArray(reservationData.data)) {
                        allBookings = [...allBookings, ...reservationData.data];
                    }
                } catch (e) { console.error("Error parsing reservations data", e); }
            }

            // Deduplicate by ID
            const uniqueMap = new Map();
            allBookings.forEach(item => {
                const id = item._id || item.id;
                if (id) uniqueMap.set(id, item);
            });
            const uniqueBookings = Array.from(uniqueMap.values());

            // Transform booking data to customer format
            const customers = uniqueBookings
                .map(mapBookingToCustomer)
                .filter(c => c.status === 'IN_HOUSE' || c.status === 'CHECKED_OUT');

            setCustomersData(customers);
        } catch (error) {
            console.error('Error fetching bookings:', error);
            setCustomersData([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Load customers data on mount
    useEffect(() => {
        fetchBookingsData();
    }, []);

    // Reset filters function
    const handleResetFilters = () => {
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
        setSortBy('latest');
        fetchBookingsData(); // Refresh data
    };

    // Calculate stay duration
    const calculateStayDuration = (checkIn, checkOut) => {
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'}`;
    };

    // Format date for display
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return 'N/A';
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    };

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return 'N/A';

        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    // Filter customers based on active tab
    const filteredByTab = customersData.filter(customer =>
        activeTab === 'current' ? customer.isCurrent : !customer.isCurrent
    );

    // Apply search filter
    const filteredCustomers = filteredByTab.filter(customer => {
        // Search filter
        const matchesSearch = !searchTerm ||
            customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            customer.phone.includes(searchTerm);

        // Date range filter
        const matchesDateRange = (() => {
            if (!startDate && !endDate) return true;

            const checkInDate = new Date(customer.checkIn);
            checkInDate.setHours(0, 0, 0, 0); // Reset time for accurate comparison

            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                return checkInDate >= start && checkInDate <= end;
            } else if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                return checkInDate >= start;
            } else if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                return checkInDate <= end;
            }
            return true;
        })();

        return matchesSearch && matchesDateRange;
    });

    // Sort customers
    const sortedCustomers = [...filteredCustomers].sort((a, b) => {
        if (sortBy === 'latest') {
            const getSortTime = (customer) => {
                const source = customer.updatedAt || customer.createdAt || customer.checkIn || customer.checkOut;
                const parsed = new Date(source).getTime();
                return Number.isFinite(parsed) ? parsed : 0;
            };

            return getSortTime(b) - getSortTime(a);
        }

        if (sortBy === 'name') {
            return a.name.localeCompare(b.name);
        } else if (sortBy === 'checkIn') {
            return new Date(b.checkIn) - new Date(a.checkIn);
        } else if (sortBy === 'checkOut') {
            return new Date(b.checkOut) - new Date(a.checkOut);
        }
        return 0;
    });

    useEffect(() => {
        if (selectedCustomerId === null) return;

        const hasSelectedCustomer = sortedCustomers.some((customer) => customer.id === selectedCustomerId);
        if (!hasSelectedCustomer) {
            setSelectedCustomerId(null);
        }
    }, [sortedCustomers, selectedCustomerId]);

    useEffect(() => {
        if (!pendingDeleteId) return;

        const timer = setTimeout(() => {
            setPendingDeleteId(null);
        }, 5000);

        return () => clearTimeout(timer);
    }, [pendingDeleteId]);

    const fetchLatestCustomerReservation = async (customerId) => {
        const currentCustomer = customersData.find((item) => item.id === customerId);
        if (!currentCustomer) return;

        setDetailsLoadingId(customerId);
        try {
            const [bookingResult, reservationResult] = await Promise.allSettled([
                apiCall(`/api/bookings/${customerId}`),
                apiCall(`/api/reservations/${customerId}`)
            ]);

            const readPayload = async (result) => {
                if (result.status !== 'fulfilled' || !result.value?.ok) return null;
                const payload = await result.value.json();
                return payload?.success ? payload.data : null;
            };

            const latestBooking = (await readPayload(bookingResult)) || (await readPayload(reservationResult));
            if (!latestBooking) return;

            const mergedBooking = { ...(currentCustomer.rawBooking || {}), ...latestBooking };
            const mappedCustomer = mapBookingToCustomer(mergedBooking);

            setCustomersData((prev) => prev.map((item) => (
                item.id === customerId
                    ? {
                        ...mappedCustomer,
                        id: item.id,
                        isCurrent: mappedCustomer.status === 'IN_HOUSE',
                        isPast: mappedCustomer.status === 'CHECKED_OUT'
                    }
                    : item
            )));
        } catch (error) {
            console.error('Error fetching latest reservation details:', error);
        } finally {
            setDetailsLoadingId(null);
        }
    };

    const getCustomerHistory = (customer) => {
        const phoneKey = String(customer?.phone || '').trim();
        const emailKey = String(customer?.email || '').trim().toLowerCase();
        const nameKey = String(customer?.name || '').trim().toLowerCase();

        return customersData
            .filter((item) => {
                const samePhone = phoneKey && phoneKey !== 'N/A' && String(item.phone || '').trim() === phoneKey;
                const sameEmail = emailKey && emailKey !== 'n/a' && String(item.email || '').trim().toLowerCase() === emailKey;
                const sameName = nameKey && nameKey !== 'n/a' && String(item.name || '').trim().toLowerCase() === nameKey;
                return samePhone || sameEmail || sameName;
            })
            .sort((a, b) => {
                const aTime = new Date(a.updatedAt || a.createdAt || a.checkIn || 0).getTime();
                const bTime = new Date(b.updatedAt || b.createdAt || b.checkIn || 0).getTime();
                return bTime - aTime;
            });
    };

    const handleViewDetails = async (customerId) => {
        const willOpen = selectedCustomerId !== customerId;
        setSelectedCustomerId((currentId) => (currentId === customerId ? null : customerId));
        if (willOpen) {
            await fetchLatestCustomerReservation(customerId);
        }
    };

    const buildPrintBooking = (customer) => {
        const source = customer?.rawBooking || {};
        const checkInDate = source.checkInDate || customer?.checkIn;
        const checkOutDate = source.checkOutDate || customer?.checkOut;

        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const computedNights = (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()))
            ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
            : 1;

        const roomType = source.roomType || source.rooms?.[0]?.roomType || source.rooms?.[0]?.categoryId || 'STANDARD';
        const billing = source.billing || {};
        const transactions = Array.isArray(source.transactions) ? source.transactions : [];

        const txSum = (matcher) => transactions
            .filter((tx) => matcher((`${tx.particulars || ''} ${tx.description || ''} ${tx.notes || ''}`).toLowerCase(), tx))
            .reduce((sum, tx) => sum + (Math.abs(Number(tx.amount)) || 0), 0);

        const txRoomCharges = txSum((text, tx) => {
            const type = String(tx.type || '').toLowerCase();
            return type === 'charge' && (text.includes('room charge') || text.includes('room tariff') || text.includes('room rent') || text.includes('accommodation'));
        });

        const txServiceCharges = txSum((text, tx) => {
            const type = String(tx.type || '').toLowerCase();
            return type === 'charge' && text.includes('service charge');
        });

        const txDiscount = txSum((text, tx) => {
            const type = String(tx.type || '').toLowerCase();
            return type === 'discount' || text.includes('discount');
        });

        const txPayments = txSum((_, tx) => String(tx.type || '').toLowerCase() === 'payment');

        const roomRate = pickNumber(
            source.ratePerNight,
            source.roomRate,
            source.pricePerNight,
            billing.roomRate,
            billing.pricePerNight,
            source.rooms?.[0]?.ratePerNight,
            source.rooms?.[0]?.roomRate
        ) ?? 0;

        const discountAmount = pickNumber(
            source.discount,
            source.discountAmount,
            source.totalDiscount,
            billing.discount,
            billing.discountAmount,
            txDiscount,
            customer?.discount
        ) ?? 0;

        const serviceCharge = pickNumber(
            source.serviceCharge,
            source.serviceChargeAmount,
            source.serviceCharges,
            billing.serviceCharge,
            billing.serviceChargeAmount,
            txServiceCharges,
            customer?.extraCharges
        ) ?? 0;

        const taxAmount = pickNumber(
            source.tax,
            source.taxAmount,
            billing.tax,
            billing.taxAmount,
            customer?.taxAmount
        ) ?? 0;

        const storedTotalAmount = pickNumber(
            billing.totalAmount,
            source.totalAmount,
            source.grandTotal,
            source.amount,
            customer?.totalAmount
        );

        const sourceRoomCharges = pickNumber(
            source.roomCharges,
            source.baseRoomCharges,
            billing.roomCharges,
            billing.roomChargesAmount,
            txRoomCharges
        );

        const derivedRoomChargesFromRate = roomRate > 0 ? (roomRate * computedNights) : 0;
        const inferredRoomCharges = storedTotalAmount !== undefined
            ? Math.max(Number(storedTotalAmount) - serviceCharge - taxAmount + discountAmount, 0)
            : 0;

        const roomCharges = (sourceRoomCharges !== undefined && sourceRoomCharges > 0)
            ? sourceRoomCharges
            : (derivedRoomChargesFromRate > 0 ? derivedRoomChargesFromRate : inferredRoomCharges);

        const totalAmount = storedTotalAmount ?? Math.max(roomCharges + serviceCharge + taxAmount - discountAmount, 0);

        const paidAmount = pickNumber(
            billing.paidAmount,
            source.paidAmount,
            source.totalPaid,
            source.advanceAmount,
            txPayments,
            customer?.paidAmount
        ) ?? 0;

        const balanceAmount = pickNumber(
            billing.balanceAmount,
            source.balanceAmount,
            source.remainingAmount,
            source.dueAmount,
            customer?.balanceAmount
        ) ?? Math.max(totalAmount - paidAmount, 0);

        return {
            ...source,
            id: source.id || source._id || customer?.id,
            _id: source._id || source.id || customer?.id,
            bookingId: source.bookingId || source.bookingNumber || source.reservationNumber || customer?.bookingNumber || customer?.id,
            guestName: source.guestName || customer?.name,
            email: source.email || source.guestEmail || customer?.email,
            mobileNumber: source.mobileNumber || source.guestPhone || customer?.phone,
            roomNumber: source.roomNumber || source.rooms?.[0]?.roomNumber || customer?.room,
            roomType,
            checkInDate,
            checkOutDate,
            nights: source.nights || source.numberOfNights || computedNights,
            numberOfNights: source.numberOfNights || source.nights || computedNights,
            numberOfGuests: source.numberOfGuests || source.adults || customer?.adults || 1,
            adults: source.adults ?? customer?.adults ?? 1,
            children: source.children ?? customer?.children ?? 0,
            roomCharges,
            discount: discountAmount,
            discountAmount,
            serviceCharge,
            serviceChargeAmount: serviceCharge,
            tax: taxAmount,
            taxAmount,
            totalAmount,
            grandTotal: totalAmount,
            paidAmount,
            balanceAmount,
            billing: {
                ...billing,
                roomRate,
                roomCharges,
                roomChargesAmount: roomCharges,
                discount: discountAmount,
                discountAmount,
                serviceCharge,
                serviceChargeAmount: serviceCharge,
                tax: taxAmount,
                taxAmount,
                totalAmount,
                paidAmount,
                balanceAmount
            },
            additionalGuests: Array.isArray(source.additionalGuests) ? source.additionalGuests : [],
            visitors: Array.isArray(source.visitors) ? source.visitors : [],
            rooms: Array.isArray(source.rooms) && source.rooms.length > 0
                ? source.rooms
                : [{
                    roomNumber: source.roomNumber || customer?.room,
                    roomType,
                    categoryId: roomType,
                    ratePerNight: roomRate || (toNumber(customer?.roomCharges, 0) / Math.max(1, computedNights))
                }]
        };
    };

    const handlePrintAction = (action, customer) => {
        if (!customer) return;

        const bookingForPrint = buildPrintBooking(customer);
        setActivePrintAction(action);
        setActivePrintBooking(bookingForPrint);
        setOpenPrintMenu(null);
    };

    const closePrintDrawer = () => {
        setActivePrintAction(null);
        setActivePrintBooking(null);
    };

    const handlePrintMenuToggle = (event, customerId) => {
        event.stopPropagation();

        const rect = event.currentTarget.getBoundingClientRect();
        const leftBoundary = 12;
        const rightBoundary = window.innerWidth - PRINT_MENU_WIDTH - 12;

        const left = Math.min(Math.max(rect.right - PRINT_MENU_WIDTH, leftBoundary), rightBoundary);
        const openUpward = rect.bottom + PRINT_MENU_HEIGHT > window.innerHeight - 12;
        const top = openUpward ? rect.top - PRINT_MENU_HEIGHT - 8 : rect.bottom + 8;

        setOpenPrintMenu((current) => {
            if (current?.customerId === customerId) return null;
            return { customerId, left, top };
        });
    };

    const handleCheckOut = async (id) => {
        try {
            const response = await apiCall(`/api/bookings/status/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: 'CHECKED_OUT' }),
            });
            const data = await response.json();
            if (data.success) {
                fetchBookingsData(); // Refresh data
            }
        } catch (error) {
            console.error('Error checking out customer:', error);
        }
    };

    const handleDelete = async (id) => {
        try {
            const response = await apiCall(`/api/bookings/delete/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (data.success) {
                setPendingDeleteId(null);
                fetchBookingsData(); // Refresh data
            }
        } catch (error) {
            console.error('Error deleting customer:', error);
            setPendingDeleteId(null);
        }
    };

    useEffect(() => {
        if (!openPrintMenu) return undefined;

        const closeMenu = () => setOpenPrintMenu(null);
        window.addEventListener('resize', closeMenu);
        window.addEventListener('scroll', closeMenu, true);

        return () => {
            window.removeEventListener('resize', closeMenu);
            window.removeEventListener('scroll', closeMenu, true);
        };
    }, [openPrintMenu]);

    return (
        <div className="customers-page">
            <div className="customers-header">
                <h1>👥 Customers</h1>
                <button
                    className="refresh-btn"
                    onClick={handleResetFilters}
                    title="Refresh & Reset Filters"
                >
                    🔄
                </button>
            </div>

            {/* Navigation Bar */}
            <div className="customers-navbar">
                {/* Tabs */}
                <div className="customers-tabs">
                    <button
                        className={`customers-tab ${activeTab === 'current' ? 'active' : ''}`}
                        onClick={() => setActiveTab('current')}
                    >
                        Current Guests
                    </button>
                    <button
                        className={`customers-tab ${activeTab === 'past' ? 'active' : ''}`}
                        onClick={() => setActiveTab('past')}
                    >
                        Past Guests
                    </button>
                </div>

                {/* Filters */}
                <div className="customers-filters">
                    <div className="search-filter">
                        <input
                            type="text"
                            placeholder="Search by name, phone or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                            className="customers-search-input"
                        />
                    </div>

                    <div className="date-filter">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="date-input"
                            id="start-date-input"
                        />
                        <label htmlFor="start-date-input" className="calendar-icon">📅</label>
                    </div>

                    <div className="date-filter">
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="date-input"
                            id="end-date-input"
                        />
                        <label htmlFor="end-date-input" className="calendar-icon">📅</label>
                    </div>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="sort-select"
                    >
                        <option value="latest">Sort by Latest</option>
                        <option value="name">Sort by Name</option>
                        <option value="checkIn">Sort by Check-in</option>
                        <option value="checkOut">Sort by Check-out</option>
                    </select>

                    <button className="result-count" onClick={handleResetFilters} title="Refresh">
                        {sortedCustomers.length}
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="loading-state">
                    <div className="loader"></div>
                    <p>Loading customers data...</p>
                </div>
            )}

            {/* No Customers Found Message */}
            {!isLoading && sortedCustomers.length === 0 && (
                <div className="no-customers-alert">
                    <span className="alert-icon">✕</span>
                    <span className="alert-text">No customers found.</span>
                </div>
            )}

            {/* Customers Table */}
            {!isLoading && sortedCustomers.length > 0 && (
                <div className="customers-table-container">
                    <table className="customers-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>GUEST DETAILS</th>
                                <th>ROOM</th>
                                <th>STAY DURATION</th>
                                <th>STATUS</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCustomers.map((customer, index) => (
                                <React.Fragment key={customer.id}>
                                    <tr className={selectedCustomerId === customer.id ? 'customer-row-active' : ''}>
                                        <td>
                                            <span className="customer-serial">{index + 1}</span>
                                        </td>
                                        <td>
                                            <div className="guest-details">
                                                <span className="guest-name">{customer.name}</span>
                                                <span className="guest-email">{customer.email}</span>
                                                <span className="guest-phone">{customer.phone}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="room-number">Room {customer.room}</span>
                                        </td>
                                        <td>
                                            <div className="stay-duration">
                                                <span className="duration-text">
                                                    {calculateStayDuration(customer.checkIn, customer.checkOut)}
                                                </span>
                                                <span className="duration-dates">
                                                    {formatDate(customer.checkIn)} - {formatDate(customer.checkOut)}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${customer.status === 'IN_HOUSE' ? 'checked-in' : 'checked-out'}`}>
                                                {customer.status === 'IN_HOUSE' ? 'CHECKED IN' : 'CHECKED OUT'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="customer-actions">
                                                <button
                                                    className="action-btn view-btn"
                                                    onClick={() => handleViewDetails(customer.id)}
                                                    title="Show Details"
                                                >
                                                    👁️
                                                </button>
                                                <button
                                                    className="action-btn delete-btn"
                                                    onClick={() => setPendingDeleteId(customer.id)}
                                                    title="Delete"
                                                >
                                                    🗑️
                                                </button>
                                                <button
                                                    className="action-btn customer-print-btn"
                                                    onClick={(event) => handlePrintMenuToggle(event, customer.id)}
                                                    title="Print"
                                                >
                                                    🖨️
                                                </button>
                                                {pendingDeleteId === customer.id && (
                                                    <div className="delete-inline-warning">
                                                        <span>Are you sure want to delete?</span>
                                                        <div className="delete-inline-actions">
                                                            <button
                                                                className="delete-inline-yes"
                                                                onClick={() => handleDelete(customer.id)}
                                                                title="Yes"
                                                            >
                                                                Yes
                                                            </button>
                                                            <button
                                                                className="delete-inline-no"
                                                                onClick={() => setPendingDeleteId(null)}
                                                                title="No"
                                                            >
                                                                No
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>

                                    {selectedCustomerId === customer.id && (
                                        <tr className="inline-details-row">
                                            <td colSpan={6}>
                                                <div className="inline-customer-card">
                                                    <div className="selected-card-head inline-card-head">
                                                        <div>
                                                            <p className="selected-card-kicker">Customer Details</p>
                                                            <h3>{customer.name}</h3>
                                                        </div>
                                                        <span className={`status-badge ${customer.status === 'IN_HOUSE' ? 'checked-in' : 'checked-out'}`}>
                                                            {customer.status === 'IN_HOUSE' ? 'CHECKED IN' : 'CHECKED OUT'}
                                                        </span>
                                                    </div>

                                                    <div className="selected-card-grid">
                                                        <div className="selected-card-item">
                                                            <span>Email</span>
                                                            <strong>{customer.email}</strong>
                                                        </div>
                                                        <div className="selected-card-item">
                                                            <span>Phone</span>
                                                            <strong>{customer.phone}</strong>
                                                        </div>
                                                        <div className="selected-card-item">
                                                            <span>Room</span>
                                                            <strong>Room {customer.room}</strong>
                                                        </div>
                                                        <div className="selected-card-item">
                                                            <span>Stay Duration</span>
                                                            <strong>{calculateStayDuration(customer.checkIn, customer.checkOut)}</strong>
                                                        </div>
                                                        <div className="selected-card-item">
                                                            <span>Check-in</span>
                                                            <strong>{formatDateTime(customer.checkIn)}</strong>
                                                        </div>
                                                        <div className="selected-card-item">
                                                            <span>Check-out</span>
                                                            <strong>{formatDateTime(customer.checkOut)}</strong>
                                                        </div>
                                                    </div>

                                                    {detailsLoadingId === customer.id && (
                                                        <p className="customer-detail-loading">Refreshing latest reservation details...</p>
                                                    )}

                                                    <div className="selected-section">
                                                        <p className="selected-section-title">Reservation Details</p>
                                                        <div className="selected-card-grid">
                                                            <div className="selected-card-item">
                                                                <span>Booking Ref</span>
                                                                <strong>{customer.bookingNumber || customer.id}</strong>
                                                            </div>
                                                            <div className="selected-card-item">
                                                                <span>Reservation Type</span>
                                                                <strong>{customer.reservationType || 'N/A'}</strong>
                                                            </div>
                                                            <div className="selected-card-item">
                                                                <span>Booking Source</span>
                                                                <strong>{customer.bookingSource || 'Direct'}</strong>
                                                            </div>
                                                            <div className="selected-card-item">
                                                                <span>Total Amount</span>
                                                                <strong>Rs {toNumber(customer.totalAmount, 0).toLocaleString('en-IN')}</strong>
                                                            </div>
                                                            <div className="selected-card-item">
                                                                <span>Total Paid</span>
                                                                <strong>Rs {toNumber(customer.paidAmount, 0).toLocaleString('en-IN')}</strong>
                                                            </div>
                                                            <div className="selected-card-item">
                                                                <span>Remaining Due</span>
                                                                <strong>Rs {Math.max(0, toNumber(customer.balanceAmount, 0)).toLocaleString('en-IN')}</strong>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="selected-section">
                                                        <p className="selected-section-title">Past & Current Reservations</p>
                                                        <div className="reservation-history-list">
                                                            {getCustomerHistory(customer).slice(0, 6).map((item) => (
                                                                <div key={`${customer.id}-${item.id}-${item.checkIn || item.createdAt}`} className="reservation-history-item">
                                                                    <div className="reservation-history-main">
                                                                        <strong>{item.status === 'IN_HOUSE' ? 'Current Stay' : 'Past Stay'}</strong>
                                                                        <span>{formatDate(item.checkIn)} - {formatDate(item.checkOut)}</span>
                                                                    </div>
                                                                    <div className="reservation-history-meta">
                                                                        <span>Room {item.room || 'TBD'}</span>
                                                                        <span className={`history-chip ${item.status === 'IN_HOUSE' ? 'chip-current' : 'chip-past'}`}>
                                                                            {item.status === 'IN_HOUSE' ? 'CURRENT' : 'PAST'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {openPrintMenu && (() => {
                const selectedCustomer = sortedCustomers.find((customer) => customer.id === openPrintMenu.customerId);
                if (!selectedCustomer) return null;

                return (
                    <>
                        <div className="customer-print-menu-backdrop" onClick={() => setOpenPrintMenu(null)}></div>
                        <div
                            className="customer-print-menu"
                            style={{ left: `${openPrintMenu.left}px`, top: `${openPrintMenu.top}px` }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <button className="customer-print-menu-item" onClick={() => handlePrintAction('print-summary', selectedCustomer)}>
                                <span className="customer-print-menu-icon">📄</span>
                                <span>Print Summary</span>
                            </button>
                            <button className="customer-print-menu-item" onClick={() => handlePrintAction('print-invoice', selectedCustomer)}>
                                <span className="customer-print-menu-icon">🧾</span>
                                <span>Print Invoice</span>
                            </button>
                            <button className="customer-print-menu-item" onClick={() => handlePrintAction('print-grc', selectedCustomer)}>
                                <span className="customer-print-menu-icon">📋</span>
                                <span>Print GRC</span>
                            </button>
                            <button className="customer-print-menu-item" onClick={() => handlePrintAction('print-grc-all', selectedCustomer)}>
                                <span className="customer-print-menu-icon">🗂️</span>
                                <span>Print GRC All</span>
                            </button>
                        </div>
                    </>
                );
            })()}

            {activePrintAction && activePrintBooking && (
                <BookingActionsManager
                    isOpen={Boolean(activePrintAction && activePrintBooking)}
                    onClose={closePrintDrawer}
                    actionType={activePrintAction}
                    booking={activePrintBooking}
                    onSuccess={() => {}}
                />
            )}
        </div>
    );
};

export default Customers;

