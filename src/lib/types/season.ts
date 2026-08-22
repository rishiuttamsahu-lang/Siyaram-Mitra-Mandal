export type SeasonStatus = 'draft' | 'upcoming' | 'active' | 'closing' | 'closed' | 'archived';

export interface ChandaSeason {
  id: string;
  name: string; // e.g. "2026–27"
  displayName: string; // e.g. "Ganpati Chanda Season 2026–27"
  description?: string;
  startDate: string; // ISO date e.g. "2026-04-01" or "2026-09-01"
  endDate: string; // ISO date e.g. "2027-03-31" or "2027-08-31"
  status: SeasonStatus;
  carryForwardEnabled?: boolean;
  overpaymentCarryForwardEnabled?: boolean;
  receiptPrefix?: string; // e.g. "SMM-2026"
  receiptNextNum?: number;
  totalMembersCount?: number;
  expectedCollection?: number;
  actualCollection?: number;
  outstandingAmount?: number;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
}

export interface MonthlyDue {
  id: string; // e.g. "2026-09" or "SEPT"
  seasonId: string;
  periodKey?: string; // Canonical period key e.g. "2026-09"
  monthKey?: string; // Legacy month key e.g. "SEPT", "OCT", etc.
  monthName: string; // e.g. "September", "October"
  year?: number; // e.g. 2026
  monthOrder: number; // 1, 2, ... 12, 13+
  dueAmount: number; // Fixed monthly target (e.g. 100, 150, 200, 250)
  status?: 'open' | 'closed' | 'locked';
  locked?: boolean;
  lockReason?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface MemberOverride {
  id: string;
  seasonId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  buildingId?: string;
  wingId?: string;
  flatId?: string;
  flatDisplay?: string;
  periodKey?: string; // Canonical period key e.g. "2026-09"
  monthKey?: string; // Specific month or "ALL" for full season override
  defaultAmount: number;
  overrideAmount: number;
  reason: string;
  createdAt?: any;
  createdBy?: string;
}

export interface SeasonAuditLog {
  id: string;
  adminUid?: string;
  adminName?: string;
  action:
    | 'CREATE_SEASON'
    | 'EDIT_SEASON'
    | 'PUBLISH_SEASON'
    | 'ACTIVATE_SEASON'
    | 'CLOSE_SEASON'
    | 'ARCHIVE_SEASON'
    | 'EDIT_MONTH_AMOUNT'
    | 'LOCK_MONTH'
    | 'UNLOCK_MONTH'
    | 'BULK_LOCK_MONTHS'
    | 'BULK_UNLOCK_MONTHS'
    | 'GLOBAL_BLOCK_MONTHS'
    | 'GLOBAL_UNBLOCK_MONTHS'
    | 'CREATE_OVERRIDE'
    | 'EDIT_OVERRIDE'
    | 'REMOVE_OVERRIDE'
    | 'MANUAL_ADJUSTMENT';
  seasonId: string;
  seasonName?: string;
  monthKey?: string;
  periodKey?: string;
  periodKeys?: string[];
  before?: any;
  after?: any;
  reason?: string;
  createdAt?: any;
}

export interface SeasonMetrics {
  totalMembers: number;
  expectedCollection: number;
  actualCollection: number;
  outstandingAmount: number;
  collectionRate: number;
  monthsConfigured: number;
  paidMembersCount: number;
  pendingMembersCount: number;
}

