class InvoiceGenerator {
    /**
     * Generate a FINAL invoice (immutable after generation)
     */
    static generateInvoice(reservation, billingData, hotelSettings = {}) {
        const invoice = {
            invoiceId: 'INV' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            invoiceDate: new Date().toISOString(),
            invoiceStatus: 'FINAL',

            // Reference to reservation
            reservationId: reservation.id,

            // Guest info (frozen at checkout)
            guestName: reservation.guestName || 'Guest',
            guestId: reservation.guestId || 'G-' + Date.now(),
            guestEmail: reservation.guestEmail || '',
            guestPhone: reservation.guestPhone || '',

            // Stay details (frozen)
            checkInDate: reservation.checkInDate,
            checkInTime: reservation.checkInTime,
            checkOutDate: reservation.checkOutDate,
            checkOutTime: reservation.checkOutTime,
            nights: reservation.nights || 0,

            // Room details (frozen - deep copy)
            rooms: JSON.parse(JSON.stringify(reservation.rooms || [])),

            // Charges (frozen)
            roomCharges: billingData.roomCharges || 0,
            serviceCharge: billingData.serviceChargeAmount || billingData.serviceCharge || 0,
            discounts: billingData.totalDiscount || 0,
            subtotal: billingData.subtotal || 0,
            taxes: billingData.taxAmount || 0,
            totalAmount: billingData.totalAmount || 0,

            // Payment (frozen)
            paidAmount: billingData.paidAmount || 0,
            balanceAmount: billingData.balanceDue || 0,
            paymentMode: reservation.paymentMode || 'Cash',

            // Hotel metadata from settings
            hotelName: hotelSettings.name || 'Hotel Management System',
            hotelAddress: [hotelSettings.address, hotelSettings.city, hotelSettings.state].filter(Boolean).join(', ') || 'Your Address Here',
            hotelPhone: hotelSettings.phone || '',
            hotelEmail: hotelSettings.email || '',
            hotelGST: hotelSettings.gstNumber || '',

            // Metadata
            generatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPaid: (billingData.balanceDue || 0) <= 0,
            isReadOnly: true // FROZEN after generation
        };

        return invoice;
    }

    /**
     * Generate a DRAFT invoice (mutable preview)
     */
    static generateProformaInvoice(reservation, billingData, hotelSettings = {}) {
        const invoice = this.generateInvoice(reservation, billingData, hotelSettings);
        invoice.invoiceStatus = 'DRAFT';
        invoice.isReadOnly = false;
        return invoice;
    }

    /**
     * Format invoice data for display
     */
    static formatInvoiceForDisplay(invoice) {
        return {
            formattedInvoiceDate: new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
            formattedCheckInDate: new Date(invoice.checkInDate).toLocaleDateString('en-IN'),
            formattedCheckOutDate: new Date(invoice.checkOutDate).toLocaleDateString('en-IN'),
            roomChargesFormatted: invoice.roomCharges.toLocaleString('en-IN'),
            serviceChargeFormatted: (invoice.serviceCharge || 0).toLocaleString('en-IN'),
            discountsFormatted: invoice.discounts.toLocaleString('en-IN'),
            subtotalFormatted: invoice.subtotal.toLocaleString('en-IN'),
            taxesFormatted: invoice.taxes.toLocaleString('en-IN'),
            totalAmountFormatted: invoice.totalAmount.toLocaleString('en-IN'),
            paidAmountFormatted: invoice.paidAmount.toLocaleString('en-IN'),
            balanceAmountFormatted: invoice.balanceAmount.toLocaleString('en-IN')
        };
    }

    /**
     * Mock API call to save invoice
     */
    static async saveInvoice(invoice) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ success: true, invoiceId: invoice.invoiceId });
            }, 500);
        });
    }

    /**
     * Mock API call to download invoice as PDF
     */
    static async downloadInvoicePDF(invoiceId) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    fileName: `Invoice_${invoiceId}.pdf`,
                    message: 'PDF downloaded successfully'
                });
            }, 800);
        });
    }
}

export default InvoiceGenerator;
