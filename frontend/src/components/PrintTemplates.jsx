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

    const renderBillBlock = () => (
        <div style={{ marginBottom: isNarrow ? '10px' : '20px' }}>
            <h3 style={{
                margin: '0 0 8px 0',
                fontSize: isNarrow ? '10px' : '13px',
                borderBottom: '1px solid #ccc',
                paddingBottom: '4px',
                textTransform: 'uppercase'
            }}>
                Bill Details
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                        <th style={{ textAlign: 'left', padding: isNarrow ? '4px' : '8px', border: '1px solid #ddd' }}>Particular</th>
                        <th style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #ddd' }}>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>
                            Room Charges ({safeText(booking?.roomType || booking?.rooms?.[0]?.categoryId, 'Room')}) x {nights}
                        </td>
                        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>
                            {amount(roomCharges)}
                        </td>
                    </tr>
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
                    </tr>
                    <tr>
                        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Subtotal</td>
                        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(subtotal)}</td>
                    </tr>
                    <tr>
                        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>
                            Tax ({safeText(settings.taxType, 'GST')})
                        </td>
                        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(taxAmount)}</td>
                    </tr>
                    <tr style={{ fontWeight: 700 }}>
                        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #ddd' }}>Grand Total</td>
                        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #ddd' }}>{amount(totalAmount)}</td>
                    </tr>
                    <tr>
                        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>Paid Amount</td>
                        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>{amount(paidAmount)}</td>
                    </tr>
                    <tr style={{ color: balanceDue > 0 ? '#b91c1c' : '#047857', fontWeight: 700 }}>
                        <td style={{ padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>
                            {balanceDue > 0 ? 'Balance Due' : 'Status'}
                        </td>
                        <td style={{ textAlign: 'right', padding: isNarrow ? '4px' : '8px', border: '1px solid #eee' }}>
                            {balanceDue > 0 ? amount(balanceDue) : 'PAID'}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
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

    const renderSummary = () => (
        <div className="print-summary">
            <Header />
            {renderDocMeta('Reservation Summary')}
            {renderGuestAndStay()}
            {renderBillBlock()}
            <div style={{ fontSize: isNarrow ? '9px' : '11px' }}>
                <p style={{ margin: '2px 0' }}><strong>Invoice Prefix:</strong> {safeText(settings.billingInvoicePrefix || settings.invoicePrefix, '-')}</p>
                <p style={{ margin: '2px 0' }}><strong>Payment Mode:</strong> {paymentModeUsed}</p>
                <p style={{ margin: '2px 0' }}><strong>Print Type:</strong> {format}</p>
            </div>
            <Footer />
        </div>
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
            <Header />
            {renderDocMeta('Tax Invoice')}
            {renderGuestAndStay()}
            {renderBillBlock()}
            <Footer />
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
