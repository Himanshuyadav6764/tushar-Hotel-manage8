import InvoiceGenerator from './InvoiceGenerator';
import { useSettings } from '../context/SettingsContext';

const InvoiceView = ({ invoice, onClose, isModal = false }) => {
    const { settings, getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();

    if (!invoice) return null;

    const formattedInvoice = InvoiceGenerator.formatInvoiceForDisplay(invoice);
    const serviceCharge = Number(invoice.serviceCharge || 0);

    const roomDetailsText = invoice.rooms
        .map(room => `${room.categoryId.replace(/-/g, ' ')} (${cs}${room.ratePerNight}/night)`)
        .join(', ');

    return (
        <div className={`invoice-view ${isModal ? 'invoice-modal' : 'invoice-page'}`}>
            {isModal && (
                <div className="invoice-modal-header">
                    <h2>Invoice #{invoice.invoiceId}</h2>
                    <button className="invoice-close-btn" onClick={onClose}>✕</button>
                </div>
            )}

            <div className="invoice-container">
                {/* Header */}
                <div className="invoice-header">
                    <div className="invoice-hotel-info">
                        {settings.displayLogoOnBill && settings.logoUrl && (
                            <img src={settings.logoUrl} alt="Hotel Logo" className="invoice-logo" />
                        )}
                        <h1 className="invoice-hotel-name">{invoice.hotelName}</h1>
                        <p className="invoice-hotel-address">{invoice.hotelAddress}</p>
                        <p className="invoice-hotel-contact">
                            📞 {invoice.hotelPhone} | 📧 {invoice.hotelEmail}
                        </p>
                        <p className="invoice-hotel-gst">GST: {invoice.hotelGST}</p>
                    </div>

                    <div className="invoice-meta">
                        <div className="invoice-meta-item">
                            <span className="label">Invoice No.</span>
                            <span className="value">{invoice.invoiceId}</span>
                        </div>
                        <div className="invoice-meta-item">
                            <span className="label">Invoice Date</span>
                            <span className="value">{formattedInvoice.formattedInvoiceDate}</span>
                        </div>
                        <div className="invoice-meta-item">
                            <span className="label">Status</span>
                            <span className={`invoice-status ${invoice.invoiceStatus.toLowerCase()}`}>
                                {invoice.invoiceStatus === 'FINAL' ? '✓ FINAL' : '◆ DRAFT'}
                            </span>
                        </div>
                    </div>
                </div>

                <hr className="invoice-divider" />

                {/* Guest Information */}
                <div className="invoice-section">
                    <h3 className="invoice-section-title">Guest Information</h3>
                    <div className="invoice-two-column">
                        <div className="invoice-column">
                            <p><strong>Guest Name:</strong> {invoice.guestName}</p>
                            <p><strong>Email:</strong> {invoice.guestEmail}</p>
                            <p><strong>Phone:</strong> {invoice.guestPhone}</p>
                        </div>
                        <div className="invoice-column">
                            <p><strong>Guest ID:</strong> {invoice.guestId}</p>
                        </div>
                    </div>
                </div>

                <hr className="invoice-divider" />

                {/* Stay Details */}
                <div className="invoice-section">
                    <h3 className="invoice-section-title">Stay Details</h3>
                    <div className="invoice-two-column">
                        <div className="invoice-column">
                            <p><strong>Check-In:</strong> {formattedInvoice.formattedCheckInDate} at {invoice.checkInTime}</p>
                            <p><strong>Check-Out:</strong> {formattedInvoice.formattedCheckOutDate} at {invoice.checkOutTime}</p>
                        </div>
                        <div className="invoice-column">
                            <p><strong>Number of Nights:</strong> {invoice.nights}</p>
                            <p><strong>Room Details:</strong> {roomDetailsText}</p>
                        </div>
                    </div>
                </div>

                <hr className="invoice-divider" />

                {/* Charges Breakdown */}
                <div className="invoice-section">
                    <h3 className="invoice-section-title">Charges Breakdown</h3>
                    <div className="invoice-charges-table">
                        <div className="charges-row">
                            <span className="charge-label">Room Charges ({invoice.nights} nights)</span>
                            <span className="charge-value">{cs}{formattedInvoice.roomChargesFormatted}</span>
                        </div>
                        <div className="charges-row">
                            <span className="charge-label">Service Charges</span>
                            <span className="charge-value">{cs}{serviceCharge.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="charges-row discount">
                            <span className="charge-label">Discount Applied</span>
                            <span className="charge-value">-{cs}{formattedInvoice.discountsFormatted}</span>
                        </div>
                        <div className="charges-row subtotal">
                            <span className="charge-label">Subtotal</span>
                            <span className="charge-value">{cs}{formattedInvoice.subtotalFormatted}</span>
                        </div>
                        <div className="charges-row">
                            <span className="charge-label">Tax (12%)</span>
                            <span className="charge-value">{cs}{formattedInvoice.taxesFormatted}</span>
                        </div>
                        <div className="charges-row total">
                            <span className="charge-label">Total Amount</span>
                            <span className="charge-value">{cs}{formattedInvoice.totalAmountFormatted}</span>
                        </div>
                    </div>
                </div>

                <hr className="invoice-divider" />

                {/* Payment Summary */}
                <div className="invoice-section">
                    <h3 className="invoice-section-title">Payment Summary</h3>
                    <div className="invoice-payment">
                        <div className="payment-row">
                            <span className="payment-label">Total Amount</span>
                            <span className="payment-value">{cs}{formattedInvoice.totalAmountFormatted}</span>
                        </div>
                        <div className="payment-row">
                            <span className="payment-label">Paid Amount</span>
                            <span className="payment-value paid">{cs}{formattedInvoice.paidAmountFormatted}</span>
                        </div>
                        <div className="payment-row balance">
                            <span className="payment-label">
                                {invoice.balanceAmount > 0 ? 'Balance Due' : '✓ Fully Paid'}
                            </span>
                            <span className={`payment-value ${invoice.balanceAmount > 0 ? 'due' : 'paid'}`}>
                                {cs}{formattedInvoice.balanceAmountFormatted}
                            </span>
                        </div>
                        <div className="payment-row">
                            <span className="payment-label">Payment Mode</span>
                            <span className="payment-value">{invoice.paymentMode}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="invoice-footer">
                    {settings.qrCodeUrl && (
                        <img src={settings.qrCodeUrl} alt="Payment QR" className="invoice-footer-qr" />
                    )}
                    <p className="invoice-footer-prefix">
                        Invoice Prefix: {settings.billingInvoicePrefix || settings.invoicePrefix || 'INV'}
                    </p>
                    <p className="invoice-footer-text">
                        {settings.thankYouMessage || 'Thank you for staying with us!'} This is a computer-generated document.
                    </p>
                    <p className="invoice-footer-terms">
                        For billing disputes, please contact: {invoice.hotelEmail} within 7 days of checkout.
                    </p>
                </div>
            </div>


        </div>
    );
};

export default InvoiceView;
