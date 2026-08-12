require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const db = mongoose.connection.db;
    const taskIds = ['Complete the Designs', 'hj', 'test todos', 'testagain', 'testing 101', 'test dailytodo feature'];
    const tasks = await db.collection('tasks').find({ title: { $in: taskIds } }).toArray();
    console.log(JSON.stringify(tasks.map(t => ({ title: t.title, createdBy: t.createdBy, assignees: t.assignees })), null, 2));
    process.exit(0);
}).catch(console.error);
