const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Hotel = require('../models/Hotel');

const CHECK_COLLECTIONS = [
    { label: 'Room', name: 'rooms' },
    { label: 'Menu', name: 'menus' },
    { label: 'Booking', name: 'bookings' },
    { label: 'Guest', name: 'guests' },
    { label: 'Table', name: 'tables' }
];

const run = async () => {
    const [hotelIdA, hotelIdB] = process.argv.slice(2);

    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required in environment');
    }

    if (!hotelIdA || !hotelIdB) {
        throw new Error('Usage: node src/scripts/verifyTenantSeparation.js <hotelIdA> <hotelIdB>');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    const client = mongoose.connection.getClient();

    const hotelA = await Hotel.findById(hotelIdA).lean();
    const hotelB = await Hotel.findById(hotelIdB).lean();

    if (!hotelA || !hotelB) {
        throw new Error('Invalid hotel ids supplied.');
    }

    const dbA = client.db(hotelA.dbName);
    const dbB = client.db(hotelB.dbName);

    console.log(`Comparing tenants: ${hotelA.name} (${hotelA.dbName}) vs ${hotelB.name} (${hotelB.dbName})`);

    for (const item of CHECK_COLLECTIONS) {
        const collectionA = dbA.collection(item.name);
        const collectionB = dbB.collection(item.name);

        const countA = await collectionA.countDocuments({ hotelId: hotelA._id });
        const countB = await collectionB.countDocuments({ hotelId: hotelB._id });

        const crossAinB = await collectionB.countDocuments({ hotelId: hotelA._id });
        const crossBinA = await collectionA.countDocuments({ hotelId: hotelB._id });

        console.log(`\n[${item.label}]`);
        console.log(`hotelA own docs in dbA: ${countA}`);
        console.log(`hotelB own docs in dbB: ${countB}`);
        console.log(`hotelA docs in dbB (should be 0): ${crossAinB}`);
        console.log(`hotelB docs in dbA (should be 0): ${crossBinA}`);
    }

    await mongoose.disconnect();
    console.log('\nVerification complete');
};

run().catch(async (error) => {
    console.error('Verification failed:', error.message);
    try {
        await mongoose.disconnect();
    } catch (_) {
        // noop
    }
    process.exit(1);
});