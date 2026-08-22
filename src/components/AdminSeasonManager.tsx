"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Plus, Edit3, Trash2, CheckCircle2, AlertCircle, RefreshCw,
  Copy, Lock, Unlock, ShieldAlert, Sparkles, FolderPlus, ArrowRight,
  X, Check, IndianRupee, Layers, FileText, BarChart2, ChevronRight, UserPlus,
  Coins, Settings, Clock, ArrowUpRight, ShieldCheck, UserCheck, Eye
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Select } from '@/components/ui/Select';
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
  addCustomMonthlyDue,
  deleteMonthlyDue,
  bulkUpdateMonthlyDues,
  toggleMonthLock,
  bulkLockMonthlyDues,
  bulkUnlockMonthlyDues,
  setMemberOverride,
  deleteMemberOverride,
  seedInitialSeasons,
  deleteSeason,
  cleanupDuplicateSeasons,
  formatPeriodKey,
  CALENDAR_MONTH_NAMES,
  MANDAL_MONTHS
} from '@/lib/seasonService';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';


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
  onToggleMemberExemptMonth?: (member: any, month: any, aliases?: string[]) => void;
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

  // Modals & Selection
  const [selectedDueIds, setSelectedDueIds] = useState<string[]>([]);
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

  // Add Custom Month Modal
  const [showAddMonthModal, setShowAddMonthModal] = useState(false);
  const [newMonthKey, setNewMonthKey] = useState('');
  const [newMonthName, setNewMonthName] = useState('September');
  const [newMonthYear, setNewMonthYear] = useState<number>(2026);
  const [newMonthAmount, setNewMonthAmount] = useState('250');
  const [newMonthOrder, setNewMonthOrder] = useState('13');
  const [newMonthNotes, setNewMonthNotes] = useState('');
  const [isAddingMonth, setIsAddingMonth] = useState(false);

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

  // Global Blocked Months (Mandal Settings)
  const [blockedMonths, setBlockedMonths] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'mandal_settings', 'config'), (snap) => {
      if (snap.exists() && snap.data()?.blockedMonths) {
        setBlockedMonths(snap.data().blockedMonths);
      } else {
        setBlockedMonths([]);
      }
    });
    return () => unsub();
  }, []);

  const handleToggleGlobalBlock = async (targetKey: string, aliasKeys: string[] = []) => {
    const allKeys = [targetKey, ...aliasKeys].filter(Boolean);
    const isCurrentlyBlocked = blockedMonths.some(m => allKeys.includes(m));
    const newBlocked = isCurrentlyBlocked
      ? blockedMonths.filter(m => !allKeys.includes(m))
      : Array.from(new Set([...blockedMonths, targetKey]));

    try {
      await setDoc(doc(db, 'mandal_settings', 'config'), { blockedMonths: newBlocked }, { merge: true });
      onShowToast?.({ text: isCurrentlyBlocked ? `${targetKey} unblocked globally ✅` : `${targetKey} blocked globally 🚫`, type: 'success' });
    } catch (err) {
      console.error(err);
      onShowToast?.({ text: 'Failed to update global block settings', type: 'error' });
    }
  };

  const handleBulkGlobalBlockSelected = async (block: boolean) => {
    if (selectedDueIds.length === 0) return;
    askConfirm(
      `${selectedDueIds.length} periods ko globally ${block ? 'BLOCK' : 'UNBLOCK'} karein?`,
      async () => {
        try {
          let newBlocked = [...blockedMonths];
          if (block) {
            newBlocked = Array.from(new Set([...newBlocked, ...selectedDueIds]));
          } else {
            newBlocked = newBlocked.filter(m => !selectedDueIds.includes(m));
          }
          await setDoc(doc(db, 'mandal_settings', 'config'), { blockedMonths: newBlocked }, { merge: true });
          onShowToast?.({ text: `Successfully ${block ? 'globally blocked' : 'globally unblocked'} ${selectedDueIds.length} periods`, type: 'success' });
          setSelectedDueIds([]);
        } catch (err: any) {
          onShowToast?.({ text: err.message || 'Action failed', type: 'error' });
        }
      }
    );
  };

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
      setSelectedDueIds([]);
      return;
    }
    const currentSeason = seasons.find(s => s.id === selectedSeasonId);
    const unsub = subscribeMonthlyDues(selectedSeasonId, (dList) => {
      setDues(dList);
    }, currentSeason?.startDate);
    return () => unsub();
  }, [selectedSeasonId, seasons]);

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
    const docKey = editingMonth.id || editingMonth.periodKey || editingMonth.monthKey;
    if (!docKey) return;
    setIsUpdatingMonth(true);
    try {
      await updateMonthlyDue(
        selectedSeasonId,
        docKey,
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

  const handleAddCustomMonth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeasonId) return;

    const monthNameClean = newMonthName.trim();
    if (!monthNameClean) {
      onShowToast({ text: 'Please select or enter a month/period name', type: 'error' });
      return;
    }

    const monthIdx = CALENDAR_MONTH_NAMES.findIndex(m => m.toLowerCase() === monthNameClean.toLowerCase());
    const canonicalKey = monthIdx >= 0
      ? formatPeriodKey(newMonthYear, monthIdx + 1)
      : (newMonthKey.trim() ? `${newMonthYear}_${newMonthKey.trim().toUpperCase()}` : `custom_${Date.now()}`);

    // Check for collision
    const existing = dues.find(d => (d.periodKey === canonicalKey || d.id === canonicalKey));
    if (existing) {
      onShowToast({ text: `Period "${monthNameClean} ${newMonthYear}" (${canonicalKey}) is already in the schedule!`, type: 'error' });
      return;
    }

    setIsAddingMonth(true);
    try {
      await addCustomMonthlyDue(
        selectedSeasonId,
        {
          periodKey: canonicalKey,
          monthKey: newMonthKey.trim().toUpperCase() || monthNameClean.slice(0, 4).toUpperCase(),
          monthName: monthNameClean,
          year: newMonthYear,
          monthOrder: Number(newMonthOrder) || (dues.length + 1),
          dueAmount: Number(newMonthAmount) || 250,
          notes: newMonthNotes.trim()
        },
        currentUserData?.uid
      );
      onShowToast({ text: `Added period "${monthNameClean} ${newMonthYear}" (#${newMonthOrder}, ₹${newMonthAmount})`, type: 'success' });
      setShowAddMonthModal(false);
      setNewMonthKey('');
      setNewMonthName('September');
      setNewMonthAmount('250');
      setNewMonthOrder(String(dues.length + 2));
      setNewMonthNotes('');
    } catch (err: any) {
      onShowToast({ text: err.message || 'Failed to add period', type: 'error' });
    } finally {
      setIsAddingMonth(false);
    }
  };

  const handleDeleteCustomMonth = (due: MonthlyDue) => {
    if (!selectedSeasonId) return;
    const docKey = due.id || due.periodKey || due.monthKey;
    if (!docKey) return;
    askConfirm(`Delete schedule item "${due.monthName} ${due.year || ''}"?`, async () => {
      try {
        await deleteMonthlyDue(selectedSeasonId, docKey, currentUserData?.uid);
        onShowToast({ text: `Deleted ${due.monthName}!`, type: 'success' });
        setShowEditMonthModal(false);
      } catch (err: any) {
        onShowToast({ text: err.message || 'Failed to delete target', type: 'error' });
      }
    });
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeasonId) return;
    setIsBulkUpdating(true);
    try {
      const payload = dues.map(d => ({
        dueId: d.id,
        periodKey: d.periodKey,
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
    const docKey = month.id || month.periodKey || month.monthKey;
    if (!docKey) return;
    try {
      await toggleMonthLock(
        selectedSeasonId,
        docKey,
        !month.locked,
        currentUserData?.uid,
        month.locked ? 'Unlocked by admin' : 'Locked by admin'
      );
      onShowToast({
        text: `${month.monthName} ${month.year || ''} is now ${month.locked ? 'Unlocked' : 'Locked'}`,
        type: 'success'
      });
    } catch (err: any) {
      onShowToast({ text: err.message || 'Lock toggle failed', type: 'error' });
    }
  };

  const handleSelectAllDues = () => {
    if (selectedDueIds.length === dues.length) {
      setSelectedDueIds([]);
    } else {
      setSelectedDueIds(dues.map(d => d.id || d.periodKey || d.monthKey || '').filter(Boolean));
    }
  };


  const handleToggleSelectDue = (id: string) => {
    setSelectedDueIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkLockSelected = async (lock: boolean) => {
    if (!selectedSeasonId || selectedDueIds.length === 0) {
      onShowToast({ text: 'Select at least one month first', type: 'error' });
      return;
    }
    const actionText = lock ? 'Lock' : 'Unlock';
    askConfirm(
      `${actionText} ${selectedDueIds.length} selected period(s)?`,
      async () => {
        try {
          if (lock) {
            await bulkLockMonthlyDues(selectedSeasonId, selectedDueIds, 'Bulk locked by administrator', currentUserData?.uid);
          } else {
            await bulkUnlockMonthlyDues(selectedSeasonId, selectedDueIds, 'Bulk unlocked by administrator', currentUserData?.uid);
          }
          onShowToast({ text: `Successfully ${lock ? 'locked' : 'unlocked'} ${selectedDueIds.length} periods`, type: 'success' });
          setSelectedDueIds([]);
        } catch (err: any) {
          onShowToast({ text: err.message || 'Bulk lock action failed', type: 'error' });
        }
      }
    );
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
    <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-300">
      {/* ─── Top Control Bar ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/90 p-3.5 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-red-50 border border-red-200/80 flex items-center justify-center text-[#5a0000] shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-gray-900 uppercase tracking-tight">
                  Chanda & Finance Hub
                </h2>
                {activeSeason && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold uppercase tracking-wider">
                    {activeSeason.name} Live
                  </span>
                )}
              </div>
              <p className="text-[11px] font-normal text-gray-500 mt-0.5">
                Manage financial seasons, monthly targets, member overrides & payment approvals
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={() => {
                setNewSeasonName('2026–27');
                setNewSeasonDisplayName('Ganpati Chanda Season 2026–27');
                setNewStartDate('2026-09-01');
                setNewEndDate('2027-08-31');
                setShowCreateModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#5a0000] text-white font-semibold text-[11px] sm:text-xs uppercase tracking-wider hover:bg-[#720000] transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" /> Create Season
            </button>
          </div>
        </div>

        {/* Live Metrics Grid using shared StatCard */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-3.5">
          <StatCard
            label="Live Season"
            value={activeSeason ? activeSeason.name : 'None'}
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            colorTheme="maroon"
          />
          <StatCard
            label="Target / Member"
            value={`₹${stats.totalTargetSum.toLocaleString('en-IN')}`}
            icon={<IndianRupee className="w-3.5 h-3.5" />}
            colorTheme="success"
          />
          <StatCard
            label="Active Members"
            value={stats.membersCount}
            icon={<UserCheck className="w-3.5 h-3.5" />}
            colorTheme="info"
          />
          <StatCard
            label="Pending Approvals"
            value={stats.pendingCount}
            icon={<Clock className="w-3.5 h-3.5" />}
            colorTheme={stats.pendingCount > 0 ? "danger" : "neutral"}
            onClick={() => setActiveSubView('approvals')}
          />
        </div>
      </div>

      {/* ─── Season Selector Tabs & Sub-Navigation ──────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/90 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-gray-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#5a0000]" />
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-gray-800">
              Select Mandal Season
            </h3>
          </div>

          {selectedSeason && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleOpenEditSeason(selectedSeason)}
                className="px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-700 font-semibold text-[10px] sm:text-xs uppercase tracking-wider hover:bg-gray-100 flex items-center gap-1.5 border border-gray-200 cursor-pointer transition-colors shadow-2xs"
              >
                <Edit3 className="w-3 h-3 text-gray-500" /> Settings
              </button>

              {selectedSeason.status !== 'active' && (
                <button
                  onClick={() => handleActivateSeason(selectedSeason)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-[10px] sm:text-xs uppercase tracking-wider hover:bg-emerald-700 flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                >
                  <Check className="w-3 h-3" /> Set Live
                </button>
              )}

              {displaySeasons.length > 1 && (
                <button
                  onClick={() => handleDeleteSeason(selectedSeason)}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 font-semibold text-[10px] sm:text-xs uppercase tracking-wider hover:bg-rose-100 flex items-center gap-1 border border-rose-200 cursor-pointer transition-colors shadow-2xs"
                  title="Delete this season"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              )}

              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                selectedSeason.status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : selectedSeason.status === 'draft'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}>
                {selectedSeason.status}
              </span>
            </div>
          )}
        </div>

        {/* Season Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {displaySeasons.map((s) => {
            const isSelected = s.id === selectedSeasonId;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSeasonId(s.id)}
                className={`px-3.5 py-1.5 rounded-xl font-semibold text-xs uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#5a0000] text-white shadow-2xs'
                    : 'bg-gray-100/90 text-gray-700 hover:bg-gray-200/90'
                }`}
              >
                <span>{s.name}</span>
                {s.status === 'active' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                )}
                {s.status === 'closed' && (
                  <span className="text-[9px] opacity-70">🔒</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sub-views inside Season & Finance */}
        {selectedSeasonId && (
          <div className="border-t border-gray-100 pt-2.5">
            <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              <div className="flex gap-1.5 bg-gray-100/80 p-1 rounded-xl border border-gray-200/60">
                <button
                  onClick={() => setActiveSubView('schedule')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                    activeSubView === 'schedule'
                      ? 'bg-[#5a0000] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                  }`}
                >
                  Schedule ({dues.length})
                </button>

                <button
                  onClick={() => setActiveSubView('overrides')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                    activeSubView === 'overrides'
                      ? 'bg-[#5a0000] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                  }`}
                >
                  Overrides ({overrides.length})
                </button>

                <button
                  onClick={() => setActiveSubView('approvals')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    activeSubView === 'approvals'
                      ? 'bg-[#5a0000] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                  }`}
                >
                  <span>Approvals</span>
                  {stats.pendingCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[9px] font-bold">
                      {stats.pendingCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveSubView('members')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                    activeSubView === 'members'
                      ? 'bg-[#5a0000] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                  }`}
                >
                  Members ({stats.membersCount})
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── TAB 1: MONTHLY DUE SCHEDULE MATRIX ────────────── */}
      {selectedSeasonId && activeSubView === 'schedule' && (
        <div className="bg-white rounded-2xl border border-gray-200/90 p-3 sm:p-5 shadow-xs space-y-3.5">
          {/* Header & Main Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-gray-900">
                  Monthly Due Schedule ({selectedSeason?.name})
                </h3>
                <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                  {dues.length} Periods
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-normal mt-0.5">
                Tap any month card to adjust target amount, block globally, or lock for this season.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  const startYear = parseInt((selectedSeason?.startDate || '2025-09-01').split('-')[0], 10) || 2025;
                  setNewMonthKey('SEPT');
                  setNewMonthName('September');
                  setNewMonthYear(startYear + 1);
                  setNewMonthAmount('250');
                  setNewMonthOrder(String(dues.length + 1));
                  setNewMonthNotes('');
                  setShowAddMonthModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#5a0000] text-white font-semibold text-[11px] sm:text-xs uppercase tracking-wider hover:bg-[#7a0000] flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add Month / Target
              </button>
              <button
                type="button"
                onClick={() => setShowBulkModal(true)}
                className="px-3 py-1.5 rounded-xl bg-white text-gray-700 font-semibold text-[11px] sm:text-xs uppercase tracking-wider hover:bg-gray-50 flex items-center gap-1.5 border border-gray-200 shadow-2xs cursor-pointer transition-colors"
              >
                <Edit3 className="w-3 h-3" /> Bulk Set Target
              </button>
            </div>
          </div>

          {/* Contextual Multi-Select & Bulk Action Toolbar */}
          <div className="bg-gray-50/90 border border-gray-200/80 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2.5 transition-all">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dues.length > 0 && selectedDueIds.length === dues.length}
                  onChange={handleSelectAllDues}
                  className="w-3.5 h-3.5 accent-[#5a0000] rounded cursor-pointer"
                />
                <span>
                  Select All <span className="text-gray-400 font-normal">({selectedDueIds.length}/{dues.length})</span>
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {selectedDueIds.length === 0 ? (
                <span className="text-[11px] font-normal text-gray-400 italic">
                  Select cards below for bulk operations
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleBulkGlobalBlockSelected(true)}
                    className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-semibold text-[10px] uppercase tracking-wider hover:bg-rose-100 border border-rose-200 flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95"
                    title="Block selected months globally"
                  >
                    🚫 Global Block ({selectedDueIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkGlobalBlockSelected(false)}
                    className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 font-semibold text-[10px] uppercase tracking-wider hover:bg-teal-100 border border-teal-200 flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95"
                    title="Unblock selected months globally"
                  >
                    ✅ Global Unblock ({selectedDueIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkLockSelected(true)}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold text-[10px] uppercase tracking-wider hover:bg-amber-100 border border-amber-200 flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95"
                    title="Lock selected months for this season"
                  >
                    <Lock className="w-3 h-3" /> Season Lock ({selectedDueIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkLockSelected(false)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold text-[10px] uppercase tracking-wider hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95"
                    title="Unlock selected months for this season"
                  >
                    <Unlock className="w-3 h-3" /> Season Unlock ({selectedDueIds.length})
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Month Target Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
            {dues.map((month) => {
              const docKey = month.periodKey || month.monthKey || month.id || `month_${month.monthOrder}`;
              const aliases = [month.periodKey, month.monthKey, month.id].filter(Boolean) as string[];
              const isGloballyBlocked = blockedMonths.some(m => aliases.includes(m));
              const isSeasonLocked = month.locked || month.status === 'locked';
              const isSelected = selectedDueIds.includes(docKey);

              return (
                <div
                  key={docKey}
                  onClick={() => {
                    setEditingMonth(month);
                    setEditAmount(String(month.dueAmount));
                    setEditReason(month.lockReason || '');
                    setShowEditMonthModal(true);
                  }}
                  className={`rounded-2xl border p-3 flex flex-col justify-between transition-all relative cursor-pointer active:scale-[0.99] select-none ${
                    isSelected
                      ? 'ring-2 ring-[#5a0000] border-[#5a0000] bg-amber-50/20 shadow-xs'
                      : isGloballyBlocked
                      ? 'border-rose-200 bg-rose-50/25 hover:border-rose-300 hover:shadow-2xs'
                      : isSeasonLocked
                      ? 'border-amber-200 bg-amber-50/25 hover:border-amber-300 hover:shadow-2xs'
                      : 'border-gray-200/90 bg-white hover:border-gray-300 hover:shadow-2xs'
                  }`}
                >
                  {/* Top Row: Checkbox + Month Order & Name + Pencil */}
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleSelectDue(docKey);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 accent-[#5a0000] rounded cursor-pointer mt-0.5 shrink-0"
                      />
                      <div className="truncate">
                        <span className="text-[11px] font-bold uppercase tracking-tight text-gray-900 block truncate">
                          #{month.monthOrder} {month.monthName || month.monthKey}
                        </span>
                        {month.year && (
                          <span className="text-[9px] font-medium text-gray-400 block leading-none mt-0.5">
                            {month.year}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingMonth(month);
                        setEditAmount(String(month.dueAmount));
                        setEditReason(month.lockReason || '');
                        setShowEditMonthModal(true);
                      }}
                      className="w-5 h-5 rounded-md bg-gray-50 hover:bg-gray-100 border border-gray-200/80 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors shadow-2xs cursor-pointer shrink-0"
                      title="Edit month target"
                      aria-label="Edit month target"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {/* Middle: Target Amount */}
                  <div className="my-2.5">
                    <span className="text-lg sm:text-xl font-bold text-gray-900 block tracking-tight">
                      ₹{month.dueAmount.toLocaleString('en-IN')}
                    </span>
                    {month.lockReason && (
                      <span className="text-[9px] text-gray-500 font-normal truncate block mt-0.5" title={month.lockReason}>
                        {month.lockReason}
                      </span>
                    )}
                  </div>

                  {/* Bottom: Status Pill + Edit Label */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
                    {isGloballyBlocked ? (
                      <span className="inline-flex items-center gap-1 text-[8.5px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
                        🚫 Blocked
                      </span>
                    ) : isSeasonLocked ? (
                      <span className="inline-flex items-center gap-1 text-[8.5px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                        🔒 Locked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[8.5px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active
                      </span>
                    )}
                    <span className="text-[9px] text-gray-400 font-medium hover:text-gray-600">
                      Edit ✎
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* ─── TAB 2: MEMBER OVERRIDES ────────────────────────── */}
      {selectedSeasonId && activeSubView === 'overrides' && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                Custom Member / Flat Overrides
              </h3>
              <p className="text-[10px] font-medium text-gray-500">
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
                <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50/50 shadow-2xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black text-gray-900">{payment.userName || payment.userId || 'Unknown'}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-black">
                        ₹{payment.amount || 0}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-600 font-bold">
                      UTR: <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-900">{payment.utr_number || 'N/A'}</span>
                      {payment.userEmail && <span className="text-gray-400 font-medium ml-1.5">• {payment.userEmail}</span>}
                    </p>
                    {payment.message && (
                      <p className="text-[10px] text-gray-600 italic mt-0.5">&quot;{payment.message}&quot;</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    {onApproveChanda && (
                      <button
                        onClick={() => {
                          askConfirm(`₹${payment.amount} contribution from ${payment.userName || 'Member'} approve karein?`, () => onApproveChanda(payment.id));
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider hover:bg-emerald-700 shadow-xs cursor-pointer active:scale-95"
                      >
                        Approve
                      </button>
                    )}
                    {onRejectChanda && (
                      <button
                        onClick={() => {
                          askConfirm(`₹${payment.amount} payment request reject karein?`, () => onRejectChanda(payment.id));
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 text-[10px] sm:text-xs font-black uppercase tracking-wider hover:bg-red-200 border border-red-200 cursor-pointer active:scale-95"
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
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-[#5a0000] text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider hover:bg-[#7a0000] transition-colors cursor-pointer"
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
                <div key={member.id} className="rounded-2xl border border-gray-200 bg-gray-50/80 p-3 flex flex-col justify-between shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">{member.name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {member.isHonorary && (
                          <span className="text-[9px] font-bold uppercase text-yellow-800 bg-yellow-100 px-1.5 py-0.2 rounded-md">Honorary</span>
                        )}
                        {memberExempt.length > 0 && (
                          <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded-md">{memberExempt.length} mo exempt</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                        className="px-2 py-1 rounded-lg bg-white border border-gray-200 text-[9px] font-bold uppercase text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shadow-2xs"
                      >
                        {isExpanded ? 'Close' : 'Exempt Months'}
                      </button>
                      {onRemoveMember && (
                        <button
                          type="button"
                          onClick={() => onRemoveMember(member.id, member.name)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove Member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && onToggleMemberExemptMonth && (
                    <div className="mt-2.5 pt-2 border-t border-gray-200 bg-white p-2 rounded-xl">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-gray-600">
                          Toggle Exempted Periods:
                        </span>
                        <span className="text-[9px] text-gray-400 font-medium">Tap month to block/unblock</span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                        {(dues.length > 0 ? dues : MANDAL_MONTHS).map((m: any) => {
                          const pKey = m.periodKey;
                          const monthK = m.monthKey;
                          const mId = m.id;
                          const legacyKey = m.key;
                          const isBlocked = Boolean(
                            (pKey && memberExempt.includes(pKey)) ||
                            (monthK && memberExempt.includes(monthK)) ||
                            (mId && memberExempt.includes(mId)) ||
                            (legacyKey && memberExempt.includes(legacyKey))
                          );
                          const primaryKey = pKey || monthK || mId || legacyKey;
                          const shortName = m.monthName ? m.monthName.slice(0, 4).toUpperCase() : (m.name ? m.name.slice(0, 4).toUpperCase() : primaryKey);
                          const yearTag = m.year ? `'${String(m.year).slice(-2)}` : '';

                          return (
                            <button
                              key={primaryKey}
                              type="button"
                              onClick={() => {
                                const allAliases = [pKey, monthK, mId, legacyKey].filter(Boolean) as string[];
                                onToggleMemberExemptMonth(member, primaryKey, allAliases);
                              }}
                              className={`py-1 px-1 rounded-lg text-[9px] transition-all text-center cursor-pointer select-none ${
                                isBlocked
                                  ? 'bg-rose-50 text-rose-700 border border-rose-300 font-black shadow-2xs'
                                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 font-bold'
                              }`}
                              title={isBlocked ? `${m.name || m.monthName} is exempt` : `Click to exempt ${m.name || m.monthName}`}
                            >
                              <span className="block truncate font-black tracking-tight">{shortName} {yearTag}</span>
                              <span className="text-[7.5px] block font-bold leading-none mt-0.5 opacity-90">
                                {isBlocked ? '🚫 EXEMPT' : 'ACTIVE'}
                              </span>
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                  Create New Chanda Season
                </h3>
                <p className="text-[10px] font-medium text-gray-400">
                  Set up future year rules without code edits
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSeason} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Season Name *</label>
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
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Display Title</label>
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
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">End Date</label>
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
                    className="w-4 h-4 accent-[#5a0000] rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-950">
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

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase bg-[#5a0000] text-white hover:bg-[#7a0000] shadow-xs disabled:opacity-50 cursor-pointer"
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                Edit Season Settings ({selectedSeason.name})
              </h3>
              <button onClick={() => setShowEditSeasonModal(false)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSeasonDetails} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Season Name</label>
                <input
                  type="text"
                  required
                  value={editSeasonName}
                  onChange={(e) => setEditSeasonName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Display Title</label>
                <input
                  type="text"
                  value={editSeasonDisplayName}
                  onChange={(e) => setEditSeasonDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Season Status</label>
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
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Receipt Prefix</label>
                <input
                  type="text"
                  value={editSeasonPrefix}
                  onChange={(e) => setEditSeasonPrefix(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditSeasonModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingSeason}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase bg-[#5a0000] text-white hover:bg-[#7a0000] shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingSeason ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD CUSTOM MONTH / DUE TARGET ───────────── */}
      {showAddMonthModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                  Add Month / 13th Period Target
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Configure extra collection periods without year collisions
                </p>
              </div>
              <button onClick={() => setShowAddMonthModal(false)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomMonth} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Month Name</label>
                  <select
                    value={newMonthName}
                    onChange={(e) => setNewMonthName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-white outline-none"
                  >
                    {CALENDAR_MONTH_NAMES.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    <option value="Custom">Custom Name...</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Target Year</label>
                  <input
                    type="number"
                    required
                    min="2020"
                    max="2035"
                    value={newMonthYear}
                    onChange={(e) => setNewMonthYear(parseInt(e.target.value, 10) || 2026)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                  />
                </div>
              </div>

              {newMonthName === 'Custom' && (
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Custom Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ganpati Visarjan Special"
                    onChange={(e) => setNewMonthName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Short Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. SEPT, EXT-1"
                  value={newMonthKey}
                  onChange={(e) => setNewMonthKey(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Due Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newMonthAmount}
                    onChange={(e) => setNewMonthAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold bg-gray-50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Schedule Order #</label>
                  <input
                    type="number"
                    min="1"
                    value={newMonthOrder}
                    onChange={(e) => setNewMonthOrder(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold bg-gray-50 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Target Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Extra festival collection ₹250"
                  value={newMonthNotes}
                  onChange={(e) => setNewMonthNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium bg-gray-50 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMonthModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold uppercase bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingMonth}
                  className="px-5 py-2 rounded-xl text-xs font-bold uppercase bg-[#5a0000] text-white hover:bg-[#7a0000] shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isAddingMonth ? 'Adding...' : 'Add to Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT SINGLE MONTH AMOUNT ────────────────── */}
      {showEditMonthModal && editingMonth && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                  Edit {editingMonth.monthName || editingMonth.monthKey} Target
                </h3>
                <p className="text-[10px] text-gray-400">Order #{editingMonth.monthOrder} • {editingMonth.year || ''}</p>
              </div>
              <button onClick={() => setShowEditMonthModal(false)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMonthAmount} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Fixed Due Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Reason / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Festival preparation target"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium bg-gray-50 outline-none"
                />
              </div>

              {/* Global Block Toggle (Mandal Settings) */}
              {(() => {
                const aliases = [editingMonth.periodKey, editingMonth.monthKey, editingMonth.id].filter(Boolean) as string[];
                const isGloballyBlocked = blockedMonths.some(m => aliases.includes(m));
                const targetKey = editingMonth.periodKey || editingMonth.monthKey || editingMonth.id;

                return (
                  <div className="flex items-center justify-between p-2.5 bg-rose-50/50 rounded-xl border border-rose-200/70">
                    <div>
                      <p className="text-xs font-bold text-gray-800">Global Block (Mandal Level)</p>
                      <p className="text-[10px] text-gray-500">Exempts all members & shows 🚫 on Dashboard</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleGlobalBlock(targetKey, aliases)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        isGloballyBlocked
                          ? 'bg-rose-600 text-white shadow-2xs hover:bg-rose-700'
                          : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {isGloballyBlocked ? 'Blocked 🚫' : 'Active 🟢'}
                    </button>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-800">Season Lock</p>
                  <p className="text-[10px] text-gray-400">Lock only for this season schedule</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleLock(editingMonth)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    editingMonth.locked ? 'bg-amber-100 text-amber-800 border border-amber-300 font-bold' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 font-bold'
                  }`}
                >
                  {editingMonth.locked ? 'Locked 🔒' : 'Open 🟢'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleDeleteCustomMonth(editingMonth)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                  title="Delete target"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowEditMonthModal(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingMonth}
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase bg-[#5a0000] text-white hover:bg-[#7a0000] shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isUpdatingMonth ? 'Updating...' : 'Save Target'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: BULK EDIT MONTHS ────────────────────────── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                Bulk Set Monthly Targets
              </h3>
              <button onClick={() => setShowBulkModal(false)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkUpdate} className="space-y-3">
              <p className="text-xs font-medium text-gray-600">
                Apply this fixed amount across all configured periods in <span className="font-bold text-[#5a0000]">{selectedSeason?.name}</span>.
              </p>

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Target Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkUpdating}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase bg-amber-500 text-white hover:bg-amber-600 shadow-xs disabled:opacity-50 cursor-pointer"
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                Add Custom Member / Flat Override
              </h3>
              <button onClick={() => setShowOverrideModal(false)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Member Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ronik Sahu"
                  value={overrideUser}
                  onChange={(e) => setOverrideUser(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Flat (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. A-101"
                  value={overrideFlat}
                  onChange={(e) => setOverrideFlat(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Applicable Period</label>
                  <select
                    value={overrideMonth}
                    onChange={(e) => setOverrideMonth(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none"
                  >
                    <option value="ALL">All Season Periods</option>
                    {(dues.length > 0 ? dues : MANDAL_MONTHS).map((m: any) => {
                      const key = m.periodKey || m.monthKey || m.key;
                      const label = `${m.monthName || m.name || key} ${m.year ? `(${m.year})` : ''} — ₹${m.dueAmount || m.defaultAmount || 100}`;
                      return (
                        <option key={key} value={key}>{label}</option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Override Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={overrideAmount}
                    onChange={(e) => setOverrideAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Reason</label>
                <input
                  type="text"
                  placeholder="Special arrangement / student discount"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium bg-gray-50 outline-none focus:bg-white focus:border-[#5a0000]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingOverride}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase bg-[#5a0000] text-white hover:bg-[#7a0000] shadow-xs disabled:opacity-50 cursor-pointer"
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

