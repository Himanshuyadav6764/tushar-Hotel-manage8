import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API_URL from '../config/api';
import { DEFAULT_ROOM_GST_SLABS, normalizeRoomGstSlabs } from '../utils/roomTax';

const SettingsContext = createContext(null);

const defaultSettings = {
    name: 'Bireena Atithi',
    address: '123, MG Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    pin: '400050',
    gstNumber: '22AAAAA0000A125',
    phone: '',
    logoUrl: null,
    currency: 'INR (₹)',
    timezone: '(GMT+05:30) Kolkata',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12 Hour',
    taxType: 'GST',
    cgst: 2.5,
    sgst: 2.5,
    serviceCharge: 10,
    roomGst: 12,
    roomGstSlabs: DEFAULT_ROOM_GST_SLABS,
    foodGst: 5,
    roomServiceCharge: 10,
    inclusiveTax: false,
    invoicePrefix: 'INV-2026-',
    billingInvoicePrefix: 'ATITHI',
    startingInvoiceNumber: '1001',
    panNumber: '',
    autoGenerateInvoice: true,
    autoIncrementInvoice: true,
    billPrintFormat: 'Hotel Invoice',
    thankYouMessage: 'Thank you for visiting our hotel!',
    enableRoomPosting: true,
    posEnabled: true,
    displayLogoOnBill: true,
    printKOTHeader: true,
    paymentModes: { cash: true, upi: true, card: true, bankTransfer: true },
    billingRules: { autoPost: true, mandatorySettlement: true, splitBill: true, mergeTable: true, addToRoom: true },
    discountRules: { maxDiscount: 25, maxDiscountType: 'PERCENTAGE', managerApproval: true, couponEnabled: true }
};

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(defaultSettings);
    const [loaded, setLoaded] = useState(false);

    const resolveTimeZone = useCallback((timezoneLabel) => {
        const value = (timezoneLabel || settings.timezone || '').toLowerCase();

        if (value.includes('kolkata') || value.includes('delhi') || value.includes('india')) return 'Asia/Kolkata';
        if (value.includes('london') || value.includes('uk')) return 'Europe/London';
        if (value.includes('new york') || value.includes('usa') || value.includes('est')) return 'America/New_York';

        return 'Asia/Kolkata';
    }, [settings.timezone]);

    const getDateTimeParts = useCallback((date = new Date(), timezoneLabel) => {
        const timeZone = resolveTimeZone(timezoneLabel);
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        });

        const parts = formatter.formatToParts(date).reduce((acc, part) => {
            if (part.type !== 'literal') acc[part.type] = part.value;
            return acc;
        }, {});

        const year = parts.year || '1970';
        const month = parts.month || '01';
        const day = parts.day || '01';
        const hour = parts.hour || '00';
        const minute = parts.minute || '00';
        const second = parts.second || '00';

        return {
            year,
            month,
            day,
            hour,
            minute,
            second,
            dateISO: `${year}-${month}-${day}`,
            time24: `${hour}:${minute}`,
            time24WithSeconds: `${hour}:${minute}:${second}`
        };
    }, [resolveTimeZone]);

    const getCurrentDateISO = useCallback(() => {
        return getDateTimeParts(new Date()).dateISO;
    }, [getDateTimeParts]);

    const getCurrentTime24 = useCallback(() => {
        return getDateTimeParts(new Date()).time24;
    }, [getDateTimeParts]);

    const toTime24 = useCallback((timeValue) => {
        if (!timeValue) return '';

        const raw = String(timeValue).trim();
        if (!raw) return '';

        const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
        if (ampmMatch) {
            let hours = Number(ampmMatch[1]);
            const minutes = Number(ampmMatch[2]);
            const suffix = ampmMatch[3].toUpperCase();

            if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes > 59) return '';
            if (hours < 1 || hours > 12) return '';

            if (suffix === 'AM') {
                if (hours === 12) hours = 0;
            } else if (hours !== 12) {
                hours += 12;
            }

            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }

        const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (!hhmmMatch) return '';

        const hours = Number(hhmmMatch[1]);
        const minutes = Number(hhmmMatch[2]);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return '';
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '';

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }, []);

    const timeToMinutes = useCallback((timeValue) => {
        const normalized = toTime24(timeValue);
        if (!normalized) return null;

        const [hours, minutes] = normalized.split(':').map(Number);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

        return (hours * 60) + minutes;
    }, [toTime24]);

    const isPastDateTime = useCallback((dateISO, timeValue = '00:00') => {
        if (!dateISO) return false;

        const normalizedTime = toTime24(timeValue) || '00:00';
        const currentDateISO = getCurrentDateISO();
        const currentTime24 = getCurrentTime24();

        if (dateISO < currentDateISO) return true;
        if (dateISO > currentDateISO) return false;
        return normalizedTime < currentTime24;
    }, [getCurrentDateISO, getCurrentTime24, toTime24]);

    const addDaysToDateISO = useCallback((dateISO, days = 0) => {
        if (!dateISO) return '';

        const [year, month, day] = String(dateISO).split('-').map(Number);
        if (!year || !month || !day) return dateISO;

        const date = new Date(Date.UTC(year, month - 1, day));
        date.setUTCDate(date.getUTCDate() + Number(days || 0));

        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    }, []);

    const getDateISOWithOffset = useCallback((days = 0) => {
        return addDaysToDateISO(getCurrentDateISO(), days);
    }, [addDaysToDateISO, getCurrentDateISO]);

    const fetchSettings = useCallback(async () => {
        try {
            const savedUser = localStorage.getItem('authUser');
            let token = '';
            let hotelId = '';

            if (savedUser) {
                try {
                    const parsed = JSON.parse(savedUser);
                    token = parsed?.token || '';
                    hotelId = parsed?.hotelId || '';
                } catch (error) {
                    // Ignore storage parsing errors and use public fallback fetch.
                }
            }

            const settingsUrl = hotelId
                ? `${API_URL}/api/hotel/settings?hotelId=${encodeURIComponent(hotelId)}`
                : `${API_URL}/api/hotel/settings`;

            const res = await fetch(settingsUrl, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const data = await res.json();
            if (data.success && data.data) {
                setSettings(prev => {
                    const mergedBillingRules = { ...prev.billingRules, ...(data.data.billingRules || {}) };
                    const masterServiceCharge = data.data.roomServiceCharge ?? data.data.serviceCharge ?? prev.roomServiceCharge;
                    const roomPostingEnabled = data.data.enableRoomPosting ?? mergedBillingRules.autoPost ?? prev.enableRoomPosting;
                    const roomGstSlabs = normalizeRoomGstSlabs(data.data.roomGstSlabs ?? prev.roomGstSlabs);

                    return {
                        ...prev,
                        ...data.data,
                        roomGstSlabs,
                        serviceCharge: masterServiceCharge,
                        roomServiceCharge: masterServiceCharge,
                        enableRoomPosting: roomPostingEnabled,
                        billingRules: {
                            ...mergedBillingRules,
                            autoPost: roomPostingEnabled
                        }
                    };
                });
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        } finally {
            setLoaded(true);
        }
    }, []);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    const getCurrencySymbol = useCallback(() => {
        const c = settings.currency || 'INR (₹)';
        if (c.includes('₹') || c.includes('INR')) return '₹';
        if (c.includes('$') || c.includes('USD')) return '$';
        if (c.includes('€') || c.includes('EUR')) return '€';
        if (c.includes('£') || c.includes('GBP')) return '£';
        return '₹';
    }, [settings.currency]);

    const formatDate = useCallback((dateStr) => {
        if (!dateStr) return 'N/A';

        let dd;
        let mm;
        let yyyy;

        const raw = String(dateStr).trim();
        const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

        if (dateOnlyMatch) {
            yyyy = dateOnlyMatch[1];
            mm = dateOnlyMatch[2];
            dd = dateOnlyMatch[3];
        } else {
            const parsedDate = new Date(raw);
            if (Number.isNaN(parsedDate.getTime())) return 'N/A';

            const parts = getDateTimeParts(parsedDate);
            yyyy = parts.year;
            mm = parts.month;
            dd = parts.day;
        }

        const fmt = settings.dateFormat || 'DD/MM/YYYY';
        if (fmt === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
        if (fmt === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
        return `${dd}/${mm}/${yyyy}`;
    }, [settings.dateFormat, getDateTimeParts]);

    const formatTime = useCallback((timeStr) => {
        if (!timeStr) return '';
        const normalized = toTime24(timeStr);
        if (!normalized) return String(timeStr);

        const fmt = settings.timeFormat || '12 Hour';
        if (fmt === '24 Hour') return normalized;

        const [h, m] = normalized.split(':').map(Number);
        if (isNaN(h)) return timeStr;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    }, [settings.timeFormat, toTime24]);

    const getFullAddress = useCallback(() => {
        const parts = [settings.address, settings.city, settings.state, settings.pin].filter(Boolean);
        return parts.join(', ');
    }, [settings.address, settings.city, settings.state, settings.pin]);

    return (
        <SettingsContext.Provider value={{
            settings, setSettings, fetchSettings, loaded,
            getCurrencySymbol,
            formatDate,
            formatTime,
            getFullAddress,
            resolveTimeZone,
            getDateTimeParts,
            getCurrentDateISO,
            getCurrentTime24,
            getDateISOWithOffset,
            addDaysToDateISO,
            toTime24,
            timeToMinutes,
            isPastDateTime
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
    return ctx;
};
