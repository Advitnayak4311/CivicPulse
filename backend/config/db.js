const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI;
    let isInMemory = false;

    if (mongoUri === 'mongodb://in-memory') {
      console.log('Starting In-Memory MongoDB Server...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log(`In-Memory MongoDB Server started.`);
      isInMemory = true;
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    if (isInMemory) {
      console.log('Bootstrapping in-memory database seed script...');
      const { seedDataInline } = require('../utils/seed');
      await seedDataInline();
    }
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
