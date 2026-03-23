const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Hotel = require('../models/Hotel');

const run = async () => {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required in environment');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const hotels = await Hotel.find({
        $or: [
            { dbName: { $exists: false } },
            { dbName: null },
            { dbName: '' }
        ]
    });

    console.log(`Hotels needing dbName: ${hotels.length}`);

    for (const hotel of hotels) {
        await hotel.save();
        console.log(`Hotel ${hotel._id} -> ${hotel.dbName}`);
    }

    await Hotel.syncIndexes();
    console.log('Hotel indexes synced');

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
