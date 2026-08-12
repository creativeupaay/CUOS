require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const p1 = await db.collection('projects').findOne({ _id: new mongoose.Types.ObjectId('69ae7729cf5cd0d895674625') });
    const p2 = await db.collection('projects').findOne({ _id: new mongoose.Types.ObjectId('69b2944c4007bdb485cc82c8') });
    
    console.log("Project 1 Status:", p1.status);
    console.log("Project 2 Status:", p2.status);

    process.exit(0);
}
main().catch(console.error);
