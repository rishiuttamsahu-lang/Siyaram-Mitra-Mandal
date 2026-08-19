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
  id: string; // e.g. "SEPT", "OCT", "2026-09"
  seasonId: string;
  monthKey: string; // e.g. "SEPT", "OCT", "NOV", etc.
  monthName: string; // e.g. "September", "October"
  monthOrder: number; // 1 to 12
  dueAmount: number; // Fixed monthly target (e.g. 100, 150, 200)
  status: 'open' | 'closed' | 'locked';
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
  monthKey: string; // Specific month or "ALL" for full season override
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
    | 'CREATE_OVERRIDE'
    | 'EDIT_OVERRIDE'
    | 'REMOVE_OVERRIDE'
    | 'MANUAL_ADJUSTMENT';
  seasonId: string;
  seasonName?: string;
  monthKey?: string;
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
