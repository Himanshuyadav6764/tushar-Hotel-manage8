export const DEFAULT_ROOM_GST_SLABS = [
    { min: 0, max: 1000, rate: 0 },
    { min: 1001, max: 7500, rate: 12 },
    { min: 7501, max: 99999, rate: 18 }
];

const toFiniteNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

export const normalizeRoomGstSlabs = (slabs) => {
    if (!Array.isArray(slabs) || slabs.length === 0) {
        return [...DEFAULT_ROOM_GST_SLABS];
    }

    const normalized = slabs
        .map((slab) => ({
            min: Math.max(0, toFiniteNumber(slab?.min, 0)),
            max: Math.max(0, toFiniteNumber(slab?.max, 0)),
            rate: Math.max(0, Math.min(100, toFiniteNumber(slab?.rate, 0)))
        }))
        .sort((a, b) => a.min - b.min)
        .map((slab) => ({
            ...slab,
            max: slab.max >= slab.min ? slab.max : slab.min
        }));

    if (normalized.length === 0) {
        return [...DEFAULT_ROOM_GST_SLABS];
    }

    return normalized;
};

export const getRoomGstRateForNightlyPrice = (nightlyPrice, slabs, fallbackRate = 12) => {
    const safeSlabs = normalizeRoomGstSlabs(slabs);
    const price = Math.max(0, toFiniteNumber(nightlyPrice, 0));

    const matched = safeSlabs.find((slab) => price >= slab.min && price <= slab.max);
    if (matched) return matched.rate;

    if (price > safeSlabs[safeSlabs.length - 1].max) {
        return safeSlabs[safeSlabs.length - 1].rate;
    }

    return Math.max(0, Math.min(100, toFiniteNumber(fallbackRate, 12)));
};

export const calculateRoomTaxBySlab = ({ rooms = [], nights = 1, taxExempt = false, inclusiveTax = false, roomGstSlabs = [], fallbackRoomGst = 12 }) => {
    const safeNights = Math.max(1, toFiniteNumber(nights, 1));
    const rows = Array.isArray(rooms) ? rooms : [];

    const roomCharges = rows.reduce((sum, room) => {
        const ratePerNight = toFiniteNumber(room?.ratePerNight, 0);
        return sum + (ratePerNight * safeNights);
    }, 0);

    const totalDiscount = rows.reduce((sum, room) => sum + toFiniteNumber(room?.discount, 0), 0);
    const subtotal = roomCharges - totalDiscount;

    const isTaxEnabled = Boolean(inclusiveTax);

    if (taxExempt || !isTaxEnabled || subtotal <= 0) {
        return {
            roomCharges,
            totalDiscount,
            subtotal,
            taxAmount: 0,
            effectiveRate: 0
        };
    }

    let taxTotal = 0;

    rows.forEach((room) => {
        const ratePerNight = toFiniteNumber(room?.ratePerNight, 0);
        const discount = toFiniteNumber(room?.discount, 0);
        const roomSubtotal = (ratePerNight * safeNights) - discount;

        if (roomSubtotal <= 0) return;

        const slabRate = getRoomGstRateForNightlyPrice(ratePerNight, roomGstSlabs, fallbackRoomGst);

        if (inclusiveTax) {
            taxTotal += roomSubtotal - ((roomSubtotal * 100) / (100 + slabRate));
        } else {
            taxTotal += (roomSubtotal * slabRate) / 100;
        }
    });

    const roundedTaxAmount = Math.round(taxTotal);
    const effectiveRate = subtotal > 0 ? (roundedTaxAmount * 100) / subtotal : 0;

    return {
        roomCharges,
        totalDiscount,
        subtotal,
        taxAmount: roundedTaxAmount,
        effectiveRate
    };
};
