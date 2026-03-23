const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MODELS_TO_BACKFILL = [
    'BedType',
    'Booking',
    'BookingSource',
    'BusinessSource',
    'ComplimentaryService',
    'CustomerIdentity',
    'ExtraCharge',
    'Floor',
    'Folio',
    'Guest',
    'HousekeepingTask',
    'MaintenanceBlock',
    'MealType',
    'Menu',
    'Order',
    'QRCode',
    'QRScanLog',
    'ReservationType',
    'Room',
    'RoomFacility',
    'RoomFacilityType',
    'RoomTypePricing',
    'Table',
    'Transaction',
    'Visitor'
];

const run = async () => {
    const targetHotelId = process.env.DEFAULT_HOTEL_ID || process.argv[2];

    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required in environment');
    }

    if (!targetHotelId) {
        throw new Error('Provide target hotel id via DEFAULT_HOTEL_ID env or CLI arg');
    }

    // Connect using mongoose to get access to the database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log(`Backfilling tenant data with hotelId=${targetHotelId}`);

    // Get the raw database connection to bypass Mongoose plugins
    const db = mongoose.connection.getClient().db('hotelDB');
    const hotelObjectId = new mongoose.Types.ObjectId(targetHotelId);

    // Collection names that need hotelId backfill
    const COLLECTIONS_TO_BACKFILL = [
        'bedtypes',
        'bookings',
        'bookingsources',
        'businesssources',
        'complimentaryservices',
        'customeridentities',
        'extracharges',
        'floors',
        'folios',
        'guests',
        'housekeepingtasks',
        'maintenanceblocks',
        'mealtypes',
        'menus',
        'orders',
        'qrcodes',
        'qrscanlogs',
        'reservationtypes',
        'rooms',
        'roomfacilities',
        'roomfacilitytypes',
        'roomtypepricings',
        'tables',
        'transactions',
        'visitors'
    ];

    for (const collectionName of COLLECTIONS_TO_BACKFILL) {
        try {
            const collection = db.collection(collectionName);
            
            // Check if collection exists
            const collections = await db.listCollections({name: collectionName}).toArray();
            if (collections.length === 0) {
                console.log(`${collectionName}: skipped (collection doesn't exist)`);
                continue;
            }

            const result = await collection.updateMany(
                {
                    $or: [
                        { hotelId: { $exists: false } },
                        { hotelId: null }
                    ]
                },
                {
                    $set: { hotelId: hotelObjectId }
                }
            );

            console.log(`${collectionName}: matched=${result.matchedCount} modified=${result.modifiedCount}`);
        } catch (err) {
            console.error(`${collectionName}: error - ${err.message}`);
        }
    }

    await mongoose.disconnect();
    console.log('Done');
};

run().catch(async (error) => {
    console.error('Backfill failed:', error.message);
    try {
        await mongoose.disconnect();
    } catch (_) {
        // noop
    }
    process.exit(1);
});
