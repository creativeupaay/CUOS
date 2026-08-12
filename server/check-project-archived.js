require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const p1 = await db.collection('projects').findOne({ _id: new mongoose.Types.ObjectId('69ae7729cf5cd0d895674625') });
    console.log("P1 isArchived:", p1.isArchived);

    const p2 = await db.collection('projects').findOne({ _id: new mongoose.Types.ObjectId('69b2944c4007bdb485cc82c8') });
    console.log("P2 isArchived:", p2.isArchived);

    process.exit(0);
}
main().catch(console.error);
