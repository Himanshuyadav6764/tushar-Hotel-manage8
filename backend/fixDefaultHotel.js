require('dotenv').config();
const mongoose = require('mongoose');
const Hotel = require('./src/models/Hotel');

async function fixDefaultHotel() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const updated = await Hotel.findOneAndUpdate(
      { name: 'Default Hotel' }, 
      { dbName: 'tenant_default_hotel' }, 
      { new: true }
    );
    
    if (updated) {
      console.log('✅ Default Hotel dbName set to:', updated.dbName);
    } else {
      console.log('❌ Default Hotel not found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixDefaultHotel();
