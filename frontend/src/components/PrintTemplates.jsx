import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { calculateRoomTaxBySlab } from '../utils/roomTax';

const PrintTemplates = ({ type, data, booking }) => {
    const { settings, getCurrencySymbol, formatDate } = useSettings();
    const cs = getCurrencySymbol();
    const format = data?.type || 'A4';

    const formatConfig = {
        A4: { pageSize: 'A4', bodyWidth: '190mm', fontSize: '13px', compact: false },
        A5: { pageSize: 'A5', bodyWidth: '130mm', fontSize: '12px', compact: false },
        Thermal: { pageSize: '80mm auto', bodyWidth: '72mm', fontSize: '10px', compact: true },
        'Dot Matrix': { pageSize: 'A4', bodyWidth: '190mm', fontSize: '12px', compact: false },
        '3 inch': { pageSize: '76mm auto', bodyWidth: '70mm', fontSize: '10px', compact: true },
        '2 inch': { pageSize: '58mm auto', bodyWidth: '54mm', fontSize: '9px', compact: true }
    };

    const cfg = formatConfig[format] || formatConfig.A4;
    const isNarrow = cfg.compact;

    const toNumber = (value, fallback = 0) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    };

    const pickNumber = (...values) => {
        for (const value of values) {
            if (value === null || value === undefined || value === '') continue;
            const num = Number(value);
            if (Number.isFinite(num)) return num;
        }
        return undefined;
    };

    const safeText = (value, fallback = 'N/A') => {
        if (value === null || value === undefined) return fallback;
        const text = String(value).trim();
        return text ? text : fallback;
    };

    const bookingRef = safeText(
        booking?.referenceNumber || booking?.bookingReferenceId || booking?.bookingId || booking?._id || booking?.id,
        '-'
    );
    const nights = toNumber(booking?.nights ?? booking?.numberOfNights, 1);
    const billing = booking?.billing || {};
    const roomCount = Math.max(1, Array.isArray(booking?.rooms) && booking.rooms.length > 0 ? booking.rooms.length : toNumber(booking?.numberOfRooms, 1));
    const transactions = Array.isArray(booking?.transactions) ? booking.transactions : [];

    const roomRows = Array.isArray(booking?.rooms) && booking.rooms.length > 0
        ? booking.rooms.map((r) => ({
            ratePerNight: toNumber(r?.ratePerNight ?? r?.roomRate ?? r?.pricePerNight ?? r?.price, 0),
            discount: toNumber(r?.discount ?? r?.discountAmount, 0)
        }))
        : [{
            ratePerNight: toNumber(booking?.pricePerNight ?? booking?.roomRate ?? booking?.ratePerNight ?? billing?.roomRate ?? billing?.pricePerNight, 0),
            discount: toNumber(booking?.roomLevelDiscount ?? billing?.roomLevelDiscount, 0)
        }];

    const slabTax = calculateRoomTaxBySlab({
        rooms: roomRows,
        nights,
        taxExempt: false,
        inclusiveTax: settings?.inclusiveTax,
        roomGstSlabs: settings?.roomGstSlabs,
        fallbackRoomGst: settings?.roomGst
    });

    const txSum = (matcher) => transactions
        .filter((t) => matcher((`${t.particulars || ''} ${t.description || ''}`).toLowerCase(), t))
        .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);

    const roomChargesFromTx = txSum((text, t) =>
        t.type?.toLowerCase() === 'charge' &&
        (text.includes('room charge') || text.includes('room tariff') || text.includes('room rent') || text.includes('accommodation'))
    );

    const serviceChargeFromTx = txSum((text, t) =>
        t.type?.toLowerCase() === 'charge' &&
        text.includes('service charge')
    );

    const discountFromTx = txSum((text, t) => {
        const kind = (t.type || '').toLowerCase();
        return kind === 'discount' || text.includes('discount');
    });

    const roomChargesFromRows = Array.isArray(booking?.rooms) && booking.rooms.length > 0
        ? booking.rooms.reduce((sum, r) => {
            const nightly = toNumber(r?.ratePerNight ?? r?.roomRate ?? r?.pricePerNight ?? r?.price, 0);
            return sum + (nightly * Math.max(1, nights));
        }, 0)
        : 0;

    const baseRoomRate = toNumber(
        booking?.pricePerNight ?? booking?.roomRate ?? booking?.ratePerNight ?? billing?.roomRate ?? billing?.pricePerNight,
        0
    );

    const roomChargesFallback = roomChargesFromRows || (baseRoomRate * Math.max(1, nights) * roomCount);

    const roomCharges = pickNumber(
        booking?.roomCharges,
        booking?.baseRoomCharges,
        billing?.roomCharges,
        billing?.roomChargesAmount
    ) ?? (roomChargesFromTx || roomChargesFallback || slabTax.roomCharges);

    const explicitServiceCharge = pickNumber(
        booking?.serviceCharge,
        booking?.serviceChargeAmount,
        billing?.serviceCharge,
        billing?.serviceChargeAmount
    ) ?? serviceChargeFromTx;

    const autoDiscountAmount = pickNumber(booking?.autoDiscountAmount, billing?.autoDiscountAmount) ?? 0;
    const manualDiscountAmount = pickNumber(booking?.manualDiscountAmount, billing?.manualDiscountAmount) ?? 0;

    const discountAmount = pickNumber(
        booking?.discount,
        booking?.discountAmount,
        booking?.totalDiscount,
        billing?.discount,
        billing?.discountAmount
    ) ?? (autoDiscountAmount + manualDiscountAmount || discountFromTx);

    const derivedServiceCharge = Math.max(0, roomCharges - discountAmount) * ((parseFloat(settings?.roomServiceCharge ?? settings?.serviceCharge) || 0) / 100);
    const serviceCharge = explicitServiceCharge > 0 ? explicitServiceCharge : derivedServiceCharge;

    const taxAmount = pickNumber(
        booking?.tax,
        booking?.taxAmount,
        billing?.tax,
        billing?.taxAmount
    ) ?? slabTax.taxAmount;

    const storedGrandTotal = pickNumber(
        billing?.totalAmount,
        booking?.totalAmount,
        booking?.grandTotal,
        booking?.amount
    );

    const grossBeforeDiscount = Math.max(0, roomCharges + serviceCharge + taxAmount);
    const derivedDiscountFromTotals = storedGrandTotal !== undefined
        ? Math.max(0, grossBeforeDiscount - Number(storedGrandTotal || 0))
        : 0;
    const effectiveDiscountAmount = discountAmount > 0 ? discountAmount : derivedDiscountFromTotals;

    const subtotal = Math.max(roomCharges + serviceCharge - effectiveDiscountAmount, 0);
    const totalAmount = Math.max(0, roomCharges + serviceCharge + taxAmount - effectiveDiscountAmount);

    const paidAmount = toNumber(
        booking?.paidAmount ?? booking?.advanceAmount ?? booking?.amountPaid,
        txSum((_, t) => t.type?.toLowerCase() === 'payment')
    );

    const latestPaymentTx = [...transactions]
        .filter((t) => t.type?.toLowerCase() === 'payment')
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())[0];

    const paymentModeUsed = safeText(
        booking?.paymentMode ?? booking?.billing?.paymentMode ?? latestPaymentTx?.method,
        'Cash'
    );

    const balanceDue = pickNumber(
        booking?.balanceDue,
        booking?.balanceAmount,
        billing?.balanceAmount
    ) ?? Math.max(totalAmount - paidAmount, 0);

    const pageStyle = `@media print { @page { size: ${cfg.pageSize}; margin: ${isNarrow ? '4mm' : '10mm'}; } }`;

    const Header = () => (
        <div className="print-header" style={{
            textAlign: 'center',
            marginBottom: isNarrow ? '8px' : '18px',
            borderBottom: '2px solid #000',
            paddingBottom: isNarrow ? '5px' : '10px'
        }}>
            {settings.displayLogoOnBill && settings.logoUrl && (
                <img
                    src={settings.logoUrl}
                    alt="Hotel Logo"
                    style={{ maxHeight: isNarrow ? '34px' : '52px', objectFit: 'contain', marginBottom: '4px' }}
                />
            )}
            <h1 style={{ margin: '0 0 5px 0', fontSize: isNarrow ? '14px' : '22px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {safeText(settings.name, 'Hotel')}
            </h1>
            <p style={{ margin: '2px 0', fontSize: isNarrow ? '9px' : '12px' }}>
                {[settings.address, settings.city, settings.state, settings.pin].filter(Boolean).join(', ') || 'Address not set'}
            </p>
            <p style={{ margin: '2px 0', fontSize: isNarrow ? '9px' : '12px' }}>
                Phone: {safeText(settings.phone, '-')} | GSTIN: {safeText(settings.gstNumber, '-')}
            </p>
            <p style={{ margin: '2px 0', fontSize: isNarrow ? '9px' : '12px' }}>
                PAN: {safeText(settings.panNumber, '-')} | Format: {safeText(settings.billPrintFormat, 'Hotel Invoice')}
            </p>
        </div>
    );

    const Footer = () => (
        <div className="print-footer" style={{
            marginTop: isNarrow ? '14px' : '24px',
            textAlign: 'center',
            fontSize: isNarrow ? '9px' : '11px',
            borderTop: '1px solid #eee',
            paddingTop: isNarrow ? '6px' : '10px'
        }}>
            <p style={{ margin: '4px 0' }}>{safeText(settings.thankYouMessage, 'Thank you for choosing us!')}</p>
            <p style={{ margin: '2px 0', color: '#666' }}>This is a computer-generated document.</p>
        </div>
    );

    const amount = (value) => `${cs}${toNumber(value, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const foodGstPercent = toNumber(settings?.cgst, 0) + toNumber(settings?.sgst, 0) || toNumber(settings?.foodGst, 0);
    const foodServicePercent = toNumber(settings?.serviceCharge ?? settings?.roomServiceCharge, 0);

    const parsePossibleJson = (value) => {
        if (!value) return null;
        if (typeof value === 'object') return value;
        if (typeof value !== 'string') return null;
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    };

    const asPositive = (value) => Math.abs(toNumber(value, 0));

    const getTxDate = (tx) => tx.date || tx.createdAt || tx.updatedAt || booking?.createdAt || new Date().toISOString();

    const getTxUser = (tx) => safeText(
        tx.user || tx.userName || tx.createdByName || tx.createdBy || tx.staffName || tx.source,
        'System'
    );

    const getBillingMeta = (tx) => {
        const candidates = [
            tx.billingMeta,
            tx.meta,
            tx.details,
            parsePossibleJson(tx.billingMeta),
            parsePossibleJson(tx.meta),
            parsePossibleJson(tx.details)
        ];

        for (const item of candidates) {
            if (item && typeof item === 'object') return item;
        }

        return {};
    };

    const resolvePaymentSplits = (tx) => {
        const meta = getBillingMeta(tx);
        const raw = tx.paymentSplits || tx.splitPayments || meta.paymentSplits || meta.splitPayments || null;
        const parsed = parsePossibleJson(raw) || raw;

        const normalized = {};
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            Object.entries(parsed).forEach(([key, value]) => {
                const amt = asPositive(value);
                if (amt > 0) normalized[key] = amt;
            });
        }

        if (Object.keys(normalized).length > 0) return normalized;

        const mode = tx.paymentMode || meta.paymentMode || meta.mode;
        const lineAmount = asPositive(tx.amount);
        if (mode && lineAmount > 0) {
            return { [String(mode).toLowerCase()]: lineAmount };
        }

        return {};
    };

    const extractAmountFromText = (text, labels = []) => {
        const raw = String(text || '');
        if (!raw) return 0;

        const chunks = raw.split('|').map(c => c.trim());
        for (const label of labels) {
            const chunk = chunks.find(c => c.toLowerCase().includes(label.toLowerCase()));
            if (chunk) {
                const matches = [...chunk.matchAll(/[0-9]+(?:\.[0-9]+)?/g)];
                if (matches.length > 0) return asPositive(matches[matches.length - 1][0]);
            }
        }

        for (const label of labels) {
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const match = raw.match(new RegExp(`${escaped}[^0-9-]*([0-9]+(?:\\.[0-9]+)?)`, 'i'));
            if (match) return asPositive(match[1]);
        }

        return 0;
    };

    const getTaxBreakup = (tx, meta) => {
        const rawText = `${tx?.description || ''} | ${tx?.notes || ''}`;
        const cgst = asPositive(meta.cgstAmount ?? meta.cgst ?? tx.cgstAmount ?? tx.cgst);
        const sgst = asPositive(meta.sgstAmount ?? meta.sgst ?? tx.sgstAmount ?? tx.sgst);
        const igst = asPositive(meta.igstAmount ?? meta.igst ?? tx.igstAmount ?? tx.igst);
        const foodGst = asPositive(meta.foodGstAmount ?? meta.foodGSTAmount ?? meta.foodGst ?? tx.foodGstAmount ?? tx.foodGst);
        const roomGst = asPositive(meta.roomGstAmount ?? meta.roomGSTAmount ?? meta.roomGst ?? tx.roomGstAmount ?? tx.roomGst);
        const genericTax = asPositive(meta.taxAmount ?? meta.tax ?? tx.taxAmount ?? tx.tax);

        const parsedCgst = extractAmountFromText(rawText, ['CGST']);
        const parsedSgst = extractAmountFromText(rawText, ['SGST']);
        const parsedIgst = extractAmountFromText(rawText, ['IGST']);
        const parsedFoodGst = extractAmountFromText(rawText, ['Food GST']);
        const parsedRoomGst = extractAmountFromText(rawText, ['Room GST']);

        let otherTax = 0;
        const resolvedCgst = cgst || parsedCgst;
        const resolvedSgst = sgst || parsedSgst;
        const resolvedIgst = igst || parsedIgst;
        const resolvedFoodGst = foodGst || parsedFoodGst;
        const resolvedRoomGst = roomGst || parsedRoomGst;

        const explicitTotal = resolvedCgst + resolvedSgst + resolvedIgst + resolvedFoodGst + resolvedRoomGst;
        if (genericTax > explicitTotal) {
            otherTax = genericTax - explicitTotal;
        }

        return {
            cgst: resolvedCgst,
            sgst: resolvedSgst,
            igst: resolvedIgst,
            foodGst: resolvedFoodGst,
            roomGst: resolvedRoomGst,
            otherTax,
            totalTax: explicitTotal + otherTax
        };
    };

    const buildLine = (tx, index) => {
        const meta = getBillingMeta(tx);
        const type = String(tx.type || '').toLowerCase();
        const rawDate = getTxDate(tx);
        const sortTime = new Date(rawDate).getTime();
        const netAmount = asPositive(tx.amount);
        const rawText = `${tx?.description || ''} | ${tx?.notes || ''}`;

        let discount = asPositive(meta.discountAmount ?? meta.discount ?? tx.discountAmount ?? tx.discount)
            || extractAmountFromText(rawText, ['Discount']);
        let service = asPositive(meta.serviceChargeAmount ?? meta.serviceCharge ?? tx.serviceChargeAmount ?? tx.serviceCharge)
            || extractAmountFromText(rawText, ['Service Charge', 'Service']);

        const taxes = getTaxBreakup(tx, meta);
        const particulars = safeText(tx.particulars || tx.particular || tx.label || tx.category || (type === 'payment' ? 'Payment' : 'Charge'));

        let baseAmount = asPositive(meta.grossAmount ?? meta.subTotal ?? meta.taxableAmount ?? tx.grossAmount);
        if (baseAmount <= 0) {
            baseAmount = extractAmountFromText(rawText, ['Gross Amt', 'Gross Amount', 'Gross', 'Taxable']);
        }

        const isRoom = particulars.toLowerCase().includes('room') || type === 'room';
        const isFood = particulars.toLowerCase().includes('restaurant') || particulars.toLowerCase().includes('food') || type === 'food';

        if (isFood && taxes.foodGst > 0 && taxes.cgst === 0 && taxes.sgst === 0) {
            const halfFoodGst = Number((taxes.foodGst / 2).toFixed(2));
            taxes.cgst = halfFoodGst;
            taxes.sgst = Number((taxes.foodGst - halfFoodGst).toFixed(2));
        }

        if (isFood && baseAmount > 0 && taxes.totalTax === 0 && service === 0 && (foodGstPercent > 0 || foodServicePercent > 0)) {
            const targetBeforeDiscount = Math.max(0, netAmount + discount);
            const denom = 1 + (foodGstPercent / 100) + (foodServicePercent / 100);
            const inferredBase = denom > 0 ? targetBeforeDiscount / denom : targetBeforeDiscount;
            const inferredGst = inferredBase * (foodGstPercent / 100);
            const inferredService = inferredBase * (foodServicePercent / 100);

            baseAmount = Number(inferredBase.toFixed(2));
            service = Number(inferredService.toFixed(2));

            const halfGst = Number((inferredGst / 2).toFixed(2));
            taxes.cgst = halfGst;
            taxes.sgst = Number((inferredGst - halfGst).toFixed(2));
            taxes.foodGst = 0;
            taxes.totalTax = Number(inferredGst.toFixed(2));
        }

        if (isRoom && taxes.totalTax === 0 && taxAmount > 0) {
            const halfTax = Number((taxAmount / 2).toFixed(2));
            taxes.cgst = halfTax;
            taxes.sgst = halfTax;
            taxes.totalTax = taxAmount;
            if (discount === 0) discount = toNumber(booking?.discount ?? booking?.billing?.discount, 0);
        }

        if (baseAmount > 0) {
            const impliedTax = netAmount - baseAmount + discount - service;
            if (impliedTax > 0.01 && Math.abs(impliedTax - taxes.totalTax) > 0.01) {
                const diff = impliedTax - taxes.totalTax;
                if (diff > 0) {
                    if (isFood || isRoom) {
                        const halfDiff = Number((diff / 2).toFixed(2));
                        taxes.cgst = (taxes.cgst || 0) + halfDiff;
                        taxes.sgst = (taxes.sgst || 0) + halfDiff;
                    } else {
                        taxes.otherTax = (taxes.otherTax || 0) + diff;
                    }
                    taxes.totalTax = impliedTax;
                }
            } else if (impliedTax < -0.01) {
                baseAmount = netAmount + discount - service - taxes.totalTax;
            }
        }

        if (baseAmount <= 0) {
            const derive = netAmount + discount - service - taxes.totalTax;
            baseAmount = derive > 0 ? derive : netAmount;
        }

        const description = safeText(tx.description || tx.remarks || meta.description || tx.note || '-', '-');

        return {
            id: tx._id || tx.id || `${type || 'line'}-${index}`,
            day: formatDate(rawDate),
            sortTime: Number.isFinite(sortTime) ? sortTime : 0,
            particulars,
            description,
            type: isRoom ? 'room' : isFood ? 'food' : (particulars.toLowerCase().includes('laundry') ? 'laundry' : type),
            baseAmount: Number(baseAmount.toFixed(2)),
            discount: Number(discount.toFixed(2)),
            service: Number(service.toFixed(2)),
            ...taxes,
            lineAmount: netAmount,
            user: getTxUser(tx),
            paymentSplits: resolvePaymentSplits(tx)
        };
    };

    const transactionLines = Array.isArray(booking?.transactions)
        ? booking.transactions.map((tx, index) => buildLine(tx, index))
        : [];

    const sortedLines = [...transactionLines].sort((a, b) => {
        return a.sortTime - b.sortTime;
    });

    const chargeLines = sortedLines.filter((line) => line.type !== 'payment');
    const paymentLines = sortedLines.filter((line) => line.type === 'payment');

    const totals = sortedLines.reduce((acc, line) => {
        if (line.type === 'payment') {
            acc.paid += line.lineAmount;
            Object.entries(line.paymentSplits).forEach(([mode, value]) => {
                acc.paymentSplitTotals[mode] = (acc.paymentSplitTotals[mode] || 0) + asPositive(value);
            });
        } else {
            acc.subTotal += line.lineAmount;
            acc.base += line.baseAmount;
            acc.discount += line.discount;
            acc.service += line.service;
            acc.foodGst += line.foodGst;
            acc.roomGst += line.roomGst;
            acc.cgst += line.cgst;
            acc.sgst += line.sgst;
            acc.igst += line.igst;
            acc.otherTax += line.otherTax;
            acc.taxTotal += line.totalTax;
        }
        return acc;
    }, {
        base: 0,
        discount: 0,
        service: 0,
        foodGst: 0,
        roomGst: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        otherTax: 0,
        taxTotal: 0,
        subTotal: 0,
        paid: 0,
        paymentSplitTotals: {}
    });

    const fallbackSubTotal = totals.subTotal > 0 ? totals.subTotal : subtotal;
    const fallbackPaid = totals.paid > 0 ? totals.paid : paidAmount;
    const fallbackBalance = Math.max(0, fallbackSubTotal - fallbackPaid);
    const fallbackGrandTotal = fallbackSubTotal;

    const renderBillBlock = () => (
        <div style={{ marginBottom: isNarrow ? '10px' : '20px' }}>
            <h3 style={{
                margin: '0 0 8px 0',
                fontSize: isNarrow ? '10px' : '13px',
                borderBottom: '1px solid #ccc',
                paddingBottom: '4px',
                textTransform: 'uppercase'
            }}>
                Folio Bill Details
            </h3>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
                <tbody>
                    {chargeLines.length === 0 && (
                        <tr>
                            <td colSpan={2} style={{ padding: isNarrow ? '6px' : '10px', border: '1px solid #eee', textAlign: 'center' }}>
                                No charge items found in folio.
                            </td>
                        </tr>
                    )}

                    {chargeLines.map((line) => (
                        <React.Fragment key={line.id}>
                            <tr style={{ backgroundColor: '#f7f7f7' }}>
                                <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee', fontWeight: 700 }}>
                                    {line.particulars}
                                    <div style={{ fontWeight: 500, fontSize: isNarrow ? '8px' : '10px', marginTop: '2px', color: '#4b5563' }}>
                                        {line.description}
                                    </div>
                                </td>
                                <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee', fontWeight: 700 }}>{amount(line.lineAmount)}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Gross Amount</td>
                                <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(line.baseAmount)}</td>
                            </tr>
                            {line.discount > 0 && (
                                <tr>
                                    <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Discount</td>
                                    <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(line.discount)}</td>
                                </tr>
                            )}
                            {line.service > 0 && (
                                <tr>
                                    <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Service Charge</td>
                                    <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(line.service)}</td>
                                </tr>
                            )}
                            {line.cgst > 0 && (
                                <tr>
                                    <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>CGST</td>
                                    <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(line.cgst)}</td>
                                </tr>
                            )}
                            {line.sgst > 0 && (
                                <tr>
                                    <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>SGST</td>
                                    <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(line.sgst)}</td>
                                </tr>
                            )}
                            {line.igst > 0 && (
                                <tr>
                                    <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>IGST</td>
                                    <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(line.igst)}</td>
                                </tr>
                            )}
                            {line.foodGst > 0 && (
                                <tr>
                                    <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Food GST</td>
                                    <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(line.foodGst)}</td>
                                </tr>
                            )}
                            {line.roomGst > 0 && (
                                <tr>
                                    <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Room GST</td>
                                    <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(line.roomGst)}</td>
                                </tr>
                            )}
                            {line.otherTax > 0 && (
                                <tr>
                                    <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Other Tax</td>
                                    <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(line.otherTax)}</td>
                                </tr>
                            )}
                            <tr>
                                <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee', fontWeight: 700 }}>Total</td>
                                <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee', fontWeight: 700 }}>{amount(line.lineAmount)}</td>
                            </tr>
                        </React.Fragment>
                    ))}
                </tbody>
            </table>

            <div style={{
                display: 'grid',
                gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
                gap: isNarrow ? '8px' : '12px',
                marginBottom: '10px'
            }}>
                <div style={{ border: '1px solid #ddd', padding: isNarrow ? '6px' : '10px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', fontSize: isNarrow ? '9px' : '11px' }}>Charges Breakup</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Base Amount</span><strong>{amount(totals.base)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><strong>{amount(totals.discount)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Service</span><strong>{amount(totals.service)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CGST</span><strong>{amount(totals.cgst)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SGST</span><strong>{amount(totals.sgst)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>IGST</span><strong>{amount(totals.igst)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Food GST</span><strong>{amount(totals.foodGst)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Room GST</span><strong>{amount(totals.roomGst)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Other Tax</span><strong>{amount(totals.otherTax)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', marginTop: '4px', paddingTop: '4px' }}><span>Total Taxes</span><strong>{amount(totals.taxTotal)}</strong></div>
                </div>

                <div style={{ border: '1px solid #ddd', padding: isNarrow ? '6px' : '10px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', fontSize: isNarrow ? '9px' : '11px' }}>Payments</div>
                    {paymentLines.length === 0 && (
                        <div style={{ color: '#6b7280' }}>No payment entries</div>
                    )}
                    {paymentLines.map((line) => (
                        <div key={`pay-${line.id}`} style={{ marginBottom: '6px', borderBottom: '1px dashed #ddd', paddingBottom: '5px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{line.particulars}</span>
                                <strong>{amount(line.lineAmount)}</strong>
                            </div>
                            <div style={{ fontSize: isNarrow ? '8px' : '10px', color: '#4b5563' }}>{line.description}</div>
                        </div>
                    ))}
                    <div style={{ fontWeight: 700, marginTop: '8px', marginBottom: '4px' }}>Split by Mode</div>
                    {Object.keys(totals.paymentSplitTotals).length === 0 && (
                        <div style={{ color: '#6b7280' }}>No split data</div>
                    )}
                    {Object.entries(totals.paymentSplitTotals).map(([mode, value]) => (
                        <div key={mode} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{mode.toUpperCase()}</span>
                            <strong>{amount(value)}</strong>
                        </div>
                    ))}
                </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                    <tr>
<<<<<<< HEAD
                        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>
                            Room Charges ({safeText(booking?.roomType || booking?.rooms?.[0]?.categoryId, 'Room')}) x {nights}
                        </td>
                        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>
                            {amount(roomCharges)}
                        </td>
                    </tr >
                    <tr>
                        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Service Charges</td>
                        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>
                            {amount(serviceCharge)}
                        </td>
                    </tr>
                    <tr>
                        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Discount Applied</td>
                        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee', color: '#059669', fontWeight: 700 }}>
                            -{amount(effectiveDiscountAmount)}
                        </td>
=======
                        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee', fontWeight: 700 }}>Sub Total</td>
        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee', fontWeight: 700 }}>{amount(fallbackSubTotal)}</td>
>>>>>>> origin/main
    </tr>
    <tr>
        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee', fontWeight: 700 }}>Grand Total</td>
        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee', fontWeight: 700 }}>{amount(fallbackGrandTotal)}</td>
    </tr>
    <tr>
        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Paid</td>
        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(fallbackPaid)}</td>
    </tr>
    <tr>
        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Total Paid</td>
        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(fallbackPaid)}</td>
    </tr>
    <tr>
        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Current Balance</td>
        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(fallbackBalance)}</td>
    </tr>
    <tr style={{ color: fallbackBalance > 0 ? '#b91c1c' : '#047857', fontWeight: 700 }}>
        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Remaining</td>
        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(fallbackBalance)}</td>
    </tr>
                </tbody >
            </table >
        </div >
    );

const renderDocMeta = (title) => (
    <div style={{ marginBottom: isNarrow ? '8px' : '14px' }}>
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f3f4f6',
            border: '1px solid #ddd',
            padding: isNarrow ? '6px' : '10px',
            gap: '8px'
        }}>
            <h2 style={{ margin: 0, fontSize: isNarrow ? '11px' : '16px', textTransform: 'uppercase' }}>{title}</h2>
            <div style={{ textAlign: 'right', fontSize: isNarrow ? '9px' : '12px' }}>
                <div><strong>Doc No:</strong> {safeText(booking?.invoiceId || booking?.invoiceNumber || `${safeText(settings.billingInvoicePrefix || settings.invoicePrefix, 'INV')}${bookingRef}`)}</div>
                <div><strong>Date:</strong> {formatDate(new Date())}</div>
            </div>
        </div>
    </div>
);

const renderGuestAndStay = () => (
    <div style={{
        display: 'grid',
        gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
        gap: isNarrow ? '8px' : '20px',
        marginBottom: isNarrow ? '8px' : '16px'
    }}>
        <div style={{ border: '1px solid #ddd', padding: isNarrow ? '6px' : '10px' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 700, textTransform: 'uppercase', fontSize: isNarrow ? '9px' : '11px' }}>Guest Details</p>
            <p style={{ margin: '3px 0' }}><strong>Name:</strong> {safeText(booking?.guestName)}</p>
            <p style={{ margin: '3px 0' }}><strong>Phone:</strong> {safeText(booking?.guestPhone || booking?.mobileNumber, '-')}</p>
            <p style={{ margin: '3px 0' }}><strong>Email:</strong> {safeText(booking?.guestEmail || booking?.email, '-')}</p>
        </div>
        <div style={{ border: '1px solid #ddd', padding: isNarrow ? '6px' : '10px' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 700, textTransform: 'uppercase', fontSize: isNarrow ? '9px' : '11px' }}>Stay Details</p>
            <p style={{ margin: '3px 0' }}><strong>Booking Ref:</strong> {bookingRef}</p>
            <p style={{ margin: '3px 0' }}><strong>Room:</strong> {safeText(booking?.roomNumber, 'TBD')} ({safeText(booking?.roomType || booking?.rooms?.[0]?.categoryId, 'N/A')})</p>
            <p style={{ margin: '3px 0' }}><strong>Check-in:</strong> {formatDate(booking?.checkInDate)}</p>
            <p style={{ margin: '3px 0' }}><strong>Check-out:</strong> {formatDate(booking?.checkOutDate)}</p>
            <p style={{ margin: '3px 0' }}><strong>Nights:</strong> {nights}</p>
        </div>
    </div>
);

const renderFolioPrint = () => (
    <div className="thermal-print" style={{
        fontFamily: '"Inter", sans-serif',
        color: '#111',
        margin: '0 auto',
        width: '100%',
        maxWidth: '300px',
        fontSize: '11px',
        lineHeight: '1.4'
    }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            {settings.displayLogoOnBill && settings.logoUrl && (
                <img src={settings.logoUrl} alt="Logo" style={{ maxHeight: '40px', objectFit: 'contain', marginBottom: '5px' }} />
            )}
            <h1 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold' }}>{safeText(settings.name, 'Hotel Name')}</h1>

            <hr style={{ border: 'none', borderTop: '1px solid #000', margin: '4px 0' }} />

            <p style={{ margin: '2px 0' }}>{[settings.address, settings.city, `Pincode ${settings.pin}`].filter(Boolean).join(', ')}</p>
            <p style={{ margin: '2px 0' }}>Phone: {safeText(settings.phone, '-')} | Email: {safeText(settings.email, 'info@hotelname.com')}</p>

            <hr style={{ border: 'none', borderTop: '1px solid #000', margin: '4px 0 8px 0' }} />

            <h2 style={{ margin: '0', fontSize: '14px', fontWeight: 'bold' }}>Guest Folio</h2>
        </div>

        {/* Meta Data */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
            <div>Folio No: {bookingRef}</div>
            <div style={{ textAlign: 'right' }}>Date: {formatDate(new Date())}</div>
            <div>Room No: {safeText(booking?.roomNumber, 'TBD')}</div>
            <div style={{ textAlign: 'right' }}>Room No: {safeText(booking?.roomNumber, 'TBD')}</div>
            <div>Guest Name: {safeText(booking?.guestName, '-')}</div>
            <div style={{ textAlign: 'right' }}>Guest Sprmas</div>
        </div>

        {/* List Format per Particular */}
        {chargeLines.map((line, idx) => {
            const lineType = String(line.type || '').toLowerCase();
            const particularText = String(line.particulars || '').toLowerCase();
            const isFoodLine = lineType === 'food' || particularText.includes('restaurant') || particularText.includes('food');
            const isLaundryLine = lineType === 'laundry' || particularText.includes('laundry');
            const isRoomLine = lineType === 'room' || particularText.includes('room');
            const combinedFoodGst = isFoodLine
                ? Number(((line.foodGst || 0) + (line.cgst || 0) + (line.sgst || 0)).toFixed(2))
                : 0;

            return (
                <div key={line.id || idx} style={{ marginBottom: '8px' }}>
                    {/* Block Header */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', backgroundColor: '#e5e7eb', padding: '3px 4px', fontWeight: 'bold'
                    }}>
                        <span>{line.particulars}</span>
                        <span>{amount(line.lineAmount)}</span>
                    </div>

                    {/* Breakdown */}
                    <div style={{ padding: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>
                                {isRoomLine
                                    ? `Room Stay (${nights} night${nights > 1 ? 's' : ''})`
                                    : isFoodLine
                                        ? 'Food Price'
                                        : isLaundryLine
                                            ? 'Laundry Price'
                                            : 'Gross Amt'}
                            </span>
                            <span>{amount(line.baseAmount)}</span>
                        </div>
                        {line.discount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Discount</span>
                                <span>{amount(line.discount)}</span>
                            </div>
                        )}
                        {isFoodLine && combinedFoodGst > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Food GST (CGST + SGST)</span>
                                <span>{amount(combinedFoodGst)}</span>
                            </div>
                        )}
                        {!isFoodLine && line.cgst > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{isLaundryLine ? 'Laundry GST (CGST)' : 'CGST'}</span>
                                <span>{amount(line.cgst)}</span>
                            </div>
                        )}
                        {!isFoodLine && line.sgst > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{isLaundryLine ? 'Laundry GST (SGST)' : 'SGST'}</span>
                                <span>{amount(line.sgst)}</span>
                            </div>
                        )}
                        {line.igst > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>IGST</span>
                                <span>{amount(line.igst)}</span>
                            </div>
                        )}
                        {!isFoodLine && line.foodGst > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Food GST</span>
                                <span>{amount(line.foodGst)}</span>
                            </div>
                        )}
                        {line.roomGst > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Room GST</span>
                                <span>{amount(line.roomGst)}</span>
                            </div>
                        )}
                        {(isFoodLine || line.service > 0) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Service Charge</span>
                                <span>{amount(line.service)}</span>
                            </div>
                        )}
                        {line.otherTax > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Other Tax</span>
                                <span>{amount(line.otherTax)}</span>
                            </div>
                        )}
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '2px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px', fontWeight: 'bold' }}>
                        <span>Total</span>
                        <span>Total: {amount(line.lineAmount)}</span>
                    </div>
                </div>
            );
        })}

        <hr style={{ border: 'none', borderTop: '1px solid #d1d5db', margin: '10px 0' }} />

        {/* Summary Block */}
        <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Sub Total</span>
                <span style={{ fontWeight: 'bold', color: '#b91c1c' }}>Total: {amount(fallbackSubTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontSize: '10px' }}>
                <span>Grand Total</span>
                <span style={{ fontWeight: 'bold', color: '#b91c1c' }}>{amount(fallbackGrandTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Paid</span>
                <span style={{ fontWeight: 'bold', color: '#047857' }}>{amount(fallbackPaid)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Remaining</span>
                <span style={{ fontWeight: 'bold', color: '#047857' }}>Current Balance: {amount(fallbackBalance)}</span>
            </div>
        </div>

        {/* Footer */}
        <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '10px 0' }} />
        <div style={{ textAlign: 'center', fontStyle: 'italic', fontWeight: 'bold' }}>
            Thank You!
        </div>
    </div>
);

const renderSummary = () => (
    <div className="print-summary">
<<<<<<< HEAD
<Header />
{ renderDocMeta('Reservation Summary') }
{ renderGuestAndStay() }
{ renderBillBlock() }
            <div style={{ fontSize: isNarrow ? '9px' : '11px' }}>
                <p style={{ margin: '2px 0' }}><strong>Invoice Prefix:</strong> {safeText(settings.billingInvoicePrefix || settings.invoicePrefix, '-')}</p>
                <p style={{ margin: '2px 0' }}><strong>Payment Mode:</strong> {paymentModeUsed}</p>
                <p style={{ margin: '2px 0' }}><strong>Print Type:</strong> {format}</p>
            </div>
            <Footer />
=======
            {format === 'Thermal' || format === '3 inch' || format === '2 inch' ? renderFolioPrint() : (
                <>
                    <Header />
                    {renderDocMeta('Reservation Summary')}
                    {renderGuestAndStay()}
                    {renderBillBlock()}
                    <div style={{ fontSize: isNarrow ? '9px' : '11px' }}>
                        <p style={{ margin: '2px 0' }}><strong>Invoice Prefix:</strong> {safeText(settings.billingInvoicePrefix || settings.invoicePrefix, '-')}</p>
                        <p style={{ margin: '2px 0' }}><strong>Payment Modes:</strong> {paymentModes.length ? paymentModes.join(', ') : 'N/A'}</p>
                        <p style={{ margin: '2px 0' }}><strong>Print Type:</strong> {format}</p>
                    </div>
                    <Footer />
                </>
            )}
>>>>>>> origin/main
        </div >
    );

const renderGRC = (person = null) => {
    const p = person || { name: booking?.guestName, phone: booking?.guestPhone || booking?.mobileNumber, type: 'Main Guest' };
    return (
        <div className="print-grc" style={{ pageBreakAfter: 'always' }}>
            <Header />
            <div style={{ textAlign: 'center', backgroundColor: '#f3f4f6', padding: isNarrow ? '6px' : '10px', marginBottom: isNarrow ? '10px' : '20px' }}>
                <h2 style={{ margin: 0, fontSize: isNarrow ? '11px' : '18px' }}>GUEST REGISTRATION CARD (GRC)</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: isNarrow ? '10px' : '20px', marginBottom: isNarrow ? '10px' : '20px' }}>
                <div style={{ border: '1px solid #ddd', padding: isNarrow ? '8px' : '15px' }}>
                    <p style={{ color: '#666', fontSize: '11px', margin: '0 0 5px 0' }}>GUEST DETAILS</p>
                    <p style={{ fontSize: '16px', margin: '0 0 5px 0' }}><strong>{p.name}</strong></p>
                    <p style={{ margin: '2px 0' }}>Type: {p.type}</p>
                    <p style={{ margin: '2px 0' }}>Phone: {p.phone}</p>
                    {p.email && <p style={{ margin: '2px 0' }}>Email: {p.email}</p>}
                </div>
                <div style={{ border: '1px solid #ddd', padding: isNarrow ? '8px' : '15px' }}>
                    <p style={{ color: '#666', fontSize: '11px', margin: '0 0 5px 0' }}>STAY DETAILS</p>
                    <p style={{ margin: '2px 0' }}><strong>Ref:</strong> {bookingRef}</p>
                    <p style={{ margin: '2px 0' }}><strong>Room:</strong> {safeText(booking?.roomNumber, 'TBD')} ({safeText(booking?.roomType, 'N/A')})</p>
                    <p style={{ margin: '2px 0' }}><strong>Check-in:</strong> {formatDate(booking?.checkInDate)}</p>
                    <p style={{ margin: '2px 0' }}><strong>Check-out:</strong> {formatDate(booking?.checkOutDate)}</p>
                </div>
            </div>

            <div style={{ border: '1px solid #ddd', padding: isNarrow ? '8px' : '15px', marginBottom: isNarrow ? '10px' : '20px', minHeight: isNarrow ? '70px' : '100px' }}>
                <p style={{ color: '#666', fontSize: '11px', margin: '0 0 10px 0' }}>ID PROOF / ADDRESS</p>
                <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '20px' }}>
                    <div>Type: ___________________</div>
                    <div>Number: _________________</div>
                </div>
                <div style={{ marginTop: '20px' }}>
                    Address: ___________________________________________________________
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isNarrow ? '15px' : '50px', marginTop: isNarrow ? '24px' : '60px' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>Guest Signature</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>Front Office Executive</div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

const renderGRCAll = () => (
    <div className="print-grc-all">
        {data?.selectedData?.map((p, idx) => (
            <div key={p.id || idx}>
                {renderGRC(p)}
            </div>
        ))}
    </div>
);

const renderInvoice = () => (
    <div className="print-invoice">
        {format === 'Thermal' || format === '3 inch' || format === '2 inch' || isNarrow ? renderFolioPrint() : (
            <>
                <Header />
                {renderDocMeta('Tax Invoice')}
                {renderGuestAndStay()}
                {renderBillBlock()}
                <Footer />
            </>
        )}
    </div>
);

const content = () => {
    switch (type) {
        case 'print-summary': return renderSummary();
        case 'print-grc': return renderGRC();
        case 'print-grc-all': return renderGRCAll();
        case 'print-invoice': return renderInvoice();
        default: return null;
    }
};

return (
    <div style={{
        width: cfg.bodyWidth,
        margin: '0 auto',
        fontSize: cfg.fontSize,
        color: '#000',
        fontFamily: 'Inter, system-ui, sans-serif'
    }}>
        <style>{pageStyle}</style>
        {content()}
    </div>
);
};

export default PrintTemplates;
