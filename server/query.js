const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://creativeupaay_db_user:eHzXT2VRhuJhC365@cluster0.mwqjtnf.mongodb.net/test?retryWrites=true&w=majority').then(async () => {
  const db = mongoose.connection.db;
  const tasks = await db.collection('tasks').find({ title: { $in: ['Complete the Designs', 'admin project task'] } }).toArray();
  console.log(JSON.stringify(tasks, null, 2));
  process.exit(0);
}).catch(console.error);
