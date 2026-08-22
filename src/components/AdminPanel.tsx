"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { getTimestampMillis, commitChunkedBatches } from '@/lib/utils';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, getDoc, where, getDocs, writeBatch, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import UserProfile from '@/components/UserProfile';
import AdminBuildingManager from '@/components/AdminBuildingManager';
import AdminSeasonManager from '@/components/AdminSeasonManager';
import { StatCard } from '@/components/ui/StatCard';
import { Select } from '@/components/ui/Select';
import { isMonthMatching } from '@/lib/seasonService';
import {
  Shield, ShieldAlert, Ban, RefreshCcw, Key, Mail, User, Image as ImageIcon,
  BarChart2, Settings, Lock, Activity, Database, AlertTriangle, Trash2, Search, Bell, UserCircle, CheckCircle2,
  Play, ChevronLeft, ChevronRight, X, Download, Smartphone, Unlock, ChevronDown, Coins, PlusCircle, ArrowUpRight, History, Edit3, Building2, Calendar
} from 'lucide-react';

// ✅ React-based confirm dialog — replaces window.confirm which is blocked in PWAs/Next.js
const ConfirmModal = ({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <p className="text-sm font-semibold text-gray-800 leading-relaxed pt-1">{message}</p>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
          Cancel
        </button>
        <button onClick={onConfirm} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-colors">
          Delete
        </button>
      </div>
    </div>
  </div>
);

// Backward-compatible select wrappers backed by unified Select
const CustomSelect = ({ value, onChange, options, placeholder, theme = 'light' }: { value: any, onChange: any, options: any[], placeholder?: string, theme?: 'light' | 'dark' }) => (
  <Select value={value} onChange={onChange} options={options} placeholder={placeholder} theme={theme} />
);

const SearchableSelect = ({ value, onChange, options, placeholder }: { value: string, onChange: (v: string) => void, options: { value: string, label: string }[], placeholder?: string }) => (
  <Select value={value} onChange={onChange} options={options} placeholder={placeholder} searchable />
);

const adminTabs = [
  { id: "analytics", label: "Overview", icon: <BarChart2 size={14} /> },
  { id: "finance", label: "Finance", icon: <Coins size={14} /> },
  { id: "users", label: "Users", icon: <User size={14} /> },
  { id: "buildings", label: "Buildings", icon: <Building2 size={14} /> },
  { id: "media", label: "Vault", icon: <ImageIcon size={14} /> },
  { id: "settings", label: "Website", icon: <Settings size={14} /> },
  { id: "profile", label: "Profile", icon: <UserCircle size={14} /> },
];

const MONTHLY_TARGET = 100;
const MONTHS = ["SEPT", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG"] as const;
type Month = string;

function normalizeMemberCode(value: string) { return value.trim().toLowerCase().replace(/\s+/g, ""); }
function toIsoDateString(value: any): string {
  if (!value) return '';
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.toMillis === 'function') return new Date(value.toMillis()).toISOString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function formatLedgerDate(value: any): string {
  const isoDate = toIsoDateString(value);
  if (!isoDate) return 'N/A';
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getCurrentTrackingMonth(): Month {
  const jsMonths: Month[] = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEPT", "OCT", "NOV", "DEC"];
  return jsMonths[new Date().getMonth()];
}

function getLocalDatetimeString() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function toIsoFromDatetimeLocal(value: string) {
  if (!value) return new Date().toISOString();
  const [datePart, timePart = '00:00'] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour = 0, minute = 0] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

const DEFAULT_MEMBERS = [
  { id: 1, name: "AYUSH", payments: { SEPT: 100, OCT: 50 } },
  { id: 2, name: "PIYUSH", payments: { SEPT: 90 } },
  { id: 3, name: "ARYAN", payments: { SEPT: 100, OCT: 50 } },
  { id: 4, name: "AMAN", payments: { SEPT: 120 } },
  { id: 5, name: "RISHI", payments: { SEPT: 100, OCT: 100, NOV: 57 } },
  { id: 6, name: "PANKAJ", payments: { SEPT: 100, OCT: 100, NOV: 100 } },
  { id: 7, name: "PAVAN", payments: { SEPT: 100, OCT: 100, NOV: 100, DEC: 100, JAN: 100 } },
  { id: 8, name: "AYUSH.S", payments: { SEPT: 100 } },
  { id: 9, name: "RONIK", payments: {}, isHonorary: true },
  { id: 10, name: "SURAJ", payments: {}, isHonorary: true },
];

export default function AdminPanel({ currentUserData, userData }: { currentUserData?: any; userData?: any }) {
  const adminUser = currentUserData ?? userData;
  const [activeTab, setActiveTab] = useState("analytics");
  const [financeSubTab, setFinanceSubTab] = useState<'seasons' | 'danveers_ledger'>('seasons');
  // ✅ confirmModal replaces all window.confirm() calls
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const askConfirm = (message: string, onConfirm: () => void) => setConfirmModal({ message, onConfirm });
  const [users, setUsers] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultType, setVaultType] = useState('all');
  const [vaultPrivacy, setVaultPrivacy] = useState('all');
  const [vaultSort, setVaultSort] = useState('newest');
  const [vaultUploader, setVaultUploader] = useState('all');
  const [vaultDate, setVaultDate] = useState('all');
  const [vaultCaption, setVaultCaption] = useState('all');
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => {
      setToastMsg(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const [localPasscode, setLocalPasscode] = useState("");

  const [blockedMonths, setBlockedMonths] = useState<Month[]>([]);
  const [mandalMembers, setMandalMembers] = useState<any[]>([]);
  const [paymentMemberId, setPaymentMemberId] = useState("");
  const [paymentMonth, setPaymentMonth] = useState<Month>(getCurrentTrackingMonth());
  const [paymentAmount, setPaymentAmount] = useState(String(MONTHLY_TARGET));
  const [newMemberName, setNewMemberName] = useState("");
  const [isNewMemberHonorary, setIsNewMemberHonorary] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [chandaPayments, setChandaPayments] = useState<any[]>([]);
  const [selectedUserUid, setSelectedUserUid] = useState("");
  const [chandaAmount, setChandaAmount] = useState("");
  const [chandaMessage, setChandaMessage] = useState("Online Paid (Admin Entry)");
  const [chandaDate, setChandaDate] = useState(getLocalDatetimeString());
  const [chandaList, setChandaList] = useState<any[]>([]);
  const [isChandaSubmitting, setIsChandaSubmitting] = useState(false);
  const [ledgerModalUser, setLedgerModalUser] = useState<any>(null);
  const [ledgerModalLogs, setLedgerModalLogs] = useState<any[]>([]);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjRemark, setAdjRemark] = useState('');
  const [adjDate, setAdjDate] = useState(getLocalDatetimeString());
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [tempPaymentAmount, setTempPaymentAmount] = useState<number>(0);
  const [isEditingPayment, setIsEditingPayment] = useState(false);

  // VAULT SLIDER STATES
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const lastSwipeTime = useRef<number>(0);
  const [visibleCount, setVisibleCount] = useState(20);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    if (videoRef.current && selectedIndex !== null) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    }
  }, [selectedIndex]);

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        } else {
          setIsPlaying(true);
        }
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setProgress((current / total) * 100 || 0);
    }
  };

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const [settings, setSettings] = useState<any>({
    watermarkEnabled: true, hdDownloads: true, secretPasscode: "siyaram2026", announcement: "", notifications: [],
  });

  useEffect(() => {
    if (adminUser?.role?.toLowerCase() !== 'admin') return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const fetchedUsers = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      fetchedUsers.sort((a, b) => {
        const roleOrder: any = { 'Admin': 1, 'Member': 2, 'Viewer': 3, 'Banned': 4 };
        return (roleOrder[a.role] || 5) - (roleOrder[b.role] || 5);
      });
      setUsers(fetchedUsers);
    });

    const qMedia = query(collection(db, 'mandal_gallery'), orderBy('createdAt', 'desc'));
    const unsubMedia = onSnapshot(qMedia, (snap) => setMedia(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));

    const qChandaPayments = query(collection(db, 'chanda_payments'), orderBy('timestamp', 'desc'));
    const unsubChandaPayments = onSnapshot(qChandaPayments, (snap) => setChandaPayments(snap.docs.map((chandaDoc) => ({ id: chandaDoc.id, ...(chandaDoc.data() as any) }))));

    const qManualChanda = query(collection(db, 'mandal_chanda'), orderBy('lastUpdated', 'desc'));
    const unsubManualChanda = onSnapshot(
      qManualChanda,
      (snap) => setChandaList(snap.docs.map((chandaDoc) => ({ id: chandaDoc.id, docIdKey: chandaDoc.id, ...(chandaDoc.data() as any) }))),
      (error) => {
        console.warn('Chanda list permission bypass in AdminPanel:', error.message);
        setChandaList([]);
      }
    );

    const checkAndFetchSettings = async () => {
      const settingsRef = doc(db, 'mandal_settings', 'system');
      const snap = await getDoc(settingsRef);
      if (!snap.exists()) await setDoc(settingsRef, { watermarkEnabled: true, hdDownloads: true, secretPasscode: "siyaram2026" });
    };
    checkAndFetchSettings();

    const unsubConfig = onSnapshot(doc(db, 'mandal_settings', 'system'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data());
        setLocalPasscode(snap.data().secretPasscode || "siyaram2026");
      }
    });

    const unsubMandalMembers = onSnapshot(collection(db, "mandal_members"), (snap) => {
      const fetchedMembers = snap.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: data.id,
          name: data.name,
          payments: data.payments || {},
          isHonorary: data.isHonorary || false,
          isRemoved: data.isRemoved || false,
          exemptMonths: data.exemptMonths || [],
          preRemovalExemptMonths: data.preRemovalExemptMonths || [],
        };
      });
      fetchedMembers.sort((a, b) => a.id - b.id);
      setMandalMembers(fetchedMembers);
    });

    const unsubConfigBlock = onSnapshot(doc(db, "mandal_settings", "config"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().blockedMonths) setBlockedMonths(docSnap.data().blockedMonths);
    });

    return () => { unsubUsers(); unsubMedia(); unsubChandaPayments(); unsubManualChanda(); unsubConfig(); unsubMandalMembers(); unsubConfigBlock(); };
  }, [adminUser?.role]);

  const toggleBlockMonth = async (month: Month) => {
    const newBlocked = blockedMonths.includes(month) ? blockedMonths.filter((m) => m !== month) : [...blockedMonths, month];
    await setDoc(doc(db, "mandal_settings", "config"), { blockedMonths: newBlocked }, { merge: true });
  };

  const handleLogPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const memberId = Number(paymentMemberId);
    const amount = Number(paymentAmount);
    if (!Number.isFinite(memberId) || !Number.isFinite(amount) || amount <= 0) { showToast("Please choose a member and enter a valid amount.", 'error'); return; }
    const memberToUpdate = mandalMembers.find(m => m.id === memberId);
    if (!memberToUpdate) return;
    const currentAmount = memberToUpdate.payments[paymentMonth] || 0;
    await updateDoc(doc(db, "mandal_members", memberId.toString()), { [`payments.${paymentMonth}`]: currentAmount + amount });
    setPaymentAmount(String(MONTHLY_TARGET));
    setPaymentMemberId("");
    showToast("Payment Logged Successfully! 💰", 'success');
  };

  const handleAddMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newMemberName.trim();
    if (!trimmedName) return;
    const memberCode = normalizeMemberCode(trimmedName);
    const alreadyExists = mandalMembers.some((member) => normalizeMemberCode(member.name) === memberCode);
    if (alreadyExists) { showToast("Member already exists.", 'error'); return; }
    const nextId = mandalMembers.length > 0 ? Math.max(...mandalMembers.map((member) => member.id)) + 1 : 1;
    await setDoc(doc(db, "mandal_members", nextId.toString()), { id: nextId, name: trimmedName.toUpperCase(), payments: {}, isHonorary: isNewMemberHonorary, createdAt: new Date().toISOString() });
    setNewMemberName("");
    setIsNewMemberHonorary(false);
    showToast(`Member Added! 🎉`, 'success');
  };

  // ✅ Soft-remove a member from the mandal (e.g. member shifting away / leaving mid-way).
  // Member is hidden from active lists via `isRemoved: true`, but payment history stays intact.
  // All pending/unpaid months are automatically exempted (dues set to 0/maaf).
  const handleRemoveMember = (memberId: number, memberName: string) => {
    askConfirm(`"${memberName}" ko active members se hata dein? Inke saare pending months ke dues 0 (maaf) ho jayenge aur payment history safe rahegi.`, async () => {
      try {
        const memberToUpdate = mandalMembers.find((m) => m.id === memberId);

        // Find all pending/unpaid months where target wasn't met (or ₹0 paid)
        const pendingMonths: Month[] = (MONTHS as readonly Month[]).filter((month) => {
          const paid = memberToUpdate?.payments?.[month] || 0;
          const target = ["JUN", "JUL", "AUG"].includes(month) ? 200 : 100;
          return paid < target;
        });

        const currentExempt: Month[] = memberToUpdate?.exemptMonths || [];
        const updatedExempt = Array.from(new Set([...currentExempt, ...pendingMonths]));

        await updateDoc(doc(db, "mandal_members", memberId.toString()), {
          isRemoved: true,
          removedAt: new Date().toISOString(),
          exemptMonths: updatedExempt,
          preRemovalExemptMonths: currentExempt,
        });

        showToast(`${memberName} ko delete/remove kar diya gaya aur pending dues 0 (maaf) ho gaye! 🗑️`, 'success');
      } catch (error) {
        showToast("Error: Member remove nahi ho paya.", 'error');
      }
    });
  };

  const handleRestoreMember = async (memberId: number, memberName: string) => {
    try {
      const memberToRestore = mandalMembers.find((m) => m.id === memberId);
      const restoredExempt = memberToRestore?.preRemovalExemptMonths ?? [];

      await updateDoc(doc(db, "mandal_members", memberId.toString()), {
        isRemoved: false,
        exemptMonths: restoredExempt,
      });

      showToast(`${memberName} wapas active list me restore ho gaye! ✅`, 'success');
    } catch (error) {
      showToast("Error: Member restore nahi ho paya.", 'error');
    }
  };

  // ✅ Per-member month blocking — jab koi member baad me (mid-year) join karta hai, to
  // uske pichle (join se pehle wale) mahino ko individually block kar sakte hain, taaki
  // usse un mahino ka paisa na maanga jaye, bina baaki sabke liye wo mahina block kiye.
  // Uses arrayUnion/arrayRemove (atomic) instead of read-modify-write, so fast repeated
  // clicks on different months never overwrite each other with stale data.
  // Also updates local state immediately (optimistic) so mobile users see the tap
  // register instantly, instead of waiting for the Firestore snapshot to come back.
  const toggleMemberExemptMonth = async (member: any, month: string, aliases?: string[]) => {
    const keysToCheck = aliases && aliases.length > 0 ? aliases : [month];
    const isCurrentlyBlocked = (member.exemptMonths || []).some((m: string) =>
      keysToCheck.includes(m) || isMonthMatching({ periodKeyOrMonthKey: month }, m)
    );

    const updatedExempt = isCurrentlyBlocked
      ? (member.exemptMonths || []).filter((mo: string) =>
          !keysToCheck.includes(mo) && !isMonthMatching({ periodKeyOrMonthKey: month }, mo)
        )
      : Array.from(new Set([...(member.exemptMonths || []), month]));

    // Optimistic local update — instant visual feedback
    setMandalMembers((prev) =>
      prev.map((m) =>
        m.id === member.id
          ? {
            ...m,
            exemptMonths: updatedExempt,
          }
          : m
      )
    );

    try {
      await updateDoc(doc(db, "mandal_members", member.id.toString()), {
        exemptMonths: updatedExempt,
      });
      showToast(isCurrentlyBlocked ? `${month} unblock ho gaya ✅` : `${month} block ho gaya 🚫`, 'success');
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.code === 'cancelled') return;
      showToast("Error: Month block/unblock nahi ho paya.", 'error');
      setMandalMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, exemptMonths: member.exemptMonths || [] }
            : m
        )
      );
    }
  };

  const [expandedMemberForMonths, setExpandedMemberForMonths] = useState<number | null>(null);

  const handleRestoreOldData = async () => {
    askConfirm("Kya aap sach mein purana list wapas Firebase mein daalna chahte hain?", async () => {
      setIsRestoring(true);
      try {
        for (const member of DEFAULT_MEMBERS) {
          await setDoc(doc(db, "mandal_members", member.id.toString()), { id: member.id, name: member.name, payments: member.payments, isHonorary: member.isHonorary || false, createdAt: new Date().toISOString() });
        }
        showToast("Purana data restored! 📥", 'success');
      } catch (error) { showToast("Error: Data restore failed.", 'error'); }
      setIsRestoring(false);
    });
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalStorage = media.reduce((acc, curr) => acc + (curr.size || 0), 0);
  const totalVideos = media.filter(m => m.type === 'video').length;
  const bannedUsersCount = users.filter(u => u.isBanned).length;
  // ✅ Removed members are kept in the DB (soft-delete) so their payment history stays
  // intact for accounting — they're just filtered out of active lists/dropdowns/counts.
  const activeMandalMembers = mandalMembers.filter((member) => !member.isRemoved);
  const removedMandalMembers = mandalMembers.filter((member) => member.isRemoved);
  const payingMembersCount = activeMandalMembers.filter((member) => !member.isHonorary).length;
  const pendingChandaPayments = chandaPayments.filter((payment) => payment.status === 'Pending');
  const usersById = useMemo(() => {
    const lookup = new Map<string, any>();
    users.forEach((user) => {
      if (user.id) lookup.set(String(user.id).trim().toLowerCase(), user);
      if (user.uid) lookup.set(String(user.uid).trim().toLowerCase(), user);
      if (user.email) lookup.set(String(user.email).trim().toLowerCase(), user);
    });
    return lookup;
  }, [users]);

  const mergedChandaList = useMemo(() => {
    const ledgerMap: Record<string, any> = {};

    const resolveUser = (value: any) => {
      const lookupKey = String(value || '').trim().toLowerCase();
      return lookupKey ? usersById.get(lookupKey) : undefined;
    };

    const upsertEntry = (emailRaw: string, entry: any) => {
      const emailKey = String(emailRaw || '').trim().toLowerCase();
      if (!emailKey) return;

      const existing = ledgerMap[emailKey];
      if (!existing) {
        ledgerMap[emailKey] = {
          email: emailKey,
          name: entry.name,
          totalAmount: Number(entry.totalAmount) || 0,
          latestMessage: entry.latestMessage,
          lastUpdated: entry.lastUpdated,
        };
        return;
      }

      existing.totalAmount += Number(entry.totalAmount) || 0;
      if (!existing.name && entry.name) {
        existing.name = entry.name;
      }

      if (new Date(entry.lastUpdated).getTime() >= new Date(existing.lastUpdated).getTime()) {
        existing.latestMessage = entry.latestMessage;
        existing.lastUpdated = entry.lastUpdated;
      }
    };

    chandaPayments.forEach((payment) => {
      const paymentStatus = String(payment.status || '').trim().toLowerCase();
      if (paymentStatus && paymentStatus !== 'approved') return;

      const matchedUser = resolveUser(payment.userId || payment.userEmail || payment.email);
      const resolvedEmail = payment.userEmail || payment.email || matchedUser?.email || matchedUser?.id || matchedUser?.uid || payment.userId || payment.id;

      upsertEntry(resolvedEmail, {
        name: payment.userName || matchedUser?.name || 'Mandal Donor',
        totalAmount: Number(payment.amount) || 0,
        latestMessage: payment.message || 'Paid via Contribution Form',
        lastUpdated: toIsoDateString(payment.timestamp || payment.createdAt) || new Date().toISOString(),
      });
    });

    chandaList.forEach((item) => {
      const matchedUser = resolveUser(item.docIdKey || item.email || item.id);
      const resolvedEmail = item.email || matchedUser?.email || matchedUser?.id || item.docIdKey || item.id || '';

      upsertEntry(resolvedEmail, {
        name: item.name || matchedUser?.name || 'Mandal Member',
        totalAmount: item.totalAmount || item.total || item.amount || 0,
        latestMessage: item.latestMessage || item.message || 'Admin Dashboard Entry',
        lastUpdated: toIsoDateString(item.lastUpdated || item.timestamp) || new Date().toISOString(),
      });
    });

    return Object.values(ledgerMap).sort((a: any, b: any) => {
      const amountDiff = (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0);
      if (amountDiff !== 0) return amountDiff;
      return new Date(toIsoDateString(b.lastUpdated) || 0).getTime() - new Date(toIsoDateString(a.lastUpdated) || 0).getTime();
    });
  }, [chandaPayments, chandaList, usersById]);
  const userSelectOptions = users.map((u) => ({
    value: u.id,
    label: `${u.name ? String(u.name).toUpperCase() : 'UNKNOWN'} (${u.email || 'No Email'})`,
  }));

  const filteredUsers = users.filter(u => u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()));
  const uniqueUploaders = Array.from(new Set(media.map((m: any) => m.uploaderEmail))).filter(Boolean) as string[];

  const filteredVaultMedia = media.filter((item: any) => {
    const searchMatch = item.uploaderEmail?.toLowerCase().includes(vaultSearch.toLowerCase()) || (item.caption && item.caption.toLowerCase().includes(vaultSearch.toLowerCase()));
    const typeMatch = vaultType === 'all' ? true : vaultType === 'image' ? item.type?.startsWith('image') : item.type?.startsWith('video');
    const privacyMatch = vaultPrivacy === 'all' ? true : vaultPrivacy === 'private' ? item.isPrivate === true : item.isPrivate === false;
    const uploaderMatch = vaultUploader === 'all' ? true : item.uploaderEmail === vaultUploader;
    const itemDate = new Date(getTimestampMillis(item));
    const daysDiff = (new Date().getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
    let dateMatch = true;
    if (vaultDate === '7days') dateMatch = daysDiff <= 7;
    if (vaultDate === '30days') dateMatch = daysDiff <= 30;
    const captionMatch = vaultCaption === 'all' ? true : vaultCaption === 'has_caption' ? !!item.caption : !item.caption;
    return searchMatch && typeMatch && privacyMatch && uploaderMatch && dateMatch && captionMatch;
  }).sort((a: any, b: any) => {
    const timeA = getTimestampMillis(a);
    const timeB = getTimestampMillis(b);
    return vaultSort === 'newest' ? timeB - timeA : timeA - timeB;
  });

  useEffect(() => {
    if (activeTab !== 'media') return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleCount((prev) => prev + 20);
      },
      { rootMargin: '200px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [activeTab, visibleCount, filteredVaultMedia.length]);

  useEffect(() => {
    setVisibleCount(20);
  }, [vaultSearch, vaultType, vaultPrivacy, vaultSort, vaultUploader, vaultDate, vaultCaption]);

  const activeUsers = users.filter((user) => user.lastLogin);
  const failedAttemptUsers = users.filter((user) => (user.failedAttempts || 0) > 0);

  const handleRoleChange = async (uid: string, newRole: string) => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole, isBanned: newRole === 'Banned' });
      showToast(`Role updated to ${newRole} 👑`, 'success');
    } catch (error: any) { showToast(`Error updating role: ${error.message}`, 'error'); }
  };

  const handleApproveChanda = async (id: string) => {
    try {
      const paymentRef = doc(db, 'chanda_payments', id);
      const paymentSnap = await getDoc(paymentRef);
      if (!paymentSnap.exists()) {
        showToast('Payment record not found.', 'error');
        return;
      }
      const paymentData = paymentSnap.data();
      const amount = Number(paymentData.amount) || 0;
      const userName = (paymentData.userName || '').trim();
      const userEmail = (paymentData.userEmail || paymentData.userId || '').trim().toLowerCase();

      await updateDoc(paymentRef, { status: 'Approved' });

      // 1. Sync with mandal_chanda ledger
      if (userEmail && userEmail.includes('@')) {
        const chandaRef = doc(db, 'mandal_chanda', userEmail);
        const chandaSnap = await getDoc(chandaRef);
        const prevTotal = chandaSnap.exists()
          ? (Number(chandaSnap.data()?.totalAmount) || Number(chandaSnap.data()?.total) || 0)
          : 0;
        const nextTotal = prevTotal + amount;

        await setDoc(chandaRef, {
          email: userEmail,
          name: userName || 'Online Donor',
          photoURL: paymentData.userPhoto || null,
          totalAmount: nextTotal,
          total: nextTotal,
          latestMessage: paymentData.message || 'Online payment approved',
          lastUpdated: new Date().toISOString(),
          updatedBy: currentUserData?.email || 'admin',
        }, { merge: true });

        await setDoc(doc(db, 'mandal_chanda_logs', `${userEmail}_${Date.now()}`), {
          adminEmail: currentUserData?.email || 'admin',
          targetEmail: userEmail,
          amountAdded: amount,
          message: paymentData.message || 'Approved online contribution',
          timestamp: new Date().toISOString(),
        });
      }

      // 2. Sync with mandal_members ledger if donor is a member
      if (userName || userEmail) {
        const matchingMember = mandalMembers.find((m) => {
          if (userName && m.name && m.name.toLowerCase() === userName.toLowerCase()) return true;
          return false;
        });
        if (matchingMember) {
          const curMonth = getCurrentTrackingMonth();
          const curAmount = matchingMember.payments?.[curMonth] || 0;
          await updateDoc(doc(db, 'mandal_members', matchingMember.id.toString()), {
            [`payments.${curMonth}`]: curAmount + amount,
          });
          console.log(`✅ [AdminPanel] Synced ₹${amount} online payment to member ${matchingMember.name} for ${curMonth}`);
        }
      }

      showToast('Chanda approved successfully & synced! ✅', 'success');
      console.log(`✅ [AdminPanel] Successfully approved chanda_payment: ${id}`);
    } catch (error) {
      console.error('❌ [AdminPanel] Approve failed:', error);
      showToast('Unable to approve this payment.', 'error');
    }
  };

  const handleRejectChanda = async (id: string) => {
    askConfirm('Are you sure you want to reject this payment?', async () => {
      try {
        await updateDoc(doc(db, 'chanda_payments', id), { status: 'Rejected' });
        showToast('Payment marked as rejected.', 'success');
        console.log(`✅ [AdminPanel] Successfully rejected chanda_payment: ${id}`);
      } catch (error) {
        console.error('❌ [AdminPanel] Reject failed:', error);
        showToast('Unable to reject this payment.', 'error');
      }
    });
  };

  const handleAddChanda = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const targetUserData = users.find((u) => String(u.id) === String(selectedUserUid) || String(u.uid) === String(selectedUserUid));
    const targetEmail = targetUserData?.email?.trim().toLowerCase() || `${selectedUserUid}@mandal.com`;
    const amount = Number(chandaAmount);

    if (!selectedUserUid || !Number.isFinite(amount) || amount <= 0) {
      showToast('Sahi user aur amount bhariye!', 'error');
      return;
    }

    setIsChandaSubmitting(true);

    try {
      const chandaRef = doc(db, 'mandal_chanda', targetEmail);
      const chandaSnap = await getDoc(chandaRef);
      const now = toIsoFromDatetimeLocal(chandaDate);
      const existingData = chandaSnap.exists() ? (chandaSnap.data() as any) : null;
      const nextTotal = (Number(existingData?.totalAmount) || Number(existingData?.total) || 0) + amount;
      const targetName = targetUserData.name || existingData?.name || 'Anonymous Donor';

      await setDoc(chandaRef, {
        email: targetEmail,
        name: targetName,
        photoURL: targetUserData?.photoURL || targetUserData?.photo || null,
        totalAmount: nextTotal,
        total: nextTotal,
        latestMessage: chandaMessage.trim() || 'Additional payment added',
        lastUpdated: now,
        updatedBy: currentUserData?.email || 'admin',
      }, { merge: true });

      await setDoc(doc(db, 'mandal_chanda_logs', `${targetEmail}_${Date.now()}`), {
        adminEmail: currentUserData?.email || 'admin',
        targetEmail,
        amountAdded: amount,
        message: chandaMessage.trim() || 'Additional payment added',
        timestamp: now,
      });

      await addDoc(collection(db, 'chanda_payments'), {
        userId: targetEmail,
        userEmail: targetEmail,
        userName: targetName,
        userPhoto: targetUserData?.photoURL || null,
        amount: amount,
        message: chandaMessage.trim() || '',
        status: 'Approved',
        adminAdded: true,
        utr_number: `ADMIN-${Math.floor(100000 + Math.random() * 900000)}`,
        timestamp: new Date(now),
      });

      showToast(existingData ? `Amount updated to ₹${nextTotal}` : `Fresh chanda added for ${targetName}`, 'success');
      setSelectedUserUid('');
      setChandaAmount('');
      setChandaMessage('');
      setChandaDate(getLocalDatetimeString());
    } catch (error) {
      console.error('Error adding manual chanda entry:', error);
      showToast('Database me entry fail ho gayi.', 'error');
    } finally {
      setIsChandaSubmitting(false);
    }
  };

  const handleModalAdjust = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ledgerModalUser?.email) return;

    const amount = Number(adjAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      showToast('Please enter a valid adjustment amount.', 'error');
      return;
    }

    setIsAdjusting(true);
    const targetEmail = String(ledgerModalUser.email).trim().toLowerCase();
    const now = toIsoFromDatetimeLocal(adjDate);

    try {
      const chandaRef = doc(db, 'mandal_chanda', targetEmail);
      const chandaSnap = await getDoc(chandaRef);
      const existingDbTotal = chandaSnap.exists() ? (Number(chandaSnap.data().totalAmount) || 0) : 0;
      const nextDbTotal = existingDbTotal + amount;

      await setDoc(chandaRef, {
        email: targetEmail,
        name: ledgerModalUser.name,
        photoURL: ledgerModalUser.photo || null,
        totalAmount: nextDbTotal,
        total: nextDbTotal,
        latestMessage: adjRemark.trim() || (amount > 0 ? 'Amount Added' : 'Amount Deducted'),
        lastUpdated: now,
        updatedBy: currentUserData?.email || 'admin',
      }, { merge: true });

      await setDoc(doc(db, 'mandal_chanda_logs', `${targetEmail}_${Date.now()}`), {
        adminEmail: currentUserData?.email || 'admin',
        targetEmail,
        amountAdded: amount,
        message: adjRemark.trim() || (amount > 0 ? 'Amount Added' : 'Amount Deducted'),
        timestamp: now,
      });

      const newCombinedTotal = (Number(ledgerModalUser.totalAmount) || 0) + amount;

      // Also create a chanda_payments entry reflecting this admin adjustment
      try {
        await addDoc(collection(db, 'chanda_payments'), {
          userId: targetEmail,
          userEmail: targetEmail,
          userName: ledgerModalUser.name || targetEmail,
          userPhoto: ledgerModalUser.photo || null,
          amount: amount,
          message: adjRemark.trim() || (amount > 0 ? 'Admin Adjustment +' : 'Admin Adjustment -'),
          status: 'Approved',
          adminAdded: true,
          timestamp: new Date(now),
        });
        console.log(`✅ [AdminPanel] Created chanda_payments admin adjustment for ${targetEmail} amount ${amount}`);
      } catch (e) {
        console.warn('⚠️ [AdminPanel] Failed to create chanda_payments admin adjustment', e);
      }

      showToast(`Successfully ${amount > 0 ? 'added' : 'deducted'} ₹${Math.abs(amount)}`, 'success');
      setAdjAmount('');
      setAdjRemark('');
      setLedgerModalUser((prev: any) => (prev ? { ...prev, totalAmount: newCombinedTotal, latestMessage: adjRemark.trim() || (amount > 0 ? 'Amount Added' : 'Amount Deducted'), lastUpdated: now } : prev));
    } catch (error) {
      showToast('Error saving adjustment', 'error');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleDeleteLedgerEntry = async () => {
    if (!ledgerModalUser?.email) return;
    askConfirm(`"${ledgerModalUser.name}" ki poori entry permanently delete karein? Danveers board se hata diya jayega.`, async () => {
      try {
        const targetEmail = String(ledgerModalUser.email).trim().toLowerCase();
        await deleteDoc(doc(db, 'mandal_chanda', targetEmail));
        const [snapByEmail, snapByUserId] = await Promise.all([
          getDocs(query(collection(db, 'chanda_payments'), where('userEmail', '==', targetEmail))),
          getDocs(query(collection(db, 'chanda_payments'), where('userId', '==', targetEmail))),
        ]);
        const allPaymentDocs = new Map<string, any>();
        snapByEmail.docs.forEach((d) => allPaymentDocs.set(d.id, d));
        snapByUserId.docs.forEach((d) => allPaymentDocs.set(d.id, d));
        const batch = writeBatch(db);
        allPaymentDocs.forEach((paymentDoc) => batch.delete(paymentDoc.ref));
        await batch.commit();
        console.log(`✅ [AdminPanel] Hard-deleted ${allPaymentDocs.size} chanda_payments for ${targetEmail}`);
        try {
          const logsSnap = await getDocs(query(collection(db, 'mandal_chanda_logs'), where('targetEmail', '==', targetEmail)));
          if (!logsSnap.empty) {
            const logBatch = writeBatch(db);
            logsSnap.docs.forEach((d) => logBatch.delete(d.ref));
            await logBatch.commit();
          }
        } catch (e) {
          console.warn('⚠️ Log cleanup failed (non-critical)', e);
        }
        showToast('Entry fully deleted from Danveers board! 🗑️', 'success');
        setLedgerModalUser(null);
      } catch (error) {
        console.error('❌ [AdminPanel] Delete failed:', error);
        showToast('Failed to delete entry.', 'error');
      }
    });
  };

  const handleEditPayment = async (paymentId: string, newAmount: number) => {
    if (!paymentId || !Number.isFinite(newAmount) || newAmount < 0) return;

    setIsEditingPayment(true);
    try {
      await updateDoc(doc(db, 'chanda_payments', paymentId), { amount: Number(newAmount) });
      console.log(`✅ [AdminPanel] Updated chanda_payment ${paymentId} to ₹${newAmount}`);
      showToast(`Updated to ₹${newAmount}`, 'success');
      setEditingPaymentId(null);
      setTempPaymentAmount(0);
    } catch (error) {
      console.error('❌ [AdminPanel] Payment edit failed:', error);
      showToast('Failed to update payment.', 'error');
    } finally {
      setIsEditingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!paymentId) return;
    askConfirm('Is payment entry ko delete karein?', async () => {
      try {
        await deleteDoc(doc(db, 'chanda_payments', paymentId));
        console.log(`✅ [AdminPanel] Deleted chanda_payment ${paymentId}`);
        showToast('Payment deleted.', 'success');
      } catch (error) {
        console.error('❌ [AdminPanel] Payment delete failed:', error);
        showToast('Failed to delete payment.', 'error');
      }
    });
  };

  const deleteMedia = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!id) return;
    askConfirm('Is media ko Vault se permanently delete karein?', async () => {
      try {
        await deleteDoc(doc(db, 'mandal_gallery', id));
        if (selectedIndex !== null && filteredVaultMedia[selectedIndex]?.id === id) setSelectedIndex(null);
        showToast("Media deleted successfully! 🗑️", 'success');
      } catch (error: any) { showToast(`Error deleting file: ${error.message}`, 'error'); }
    });
  };

  const saveSettings = async (key: string, value: any) => {
    try {
      const newSettings = { ...settings, [key]: value };
      await setDoc(doc(db, 'mandal_settings', 'system'), newSettings, { merge: true });
      setSettings(newSettings);
      showToast("Settings Updated Successfully! ✅", 'success');
    } catch (error: any) { showToast(`Settings Error: ${error.message}`, 'error'); }
  };

  const getOptimizedMediaUrl = (url: string, type: string) => {
    if (!url || !url.includes('/upload/')) return url;
    if (type?.startsWith('video')) return url.replace(/\.[^/.]+$/, ".jpg").replace('/upload/', '/upload/q_auto:good,w_800/');
    return url.replace('/upload/', '/upload/q_auto:good,w_600/');
  };

  // VAULT LIGHTBOX SLIDER LOGIC
  const selectedMedia = selectedIndex !== null ? filteredVaultMedia[selectedIndex] : null;

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev !== null && prev < filteredVaultMedia.length - 1 ? prev + 1 : prev));
  }, [filteredVaultMedia.length]);
  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  }, []);
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (selectedIndex === null) return;
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'Escape') setSelectedIndex(null);
  }, [selectedIndex, handleNext, handlePrev]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!ledgerModalUser?.email) {
      setLedgerModalLogs([]);
      return;
    }

    const targetEmail = String(ledgerModalUser.email).trim().toLowerCase();
    const qLogs = query(collection(db, 'mandal_chanda_logs'), where('targetEmail', '==', targetEmail));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const manualLogs = snap.docs.map((d) => ({
        id: d.id,
        message: d.data().message,
        amountAdded: d.data().amountAdded,
        timestamp: toIsoDateString(d.data().timestamp) || new Date().toISOString(),
        type: 'Admin Entry',
      }));

      const portalLogs = chandaPayments
        .filter((payment) => {
          const paymentStatus = String(payment.status || '').trim().toLowerCase();
          if (paymentStatus && paymentStatus !== 'approved') return false;

          const paymentEmail = String(payment.userEmail || payment.email || payment.userId || '').trim().toLowerCase();
          return paymentEmail === targetEmail;
        })
        .map((payment) => ({
          id: `portal-${payment.id}`,
          message: payment.message || 'Contribute Portal',
          amountAdded: payment.amount,
          timestamp: toIsoDateString(payment.timestamp || payment.createdAt) || new Date().toISOString(),
          type: 'Portal Payment',
        }));

      const combined = [...manualLogs, ...portalLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLedgerModalLogs(combined);
    });

    return () => unsubLogs();
  }, [ledgerModalUser?.email, chandaPayments]);

  useEffect(() => {
    if (!ledgerModalUser) return;
    setAdjDate(getLocalDatetimeString());
    setAdjAmount('');
    setAdjRemark('');
  }, [ledgerModalUser?.email]);

  const handleTouchStart = (e: React.TouchEvent) => { setTouchStart(e.targetTouches[0].clientX); setIsSwiping(true); };
  const handleTouchMove = (e: React.TouchEvent) => { if (!touchStart) return; setSwipeOffset(e.targetTouches[0].clientX - touchStart); };
  const handleTouchEnd = () => {
    if (!touchStart) return;
    setIsSwiping(false);
    if (swipeOffset > 60) {
      lastSwipeTime.current = Date.now();
      handlePrev();
    } else if (swipeOffset < -60) {
      lastSwipeTime.current = Date.now();
      handleNext();
    }
    setSwipeOffset(0); setTouchStart(0);
  };

  const resetAllAttempts = async () => {
    try {
      for (const user of users) {
        if (user.failedAttempts > 0) {
          await updateDoc(doc(db, 'users', user.uid), { failedAttempts: 0 });
        }
      }
      showToast("All failed attempts reset! 🛡️", 'success');
    } catch (err) { }
  };

  if (adminUser?.role?.toLowerCase() !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-500 animate-fade-in">
        <ShieldAlert className="w-16 h-16 mb-4 opacity-50" />
        <h2 className="text-2xl font-black text-center">Admin Access Only</h2>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-20 relative">
      {/* ✅ Confirm Dialog — replaces window.confirm */}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={() => { setConfirmModal(null); confirmModal.onConfirm(); }}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {toastMsg && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-2xl text-xs font-bold text-white flex items-center gap-2.5 transition-all animate-in fade-in slide-in-from-top-4 duration-200 ${toastMsg.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          <span>{toastMsg.text}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-[10px] font-black"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sticky Navbar */}
      <div className="border-b border-gray-200 pb-2 sticky top-[48px] sm:top-[60px] bg-gray-50/95 backdrop-blur-xl z-20 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-[#5A0000] leading-none" style={{ fontFamily: "'Gotu', sans-serif" }}>God Mode</h2>
            <Key className="w-3 h-3 text-yellow-500 hidden sm:block" />
          </div>
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[9px] sm:text-[10px] font-black rounded uppercase tracking-wider">Level 10 Admin</span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {adminTabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === tab.id ? "bg-gradient-to-r from-[#5A0000] to-[#7B0000] text-white shadow-md" : "bg-white border border-gray-200 text-gray-500 hover:bg-red-50"}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ============================== */}
      {/* TAB 1: OVERVIEW (ANALYTICS) */}
      {activeTab === "analytics" && (
        <div className="space-y-3 animate-fade-in">
          {/* Needs Attention Card */}
          {(pendingChandaPayments.length > 0 || bannedUsersCount > 0) && (
            <div className="bg-gradient-to-r from-amber-500/10 via-red-500/10 to-amber-500/10 border border-amber-300/80 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black uppercase text-amber-950 tracking-tight">Needs Attention</h4>
                  <p className="text-[10px] sm:text-xs text-amber-900 font-bold mt-0.5">
                    {pendingChandaPayments.length > 0 && `${pendingChandaPayments.length} pending chanda approval(s)`}
                    {pendingChandaPayments.length > 0 && bannedUsersCount > 0 && ' • '}
                    {bannedUsersCount > 0 && `${bannedUsersCount} banned user(s)`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                {pendingChandaPayments.length > 0 && (
                  <button
                    onClick={() => { setActiveTab('finance'); setFinanceSubTab('seasons'); }}
                    className="px-2.5 py-1 rounded-lg bg-[#5A0000] text-white text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-xs hover:bg-[#7b0000] transition-colors cursor-pointer"
                  >
                    Review Approvals
                  </button>
                )}
                {bannedUsersCount > 0 && (
                  <button
                    onClick={() => setActiveTab('users')}
                    className="px-2.5 py-1 rounded-lg bg-white border border-gray-300 text-gray-800 text-[10px] sm:text-xs font-black uppercase tracking-wider hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    View Users
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <StatCard
              label="Total Users"
              value={users.length}
              icon={<User className="w-3.5 h-3.5" />}
              colorTheme="info"
              onClick={() => setActiveTab('users')}
            />
            <StatCard
              label="Total Media"
              value={media.length}
              subtext={`(${totalVideos} Vids)`}
              icon={<ImageIcon className="w-3.5 h-3.5" />}
              colorTheme="success"
              onClick={() => setActiveTab('media')}
            />
            <StatCard
              label="Cloud Used"
              value={formatBytes(totalStorage)}
              icon={<Database className="w-3.5 h-3.5" />}
              colorTheme="maroon"
            />
            <StatCard
              label="Banned Users"
              value={bannedUsersCount}
              icon={<Ban className="w-3.5 h-3.5" />}
              colorTheme={bannedUsersCount > 0 ? "danger" : "neutral"}
              onClick={() => setActiveTab('users')}
            />
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* TAB 2: USERS */}
      {activeTab === "users" && (
        <div className="space-y-3 animate-fade-in">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm font-bold outline-none focus:border-[#5A0000]"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            {filteredUsers.map((user) => (
              <div key={user.id || user.uid || user.email} className={`bg-white rounded-xl border ${user.isBanned ? 'border-red-200 bg-red-50/50' : 'border-gray-100 shadow-2xs'} p-2.5 sm:p-3 flex items-center justify-between gap-2.5`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  {(user.photoURL || user.photo) ? (
                    <img
                      src={user.photoURL || user.photo}
                      alt={user.name || 'User'}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-gray-200 shrink-0"
                    />
                  ) : (
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full flex items-center justify-center font-bold text-white text-xs ${user.role === 'Admin' ? 'bg-amber-500' : user.isBanned ? 'bg-red-500' : 'bg-[#5A0000]'}`}>
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-xs sm:text-sm truncate flex items-center gap-1.5 leading-tight">
                      {user.name || 'Unknown User'} {user.uid === adminUser?.uid && <span className="text-[9px] bg-gray-200 px-1 py-0.2 rounded text-gray-700 font-bold">YOU</span>}
                    </p>
                    <p className="text-[10px] sm:text-xs font-medium text-gray-400 truncate flex items-center gap-1 mt-0.5"><Mail className="w-2.5 h-2.5 shrink-0" /> {user.email || 'No email'}</p>
                    {user.lastLogin && (
                      <p className="text-[9px] sm:text-[10px] text-gray-400 font-normal mt-0.5">
                        Active: {new Date(user.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Clean Role Selector (Member, Viewer, Admin only) */}
                  <div className="w-[95px] sm:w-[115px]">
                    <CustomSelect
                      value={user.role || 'Viewer'}
                      onChange={(val: string) => handleRoleChange(user.id || user.uid, val)}
                      options={[
                        { value: 'Viewer', label: 'Viewer' },
                        { value: 'Member', label: 'Member' },
                        { value: 'Admin', label: 'Admin' }
                      ]}
                      theme="light"
                    />
                  </div>

                  {/* Dedicated Ban / Unban Direct Button */}
                  {user.isBanned ? (
                    <button
                      onClick={() => {
                        askConfirm(`${user.name || 'Is user'} ko unban karein?`, () => handleRoleChange(user.id || user.uid, 'Viewer'));
                      }}
                      className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                      title="Unban User"
                      aria-label="Unban User"
                    >
                      <RefreshCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        askConfirm(`${user.name || 'Is user'} ko ban karein? Banned user portal access nahi kar sakega.`, () => handleRoleChange(user.id || user.uid, 'Banned'));
                      }}
                      className="p-1.5 sm:p-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                      title="Ban User"
                      aria-label="Ban User"
                    >
                      <Ban className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* TAB: CONSOLIDATED FINANCE HUB */}
      {(activeTab === 'finance' || activeTab === 'seasons' || activeTab === 'chanda') && (
        <div className="space-y-3 animate-fade-in">
          {/* Secondary Sub-Navigation for Finance Hub */}
          <div className="flex gap-1.5 p-1 bg-gray-100/90 rounded-2xl overflow-x-auto custom-scrollbar border border-gray-200/80">
            <button
              onClick={() => setFinanceSubTab('seasons')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                financeSubTab === 'seasons'
                  ? 'bg-[#5A0000] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              Chanda Seasons & Schedule
            </button>
            <button
              onClick={() => setFinanceSubTab('danveers_ledger')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                financeSubTab === 'danveers_ledger'
                  ? 'bg-[#5A0000] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Danveers, Manual Ledger & Payments Feed
            </button>
          </div>

          {/* Sub-view 1: Seasons Manager */}
          {financeSubTab === 'seasons' && (
            <AdminSeasonManager
              currentUserData={adminUser}
              onShowToast={setToastMsg}
              askConfirm={askConfirm}
              pendingChandaPayments={pendingChandaPayments}
              onApproveChanda={handleApproveChanda}
              onRejectChanda={handleRejectChanda}
              mandalMembers={mandalMembers}
              onAddMember={handleAddMember}
              newMemberName={newMemberName}
              setNewMemberName={setNewMemberName}
              isNewMemberHonorary={isNewMemberHonorary}
              setIsNewMemberHonorary={setIsNewMemberHonorary}
              onRemoveMember={handleRemoveMember}
              onRestoreMember={handleRestoreMember}
              onToggleMemberExemptMonth={toggleMemberExemptMonth}
            />
          )}

          {/* Sub-view 2: Combined Danveers Board, Manual Ledger Entry & Payments Feed */}
          {financeSubTab === 'danveers_ledger' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Row 1: Add Entry Form (Left) + Danveers Board Control (Right) */}
              <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
                {/* Form: Add Manual Contribution */}
                <div className="rounded-2xl border border-gray-200/90 bg-white p-3.5 sm:p-4 shadow-xs lg:col-span-1 h-fit space-y-3">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
                    <div className="w-7 h-7 rounded-xl bg-red-50 text-[#5a0000] flex items-center justify-center">
                      <PlusCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-gray-900">Add Manual Entry</h3>
                      <p className="text-[10px] text-gray-500 font-normal">Directly record cash/offline chanda</p>
                    </div>
                  </div>

                  <form onSubmit={handleAddChanda} className="space-y-2.5">
                    <div>
                      <label className="mb-1 ml-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Registered User</label>
                      <SearchableSelect
                        value={selectedUserUid}
                        onChange={setSelectedUserUid}
                        options={userSelectOptions}
                        placeholder="Select Registered User"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 ml-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Amount (₹) *</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={chandaAmount}
                          onChange={(e) => setChandaAmount(e.target.value)}
                          placeholder="101"
                          className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs font-bold text-gray-900 outline-none transition-all focus:border-[#5a0000] focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 ml-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Remark / Note</label>
                        <input
                          type="text"
                          value={chandaMessage}
                          onChange={(e) => setChandaMessage(e.target.value)}
                          placeholder="Note..."
                          className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs font-medium text-gray-900 outline-none transition-all focus:border-[#5a0000] focus:bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 ml-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Date & Time</label>
                      <input
                        type="datetime-local"
                        value={chandaDate}
                        onChange={(e) => setChandaDate(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs font-semibold text-gray-900 outline-none transition-all focus:border-[#5a0000] focus:bg-white"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isChandaSubmitting}
                      className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#5a0000] px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white shadow-2xs transition-all hover:bg-[#7b0000] disabled:opacity-50 active:scale-95 cursor-pointer"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      {isChandaSubmitting ? 'Saving...' : 'Save Contribution'}
                    </button>
                  </form>
                </div>

                {/* Danveers Board Control */}
                <div className="rounded-2xl border border-yellow-200/90 bg-gradient-to-br from-yellow-50/50 to-orange-50/30 shadow-xs lg:col-span-2 overflow-hidden flex flex-col">
                  <div className="flex flex-row items-center justify-between gap-2 border-b border-yellow-100 bg-yellow-100/50 px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-yellow-500/20 text-yellow-800 flex items-center justify-center">
                        <Coins className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-yellow-900">Danveers Board Control</h3>
                        <p className="text-[10px] text-yellow-700/80 font-normal">All-time donor leaderboard</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-yellow-800 bg-yellow-200/60 px-2 py-0.5 rounded-full border border-yellow-300/60">
                      {mergedChandaList.length} Donors
                    </span>
                  </div>

                  <div className="max-h-[320px] flex-1 overflow-y-auto custom-scrollbar p-2.5 sm:p-3 space-y-1.5">
                    {mergedChandaList.length === 0 ? (
                      <div className="py-8 text-center text-xs font-semibold uppercase tracking-wider text-yellow-600/60">No donors recorded yet.</div>
                    ) : (
                      mergedChandaList.map((donor: any, idx: number) => (
                        <div key={donor.email || idx} className="flex items-center justify-between gap-2 rounded-xl border border-yellow-100 bg-white px-3 py-2 shadow-2xs hover:shadow-xs transition-shadow">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-300'}`}>
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-900 truncate">{donor.name || 'Anonymous'}</p>
                              <p className="text-[10px] text-gray-400 font-normal truncate">{donor.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg">
                              ₹{Number(donor.totalAmount || 0).toLocaleString('en-IN')}
                            </span>
                            <button
                              onClick={() => setLedgerModalUser(donor)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
                              title="View / Edit / Adjust"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                const targetEmail = String(donor.email || '').trim().toLowerCase();
                                if (!targetEmail) { showToast('No email found for this donor.', 'error'); return; }
                                askConfirm(`${donor.name} ko Danveers board se delete karein? Yeh wapas nahi aayega.`, async () => {
                                  try {
                                    await deleteDoc(doc(db, 'mandal_chanda', targetEmail));
                                    const [s1, s2] = await Promise.all([
                                      getDocs(query(collection(db, 'chanda_payments'), where('userEmail', '==', targetEmail))),
                                      getDocs(query(collection(db, 'chanda_payments'), where('userId', '==', targetEmail))),
                                    ]);
                                    const allDocs = new Map<string, any>();
                                    s1.docs.forEach((d) => allDocs.set(d.id, d));
                                    s2.docs.forEach((d) => allDocs.set(d.id, d));
                                    if (allDocs.size > 0) {
                                      const b = writeBatch(db);
                                      allDocs.forEach((d) => b.delete(d.ref));
                                      await b.commit();
                                    }
                                    showToast(`${donor.name} removed from Danveers board! 🗑️`, 'success');
                                  } catch (e) {
                                    showToast('Delete failed. Try again.', 'error');
                                  }
                                });
                              }}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                              title="Delete from Danveers board"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Chanda Payments Real-Time Feed (Full width) */}
              <div className="rounded-2xl border border-gray-200/90 bg-white shadow-xs overflow-hidden flex flex-col">
                <div className="flex flex-row items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">Real-Time Payments Feed</h3>
                      <p className="text-[10px] text-gray-500 font-normal">Approved chanda transaction history</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full border border-gray-200">
                    Total: {chandaPayments.filter(p => p.status === 'Approved').length} Approved
                  </span>
                </div>

                <div className="max-h-[360px] flex-1 overflow-y-auto custom-scrollbar p-2.5 sm:p-0">
                  {chandaPayments.filter(p => p.status === 'Approved').length === 0 ? (
                    <div className="py-8 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">No payments recorded yet.</div>
                  ) : (
                    <>
                      {/* Mobile View: Stacked Cards (sm:hidden) */}
                      <div className="space-y-2 sm:hidden">
                        {chandaPayments.filter(p => p.status === 'Approved').map((payment) => (
                          <div key={payment.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50/70 space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-gray-900 block truncate">{payment.userName || payment.userId || 'N/A'}</span>
                                <span className="text-[10px] text-gray-400 truncate block">{payment.userEmail || payment.email || 'Email missing'}</span>
                              </div>
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
                                ₹{Number(payment.amount || 0).toLocaleString('en-IN')}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-normal text-gray-500 pt-1.5 border-t border-gray-100">
                              <span>
                                {payment.timestamp?.toDate ? payment.timestamp.toDate().toLocaleDateString('en-IN') + ' ' + payment.timestamp.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => { setEditingPaymentId(payment.id); setTempPaymentAmount(Number(payment.amount || 0)); }}
                                  className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-semibold hover:bg-blue-100 cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeletePayment(payment.id)}
                                  className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-[10px] font-semibold hover:bg-red-100 cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop View: Table (hidden sm:table) */}
                      <table className="hidden sm:table w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50/80 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                            <th className="p-2.5 w-8">#</th>
                            <th className="p-2.5">User</th>
                            <th className="p-2.5">Email</th>
                            <th className="p-2.5 text-right">Amount</th>
                            <th className="p-2.5 text-right">Date & Time</th>
                            <th className="p-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {chandaPayments.filter(p => p.status === 'Approved').map((payment, idx) => (
                            <tr key={payment.id} className="hover:bg-gray-50/80 transition-colors">
                              <td className="p-2.5 text-[10px] font-mono text-gray-400">{idx + 1}</td>
                              <td className="p-2.5 text-xs font-semibold text-gray-900 truncate">{payment.userName || payment.userId || 'N/A'}</td>
                              <td className="p-2.5 text-xs text-gray-500 truncate">{payment.userEmail || payment.email || 'Email missing'}</td>
                              <td className="p-2.5 text-right">
                                {editingPaymentId === payment.id ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <input
                                      type="number"
                                      value={tempPaymentAmount}
                                      onChange={(e) => setTempPaymentAmount(Number(e.target.value))}
                                      className="w-20 px-2 py-0.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-900 outline-none focus:border-[#5a0000]"
                                    />
                                    <button
                                      onClick={() => handleEditPayment(payment.id, tempPaymentAmount)}
                                      disabled={isEditingPayment}
                                      className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 cursor-pointer"
                                      aria-label="Confirm"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingPaymentId(null)}
                                      className="p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 cursor-pointer"
                                      aria-label="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="font-bold text-emerald-700 text-xs">₹{Number(payment.amount || 0).toLocaleString('en-IN')}</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right">
                                <div className="text-xs font-medium text-gray-700">
                                  {payment.timestamp?.toDate ? (
                                    <>
                                      {payment.timestamp.toDate().toLocaleDateString('en-IN')}<br />
                                      <span className="text-[10px] text-gray-400 font-normal">
                                        {payment.timestamp.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </>
                                  ) : (
                                    'N/A'
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5 text-right space-x-1.5">
                                {editingPaymentId !== payment.id && (
                                  <>
                                    <button
                                      onClick={() => { setEditingPaymentId(payment.id); setTempPaymentAmount(Number(payment.amount || 0)); }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
                                    >
                                      <Edit3 className="w-3 h-3" /> Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeletePayment(payment.id)}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[10px] font-semibold hover:bg-red-100 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================== */}
      {/* TAB: BUILDING MANAGEMENT */}
      {activeTab === 'buildings' && (
        <AdminBuildingManager onShowToast={setToastMsg} askConfirm={askConfirm} />
      )}

      {/* ============================== */}
      {/* TAB: MEDIA / VAULT */}
      {activeTab === 'media' && (
        <div className="animate-in fade-in duration-300 space-y-3.5">
          <div className="relative z-50 bg-[#1a0505]/80 backdrop-blur-xl border border-yellow-500/30 p-3 rounded-xl shadow-lg">
            <div className="flex flex-col gap-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500/50" />
                <input type="text" placeholder="Search by email or caption..." value={vaultSearch} onChange={(e) => setVaultSearch(e.target.value)} className="w-full bg-black/40 border border-yellow-500/20 rounded-lg py-2 pl-9 pr-3 text-xs text-yellow-100 placeholder-yellow-100/30 outline-none focus:border-yellow-400 transition-all shadow-inner" />
              </div>

              {/* VAULT FILTERS (Responsive Grid on Mobile) */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2">
                <div className="min-w-0">
                  <CustomSelect value={vaultType} onChange={setVaultType} options={[{ value: 'all', label: 'All Media' }, { value: 'image', label: 'Images' }, { value: 'video', label: 'Videos' }]} theme="dark" />
                </div>
                <div className="min-w-0">
                  <CustomSelect value={vaultPrivacy} onChange={setVaultPrivacy} options={[{ value: 'all', label: 'All Privacy' }, { value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }]} theme="dark" />
                </div>
                <div className="min-w-0">
                  <CustomSelect value={vaultSort} onChange={setVaultSort} options={[{ value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }]} theme="dark" />
                </div>
                <div className="min-w-0">
                  <CustomSelect value={vaultUploader} onChange={setVaultUploader} options={[{ value: 'all', label: 'All Uploaders' }, ...uniqueUploaders.map(email => ({ value: email, label: email?.split('@')[0] }))]} theme="dark" />
                </div>
                <div className="col-span-2 sm:col-span-1 min-w-0">
                  <CustomSelect value={vaultDate} onChange={setVaultDate} options={[{ value: 'all', label: 'All Time' }, { value: '7days', label: '7 Days' }, { value: '30days', label: '30 Days' }]} theme="dark" />
                </div>
              </div>
            </div>
          </div>

          {/* 2-col on Mobile, 3-5 col on Desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
            {filteredVaultMedia.length === 0 ? (
              <div className="col-span-full py-10 text-center border border-white/5 rounded-xl bg-white/5 backdrop-blur-sm">
                <p className="text-yellow-100/50 text-xs font-bold uppercase tracking-widest">No media matches your filters</p>
                <button onClick={() => { setVaultSearch(''); setVaultType('all'); setVaultPrivacy('all'); setVaultSort('newest'); setVaultUploader('all'); setVaultDate('all'); setVaultCaption('all'); }} className="mt-3 text-xs text-yellow-500 hover:text-yellow-400 underline underline-offset-4 cursor-pointer">
                  Clear All Filters
                </button>
              </div>
            ) : (
              filteredVaultMedia.slice(0, visibleCount).map((item: any, index: number) => (
                <div key={item.id} onClick={() => setSelectedIndex(index)} className="relative group rounded-xl overflow-hidden border border-yellow-500/20 aspect-square bg-black shadow-md hover:shadow-[0_0_15px_rgba(202,138,4,0.3)] transition-all cursor-pointer">
                  {item.type?.startsWith('video') ? (
                    <>
                      <img src={getOptimizedMediaUrl(item.url, item.type)} className="w-full h-full object-cover" alt="video" loading="lazy" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20"><div className="rounded-full bg-black/40 backdrop-blur-md p-1.5"><Play className="w-3.5 h-3.5 sm:w-5 sm:h-5 fill-white text-white" /></div></div>
                    </>
                  ) : (
                    <img src={getOptimizedMediaUrl(item.url, item.type)} alt="Vault Media" className="w-full h-full object-cover" loading="lazy" />
                  )}

                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 backdrop-blur-[2px]">
                    <div className="flex justify-between items-start gap-1 w-full">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] sm:text-[10px] bg-black/60 text-yellow-400 px-1 py-0.5 rounded backdrop-blur-md border border-yellow-500/30 truncate max-w-[70px] sm:max-w-[90px]" title={item.uploaderEmail}>{item.uploaderEmail?.split('@')[0]}</span>
                        {item.caption && <span className="text-[9px] text-white/70 truncate max-w-[80px] italic">&quot;{item.caption}&quot;</span>}
                      </div>
                      <button onClick={(e) => deleteMedia(item.id, e)} className="bg-red-500/80 hover:bg-red-600 text-white p-1 rounded border border-red-400/50 transition-colors shadow-sm cursor-pointer" aria-label="Delete media"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    {item.isPrivate && <div className="self-end bg-gradient-to-r from-yellow-600 to-yellow-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-md"><Lock className="w-2.5 h-2.5" /> Private</div>}
                  </div>
                </div>
              ))
            )}
          </div>

          {filteredVaultMedia.length > visibleCount && (
            <div ref={loadMoreRef} className="w-full flex justify-center py-6 relative z-10">
              <div className="w-6 h-6 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin"></div>
            </div>
          )}

          {selectedMedia && (
            <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-xl animate-fade-in touch-none">
              <div className="absolute top-0 w-full p-4 flex justify-between items-start z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <div className="flex flex-col pointer-events-auto">
                  <span className="text-white font-black uppercase tracking-widest text-sm">{selectedMedia.uploadedBy}</span>
                  <span className="text-gray-400 text-[10px] font-bold uppercase">{new Date(selectedMedia.createdAt).toLocaleString()} • {selectedMedia.category || 'Event'}</span>
                </div>
                <button onClick={() => setSelectedIndex(null)} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all pointer-events-auto"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 relative flex items-center overflow-hidden touch-none" onClick={() => setSelectedIndex(null)} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
                <div className="absolute top-[15%] bottom-[15%] left-0 w-[30%] z-[45]" onClick={(e) => { e.stopPropagation(); if (Date.now() - lastSwipeTime.current < 300) return; handlePrev(); }} />
                <div className="absolute top-[15%] bottom-[15%] right-0 w-[30%] z-[45]" onClick={(e) => { e.stopPropagation(); if (Date.now() - lastSwipeTime.current < 300) return; handleNext(); }} />
                <button onClick={handlePrev} className="absolute left-4 z-50 p-3 bg-white/5 text-white rounded-full hover:bg-white/20 transition-all hidden sm:block"><ChevronLeft className="w-6 h-6" /></button>
                <div className="flex w-full h-full items-center will-change-transform" style={{ transform: `translate3d(calc(-${(selectedIndex || 0) * 100}% + ${swipeOffset}px), 0, 0)`, transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}>
                  {filteredVaultMedia.map((item: any, index: number) => {
                    const isNear = Math.abs(index - (selectedIndex || 0)) <= 1;
                    return (
                      <div key={item.id} className="min-w-full h-full flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
                        {isNear ? (
                          item.type?.startsWith('video') ? (
                            index === selectedIndex ? (
                              <div className="relative w-full h-full flex items-center justify-center bg-black">
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="w-10 h-10 border-4 border-white/10 border-t-yellow-500 rounded-full animate-spin"></div>
                                </div>

                                <video
                                  ref={videoRef}
                                  src={item.url}
                                  poster={getOptimizedMediaUrl(item.url, item.type)}
                                  playsInline
                                  loop
                                  onClick={togglePlayPause}
                                  onTimeUpdate={handleTimeUpdate}
                                  className="max-h-full max-w-full object-contain pointer-events-auto rounded-xl shadow-2xl border border-white/10 relative z-10 bg-black/50"
                                  style={{ willChange: 'transform', transform: 'translate3d(0,0,0)' }}
                                />
                                {!isPlaying && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                    <div className="bg-black/50 backdrop-blur-sm rounded-full p-4"><Play className="w-12 h-12 text-white fill-white" /></div>
                                  </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-40">
                                  <div className="h-full bg-white transition-all duration-75" style={{ width: `${progress}%` }} />
                                </div>
                              </div>
                            ) : (
                              <div className="relative flex items-center justify-center max-h-full max-w-full rounded-xl overflow-hidden">
                                <img src={getOptimizedMediaUrl(item.url, item.type)} className="max-h-full max-w-full object-contain" alt="video-poster" />
                                <Play className="absolute w-16 h-16 text-white/70" />
                              </div>
                            )
                          ) : (
                            <img src={item.url} className="max-h-full max-w-full object-contain select-none rounded-xl shadow-2xl border border-white/10 pointer-events-none" alt="fullscreen" />
                          )
                        ) : (<div className="w-full h-full" />)}
                      </div>
                    );
                  })}
                </div>
                <button onClick={handleNext} className="absolute right-4 z-50 p-3 bg-white/5 text-white rounded-full hover:bg-white/20 transition-all hidden sm:block"><ChevronRight className="w-6 h-6" /></button>
              </div>

              <div className="w-full bg-black/80 p-4 pb-8 sm:pb-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 z-50">
                <button onClick={(e) => deleteMedia(selectedMedia.id, e)} className="flex items-center justify-center gap-2 w-full sm:w-auto p-2.5 px-4 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/20 active:scale-95">
                  <Trash2 className="w-4 h-4" /> <span className="font-bold text-[10px] uppercase tracking-widest hidden sm:block">Delete memory</span>
                </button>
                <div className="flex gap-2 w-full sm:w-auto">
                  <a href={selectedMedia.url.replace('/upload/', '/upload/q_auto:eco,w_1080/')} target="_blank" download className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white text-[10px] font-bold uppercase tracking-widest transition-all border border-white/10 shadow-sm" style={{ color: 'beige' }}>
                    <Smartphone className="w-3.5 h-3.5" /> WhatsApp Size
                  </a>
                  <a href={selectedMedia.url} target="_blank" download style={{ color: '#000000' }} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-yellow-500 !text-black text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95">
                    <Download className="w-3.5 h-3.5 !text-black" stroke="black" /> Original HD
                  </a>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {ledgerModalUser && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="relative border-b border-gray-100 px-5 py-4 sm:px-6">
              <div className="absolute right-4 top-4 flex gap-2">
                <button
                  onClick={handleDeleteLedgerEntry}
                  className="rounded-full bg-red-50 p-2 text-red-600 shadow-sm transition-colors hover:bg-red-100 hover:text-red-700"
                  title="Delete Entry completely"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLedgerModalUser(null)}
                  className="rounded-full bg-gray-100 p-2 text-gray-600 transition-colors hover:bg-red-100 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h2 className="pr-20 text-lg font-black uppercase tracking-wide text-gray-900 sm:text-xl">
                {ledgerModalUser.name || 'Anonymous'}
              </h2>
              <p className="mt-1 text-xs font-bold text-gray-400">{ledgerModalUser.email}</p>
            </div>

            <div className="border-b border-gray-100 bg-gradient-to-r from-green-50 to-emerald-50 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-green-200 bg-white px-4 py-3 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-widest text-green-800">Total Value</span>
                <span className="text-2xl font-black text-green-700">
                  ₹{Number(ledgerModalUser.totalAmount || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <form onSubmit={handleModalAdjust} className="border-b border-gray-100 px-5 py-4 sm:px-6">
              <div className="mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#5a0000]">Modify Amount (+ or -)</h3>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="number"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  placeholder="e.g. 500 or -100"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-black outline-none focus:border-[#5a0000] focus:bg-white"
                  required
                />
                <input
                  type="text"
                  value={adjRemark}
                  onChange={(e) => setAdjRemark(e.target.value)}
                  placeholder="Reason / Remark"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-black outline-none focus:border-[#5a0000] focus:bg-white"
                  required
                />
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  type="datetime-local"
                  value={adjDate}
                  onChange={(e) => setAdjDate(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[11px] font-bold text-gray-700 outline-none focus:border-[#5a0000] focus:bg-white"
                  required
                />
                <button
                  type="submit"
                  disabled={isAdjusting}
                  className="rounded-xl bg-[#5a0000] px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-md transition-colors hover:bg-[#7b0000] disabled:opacity-50 active:scale-95"
                >
                  {isAdjusting ? 'Saving...' : 'Update'}
                </button>
              </div>
            </form>

            <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                <History className="h-3.5 w-3.5 text-gray-500" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-700">Transaction History</h3>
              </div>
              <div className="space-y-2">
                {ledgerModalLogs.length === 0 ? (
                  <p className="py-6 text-center text-xs font-bold italic text-gray-400">No history found.</p>
                ) : (
                  ledgerModalLogs.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-3 transition-all hover:bg-white hover:shadow-sm">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold text-gray-800">{log.message}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                          <span>{new Date(log.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="h-1 w-1 rounded-full bg-gray-300" />
                          <span>{log.type}</span>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-black ${Number(log.amountAdded) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {Number(log.amountAdded) > 0 ? '+' : ''}{log.amountAdded}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* TAB: WEBSITE SETTINGS */}
      {activeTab === "settings" && (
        <div className="space-y-3 animate-fade-in max-w-2xl">
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-100 shadow-2xs space-y-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2 text-xs sm:text-sm">
              <Shield className="w-4 h-4 text-[#5A0000]" /> Anti-Leak & Downloads
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-bold text-gray-800">Allow HD Downloads</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Members can download original high quality media files</p>
              </div>
              <button
                onClick={() => saveSettings('hdDownloads', !settings.hdDownloads)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${settings.hdDownloads ? 'bg-emerald-500' : 'bg-gray-300'}`}
                aria-label="Toggle HD downloads"
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.hdDownloads ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "profile" && (
        <div className="animate-in fade-in zoom-in duration-300">
          {adminUser ? <UserProfile userData={adminUser} /> : <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-500 shadow-sm">Loading profile...</div>}
        </div>
      )}
    </div>
  );
}