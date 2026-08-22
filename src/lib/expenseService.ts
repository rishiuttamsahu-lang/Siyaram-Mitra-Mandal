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

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  date: string;
  time: string;
  seasonId?: string;
  category?: string;
  notes?: string;
  isCancelled?: boolean;
  cancelledAt?: any;
  createdAt?: any;
  timestamp?: any;
}

const EXPENSES_COLLECTION = 'expenses_log';
const SEASONS_COLLECTION = 'chanda_seasons';
const EXPENSES_SUBCOLLECTION = 'expenses';

/**
 * Subscribe to real-time expenses for a specific season.
 * Reads from root expenses_log filtered by seasonId (with legacy fallback support).
 */
export const subscribeSeasonExpenses = (
  seasonId: string | null | undefined,
  callback: (expenses: ExpenseItem[]) => void,
  isInitialSeason: boolean = false
): Unsubscribe => {
  const q = query(collection(db, EXPENSES_COLLECTION), orderBy('timestamp', 'desc'));

  return onSnapshot(q, (snap) => {
    const allExpenses = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || '',
        amount: Number(data.amount) || 0,
        date: data.date || '',
        time: data.time || '',
        seasonId: data.seasonId,
        category: data.category,
        notes: data.notes,
        isCancelled: !!data.isCancelled,
        cancelledAt: data.cancelledAt,
        createdAt: data.createdAt,
        timestamp: data.timestamp
      } as ExpenseItem;
    });

    const activeFiltered = allExpenses.filter(item => {
      if (item.isCancelled) return false;
      if (!seasonId) return true;
      if (item.seasonId) return item.seasonId === seasonId;
      // If doc has no seasonId, associate with initial legacy season only
      return isInitialSeason;
    });

    callback(activeFiltered);
  }, (err) => {
    console.warn('Firestore expenses listener warning:', err.message);
  });
};

/**
 * Log a new expense for a specific season.
 * Checks that the season is active and not historical/closed.
 */
export const createSeasonExpense = async (
  seasonId: string,
  data: {
    name: string;
    amount: number;
    date: string;
    time: string;
    category?: string;
    notes?: string;
  },
  adminUid?: string
): Promise<string> => {
  await assertSeasonIsActive(seasonId);

  const docRef = doc(collection(db, EXPENSES_COLLECTION));
  await setDoc(docRef, {
    ...data,
    seasonId,
    amount: Number(data.amount) || 0,
    isCancelled: false,
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp()
  });

  await logSeasonAudit({
    adminUid,
    action: 'LOG_EXPENSE' as any,
    seasonId,
    after: { ...data, id: docRef.id },
    reason: `Expense logged: ${data.name} (₹${data.amount})`
  });

  return docRef.id;
};

/**
 * Soft-archive an expense (never hard-deletes).
 */
export const archiveSeasonExpense = async (
  seasonId: string,
  expenseId: string,
  adminUid?: string,
  reason?: string
): Promise<void> => {
  await assertSeasonIsActive(seasonId);

  const docRef = doc(db, EXPENSES_COLLECTION, expenseId);
  await updateDoc(docRef, {
    isCancelled: true,
    cancelledAt: serverTimestamp()
  });

  await logSeasonAudit({
    adminUid,
    action: 'ARCHIVE_EXPENSE' as any,
    seasonId,
    reason: reason || `Archived expense doc: ${expenseId}`
  });
};
