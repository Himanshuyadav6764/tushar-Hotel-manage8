const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Hotel = require('../models/Hotel');

const TENANT_COLLECTIONS = [
    { label: 'BedType', name: 'bedtypes' },
    { label: 'Booking', name: 'bookings' },
    { label: 'BookingSource', name: 'bookingsources' },
    { label: 'BusinessSource', name: 'businesssources' },
    { label: 'ComplimentaryService', name: 'complimentaryservices' },
    { label: 'CustomerIdentity', name: 'customeridentities' },
    { label: 'ExtraCharge', name: 'extracharges' },
    { label: 'Floor', name: 'floors' },
    { label: 'Folio', name: 'folios' },
    { label: 'Guest', name: 'guests' },
    { label: 'HousekeepingTask', name: 'housekeepingtasks' },
    { label: 'MaintenanceBlock', name: 'maintenanceblocks' },
    { label: 'MealType', name: 'mealtypes' },
    { label: 'Menu', name: 'menus' },
    { label: 'Order', name: 'orders' },
    { label: 'QRCode', name: 'qrcodes' },
    { label: 'QRScanLog', name: 'qrscanlogs' },
    { label: 'ReservationType', name: 'reservationtypes' },
    { label: 'Room', name: 'rooms' },
    { label: 'RoomFacility', name: 'roomfacilities' },
    { label: 'RoomFacilityType', name: 'roomfacilitytypes' },
    { label: 'RoomTypePricing', name: 'roomtypepricings' },
    { label: 'Table', name: 'tables' },
    { label: 'Transaction', name: 'transactions' },
    { label: 'Visitor', name: 'visitors' }
];

const CHUNK_SIZE = 500;

const run = async () => {
    const shouldDeleteSource = process.argv.includes('--delete-source');

    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required in environment');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to master MongoDB');
    const client = mongoose.connection.getClient();
    const masterDb = client.db('hotelDB');

    const hotels = await Hotel.find({ dbName: { $exists: true, $ne: '' } }).lean();
    if (!hotels.length) {
        console.log('No hotels found with dbName. Nothing to migrate.');
        await mongoose.disconnect();
        return;
    }

    console.log(`Hotels to migrate: ${hotels.length}`);

    for (const hotel of hotels) {
        const hotelId = hotel._id;
        const dbName = hotel.dbName;
        const tenantDb = client.db(dbName);

        console.log(`\n--- Migrating hotel=${hotel.name} hotelId=${hotelId} db=${dbName} ---`);

        for (const item of TENANT_COLLECTIONS) {
            const sourceCollection = masterDb.collection(item.name);
            const targetCollection = tenantDb.collection(item.name);

            const sourceDocs = await sourceCollection
                .find({ hotelId })
                .toArray();

            if (!sourceDocs.length) {
                console.log(`${item.label}: 0 docs`);
                continue;
            }

            let migrated = 0;
            for (let i = 0; i < sourceDocs.length; i += CHUNK_SIZE) {
                const chunk = sourceDocs.slice(i, i + CHUNK_SIZE);
                const operations = chunk.map((doc) => ({
                    replaceOne: {
                        filter: { _id: doc._id },
                        replacement: doc,
                        upsert: true
                    }
                }));

                await targetCollection.bulkWrite(operations, { ordered: false });
                migrated += chunk.length;
            }

            console.log(`${item.label}: migrated ${migrated}`);

            if (shouldDeleteSource) {
                await sourceCollection.deleteMany({ hotelId });
                console.log(`${item.label}: source cleaned`);
            }
        }
    }

    await mongoose.disconnect();
    console.log('\nMigration complete');
};

run().catch(async (error) => {
    console.error('Migration failed:', error.message);
    try {
        await mongoose.disconnect();
    } catch (_) {
        // noop
    }
    process.exit(1);
});
