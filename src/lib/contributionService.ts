import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { assertSeasonIsActive, logSeasonAudit } from './seasonService';

export interface OtherContribution {
  id: string;
  name: string;
  amount: number;
  status: 'Pending' | 'Collected';
  type?: 'Shop' | 'Dukan' | 'Friend' | 'Donor' | 'Other';
  seasonId?: string;
  notes?: string;
  isCancelled?: boolean;
  cancelledAt?: any;
  timestamp?: any;
  createdAt?: any;
  updatedAt?: any;
}

const OTHER_COLLECTION = 'other_chanda';

/**
 * Subscribe to real-time Dukan / other contributions for a specific season.
 */
export const subscribeSeasonOtherContributions = (
  seasonId: string | null | undefined,
  callback: (contributions: OtherContribution[]) => void,
  isInitialSeason: boolean = false
): Unsubscribe => {
  const q = query(collection(db, OTHER_COLLECTION), orderBy('timestamp', 'desc'));

  return onSnapshot(q, (snap) => {
    const all = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || '',
        amount: Number(data.amount) || 0,
        status: data.status || 'Pending',
        type: data.type || 'Other',
        seasonId: data.seasonId,
        notes: data.notes,
        isCancelled: !!data.isCancelled,
        cancelledAt: data.cancelledAt,
        timestamp: data.timestamp,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      } as OtherContribution;
    });

    const filtered = all.filter(item => {
      if (item.isCancelled) return false;
      if (!seasonId) return true;
      if (item.seasonId) return item.seasonId === seasonId;
      return isInitialSeason;
    });

    callback(filtered);
  }, (err) => {
    console.warn('Firestore other_chanda listener warning:', err.message);
  });
};

/**
 * Create a new Dukan / other contribution for a season.
 */
export const createSeasonOtherContribution = async (
  seasonId: string,
  data: {
    name: string;
    amount: number;
    status?: 'Pending' | 'Collected';
    type?: 'Shop' | 'Dukan' | 'Friend' | 'Donor' | 'Other';
    notes?: string;
  },
  adminUid?: string
): Promise<string> => {
  await assertSeasonIsActive(seasonId);

  const docRef = doc(collection(db, OTHER_COLLECTION));
  await setDoc(docRef, {
    ...data,
    seasonId,
    amount: Number(data.amount) || 0,
    status: data.status || 'Collected',
    isCancelled: false,
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await logSeasonAudit({
    adminUid,
    action: 'CREATE_OTHER_CHANDA' as any,
    seasonId,
    after: { ...data, id: docRef.id },
    reason: `Other contribution logged: ${data.name} (₹${data.amount})`
  });

  return docRef.id;
};

/**
 * Update an existing Dukan / other contribution.
 */
export const updateSeasonOtherContribution = async (
  seasonId: string,
  id: string,
  updates: Partial<OtherContribution>,
  adminUid?: string
): Promise<void> => {
  await assertSeasonIsActive(seasonId);

  const docRef = doc(db, OTHER_COLLECTION, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });

  await logSeasonAudit({
    adminUid,
    action: 'EDIT_OTHER_CHANDA' as any,
    seasonId,
    after: updates,
    reason: `Updated other contribution doc: ${id}`
  });
};

/**
 * Soft-archive a contribution (never hard delete).
 */
export const archiveSeasonOtherContribution = async (
  seasonId: string,
  id: string,
  adminUid?: string
): Promise<void> => {
  await assertSeasonIsActive(seasonId);

  const docRef = doc(db, OTHER_COLLECTION, id);
  await updateDoc(docRef, {
    isCancelled: true,
    cancelledAt: serverTimestamp()
  });

  await logSeasonAudit({
    adminUid,
    action: 'ARCHIVE_OTHER_CHANDA' as any,
    seasonId,
    reason: `Archived other contribution doc: ${id}`
  });
};
