require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
    const db = mongoose.connection.db;
    const count = await db.collection('projects').countDocuments({ status: { $ne: 'completed' } });
    console.log('Active Projects:', count);
    process.exit(0);
}).catch(console.error);
