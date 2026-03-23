require('dotenv').config();
const mongoose = require('mongoose');
const Hotel = require('./src/models/Hotel');

async function checkHotels() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const hotels = await Hotel.find().select('name dbName');
    
    console.log('\n=== HOTELS IN DATABASE ===\n');
    if (hotels.length === 0) {
      console.log('No hotels found!');
    } else {
      hotels.forEach((h, i) => {
        console.log(`${i + 1}. ${h.name}`);
        console.log(`   dbName: ${h.dbName || '❌ NOT SET'}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkHotels();
