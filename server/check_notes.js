const { MongoClient } = require('mongodb');

async function check() {
  const uri = "REMOVED/?appName=Cluster0";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    // Default db from URI is usually test or empty, let's list them
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    
    const dbName = dbs.databases.find(d => d.name.includes('cuos'))?.name || 'cuos';
    console.log("Using DB:", dbName);
    const db = client.db(dbName);
    
    // Look for collections related to notes
    const collections = await db.listCollections().toArray();
    
    const notesCollName = collections.find(c => c.name.toLowerCase().includes('note'))?.name;
    
    if (notesCollName) {
       console.log(`\n--- Notes matching 'CUOS' in collection '${notesCollName}' ---`);
       const notesColl = db.collection(notesCollName);
       const notes = await notesColl.find({ title: /CUOS/i }).toArray();
       
       if (notes.length === 0) {
          console.log("No notes found with title containing 'CUOS'");
       }
       
       notes.forEach(n => {
           console.log(`\nID: ${n._id}`);
           console.log(`Title: ${n.title}`);
           console.log(`Content length: ${n.content ? n.content.length : 0}`);
           console.log(`Updated At: ${n.updatedAt}`);
           
           // See if there's any history or previous fields
           const keys = Object.keys(n);
           console.log(`Keys: ${keys.join(", ")}`);
           
           if(n.history || n.versions || n.previous) {
               console.log("FOUND SOME FORM OF HISTORY/VERSIONS:", JSON.stringify(n.history || n.versions || n.previous).substring(0, 500));
           } else {
               console.log("No history/versions field found on this document.");
               console.log("Current content snippet:", n.content ? n.content.substring(0, 100) + "..." : "empty");
           }
       });
    } else {
       console.log("Could not find any collection with 'note' in the name.");
       console.log("Available collections:", collections.map(c => c.name).join(", "));
    }

  } catch(e) {
    console.log("Error:", e);
  } finally {
    await client.close();
  }
}

check().catch(console.error);
