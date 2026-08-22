import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, writeBatch } from "firebase/firestore";
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

async function runRestore() {
  const backupFile = process.argv[2] || "./backups/firestore_backup_latest.json";
  const fullPath = path.resolve(backupFile);

  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Backup file not found at: ${fullPath}`);
    process.exit(1);
  }

  console.log(`🚀 Starting Firestore restore from: ${fullPath}...`);
  const rawData = fs.readFileSync(fullPath, "utf-8");
  const backupData = JSON.parse(rawData);

  for (const [colName, docList] of Object.entries(backupData.collections || {})) {
    console.log(`📤 Restoring collection: ${colName} (${docList.length} docs)...`);

    for (const d of docList) {
      const { _id, _subcollections, ...docFields } = d;
      await setDoc(doc(db, colName, _id), docFields, { merge: true });

      // Restore subcollections for chanda_seasons
      if (colName === "chanda_seasons" && _subcollections) {
        if (_subcollections.monthly_dues) {
          for (const due of _subcollections.monthly_dues) {
            const { _id: dueId, ...dueFields } = due;
            await setDoc(doc(db, "chanda_seasons", _id, "monthly_dues", dueId), dueFields, { merge: true });
          }
        }
        if (_subcollections.member_overrides) {
          for (const ovr of _subcollections.member_overrides) {
            const { _id: ovrId, ...ovrFields } = ovr;
            await setDoc(doc(db, "chanda_seasons", _id, "member_overrides", ovrId), ovrFields, { merge: true });
          }
        }
        if (_subcollections.members) {
          for (const mem of _subcollections.members) {
            const { _id: memId, ...memFields } = mem;
            await setDoc(doc(db, "chanda_seasons", _id, "members", memId), memFields, { merge: true });
          }
        }
        if (_subcollections.contributions) {
          for (const c of _subcollections.contributions) {
            const { _id: cId, ...cFields } = c;
            await setDoc(doc(db, "chanda_seasons", _id, "contributions", cId), cFields, { merge: true });
          }
        }
        if (_subcollections.buildings) {
          for (const b of _subcollections.buildings) {
            const { _id: bId, _subcollections: bSubs, ...bFields } = b;
            await setDoc(doc(db, "chanda_seasons", _id, "buildings", bId), bFields, { merge: true });
            if (bSubs && bSubs.wings) {
              for (const w of bSubs.wings) {
                const { _id: wId, _subcollections: wSubs, ...wFields } = w;
                await setDoc(doc(db, "chanda_seasons", _id, "buildings", bId, "wings", wId), wFields, { merge: true });
                if (wSubs && wSubs.flats) {
                  for (const f of wSubs.flats) {
                    const { _id: fId, ...fFields } = f;
                    await setDoc(doc(db, "chanda_seasons", _id, "buildings", bId, "wings", wId, "flats", fId), fFields, { merge: true });
                  }
                }
              }
            }
          }
        }
      }

      // Restore subcollections for buildings
      if (colName === "buildings" && _subcollections && _subcollections.wings) {
        for (const wing of _subcollections.wings) {
          const { _id: wingId, _subcollections: wingSubs, ...wingFields } = wing;
          await setDoc(doc(db, "buildings", _id, "wings", wingId), wingFields, { merge: true });

          if (wingSubs && wingSubs.flats) {
            for (const flat of wingSubs.flats) {
              const { _id: flatId, ...flatFields } = flat;
              await setDoc(doc(db, "buildings", _id, "wings", wingId, "flats", flatId), flatFields, { merge: true });
            }
          }
        }
      }
    }
    console.log(`✅ Collection ${colName} restored.`);
  }

  console.log("\n🎉 Full Firestore Restore Completed Successfully!");
  process.exit(0);
}

runRestore().catch((err) => {
  console.error("Fatal restore error:", err);
  process.exit(1);
});
