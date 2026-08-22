import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

const firebaseConfig = {
  apiKey: "AIzaSyAMF-3mZMqZFqOrTdM2cPKalwXU6O2putI",
  authDomain: "fycs-notes-hub-97274.firebaseapp.com",
  projectId: "fycs-notes-hub-97274",
  storageBucket: "fycs-notes-hub-97274.firebasestorage.app",
  messagingSenderId: "81526695854",
  appId: "1:81526695854:web:f548ce0cf67d6dab898a3f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ROOT_COLLECTIONS = [
  "users",
  "mandal_members",
  "mandal_settings",
  "chanda_seasons",
  "season_audit_logs",
  "mandal_chanda",
  "mandal_chanda_logs",
  "chanda_payments",
  "mandal_gallery",
  "mandal_media",
  "buildings",
  "building_chanda",
  "other_chanda",
  "expenses_log",
  "announcements",
  "notifications"
];

async function runBackup() {
  console.log("🚀 Starting full Firestore backup...");
  const backupData = {
    exportedAt: new Date().toISOString(),
    projectId: firebaseConfig.projectId,
    collections: {}
  };

  for (const colName of ROOT_COLLECTIONS) {
    try {
      console.log(`📥 Fetching collection: ${colName}...`);
      const colRef = collection(db, colName);
      const snap = await getDocs(colRef);
      backupData.collections[colName] = [];

      for (const d of snap.docs) {
        const docData = d.data();
        const docEntry = {
          _id: d.id,
          ...docData,
          _subcollections: {}
        };

        // Handle subcollections for chanda_seasons
        if (colName === "chanda_seasons") {
          try {
            const duesSnap = await getDocs(collection(db, "chanda_seasons", d.id, "monthly_dues"));
            docEntry._subcollections.monthly_dues = duesSnap.docs.map((subDoc) => ({
              _id: subDoc.id,
              ...subDoc.data()
            }));

            const overridesSnap = await getDocs(collection(db, "chanda_seasons", d.id, "member_overrides"));
            docEntry._subcollections.member_overrides = overridesSnap.docs.map((subDoc) => ({
              _id: subDoc.id,
              ...subDoc.data()
            }));

            const membersSnap = await getDocs(collection(db, "chanda_seasons", d.id, "members"));
            docEntry._subcollections.members = membersSnap.docs.map((subDoc) => ({
              _id: subDoc.id,
              ...subDoc.data()
            }));

            const contribSnap = await getDocs(collection(db, "chanda_seasons", d.id, "contributions"));
            docEntry._subcollections.contributions = contribSnap.docs.map((subDoc) => ({
              _id: subDoc.id,
              ...subDoc.data()
            }));

            const seasonBuildingsSnap = await getDocs(collection(db, "chanda_seasons", d.id, "buildings"));
            docEntry._subcollections.buildings = [];
            for (const bDoc of seasonBuildingsSnap.docs) {
              const bEntry = {
                _id: bDoc.id,
                ...bDoc.data(),
                _subcollections: { wings: [] }
              };
              const sWingsSnap = await getDocs(collection(db, "chanda_seasons", d.id, "buildings", bDoc.id, "wings"));
              for (const wDoc of sWingsSnap.docs) {
                const wEntry = {
                  _id: wDoc.id,
                  ...wDoc.data(),
                  _subcollections: { flats: [] }
                };
                const sFlatsSnap = await getDocs(collection(db, "chanda_seasons", d.id, "buildings", bDoc.id, "wings", wDoc.id, "flats"));
                wEntry._subcollections.flats = sFlatsSnap.docs.map((fDoc) => ({
                  _id: fDoc.id,
                  ...fDoc.data()
                }));
                bEntry._subcollections.wings.push(wEntry);
              }
              docEntry._subcollections.buildings.push(bEntry);
            }
          } catch (subErr) {
            console.warn(`⚠️ Subcollection read error on ${colName}/${d.id}:`, subErr.message);
          }
        }

        // Handle subcollections for buildings
        if (colName === "buildings") {
          try {
            const wingsSnap = await getDocs(collection(db, "buildings", d.id, "wings"));
            docEntry._subcollections.wings = [];

            for (const wingDoc of wingsSnap.docs) {
              const wingEntry = {
                _id: wingDoc.id,
                ...wingDoc.data(),
                _subcollections: { flats: [] }
              };

              try {
                const flatsSnap = await getDocs(collection(db, "buildings", d.id, "wings", wingDoc.id, "flats"));
                wingEntry._subcollections.flats = flatsSnap.docs.map((fDoc) => ({
                  _id: fDoc.id,
                  ...fDoc.data()
                }));
              } catch (flatsErr) {
                console.warn(`Flats fetch warning on ${d.id}/${wingDoc.id}:`, flatsErr.message);
              }

              docEntry._subcollections.wings.push(wingEntry);
            }
          } catch (e) {
            console.warn(`Wings fetch warning on ${colName}/${d.id}:`, e.message);
          }
        }

        backupData.collections[colName].push(docEntry);
      }
      console.log(`✅ ${colName}: ${backupData.collections[colName].length} docs backed up.`);
    } catch (err) {
      console.error(`❌ Error fetching ${colName}:`, err.message);
    }
  }

  // Ensure backups directory exists
  const backupDir = path.resolve("./backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const fileName = `firestore_backup_${timestamp}.json`;
  const filePath = path.join(backupDir, fileName);
  const latestPath = path.join(backupDir, "firestore_backup_latest.json");

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), "utf-8");
  fs.writeFileSync(latestPath, JSON.stringify(backupData, null, 2), "utf-8");

  console.log(`\n🎉 Full Backup Completed Successfully!`);
  console.log(`📁 File saved to: ${filePath}`);
  console.log(`📁 Latest copy saved to: ${latestPath}`);
  process.exit(0);
}

runBackup().catch((err) => {
  console.error("Fatal backup error:", err);
  process.exit(1);
});
