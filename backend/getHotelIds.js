require('dotenv').config();
const mongoose = require('mongoose');
const Hotel = require('./src/models/Hotel');

async function getHotelIds() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const hotels = await Hotel.find().select('_id name dbName');
    
    console.log('\n=== HOTEL IDs ===\n');
    hotels.forEach((h) => {
      console.log(`Hotel: ${h.name}`);
      console.log(`ID: ${h._id}`);
      console.log(`dbName: ${h.dbName}`);
      console.log('---');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

getHotelIds();
