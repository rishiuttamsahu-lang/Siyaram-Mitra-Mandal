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
import { ChandaSeason, MonthlyDue, MemberOverride, SeasonAuditLog, SeasonMetrics, SeasonStatus } from './types/season';
import { commitChunkedBatches } from './utils';

const SEASONS_COLLECTION = 'chanda_seasons';
const DUES_SUBCOLLECTION = 'monthly_dues';
const OVERRIDES_SUBCOLLECTION = 'member_overrides';
const AUDIT_COLLECTION = 'season_audit_logs';

export const MANDAL_MONTHS = [
  { key: 'SEPT', name: 'September', order: 1, defaultAmount: 100 },
  { key: 'OCT', name: 'October', order: 2, defaultAmount: 100 },
  { key: 'NOV', name: 'November', order: 3, defaultAmount: 100 },
  { key: 'DEC', name: 'December', order: 4, defaultAmount: 100 },
  { key: 'JAN', name: 'January', order: 5, defaultAmount: 100 },
  { key: 'FEB', name: 'February', order: 6, defaultAmount: 100 },
  { key: 'MAR', name: 'March', order: 7, defaultAmount: 100 },
  { key: 'APR', name: 'April', order: 8, defaultAmount: 100 },
  { key: 'MAY', name: 'May', order: 9, defaultAmount: 100 },
  { key: 'JUN', name: 'June', order: 10, defaultAmount: 100 },
  { key: 'JUL', name: 'July', order: 11, defaultAmount: 100 },
  { key: 'AUG', name: 'August', order: 12, defaultAmount: 100 }
];

/**
 * ==========================================
 * AUDIT LOGGING
 * ==========================================
 */
export const logSeasonAudit = async (log: Omit<SeasonAuditLog, 'id' | 'createdAt'>): Promise<void> => {
  try {
    const ref = doc(collection(db, AUDIT_COLLECTION));
    await setDoc(ref, {
      ...log,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Failed to record season audit log:', err);
  }
};

/**
 * ==========================================
 * SEASONS CRUD & LIFECYCLE
 * ==========================================
 */

export const getSeasons = async (): Promise<ChandaSeason[]> => {
  const q = query(collection(db, SEASONS_COLLECTION), orderBy('startDate', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ChandaSeason));
};

export const subscribeSeasons = (callback: (seasons: ChandaSeason[]) => void): Unsubscribe => {
  const q = query(collection(db, SEASONS_COLLECTION), orderBy('startDate', 'desc'));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChandaSeason));
    callback(data);
  }, (err) => {
    console.warn('Firestore seasons listener warning:', err.message);
  });
};

export const getActiveSeason = async (): Promise<ChandaSeason | null> => {
  const q = query(collection(db, SEASONS_COLLECTION), where('status', '==', 'active'));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as ChandaSeason;
};

export const createSeason = async (
  data: Omit<ChandaSeason, 'id' | 'createdAt' | 'updatedAt'>,
  initialDues?: Array<{ monthKey: string; monthName: string; monthOrder: number; dueAmount: number }>,
  adminUid?: string
): Promise<string> => {
  const seasonId = `season_${data.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${Date.now().toString().slice(-4)}`;
  const ref = doc(db, SEASONS_COLLECTION, seasonId);

  await setDoc(ref, {
    ...data,
    status: data.status || 'draft',
    carryForwardEnabled: data.carryForwardEnabled ?? true,
    overpaymentCarryForwardEnabled: data.overpaymentCarryForwardEnabled ?? true,
    receiptPrefix: data.receiptPrefix || `SMM-${data.name.split('–')[0] || '2026'}`,
    receiptNextNum: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // Seed default 12-month due schedule
  const duesList = initialDues || MANDAL_MONTHS.map(m => ({
    monthKey: m.key,
    monthName: m.name,
    monthOrder: m.order,
    dueAmount: m.defaultAmount
  }));

  const batchOps: Array<(batch: any) => void> = [];
  duesList.forEach(m => {
    const dueRef = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, m.monthKey);
    batchOps.push((batch) => {
      batch.set(dueRef, {
        seasonId,
        monthKey: m.monthKey,
        monthName: m.monthName,
        monthOrder: m.monthOrder,
        dueAmount: m.dueAmount,
        status: 'open',
        locked: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
  });

  if (batchOps.length > 0) {
    await commitChunkedBatches(db, batchOps);
  }

  await logSeasonAudit({
    adminUid,
    action: 'CREATE_SEASON',
    seasonId,
    seasonName: data.name,
    after: data
  });

  return seasonId;
};

export const updateSeason = async (
  seasonId: string,
  data: Partial<ChandaSeason>,
  adminUid?: string
): Promise<void> => {
  const ref = doc(db, SEASONS_COLLECTION, seasonId);
  const oldDoc = await getDoc(ref);
  const oldData = oldDoc.data();

  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp()
  });

  await logSeasonAudit({
    adminUid,
    action: 'EDIT_SEASON',
    seasonId,
    seasonName: data.name || oldData?.name,
    before: oldData,
    after: data
  });
};

export const activateSeason = async (seasonId: string, adminUid?: string): Promise<void> => {
  // Step 1: Transition any currently active season to 'closing' or 'closed'
  const currentActiveSnap = await getDocs(query(collection(db, SEASONS_COLLECTION), where('status', '==', 'active')));
  const batchOps: Array<(batch: any) => void> = [];

  currentActiveSnap.docs.forEach(docSnap => {
    if (docSnap.id !== seasonId) {
      batchOps.push((batch) => {
        batch.update(docSnap.ref, {
          status: 'closed',
          updatedAt: serverTimestamp()
        });
      });
    }
  });

  // Step 2: Set target season to active
  const targetRef = doc(db, SEASONS_COLLECTION, seasonId);
  batchOps.push((batch) => {
    batch.update(targetRef, {
      status: 'active',
      updatedAt: serverTimestamp()
    });
  });

  await commitChunkedBatches(db, batchOps);

  await logSeasonAudit({
    adminUid,
    action: 'ACTIVATE_SEASON',
    seasonId
  });
};

export const closeSeason = async (seasonId: string, adminUid?: string, summaryNote?: string): Promise<void> => {
  const ref = doc(db, SEASONS_COLLECTION, seasonId);
  await updateDoc(ref, {
    status: 'closed',
    updatedAt: serverTimestamp()
  });

  await logSeasonAudit({
    adminUid,
    action: 'CLOSE_SEASON',
    seasonId,
    reason: summaryNote || 'Season marked closed by administrator'
  });
};

export const archiveSeason = async (seasonId: string, adminUid?: string): Promise<void> => {
  const ref = doc(db, SEASONS_COLLECTION, seasonId);
  await updateDoc(ref, {
    status: 'archived',
    updatedAt: serverTimestamp()
  });

  await logSeasonAudit({
    adminUid,
    action: 'ARCHIVE_SEASON',
    seasonId
  });
};

export const deleteSeason = async (seasonId: string, adminUid?: string): Promise<void> => {
  // Delete subcollection docs first
  const duesSnap = await getDocs(collection(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION));
  const overridesSnap = await getDocs(collection(db, SEASONS_COLLECTION, seasonId, OVERRIDES_SUBCOLLECTION));

  const batchOps: Array<(batch: any) => void> = [];
  duesSnap.docs.forEach(d => {
    batchOps.push((batch) => batch.delete(d.ref));
  });
  overridesSnap.docs.forEach(d => {
    batchOps.push((batch) => batch.delete(d.ref));
  });
  batchOps.push((batch) => batch.delete(doc(db, SEASONS_COLLECTION, seasonId)));

  await commitChunkedBatches(db, batchOps);
};

export const cleanupDuplicateSeasons = async (): Promise<void> => {
  try {
    const snap = await getDocs(collection(db, SEASONS_COLLECTION));
    if (snap.size <= 1) return;

    const map = new Map<string, Array<{ id: string; data: any; ref: any }>>();
    snap.docs.forEach(d => {
      const name = (d.data().name || '').trim().replace(/[-–]/g, '-');
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push({ id: d.id, data: d.data(), ref: d.ref });
    });

    for (const [name, list] of map.entries()) {
      if (list.length > 1) {
        // Find best one to keep: prefer active, then one with more fields, or oldest/first
        let keep = list.find(item => item.data.status === 'active') || list[0];
        const duplicates = list.filter(item => item.id !== keep.id);

        for (const dup of duplicates) {
          await deleteSeason(dup.id);
        }
      }
    }
  } catch (err) {
    console.warn('cleanupDuplicateSeasons failed:', err);
  }
};

/**
 * ==========================================
 * CLONE SEASON (Copy Previous Season)
 * ==========================================
 */
export const cloneSeason = async (
  sourceSeasonId: string,
  newSeasonData: Omit<ChandaSeason, 'id' | 'createdAt' | 'updatedAt'>,
  options: { copyOverrides?: boolean } = { copyOverrides: true },
  adminUid?: string
): Promise<string> => {
  // 1. Fetch source monthly schedule
  const sourceDues = await getMonthlyDues(sourceSeasonId);
  const duesPayload = sourceDues.map(d => ({
    monthKey: d.monthKey,
    monthName: d.monthName,
    monthOrder: d.monthOrder,
    dueAmount: d.dueAmount
  }));

  // 2. Create target season
  const newSeasonId = await createSeason(newSeasonData, duesPayload, adminUid);

  // 3. Copy member overrides if requested
  if (options.copyOverrides) {
    const sourceOverrides = await getMemberOverrides(sourceSeasonId);
    if (sourceOverrides.length > 0) {
      const batchOps: Array<(batch: any) => void> = [];
      sourceOverrides.forEach(o => {
        const overrideRef = doc(collection(db, SEASONS_COLLECTION, newSeasonId, OVERRIDES_SUBCOLLECTION));
        batchOps.push((batch) => {
          batch.set(overrideRef, {
            ...o,
            id: overrideRef.id,
            seasonId: newSeasonId,
            createdAt: serverTimestamp()
          });
        });
      });
      await commitChunkedBatches(db, batchOps);
    }
  }

  return newSeasonId;
};

/**
 * ==========================================
 * MONTHLY DUES SCHEDULE CRUD
 * ==========================================
 */

export const getMonthlyDues = async (seasonId: string): Promise<MonthlyDue[]> => {
  const q = query(
    collection(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION),
    orderBy('monthOrder', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, seasonId, ...d.data() } as MonthlyDue));
};

export const subscribeMonthlyDues = (
  seasonId: string,
  callback: (dues: MonthlyDue[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION),
    orderBy('monthOrder', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, seasonId, ...d.data() } as MonthlyDue));
    callback(data);
  }, (err) => {
    console.warn('Monthly dues listener warning:', err.message);
  });
};

export const updateMonthlyDue = async (
  seasonId: string,
  monthKey: string,
  dueAmount: number,
  adminUid?: string,
  reason?: string
): Promise<void> => {
  const ref = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, monthKey);
  const oldSnap = await getDoc(ref);
  const oldAmount = oldSnap.data()?.dueAmount;

  await setDoc(ref, {
    seasonId,
    monthKey,
    dueAmount,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await logSeasonAudit({
    adminUid,
    action: 'EDIT_MONTH_AMOUNT',
    seasonId,
    monthKey,
    before: oldAmount,
    after: dueAmount,
    reason
  });
};

export const bulkUpdateMonthlyDues = async (
  seasonId: string,
  months: Array<{ monthKey: string; dueAmount: number }>,
  adminUid?: string
): Promise<void> => {
  const batchOps: Array<(batch: any) => void> = [];
  months.forEach(m => {
    const ref = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, m.monthKey);
    batchOps.push((batch) => {
      batch.set(ref, {
        dueAmount: m.dueAmount,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
  });

  if (batchOps.length > 0) {
    await commitChunkedBatches(db, batchOps);
  }

  await logSeasonAudit({
    adminUid,
    action: 'EDIT_MONTH_AMOUNT',
    seasonId,
    reason: 'Bulk updated monthly fixed targets'
  });
};

export const addCustomMonthlyDue = async (
  seasonId: string,
  data: {
    monthKey: string;
    monthName: string;
    monthOrder: number;
    dueAmount: number;
    notes?: string;
  },
  adminUid?: string
): Promise<void> => {
  const cleanKey = data.monthKey.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '_');
  const ref = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, cleanKey);

  await setDoc(ref, {
    seasonId,
    monthKey: cleanKey,
    monthName: data.monthName.trim() || cleanKey,
    monthOrder: data.monthOrder || 13,
    dueAmount: data.dueAmount,
    status: 'open',
    locked: false,
    lockReason: data.notes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  await logSeasonAudit({
    adminUid,
    action: 'EDIT_MONTH_AMOUNT',
    seasonId,
    monthKey: cleanKey,
    after: data.dueAmount,
    reason: `Added new schedule target: ${data.monthName}`
  });
};

export const toggleMonthLock = async (
  seasonId: string,
  monthKey: string,
  locked: boolean,
  adminUid?: string,
  lockReason?: string
): Promise<void> => {
  const ref = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, monthKey);
  await updateDoc(ref, {
    locked,
    status: locked ? 'locked' : 'open',
    lockReason: lockReason || '',
    updatedAt: serverTimestamp()
  });

  await logSeasonAudit({
    adminUid,
    action: locked ? 'LOCK_MONTH' : 'UNLOCK_MONTH',
    seasonId,
    monthKey,
    reason: lockReason
  });
};

export const deleteMonthlyDue = async (
  seasonId: string,
  monthKey: string,
  adminUid?: string
): Promise<void> => {
  const ref = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, monthKey);
  await deleteDoc(ref);
  await logSeasonAudit({
    adminUid,
    action: 'EDIT_MONTH_AMOUNT',
    seasonId,
    monthKey,
    reason: `Deleted month/due item ${monthKey}`
  });
};

/**
 * ==========================================
 * MEMBER OVERRIDES
 * ==========================================
 */

export const getMemberOverrides = async (seasonId: string): Promise<MemberOverride[]> => {
  const q = query(collection(db, SEASONS_COLLECTION, seasonId, OVERRIDES_SUBCOLLECTION));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, seasonId, ...d.data() } as MemberOverride));
};

export const subscribeMemberOverrides = (
  seasonId: string,
  callback: (overrides: MemberOverride[]) => void
): Unsubscribe => {
  const q = query(collection(db, SEASONS_COLLECTION, seasonId, OVERRIDES_SUBCOLLECTION));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, seasonId, ...d.data() } as MemberOverride));
    callback(data);
  }, (err) => {
    console.warn('Member overrides listener warning:', err.message);
  });
};

export const setMemberOverride = async (
  seasonId: string,
  data: Omit<MemberOverride, 'id' | 'seasonId' | 'createdAt'>,
  adminUid?: string
): Promise<string> => {
  const overrideId = doc(collection(db, SEASONS_COLLECTION, seasonId, OVERRIDES_SUBCOLLECTION)).id;
  const ref = doc(db, SEASONS_COLLECTION, seasonId, OVERRIDES_SUBCOLLECTION, overrideId);

  await setDoc(ref, {
    ...data,
    id: overrideId,
    seasonId,
    createdAt: serverTimestamp()
  });

  await logSeasonAudit({
    adminUid,
    action: 'CREATE_OVERRIDE',
    seasonId,
    monthKey: data.monthKey,
    after: data,
    reason: data.reason
  });

  return overrideId;
};

export const deleteMemberOverride = async (
  seasonId: string,
  overrideId: string,
  adminUid?: string
): Promise<void> => {
  const ref = doc(db, SEASONS_COLLECTION, seasonId, OVERRIDES_SUBCOLLECTION, overrideId);
  await deleteDoc(ref);

  await logSeasonAudit({
    adminUid,
    action: 'REMOVE_OVERRIDE',
    seasonId
  });
};

/**
 * ==========================================
 * RESOLVE EXPECTED MONTHLY DUE
 * ==========================================
 */
export const resolveMonthlyTarget = (
  monthKey: string,
  monthlyDues: MonthlyDue[],
  memberOverrides: MemberOverride[] = [],
  userId?: string,
  flatId?: string,
  fallbackTarget: number = 100
): number => {
  // 1. Check member/flat specific override
  if (userId || flatId) {
    const matchedOverride = memberOverrides.find(o =>
      (o.monthKey === monthKey || o.monthKey === 'ALL') &&
      ((userId && o.userId === userId) || (flatId && o.flatId === flatId))
    );
    if (matchedOverride) return Number(matchedOverride.overrideAmount) || 0;
  }

  // 2. Check season monthly due schedule
  const monthDue = monthlyDues.find(m => m.monthKey === monthKey);
  if (monthDue && typeof monthDue.dueAmount === 'number') {
    return monthDue.dueAmount;
  }

  // 3. Fallback
  return fallbackTarget;
};

/**
 * ==========================================
 * INITIAL SEEDING HELPER
 * ==========================================
 */
export const seedInitialSeasons = async (): Promise<void> => {
  try {
    const existing = await getDocs(collection(db, SEASONS_COLLECTION));
    if (!existing.empty) {
      // Check if 2025-26 exists and ensure it is active if 2026-27 was mistakenly active
      const season2025 = existing.docs.find(d => d.data().name === '2025–26' || d.data().name === '2025-26');
      const season2026 = existing.docs.find(d => d.data().name === '2026–27' || d.data().name === '2026-27');
      if (season2025 && season2025.data().status === 'closed' && season2026?.data().status === 'active') {
        await updateDoc(doc(db, SEASONS_COLLECTION, season2025.id), { status: 'active' });
        await updateDoc(doc(db, SEASONS_COLLECTION, season2026.id), { status: 'draft' });
      }
      return;
    }

    // Seed 2025–26 (Active — Current Ganpati Year)
    await createSeason({
      name: '2025–26',
      displayName: 'Ganpati Chanda Season 2025–26',
      startDate: '2025-09-01',
      endDate: '2026-08-31',
      status: 'active',
      description: 'Current live Ganpati festival & monthly chanda season',
      receiptPrefix: 'SMM-2025'
    });

    // Seed 2026–27 (Draft — Upcoming Year)
    await createSeason({
      name: '2026–27',
      displayName: 'Ganpati Chanda Season 2026–27',
      startDate: '2026-09-01',
      endDate: '2027-08-31',
      status: 'draft',
      description: 'Upcoming Ganpati festival & monthly chanda season',
      receiptPrefix: 'SMM-2026'
    });
  } catch (err) {
    console.warn('Season initial seeding skipped or failed:', err);
  }
};
