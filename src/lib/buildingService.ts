import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { Building, Wing, Flat } from './types/building';
import { commitChunkedBatches } from './utils';

const BUILDINGS_COLLECTION = 'buildings';
const WINGS_COLLECTION = 'wings';
const FLATS_COLLECTION = 'flats';
const LEGACY_COLLECTION = 'building_chanda';

/**
 * ==========================================
 * BUILDINGS CRUD
 * ==========================================
 */

export const getBuildings = async (): Promise<Building[]> => {
  const q = query(collection(db, BUILDINGS_COLLECTION), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Building));
};

export const subscribeBuildings = (callback: (buildings: Building[]) => void): Unsubscribe => {
  const q = query(collection(db, BUILDINGS_COLLECTION), orderBy('name', 'asc'));
  return onSnapshot(q, async (snap) => {
    if (snap.empty) {
      // Auto-initialize default building if empty
      try {
        await migrateLegacyBuildingChanda('siyaram_main');
      } catch (_) {}
    }
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Building));
    callback(data);
  }, (err) => {
    console.warn("Firestore buildings listener permission/network warning:", err.message);
  });
};

export const createBuilding = async (data: Omit<Building, 'id' | 'createdAt' | 'updatedAt'>, customId?: string): Promise<string> => {
  const buildingId = customId || data.code.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || doc(collection(db, BUILDINGS_COLLECTION)).id;
  const ref = doc(db, BUILDINGS_COLLECTION, buildingId);
  await setDoc(ref, {
    ...data,
    status: data.status || 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return buildingId;
};

export const updateBuilding = async (buildingId: string, data: Partial<Building>): Promise<void> => {
  const ref = doc(db, BUILDINGS_COLLECTION, buildingId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp()
  });
};

export const deleteBuilding = async (buildingId: string): Promise<void> => {
  // Delete sub-collections (wings & flats) first
  const wings = await getWings(buildingId);
  for (const wing of wings) {
    await deleteWing(buildingId, wing.id);
  }
  const ref = doc(db, BUILDINGS_COLLECTION, buildingId);
  await deleteDoc(ref);
};

/**
 * ==========================================
 * WINGS CRUD
 * ==========================================
 */

export const getWings = async (buildingId: string): Promise<Wing[]> => {
  const q = query(collection(db, BUILDINGS_COLLECTION, buildingId, WINGS_COLLECTION), orderBy('code', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, buildingId, ...d.data() } as Wing));
};

export const subscribeWings = (buildingId: string, callback: (wings: Wing[]) => void): Unsubscribe => {
  const q = query(collection(db, BUILDINGS_COLLECTION, buildingId, WINGS_COLLECTION), orderBy('code', 'asc'));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, buildingId, ...d.data() } as Wing));
    callback(data);
  }, (err) => {
    console.warn("Firestore wings listener permission/network warning:", err.message);
  });
};

export const createWing = async (buildingId: string, data: Omit<Wing, 'id' | 'buildingId' | 'createdAt' | 'updatedAt'>, customId?: string): Promise<string> => {
  const wingId = customId || data.code.toUpperCase().trim();
  const ref = doc(db, BUILDINGS_COLLECTION, buildingId, WINGS_COLLECTION, wingId);
  await setDoc(ref, {
    ...data,
    code: data.code.toUpperCase().trim(),
    status: data.status || 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return wingId;
};

export const updateWing = async (buildingId: string, wingId: string, data: Partial<Wing>): Promise<void> => {
  const ref = doc(db, BUILDINGS_COLLECTION, buildingId, WINGS_COLLECTION, wingId);
  await updateDoc(ref, {
    ...data,
    ...(data.code ? { code: data.code.toUpperCase().trim() } : {}),
    updatedAt: serverTimestamp()
  });
};

export const deleteWing = async (buildingId: string, wingId: string): Promise<void> => {
  const flats = await getFlats(buildingId, wingId);
  const deleteOps = flats.map(f => {
    const flatRef = doc(db, BUILDINGS_COLLECTION, buildingId, WINGS_COLLECTION, wingId, FLATS_COLLECTION, f.id);
    return (batch: any) => batch.delete(flatRef);
  });
  if (deleteOps.length > 0) {
    await commitChunkedBatches(db, deleteOps);
  }
  const ref = doc(db, BUILDINGS_COLLECTION, buildingId, WINGS_COLLECTION, wingId);
  await deleteDoc(ref);
};

/**
 * ==========================================
 * FLATS CRUD
 * ==========================================
 */

export const getFlats = async (buildingId: string, wingId: string): Promise<Flat[]> => {
  const q = query(collection(db, BUILDINGS_COLLECTION, buildingId, WINGS_COLLECTION, wingId, FLATS_COLLECTION), orderBy('flatNumber', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, buildingId, wingId, ...d.data() } as Flat));
};

export const subscribeFlats = (buildingId: string, wingId: string, callback: (flats: Flat[]) => void): Unsubscribe => {
  const q = query(collection(db, BUILDINGS_COLLECTION, buildingId, WINGS_COLLECTION, wingId, FLATS_COLLECTION), orderBy('flatNumber', 'asc'));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, buildingId, wingId, ...d.data() } as Flat));
    callback(data);
  }, (err) => {
    console.warn("Firestore flats listener permission/network warning:", err.message);
  });
};

export const subscribeAllFlatsInBuilding = (buildingId: string, wings: Wing[], callback: (flatsMap: Record<string, Flat[]>) => void): Unsubscribe[] => {
  const unsubs: Unsubscribe[] = [];
  const flatsMap: Record<string, Flat[]> = {};

  wings.forEach(w => {
    const unsub = subscribeFlats(buildingId, w.id, (flats) => {
      flatsMap[w.id] = flats;
      callback({ ...flatsMap });
    });
    unsubs.push(unsub);
  });

  return unsubs;
};

export const createOrUpdateFlat = async (
  buildingId: string,
  wingId: string,
  flatData: Partial<Flat> & { flatNumber: string; displayNumber?: string }
): Promise<string> => {
  const flatId = flatData.id || `${wingId}_${flatData.flatNumber}`;
  const ref = doc(db, BUILDINGS_COLLECTION, buildingId, WINGS_COLLECTION, wingId, FLATS_COLLECTION, flatId);

  const payload: any = {
    ...flatData,
    flatNumber: String(flatData.flatNumber).trim(),
    displayNumber: flatData.displayNumber || `${wingId}-${flatData.flatNumber}`,
    status: flatData.status || 'active',
    updatedAt: serverTimestamp()
  };

  const existing = await getDoc(ref);
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
    payload.paidChanda = flatData.paidChanda || 0;
    payload.expectedChanda = flatData.expectedChanda || 0;
    payload.paymentStatus = flatData.paymentStatus || 'No Record';
  }

  await setDoc(ref, payload, { merge: true });

  // Maintain backward compatibility with legacy `building_chanda` if needed
  try {
    const legacyRef = doc(db, LEGACY_COLLECTION, flatId);
    await setDoc(legacyRef, {
      wing: wingId,
      room: flatData.flatNumber,
      name: flatData.residentName || '',
      amount: flatData.paidChanda || 0,
      status: (flatData.paidChanda && flatData.paidChanda > 0) ? 'Collected' : 'Pending',
      lastUpdated: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not sync to legacy collection:', err);
  }

  return flatId;
};

export const deleteFlat = async (buildingId: string, wingId: string, flatId: string): Promise<void> => {
  const ref = doc(db, BUILDINGS_COLLECTION, buildingId, WINGS_COLLECTION, wingId, FLATS_COLLECTION, flatId);
  await deleteDoc(ref);
};

/**
 * ==========================================
 * BULK FLAT GENERATOR
 * ==========================================
 */

export interface FlatRange {
  start: number;
  end: number;
  prefix?: string;
  floor?: number | string;
}

export const bulkGenerateFlats = async (
  buildingId: string,
  wingId: string,
  wingCode: string,
  ranges: FlatRange[],
  defaultExpectedChanda: number = 0
): Promise<number> => {
  const operations: Array<(batch: any) => void> = [];
  let count = 0;

  for (const range of ranges) {
    for (let num = range.start; num <= range.end; num++) {
      const flatNumStr = range.prefix ? `${range.prefix}${num}` : String(num);
      const flatId = `${wingCode}_${flatNumStr}`;
      const flatRef = doc(db, BUILDINGS_COLLECTION, buildingId, WINGS_COLLECTION, wingId, FLATS_COLLECTION, flatId);

      // Floor derivation (e.g. 101 -> Floor 1, 201 -> Floor 2, 01 -> Floor 0)
      let floorVal = range.floor;
      if (floorVal === undefined) {
        if (num >= 100) {
          floorVal = Math.floor(num / 100);
        } else {
          floorVal = 0;
        }
      }

      operations.push((batch) => {
        batch.set(flatRef, {
          flatNumber: flatNumStr,
          displayNumber: `${wingCode}-${flatNumStr}`,
          floor: floorVal,
          status: 'active',
          paymentStatus: 'No Record',
          expectedChanda: defaultExpectedChanda,
          paidChanda: 0,
          residentName: '',
          residentPhone: '',
          residentEmail: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      count++;
    }
  }

  if (operations.length > 0) {
    await commitChunkedBatches(db, operations);
  }

  return count;
};

/**
 * ==========================================
 * LEGACY MIGRATION UTILITY
 * ==========================================
 */

export interface MigrationSummary {
  totalLegacyRecords: number;
  migratedCount: number;
  errors: string[];
}

export const migrateLegacyBuildingChanda = async (
  targetBuildingId: string = 'siyaram_main'
): Promise<MigrationSummary> => {
  const summary: MigrationSummary = {
    totalLegacyRecords: 0,
    migratedCount: 0,
    errors: []
  };

  try {
    // 1. Ensure target building exists
    const buildingRef = doc(db, BUILDINGS_COLLECTION, targetBuildingId);
    const buildingSnap = await getDoc(buildingRef);
    if (!buildingSnap.exists()) {
      await setDoc(buildingRef, {
        name: 'Siyaram Building',
        code: 'SMM',
        status: 'active',
        description: 'Main Siyaram Mandal Residential Premises',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // 2. Fetch all legacy building_chanda docs
    const legacySnap = await getDocs(collection(db, LEGACY_COLLECTION));
    summary.totalLegacyRecords = legacySnap.size;

    const wingSet = new Set<string>();
    const legacyDocs = legacySnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    // Detect wings
    legacyDocs.forEach(item => {
      let wingCode = item.wing ? String(item.wing).toUpperCase().trim() : '';
      if (!wingCode && item.id.includes('_')) {
        wingCode = item.id.split('_')[0].toUpperCase().trim();
      }
      if (wingCode) wingSet.add(wingCode);
    });

    // 3. Ensure wings exist
    for (const wingCode of Array.from(wingSet)) {
      const wingRef = doc(db, BUILDINGS_COLLECTION, targetBuildingId, WINGS_COLLECTION, wingCode);
      const wingSnap = await getDoc(wingRef);
      if (!wingSnap.exists()) {
        await setDoc(wingRef, {
          name: `${wingCode} Wing`,
          code: wingCode,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }

    // 4. Batch migrate flats
    const operations: Array<(batch: any) => void> = [];

    legacyDocs.forEach(item => {
      let wingCode = item.wing ? String(item.wing).toUpperCase().trim() : '';
      let roomNum = item.room ? String(item.room).trim() : '';

      if (!wingCode && item.id.includes('_')) {
        const parts = item.id.split('_');
        wingCode = parts[0].toUpperCase().trim();
        roomNum = parts[1] || '';
      }

      if (!wingCode || !roomNum) {
        summary.errors.push(`Invalid legacy document ID or data: ${item.id}`);
        return;
      }

      const flatId = `${wingCode}_${roomNum}`;
      const flatRef = doc(db, BUILDINGS_COLLECTION, targetBuildingId, WINGS_COLLECTION, wingCode, FLATS_COLLECTION, flatId);

      const paidAmount = Number(item.amount) || 0;
      const isCollected = item.status === 'Collected' || paidAmount > 0;

      // Determine floor from room number
      const parsedNum = parseInt(roomNum, 10);
      const floorVal = !isNaN(parsedNum) && parsedNum >= 100 ? Math.floor(parsedNum / 100) : 0;

      operations.push((batch) => {
        batch.set(flatRef, {
          flatNumber: roomNum,
          displayNumber: `${wingCode}-${roomNum}`,
          floor: floorVal,
          residentName: item.name || '',
          paidChanda: paidAmount,
          expectedChanda: item.expectedChanda || (paidAmount > 0 ? paidAmount : 500),
          paymentStatus: isCollected ? 'Paid' : 'Due',
          status: 'active',
          legacyId: item.id,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
    });

    if (operations.length > 0) {
      await commitChunkedBatches(db, operations);
      summary.migratedCount = operations.length;
    }

  } catch (err: any) {
    summary.errors.push(err.message || 'Migration error occurred');
  }

  return summary;
};
