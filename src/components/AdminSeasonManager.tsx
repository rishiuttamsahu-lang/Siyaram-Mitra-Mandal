"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Plus, Edit3, Trash2, CheckCircle2, AlertCircle, RefreshCw,
  Copy, Lock, Unlock, ShieldAlert, Sparkles, FolderPlus, ArrowRight,
  X, Check, IndianRupee, Layers, FileText, BarChart2, ChevronRight, UserPlus,
  Coins, Settings, Clock, ArrowUpRight, ShieldCheck, UserCheck, Eye
} from 'lucide-react';
import { ChandaSeason, MonthlyDue, MemberOverride, SeasonStatus } from '@/lib/types/season';
import {
  subscribeSeasons,
  subscribeMonthlyDues,
  subscribeMemberOverrides,
  createSeason,
  updateSeason,
  activateSeason,
  closeSeason,
  archiveSeason,
  cloneSeason,
  updateMonthlyDue,
  bulkUpdateMonthlyDues,
  toggleMonthLock,
  setMemberOverride,
  deleteMemberOverride,
  seedInitialSeasons,
  deleteSeason,
  cleanupDuplicateSeasons,
  MANDAL_MONTHS
} from '@/lib/seasonService';

interface AdminSeasonManagerProps {
  currentUserData?: any;
  onShowToast: (msg: { text: string; type: 'success' | 'error' }) => void;
  askConfirm: (message: string, onConfirm: () => void) => void;
  // Finance integration props
  pendingChandaPayments?: any[];
  onApproveChanda?: (id: string) => void;
  onRejectChanda?: (id: string) => void;
  mandalMembers?: any[];
  onAddMember?: (e: React.FormEvent<any>) => void;
  newMemberName?: string;
  setNewMemberName?: (val: string) => void;
  isNewMemberHonorary?: boolean;
  setIsNewMemberHonorary?: (val: boolean) => void;
  onRemoveMember?: (id: number, name: string) => void;
  onRestoreMember?: (id: number, name: string) => void;
  onToggleMemberExemptMonth?: (member: any, month: any) => void;
}

export default function AdminSeasonManager({
  currentUserData,
  onShowToast,
  askConfirm,
  pendingChandaPayments = [],
  onApproveChanda,
  onRejectChanda,
  mandalMembers = [],
  onAddMember,
  newMemberName = '',
  setNewMemberName,
  isNewMemberHonorary = false,
  setIsNewMemberHonorary,
  onRemoveMember,
  onRestoreMember,
  onToggleMemberExemptMonth
}: AdminSeasonManagerProps) {
  // State
  const [seasons, setSeasons] = useState<ChandaSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [dues, setDues] = useState<MonthlyDue[]>([]);
  const [overrides, setOverrides] = useState<MemberOverride[]>([]);
  const [activeSubView, setActiveSubView] = useState<'schedule' | 'overrides' | 'approvals' | 'members'>('schedule');
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonDisplayName, setNewSeasonDisplayName] = useState('');
  const [newStartDate, setNewStartDate] = useState('2026-09-01');
  const [newEndDate, setNewEndDate] = useState('2027-08-31');
  const [newDesc, setNewDesc] = useState('');
  const [copyPrevious, setCopyPrevious] = useState(true);
  const [sourceSeasonId, setSourceSeasonId] = useState<string>('');

  // Edit Season Details Modal
  const [showEditSeasonModal, setShowEditSeasonModal] = useState(false);
  const [editSeasonName, setEditSeasonName] = useState('');
  const [editSeasonDisplayName, setEditSeasonDisplayName] = useState('');
  const [editSeasonStatus, setEditSeasonStatus] = useState<SeasonStatus>('active');
  const [editSeasonPrefix, setEditSeasonPrefix] = useState('');
  const [isUpdatingSeason, setIsUpdatingSeason] = useState(false);

  // Edit Month Modal
  const [showEditMonthModal, setShowEditMonthModal] = useState(false);
  const [editingMonth, setEditingMonth] = useState<MonthlyDue | null>(null);
  const [editAmount, setEditAmount] = useState('100');
  const [editReason, setEditReason] = useState('');
  const [isUpdatingMonth, setIsUpdatingMonth] = useState(false);

  // Bulk Edit Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAmount, setBulkAmount] = useState('100');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Add Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideUser, setOverrideUser] = useState('');
  const [overrideFlat, setOverrideFlat] = useState('');
  const [overrideMonth, setOverrideMonth] = useState('ALL');
  const [overrideAmount, setOverrideAmount] = useState('100');
  const [overrideReason, setOverrideReason] = useState('');
  const [isSavingOverride, setIsSavingOverride] = useState(false);

  // Auto-seed / self-heal initial seasons & cleanup duplicates
  useEffect(() => {
    seedInitialSeasons().then(() => {
      cleanupDuplicateSeasons();
    });
  }, []);

  // Deduplicate seasons by normalized name in UI
  const displaySeasons = useMemo(() => {
    const seen = new Map<string, ChandaSeason>();
    seasons.forEach(s => {
      const norm = (s.name || '').trim().replace(/[-–]/g, '-');
      if (!seen.has(norm) || (s.status === 'active' && seen.get(norm)?.status !== 'active')) {
        seen.set(norm, s);
      }
    });
    return Array.from(seen.values());
  }, [seasons]);

  // Subscribe to Seasons
  useEffect(() => {
    const unsub = subscribeSeasons((sList) => {
      setSeasons(sList);
      if (sList.length > 0) {
        if (!selectedSeasonId) {
          // Prefer active season (2025-26) or first
          const active = sList.find(s => s.status === 'active') || sList[0];
          setSelectedSeasonId(active.id);
          setSourceSeasonId(active.id);
        }
      }
    });
    return () => unsub();
  }, [selectedSeasonId]);

  // Subscribe to Monthly Dues for selected season
  useEffect(() => {
    if (!selectedSeasonId) {
      setDues([]);
      return;
    }
    const unsub = subscribeMonthlyDues(selectedSeasonId, (dList) => {
      setDues(dList);
    });
    return () => unsub();
  }, [selectedSeasonId]);

  // Subscribe to Member Overrides for selected season
  useEffect(() => {
    if (!selectedSeasonId) {
      setOverrides([]);
      return;
    }
    const unsub = subscribeMemberOverrides(selectedSeasonId, (oList) => {
      setOverrides(oList);
    });
    return () => unsub();
  }, [selectedSeasonId]);

  const selectedSeason = seasons.find(s => s.id === selectedSeasonId);
  const activeSeason = seasons.find(s => s.status === 'active');

  // Stats calculation
  const stats = useMemo(() => {
    const totalMonths = dues.length;
    const totalTargetSum = dues.reduce((acc, m) => acc + (Number(m.dueAmount) || 0), 0);
    return {
      totalMonths,
      totalTargetSum,
      overridesCount: overrides.length,
      pendingCount: pendingChandaPayments.length,
      membersCount: mandalMembers.filter(m => !m.isRemoved).length
    };
  }, [dues, overrides, pendingChandaPayments, mandalMembers]);

  // ─── Actions ──────────────────────────────────────────────

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonName.trim()) {
      onShowToast({ text: 'Season name is required', type: 'error' });
      return;
    }
    setIsCreating(true);
    try {
      const payload = {
        name: newSeasonName.trim(),
        displayName: newSeasonDisplayName.trim() || `Ganpati Chanda Season ${newSeasonName.trim()}`,
        startDate: newStartDate,
        endDate: newEndDate,
        description: newDesc.trim(),
        status: 'draft' as SeasonStatus,
        receiptPrefix: `SMM-${newSeasonName.split('–')[0].trim() || '2026'}`
      };

      let newId: string;
      if (copyPrevious && sourceSeasonId) {
        newId = await cloneSeason(
          sourceSeasonId,
          payload,
          { copyOverrides: true },
          currentUserData?.uid
        );
      } else {
        newId = await createSeason(payload, undefined, currentUserData?.uid);
      }

      setSelectedSeasonId(newId);
      setShowCreateModal(false);
      onShowToast({ text: `Season ${newSeasonName} created as Draft!`, type: 'success' });
    } catch (err: any) {
      onShowToast({ text: err.message || 'Failed to create season', type: 'error' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEditSeason = (s: ChandaSeason) => {
    setEditSeasonName(s.name);
    setEditSeasonDisplayName(s.displayName || '');
    setEditSeasonStatus(s.status);
    setEditSeasonPrefix(s.receiptPrefix || '');
    setShowEditSeasonModal(true);
  };

  const handleSaveSeasonDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeasonId) return;
    setIsUpdatingSeason(true);
    try {
      if (editSeasonStatus === 'active' && selectedSeason?.status !== 'active') {
        await activateSeason(selectedSeasonId, currentUserData?.uid);
      }
      await updateSeason(
        selectedSeasonId,
        {
          name: editSeasonName.trim(),
          displayName: editSeasonDisplayName.trim(),
          status: editSeasonStatus,
          receiptPrefix: editSeasonPrefix.trim()
        },
        currentUserData?.uid
      );
      onShowToast({ text: 'Season settings updated successfully!', type: 'success' });
      setShowEditSeasonModal(false);
    } catch (err: any) {
      onShowToast({ text: err.message || 'Failed to update season', type: 'error' });
    } finally {
      setIsUpdatingSeason(false);
    }
  };

  const handleActivateSeason = (s: ChandaSeason) => {
    askConfirm(
      `Activate "${s.name}"? This will make it the current live season for all chanda payments.`,
      async () => {
        try {
          await activateSeason(s.id, currentUserData?.uid);
          onShowToast({ text: `Season ${s.name} is now ACTIVE!`, type: 'success' });
        } catch (err: any) {
          onShowToast({ text: err.message || 'Activation failed', type: 'error' });
        }
      }
    );
  };

  const handleCloseSeason = (s: ChandaSeason) => {
    askConfirm(
      `Mark "${s.name}" as closed?`,
      async () => {
        try {
          await closeSeason(s.id, currentUserData?.uid, 'Closed by admin');
          onShowToast({ text: `Season ${s.name} is now CLOSED.`, type: 'success' });
        } catch (err: any) {
          onShowToast({ text: err.message || 'Close failed', type: 'error' });
        }
      }
    );
  };

  const handleDeleteSeason = (s: ChandaSeason) => {
    if (displaySeasons.length <= 1) {
      onShowToast({ text: 'Cannot delete the only remaining season', type: 'error' });
      return;
    }
    askConfirm(
      `Delete season "${s.name}"? All its monthly schedules and overrides will be permanently removed.`,
      async () => {
        try {
          await deleteSeason(s.id, currentUserData?.uid);
          onShowToast({ text: `Season ${s.name} deleted!`, type: 'success' });
          const remaining = displaySeasons.filter(item => item.id !== s.id);
          if (remaining.length > 0) {
            setSelectedSeasonId(remaining[0].id);
          }
        } catch (err: any) {
          onShowToast({ text: err.message || 'Failed to delete season', type: 'error' });
        }
      }
    );
  };

  const handleSaveMonthAmount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeasonId || !editingMonth) return;
    setIsUpdatingMonth(true);
    try {
      await updateMonthlyDue(
        selectedSeasonId,
        editingMonth.monthKey,
        Number(editAmount) || 100,
        currentUserData?.uid,
        editReason.trim()
      );
      onShowToast({ text: `${editingMonth.monthName} target updated to ₹${editAmount}`, type: 'success' });
      setShowEditMonthModal(false);
    } catch (err: any) {
      onShowToast({ text: err.message || 'Failed to update month amount', type: 'error' });
    } finally {
      setIsUpdatingMonth(false);
    }
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeasonId) return;
    setIsBulkUpdating(true);
    try {
      const payload = dues.map(d => ({
        monthKey: d.monthKey,
        dueAmount: Number(bulkAmount) || 100
      }));
      await bulkUpdateMonthlyDues(selectedSeasonId, payload, currentUserData?.uid);
      onShowToast({ text: `All months updated to ₹${bulkAmount}`, type: 'success' });
      setShowBulkModal(false);
    } catch (err: any) {
      onShowToast({ text: err.message || 'Bulk update failed', type: 'error' });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleToggleLock = async (month: MonthlyDue) => {
    if (!selectedSeasonId) return;
    try {
      await toggleMonthLock(
        selectedSeasonId,
        month.monthKey,
        !month.locked,
        currentUserData?.uid,
        month.locked ? 'Unlocked by admin' : 'Locked by admin'
      );
      onShowToast({
        text: `${month.monthName} is now ${month.locked ? 'Unlocked' : 'Locked'}`,
        type: 'success'
      });
    } catch (err: any) {
      onShowToast({ text: err.message || 'Lock toggle failed', type: 'error' });
    }
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeasonId) return;
    if (!overrideUser.trim() && !overrideFlat.trim()) {
      onShowToast({ text: 'Provide Member Name or Flat', type: 'error' });
      return;
    }
    setIsSavingOverride(true);
    try {
      await setMemberOverride(
        selectedSeasonId,
        {
          userName: overrideUser.trim() || undefined,
          flatDisplay: overrideFlat.trim() || undefined,
          monthKey: overrideMonth,
          defaultAmount: 100,
          overrideAmount: Number(overrideAmount) || 0,
          reason: overrideReason.trim() || 'Custom committee arrangement'
        },
        currentUserData?.uid
      );
      onShowToast({ text: 'Member override saved successfully', type: 'success' });
      setShowOverrideModal(false);
      setOverrideUser('');
      setOverrideFlat('');
      setOverrideAmount('100');
      setOverrideReason('');
    } catch (err: any) {
      onShowToast({ text: err.message || 'Failed to save override', type: 'error' });
    } finally {
      setIsSavingOverride(false);
    }
  };

  const handleDeleteOverride = (overrideId: string) => {
    if (!selectedSeasonId) return;
    askConfirm('Remove this override rule?', async () => {
      try {
        await deleteMemberOverride(selectedSeasonId, overrideId, currentUserData?.uid);
        onShowToast({ text: 'Override removed', type: 'success' });
      } catch (err: any) {
        onShowToast({ text: err.message || 'Failed to delete override', type: 'error' });
      }
    });
  };

  return (
    <div className="space-y-3 sm:space-y-5 animate-in fade-in duration-300">
      {/* ─── Top Control Bar ───────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-[#5a0000] shrink-0">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-gray-900 uppercase tracking-tight">
                  Chanda & Finance
                </h2>
                {activeSeason && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-black uppercase tracking-wider">
                    {activeSeason.name}
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs font-semibold text-gray-500">
                Seasons, monthly schedules, overrides & approvals
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setNewSeasonName('2026–27');
                setNewSeasonDisplayName('Ganpati Chanda Season 2026–27');
                setNewStartDate('2026-09-01');
                setNewEndDate('2027-08-31');
                setShowCreateModal(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#5a0000] text-white font-black text-[10px] sm:text-xs uppercase tracking-wider hover:bg-[#7a0000] transition-colors flex items-center gap-1 shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" /> Create Season
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3">
          <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-2.5 sm:p-3">
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 block mb-0.5">Live Season</span>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-black text-amber-900 truncate">
                {activeSeason ? activeSeason.name : 'None'}
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            </div>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2.5 sm:p-3">
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 block mb-0.5">Target / Member</span>
            <div className="flex items-center justify-between">
              <span className="text-sm sm:text-base font-black text-emerald-700">₹{stats.totalTargetSum.toLocaleString('en-IN')}</span>
              <IndianRupee className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            </div>
          </div>

          <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-2.5 sm:p-3">
            <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 block mb-0.5">Active Members</span>
            <div className="flex items-center justify-between">
              <span className="text-sm sm:text-base font-black text-blue-800">{stats.membersCount}</span>
              <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            </div>
          </div>

          <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-2.5 sm:p-3">
            <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 block mb-0.5">Pending Approvals</span>
            <div className="flex items-center justify-between">
              <span className="text-sm sm:text-base font-black text-rose-800">{stats.pendingCount}</span>
              <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Season Selector Tabs & Actions ────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#5a0000]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-800">
              Select Mandal Season
            </h3>
          </div>

          {selectedSeason && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleOpenEditSeason(selectedSeason)}
                className="px-2 py-1 rounded-md bg-gray-100 text-gray-800 font-bold text-[10px] uppercase tracking-wider hover:bg-gray-200 flex items-center gap-1 border border-gray-200"
              >
                <Edit3 className="w-3 h-3" /> Settings
              </button>

              {selectedSeason.status !== 'active' && (
                <button
                  onClick={() => handleActivateSeason(selectedSeason)}
                  className="px-2 py-1 rounded-md bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-emerald-700 flex items-center gap-1 shadow-sm"
                >
                  <Check className="w-3 h-3" /> Set Live
                </button>
              )}

              {displaySeasons.length > 1 && (
                <button
                  onClick={() => handleDeleteSeason(selectedSeason)}
                  className="px-2 py-1 rounded-md bg-rose-50 text-rose-600 font-bold text-[10px] uppercase tracking-wider hover:bg-rose-100 flex items-center gap-1 border border-rose-200"
                  title="Delete this season"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              )}

              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                selectedSeason.status === 'active'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : selectedSeason.status === 'draft'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-gray-100 text-gray-700 border-gray-300'
              }`}>
                {selectedSeason.status}
              </span>
            </div>
          )}
        </div>

        {/* Season Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {displaySeasons.map((s) => {
            const isSelected = s.id === selectedSeasonId;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSeasonId(s.id)}
                className={`px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#5a0000] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{s.name}</span>
                {s.status === 'active' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                )}
                {s.status === 'closed' && (
                  <span className="text-[8px] opacity-70">🔒</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sub-views inside Season & Finance */}
        {selectedSeasonId && (
          <div className="border-t border-gray-100 pt-2.5">
            <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setActiveSubView('schedule')}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                    activeSubView === 'schedule'
                      ? 'bg-[#5a0000] text-white shadow-sm'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  Schedule ({dues.length})
                </button>

                <button
                  onClick={() => setActiveSubView('overrides')}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                    activeSubView === 'overrides'
                      ? 'bg-[#5a0000] text-white shadow-sm'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  Overrides ({overrides.length})
                </button>

                <button
                  onClick={() => setActiveSubView('approvals')}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 ${
                    activeSubView === 'approvals'
                      ? 'bg-[#5a0000] text-white shadow-sm'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <span>Approvals</span>
                  {stats.pendingCount > 0 && (
                    <span className="px-1 py-0.2 bg-rose-500 text-white rounded-full text-[9px] font-bold">
                      {stats.pendingCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveSubView('members')}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                    activeSubView === 'members'
                      ? 'bg-[#5a0000] text-white shadow-sm'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  Members ({stats.membersCount})
                </button>
              </div>

              {activeSubView === 'schedule' && (
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-2 py-1 rounded-md bg-gray-100 text-gray-800 font-bold text-[10px] uppercase tracking-wider hover:bg-gray-200 flex items-center gap-1 shrink-0 border border-gray-200"
                >
                  <Edit3 className="w-3 h-3" /> Bulk Set
                </button>
              )}

              {activeSubView === 'overrides' && (
                <button
                  onClick={() => setShowOverrideModal(true)}
                  className="px-2 py-1 rounded-md bg-[#5a0000] text-white font-bold text-[10px] uppercase tracking-wider hover:bg-[#7a0000] flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── TAB 1: MONTHLY DUE SCHEDULE MATRIX ────────────── */}
      {selectedSeasonId && activeSubView === 'schedule' && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-800">
                12-Month Schedule ({selectedSeason?.name})
              </h3>
              <p className="text-[10px] font-semibold text-gray-500">
                Customize targets per month or lock/unlock months
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
            {dues.map((month) => {
              const isLocked = month.locked;
              return (
                <div
                  key={month.monthKey}
                  className={`bg-gray-50 border rounded-xl p-2.5 flex flex-col justify-between transition-all relative ${
                    isLocked ? 'border-red-200 bg-red-50/20' : 'border-gray-200 hover:border-amber-400 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-500">
                      {month.monthOrder}. {month.monthKey}
                    </span>
                    <button
                      onClick={() => handleToggleLock(month)}
                      className={`p-0.5 rounded text-xs ${month.locked ? 'text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-gray-700'}`}
                      title={month.locked ? 'Locked: Click to Unlock' : 'Open: Click to Lock'}
                    >
                      {month.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                  </div>

                  <div className="my-0.5">
                    <span className="text-[11px] font-bold text-gray-700 block truncate">{month.monthName}</span>
                    <span className="text-base font-black text-gray-900 block mt-0.5">₹{month.dueAmount}</span>
                  </div>

                  <button
                    onClick={() => {
                      setEditingMonth(month);
                      setEditAmount(String(month.dueAmount));
                      setEditReason('');
                      setShowEditMonthModal(true);
                    }}
                    className="mt-1.5 w-full py-1 rounded-md bg-white border border-gray-200 text-[9px] font-black uppercase tracking-wider text-gray-800 hover:bg-gray-100 flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <Edit3 className="w-2.5 h-2.5" /> Edit Target
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 2: MEMBER OVERRIDES ────────────────────────── */}
      {selectedSeasonId && activeSubView === 'overrides' && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-800">
                Custom Member / Flat Overrides
              </h3>
              <p className="text-[10px] font-semibold text-gray-500">
                Special arrangements taking precedence over default schedule
              </p>
            </div>
          </div>

          {overrides.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
              <UserPlus className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-gray-500 uppercase">No custom overrides configured</p>
              <p className="text-[10px] text-gray-400 mt-0.5">All members pay the standard monthly schedule</p>
              <button
                onClick={() => setShowOverrideModal(true)}
                className="mt-2.5 px-3 py-1.5 bg-[#5a0000] text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#7a0000]"
              >
                Add First Override
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
              {overrides.map((ov) => (
                <div key={ov.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col justify-between hover:shadow-sm">
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-black text-gray-900">
                        {ov.userName || ov.flatDisplay || 'Member Override'}
                      </span>
                      <button
                        onClick={() => handleDeleteOverride(ov.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded-md"
                        title="Delete Override"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 block mt-0.5">
                      Month: {ov.monthKey}
                    </span>
                    <p className="text-[10px] text-gray-500 italic mt-0.5">&quot;{ov.reason}&quot;</p>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-gray-200/60 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-gray-400">Override:</span>
                    <span className="text-xs sm:text-sm font-black text-emerald-700">₹{ov.overrideAmount} / mo</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: PENDING APPROVALS ───────────────────────── */}
      {selectedSeasonId && activeSubView === 'approvals' && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-800">
                Pending Approvals ({pendingChandaPayments.length})
              </h3>
              <p className="text-[10px] font-semibold text-gray-500">
                Review UTRs submitted by members and approve/reject contributions
              </p>
            </div>
          </div>

          {pendingChandaPayments.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-gray-500 uppercase">No pending approvals</p>
              <p className="text-[10px] text-gray-400 mt-0.5">All online contributions are cleared</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingChandaPayments.map((payment) => (
                <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50/40">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black text-gray-900">{payment.userName || 'Unknown'}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                        ₹{payment.amount || 0}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                      UTR: <span className="font-mono bg-white px-1 py-0.2 rounded border border-gray-200 text-gray-900">{payment.utr_number || 'N/A'}</span>
                    </p>
                    {payment.message && (
                      <p className="text-[9px] text-gray-600 italic mt-0.5">&quot;{payment.message}&quot;</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onApproveChanda && (
                      <button
                        onClick={() => onApproveChanda(payment.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider hover:bg-emerald-700 shadow-sm"
                      >
                        Approve
                      </button>
                    )}
                    {onRejectChanda && (
                      <button
                        onClick={() => onRejectChanda(payment.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 text-[10px] sm:text-xs font-black uppercase tracking-wider hover:bg-red-200"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: MANDAL MEMBERS & EXEMPT MONTHS ───────────── */}
      {selectedSeasonId && activeSubView === 'members' && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-800">
                Mandal Members & Exemptions
              </h3>
              <p className="text-[10px] font-semibold text-gray-500">
                Manage registered members and block previous months for late joiners
              </p>
            </div>

            {onAddMember && setNewMemberName && setIsNewMemberHonorary && (
              <form onSubmit={onAddMember} className="flex flex-wrap items-center gap-1.5">
                <input
                  type="text"
                  placeholder="New Member Name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-lg bg-[#5a0000] text-white text-[10px] sm:text-xs font-black uppercase tracking-wider hover:bg-[#7a0000]"
                >
                  Add Member
                </button>
              </form>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
            {mandalMembers.map((member) => {
              const isExpanded = expandedMemberId === member.id;
              const memberExempt: string[] = member.exemptMonths || [];
              return (
                <div key={member.id} className="rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-gray-900 block">{member.name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {member.isHonorary && (
                          <span className="text-[8px] font-bold uppercase text-yellow-700 bg-yellow-100 px-1.5 rounded">Honorary</span>
                        )}
                        {memberExempt.length > 0 && (
                          <span className="text-[8px] font-bold text-blue-700">{memberExempt.length} mo exempt</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                        className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[9px] font-bold uppercase text-gray-700 hover:bg-gray-100"
                      >
                        {isExpanded ? 'Close' : 'Months'}
                      </button>
                      {onRemoveMember && (
                        <button
                          type="button"
                          onClick={() => onRemoveMember(member.id, member.name)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && onToggleMemberExemptMonth && (
                    <div className="mt-3 pt-2 border-t border-gray-200 bg-white p-2 rounded-xl">
                      <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">
                        Toggle Exempt Months:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {MANDAL_MONTHS.map((m) => {
                          const isBlocked = memberExempt.includes(m.key);
                          return (
                            <button
                              key={m.key}
                              type="button"
                              onClick={() => onToggleMemberExemptMonth(member, m.key)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                                isBlocked ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {m.key} {isBlocked ? '🚫' : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE NEW SEASON ────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                  Create New Chanda Season
                </h3>
                <p className="text-[10px] font-bold text-gray-400">
                  Set up future year rules without code edits
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSeason} className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Season Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026–27"
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Display Title</label>
                <input
                  type="text"
                  placeholder="Ganpati Chanda Season 2026–27"
                  value={newSeasonDisplayName}
                  onChange={(e) => setNewSeasonDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                  />
                </div>
              </div>

              {/* Copy previous season toggle */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyPrevious}
                    onChange={(e) => setCopyPrevious(e.target.checked)}
                    className="w-4 h-4 accent-[#5a0000] rounded"
                  />
                  <span className="text-xs font-black uppercase tracking-wider text-amber-950">
                    Copy from previous season?
                  </span>
                </label>

                {copyPrevious && seasons.length > 0 && (
                  <div>
                    <label className="text-[9px] font-bold text-amber-800 block mb-1">Source Season:</label>
                    <select
                      value={sourceSeasonId}
                      onChange={(e) => setSourceSeasonId(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-bold bg-white outline-none"
                    >
                      {seasons.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-amber-700 mt-1">
                      Copies the 12-month due schedule and overrides with fresh ₹0 payments.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-[#5a0000] text-white hover:bg-[#7a0000] shadow-sm disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Draft Season'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT SEASON DETAILS ──────────────────────── */}
      {showEditSeasonModal && selectedSeason && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                Edit Season Settings ({selectedSeason.name})
              </h3>
              <button onClick={() => setShowEditSeasonModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSeasonDetails} className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Season Name</label>
                <input
                  type="text"
                  required
                  value={editSeasonName}
                  onChange={(e) => setEditSeasonName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Display Title</label>
                <input
                  type="text"
                  value={editSeasonDisplayName}
                  onChange={(e) => setEditSeasonDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Season Status</label>
                <select
                  value={editSeasonStatus}
                  onChange={(e) => setEditSeasonStatus(e.target.value as SeasonStatus)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-white outline-none"
                >
                  <option value="active">Active (Live festival season)</option>
                  <option value="draft">Draft (Preparing future season)</option>
                  <option value="closed">Closed (Historical)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Receipt Prefix</label>
                <input
                  type="text"
                  value={editSeasonPrefix}
                  onChange={(e) => setEditSeasonPrefix(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditSeasonModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingSeason}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-[#5a0000] text-white hover:bg-[#7a0000] shadow-sm disabled:opacity-50"
                >
                  {isUpdatingSeason ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT SINGLE MONTH AMOUNT ────────────────── */}
      {showEditMonthModal && editingMonth && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                Edit {editingMonth.monthName} Target
              </h3>
              <button onClick={() => setShowEditMonthModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMonthAmount} className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Fixed Due Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-black bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Reason / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Festival preparation increment"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditMonthModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingMonth}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-[#5a0000] text-white hover:bg-[#7a0000] shadow-sm disabled:opacity-50"
                >
                  {isUpdatingMonth ? 'Updating...' : 'Save Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: BULK EDIT MONTHS ────────────────────────── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                Bulk Set Monthly Targets
              </h3>
              <button onClick={() => setShowBulkModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkUpdate} className="space-y-3">
              <p className="text-xs font-semibold text-gray-600">
                Apply this fixed amount across all 12 months in <span className="font-bold text-[#5a0000]">{selectedSeason?.name}</span>.
              </p>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Target Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-black bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkUpdating}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-amber-500 text-white hover:bg-amber-600 shadow-sm disabled:opacity-50"
                >
                  {isBulkUpdating ? 'Applying...' : 'Apply to All Months'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD MEMBER OVERRIDE ─────────────────────── */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                Add Custom Member / Flat Override
              </h3>
              <button onClick={() => setShowOverrideModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Member Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ronik Sahu"
                  value={overrideUser}
                  onChange={(e) => setOverrideUser(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Flat (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. A-101"
                  value={overrideFlat}
                  onChange={(e) => setOverrideFlat(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Applicable Month</label>
                  <select
                    value={overrideMonth}
                    onChange={(e) => setOverrideMonth(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                  >
                    <option value="ALL">All 12 Months</option>
                    {MANDAL_MONTHS.map(m => (
                      <option key={m.key} value={m.key}>{m.name} ({m.key})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Override Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={overrideAmount}
                    onChange={(e) => setOverrideAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Reason</label>
                <input
                  type="text"
                  placeholder="Special arrangement / student discount"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingOverride}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-[#5a0000] text-white hover:bg-[#7a0000] shadow-sm disabled:opacity-50"
                >
                  {isSavingOverride ? 'Saving...' : 'Save Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
