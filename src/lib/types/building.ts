export interface Building {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: 'active' | 'archived';
  sortOrder?: number;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
}

export interface Wing {
  id: string;
  buildingId: string;
  name: string;
  code: string;
  status: 'active' | 'archived';
  sortOrder?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface Flat {
  id: string;
  buildingId: string;
  wingId: string;
  wingCode?: string;
  flatNumber: string;
  displayNumber: string;
  floor?: number | string;
  residentName?: string;
  residentUserId?: string | null;
  residentPhone?: string | null;
  residentEmail?: string | null;
  status: 'active' | 'archived';
  paymentStatus?: 'Paid' | 'Partially Paid' | 'Due' | 'No Record';
  expectedChanda?: number;
  paidChanda?: number;
  notes?: string;
  legacyId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface BuildingMetrics {
  totalBuildings: number;
  totalWings: number;
  totalFlats: number;
  totalCollected: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
}
