const mongoose = require("mongoose");
const env = require("./env");

const sanitizeMongoUri = (rawUri) => {
  if (!rawUri) return "";
  let uri = rawUri.trim();
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1, -1).trim();
  }
  return uri;
};

const connectDB = async () => {
  try {
    const rawUri = env.MONGO_URI || process.env.MONGO_URI;
    const uri = sanitizeMongoUri(rawUri);

    if (
      !uri ||
      uri === "your_mongodb_atlas_connection_string" ||
      uri.includes("your_mongodb")
    ) {
      mongoose.set("bufferCommands", false);
      console.log(
        "⚠️ MongoDB URI not set. Add MONGO_URI in backend/.env. Using offline civic datasets for map and heatmap."
      );
      return false;
    }

    mongoose.set("bufferCommands", false);

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    const safeErrorMsg = (error.message || "").replace(/:\/\/[^:]+:[^@]+@/, "://***:***@");
    console.error(`❌ MongoDB Connection Error: ${safeErrorMsg}`);
    return false;
  }
};

module.exports = connectDB;