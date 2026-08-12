require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const count = await db.collection('projects').countDocuments();
    console.log("Total Projects in DB:", count);

    process.exit(0);
}
main().catch(console.error);
