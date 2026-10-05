const dotenv = require("dotenv");
const path = require("path");

// Explicitly load backend/.env, falling back to process.cwd() .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const env = {
  PORT: process.env.PORT || 8080,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET || "fallback_secret",
  JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  GEMMA_API_KEY: process.env.GEMMA_API_KEY || "",
  GEMMA_MODEL: process.env.GEMMA_MODEL || "gemma-3-4b-it",
  GEMMA_API_ENDPOINT: process.env.GEMMA_API_ENDPOINT || "",
};

module.exports = env;