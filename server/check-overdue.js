require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const allReportsTasks = await db.collection('tasks').find({ parentTaskId: null }).toArray();
    console.log("Total Top-Level Tasks:", allReportsTasks.length);
    
    const overdue = allReportsTasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'completed');
    console.log("All Overdue Tasks in DB:");
    overdue.forEach(t => console.log(`- ${t.title} (Project: ${t.projectId}, Status: ${t.status}, Deadline: ${t.deadline}, createdBy: ${t.createdBy})`));

    process.exit(0);
}
main().catch(console.error);
