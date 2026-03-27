import React, { useState, useEffect } from 'react';
import './FoodPaymentReport.css';
import API_URL, { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';

const FoodPaymentReport = () => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [activeTab, setActiveTab] = useState('summary');
    const [startDate, setStartDate] = useState('05/02/2026');
    const [endDate, setEndDate] = useState('05/02/2026');
    const [loading, setLoading] = useState(false);

    // Trends data
    const [trendsData, setTrendsData] = useState([]);

    // Transactions data
    const [transactionsData, setTransactionsData] = useState([]);

    // Summary data
    const [summary, setSummary] = useState({
        totalPayments: 0,
        totalRefunds: 0,
        netCollection: 0,
        totalPaymentsCount: 0,
        totalRefundsCount: 0,
        totalTransactions: 0,
        totalOrders: 0,
        totalOrderAmount: 0,
        totalPaid: 0
    });

    // Payment method breakdowns
    const [paymentsReceived, setPaymentsReceived] = useState({
        cash: 0,
        card: 0,
        upi: 0,
        bankTransfer: 0
    });

    const [refundsGiven, setRefundsGiven] = useState({
        cash: 0,
        card: 0,
        upi: 0,
        bankTransfer: 0
    });

    // Format date for API (DD/MM/YYYY to YYYY-MM-DD)
    const formatDateForAPI = (dateStr) => {
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month}-${day}`;
    };

    // Format date for display (YYYY-MM-DD to DD MMM YYYY)
    const formatDateForDisplay = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // Fetch food payment report data
    const fetchFoodPaymentReport = async () => {
        try {
            setLoading(true);
            const apiStartDate = formatDateForAPI(startDate);
            const apiEndDate = formatDateForAPI(endDate);

            console.log(`[FoodPaymentReport] Fetching data from ${apiStartDate} to ${apiEndDate}`);

            const response = await apiCall(
                `${API_URL}/api/cashier/food-payment-report?startDate=${apiStartDate}&endDate=${apiEndDate}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch food payment report');
            }

            const result = await response.json();
            console.log('[FoodPaymentReport] Received data:', result);

            if (result.success) {
                const { summary: summaryData, paymentsReceived: payments, refundsGiven: refunds, trends, transactions } = result.data;

                // Update summary
                setSummary({
                    totalPayments: summaryData.totalCollections || 0,
                    totalRefunds: summaryData.totalRefunds || 0,
                    netCollection: summaryData.netCollection || 0,
                    totalPaymentsCount: summaryData.totalPaymentsCount || 0,
                    totalRefundsCount: summaryData.totalRefundsCount || 0,
                    totalTransactions: summaryData.totalTransactions || 0,
                    totalOrders: summaryData.totalOrders || 0,
                    totalOrderAmount: summaryData.totalOrderAmount || 0,
                    totalPaid: summaryData.totalPaid || 0
                });

                // Update payment methods
                setPaymentsReceived(payments || { cash: 0, card: 0, upi: 0, bankTransfer: 0 });
                setRefundsGiven(refunds || { cash: 0, card: 0, upi: 0, bankTransfer: 0 });

                // Format trends data for display
                const formattedTrends = (trends || []).map(trend => ({
                    date: formatDateForDisplay(trend.date),
                    totalPayments: trend.totalPayments || 0,
                    totalRefunds: trend.totalRefunds || 0,
                    netCollection: trend.netCollection || 0,
                    cashPayments: trend.cashPayments || 0,
                    cardPayments: trend.cardPayments || 0,
                    upiPayments: trend.upiPayments || 0,
                    bankTransfer: trend.bankTransfer || 0,
                    othersPayments: 0,
                    cashRefunds: trend.cashRefunds || 0,
                    cardRefunds: trend.cardRefunds || 0,
                    upiRefunds: trend.upiRefunds || 0,
                    bankRefunds: trend.bankRefunds || 0,
                    othersRefunds: 0,
                    transactions: trend.transactions || 0,
                    paymentsCount: trend.paymentsCount || 0,
                    refundsCount: trend.refundsCount || 0
                }));

                setTrendsData(formattedTrends.length > 0 ? formattedTrends : [
                    {
                        date: formatDateForDisplay(apiStartDate),
                        totalPayments: 0,
                        totalRefunds: 0,
                        netCollection: 0,
                        cashPayments: 0,
                        cardPayments: 0,
                        upiPayments: 0,
                        bankTransfer: 0,
                        othersPayments: 0,
                        cashRefunds: 0,
                        cardRefunds: 0,
                        upiRefunds: 0,
                        bankRefunds: 0,
                        othersRefunds: 0,
                        transactions: 0,
                        paymentsCount: 0,
                        refundsCount: 0
                    }
                ]);

                // Format transactions data for display
                const formattedTransactions = (transactions || []).map(txn => ({
                    transactionId: txn.id,
                    dateTime: new Date(txn.date).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    foodOrderId: txn.orderId || 'N/A',
                    bookingId: '-',
                    transaction: txn.type,
                    amount: `${cs}${txn.amount.toFixed(2)}`,
                    mode: txn.paymentMethod,
                    status: txn.status,
                    notes: txn.description || ''
                }));

                setTransactionsData(formattedTransactions);
            }
        } catch (error) {
            console.error('Error fetching food payment report:', error);
            // Keep default zero state on error
        } finally {
            setLoading(false);
        }
    };

    // Fetch data on component mount and when dates change
    useEffect(() => {
        fetchFoodPaymentReport();
    }, [startDate, endDate]);


    // Export CSV function for Trends
    const handleExportCSV = () => {
        const headers = [
            'Date', 'Total Payments', 'Total Refunds', 'Net Collection',
            'Cash Payments', 'Card Payments', 'UPI Payments', 'Bank Transfer', 'Others',
            'Cash Refunds', 'Card Refunds', 'UPI Refunds', 'Bank Refunds', 'Others Refunds',
            'Transactions'
        ];

        let csvContent = headers.join(',') + '\n';

        trendsData.forEach(row => {
            const rowData = [
                row.date,
                row.totalPayments,
                row.totalRefunds,
                row.netCollection,
                row.cashPayments,
                row.cardPayments,
                row.upiPayments,
                row.bankTransfer,
                row.othersPayments,
                row.cashRefunds,
                row.cardRefunds,
                row.upiRefunds,
                row.bankRefunds,
                row.othersRefunds,
                `${row.transactions} (${row.paymentsCount} payments, ${row.refundsCount} refunds)`
            ];
            csvContent += rowData.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `food-payment-trends-${startDate}-${endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Export CSV function for Transactions
    const handleExportTransactionsCSV = () => {
        const headers = [
            'Transaction ID', 'Date & Time', 'Food Order ID', 'Booking ID',
            'Transaction', 'Amount', 'Mode', 'Status', 'Notes'
        ];

        let csvContent = headers.join(',') + '\n';

        transactionsData.forEach(row => {
            const rowData = [
                row.transactionId,
                row.dateTime,
                row.foodOrderId,
                row.bookingId,
                row.transaction,
                row.amount,
                row.mode,
                row.status,
                row.notes || ''
            ];
            csvContent += rowData.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `food-payment-transactions-${startDate}-${endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="food-payment-report">
            {/* Header Section */}
            <div className="report-header">
                <h1>Food Payment Report</h1>
            </div>

            {/* Tabs Section */}
            <div className="tabs-container">
                <button
                    className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
                    onClick={() => setActiveTab('summary')}
                >
                    <span className="tab-icon">◉</span> Summary
                </button>
                <button
                    className={`tab ${activeTab === 'trends' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trends')}
                >
                    <span className="tab-icon">📈</span> Trends
                </button>
                <button
                    className={`tab ${activeTab === 'transactions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transactions')}
                >
                    <span className="tab-icon">📋</span> Transactions
                </button>
            </div>

            {/* Date Filter Section */}
            <div className="date-filter-section">
                <div className="date-filter-wrapper">
                    <div className="date-filter-group">
                        <label>Start Date</label>
                        <input
                            type="text"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="date-input"
                            placeholder="DD/MM/YYYY"
                        />
                    </div>
                    <span className="date-separator">-</span>
                    <div className="date-filter-group">
                        <label>End Date</label>
                        <input
                            type="text"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="date-input"
                            placeholder="DD/MM/YYYY"
                        />
                    </div>
                    <button 
                        className="export-csv-btn" 
                        onClick={fetchFoodPaymentReport}
                        disabled={loading}
                        style={{ marginLeft: '10px' }}
                    >
                        {loading ? '⏳ Loading...' : '🔄 Refresh'}
                    </button>
                </div>
                {activeTab === 'trends' && (
                    <button className="export-csv-btn" onClick={handleExportCSV}>
                        📥 Export CSV
                    </button>
                )}
                {activeTab === 'transactions' && (
                    <button className="export-csv-btn" onClick={handleExportTransactionsCSV}>
                        📥 Export CSV
                    </button>
                )}
            </div>

            {/* TRANSACTIONS TAB CONTENT */}
            {activeTab === 'transactions' && (
                <div className="transactions-tab">
                    <div className="table-responsive">
                        <table className="transactions-table">
                            <thead>
                                <tr>
                                    <th>Transaction ID</th>
                                    <th>Date & Time</th>
                                    <th>Ref ID</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Mode</th>
                                    <th>Status</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactionsData.length > 0 ? (
                                    transactionsData.map((txn, index) => (
                                        <tr key={index}>
                                            <td className="font-mono">{txn.transactionId}</td>
                                            <td>{txn.dateTime}</td>
                                            <td>{txn.foodOrderId !== 'N/A' ? txn.foodOrderId : txn.bookingId}</td>
                                            <td>
                                                <span className={`badge ${txn.transaction === 'Credit' ? 'badge-success' : 'badge-danger'}`}>
                                                    {txn.transaction}
                                                </span>
                                            </td>
                                            <td className="font-bold">{txn.amount}</td>
                                            <td>{txn.mode}</td>
                                            <td>
                                                <span className={`status-badge status-${txn.status.toLowerCase()}`}>
                                                    {txn.status}
                                                </span>
                                            </td>
                                            <td className="notes-col">{txn.notes}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="8" className="no-data-cell">
                                            No transactions found for the selected period
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

                <>
                    {/* Summary Cards Section */}
                    <div className="summary-cards">
                        <div className="summary-card pink-card">
                            <div className="card-icon pink-icon">
                                <span>{cs}</span>
                            </div>
                            <div className="card-content">
                                <h3>Total Collections</h3>
                                <div className="amount">{cs}{summary.totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div className="description">Total Payments Received</div>
                                <div className="count">{summary.totalPaymentsCount} payments</div>
                            </div>
                        </div>

                        <div className="summary-card orange-card">
                            <div className="card-icon orange-icon">
                                <span>↻</span>
                            </div>
                            <div className="card-content">
                                <h3>Total Refunds</h3>
                                <div className="amount">{cs}{summary.totalRefunds.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div className="description">Total Refunds Processed</div>
                                <div className="count">{summary.totalRefundsCount} refunds</div>
                            </div>
                        </div>

                        <div className="summary-card green-card">
                            <div className="card-icon green-icon">
                                <span>⚖</span>
                            </div>
                            <div className="card-content">
                                <h3>Net Collection</h3>
                                <div className="amount">{cs}{summary.netCollection.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div className="description">Collection - Refunds</div>
                                <div className="count">{summary.totalTransactions} total transactions</div>
                            </div>
                        </div>
                    </div>

                    {/* Food Order & Payment Statistics Section */}
                    <div className="statistics-section">
                        <h2>Food Order & Payment Statistics</h2>
                        <div className="statistics-cards">
                            <div className="stat-card pink-stat">
                                <div className="stat-label">Total Food Orders</div>
                                <div className="stat-value">
                                    <span className="stat-icon">🛍</span> {summary.totalOrders}
                                </div>
                            </div>

                            <div className="stat-card orange-stat">
                                <div className="stat-label">Total Order Amount</div>
                                <div className="stat-value-row">
                                    <span className="stat-amount">{cs} {summary.totalOrderAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            <div className="stat-card green-stat">
                                <div className="stat-label">Total Paid</div>
                                <div className="stat-value-row">
                                    <span className="stat-amount">{cs} {summary.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Transaction Summary Section */}
                    <div className="transaction-summary-section">
                        <h2>Transaction Summary</h2>
                        <div className="transaction-cards">
                            <div className="transaction-card pink-transaction">
                                <div className="transaction-header">
                                    <span className="transaction-icon pink-icon">💳</span>
                                    <span className="transaction-title">Payments Received</span>
                                </div>
                                <div className="transaction-body">
                                    <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981', marginBottom: '5px' }}>
                                        {cs}{summary.totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p style={{ fontSize: '14px', color: '#6b7280' }}>
                                        Total: {summary.totalPaymentsCount} payments received
                                    </p>
                                </div>
                            </div>

                            <div className="transaction-card orange-transaction">
                                <div className="transaction-header">
                                    <span className="transaction-icon orange-icon">↻</span>
                                    <span className="transaction-title">Refunds Given</span>
                                </div>
                                <div className="transaction-body">
                                    <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444', marginBottom: '5px' }}>
                                        {cs}{summary.totalRefunds.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p style={{ fontSize: '14px', color: '#6b7280' }}>
                                        Total: {summary.totalRefundsCount} refunds processed
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Methods Breakdown Section */}
                    <div className="payment-methods-section">
                        <h2>Payment Methods Breakdown</h2>
                        <div className="payment-methods-cards">
                            <div className="payment-method-card green-method">
                                <div className="method-header">Payments Received</div>
                                <div className="method-body">
                                    <div className="no-data-box" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px', textAlign: 'left' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                                            <span style={{ color: '#6b7280', fontWeight: '500' }}>Cash:</span>
                                            <span style={{ color: '#10b981', fontWeight: '600' }}>{cs}{paymentsReceived.cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                                            <span style={{ color: '#6b7280', fontWeight: '500' }}>Card:</span>
                                            <span style={{ color: '#10b981', fontWeight: '600' }}>{cs}{paymentsReceived.card.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                                            <span style={{ color: '#6b7280', fontWeight: '500' }}>UPI:</span>
                                            <span style={{ color: '#10b981', fontWeight: '600' }}>{cs}{paymentsReceived.upi.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                                            <span style={{ color: '#6b7280', fontWeight: '500' }}>Bank Transfer:</span>
                                            <span style={{ color: '#10b981', fontWeight: '600' }}>{cs}{paymentsReceived.bankTransfer.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="payment-method-card pink-method">
                                <div className="method-header">Refunds Given</div>
                                <div className="method-body">
                                    <div className="no-data-box" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px', textAlign: 'left' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                                            <span style={{ color: '#6b7280', fontWeight: '500' }}>Cash:</span>
                                            <span style={{ color: '#ef4444', fontWeight: '600' }}>{cs}{refundsGiven.cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                                            <span style={{ color: '#6b7280', fontWeight: '500' }}>Card:</span>
                                            <span style={{ color: '#ef4444', fontWeight: '600' }}>{cs}{refundsGiven.card.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                                            <span style={{ color: '#6b7280', fontWeight: '500' }}>UPI:</span>
                                            <span style={{ color: '#ef4444', fontWeight: '600' }}>{cs}{refundsGiven.upi.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                                            <span style={{ color: '#6b7280', fontWeight: '500' }}>Bank Transfer:</span>
                                            <span style={{ color: '#ef4444', fontWeight: '600' }}>{cs}{refundsGiven.bankTransfer.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* TRENDS TAB CONTENT */}
            {
                activeTab === 'trends' && (
                    <div className="trends-section">
                        <div className="trends-grid-container">
                            {trendsData.map((row, index) => (
                                <div key={index} className="trends-dashboard-card">
                                    {/* Section A: Header */}
                                    <div className="trends-header">
                                        <div className="trends-date">
                                            <span className="icon">📅</span> {row.date}
                                        </div>
                                        <div className="trends-net-collection">
                                            <span className="label">Net Collection:</span>
                                            <span className={`value ${row.netCollection > 0 ? 'positive' : 'neutral'}`}>
                                                {cs}{row.netCollection.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="trends-card-body">
                                        {/* Section B: Payments */}
                                        <div className="trends-section-group payments-group">
                                            <h4 className="trends-section-title">Payments Received</h4>
                                            <div className="trends-metrics-grid">
                                                <div className="metric-card total">
                                                    <span className="metric-label">Total</span>
                                                    <span className="metric-value">{cs}{row.totalPayments.toFixed(2)}</span>
                                                </div>
                                                <div className="metric-card">
                                                    <span className="metric-label">Cash</span>
                                                    <span className="metric-value">{cs}{row.cashPayments.toFixed(2)}</span>
                                                </div>
                                                <div className="metric-card">
                                                    <span className="metric-label">Card</span>
                                                    <span className="metric-value">{cs}{row.cardPayments.toFixed(2)}</span>
                                                </div>
                                                <div className="metric-card">
                                                    <span className="metric-label">UPI</span>
                                                    <span className="metric-value">{cs}{row.upiPayments.toFixed(2)}</span>
                                                </div>
                                                <div className="metric-card">
                                                    <span className="metric-label">Bank</span>
                                                    <span className="metric-value">{cs}{row.bankTransfer.toFixed(2)}</span>
                                                </div>
                                                <div className="metric-card">
                                                    <span className="metric-label">Others</span>
                                                    <span className="metric-value">{cs}{row.othersPayments.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Section C: Refunds */}
                                        <div className="trends-section-group refunds-group">
                                            <h4 className="trends-section-title">Refunds Processed</h4>
                                            <div className="trends-metrics-grid">
                                                <div className="metric-card total-refund">
                                                    <span className="metric-label">Total</span>
                                                    <span className="metric-value">{cs}{row.totalRefunds.toFixed(2)}</span>
                                                </div>
                                                <div className="metric-card refund">
                                                    <span className="metric-label">Cash</span>
                                                    <span className="metric-value">{cs}{row.cashRefunds.toFixed(2)}</span>
                                                </div>
                                                <div className="metric-card refund">
                                                    <span className="metric-label">Card</span>
                                                    <span className="metric-value">{cs}{row.cardRefunds.toFixed(2)}</span>
                                                </div>
                                                <div className="metric-card refund">
                                                    <span className="metric-label">UPI</span>
                                                    <span className="metric-value">{cs}{row.upiRefunds.toFixed(2)}</span>
                                                </div>
                                                <div className="metric-card refund">
                                                    <span className="metric-label">Bank</span>
                                                    <span className="metric-value">{cs}{row.bankRefunds.toFixed(2)}</span>
                                                </div>
                                                <div className="metric-card refund">
                                                    <span className="metric-label">Others</span>
                                                    <span className="metric-value">{cs}{row.othersRefunds.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="trends-footer">
                                        <div className="transaction-count">
                                            <span className="icon">📊</span>
                                            {row.transactions} Total Transactions
                                            <span className="sub-text">({row.paymentsCount} payments, {row.refundsCount} refunds)</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* TRANSACTIONS TAB CONTENT */}
            {
                activeTab === 'transactions' && (
                    <div className="transactions-section">
                        {/* Summary Strip */}
                        <div className="transactions-summary-strip">
                            <div className="summary-strip-card">
                                <span className="strip-icon blue-icon">📊</span>
                                <div className="strip-info">
                                    <div className="strip-label">Total Transactions</div>
                                    <div className="strip-value">{transactionsData.length}</div>
                                </div>
                            </div>
                            <div className="summary-strip-card">
                                <span className="strip-icon green-icon">💰</span>
                                <div className="strip-info">
                                    <div className="strip-label">Total Amount</div>
                                    <div className="strip-value">
                                        {cs}{transactionsData
                                            .reduce((sum, t) => sum + (t.transaction === 'Payment' ? t.amount : 0), 0)
                                            .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                            <div className="summary-strip-card">
                                <span className="strip-icon purple-icon">✅</span>
                                <div className="strip-info">
                                    <div className="strip-label">Successful</div>
                                    <div className="strip-value">
                                        {transactionsData.filter(t => ['Success', 'Completed', 'Paid'].includes(t.status)).length}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="transactions-table-container">
                            {transactionsData.length === 0 ? (
                                <div className="empty-state-container">
                                    <div className="empty-state-icon">📝</div>
                                    <h3 className="empty-state-title">No Transactions Found</h3>
                                    <p className="empty-state-text">
                                        There are no transactions available for the selected date range.
                                    </p>
                                </div>
                            ) : (
                                <table className="transactions-table">
                                    <thead>
                                        <tr>
                                            <th>Transaction ID</th>
                                            <th>Date & Time</th>
                                            <th>Food Order ID</th>
                                            <th>Booking ID</th>
                                            <th>Transaction</th>
                                            <th>Amount</th>
                                            <th>Mode</th>
                                            <th>Status</th>
                                            <th>Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactionsData.map((row, index) => (
                                            <tr key={index}>
                                                <td className="transaction-id-cell">{row.transactionId}</td>
                                                <td className="date-time-cell">{row.dateTime}</td>
                                                <td>{row.foodOrderId}</td>
                                                <td>{row.bookingId}</td>
                                                <td className={row.transaction === 'Payment' ? 'payment-type' : 'refund-type'}>
                                                    {row.transaction}
                                                </td>
                                                <td className={row.transaction === 'Payment' ? 'positive-value' : 'negative-value'}>
                                                    {cs}{row.amount.toFixed(2)}
                                                </td>
                                                <td className="mode-cell">{row.mode}</td>
                                                <td>
                                                    <span className={`status-badge ${row.status.toLowerCase()}`}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="notes-cell">{row.notes || '---'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default FoodPaymentReport;
