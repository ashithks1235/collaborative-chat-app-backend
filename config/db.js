const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const connectionString = process.env.MONGODB_URL

    await mongoose.connect(connectionString);

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed");
    console.error(error);
    process.exit(1);
  }
};

module.exports = { connectDB };
