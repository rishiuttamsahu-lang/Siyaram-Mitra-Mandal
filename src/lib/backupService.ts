import {
  collection,
  getDocs,
  doc,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

const ROOT_COLLECTIONS = [
  'users',
  'mandal_members',
  'mandal_settings',
  'chanda_seasons',
  'season_audit_logs',
  'mandal_chanda',
  'mandal_chanda_logs',
  'chanda_payments',
  'mandal_gallery',
  'mandal_media',
  'buildings',
  'building_chanda',
  'other_chanda',
  'expenses_log',
  'announcements',
  'notifications'
];

/**
 * Exports all Firestore collections and subcollections into a clean JSON structure
 */
export async function exportFirestoreBackup(onProgress?: (msg: string) => void): Promise<string> {
  const backupData: Record<string, any> = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    collections: {}
  };

  for (const colName of ROOT_COLLECTIONS) {
    try {
      if (onProgress) onProgress(`Exporting ${colName}...`);
      const snap = await getDocs(collection(db, colName));
      backupData.collections[colName] = [];

      for (const d of snap.docs) {
        const docEntry: any = {
          _id: d.id,
          ...d.data(),
          _subcollections: {}
        };

        // Handle subcollections for chanda_seasons
        if (colName === 'chanda_seasons') {
          try {
            const duesSnap = await getDocs(collection(db, 'chanda_seasons', d.id, 'monthly_dues'));
            docEntry._subcollections.monthly_dues = duesSnap.docs.map((sDoc) => ({
              _id: sDoc.id,
              ...sDoc.data()
            }));

            const overridesSnap = await getDocs(collection(db, 'chanda_seasons', d.id, 'member_overrides'));
            docEntry._subcollections.member_overrides = overridesSnap.docs.map((sDoc) => ({
              _id: sDoc.id,
              ...sDoc.data()
            }));

            const membersSnap = await getDocs(collection(db, 'chanda_seasons', d.id, 'members'));
            docEntry._subcollections.members = membersSnap.docs.map((sDoc) => ({
              _id: sDoc.id,
              ...sDoc.data()
            }));

            const contribSnap = await getDocs(collection(db, 'chanda_seasons', d.id, 'contributions'));
            docEntry._subcollections.contributions = contribSnap.docs.map((sDoc) => ({
              _id: sDoc.id,
              ...sDoc.data()
            }));

            const seasonBuildingsSnap = await getDocs(collection(db, 'chanda_seasons', d.id, 'buildings'));
            docEntry._subcollections.buildings = [];
            for (const bDoc of seasonBuildingsSnap.docs) {
              const bEntry: any = {
                _id: bDoc.id,
                ...bDoc.data(),
                _subcollections: { wings: [] }
              };
              const sWingsSnap = await getDocs(collection(db, 'chanda_seasons', d.id, 'buildings', bDoc.id, 'wings'));
              for (const wDoc of sWingsSnap.docs) {
                const wEntry: any = {
                  _id: wDoc.id,
                  ...wDoc.data(),
                  _subcollections: { flats: [] }
                };
                const sFlatsSnap = await getDocs(collection(db, 'chanda_seasons', d.id, 'buildings', bDoc.id, 'wings', wDoc.id, 'flats'));
                wEntry._subcollections.flats = sFlatsSnap.docs.map((fDoc) => ({
                  _id: fDoc.id,
                  ...fDoc.data()
                }));
                bEntry._subcollections.wings.push(wEntry);
              }
              docEntry._subcollections.buildings.push(bEntry);
            }
          } catch (e) {
            console.warn(`Subcollection export warning on ${colName}/${d.id}`, e);
          }
        }

        // Handle subcollections for buildings
        if (colName === 'buildings') {
          try {
            const wingsSnap = await getDocs(collection(db, 'buildings', d.id, 'wings'));
            docEntry._subcollections.wings = [];

            for (const wingDoc of wingsSnap.docs) {
              const wingEntry: any = {
                _id: wingDoc.id,
                ...wingDoc.data(),
                _subcollections: { flats: [] }
              };

              try {
                const flatsSnap = await getDocs(collection(db, 'buildings', d.id, 'wings', wingDoc.id, 'flats'));
                wingEntry._subcollections.flats = flatsSnap.docs.map((fDoc) => ({
                  _id: fDoc.id,
                  ...fDoc.data()
                }));
              } catch (flatsErr) {
                console.warn(`Flats export warning on ${d.id}/${wingDoc.id}`, flatsErr);
              }

              docEntry._subcollections.wings.push(wingEntry);
            }
          } catch (e) {
            console.warn(`Wings export warning on ${colName}/${d.id}`, e);
          }
        }

        backupData.collections[colName].push(docEntry);
      }
    } catch (err: any) {
      console.warn(`Skipped or empty collection ${colName}:`, err.message);
    }
  }

  const jsonString = JSON.stringify(backupData, null, 2);

  // Trigger client-side browser download
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `siyaram_db_backup_${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (onProgress) onProgress('Backup downloaded successfully!');
  return jsonString;
}

/**
 * Restores Firestore collections and subcollections from a parsed JSON backup object
 */
export async function restoreFirestoreBackup(
  backupData: any,
  onProgress?: (msg: string) => void
): Promise<void> {
  if (!backupData || !backupData.collections) {
    throw new Error('Invalid backup file structure.');
  }

  for (const [colName, docList] of Object.entries(backupData.collections as Record<string, any[]>)) {
    if (onProgress) onProgress(`Restoring ${colName} (${docList.length} records)...`);

    for (const d of docList) {
      const { _id, _subcollections, ...docFields } = d;
      await setDoc(doc(db, colName, _id), docFields, { merge: true });

      // Restore subcollections for chanda_seasons
      if (colName === 'chanda_seasons' && _subcollections) {
        if (_subcollections.monthly_dues) {
          for (const due of _subcollections.monthly_dues) {
            const { _id: dueId, ...dueFields } = due;
            await setDoc(doc(db, 'chanda_seasons', _id, 'monthly_dues', dueId), dueFields, { merge: true });
          }
        }
        if (_subcollections.member_overrides) {
          for (const ovr of _subcollections.member_overrides) {
            const { _id: ovrId, ...ovrFields } = ovr;
            await setDoc(doc(db, 'chanda_seasons', _id, 'member_overrides', ovrId), ovrFields, { merge: true });
          }
        }
        if (_subcollections.members) {
          for (const mem of _subcollections.members) {
            const { _id: memId, ...memFields } = mem;
            await setDoc(doc(db, 'chanda_seasons', _id, 'members', memId), memFields, { merge: true });
          }
        }
        if (_subcollections.contributions) {
          for (const c of _subcollections.contributions) {
            const { _id: cId, ...cFields } = c;
            await setDoc(doc(db, 'chanda_seasons', _id, 'contributions', cId), cFields, { merge: true });
          }
        }
        if (_subcollections.buildings) {
          for (const b of _subcollections.buildings) {
            const { _id: bId, _subcollections: bSubs, ...bFields } = b;
            await setDoc(doc(db, 'chanda_seasons', _id, 'buildings', bId), bFields, { merge: true });
            if (bSubs?.wings) {
              for (const w of bSubs.wings) {
                const { _id: wId, _subcollections: wSubs, ...wFields } = w;
                await setDoc(doc(db, 'chanda_seasons', _id, 'buildings', bId, 'wings', wId), wFields, { merge: true });
                if (wSubs?.flats) {
                  for (const f of wSubs.flats) {
                    const { _id: fId, ...fFields } = f;
                    await setDoc(doc(db, 'chanda_seasons', _id, 'buildings', bId, 'wings', wId, 'flats', fId), fFields, { merge: true });
                  }
                }
              }
            }
          }
        }
      }

      // Restore subcollections for buildings
      if (colName === 'buildings' && _subcollections && _subcollections.wings) {
        for (const wing of _subcollections.wings) {
          const { _id: wingId, _subcollections: wingSubs, ...wingFields } = wing;
          await setDoc(doc(db, 'buildings', _id, 'wings', wingId), wingFields, { merge: true });

          if (wingSubs && wingSubs.flats) {
            for (const flat of wingSubs.flats) {
              const { _id: flatId, ...flatFields } = flat;
              await setDoc(doc(db, 'buildings', _id, 'wings', wingId, 'flats', flatId), flatFields, { merge: true });
            }
          }
        }
      }
    }
  }

  if (onProgress) onProgress('Restore completed successfully!');
}
