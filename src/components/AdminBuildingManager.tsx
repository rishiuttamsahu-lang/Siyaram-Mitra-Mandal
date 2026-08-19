"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Plus, Edit3, Trash2, Layers, Home, Users, IndianRupee,
  CheckCircle2, AlertCircle, RefreshCw, ChevronRight, X, ArrowRight,
  ShieldAlert, Sparkles, FolderPlus, Grid, Filter, Search, Download
} from 'lucide-react';
import { Building, Wing, Flat } from '@/lib/types/building';
import {
  subscribeBuildings,
  subscribeWings,
  subscribeFlats,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  createWing,
  updateWing,
  deleteWing,
  createOrUpdateFlat,
  deleteFlat,
  bulkGenerateFlats,
  migrateLegacyBuildingChanda,
  MigrationSummary
} from '@/lib/buildingService';

interface AdminBuildingManagerProps {
  onShowToast: (msg: { text: string; type: 'success' | 'error' }) => void;
  askConfirm: (message: string, onConfirm: () => void) => void;
}

export default function AdminBuildingManager({ onShowToast, askConfirm }: AdminBuildingManagerProps) {
  // State
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [wings, setWings] = useState<Wing[]>([]);
  const [selectedWingId, setSelectedWingId] = useState<string | null>(null);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Paid' | 'Due' | 'No Record'>('all');

  // Modals
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [bName, setBName] = useState('');
  const [bCode, setBCode] = useState('');
  const [bDesc, setBDesc] = useState('');

  const [showWingModal, setShowWingModal] = useState(false);
  const [editingWing, setEditingWing] = useState<Wing | null>(null);
  const [wName, setWName] = useState('');
  const [wCode, setWCode] = useState('');

  const [showFlatModal, setShowFlatModal] = useState(false);
  const [editingFlat, setEditingFlat] = useState<Flat | null>(null);
  const [fNumber, setFNumber] = useState('');
  const [fFloor, setFFloor] = useState<number | string>('');
  const [fResident, setFResident] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fExpected, setFExpected] = useState('500');
  const [fPaid, setFPaid] = useState('0');
  const [fStatus, setFStatus] = useState<'Paid' | 'Partially Paid' | 'Due' | 'No Record'>('No Record');
  const [fNotes, setFNotes] = useState('');

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRanges, setBulkRanges] = useState<Array<{ start: number; end: number; prefix?: string }>>([
    { start: 101, end: 116 }
  ]);
  const [bulkExpected, setBulkExpected] = useState('500');
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  // Migration state
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationSummary | null>(null);

  // ─── Realtime Subscriptions ──────────────────────────────
  useEffect(() => {
    const unsub = subscribeBuildings((bList) => {
      setBuildings(bList);
      if (bList.length > 0 && !selectedBuildingId) {
        setSelectedBuildingId(bList[0].id);
      }
    });
    return () => unsub();
  }, [selectedBuildingId]);

  useEffect(() => {
    if (!selectedBuildingId) {
      setWings([]);
      setSelectedWingId(null);
      return;
    }
    const unsub = subscribeWings(selectedBuildingId, (wList) => {
      setWings(wList);
      if (wList.length > 0 && (!selectedWingId || !wList.some(w => w.id === selectedWingId))) {
        setSelectedWingId(wList[0].id);
      } else if (wList.length === 0) {
        setSelectedWingId(null);
      }
    });
    return () => unsub();
  }, [selectedBuildingId, selectedWingId]);

  useEffect(() => {
    if (!selectedBuildingId || !selectedWingId) {
      setFlats([]);
      return;
    }
    const unsub = subscribeFlats(selectedBuildingId, selectedWingId, (fList) => {
      setFlats(fList);
    });
    return () => unsub();
  }, [selectedBuildingId, selectedWingId]);

  // Active records
  const currentBuilding = buildings.find(b => b.id === selectedBuildingId);
  const currentWing = wings.find(w => w.id === selectedWingId);

  // Filtered flats
  const filteredFlats = useMemo(() => {
    return flats.filter(f => {
      const matchQuery = !searchQuery ||
        f.flatNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.residentName && f.residentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        f.displayNumber.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'all' || f.paymentStatus === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [flats, searchQuery, statusFilter]);

  // Group flats by floor
  const flatsByFloor = useMemo(() => {
    const map: Record<string, Flat[]> = {};
    filteredFlats.forEach(flat => {
      const floorKey = flat.floor !== undefined && flat.floor !== '' ? String(flat.floor) : '0';
      if (!map[floorKey]) map[floorKey] = [];
      map[floorKey].push(flat);
    });
    // Sort floors descending (top floor first)
    const sortedKeys = Object.keys(map).sort((a, b) => Number(b) - Number(a));
    return sortedKeys.map(k => ({ floor: k, items: map[k] }));
  }, [filteredFlats]);

  // Metrics
  const stats = useMemo(() => {
    let totalCollected = 0;
    let totalExpected = 0;
    let paidCount = 0;
    let pendingCount = 0;

    flats.forEach(f => {
      const paid = Number(f.paidChanda) || 0;
      const expected = Number(f.expectedChanda) || 0;
      totalCollected += paid;
      totalExpected += expected;
      if (f.paymentStatus === 'Paid' || paid >= expected && expected > 0) {
        paidCount++;
      } else {
        pendingCount++;
      }
    });

    return {
      totalFlats: flats.length,
      totalCollected,
      totalExpected,
      totalPending: Math.max(0, totalExpected - totalCollected),
      paidCount,
      pendingCount
    };
  }, [flats]);

  // ─── Handlers ─────────────────────────────────────────────
  const handleOpenBuildingModal = (b?: Building) => {
    if (b) {
      setEditingBuilding(b);
      setBName(b.name);
      setBCode(b.code);
      setBDesc(b.description || '');
    } else {
      setEditingBuilding(null);
      setBName('');
      setBCode('');
      setBDesc('');
    }
    setShowBuildingModal(true);
  };

  const handleSaveBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName.trim() || !bCode.trim()) {
      onShowToast({ text: 'Name and Code are required', type: 'error' });
      return;
    }
    try {
      if (editingBuilding) {
        await updateBuilding(editingBuilding.id, {
          name: bName.trim(),
          code: bCode.trim().toUpperCase(),
          description: bDesc.trim()
        });
        onShowToast({ text: 'Building updated successfully', type: 'success' });
      } else {
        const newId = await createBuilding({
          name: bName.trim(),
          code: bCode.trim().toUpperCase(),
          description: bDesc.trim(),
          status: 'active'
        });
        setSelectedBuildingId(newId);
        onShowToast({ text: 'Building created successfully', type: 'success' });
      }
      setShowBuildingModal(false);
    } catch (err: any) {
      onShowToast({ text: err.message || 'Failed to save building', type: 'error' });
    }
  };

  const handleDeleteBuilding = (b: Building) => {
    askConfirm(`Delete "${b.name}" and all associated wings and flats?`, async () => {
      try {
        await deleteBuilding(b.id);
        onShowToast({ text: 'Building deleted', type: 'success' });
        setSelectedBuildingId(null);
      } catch (err: any) {
        onShowToast({ text: err.message || 'Failed to delete building', type: 'error' });
      }
    });
  };

  const handleOpenWingModal = (w?: Wing) => {
    if (w) {
      setEditingWing(w);
      setWName(w.name);
      setWCode(w.code);
    } else {
      setEditingWing(null);
      setWName('');
      setWCode('');
    }
    setShowWingModal(true);
  };

  const handleSaveWing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuildingId) return;
    if (!wName.trim() || !wCode.trim()) {
      onShowToast({ text: 'Wing Name and Code required', type: 'error' });
      return;
    }
    try {
      if (editingWing) {
        await updateWing(selectedBuildingId, editingWing.id, {
          name: wName.trim(),
          code: wCode.trim().toUpperCase()
        });
        onShowToast({ text: 'Wing updated', type: 'success' });
      } else {
        const wingId = await createWing(selectedBuildingId, {
          name: wName.trim(),
          code: wCode.trim().toUpperCase(),
          status: 'active'
        });
        setSelectedWingId(wingId);
        onShowToast({ text: 'Wing created', type: 'success' });
      }
      setShowWingModal(false);
    } catch (err: any) {
      onShowToast({ text: err.message || 'Failed to save wing', type: 'error' });
    }
  };

  const handleDeleteWing = (w: Wing) => {
    if (!selectedBuildingId) return;
    askConfirm(`Delete "${w.name}" and all flats inside it?`, async () => {
      try {
        await deleteWing(selectedBuildingId, w.id);
        onShowToast({ text: 'Wing deleted', type: 'success' });
      } catch (err: any) {
        onShowToast({ text: err.message || 'Failed to delete wing', type: 'error' });
      }
    });
  };

  const handleOpenFlatModal = (flat?: Flat) => {
    if (flat) {
      setEditingFlat(flat);
      setFNumber(flat.flatNumber);
      setFFloor(flat.floor !== undefined ? flat.floor : '');
      setFResident(flat.residentName || '');
      setFPhone(flat.residentPhone || '');
      setFExpected(String(flat.expectedChanda || 500));
      setFPaid(String(flat.paidChanda || 0));
      setFStatus(flat.paymentStatus || 'No Record');
      setFNotes(flat.notes || '');
    } else {
      setEditingFlat(null);
      setFNumber('');
      setFFloor('');
      setFResident('');
      setFPhone('');
      setFExpected('500');
      setFPaid('0');
      setFStatus('No Record');
      setFNotes('');
    }
    setShowFlatModal(true);
  };

  const handleSaveFlat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuildingId || !selectedWingId || !currentWing) return;
    if (!fNumber.trim()) {
      onShowToast({ text: 'Flat number is required', type: 'error' });
      return;
    }
    try {
      const paidNum = Number(fPaid) || 0;
      const expectedNum = Number(fExpected) || 0;

      let derivedStatus = fStatus;
      if (paidNum >= expectedNum && expectedNum > 0) {
        derivedStatus = 'Paid';
      } else if (paidNum > 0) {
        derivedStatus = 'Partially Paid';
      } else if (derivedStatus === 'Paid') {
        derivedStatus = 'Due';
      }

      await createOrUpdateFlat(selectedBuildingId, selectedWingId, {
        ...(editingFlat ? { id: editingFlat.id } : {}),
        flatNumber: fNumber.trim(),
        displayNumber: `${currentWing.code}-${fNumber.trim()}`,
        floor: fFloor !== '' ? Number(fFloor) : undefined,
        residentName: fResident.trim(),
        residentPhone: fPhone.trim() || null,
        expectedChanda: expectedNum,
        paidChanda: paidNum,
        paymentStatus: derivedStatus,
        notes: fNotes.trim()
      });
      onShowToast({ text: editingFlat ? 'Flat updated' : 'Flat created', type: 'success' });
      setShowFlatModal(false);
    } catch (err: any) {
      onShowToast({ text: err.message || 'Failed to save flat', type: 'error' });
    }
  };

  const handleDeleteFlat = (flat: Flat) => {
    if (!selectedBuildingId || !selectedWingId) return;
    askConfirm(`Delete flat ${flat.displayNumber}?`, async () => {
      try {
        await deleteFlat(selectedBuildingId, selectedWingId, flat.id);
        onShowToast({ text: 'Flat deleted', type: 'success' });
      } catch (err: any) {
        onShowToast({ text: err.message || 'Failed to delete flat', type: 'error' });
      }
    });
  };

  const handleBulkGenerate = async () => {
    if (!selectedBuildingId || !selectedWingId || !currentWing) return;
    setIsBulkGenerating(true);
    try {
      const count = await bulkGenerateFlats(
        selectedBuildingId,
        selectedWingId,
        currentWing.code,
        bulkRanges,
        Number(bulkExpected) || 500
      );
      onShowToast({ text: `Successfully generated ${count} flats!`, type: 'success' });
      setShowBulkModal(false);
    } catch (err: any) {
      onShowToast({ text: err.message || 'Bulk generation failed', type: 'error' });
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const handleRunMigration = async () => {
    askConfirm('Migrate legacy "building_chanda" into this new hierarchy? Existing payments and names will be preserved.', async () => {
      setIsMigrating(true);
      try {
        const targetId = selectedBuildingId || 'siyaram_main';
        const res = await migrateLegacyBuildingChanda(targetId);
        setMigrationResult(res);
        onShowToast({ text: `Migration complete! Migrated ${res.migratedCount} flats.`, type: 'success' });
      } catch (err: any) {
        onShowToast({ text: err.message || 'Migration failed', type: 'error' });
      } finally {
        setIsMigrating(false);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ─── Top Control Bar & Stats ──────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#5a0000] shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-gray-900 uppercase tracking-tight">
                Buildings & Wings
              </h2>
              <p className="text-[10px] sm:text-xs font-semibold text-gray-500">
                Buildings, dynamic wings, room matrix, and chanda ledgers
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleOpenBuildingModal()}
              className="px-3 py-1.5 rounded-lg bg-[#5a0000] text-white font-black text-[10px] sm:text-xs uppercase tracking-wider hover:bg-[#7a0000] transition-colors flex items-center gap-1 shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" /> Add Building
            </button>

            <button
              onClick={handleRunMigration}
              disabled={isMigrating}
              className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-[#5a0000] font-black text-[10px] sm:text-xs uppercase tracking-wider hover:bg-amber-200 transition-colors flex items-center gap-1 active:scale-95 disabled:opacity-50"
              title="Import legacy building_chanda documents"
            >
              <RefreshCw className={`w-3 h-3 ${isMigrating ? 'animate-spin' : ''}`} />
              {isMigrating ? 'Migrating...' : 'Migrate'}
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5 sm:p-3">
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Total Flats</span>
            <div className="flex items-center justify-between">
              <span className="text-sm sm:text-base font-black text-gray-900">{stats.totalFlats}</span>
              <Home className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </div>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2.5 sm:p-3">
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 block mb-0.5">Collected Chanda</span>
            <div className="flex items-center justify-between">
              <span className="text-sm sm:text-base font-black text-emerald-700">₹{stats.totalCollected.toLocaleString('en-IN')}</span>
              <IndianRupee className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            </div>
          </div>

          <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-2.5 sm:p-3">
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 block mb-0.5">Pending Amount</span>
            <div className="flex items-center justify-between">
              <span className="text-sm sm:text-base font-black text-amber-700">₹{stats.totalPending.toLocaleString('en-IN')}</span>
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            </div>
          </div>

          <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-2.5 sm:p-3">
            <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 block mb-0.5">Paid / Pending</span>
            <div className="flex items-center justify-between">
              <span className="text-sm sm:text-base font-black text-blue-800">{stats.paidCount} / {stats.pendingCount}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Building Selector & Wing Navigation ────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm space-y-3">
        {/* Building List Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#5a0000]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-800">
              Select Building
            </h3>
          </div>
          {currentBuilding && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleOpenBuildingModal(currentBuilding)}
                className="p-1 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100"
                title="Edit Building Details"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleDeleteBuilding(currentBuilding)}
                className="p-1 text-red-500 hover:text-red-700 rounded-md hover:bg-red-50"
                title="Delete Building"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Building Chips */}
        {buildings.length === 0 ? (
          <div className="py-6 text-center border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-xs font-bold text-gray-400 uppercase">No buildings added yet</p>
            <button
              onClick={() => handleOpenBuildingModal()}
              className="mt-2 px-3 py-1.5 bg-[#5a0000] text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-[#7a0000]"
            >
              Add First Building
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {buildings.map((b) => {
              const isSelected = b.id === selectedBuildingId;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBuildingId(b.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#5a0000] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Building2 className="w-3 h-3" />
                  <span>{b.name} ({b.code})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Wings inside selected building */}
        {selectedBuildingId && (
          <div className="border-t border-gray-100 pt-2.5 mt-1">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Wings:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenWingModal()}
                  className="px-2 py-1 rounded-md bg-gray-100 text-gray-800 font-bold text-[10px] uppercase tracking-wider hover:bg-gray-200 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Wing
                </button>
                {currentWing && (
                  <>
                    <button
                      onClick={() => handleOpenWingModal(currentWing)}
                      className="p-1 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100"
                      title="Edit Wing"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteWing(currentWing)}
                      className="p-1 text-red-500 hover:text-red-700 rounded-md hover:bg-red-50"
                      title="Delete Wing"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {wings.length === 0 ? (
              <div className="py-4 text-center border border-dashed border-gray-200 rounded-lg">
                <p className="text-xs font-bold text-gray-400">No wings configured.</p>
                <button
                  onClick={() => handleOpenWingModal()}
                  className="mt-1 px-2.5 py-1 bg-[#5a0000] text-white rounded-md text-[9px] font-black uppercase tracking-wider"
                >
                  Add Wing (e.g. A Wing)
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                {wings.map((w) => {
                  const isSelected = w.id === selectedWingId;
                  return (
                    <button
                      key={w.id}
                      onClick={() => setSelectedWingId(w.id)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all shrink-0 ${
                        isSelected
                          ? 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-500/30'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {w.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Flats Matrix & Management ──────────────────────── */}
      {selectedBuildingId && selectedWingId && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm space-y-3">
          {/* Flats Header & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-[#5a0000]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-800">
                Flats in {currentWing?.name} ({filteredFlats.length})
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Search */}
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search flat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 pr-2.5 py-1 rounded-lg border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:border-[#5a0000] focus:bg-white w-28 sm:w-36"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2 py-1 rounded-lg border border-gray-200 text-[10px] sm:text-xs font-bold bg-gray-50 outline-none text-gray-700"
              >
                <option value="all">All</option>
                <option value="Paid">Paid</option>
                <option value="Due">Due</option>
                <option value="No Record">No Record</option>
              </select>

              {/* Flat Actions */}
              <button
                onClick={() => handleOpenFlatModal()}
                className="px-2.5 py-1 rounded-lg bg-[#5a0000] text-white font-bold text-[10px] sm:text-xs uppercase tracking-wider hover:bg-[#7a0000] flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Flat
              </button>

              <button
                onClick={() => setShowBulkModal(true)}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-bold text-[10px] sm:text-xs uppercase tracking-wider hover:bg-amber-600 flex items-center gap-1 shadow-sm"
              >
                <FolderPlus className="w-3 h-3" /> Bulk
              </button>
            </div>
          </div>

          {/* Flats Grid Grouped By Floors */}
          {flats.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
              <Home className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-gray-500 uppercase">No flats in this wing yet</p>
              <div className="flex justify-center gap-2 mt-2">
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-amber-600 shadow-sm"
                >
                  Bulk Generate
                </button>
                <button
                  onClick={() => handleOpenFlatModal()}
                  className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-200"
                >
                  Add Flat
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {flatsByFloor.map(({ floor, items }) => (
                <div key={floor} className="bg-gray-50/70 border border-gray-100 rounded-xl p-2 sm:p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="px-1.5 py-0.2 rounded bg-[#5a0000] text-white text-[8px] sm:text-[9px] font-black uppercase tracking-wider">
                      {floor === '0' ? 'Ground Floor' : `Floor ${floor}`}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400">{items.length} Flats</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5 sm:gap-2">
                    {items.map((flat) => {
                      const isPaid = flat.paymentStatus === 'Paid' || (Number(flat.paidChanda) > 0 && Number(flat.paidChanda) >= Number(flat.expectedChanda));
                      const isPartial = flat.paymentStatus === 'Partially Paid' || (!isPaid && Number(flat.paidChanda) > 0);

                      let badgeColor = 'bg-gray-200 text-gray-700';
                      if (isPaid) badgeColor = 'bg-green-100 text-green-800 border-green-300';
                      else if (isPartial) badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
                      else if (flat.paymentStatus === 'Due') badgeColor = 'bg-red-100 text-red-700 border-red-200';

                      return (
                        <div
                          key={flat.id}
                          className="bg-white border border-gray-200 rounded-lg p-2 flex flex-col justify-between hover:border-amber-400 hover:shadow-sm transition-all group relative"
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-black text-gray-900">{flat.flatNumber}</span>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                              <button
                                onClick={() => handleOpenFlatModal(flat)}
                                className="p-0.5 text-gray-400 hover:text-gray-700"
                                title="Edit"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteFlat(flat)}
                                className="p-0.5 text-red-400 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-[9px] font-semibold text-gray-600 truncate my-0.5">
                            {flat.residentName || '—'}
                          </p>

                          <div className="flex items-center justify-between text-[8px] font-bold mt-0.5">
                            <span className={`px-1 py-0.2 rounded border ${badgeColor}`}>
                              {isPaid ? `₹${flat.paidChanda}` : isPartial ? `₹${flat.paidChanda} P` : 'Due'}
                            </span>
                            <span className="text-gray-400">/ ₹{flat.expectedChanda || 500}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: ADD / EDIT BUILDING ──────────────────────── */}
      {showBuildingModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                {editingBuilding ? 'Edit Building' : 'Add New Building'}
              </h3>
              <button onClick={() => setShowBuildingModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBuilding} className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Building Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Siyaram Heights"
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Building Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SMM"
                  value={bCode}
                  onChange={(e) => setBCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Premises details..."
                  value={bDesc}
                  onChange={(e) => setBDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBuildingModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-[#5a0000] text-white hover:bg-[#7a0000] shadow-sm"
                >
                  Save Building
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD / EDIT WING ──────────────────────────── */}
      {showWingModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                {editingWing ? 'Edit Wing' : 'Add Wing'}
              </h3>
              <button onClick={() => setShowWingModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWing} className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Wing Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A Wing"
                  value={wName}
                  onChange={(e) => setWName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Wing Code (e.g. A, B, C) *</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  placeholder="A"
                  value={wCode}
                  onChange={(e) => setWCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWingModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-[#5a0000] text-white hover:bg-[#7a0000] shadow-sm"
                >
                  Save Wing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD / EDIT SINGLE FLAT ───────────────────── */}
      {showFlatModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                {editingFlat ? `Edit Flat ${editingFlat.displayNumber}` : 'Add Flat'}
              </h3>
              <button onClick={() => setShowFlatModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFlat} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Flat Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="101"
                    value={fNumber}
                    onChange={(e) => setFNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Floor (0 = Ground)</label>
                  <input
                    type="number"
                    placeholder="1"
                    value={fFloor}
                    onChange={(e) => setFFloor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Resident Name</label>
                <input
                  type="text"
                  placeholder="Rishi Sahu"
                  value={fResident}
                  onChange={(e) => setFResident(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={fPhone}
                  onChange={(e) => setFPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Expected Chanda (₹)</label>
                  <input
                    type="number"
                    value={fExpected}
                    onChange={(e) => setFExpected(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Paid Chanda (₹)</label>
                  <input
                    type="number"
                    value={fPaid}
                    onChange={(e) => setFPaid(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Payment Status</label>
                <select
                  value={fStatus}
                  onChange={(e) => setFStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none text-gray-800"
                >
                  <option value="No Record">No Record</option>
                  <option value="Due">Due / Pending</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Optional notes..."
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFlatModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-[#5a0000] text-white hover:bg-[#7a0000] shadow-sm"
                >
                  Save Flat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: BULK FLAT GENERATOR ──────────────────────── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                  Bulk Flat Generator
                </h3>
                <p className="text-[10px] font-bold text-gray-400">
                  Generate flats for {currentWing?.name}
                </p>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-600">
                Configure room number ranges. For example: <span className="font-bold text-[#5a0000]">101–116</span> for 16 flats, or add another range <span className="font-bold text-[#5a0000]">201–216</span> for B-wing floors.
              </p>

              {bulkRanges.map((range, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-200">
                  <div className="flex-1">
                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Start Room</label>
                    <input
                      type="number"
                      value={range.start}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        const copy = [...bulkRanges];
                        copy[idx].start = val;
                        setBulkRanges(copy);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold bg-white outline-none"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">End Room</label>
                    <input
                      type="number"
                      value={range.end}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        const copy = [...bulkRanges];
                        copy[idx].end = val;
                        setBulkRanges(copy);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold bg-white outline-none"
                    />
                  </div>

                  <div className="pt-4">
                    {bulkRanges.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBulkRanges(bulkRanges.filter((_, i) => i !== idx))}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setBulkRanges([...bulkRanges, { start: 201, end: 216 }])}
                className="text-xs font-black uppercase tracking-wider text-[#5a0000] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Another Number Range
              </button>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Default Expected Chanda (₹)</label>
                <input
                  type="number"
                  value={bulkExpected}
                  onChange={(e) => setBulkExpected(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkGenerate}
                  disabled={isBulkGenerating}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-amber-500 text-white hover:bg-amber-600 shadow-sm disabled:opacity-50"
                >
                  {isBulkGenerating ? 'Generating...' : 'Generate Flats'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
