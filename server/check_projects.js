require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const db = mongoose.connection.db;
    
    const taskIds = ['69ae7729cf5cd0d895674625', '6a004bb18a1ccb591fed19c0', '6a27a547ff70f4b4442efdce', '6a00bd6d2f7367ece0f6b5ad', '69b2944c4007bdb485cc82c8'];
    const projects = await db.collection('projects').find({ _id: { $in: taskIds.map(id => new mongoose.Types.ObjectId(id)) } }).toArray();
    console.log(JSON.stringify(projects.map(p => ({ id: p._id, name: p.name, status: p.status })), null, 2));
    process.exit(0);
}).catch(console.error);
