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

export interface MandalMember {
  id: number | string;
  name: string;
  payments?: Record<string, number>;
  isHonorary?: boolean;
  exemptMonths?: string[];
  isRemoved?: boolean;
  preRemovalExemptMonths?: string[];
  isArchived?: boolean;
  createdAt?: any;
  updatedAt?: any;
  seasonId?: string;
}

const SEASONS_COLLECTION = 'chanda_seasons';
const MEMBERS_SUBCOLLECTION = 'members';
const LEGACY_MEMBERS_COLLECTION = 'mandal_members';

/**
 * Subscribe to member roster for a specific season.
 * For the initial/oldest season (or when seasonId is not set), it seamlessly reads
 * and merges the master roster from `mandal_members` with any season-specific records
 * so no historical member data is ever missing.
 */
export const subscribeSeasonMembers = (
  seasonId: string | null | undefined,
  callback: (members: MandalMember[]) => void,
  isInitialSeason: boolean = false
): Unsubscribe => {
  if (!seasonId || isInitialSeason) {
    // For legacy/initial season (2025-26), listen to mandal_members so all historical members are preserved
    const legacyRef = collection(db, LEGACY_MEMBERS_COLLECTION);
    const seasonMembersRef = seasonId ? collection(db, SEASONS_COLLECTION, seasonId, MEMBERS_SUBCOLLECTION) : null;

    let legacyMembers: MandalMember[] = [];
    let seasonMembersMap: Record<string, MandalMember> = {};

    const emitMerged = () => {
      const mergedMap: Record<string, MandalMember> = {};
      legacyMembers.forEach(m => {
        mergedMap[String(m.id)] = { ...m };
      });

      // Overlay season-specific docs if any
      Object.entries(seasonMembersMap).forEach(([id, sMem]) => {
        if (mergedMap[id]) {
          mergedMap[id] = {
            ...mergedMap[id],
            ...sMem,
            name: sMem.name || mergedMap[id].name,
            isHonorary: sMem.isHonorary !== undefined ? sMem.isHonorary : mergedMap[id].isHonorary,
            exemptMonths: sMem.exemptMonths || mergedMap[id].exemptMonths,
            isRemoved: sMem.isRemoved !== undefined ? sMem.isRemoved : mergedMap[id].isRemoved,
            payments: {
              ...(mergedMap[id].payments || {}),
              ...(sMem.payments || {})
            }
          };
        } else if (sMem.name) {
          mergedMap[id] = sMem;
        }
      });

      const list = Object.values(mergedMap);
      list.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
      callback(list);
    };

    const unsubLegacy = onSnapshot(legacyRef, (snap) => {
      legacyMembers = snap.docs.map(d => {
        const data = d.data();
        return {
          id: isNaN(Number(d.id)) ? d.id : Number(d.id),
          name: data.name || '',
          payments: data.payments || {},
          isHonorary: !!data.isHonorary,
          isRemoved: !!data.isRemoved,
          exemptMonths: data.exemptMonths || [],
          preRemovalExemptMonths: data.preRemovalExemptMonths || [],
          isArchived: !!data.isArchived || !!data.isRemoved,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          seasonId: seasonId || undefined
        } as MandalMember;
      });
      emitMerged();
    });

    let unsubSeason: Unsubscribe = () => {};
    if (seasonMembersRef) {
      unsubSeason = onSnapshot(seasonMembersRef, (snap) => {
        seasonMembersMap = {};
        snap.docs.forEach(d => {
          const data = d.data();
          seasonMembersMap[d.id] = {
            id: isNaN(Number(d.id)) ? d.id : Number(d.id),
            name: data.name || '',
            payments: data.payments || {},
            isHonorary: data.isHonorary,
            isRemoved: data.isRemoved,
            exemptMonths: data.exemptMonths,
            preRemovalExemptMonths: data.preRemovalExemptMonths,
            isArchived: data.isArchived,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            seasonId: seasonId || undefined
          } as MandalMember;
        });
        emitMerged();
      });
    }

    return () => {
      unsubLegacy();
      unsubSeason();
    };
  }

  // For newer seasons (e.g. 2026-27), read strictly from season subcollection
  const seasonMembersRef = collection(db, SEASONS_COLLECTION, seasonId, MEMBERS_SUBCOLLECTION);
  return onSnapshot(seasonMembersRef, (snap) => {
    const list = snap.docs.map(d => {
      const data = d.data();
      return {
        id: isNaN(Number(d.id)) ? d.id : Number(d.id),
        name: data.name || '',
        payments: data.payments || {},
        isHonorary: !!data.isHonorary,
        isRemoved: !!data.isRemoved,
        exemptMonths: data.exemptMonths || [],
        preRemovalExemptMonths: data.preRemovalExemptMonths || [],
        isArchived: !!data.isArchived || !!data.isRemoved,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        seasonId
      } as MandalMember;
    });
    list.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    callback(list);
  });
};

/**
 * Add a new member into a specific season's roster.
 */
export const addMemberToSeason = async (
  seasonId: string,
  member: Omit<MandalMember, 'createdAt' | 'updatedAt' | 'seasonId'>,
  isHistoricalSeason: boolean = false
): Promise<void> => {
  if (isHistoricalSeason) {
    throw new Error('Cannot add members to a closed or historical season.');
  }

  const memberDocId = String(member.id);
  const docRef = doc(db, SEASONS_COLLECTION, seasonId, MEMBERS_SUBCOLLECTION, memberDocId);
  await setDoc(docRef, {
    ...member,
    payments: member.payments || {},
    seasonId,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  // Also maintain backward-compatible legacy record if this is the active/initial season
  try {
    await setDoc(doc(db, LEGACY_MEMBERS_COLLECTION, memberDocId), {
      ...member,
      payments: member.payments || {},
      seasonId,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    // Non-fatal
  }
};

/**
 * Update an existing member in a specific season.
 */
export const updateMemberInSeason = async (
  seasonId: string,
  memberId: string | number,
  updates: Partial<MandalMember>,
  isHistoricalSeason: boolean = false
): Promise<void> => {
  if (isHistoricalSeason) {
    throw new Error('Cannot modify members in a closed or historical season.');
  }

  const docRef = doc(db, SEASONS_COLLECTION, seasonId, MEMBERS_SUBCOLLECTION, String(memberId));
  await setDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp()
  }, { merge: true });

  // Legacy sync
  try {
    await setDoc(doc(db, LEGACY_MEMBERS_COLLECTION, String(memberId)), {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    // Non-fatal
  }
};

/**
 * Archive (soft-remove) a member in a specific season. Never hard deletes!
 */
export const archiveMemberInSeason = async (
  seasonId: string,
  memberId: string | number,
  isHistoricalSeason: boolean = false
): Promise<void> => {
  if (isHistoricalSeason) {
    throw new Error('Cannot remove members from a closed or historical season.');
  }

  await updateMemberInSeason(seasonId, memberId, { isArchived: true, isRemoved: true }, isHistoricalSeason);
};

/**
 * Restore an archived member in a specific season.
 */
export const restoreMemberInSeason = async (
  seasonId: string,
  memberId: string | number,
  isHistoricalSeason: boolean = false
): Promise<void> => {
  if (isHistoricalSeason) {
    throw new Error('Cannot restore members in a closed or historical season.');
  }

  await updateMemberInSeason(seasonId, memberId, { isArchived: false, isRemoved: false }, isHistoricalSeason);
};
