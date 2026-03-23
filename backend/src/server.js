const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
// Load environment variables from the current backend folder
dotenv.config({ path: path.join(__dirname, '../.env') });

const { installTenantIsolationPlugin } = require('./plugins/tenantIsolationPlugin');
const { runTenantContext } = require('./middleware/tenantContext');
const { installTenantModelRouter } = require('./utils/tenantModelRouter');

// Install plugin before loading route/controller files (which import models).
installTenantIsolationPlugin();
installTenantModelRouter();

// Import routes
const authRoutes = require('./routes/authRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const hotelRoutes = require('./routes/hotelRoutes');

// Admin seeder - ensures admin always exists in DB
const seedAdmin = require('./scripts/seedAdmin');
const menuRoutes = require('./routes/menuRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const roomRoutes = require('./routes/roomRoutes');
const qrCodeRoutes = require('./routes/qrCodeRoutes');
const guestRoutes = require('./routes/guestRoutes');
const cashierRoutes = require('./routes/cashierRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const roomFacilityRoutes = require('./routes/roomFacilityRoutes');
const bedTypeRoutes = require('./routes/bedTypeRoutes');
const floorRoutes = require('./routes/floorRoutes');
const pricingRoutes = require('./routes/pricingRoutes');

// Initialize express app
const app = express();

// Per-request tenant context needed for automatic query scoping.
app.use(runTenantContext);

// CORS configuration - Allow production and development origins
app.use(cors()); // Simplified CORS for development per user request
app.use(express.urlencoded({ extended: true }));

// Security enhancements
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const { limiter } = require('./middleware/security');

// Set security HTTP headers
app.use(helmet());

// Limit requests from same API
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '1mb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
    whitelist: [
        'duration',
        'ratingsQuantity',
        'ratingsAverage',
        'maxGroupSize',
        'difficulty',
        'price'
    ]
}));

// Simple request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// MongoDB Connection with caching for serverless
let cachedDb = null;

const connectDB = async () => {
    if (cachedDb) {
        return cachedDb;
    }

    try {
        if (!process.env.MONGODB_URI) {
            console.error('CRITICAL ERROR: MONGODB_URI environment variable is not defined.');
            throw new Error('MONGODB_URI environment variable is missing');
        }
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        cachedDb = conn;
        return conn;
    } catch (error) {
        console.error('MongoDB Connection Error:', error.message);
        throw error;
    }
};

// Sync Table indexes to allow same table names in different types
const syncTableIndexes = async () => {
    try {
        const Table = require('./models/Table');
        await Table.syncIndexes();
        console.log('✅ Table indexes synced successfully');
    } catch (error) {
        console.warn('⚠️ Table index sync warning:', error.message);
    }
};

// Connect to database and seed admin
const isVercelRuntime = process.env.NODE_ENV === 'production' && !!process.env.VERCEL;

if (!isVercelRuntime) {
    connectDB()
        .then(() => seedAdmin())
        .then(() => syncTableIndexes())
        .catch(err => {
            console.error('Failed to connect to MongoDB:', err);
        });
}

// In serverless, connect lazily per request to avoid cold-start crashes.
app.use('/api', (req, res, next) => {
    connectDB()
        .then(() => next())
        .catch((err) => {
            console.error('API DB connection error:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Database connection failed',
                error: err.message
            });
        });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/hotel', hotelRoutes);
const staffRoutes = require('./routes/staffRoutes');
app.use('/api/staff', staffRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/qr', qrCodeRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/cashier', cashierRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/facilities', roomFacilityRoutes);
app.use('/api/bed-types', bedTypeRoutes);
app.use('/api/floors', floorRoutes);
app.use('/api/pricing', pricingRoutes);

const chatbotRoutes = require('./routes/chatbotRoutes');
app.use('/api/chatbot', chatbotRoutes);


const roomFacilityTypeRoutes = require('./routes/roomFacilityTypeRoutes');
app.use('/api/facility-types', roomFacilityTypeRoutes);
const mealTypeRoutes = require('./routes/mealTypeRoutes');
app.use('/api/meal-types', mealTypeRoutes);
const reservationTypeRoutes = require('./routes/reservationTypeRoutes');
app.use('/api/reservation-types', reservationTypeRoutes);

const extraChargeRoutes = require('./routes/extraChargeRoutes');
app.use('/api/extra-charges', extraChargeRoutes);

const complimentaryServiceRoutes = require('./routes/complimentaryServiceRoutes');
app.use('/api/complimentary-services', complimentaryServiceRoutes);

const customerIdentityRoutes = require('./routes/customerIdentityRoutes');
app.use('/api/customer-identities', customerIdentityRoutes);

const bookingSourceRoutes = require('./routes/bookingSourceRoutes');
app.use('/api/booking-sources', bookingSourceRoutes);

const businessSourceRoutes = require('./routes/businessSourceRoutes');
app.use('/api/business-sources', businessSourceRoutes);

const maintenanceBlockRoutes = require('./routes/maintenanceBlockRoutes');
app.use('/api/maintenance-blocks', maintenanceBlockRoutes);

const guestMealRoutes = require('./routes/guestMealRoutes');
app.use('/api/guest-meal', guestMealRoutes);

const tableRoutes = require('./routes/tableRoutes');
app.use('/api/tables', tableRoutes);

const visitorRoutes = require('./routes/visitorRoutes');
app.use('/api/visitors', visitorRoutes);

const housekeepingRoutes = require('./routes/housekeepingRoutes');
app.use('/api/housekeeping', housekeepingRoutes);

const folioRoutes = require('./routes/folioRoutes');
app.use('/api/folio', folioRoutes);

const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

const salesReportRoutes = require('./routes/salesReportRoutes');
app.use('/api/sales-report', salesReportRoutes);

const paymentReportRoutes = require('./routes/paymentReportRoutes');
app.use('/api/payment-report', paymentReportRoutes);

const analyticsReportRoutes = require('./routes/analyticsReportRoutes');
app.use('/api/analytics-report', analyticsReportRoutes);

const reportsRoutes = require('./routes/reportsRoutes');
app.use('/api/reports', reportsRoutes);

const staffReportRoutes = require('./routes/staffReportRoutes');
app.use('/api/staff-report', staffReportRoutes);

const reservationReportRoutes = require('./routes/reservationReportRoutes');
app.use('/api/reservation-report', reservationReportRoutes);

// Root route
app.get('/', (req, res) => {
    res.json({
        message: 'Bareena Atithi API - Hotel Management System',
        version: '1.0.0'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: err.message
    });
});

// Fallback route to detect undefined routes (404 handler)
app.use((req, res) => {
    console.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        error: "Route not found",
        method: req.method,
        url: req.originalUrl
    });
});

// Server configuration
const PORT = process.env.PORT || 5000;

// Function to start server with port fallback
const startServer = (port) => {
    const numericPort = parseInt(port, 10);
    const server = app.listen(numericPort, () => {
        console.log(`Server running on port ${numericPort}`);
    });

    // Initialize Socket.io mapping
    const io = require('socket.io')(server, {
        cors: { origin: "*", methods: ["GET", "POST"] }
    });
    app.set('io', io);
    io.on('connection', (socket) => {
        console.log('Client connected to socket.io');
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            const nextPort = numericPort + 1;
            console.error(`Port ${numericPort} is already in use.`);
            console.log(`Trying next available port: ${nextPort} in 1 second...`);
            setTimeout(() => {
                startServer(nextPort);
            }, 1000);
        } else {
            console.error('Server error:', err);
        }
    });
};

// Handle Uncaught Exceptions
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    process.exit(1);
});

// Handle Unhandled Promise Rejections
process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    console.error('Unhandled rejection occurred. Server continuing.');
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    startServer(PORT);
}

// Export for Vercel serverless
module.exports = app;
