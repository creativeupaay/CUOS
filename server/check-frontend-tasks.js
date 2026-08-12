require('dotenv').config();
const mongoose = require('mongoose');
const { Types } = mongoose;

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const userId = new Types.ObjectId('698eefc15d9d733ec5b2147e');

    // Projects the user has access to
    const projects = await db.collection('projects').find({}).toArray();
    console.log("Total Accessible Projects:", projects.length);
    
    let totalTasksFetched = 0;
    for (const project of projects) {
        const tasks = await db.collection('tasks').find({ projectId: project._id, parentTaskId: null }).toArray();
        totalTasksFetched += tasks.length;
    }

    const individualTasks = await db.collection('tasks').find({ projectId: { $exists: false } }).toArray();
    totalTasksFetched += individualTasks.length;

    console.log("Total Tasks Frontend would fetch:", totalTasksFetched);

    process.exit(0);
}
main().catch(console.error);
