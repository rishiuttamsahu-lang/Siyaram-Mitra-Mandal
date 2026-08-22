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
  { key: 'SEPT', name: 'September', order: 1, defaultAmount: 100, monthOffset: 0 },
  { key: 'OCT', name: 'October', order: 2, defaultAmount: 100, monthOffset: 1 },
  { key: 'NOV', name: 'November', order: 3, defaultAmount: 100, monthOffset: 2 },
  { key: 'DEC', name: 'December', order: 4, defaultAmount: 100, monthOffset: 3 },
  { key: 'JAN', name: 'January', order: 5, defaultAmount: 100, monthOffset: 4 },
  { key: 'FEB', name: 'February', order: 6, defaultAmount: 100, monthOffset: 5 },
  { key: 'MAR', name: 'March', order: 7, defaultAmount: 100, monthOffset: 6 },
  { key: 'APR', name: 'April', order: 8, defaultAmount: 100, monthOffset: 7 },
  { key: 'MAY', name: 'May', order: 9, defaultAmount: 100, monthOffset: 8 },
  { key: 'JUN', name: 'June', order: 10, defaultAmount: 100, monthOffset: 9 },
  { key: 'JUL', name: 'July', order: 11, defaultAmount: 100, monthOffset: 10 },
  { key: 'AUG', name: 'August', order: 12, defaultAmount: 100, monthOffset: 11 }
];

export const CALENDAR_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Helper to generate canonical periodKey e.g. "2025-09"
 */
export const formatPeriodKey = (year: number, month1to12: number): string => {
  return `${year}-${String(month1to12).padStart(2, '0')}`;
};

/**
 * Normalizes MonthlyDue to guarantee periodKey, monthName, year, and monthOrder
 */
export const normalizeMonthlyDue = (due: MonthlyDue, seasonStartDate?: string): MonthlyDue => {
  let periodKey = due.periodKey;
  let year = due.year;
  let monthName = due.monthName || due.monthKey || due.id;

  if (!periodKey) {
    if (due.id && /^\d{4}-\d{2}$/.test(due.id)) {
      periodKey = due.id;
      year = parseInt(periodKey.split('-')[0], 10);
    } else if (due.monthKey && seasonStartDate) {
      // Map standard month to season start year
      const startYear = parseInt(seasonStartDate.split('-')[0], 10) || new Date().getFullYear();
      const monthIdx = MANDAL_MONTHS.findIndex(m => m.key === due.monthKey);
      if (monthIdx >= 0) {
        // First 4 months (Sep, Oct, Nov, Dec) in startYear; remaining in startYear + 1
        const calculatedYear = monthIdx < 4 ? startYear : startYear + 1;
        const calMonth = monthIdx < 4 ? monthIdx + 9 : monthIdx - 3;
        periodKey = formatPeriodKey(calculatedYear, calMonth);
        year = year || calculatedYear;
      }
    }
  }

  if (periodKey && !year) {
    year = parseInt(periodKey.split('-')[0], 10);
  }

  return {
    ...due,
    periodKey: periodKey || due.monthKey || due.id,
    monthKey: due.monthKey || due.id,
    monthName,
    year,
    monthOrder: due.monthOrder || 1,
    dueAmount: typeof due.dueAmount === 'number' ? due.dueAmount : 100,
    status: due.locked ? 'locked' : (due.status || 'open'),
    locked: !!due.locked
  };
};

/**
 * ==========================================
 * EFFECTIVE BLOCK RESOLVER
 * ==========================================
 */
export interface EffectivePeriodStatus {
  isBlocked: boolean;
  reason: 'global' | 'season' | 'exempt' | null;
  reasonText: string;
  badgeText: string;
}

export const resolveEffectivePeriodStatus = (
  periodKeyOrMonthKey: string,
  monthlyDue?: MonthlyDue,
  globalBlockedMonths: string[] = [],
  memberExemptPeriods: string[] = []
): EffectivePeriodStatus => {
  const normalizedKey = (periodKeyOrMonthKey || '').toUpperCase().trim();
  const normalizedDue = monthlyDue ? normalizeMonthlyDue(monthlyDue) : undefined;
  const canonicalPeriodKey = normalizedDue?.periodKey || periodKeyOrMonthKey;
  const legacyKey = normalizedDue?.monthKey || periodKeyOrMonthKey;

  // 1. Check Global Block
  const isGloballyBlocked = globalBlockedMonths.some(gm => {
    const ugm = gm.toUpperCase().trim();
    return ugm === normalizedKey || ugm === canonicalPeriodKey.toUpperCase() || (legacyKey && ugm === legacyKey.toUpperCase());
  });

  if (isGloballyBlocked) {
    return {
      isBlocked: true,
      reason: 'global',
      reasonText: 'Globally blocked by Mandal settings',
      badgeText: 'BLOCKED (Global)'
    };
  }

  // 2. Check Season Lock
  if (normalizedDue?.locked || normalizedDue?.status === 'locked') {
    return {
      isBlocked: true,
      reason: 'season',
      reasonText: normalizedDue.lockReason || 'Locked for this season',
      badgeText: 'LOCKED (Season)'
    };
  }

  // 3. Check Member Exemption
  const isMemberExempt = memberExemptPeriods.some(em => {
    const uem = em.toUpperCase().trim();
    return uem === 'ALL' || uem === normalizedKey || uem === canonicalPeriodKey.toUpperCase() || (legacyKey && uem === legacyKey.toUpperCase());
  });

  if (isMemberExempt) {
    return {
      isBlocked: true,
      reason: 'exempt',
      reasonText: 'Member has an individual exemption for this month',
      badgeText: 'EXEMPT'
    };
  }

  return {
    isBlocked: false,
    reason: null,
    reasonText: 'Active',
    badgeText: 'OPEN'
  };
};

/**
 * ==========================================
 * GLOBAL MONTH BLOCKING MANAGEMENT
 * ==========================================
 */
const SETTINGS_CONFIG_DOC = 'mandal_settings/config';

export const getGlobalBlockedMonths = async (): Promise<string[]> => {
  try {
    const snap = await getDoc(doc(db, 'mandal_settings', 'config'));
    if (!snap.exists()) return [];
    return (snap.data()?.blockedMonths as string[]) || [];
  } catch (err) {
    console.warn('Failed to load global blocked months:', err);
    return [];
  }
};

export const setGlobalBlockedMonths = async (
  blockedMonths: string[],
  adminUid?: string,
  reason?: string
): Promise<void> => {
  const ref = doc(db, 'mandal_settings', 'config');
  const snap = await getDoc(ref);
  const oldBlocked = snap.exists() ? (snap.data().blockedMonths || []) : [];

  await setDoc(ref, {
    blockedMonths,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await logSeasonAudit({
    adminUid,
    action: blockedMonths.length >= oldBlocked.length ? 'GLOBAL_BLOCK_MONTHS' : 'GLOBAL_UNBLOCK_MONTHS',
    seasonId: 'global_config',
    before: oldBlocked,
    after: blockedMonths,
    reason: reason || 'Updated global blocked months'
  });
};

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
  initialDues?: Array<{ periodKey?: string; monthKey?: string; monthName: string; year?: number; monthOrder: number; dueAmount: number }>,
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

  const startYear = parseInt((data.startDate || '2025-09-01').split('-')[0], 10) || new Date().getFullYear();

  // Seed default 12-month due schedule with year-aware periodKey
  const duesList = initialDues || MANDAL_MONTHS.map((m, idx) => {
    const calculatedYear = idx < 4 ? startYear : startYear + 1;
    const calMonth = idx < 4 ? idx + 9 : idx - 3;
    const pKey = formatPeriodKey(calculatedYear, calMonth);
    return {
      periodKey: pKey,
      monthKey: m.key,
      monthName: m.name,
      year: calculatedYear,
      monthOrder: m.order,
      dueAmount: m.defaultAmount
    };
  });

  const batchOps: Array<(batch: any) => void> = [];
  duesList.forEach(m => {
    const docId = m.periodKey || m.monthKey || `month_${m.monthOrder}`;
    const dueRef = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, docId);
    batchOps.push((batch) => {
      batch.set(dueRef, {
        seasonId,
        periodKey: m.periodKey || docId,
        monthKey: m.monthKey || docId,
        monthName: m.monthName,
        year: m.year || startYear,
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

export const getMonthlyDues = async (seasonId: string, seasonStartDate?: string): Promise<MonthlyDue[]> => {
  const q = query(
    collection(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION),
    orderBy('monthOrder', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const raw = { id: d.id, seasonId, ...d.data() } as MonthlyDue;
    return normalizeMonthlyDue(raw, seasonStartDate);
  });
};

export const subscribeMonthlyDues = (
  seasonId: string,
  callback: (dues: MonthlyDue[]) => void,
  seasonStartDate?: string
): Unsubscribe => {
  const q = query(
    collection(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION),
    orderBy('monthOrder', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => {
      const raw = { id: d.id, seasonId, ...d.data() } as MonthlyDue;
      return normalizeMonthlyDue(raw, seasonStartDate);
    });
    callback(data);
  }, (err) => {
    console.warn('Monthly dues listener warning:', err.message);
  });
};

export const updateMonthlyDue = async (
  seasonId: string,
  dueIdOrMonthKey: string,
  dueAmount: number,
  adminUid?: string,
  reason?: string
): Promise<void> => {
  const ref = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, dueIdOrMonthKey);
  const oldSnap = await getDoc(ref);
  const oldAmount = oldSnap.data()?.dueAmount;

  await setDoc(ref, {
    seasonId,
    dueAmount,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await logSeasonAudit({
    adminUid,
    action: 'EDIT_MONTH_AMOUNT',
    seasonId,
    monthKey: dueIdOrMonthKey,
    periodKey: dueIdOrMonthKey,
    before: oldAmount,
    after: dueAmount,
    reason
  });
};

export const bulkUpdateMonthlyDues = async (
  seasonId: string,
  months: Array<{ dueId?: string; monthKey?: string; periodKey?: string; dueAmount: number }>,
  adminUid?: string
): Promise<void> => {
  const batchOps: Array<(batch: any) => void> = [];
  months.forEach(m => {
    const key = m.dueId || m.periodKey || m.monthKey;
    if (!key) return;
    const ref = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, key);
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
    periodKey?: string;
    monthKey?: string;
    monthName: string;
    year?: number;
    monthOrder?: number;
    dueAmount: number;
    notes?: string;
  },
  adminUid?: string
): Promise<string> => {
  let pKey = data.periodKey;
  if (!pKey) {
    if (data.year && data.monthName) {
      const monthIdx = CALENDAR_MONTH_NAMES.findIndex(m => m.toLowerCase() === data.monthName.toLowerCase());
      if (monthIdx >= 0) {
        pKey = formatPeriodKey(data.year, monthIdx + 1);
      }
    }
  }
  if (!pKey) {
    pKey = (data.monthKey || data.monthName || `custom_${Date.now()}`).toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '_');
  }

  const docId = pKey;
  const ref = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, docId);

  await setDoc(ref, {
    seasonId,
    periodKey: pKey,
    monthKey: data.monthKey || pKey,
    monthName: data.monthName.trim() || pKey,
    year: data.year || (pKey.includes('-') ? parseInt(pKey.split('-')[0], 10) : new Date().getFullYear()),
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
    monthKey: data.monthKey || pKey,
    periodKey: pKey,
    after: data.dueAmount,
    reason: `Added new schedule target: ${data.monthName} (Order #${data.monthOrder || 13})`
  });

  return docId;
};

export const toggleMonthLock = async (
  seasonId: string,
  dueIdOrMonthKey: string,
  locked: boolean,
  adminUid?: string,
  lockReason?: string
): Promise<void> => {
  const ref = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, dueIdOrMonthKey);
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
    monthKey: dueIdOrMonthKey,
    periodKey: dueIdOrMonthKey,
    reason: lockReason
  });
};

export const bulkLockMonthlyDues = async (
  seasonId: string,
  dueIdsOrPeriodKeys: string[],
  reason: string = 'Locked by administrator',
  adminUid?: string
): Promise<void> => {
  if (dueIdsOrPeriodKeys.length === 0) return;

  const batchOps: Array<(batch: any) => void> = [];
  dueIdsOrPeriodKeys.forEach(key => {
    const ref = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, key);
    batchOps.push((batch) => {
      batch.update(ref, {
        locked: true,
        status: 'locked',
        lockReason: reason,
        updatedAt: serverTimestamp()
      });
    });
  });

  await commitChunkedBatches(db, batchOps);

  await logSeasonAudit({
    adminUid,
    action: 'BULK_LOCK_MONTHS',
    seasonId,
    periodKeys: dueIdsOrPeriodKeys,
    reason
  });
};

export const bulkUnlockMonthlyDues = async (
  seasonId: string,
  dueIdsOrPeriodKeys: string[],
  reason: string = 'Unlocked by administrator',
  adminUid?: string
): Promise<void> => {
  if (dueIdsOrPeriodKeys.length === 0) return;

  const batchOps: Array<(batch: any) => void> = [];
  dueIdsOrPeriodKeys.forEach(key => {
    const ref = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, key);
    batchOps.push((batch) => {
      batch.update(ref, {
        locked: false,
        status: 'open',
        lockReason: '',
        updatedAt: serverTimestamp()
      });
    });
  });

  await commitChunkedBatches(db, batchOps);

  await logSeasonAudit({
    adminUid,
    action: 'BULK_UNLOCK_MONTHS',
    seasonId,
    periodKeys: dueIdsOrPeriodKeys,
    reason
  });
};

export const deleteMonthlyDue = async (
  seasonId: string,
  dueIdOrMonthKey: string,
  adminUid?: string
): Promise<void> => {
  const ref = doc(db, SEASONS_COLLECTION, seasonId, DUES_SUBCOLLECTION, dueIdOrMonthKey);
  await deleteDoc(ref);
  await logSeasonAudit({
    adminUid,
    action: 'EDIT_MONTH_AMOUNT',
    seasonId,
    monthKey: dueIdOrMonthKey,
    periodKey: dueIdOrMonthKey,
    reason: `Deleted month/due item ${dueIdOrMonthKey}`
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
    monthKey: data.monthKey || data.periodKey,
    periodKey: data.periodKey || data.monthKey,
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
  periodKeyOrMonthKey: string,
  monthlyDues: MonthlyDue[],
  memberOverrides: MemberOverride[] = [],
  userId?: string,
  flatId?: string,
  fallbackTarget: number = 100
): number => {
  const targetKey = (periodKeyOrMonthKey || '').toUpperCase().trim();

  // 1. Check member/flat specific override
  if (userId || flatId) {
    const matchedOverride = memberOverrides.find(o => {
      const oPeriod = (o.periodKey || '').toUpperCase().trim();
      const oMonth = (o.monthKey || '').toUpperCase().trim();
      const isMatch = oMonth === 'ALL' || oPeriod === targetKey || oMonth === targetKey;
      return isMatch && ((userId && o.userId === userId) || (flatId && o.flatId === flatId));
    });
    if (matchedOverride) return Number(matchedOverride.overrideAmount) || 0;
  }

  // 2. Check season monthly due schedule
  const monthDue = monthlyDues.find(m => {
    const pKey = (m.periodKey || '').toUpperCase().trim();
    const mKey = (m.monthKey || '').toUpperCase().trim();
    const idKey = (m.id || '').toUpperCase().trim();
    return pKey === targetKey || mKey === targetKey || idKey === targetKey;
  });

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
