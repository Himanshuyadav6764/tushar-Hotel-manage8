import { useState } from 'react';
import jsPDF from 'jspdf';
import { useSettings } from '../context/SettingsContext';
import './DocumentPreviewModal.css';

const DocumentPreviewModal = ({ isOpen, onClose, documentType, data }) => {
    const { settings, getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    if (!isOpen || !data) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = () => {
        try {
            const doc = new jsPDF();

            // Header
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.text('BIREENA ATITHI', 105, 20, { align: 'center' });

            if (documentType === 'kot') {
                // KOT PDF
                doc.setFontSize(14);
                doc.setFont(undefined, 'normal');
                doc.text('KITCHEN ORDER TICKET (KOT)', 105, 30, { align: 'center' });

                doc.setLineWidth(0.5);
                doc.line(20, 35, 190, 35);

                doc.setFontSize(10);
                doc.text(`KOT No: ${data.kotNumber}`, 20, 45);
                doc.text(`Room: ${data.room.roomNumber}`, 20, 52);
                doc.text(`Guest: ${data.room.guestName}`, 20, 59);
                doc.text(`Order Type: ${data.orderType.toUpperCase()}`, 20, 66);

                doc.text(`Date: ${data.date}`, 140, 45);
                doc.text(`Time: ${data.time}`, 140, 52);

                let y = 80;
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.text('Item', 20, y);
                doc.text('Qty', 170, y);

                y += 5;
                doc.line(20, y, 190, y);

                y += 8;
                doc.setFont(undefined, 'normal');
                data.items.forEach(item => {
                    doc.text(item.name, 20, y);
                    doc.text(item.quantity.toString(), 170, y);
                    y += 7;
                });

                y += 5;
                doc.line(20, y, 190, y);
                y += 8;

                doc.setFont(undefined, 'bold');
                doc.text(`Total Items: ${data.totalItems}`, 20, y);

            } else {
                // Bill/Order PDF
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                doc.text('Hotel & Restaurant', 105, 27, { align: 'center' });

                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text(documentType === 'bill' ? 'TAX INVOICE' : 'ORDER DETAILS', 105, 40, { align: 'center' });

                doc.setLineWidth(0.5);
                doc.line(20, 45, 190, 45);

                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                doc.text(`Bill No: ${data.billNumber}`, 20, 55);
                doc.text(`Room: ${data.room.roomNumber}`, 20, 62);
                doc.text(`Guest: ${data.room.guestName}`, 20, 69);

                doc.text(`Date: ${data.date}`, 140, 55);
                doc.text(`Time: ${data.time}`, 140, 62);

                let y = 85;
                doc.setFont(undefined, 'bold');
                doc.text('Item', 20, y);
                doc.text('Qty', 100, y);
                doc.text('Rate', 130, y);
                doc.text('Amount', 190, y, { align: 'right' });

                y += 5;
                doc.line(20, y, 190, y);

                y += 8;
                doc.setFont(undefined, 'normal');
                data.items.forEach(item => {
                    doc.text(item.name, 20, y);
                    doc.text(item.quantity.toString(), 100, y);
                    doc.text(`${cs}${item.price}`, 130, y);
                    doc.text(`${cs}${(item.price * item.quantity).toFixed(2)}`, 190, y, { align: 'right' });
                    y += 7;
                });

                y += 5;
                doc.line(20, y, 190, y);
                y += 8;

                doc.text('Subtotal:', 130, y);
                doc.text(`${cs}${data.subtotal.toFixed(2)}`, 190, y, { align: 'right' });
                y += 7;

                doc.text('Tax (5%):', 130, y);
                doc.text(`${cs}${data.tax.toFixed(2)}`, 190, y, { align: 'right' });
                y += 7;

                doc.setLineWidth(0.3);
                doc.line(130, y, 190, y);
                y += 7;

                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('Grand Total:', 130, y);
                doc.text(`${cs}${data.total.toFixed(2)}`, 190, y, { align: 'right' });
            }

            // Generate filename
            const typeStr = documentType === 'kot' ? 'KOT' : documentType === 'bill' ? 'Bill' : 'Order';
            const dateStr = new Date().toISOString().split('T')[0];
            const filename = `Room${data.room.roomNumber}_${typeStr}_${dateStr}.pdf`;

            doc.save(filename);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF. Please try again.');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="document-modal" onClick={(e) => e.stopPropagation()}>
                {/* Document Header */}
                <div className="document-header">
                    {settings.displayLogoOnBill && settings.logoUrl && (
                        <img
                            src={settings.logoUrl}
                            alt="Hotel Logo"
                            style={{ maxHeight: '62px', objectFit: 'contain', marginBottom: '8px', mixBlendMode: 'multiply', background: 'transparent' }}
                        />
                    )}
                    {!(settings.displayLogoOnBill && settings.logoUrl) && (
                        <h2>{settings.name || 'BIREENA ATITHI'}</h2>
                    )}
                    <p>
                        {documentType === 'kot' && 'KITCHEN ORDER TICKET (KOT)'}
                        {documentType === 'bill' && 'TAX INVOICE'}
                        {documentType === 'order' && 'ORDER DETAILS'}
                    </p>
                </div>

                {/* Document Content - Scrollable */}
                <div className="document-content">
                    {documentType === 'kot' && <KOTTemplate data={data} />}
                    {(documentType === 'bill' || documentType === 'order') && <BillTemplate data={data} cs={cs} settings={settings} />}
                </div>

                {/* Action Buttons */}
                <div className="document-actions">
                    <button onClick={handlePrint} className="btn-print">
                        🖨️ Print
                    </button>
                    <button onClick={handleDownload} className="btn-download">
                        ⬇️ Download PDF
                    </button>
                    <button onClick={onClose} className="btn-close">
                        ✕ Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// KOT Template Component
const KOTTemplate = ({ data }) => (
    <div className="kot-document">
        <div className="doc-row">
            <span><strong>KOT No:</strong> {data.kotNumber}</span>
            <span><strong>Date:</strong> {data.date}</span>
        </div>
        <div className="doc-row">
            <span><strong>Room:</strong> {data.room.roomNumber}</span>
            <span><strong>Time:</strong> {data.time}</span>
        </div>
        <div className="doc-row">
            <span><strong>Guest:</strong> {data.room.guestName}</span>
        </div>
        <div className="doc-row">
            <span><strong>Order Type:</strong> {data.orderType.toUpperCase()}</span>
        </div>

        <div className="doc-separator"></div>

        <table className="items-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                </tr>
            </thead>
            <tbody>
                {data.items.map((item, index) => (
                    <tr key={index}>
                        <td>{item.name}</td>
                        <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        <div className="doc-separator"></div>

        <div className="doc-footer">
            <strong>Total Items: {data.totalItems}</strong>
        </div>

        <div className="doc-footer" style={{ marginTop: '1rem' }}>
            <em>Please prepare this order for kitchen</em>
        </div>
    </div>
);

// Bill/Order Template Component
const BillTemplate = ({ data, cs, settings }) => (
    <div className="bill-document">
        <div className="doc-row">
            <span><strong>Bill No:</strong> {data.billNumber}</span>
            <span><strong>Date:</strong> {data.date}</span>
        </div>
        <div className="doc-row">
            <span><strong>Room:</strong> {data.room.roomNumber}</span>
            <span><strong>Time:</strong> {data.time}</span>
        </div>
        <div className="doc-row">
            <span><strong>Guest:</strong> {data.room.guestName}</span>
        </div>

        <div className="doc-separator"></div>

        <table className="items-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
            </thead>
            <tbody>
                {data.items.map((item, index) => (
                    <tr key={index}>
                        <td>{item.name}</td>
                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right' }}>{cs}{item.price}</td>
                        <td style={{ textAlign: 'right' }}>{cs}{(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        <div className="doc-separator"></div>

        <div className="totals-section">
            <div className="total-row">
                <span>Subtotal:</span>
                <span>{cs}{data.subtotal.toFixed(2)}</span>
            </div>
            <div className="total-row">
                <span>Tax (5%):</span>
                <span>{cs}{data.tax.toFixed(2)}</span>
            </div>
            <div className="total-row grand-total">
                <span>Grand Total:</span>
                <span>{cs}{data.total.toFixed(2)}</span>
            </div>
        </div>

        <div className="doc-footer" style={{ marginTop: '2rem' }}>
            {settings?.qrCodeUrl && (
                <img
                    src={settings.qrCodeUrl}
                    alt="Payment QR"
                    style={{ width: '126px', height: '126px', objectFit: 'contain', margin: '0 auto 8px auto', display: 'block' }}
                />
            )}
            <p><strong>Invoice Prefix:</strong> {settings?.billingInvoicePrefix || settings?.invoicePrefix || 'INV'}</p>
            <p>{settings?.thankYouMessage || 'Thank you for your order!'}</p>
            <p>Please visit again</p>
        </div>
    </div>
);

export default DocumentPreviewModal;
