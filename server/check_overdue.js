require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const db = mongoose.connection.db;
    const overdueTasks = await db.collection('tasks').find({ 
        status: { $ne: 'completed' }, 
        deadline: { $lt: new Date() },
        parentTaskId: null
    }).toArray();
    console.log('COUNT:', overdueTasks.length);
    console.log(JSON.stringify(overdueTasks.map(t => ({ title: t.title, deadline: t.deadline, projectId: t.projectId, parentTaskId: t.parentTaskId, status: t.status })), null, 2));
    process.exit(0);
}).catch(console.error);
