require('dotenv').config();
const mongoose = require('mongoose');
const { TimeLog } = require('./src/modules/project/models/TimeLog.model');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    try {
        const timeLog = await TimeLog.create({
            taskId: '000000000000000000000000', // dummy
            userId: '698eefc15d9d733ec5b2147e', // super admin
            date: new Date(),
            duration: 10,
            description: 'Unallocated Time'
        });
        console.log("Success:", timeLog._id);

        // cleanup
        await TimeLog.findByIdAndDelete(timeLog._id);
    } catch(err) {
        console.error("Error:", err);
    }
    
    process.exit(0);
}
main().catch(console.error);
