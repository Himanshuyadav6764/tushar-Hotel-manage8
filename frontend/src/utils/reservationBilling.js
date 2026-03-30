export const calculateReservationBillingSummary = (reservation = {}, settings = {}) => {
    const toNum = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const transactions = Array.isArray(reservation.transactions) ? reservation.transactions : [];
    const nights = Math.max(1, toNum(reservation?.duration?.nights ?? reservation?.nights ?? reservation?.numberOfNights, 1));

    const baseRoomGross = toNum(
        reservation?.roomCharges
            ?? reservation?.billing?.roomCharges
            ?? reservation?.billing?.roomChargesAmount,
        toNum(
            reservation?.pricePerNight
                ?? reservation?.billing?.roomRate
                ?? reservation?.rooms?.[0]?.ratePerNight,
            0
        ) * nights
    );

    const roomTax = toNum(
        reservation?.tax
            ?? reservation?.taxAmount
            ?? reservation?.billing?.tax
            ?? reservation?.billing?.taxAmount,
        0
    );

    const roomService = toNum(
        reservation?.serviceCharge
            ?? reservation?.serviceChargeAmount
            ?? reservation?.billing?.serviceCharge
            ?? reservation?.billing?.serviceChargeAmount,
        Math.round((baseRoomGross * (toNum(settings?.roomServiceCharge, 0) / 100)) * 100) / 100
    );

    const roomDiscount = toNum(
        reservation?.discount
            ?? reservation?.discountAmount
            ?? reservation?.billing?.discount
            ?? reservation?.billing?.discountAmount,
        0
    );

    const computedRoomFinal = Math.max(0, baseRoomGross + roomTax + roomService - roomDiscount);

    const isRoomChargeTransaction = (t) => {
        const text = `${t?.particulars || ''} ${t?.description || ''}`.toLowerCase();
        return t?.type?.toLowerCase() === 'charge' && (
            text.includes('room tariff')
            || text.includes('room rent')
            || text.includes('room charges')
            || text.includes('room stay')
            || String(t?.particulars || '').toLowerCase().includes('room')
        );
    };

    const hasRoomChargeTx = transactions.some((t) => Number(t?.folioId || 0) === 0 && isRoomChargeTransaction(t));
    const isMultiRoom = Array.isArray(reservation?.rooms) && reservation.rooms.length > 1;

    let roomCharges = computedRoomFinal;
    if (isMultiRoom && !hasRoomChargeTx) {
        roomCharges = reservation.rooms.reduce((sum, room) => {
            return sum + ((toNum(room?.ratePerNight) || 0) * nights) - (toNum(room?.discount) || 0);
        }, 0);
    }

    const primaryFolioId = 0;

    const primaryExtraCharges = transactions
        .filter((t) => Number(t?.folioId || 0) === primaryFolioId
            && t?.type?.toLowerCase() === 'charge'
            && !isRoomChargeTransaction(t))
        .reduce((sum, t) => sum + (Math.abs(Number(t?.amount)) || 0), 0);

    const otherFolioCharges = transactions
        .filter((t) => Number(t?.folioId || 0) !== primaryFolioId
            && t?.type?.toLowerCase() === 'charge'
            && !isRoomChargeTransaction(t))
        .reduce((sum, t) => sum + (Math.abs(Number(t?.amount)) || 0), 0);

    const totalFolioCharges = primaryExtraCharges + otherFolioCharges;

    const totalDiscounts = transactions
        .filter((t) => t?.type?.toLowerCase() === 'discount')
        .reduce((sum, t) => sum + (Math.abs(Number(t?.amount)) || 0), 0);

    const totalPaidFromTx = transactions
        .filter((t) => t?.type?.toLowerCase() === 'payment')
        .reduce((sum, t) => sum + (Math.abs(Number(t?.amount)) || 0), 0);

    const fallbackPaid = toNum(
        reservation?.paidAmount
            ?? reservation?.advancePaid
            ?? reservation?.billing?.paidAmount,
        0
    );

    const totalPaid = totalPaidFromTx > 0 ? totalPaidFromTx : fallbackPaid;

    const grandTotal = Math.max(0, roomCharges + totalFolioCharges - totalDiscounts);
    const balance = Math.max(0, grandTotal - totalPaid);

    return {
        nights,
        roomBaseAmount: Math.max(0, baseRoomGross),
        roomTax: Math.max(0, roomTax),
        roomService: Math.max(0, roomService),
        roomDiscount: Math.max(0, roomDiscount),
        roomCharges: Math.max(0, roomCharges),
        primaryExtraCharges: Math.max(0, primaryExtraCharges),
        otherFolioCharges: Math.max(0, otherFolioCharges),
        totalFolioCharges: Math.max(0, totalFolioCharges),
        totalDiscounts: Math.max(0, totalDiscounts),
        totalPaid: Math.max(0, totalPaid),
        grandTotal,
        balance
    };
};
