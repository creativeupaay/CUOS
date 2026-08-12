require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const timeLogs = await db.collection('timelogs').find().sort({ date: -1 }).limit(10).toArray();
    console.log(JSON.stringify(timeLogs, null, 2));
    
    process.exit(0);
}
main().catch(console.error);
