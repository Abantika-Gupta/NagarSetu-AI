const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const Complaint = require("../models/Complaint");
const { loadComplaintsFromDataset } = require("../utils/civicDatasetLoader");

const seedComplaints = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri || mongoUri === "your_mongodb_atlas_connection_string") {
    console.error("❌ Cannot seed: MONGO_URI is not configured in backend/.env");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for complaint seeding...");

    const datasetComplaints = loadComplaintsFromDataset();
    console.log(`Loaded ${datasetComplaints.length} complaints from civic datasets...`);

    let inserted = 0;
    let skipped = 0;

    for (const item of datasetComplaints) {
      const exists = await Complaint.findOne({ complaintId: item.complaintId });
      if (!exists) {
        // Strip temporary _id from loader to let Mongoose assign ObjectId
        const { _id, ...complaintDoc } = item;
        await Complaint.create(complaintDoc);
        inserted++;
      } else {
        skipped++;
      }
    }

    console.log(`✅ Seeding complete: ${inserted} complaints inserted, ${skipped} already existed.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding complaints:", err.message);
    process.exit(1);
  }
};

seedComplaints();
