import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    BedDouble,
    CalendarCheck,
    CheckCircle,
    Users,
    Clock,
    LogIn,
    LogOut
} from 'lucide-react';
import API_URL, { apiCall } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { hasModuleAccess, MODULES } from '../../config/rbac';
import './DashboardHome.css';

const DashboardHome = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isStaff = user?.role === 'staff';
    const canViewRooms = hasModuleAccess(user, MODULES.ROOMS);
    const canViewReservations = hasModuleAccess(user, MODULES.RESERVATIONS) || hasModuleAccess(user, MODULES.RESERVATION_CARD);
    const canViewHousekeeping = hasModuleAccess(user, 'housekeeping');
    const canViewFood = hasModuleAccess(user, MODULES.FOOD_ORDER)
        || hasModuleAccess(user, MODULES.FOOD_MENU)
        || hasModuleAccess(user, MODULES.GUEST_MEAL_SERVICE);
    const canViewCashier = hasModuleAccess(user, MODULES.CASHIER_SECTION)
        || hasModuleAccess(user, MODULES.CASHIER_LOGS)
        || hasModuleAccess(user, MODULES.PAYMENT_LOGS);
    const canViewRevenueAnalytics = canViewCashier || canViewFood || canViewReservations;

    const showRoomStats = canViewRooms;
    const showBookingStats = canViewReservations;
    const showBasicCharts = canViewRooms;

    const showArrivalCard = canViewReservations;
    const showDepartureCard = canViewReservations;
    const showGuestInHouseCard = canViewReservations;
    const showRoomStatusCard = canViewRooms;
    const showTopDonuts = showArrivalCard || showDepartureCard || showGuestInHouseCard || showRoomStatusCard;

    const showOccupancyGauges = canViewRooms;
    const showUpcomingReservations = canViewReservations;
    const showMiddleSection = showOccupancyGauges || showUpcomingReservations;

    const showRevenueSection = !isStaff && canViewRevenueAnalytics;
    const showHousekeepingChart = showRevenueSection && canViewHousekeeping;
    const showAvailabilityChart = showRevenueSection && canViewRooms;

    const hasAnyVisibleSection = showRoomStats
        || showBookingStats
        || showBasicCharts
        || showTopDonuts
        || showMiddleSection
        || showRevenueSection;
    const [roomStats, setRoomStats] = useState({
        total: 0,
        occupied: 0,
        booked: 0,
        available: 0
    });

    const [guestStats, setGuestStats] = useState({
        currentGuests: 0,
        todayCheckIns: 0,
        todayCheckOuts: 0,
        upcomingBookings: 0
    });

    const [occupancyRate, setOccupancyRate] = useState(0);

    // New state for advanced dashboard metrics
    const [arrivalStats, setArrivalStats] = useState({
        total: 0,
        pending: 0,
        arrived: 0
    });

    const [departureStats, setDepartureStats] = useState({
        total: 0,
        pending: 0,
        checkOut: 0
    });

    const [guestInHouse, setGuestInHouse] = useState({
        total: 0,
        adults: 0,
        children: 0
    });

    const [advancedOccupancy, setAdvancedOccupancy] = useState({
        today: 0,
        tomorrow: 0,
        thisMonth: 0,
        todayOccupied: 0,
        todayBooked: 0,
        tomorrowBooked: 0,
        monthBooked: 0,
        monthAvailable: 0
    });

    const [upcomingReservations, setUpcomingReservations] = useState({
        today: 0,
        tomorrow: 0,
        next7Days: 0
    });

    const [revenue, setRevenue] = useState({
        total: 0,
        today: 0,
        yesterday: 0,
        avgDailyRate: 0,
        yesterdayAvgRate: 0,
        receipts: {
            cash: 0,
            card: 0,
            diCard: 0,
            bank: 0
        }
    });

    const [housekeepingStats, setHousekeepingStats] = useState({
        clean: 0,
        dirty: 0,
        inspection: 0
    });

    const [roomAvailability, setRoomAvailability] = useState([]);
    const [revenueBreakup, setRevenueBreakup] = useState({
        rooms: 0,
        restaurant: 0,
        fragments: 0,
        other: 0
    });

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

    const isSameDayKey = (value, dayKey) => getDateCandidates(value).includes(dayKey);

    const getBookingDayKey = (value) => {
        const candidates = getDateCandidates(value);
        return candidates.length > 0 ? candidates[0] : null;
    };

    const normalizePaymentMethod = (method) => {
        const raw = String(method || '').trim().toLowerCase();
        if (!raw) return 'cash';
        if (raw.includes('cash')) return 'cash';
        if (raw.includes('card') || raw.includes('debit') || raw.includes('credit')) return 'card';
        if (raw.includes('upi') || raw.includes('online') || raw.includes('wallet')) return 'upi';
        if (raw.includes('bank') || raw.includes('transfer') || raw.includes('neft') || raw.includes('rtgs') || raw.includes('imps')) return 'bank';
        return 'cash';
    };

    useEffect(() => {
        // Initial load
        calculateStatistics();

        // Auto-refresh every 60 seconds to show real-time updates
        const interval = setInterval(() => {
            calculateStatistics();
        }, 60000);

        // Cleanup interval on unmount
        return () => clearInterval(interval);
    }, []);

    const normalizeBookingStatus = (status) => String(status || '').trim().toUpperCase().replace(/-/g, '_').replace(/\s+/g, '_');
    const isCheckedIn = (status) => ['CHECKED_IN', 'CHECKEDIN', 'IN_HOUSE'].includes(normalizeBookingStatus(status));
    const isCheckedOut = (status) => ['CHECKED_OUT', 'CHECKEDOUT'].includes(normalizeBookingStatus(status));
    const isUpcoming = (status) => ['UPCOMING', 'CONFIRMED', 'PENDING', 'RESERVED'].includes(normalizeBookingStatus(status));
    const isCancelledLike = (status) => ['CANCELLED', 'CANCELED', 'NO_SHOW', 'NOSHOW', 'VOID', 'VOIDED'].includes(normalizeBookingStatus(status));

    const calculateStatistics = async () => {
        try {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalDateKey(yesterday);

            // 1. Fetch all required data in parallel
            const [roomsRes, bookingsRes, reservationsRes, reportRes, ordersRes, transactionsRes, yesterdayReportRes] = await Promise.all([
                apiCall(`/api/rooms/list`),
                apiCall(`/api/bookings/list`),
                apiCall(`/api/reservations/list`),
                apiCall(`/api/cashier/report`),
                apiCall(`/api/guest-meal/orders`),
                apiCall(`/api/cashier/transactions`),
                apiCall(`/api/cashier/report?startDate=${encodeURIComponent(yesterdayStr)}&endDate=${encodeURIComponent(yesterdayStr)}`)
            ]);

            const [roomsData, bookingsData, reservationsData, reportData, ordersData, transactionsData, yesterdayReportData] = await Promise.all([
                roomsRes.json(),
                bookingsRes.json(),
                reservationsRes.json(),
                reportRes.json(),
                ordersRes.json(),
                transactionsRes.json(),
                yesterdayReportRes.json()
            ]);

            const rooms = roomsData.success ? roomsData.data : [];
            const bookings = bookingsData.success ? bookingsData.data : [];
            const reservations = reservationsData.success ? reservationsData.data : [];

            // Merge booking + reservation records for dashboard counts to reflect actual operational data.
            const mergedById = new Map();
            bookings.forEach((b) => {
                const key = String(b?._id || b?.id || '').trim();
                if (!key) return;
                mergedById.set(key, {
                    _id: key,
                    status: b?.status,
                    checkInDate: b?.checkInDate,
                    checkOutDate: b?.checkOutDate,
                    adults: b?.adults ?? b?.duration?.adults,
                    children: b?.children ?? b?.duration?.children,
                    rooms: Array.isArray(b?.rooms) ? b.rooms : []
                });
            });
            reservations.forEach((r) => {
                const key = String(r?._id || r?.id || '').trim();
                if (!key || mergedById.has(key)) return;
                mergedById.set(key, {
                    _id: key,
                    status: r?.status,
                    checkInDate: r?.checkInDate,
                    checkOutDate: r?.checkOutDate,
                    adults: r?.adults,
                    children: r?.children,
                    rooms: r?.roomNumber ? [{ roomNumber: r.roomNumber, adults: r?.adults, children: r?.children }] : []
                });
            });
            const statsRecords = Array.from(mergedById.values());
            const activeStatsRecords = statsRecords.filter((b) => !isCancelledLike(b?.status));
            const report = reportData.success ? reportData.data : null;
            const yesterdayReport = yesterdayReportData.success ? yesterdayReportData.data : null;
            const allOrders = ordersData.success ? ordersData.data : [];
            const allTransactions = transactionsData.success ? transactionsData.data : [];

            // ---- Date helpers ----
            const todayStr = getLocalDateKey(now);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = getLocalDateKey(tomorrow);
            const nextWeek = new Date(now);
            nextWeek.setDate(nextWeek.getDate() + 7);
            const nextWeekStr = getLocalDateKey(nextWeek);
            const thisMonthStart = getLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
            const thisMonthEnd = getLocalDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

            // ---- 2. Room Statistics ----
            const total = rooms.length;
            const occupied = rooms.filter(r => r.status === 'Occupied').length;
            const booked = rooms.filter(r => r.status === 'Booked' || r.status === 'Reserved').length;
            const maintenance = rooms.filter(r => r.status === 'Maintenance' || r.status === 'Under Maintenance').length;
            const cleaning = rooms.filter(r => r.status === 'Cleaning').length;
            const available = rooms.filter(r => r.status === 'Available' || r.status === 'Vacant').length;

            setRoomStats({ total, occupied, booked, available });

            // ---- 3. Occupancy Rate ----
            const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;
            setOccupancyRate(rate);

            // ---- 4. Guest & Booking Statistics ----
            const checkedInBookings = activeStatsRecords.filter((b) => isCheckedIn(b.status));
            const currentGuests = checkedInBookings.length;

            const pendingArrivals = activeStatsRecords.filter((b) => {
                const cin = getBookingDayKey(b.checkInDate);
                return cin === todayStr && isUpcoming(b.status);
            }).length;
            const arrivedToday = activeStatsRecords.filter((b) => {
                const cin = getBookingDayKey(b.checkInDate);
                return cin === todayStr && isCheckedIn(b.status);
            }).length;
            const todayCheckIns = pendingArrivals + arrivedToday;

            const pendingDepartures = activeStatsRecords.filter((b) => {
                const cout = getBookingDayKey(b.checkOutDate);
                return cout && cout <= todayStr && isCheckedIn(b.status);
            }).length;
            const departedToday = statsRecords.filter((b) => {
                const cout = getBookingDayKey(b.checkOutDate);
                return cout === todayStr && isCheckedOut(b.status);
            }).length;
            const todayCheckOuts = pendingDepartures + departedToday;

            const upcomingBookings = activeStatsRecords.filter((b) => isUpcoming(b.status)).length;

            setGuestStats({ currentGuests, todayCheckIns, todayCheckOuts, upcomingBookings });

            // ---- 5. Housekeeping Stats ----
            const cleanRooms = rooms.filter(r => r.housekeepingStatus === 'clean' || r.housekeepingStatus === 'Clean').length;
            const dirtyRooms = rooms.filter(r => r.housekeepingStatus === 'dirty' || r.housekeepingStatus === 'Dirty').length;
            const inspectionRooms = rooms.filter(r =>
                r.housekeepingStatus === 'inspection' || r.housekeepingStatus === 'Inspection' ||
                r.housekeepingStatus === 'pending' || r.housekeepingStatus === 'Pending'
            ).length;
            // Rooms without a housekeeping status assigned
            const unassigned = total - cleanRooms - dirtyRooms - inspectionRooms;

            setHousekeepingStats({
                clean: cleanRooms,
                dirty: dirtyRooms,
                inspection: inspectionRooms + (unassigned > 0 ? unassigned : 0)
            });

            // ---- 6. Arrival & Departure Split ----
            setArrivalStats({
                total: pendingArrivals,
                pending: pendingArrivals,
                arrived: 0
            });

            setDepartureStats({
                total: pendingDepartures + departedToday,
                pending: pendingDepartures,
                checkOut: departedToday
            });

            // ---- 7. Guest In House ----
            const adultsInHouse = checkedInBookings.reduce((sum, b) => {
                if (b.duration?.adults) return sum + parseInt(b.duration.adults);
                if (b.adults) return sum + parseInt(b.adults);
                // Check multi-room bookings
                if (b.rooms?.length) {
                    return sum + b.rooms.reduce((s, r) => {
                        const roomAdults = parseInt(r.adults ?? r.adultsCount ?? r.numberOfAdults);
                        return s + (Number.isFinite(roomAdults) ? roomAdults : 1);
                    }, 0);
                }
                return sum + 1;
            }, 0);
            const childrenInHouse = checkedInBookings.reduce((sum, b) => {
                if (b.duration?.children) return sum + parseInt(b.duration.children);
                if (b.children) return sum + parseInt(b.children);
                if (b.rooms?.length) {
                    return sum + b.rooms.reduce((s, r) => {
                        const roomChildren = parseInt(r.children ?? r.childrenCount ?? r.numberOfChildren);
                        return s + (Number.isFinite(roomChildren) ? roomChildren : 0);
                    }, 0);
                }
                return sum;
            }, 0);
            setGuestInHouse({
                total: adultsInHouse + childrenInHouse,
                adults: adultsInHouse,
                children: childrenInHouse
            });

            // ---- 8. Advanced Occupancy (Today, Tomorrow, Month) ----
            // Tomorrow: count bookings whose stay period includes tomorrow
            const tomorrowOccupied = activeStatsRecords.filter(b => {
                if (isCheckedOut(b.status)) return false;
                const cin = getBookingDayKey(b.checkInDate);
                const cout = getBookingDayKey(b.checkOutDate);
                return cin && cout && tomorrowStr >= cin && tomorrowStr < cout;
            }).length;

            // Month: count unique room-nights booked this month
            const monthRoomNights = activeStatsRecords.reduce((count, b) => {
                const cin = getBookingDayKey(b.checkInDate);
                const cout = getBookingDayKey(b.checkOutDate);
                if (!cin || !cout) return count;
                // Count overlapping nights in this month
                const stayStart = cin > thisMonthStart ? cin : thisMonthStart;
                const stayEnd = cout < thisMonthEnd ? cout : thisMonthEnd;
                if (stayStart < stayEnd) {
                    const nights = Math.ceil((new Date(stayEnd) - new Date(stayStart)) / (1000 * 60 * 60 * 24));
                    return count + nights;
                }
                return count;
            }, 0);

            const monthOccupancyRate = total > 0 ? Math.round((monthRoomNights / (total * daysInMonth)) * 100) : 0;
            const tomorrowRate = total > 0 ? Math.round((tomorrowOccupied / total) * 100) : 0;

            setAdvancedOccupancy({
                today: rate,
                tomorrow: tomorrowRate,
                thisMonth: Math.min(monthOccupancyRate, 100),
                todayOccupied: occupied,
                todayBooked: booked,
                tomorrowBooked: tomorrowOccupied,
                monthBooked: monthRoomNights,
                monthAvailable: total * daysInMonth - monthRoomNights
            });

            // ---- 9. Upcoming Reservations ----
            const todayArrivals = activeStatsRecords.filter(b =>
                getBookingDayKey(b.checkInDate) === todayStr && isUpcoming(b.status)
            ).length;
            const tomorrowArrivals = activeStatsRecords.filter(b =>
                getBookingDayKey(b.checkInDate) === tomorrowStr
            ).length;
            const next7Arrivals = activeStatsRecords.filter(b => {
                const cin = getBookingDayKey(b.checkInDate);
                return cin > todayStr && cin <= nextWeekStr;
            }).length;

            setUpcomingReservations({
                today: todayArrivals,
                tomorrow: tomorrowArrivals,
                next7Days: next7Arrivals
            });

            // ---- 10. Revenue Data ----
            const isOrderSettled = (order) => {
                const status = String(order?.status || '').toLowerCase();
                const paymentStatus = String(order?.paymentStatus || '').toLowerCase();
                return (
                    ['closed', 'billed', 'pending payment', 'completed', 'settled', 'served'].includes(status) ||
                    ['completed', 'success', 'settled', 'paid'].includes(paymentStatus)
                );
            };

            const getOrderDateKey = (order) => {
                const stamp = order?.closedAt || order?.billedAt || order?.updatedAt || order?.createdAt;
                return stamp ? getLocalDateKey(stamp) : null;
            };

            const sumBookingPaymentsByDay = (dayKey) => bookings.reduce((sum, booking) => {
                const txns = Array.isArray(booking?.transactions) ? booking.transactions : [];
                const paid = txns
                    .filter((t) => String(t?.type || '').toLowerCase() === 'payment' && isSameDayKey(t.date || booking.updatedAt || booking.createdAt, dayKey))
                    .reduce((s, t) => s + Math.abs(Number(t?.amount) || 0), 0);
                return sum + paid;
            }, 0);

            const sumExtraChargesByDay = (dayKey) => bookings.reduce((sum, booking) => {
                const txns = Array.isArray(booking?.transactions) ? booking.transactions : [];
                const extra = txns
                    .filter((t) => {
                        const type = String(t?.type || '').toLowerCase();
                        const particulars = String(t?.particulars || '').toLowerCase();
                        const isCharge = type === 'charge';
                        const isRoomTariff = particulars === 'room tariff' || particulars === 'room charges';
                        return isCharge && !isRoomTariff && isSameDayKey(t.date || booking.updatedAt || booking.createdAt, dayKey);
                    })
                    .reduce((s, t) => s + Math.abs(Number(t?.amount) || 0), 0);
                return sum + extra;
            }, 0);

            const sumOrderRevenueByDay = (dayKey) => allOrders.reduce((sum, order) => {
                if (String(order?.status || '').toLowerCase() === 'cancelled') return sum;
                if (!isOrderSettled(order)) return sum;
                if (!isSameDayKey(order?.closedAt || order?.billedAt || order?.updatedAt || order?.createdAt, dayKey)) return sum;
                return sum + (Number(order?.finalAmount) || Number(order?.totalAmount) || 0);
            }, 0);

            const estimateRoomRevenueFromStayByDay = (dayKey) => bookings.reduce((sum, booking) => {
                if (booking?.status === 'Cancelled' || booking?.status === 'NoShow') return sum;

                const cin = getBookingDayKey(booking?.checkInDate);
                const cout = getBookingDayKey(booking?.checkOutDate);
                if (!cin || !cout || !(dayKey >= cin && dayKey < cout)) return sum;

                const nights = Number(booking?.duration?.nights) || 1;
                const roomCount = Array.isArray(booking?.rooms) && booking.rooms.length > 0 ? booking.rooms.length : 1;

                let nightly = 0;
                if (Array.isArray(booking?.rooms) && booking.rooms.length > 0) {
                    nightly = booking.rooms.reduce((acc, r) => {
                        const rpn = Number(r?.ratePerNight) || 0;
                        const total = Number(r?.total) || 0;
                        const fallbackRpn = nights > 0 ? total / nights : 0;
                        return acc + (rpn > 0 ? rpn : fallbackRpn);
                    }, 0);
                }

                if (nightly <= 0) {
                    const billingRate = Number(booking?.billing?.roomRate) || 0;
                    const legacyRate = Number(booking?.roomRate) || 0;
                    const totalAmount = Number(booking?.billing?.totalAmount) || Number(booking?.totalAmount) || 0;
                    const fallbackNightly = nights > 0 ? totalAmount / nights : 0;
                    const perRoomRate = billingRate || legacyRate || fallbackNightly;
                    nightly = perRoomRate * roomCount;
                }

                return sum + Math.max(0, nightly);
            }, 0);

            const bookingReceiptsByDay = (dayKey) => {
                const receipt = { cash: 0, card: 0, upi: 0, bank: 0 };
                bookings.forEach((booking) => {
                    const txns = Array.isArray(booking?.transactions) ? booking.transactions : [];
                    txns.forEach((txn) => {
                        if (String(txn?.type || '').toLowerCase() !== 'payment') return;
                        if (!isSameDayKey(txn.date || booking.updatedAt || booking.createdAt, dayKey)) return;
                        const method = normalizePaymentMethod(txn?.method);
                        receipt[method] += Math.abs(Number(txn?.amount) || 0);
                    });
                });
                return receipt;
            };

            const orderReceiptsByDay = (dayKey) => {
                const receipt = { cash: 0, card: 0, upi: 0, bank: 0 };
                allOrders.forEach((order) => {
                    if (!isOrderSettled(order)) return;
                    if (!isSameDayKey(order?.closedAt || order?.billedAt || order?.updatedAt || order?.createdAt, dayKey)) return;
                    const amount = Number(order?.finalAmount) || Number(order?.totalAmount) || 0;
                    if (amount <= 0) return;
                    const method = normalizePaymentMethod(order?.paymentMethod);
                    receipt[method] += amount;
                });
                return receipt;
            };

            const cashierReceiptsByDay = (dayKey) => {
                const receipt = { cash: 0, card: 0, upi: 0, bank: 0 };
                allTransactions.forEach((txn) => {
                    const category = String(txn?.category || '').toLowerCase();
                    const type = String(txn?.type || '').toLowerCase();
                    const isCollection = category === 'collection' || type === 'income' || type.includes('collection');
                    if (!isCollection) return;
                    if (!isSameDayKey(txn?.date || txn?.createdAt || txn?.updatedAt, dayKey)) return;
                    const method = normalizePaymentMethod(txn?.paymentMethod);
                    receipt[method] += Math.abs(Number(txn?.amount) || 0);
                });
                return receipt;
            };

            const combineReceipts = (preferred, fallback) => ({
                cash: preferred.cash > 0 ? preferred.cash : fallback.cash,
                card: preferred.card > 0 ? preferred.card : fallback.card,
                upi: preferred.upi > 0 ? preferred.upi : fallback.upi,
                bank: preferred.bank > 0 ? preferred.bank : fallback.bank
            });

            const roomRevenueTodayPaid = sumBookingPaymentsByDay(todayStr);
            const roomRevenueYesterdayPaid = sumBookingPaymentsByDay(yesterdayStr);
            const roomRevenueTodayStay = estimateRoomRevenueFromStayByDay(todayStr);
            const roomRevenueYesterdayStay = estimateRoomRevenueFromStayByDay(yesterdayStr);
            const roomRevenueToday = roomRevenueTodayPaid > 0 ? roomRevenueTodayPaid : roomRevenueTodayStay;
            const roomRevenueYesterday = roomRevenueYesterdayPaid > 0 ? roomRevenueYesterdayPaid : roomRevenueYesterdayStay;
            const fragmentRevenueToday = sumExtraChargesByDay(todayStr);
            const fragmentRevenueYesterday = sumExtraChargesByDay(yesterdayStr);
            const restaurantRevenueToday = sumOrderRevenueByDay(todayStr);
            const restaurantRevenueYesterday = sumOrderRevenueByDay(yesterdayStr);

            const todayCalculated = roomRevenueToday + restaurantRevenueToday + fragmentRevenueToday;
            const yesterdayCalculated = roomRevenueYesterday + restaurantRevenueYesterday + fragmentRevenueYesterday;

            const todayCashier = report ? Number(report.totalCollections || 0) : 0;
            const yesterdayCashier = (() => {
                const explicitYesterday = Number(yesterdayReport?.totalCollections || 0);
                if (explicitYesterday > 0) return explicitYesterday;

                const y = cashierReceiptsByDay(yesterdayStr);
                return (y.cash || 0) + (y.card || 0) + (y.upi || 0) + (y.bank || 0);
            })();

            const totalTodayRevenue = Math.max(todayCashier, todayCalculated);
            const totalYesterdayRevenue = Math.max(yesterdayCashier, yesterdayCalculated);

            const receiptFallbackToday = (() => {
                const b = bookingReceiptsByDay(todayStr);
                const o = orderReceiptsByDay(todayStr);
                return {
                    cash: b.cash + o.cash,
                    card: b.card + o.card,
                    upi: b.upi + o.upi,
                    bank: b.bank + o.bank
                };
            })();

            const receiptPreferredToday = cashierReceiptsByDay(todayStr);
            const finalReceipts = combineReceipts(receiptPreferredToday, receiptFallbackToday);

            const yesterdayOccupied = bookings.filter((b) => {
                if (b.status === 'Cancelled' || b.status === 'NoShow') return false;
                const cin = getBookingDayKey(b.checkInDate);
                const cout = getBookingDayKey(b.checkOutDate);
                return cin && cout && yesterdayStr >= cin && yesterdayStr < cout;
            }).length;

            setRevenueBreakup({
                rooms: roomRevenueToday,
                restaurant: restaurantRevenueToday,
                fragments: fragmentRevenueToday,
                other: Math.max(0, totalTodayRevenue - (roomRevenueToday + restaurantRevenueToday + fragmentRevenueToday))
            });

            const computedYesterdayAvgRate = yesterdayOccupied > 0
                ? Math.round((roomRevenueYesterday / yesterdayOccupied) * 100) / 100
                : 0;

            setRevenue({
                total: totalTodayRevenue,
                today: totalTodayRevenue,
                yesterday: totalYesterdayRevenue,
                avgDailyRate: occupied > 0 ? Math.round((roomRevenueToday / occupied) * 100) / 100 : 0,
                yesterdayAvgRate: computedYesterdayAvgRate > 0 ? computedYesterdayAvgRate : totalYesterdayRevenue,
                receipts: {
                    cash: finalReceipts.cash,
                    card: finalReceipts.card,
                    diCard: finalReceipts.upi,
                    bank: finalReceipts.bank
                }
            });

            // ---- 11. Rooms Availability for next 14 days ----
            const availabilityData = [];
            for (let i = 0; i < 14; i++) {
                const date = new Date(now);
                date.setDate(date.getDate() + i);
                const dateStr = getLocalDateKey(date);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayDate = date.getDate();

                // Count rooms booked on this date
                const bookedOnDate = bookings.filter(b => {
                    if (b.status === 'Cancelled' || b.status === 'NoShow') return false;
                    if (isCheckedOut(b.status)) return false;
                    const cin = getBookingDayKey(b.checkInDate);
                    const cout = getBookingDayKey(b.checkOutDate);
                    return cin && cout && dateStr >= cin && dateStr < cout;
                }).length;

                availabilityData.push({
                    label: `${dayName} ${dayDate}`,
                    available: Math.max(0, total - bookedOnDate),
                    booked: Math.min(bookedOnDate, total),
                    total
                });
            }
            setRoomAvailability(availabilityData);

        } catch (error) {
            console.error('Error fetching statistics:', error);
            // Set default values on error
            setRoomStats({ total: 0, occupied: 0, booked: 0, available: 0 });
            setGuestStats({ currentGuests: 0, todayCheckIns: 0, todayCheckOuts: 0, upcomingBookings: 0 });
            setOccupancyRate(0);
            setArrivalStats({ total: 0, pending: 0, arrived: 0 });
            setDepartureStats({ total: 0, pending: 0, checkOut: 0 });
            setGuestInHouse({ total: 0, adults: 0, children: 0 });
            setAdvancedOccupancy({ today: 0, tomorrow: 0, thisMonth: 0, todayOccupied: 0, todayBooked: 0, tomorrowBooked: 0, monthBooked: 0, monthAvailable: 0 });
            setUpcomingReservations({ today: 0, tomorrow: 0, next7Days: 0 });
            setRevenue({ total: 0, today: 0, yesterday: 0, avgDailyRate: 0, yesterdayAvgRate: 0, receipts: { cash: 0, card: 0, diCard: 0, bank: 0 } });
            setRevenueBreakup({ rooms: 0, restaurant: 0, fragments: 0, other: 0 });
            setRoomAvailability([]);
        }
    };

    // Calculate angle for circular progress
    const getCircleProgress = (percentage) => {
        const radius = 70;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;
        return { circumference, offset };
    };

    const circleProgress = getCircleProgress(occupancyRate);

    // Calculate donut chart segments
    const getDonutSegments = (values) => {
        const total = values.reduce((sum, val) => sum + val, 0);
        if (total === 0) return [];

        let currentAngle = -90;
        return values.map((value, index) => {
            const percentage = (value / total) * 100;
            const angle = (percentage / 100) * 360;
            const segment = {
                percentage,
                startAngle: currentAngle,
                endAngle: currentAngle + angle,
                value
            };
            currentAngle += angle;
            return segment;
        });
    };

    // Calculate gauge progress
    const getGaugeProgress = (percentage) => {
        const radius = 60;
        const circumference = Math.PI * radius; // Semi-circle
        const offset = circumference - (percentage / 100) * circumference;
        return { circumference, offset };
    };

    const getDeltaPercentage = (current, previous) => {
        const safeCurrent = Number(current) || 0;
        const safePrevious = Number(previous) || 0;
        if (safePrevious <= 0) return safeCurrent > 0 ? 100 : 0;
        const pct = ((safeCurrent - safePrevious) / safePrevious) * 100;
        return Math.max(-100, Math.round(pct));
    };

    const revenueChangePct = getDeltaPercentage(revenue.today, revenue.yesterday);
    const adrCompareBase = Number(revenue.yesterdayAvgRate) > 0 ? revenue.yesterdayAvgRate : revenue.yesterday;
    const adrChangePct = getDeltaPercentage(revenue.avgDailyRate, adrCompareBase);

    return (
        <div className="dashboard-home">
            {/* Room Statistics Section */}
            {showRoomStats && (
            <div className="statistics-section">
                <h2 className="section-title">Room Statistics</h2>
                <div className="stats-grid">
                    {/* Total Rooms */}
                    <div className="stat-card stat-card-total">
                        <div className="stat-icon">
                            <BedDouble size={28} strokeWidth={2.5} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Total Rooms</div>
                            <div className="stat-value">{roomStats.total}</div>
                        </div>
                    </div>

                    {/* Occupied Rooms */}
                    <div className="stat-card stat-card-occupied">
                        <div className="stat-icon">
                            <Users size={28} strokeWidth={2.5} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Occupied Rooms</div>
                            <div className="stat-value">{roomStats.occupied}</div>
                        </div>
                    </div>

                    {/* Booked Rooms */}
                    <div className="stat-card stat-card-booked">
                        <div className="stat-icon">
                            <CalendarCheck size={28} strokeWidth={2.5} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Booked Rooms</div>
                            <div className="stat-value">{roomStats.booked}</div>
                        </div>
                    </div>

                    {/* Available Rooms */}
                    <div className="stat-card stat-card-available">
                        <div className="stat-icon">
                            <CheckCircle size={28} strokeWidth={2.5} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Available Rooms</div>
                            <div className="stat-value">{roomStats.available}</div>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* Guest Statistics Section */}
            {showBookingStats && (
            <div className="statistics-section">
                <h2 className="section-title">Booking Statistics</h2>
                <div className="stats-grid">
                    {/* Current Guests */}
                    <div className="stat-card stat-card-current-guests">
                        <div className="stat-icon">
                            <Users size={28} strokeWidth={2.5} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Current Guests</div>
                            <div className="stat-value">{guestStats.currentGuests}</div>
                        </div>
                    </div>

                    {/* Today's Check-ins */}
                    <div className="stat-card stat-card-checkin">
                        <div className="stat-icon">
                            <LogIn size={28} strokeWidth={2.5} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Today's Check-ins</div>
                            <div className="stat-value">{guestStats.todayCheckIns}</div>
                        </div>
                    </div>

                    {/* Today's Check-outs */}
                    <div className="stat-card stat-card-checkout">
                        <div className="stat-icon">
                            <LogOut size={28} strokeWidth={2.5} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Today's Check-outs</div>
                            <div className="stat-value">{guestStats.todayCheckOuts}</div>
                        </div>
                    </div>

                    {/* Upcoming Bookings */}
                    <div className="stat-card stat-card-upcoming">
                        <div className="stat-icon">
                            <Clock size={28} strokeWidth={2.5} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Upcoming Bookings</div>
                            <div className="stat-value">{guestStats.upcomingBookings}</div>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* Charts Section */}
            {showBasicCharts && (
            <div className="charts-container">
                {/* Occupancy Rate Chart */}
                <div className="chart-card">
                    <h3 className="chart-title">Occupancy Rate</h3>
                    <div className="circular-chart-container">
                        <div className="circular-chart">
                            <svg width="200" height="200" viewBox="0 0 200 200">
                                {/* Background circle */}
                                <circle
                                    cx="100"
                                    cy="100"
                                    r="70"
                                    fill="none"
                                    stroke="#f3f4f6"
                                    strokeWidth="20"
                                />
                                {/* Progress circle - Red */}
                                <circle
                                    cx="100"
                                    cy="100"
                                    r="70"
                                    fill="none"
                                    stroke="#E31E24"
                                    strokeWidth="20"
                                    strokeDasharray={circleProgress.circumference}
                                    strokeDashoffset={circleProgress.offset}
                                    strokeLinecap="round"
                                    transform="rotate(-90 100 100)"
                                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                                />
                            </svg>
                            <div className="chart-center-text">
                                <div className="chart-percentage">{occupancyRate}%</div>
                                <div className="chart-label">Occupied</div>
                            </div>
                        </div>
                        <div className="chart-legend">
                            <div className="legend-item">
                                <span className="legend-color legend-occupied"></span>
                                <span className="legend-label">Occupied</span>
                            </div>
                            <div className="legend-item">
                                <span className="legend-color legend-booked"></span>
                                <span className="legend-label">Booked</span>
                            </div>
                            <div className="legend-item">
                                <span className="legend-color legend-available-chart"></span>
                                <span className="legend-label">Available</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Room Status Distribution Chart */}
                <div className="chart-card">
                    <h3 className="chart-title">Room Status Distribution</h3>
                    <div className="distribution-chart-container">
                        <div className="horizontal-bar">
                            {roomStats.occupied > 0 && (
                                <div
                                    className="bar-segment bar-occupied"
                                    style={{ width: `${(roomStats.occupied / roomStats.total) * 100}%` }}
                                >
                                    <span className="bar-value">{roomStats.occupied}</span>
                                    <span className="bar-label">Occupied</span>
                                </div>
                            )}
                            {roomStats.booked > 0 && (
                                <div
                                    className="bar-segment bar-booked"
                                    style={{ width: `${(roomStats.booked / roomStats.total) * 100}%` }}
                                >
                                    <span className="bar-value">{roomStats.booked}</span>
                                </div>
                            )}
                            {roomStats.available > 0 && (
                                <div
                                    className="bar-segment bar-available"
                                    style={{ width: `${(roomStats.available / roomStats.total) * 100}%` }}
                                >
                                    <span className="bar-value">{roomStats.available}</span>
                                </div>
                            )}
                        </div>
                        <div className="distribution-legend">
                            <div className="legend-row">
                                <div className="legend-item">
                                    <span className="legend-color legend-occupied"></span>
                                    <span className="legend-label">Occupied</span>
                                </div>
                                <div className="legend-item">
                                    <span className="legend-color legend-booked"></span>
                                    <span className="legend-label">Booked</span>
                                </div>
                                <div className="legend-item">
                                    <span className="legend-color legend-available-chart"></span>
                                    <span className="legend-label">Available</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* ========== SEPARATOR ========== */}
            {(showTopDonuts || showMiddleSection || showRevenueSection) && (
            <div className="dashboard-separator">
                <div className="separator-line"></div>
                <div className="separator-line"></div>
            </div>
            )}

            {/* ========== NEW ZOTAKI STYLE DASHBOARD ========== */}
            {(showTopDonuts || showMiddleSection || showRevenueSection) && (
            <div className="zotaki-dashboard-wrapper">

                {/* Top Stats Cards with Donut Charts */}
                {showTopDonuts && (
                <div className="donut-stats-grid">
                    {/* Arrival Card */}
                    {showArrivalCard && (
                    <div className="donut-stat-card arrival-card">
                        <div className="donut-card-header">
                            <h3>Arrival</h3>
                        </div>
                        <div className="donut-chart-wrapper">
                            <svg width="140" height="140" viewBox="0 0 140 140">
                                <circle cx="70" cy="70" r="50" fill="none" stroke="#f3f4f6" strokeWidth="16" />
                                {/* Pending segment (75%) */}
                                <circle
                                    cx="70"
                                    cy="70"
                                    r="50"
                                    fill="none"
                                    stroke="#fb923c"
                                    strokeWidth="16"
                                    strokeDasharray={`${(arrivalStats.pending / (arrivalStats.total || 1)) * 314} 314`}
                                    strokeDashoffset="0"
                                    transform="rotate(-90 70 70)"
                                />
                                {/* Arrived segment (25%) */}
                                <circle
                                    cx="70"
                                    cy="70"
                                    r="50"
                                    fill="none"
                                    stroke="#86efac"
                                    strokeWidth="16"
                                    strokeDasharray={`${(arrivalStats.arrived / (arrivalStats.total || 1)) * 314} 314`}
                                    strokeDashoffset={-((arrivalStats.pending / (arrivalStats.total || 1)) * 314)}
                                    transform="rotate(-90 70 70)"
                                />
                            </svg>
                            <div className="donut-center-value">{arrivalStats.total}</div>
                        </div>
                        <div className="donut-legend">
                            <div className="donut-legend-item">
                                <span className="dot" style={{ background: '#fb923c' }}></span>
                                <span>Pending ({arrivalStats.pending})</span>
                            </div>
                            <div className="donut-legend-item">
                                <span className="dot" style={{ background: '#86efac' }}></span>
                                <span>Arrived ({arrivalStats.arrived})</span>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Departure Card */}
                    {showDepartureCard && (
                    <div className="donut-stat-card departure-card">
                        <div className="donut-card-header">
                            <h3>Departure</h3>
                        </div>
                        <div className="donut-chart-wrapper">
                            <svg width="140" height="140" viewBox="0 0 140 140">
                                <circle cx="70" cy="70" r="50" fill="none" stroke="#f3f4f6" strokeWidth="16" />
                                {/* Pending segment */}
                                <circle
                                    cx="70"
                                    cy="70"
                                    r="50"
                                    fill="none"
                                    stroke="#fb923c"
                                    strokeWidth="16"
                                    strokeDasharray={`${(departureStats.pending / (departureStats.total || 1)) * 314} 314`}
                                    strokeDashoffset="0"
                                    transform="rotate(-90 70 70)"
                                />
                                {/* Check Out segment */}
                                <circle
                                    cx="70"
                                    cy="70"
                                    r="50"
                                    fill="none"
                                    stroke="#E31E24"
                                    strokeWidth="16"
                                    strokeDasharray={`${(departureStats.checkOut / (departureStats.total || 1)) * 314} 314`}
                                    strokeDashoffset={-((departureStats.pending / (departureStats.total || 1)) * 314)}
                                    transform="rotate(-90 70 70)"
                                />
                            </svg>
                            <div className="donut-center-value">{departureStats.total}</div>
                        </div>
                        <div className="donut-legend">
                            <div className="donut-legend-item">
                                <span className="dot" style={{ background: '#fb923c' }}></span>
                                <span>Pending ({departureStats.pending})</span>
                            </div>
                            <div className="donut-legend-item">
                                <span className="dot" style={{ background: '#E31E24' }}></span>
                                <span>Check Out ({departureStats.checkOut})</span>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Guest In House Card */}
                    {showGuestInHouseCard && (
                    <div className="donut-stat-card guest-house-card">
                        <div className="donut-card-header">
                            <h3>Guest In House</h3>
                        </div>
                        <div className="donut-chart-wrapper">
                            <svg width="140" height="140" viewBox="0 0 140 140">
                                <circle cx="70" cy="70" r="50" fill="none" stroke="#f3f4f6" strokeWidth="16" />
                                {/* Adults segment */}
                                <circle
                                    cx="70"
                                    cy="70"
                                    r="50"
                                    fill="none"
                                    stroke="#E31E24"
                                    strokeWidth="16"
                                    strokeDasharray={`${(guestInHouse.adults / (guestInHouse.total || 1)) * 314} 314`}
                                    strokeDashoffset="0"
                                    transform="rotate(-90 70 70)"
                                />
                                {/* Children segment */}
                                <circle
                                    cx="70"
                                    cy="70"
                                    r="50"
                                    fill="none"
                                    stroke="#7c3aed"
                                    strokeWidth="16"
                                    strokeDasharray={`${(guestInHouse.children / (guestInHouse.total || 1)) * 314} 314`}
                                    strokeDashoffset={-((guestInHouse.adults / (guestInHouse.total || 1)) * 314)}
                                    transform="rotate(-90 70 70)"
                                />
                            </svg>
                            <div className="donut-center-value">{guestInHouse.total}</div>
                        </div>
                        <div className="donut-legend">
                            <div className="donut-legend-item">
                                <span className="dot" style={{ background: '#E31E24' }}></span>
                                <span>Adults ({guestInHouse.adults})</span>
                            </div>
                            <div className="donut-legend-item">
                                <span className="dot" style={{ background: '#7c3aed' }}></span>
                                <span>Children ({guestInHouse.children})</span>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Room Status Card */}
                    {showRoomStatusCard && (
                    <div className="donut-stat-card room-status-card">
                        <div className="donut-card-header">
                            <h3>Room Status</h3>
                        </div>
                        <div className="donut-chart-wrapper">
                            <svg width="140" height="140" viewBox="0 0 140 140">
                                <circle cx="70" cy="70" r="50" fill="none" stroke="#f3f4f6" strokeWidth="16" />
                                {/* Vacant segment */}
                                <circle
                                    cx="70"
                                    cy="70"
                                    r="50"
                                    fill="none"
                                    stroke="#E31E24"
                                    strokeWidth="16"
                                    strokeDasharray={`${(roomStats.available / (roomStats.total || 1)) * 314} 314`}
                                    strokeDashoffset="0"
                                    transform="rotate(-90 70 70)"
                                />
                                {/* Occupied segment */}
                                <circle
                                    cx="70"
                                    cy="70"
                                    r="50"
                                    fill="none"
                                    stroke="#fb923c"
                                    strokeWidth="16"
                                    strokeDasharray={`${(roomStats.occupied / (roomStats.total || 1)) * 314} 314`}
                                    strokeDashoffset={-((roomStats.available / (roomStats.total || 1)) * 314)}
                                    transform="rotate(-90 70 70)"
                                />
                                {/* Booked segment */}
                                <circle
                                    cx="70"
                                    cy="70"
                                    r="50"
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="16"
                                    strokeDasharray={`${(roomStats.booked / (roomStats.total || 1)) * 314} 314`}
                                    strokeDashoffset={-(((roomStats.available + roomStats.occupied) / (roomStats.total || 1)) * 314)}
                                    transform="rotate(-90 70 70)"
                                />
                            </svg>
                            <div className="donut-center-value">{roomStats.total}</div>
                        </div>
                        <div className="donut-legend">
                            <div className="donut-legend-item">
                                <span className="dot" style={{ background: '#E31E24' }}></span>
                                <span>Vacant ({roomStats.available})</span>
                            </div>
                            <div className="donut-legend-item">
                                <span className="dot" style={{ background: '#fb923c' }}></span>
                                <span>Occupied ({roomStats.occupied})</span>
                            </div>
                            <div className="donut-legend-item">
                                <span className="dot" style={{ background: '#10b981' }}></span>
                                <span>Booked ({roomStats.booked})</span>
                            </div>
                        </div>
                    </div>
                    )}
                </div>
                )}

                {/* Middle Section - Occupancy Rate & Upcoming Reservations */}
                {showMiddleSection && (
                <div className="middle-section-grid">
                    {/* Occupancy Rate Gauges */}
                    {showOccupancyGauges && (
                    <div className="occupancy-gauges-card">
                        <div className="gauge-card-header">
                            <h3>Occupancy Rate</h3>
                        </div>
                        <div className="gauges-container">
                            {/* Today Gauge */}
                            <div className="gauge-item">
                                <div className="gauge-chart">
                                    <svg width="220" height="138" viewBox="0 0 220 138">
                                        {/* Background arc */}
                                        <path
                                            d="M 27.5 110 A 82.5 82.5 0 0 1 192.5 110"
                                            fill="none"
                                            stroke="#f3f4f6"
                                            strokeWidth="22"
                                        />
                                        {/* Progress arc - Orange/Yellow */}
                                        <path
                                            d="M 27.5 110 A 82.5 82.5 0 0 1 192.5 110"
                                            fill="none"
                                            stroke="#fb923c"
                                            strokeWidth="22"
                                            strokeDasharray={`${259 * (advancedOccupancy.today / 100)} 259`}
                                            strokeDashoffset="0"
                                        />
                                        {/* Percentage text */}
                                        <text x="110" y="89" textAnchor="middle" fontSize="38" fontWeight="bold" fill="#1f2937">
                                            {advancedOccupancy.today}%
                                        </text>
                                    </svg>
                                </div>
                                <div className="gauge-footer">
                                    <div className="gauge-label">Today</div>
                                    <div className="gauge-stats">
                                        <span className="gauge-stat"><span className="dot" style={{ background: '#E31E24' }}></span> {advancedOccupancy.todayOccupied} Occupied</span>
                                        <span className="gauge-stat"><span className="dot" style={{ background: '#fb923c' }}></span> {advancedOccupancy.todayBooked} Booked</span>
                                    </div>
                                </div>
                            </div>

                            {/* Tomorrow Gauge */}
                            <div className="gauge-item">
                                <div className="gauge-chart">
                                    <svg width="220" height="138" viewBox="0 0 220 138">
                                        {/* Background arc */}
                                        <path
                                            d="M 27.5 110 A 82.5 82.5 0 0 1 192.5 110"
                                            fill="none"
                                            stroke="#f3f4f6"
                                            strokeWidth="22"
                                        />
                                        {/* Progress arc - Orange */}
                                        <path
                                            d="M 27.5 110 A 82.5 82.5 0 0 1 192.5 110"
                                            fill="none"
                                            stroke="#fb923c"
                                            strokeWidth="22"
                                            strokeDasharray={`${259 * (advancedOccupancy.tomorrow / 100)} 259`}
                                            strokeDashoffset="0"
                                        />
                                        {/* Percentage text */}
                                        <text x="110" y="89" textAnchor="middle" fontSize="38" fontWeight="bold" fill="#1f2937">
                                            {advancedOccupancy.tomorrow}%
                                        </text>
                                    </svg>
                                </div>
                                <div className="gauge-footer">
                                    <div className="gauge-label">Tomorrow</div>
                                    <div className="gauge-stats">
                                        <span className="gauge-stat"><span className="dot" style={{ background: '#fb923c' }}></span> {advancedOccupancy.tomorrowBooked} Booked</span>
                                        <span className="gauge-stat"><span className="dot" style={{ background: '#10b981' }}></span> {roomStats.total - advancedOccupancy.tomorrowBooked} Available</span>
                                    </div>
                                </div>
                            </div>

                            {/* This Month Gauge */}
                            <div className="gauge-item">
                                <div className="gauge-chart">
                                    <svg width="220" height="138" viewBox="0 0 220 138">
                                        {/* Background arc */}
                                        <path
                                            d="M 27.5 110 A 82.5 82.5 0 0 1 192.5 110"
                                            fill="none"
                                            stroke="#f3f4f6"
                                            strokeWidth="22"
                                        />
                                        {/* Progress arc - Green */}
                                        <path
                                            d="M 27.5 110 A 82.5 82.5 0 0 1 192.5 110"
                                            fill="none"
                                            stroke="#10b981"
                                            strokeWidth="22"
                                            strokeDasharray={`${259 * (advancedOccupancy.thisMonth / 100)} 259`}
                                            strokeDashoffset="0"
                                        />
                                        {/* Percentage text */}
                                        <text x="110" y="89" textAnchor="middle" fontSize="38" fontWeight="bold" fill="#1f2937">
                                            {advancedOccupancy.thisMonth}%
                                        </text>
                                    </svg>
                                </div>
                                <div className="gauge-footer">
                                    <div className="gauge-label">This Month</div>
                                    <div className="gauge-stats">
                                        <span className="gauge-stat"><span className="dot" style={{ background: '#E31E24' }}></span> {advancedOccupancy.monthAvailable} Available</span>
                                        <span className="gauge-stat"><span className="dot" style={{ background: '#10b981' }}></span> {advancedOccupancy.monthBooked} Booked</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Upcoming Reservations */}
                    {showUpcomingReservations && (
                    <div className="upcoming-reservations-card">
                        <div className="reservations-header">
                            <h3>Upcoming Reservations</h3>
                        </div>
                        <div className="reservations-grid">
                            <div className="reservation-item today-item">
                                <div className="reservation-label">Today</div>
                                <div className="reservation-value">{upcomingReservations.today}</div>
                            </div>
                            <div className="reservation-item tomorrow-item">
                                <div className="reservation-label">Tomorrow</div>
                                <div className="reservation-value">{upcomingReservations.tomorrow}</div>
                            </div>
                            <div className="reservation-item week-item">
                                <div className="reservation-label">Next 7 Days</div>
                                <div className="reservation-value">{upcomingReservations.next7Days}</div>
                            </div>
                            <div className="reservation-item total-item">
                                <div className="reservation-label">Total</div>
                                <div className="reservation-value">{upcomingReservations.today + upcomingReservations.tomorrow + upcomingReservations.next7Days}</div>
                            </div>
                        </div>
                        <div className="payment-methods">
                            <div className="payment-item">
                                <span className="dot" style={{ background: '#E31E24' }}></span>
                                <span>Cash</span>
                            </div>
                            <div className="payment-item">
                                <span className="dot" style={{ background: '#fb923c' }}></span>
                                <span>Online</span>
                            </div>
                            <div className="payment-item">
                                <span className="dot" style={{ background: '#10b981' }}></span>
                                <span>Di Card</span>
                            </div>
                            <div className="payment-item">
                                <span className="dot" style={{ background: '#22d3ee' }}></span>
                                <span>Bank</span>
                            </div>
                        </div>
                    </div>
                    )}
                </div>
                )}

                {/* Additional Revenue and Analytics Section - Hidden for Staff */}
                {showRevenueSection && (
                    <div className="revenue-analytics-section">
                        {/* Revenue Cards Row */}
                        <div className="revenue-stats-grid">
                            {/* Total Revenue Card */}
                            <div className="revenue-stat-card total-revenue-card">
                                <h3>Total Revenue</h3>
                                <div className="revenue-main-value">{revenue.total.toLocaleString()}</div>
                                <div className="revenue-sub-text">Today: {revenue.today.toLocaleString()}</div>
                                <div className="revenue-sub-text">Yesterday: {revenue.yesterday.toLocaleString()}</div>
                                <div className="revenue-percentage">
                                    <span className={`percentage-badge ${revenueChangePct >= 0 ? 'up' : 'down'}`}>
                                        {revenueChangePct >= 0 ? '+' : ''}{revenueChangePct}%
                                    </span>
                                </div>
                            </div>

                            {/* Revenue Breakup Card */}
                            <div className="revenue-stat-card breakup-card">
                                <h3>Revenue Breakup</h3>
                                <div className="revenue-main-value">RS {revenue.total.toLocaleString()}</div>
                                <div className="breakup-grid">
                                    <div className="breakup-item">
                                        <span className="breakup-label">Rooms</span>
                                        <span className="breakup-value">{revenueBreakup.rooms.toLocaleString()}</span>
                                    </div>
                                    <div
                                        className="breakup-item"
                                        onClick={() => navigate('/admin/food-order')}
                                        style={{ cursor: 'pointer' }}
                                        title="Go to Food Order"
                                    >
                                        <span className="breakup-label">Restaurant</span>
                                        <span className="breakup-value">{revenueBreakup.restaurant.toLocaleString()}</span>
                                    </div>
                                    <div className="breakup-item">
                                        <span className="breakup-label">Fragments</span>
                                        <span className="breakup-value">{revenueBreakup.fragments.toLocaleString()}</span>
                                    </div>
                                    <div className="breakup-item">
                                        <span className="breakup-label">Other</span>
                                        <span className="breakup-value">{revenueBreakup.other.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* ADR Card */}
                            <div className="revenue-stat-card adr-card">
                                <h3>Average Daily Room Rate</h3>
                                <div className="revenue-main-value">{revenue.avgDailyRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div className="revenue-sub-text">Yesterday: RS {adrCompareBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div className="revenue-percentage">
                                    <span className={`percentage-badge ${adrChangePct >= 0 ? 'up' : 'down'}`}>
                                        {adrChangePct >= 0 ? '+' : ''}{adrChangePct}%
                                    </span>
                                </div>
                            </div>

                            {/* Total Receipts Card */}
                            <div className="revenue-stat-card receipts-card">
                                <h3>Total Receipts</h3>
                                <div className="revenue-main-value">RS {revenue.total.toLocaleString()}</div>
                                <div className="receipts-breakdown">
                                    <div className="receipt-item">
                                        <span className="receipt-label">Cash</span>
                                        <span className="receipt-value">RS {revenue.receipts.cash.toLocaleString()}</span>
                                    </div>
                                    <div className="receipt-item">
                                        <span className="receipt-label">Card</span>
                                        <span className="receipt-value">RS {revenue.receipts.card.toLocaleString()}</span>
                                    </div>
                                    <div className="receipt-item">
                                        <span className="receipt-label">Online/UPI</span>
                                        <span className="receipt-value">RS {revenue.receipts.diCard.toLocaleString()}</span>
                                    </div>
                                    <div className="receipt-item">
                                        <span className="receipt-label">Bank</span>
                                        <span className="receipt-value">RS {revenue.receipts.bank.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="payment-icons">
                                    <div className="payment-item"><span className="dot" style={{ background: '#E31E24' }}></span><span>Cash</span></div>
                                    <div className="payment-item"><span className="dot" style={{ background: '#fb923c' }}></span><span>Online</span></div>
                                    <div className="payment-item"><span className="dot" style={{ background: '#10b981' }}></span><span>{revenue.total > 0 ? ((((revenue.receipts.diCard + revenue.receipts.bank + revenue.receipts.card) / revenue.total) * 100).toFixed(1) + '%') : '0%'}</span></div>
                                    <div className="payment-item"><span className="dot" style={{ background: '#6b7280' }}></span><span>Bank</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Charts Row */}
                        {(showHousekeepingChart || showAvailabilityChart) && (
                        <div className="analytics-charts-row">
                            {/* Housekeeping Status Chart */}
                            {showHousekeepingChart && (
                            <div className="chart-card-analytics housekeeping-chart">
                                <h3>Housekeeping Status</h3>
                                <div className="bar-chart-container">
                                    <svg width="100%" height="300" viewBox="0 0 600 300">
                                        {/* Grid lines */}
                                        <line x1="50" y1="250" x2="550" y2="250" stroke="#e5e7eb" strokeWidth="1" />
                                        <line x1="50" y1="150" x2="550" y2="150" stroke="#f3f4f6" strokeWidth="1" />
                                        <line x1="50" y1="50" x2="550" y2="50" stroke="#e5e7eb" strokeWidth="1" />

                                        {/* Y-axis labels */}
                                        <text x="35" y="255" fontSize="12" fill="#6b7280" textAnchor="end">0</text>
                                        <text x="35" y="155" fontSize="12" fill="#6b7280" textAnchor="end">{Math.round(roomStats.total / 2)}</text>
                                        <text x="35" y="55" fontSize="12" fill="#6b7280" textAnchor="end">{roomStats.total}</text>

                                        {/* Clean */}
                                        {(() => {
                                            const h = Math.max((housekeepingStats.clean / (roomStats.total || 1)) * 200, 2); return (
                                                <><rect x="100" y={250 - h} width="80" height={h} fill="#10b981" rx="6" />
                                                    <text x="140" y={244 - h} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#10b981">{housekeepingStats.clean}</text>
                                                    <text x="140" y="275" textAnchor="middle" fontSize="12" fill="#6b7280">Clean</text></>
                                            );
                                        })()}

                                        {/* Dirty */}
                                        {(() => {
                                            const h = Math.max((housekeepingStats.dirty / (roomStats.total || 1)) * 200, 2); return (
                                                <><rect x="250" y={250 - h} width="80" height={h} fill="#E31E24" rx="6" />
                                                    <text x="290" y={244 - h} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#E31E24">{housekeepingStats.dirty}</text>
                                                    <text x="290" y="275" textAnchor="middle" fontSize="12" fill="#6b7280">Dirty</text></>
                                            );
                                        })()}

                                        {/* Pending/Inspection */}
                                        {(() => {
                                            const h = Math.max((housekeepingStats.inspection / (roomStats.total || 1)) * 200, 2); return (
                                                <><rect x="400" y={250 - h} width="80" height={h} fill="#f59e0b" rx="6" />
                                                    <text x="440" y={244 - h} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#f59e0b">{housekeepingStats.inspection}</text>
                                                    <text x="440" y="275" textAnchor="middle" fontSize="12" fill="#6b7280">Pending</text></>
                                            );
                                        })()}
                                    </svg>
                                </div>
                            </div>
                            )}

                            {/* Rooms Availability Chart */}
                            {showAvailabilityChart && (
                            <div className="chart-card-analytics availability-chart">
                                <div className="chart-header-row">
                                    <h3>Rooms Availability</h3>
                                    <div className="date-range">From: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} <span className="next-days">+Next 14 Days</span></div>
                                </div>
                                <div className="bar-chart-container">
                                    <svg width="100%" height="300" viewBox="0 0 700 300">
                                        {/* Grid lines */}
                                        <line x1="30" y1="250" x2="680" y2="250" stroke="#e5e7eb" strokeWidth="1" />
                                        <line x1="30" y1="150" x2="680" y2="150" stroke="#f3f4f6" strokeWidth="1" />
                                        <line x1="30" y1="50" x2="680" y2="50" stroke="#e5e7eb" strokeWidth="1" />

                                        {/* Y-axis labels */}
                                        <text x="18" y="255" fontSize="11" fill="#6b7280" textAnchor="end">0</text>
                                        <text x="18" y="155" fontSize="11" fill="#6b7280" textAnchor="end">{Math.round(roomStats.total / 2)}</text>
                                        <text x="18" y="55" fontSize="11" fill="#6b7280" textAnchor="end">{roomStats.total}</text>

                                        {/* Availability Bars - 14 days */}
                                        {roomAvailability.map((day, i) => {
                                            const barHeight = (day.available / (day.total || 1)) * 200;
                                            return (
                                                <g key={i}>
                                                    <rect
                                                        x={38 + (i * 46)}
                                                        y={250 - barHeight}
                                                        width="32"
                                                        height={Math.max(barHeight, 2)}
                                                        fill="#10b981"
                                                        rx="4"
                                                    />
                                                    <text x={54 + (i * 46)} y="268" textAnchor="middle" fontSize="9" fill="#6b7280">
                                                        {day.label}
                                                    </text>
                                                </g>
                                            );
                                        })}
                                    </svg>
                                </div>
                            </div>
                            )}
                        </div>
                        )}
                    </div>
                )}
            </div>
            )}

            {!hasAnyVisibleSection && (
                <div className="statistics-section">
                    <h2 className="section-title">Dashboard</h2>
                    <div className="chart-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
                        <h3 className="chart-title" style={{ marginBottom: '10px' }}>No dashboard widgets assigned</h3>
                        <p style={{ margin: 0, color: '#64748b' }}>Please assign related permissions to view dashboard sections.</p>
                    </div>
                </div>
            )}
            {/* End of Zotaki Dashboard */}
        </div>
    );
};

export default DashboardHome;
