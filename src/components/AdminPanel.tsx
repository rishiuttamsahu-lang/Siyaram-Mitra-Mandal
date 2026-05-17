"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, getDoc } from 'firebase/firestore';
import UserProfile from '@/components/UserProfile';
import {
  Shield, ShieldAlert, Ban, RefreshCcw, Key, Mail, User, Image as ImageIcon,
  BarChart2, Settings, Lock, Activity, Database, AlertTriangle, Trash2, Search, Bell, UserCircle, CheckCircle2,
  Play, ChevronLeft, ChevronRight, X, Download, Smartphone, Unlock, ChevronDown, Coins, PlusCircle, ArrowUpRight, History
} from 'lucide-react';

// 🔥 THE NEW PREMIUM CUSTOM SELECT COMPONENT
const CustomSelect = ({ value, onChange, options, placeholder, theme = 'light' }: { value: any, onChange: any, options: any[], placeholder?: string, theme?: 'light' | 'dark' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const isDark = theme === 'dark';
  
  const triggerDark = `bg-[#2a0808]/90 backdrop-blur-md border border-yellow-500/20 px-3 sm:px-4 py-2 sm:py-2.5 text-[9px] sm:text-[10px] font-black text-yellow-100 uppercase tracking-widest hover:bg-[#3a0a0a] ${isOpen ? 'border-yellow-400 ring-1 ring-yellow-400/50' : ''}`;
  const triggerLight = `bg-gray-50 border border-gray-200 px-3 py-2 sm:py-2.5 text-[10px] sm:text-[11px] font-bold text-gray-800 hover:bg-gray-100 shadow-sm ${isOpen ? 'border-[#5A0000] ring-1 ring-[#5A0000]/30' : ''}`;
  const dropdownDark = "bg-[#1a0505] border border-yellow-500/20 shadow-2xl";
  const dropdownLight = "bg-white border border-gray-100 shadow-xl";

  const getOptionClass = (isSelected: boolean) => {
    if (isDark) return isSelected ? 'bg-yellow-500/20 text-yellow-400' : 'text-yellow-100 hover:bg-[#2a0808]';
    return isSelected ? 'bg-red-50 text-[#5A0000]' : 'text-gray-700 hover:bg-gray-50';
  };

  return (
    <div className={`relative w-full ${isOpen ? 'z-[100]' : 'z-10'}`} ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between w-full cursor-pointer select-none transition-all rounded-lg sm:rounded-xl outline-none ${isDark ? triggerDark : triggerLight}`}>
        <span className="truncate pr-4">{selectedOption ? selectedOption.label : (placeholder || 'Select...')}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''} ${isDark ? 'text-yellow-500/50' : 'text-gray-400'}`} />
      </div>

      {isOpen && (
        <div className={`absolute top-[calc(100%+6px)] left-0 min-w-full w-max rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[9999] ${isDark ? dropdownDark : dropdownLight}`}>
          <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
            {options.length === 0 ? (
              <div className={`px-4 py-3 text-[10px] italic text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No Options</div>
            ) : (
              options.map((opt, idx) => {
                const isSelected = String(value) === String(opt.value);
                return (
                  <div key={opt.value || `${opt.label}-${idx}`} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`px-4 py-3 cursor-pointer transition-colors text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-between ${getOptionClass(isSelected)}`}>
                    <span className="whitespace-nowrap">{opt.label}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 ml-3 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SearchableSelect = ({ value, onChange, options, placeholder }: { value: string, onChange: (v: string) => void, options: { value: string, label: string }[], placeholder?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const filteredOptions = options.filter((opt) => opt.label.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className={`relative w-full ${isOpen ? 'z-[100]' : 'z-10'}`} ref={dropdownRef}>
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchTerm('');
        }}
        className="flex items-center justify-between w-full cursor-pointer select-none transition-all rounded-xl bg-white border border-gray-200 px-4 py-3 text-[10px] sm:text-[11px] font-bold text-black uppercase tracking-wider hover:bg-gray-100 shadow-sm"
      >
        <span className="truncate pr-4 text-black">{selectedOption ? selectedOption.label : (placeholder || 'Select...')}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''} text-gray-400`} />
      </div>

      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 min-w-full w-full bg-white border border-gray-100 shadow-2xl rounded-xl overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Type name or email to search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-black text-[11px] font-bold uppercase outline-none placeholder-gray-400 border-none ring-0 focus:ring-0"
              autoFocus
            />
          </div>

          <div className="max-h-52 overflow-y-auto custom-scrollbar py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase text-center">No matching member found</div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(value) === String(opt.value);
                return (
                  <div
                    key={opt.value || `${opt.label}-${idx}`}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`px-4 py-2.5 cursor-pointer transition-colors text-[10px] font-bold uppercase tracking-widest flex items-center justify-between ${isSelected ? 'bg-red-50 text-[#5A0000]' : 'text-black hover:bg-gray-50'}`}
                  >
                    <span className="whitespace-nowrap truncate pr-2">{opt.label}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#5A0000] shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const adminTabs = [
  { id: "analytics", label: "Stats", icon: <BarChart2 size={14} /> },
  { id: "users", label: "Users", icon: <User size={14} /> },
  { id: "finance", label: "Finance", icon: <Database size={14} /> },
  { id: "chanda", label: "Chanda Management", icon: <Coins size={14} /> },
  { id: "media", label: "Vault", icon: <ImageIcon size={14} /> },
  { id: "security", label: "Security", icon: <Shield size={14} /> },
  { id: "settings", label: "Website", icon: <Settings size={14} /> },
  { id: "profile", label: "Profile", icon: <UserCircle size={14} /> },
];

const MONTHLY_TARGET = 100;
const MONTHS = ["SEPT", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG"] as const;
type Month = (typeof MONTHS)[number];

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
  const [chandaList, setChandaList] = useState<any[]>([]);
  const [isChandaSubmitting, setIsChandaSubmitting] = useState(false);

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
    if (adminUser?.role !== 'Admin') return;

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
        return { id: data.id, name: data.name, payments: data.payments || {}, isHonorary: data.isHonorary || false };
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

  const handleRestoreOldData = async () => {
    if (!confirm("Kya aap sach mein purana list wapas Firebase mein daalna chahte hain?")) return;
    setIsRestoring(true);
    try {
      for (const member of DEFAULT_MEMBERS) {
        await setDoc(doc(db, "mandal_members", member.id.toString()), { id: member.id, name: member.name, payments: member.payments, isHonorary: member.isHonorary || false, createdAt: new Date().toISOString() });
      }
      showToast("Purana data restored! 📥", 'success');
    } catch (error) { showToast("Error: Data restore failed.", 'error'); }
    setIsRestoring(false);
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
  const payingMembersCount = mandalMembers.filter((member) => !member.isHonorary).length;
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
    const itemDate = new Date(item.timestamp?.seconds ? item.timestamp.seconds * 1000 : item.createdAt || 0);
    const daysDiff = (new Date().getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
    let dateMatch = true;
    if (vaultDate === '7days') dateMatch = daysDiff <= 7;
    if (vaultDate === '30days') dateMatch = daysDiff <= 30;
    const captionMatch = vaultCaption === 'all' ? true : vaultCaption === 'has_caption' ? !!item.caption : !item.caption;
    return searchMatch && typeMatch && privacyMatch && uploaderMatch && dateMatch && captionMatch;
  }).sort((a: any, b: any) => {
    const timeA = a.timestamp?.seconds || a.createdAt || 0;
    const timeB = b.timestamp?.seconds || b.createdAt || 0;
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
    try { await updateDoc(doc(db, 'chanda_payments', id), { status: 'Approved' }); showToast('Chanda approved successfully! ✅', 'success'); } 
    catch (error) { showToast('Unable to approve this payment.', 'error'); }
  };

  const handleRejectChanda = async (id: string) => {
    if (!window.confirm('Are you sure you want to reject this payment?')) return;
    try { await updateDoc(doc(db, 'chanda_payments', id), { status: 'Rejected' }); showToast('Payment marked as rejected.', 'success'); } 
    catch (error) { showToast('Unable to reject this payment.', 'error'); }
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
      const now = new Date().toISOString();
      const existingData = chandaSnap.exists() ? (chandaSnap.data() as any) : null;
      const nextTotal = (Number(existingData?.totalAmount) || Number(existingData?.total) || 0) + amount;
      const targetName = targetUserData.name || existingData?.name || 'Anonymous Donor';

      await setDoc(chandaRef, {
        email: targetEmail,
        name: targetName,
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

      showToast(existingData ? `Amount updated to ₹${nextTotal}` : `Fresh chanda added for ${targetName}`, 'success');
      setSelectedUserUid('');
      setChandaAmount('');
      setChandaMessage('Online Paid (Admin Entry)');
    } catch (error) {
      console.error('Error adding manual chanda entry:', error);
      showToast('Database me entry fail ho gayi.', 'error');
    } finally {
      setIsChandaSubmitting(false);
    }
  };

  const deleteMedia = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!id) return;
    if (confirm('Permanently delete this from the Vault?')) {
      try {
        await deleteDoc(doc(db, 'mandal_gallery', id));
        if (selectedIndex !== null && filteredVaultMedia[selectedIndex]?.id === id) setSelectedIndex(null);
        showToast("Media deleted successfully! 🗑️", 'success');
      } catch (error: any) { showToast(`Error deleting file: ${error.message}`, 'error'); }
    }
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
    } catch (err) {}
  };

  if (adminUser?.role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-500 animate-fade-in">
        <ShieldAlert className="w-16 h-16 mb-4 opacity-50" />
        <h2 className="text-2xl font-black text-center">Admin Access Only</h2>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-20 relative">
      {toastMsg && (
        <div className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-2xl text-xs font-bold text-white flex items-center gap-2 transition-all ${toastMsg.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toastMsg.text}
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
      {/* TAB 1: ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 animate-fade-in">
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-1"><span className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-400">Total Users</span><User className="w-3 h-3 text-blue-500" /></div>
            <span className="text-xl sm:text-2xl font-black text-gray-800">{users.length}</span>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-1"><span className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-400">Total Media</span><ImageIcon className="w-3 h-3 text-green-500" /></div>
            <span className="text-xl sm:text-2xl font-black text-gray-800">{media.length}</span>
            <p className="text-[8px] text-gray-400 font-bold">({totalVideos} Videos)</p>
          </div>
          <div className="bg-gradient-to-br from-[#5A0000] to-[#3a0000] p-3 sm:p-4 rounded-xl border border-red-900 shadow-md text-white">
            <div className="flex justify-between items-center mb-1"><span className="text-[9px] sm:text-[10px] uppercase font-bold text-red-200">Cloud Used</span><Database className="w-3 h-3 text-yellow-400" /></div>
            <span className="text-xl sm:text-2xl font-black text-yellow-400">{formatBytes(totalStorage)}</span>
          </div>
          <div className="bg-red-50 p-3 sm:p-4 rounded-xl border border-red-100 shadow-sm">
            <div className="flex justify-between items-center mb-1"><span className="text-[9px] sm:text-[10px] uppercase font-bold text-red-400">Banned</span><Ban className="w-3 h-3 text-red-500" /></div>
            <span className="text-xl sm:text-2xl font-black text-red-600">{bannedUsersCount}</span>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* TAB 2: USERS */}
      {activeTab === "users" && (
        <div className="space-y-3 animate-fade-in">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input type="text" placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm font-bold outline-none focus:border-[#5A0000]" />
          </div>

          <div className="grid grid-cols-1 gap-2">
            {filteredUsers.map((user) => (
              <div key={user.id || user.uid || user.email} className={`bg-white rounded-xl border ${user.isBanned ? 'border-red-200 bg-red-50' : 'border-gray-100 shadow-sm'} p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center font-black text-white text-xs sm:text-sm ${user.role === 'Admin' ? 'bg-yellow-500' : user.isBanned ? 'bg-red-500' : 'bg-[#5A0000]'}`}>
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-xs sm:text-sm truncate flex items-center gap-1.5">
                      {user.name || 'Unknown User'} {user.uid === adminUser?.uid && <span className="text-[7px] sm:text-[8px] bg-gray-200 px-1 py-0.5 rounded text-gray-600">YOU</span>}
                    </p>
                    <p className="text-[9px] sm:text-[10px] font-semibold text-gray-400 truncate flex items-center gap-1"><Mail className="w-2.5 h-2.5 shrink-0" /> {user.email || 'No email'}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${(user.failedAttempts || 0) >= 2 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>Attempts: {user.failedAttempts || 0}/3</span>
                      {user.lastLogin && <span className="text-[8px] text-gray-400 font-medium">Last Active: {new Date(user.lastLogin).toLocaleTimeString()}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0">
                  <div className="w-[120px]">
                    <CustomSelect 
                      value={user.role || 'Viewer'} 
                      onChange={(val: string) => handleRoleChange(user.id || user.uid, val)} 
                      options={[
                        { value: 'Viewer', label: 'Viewer' },
                        { value: 'Member', label: 'Member' },
                        { value: 'Admin', label: 'Admin' },
                        { value: 'Banned', label: 'Ban User' }
                      ]} 
                      theme="light" 
                    />
                  </div>
                  {user.isBanned && <button onClick={() => handleRoleChange(user.id || user.uid, 'Viewer')} className="p-2 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 shadow-sm" title="Unban User"><RefreshCcw className="w-4 h-4" /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* TAB: FINANCE */}
      {activeTab === 'finance' && (
        <div className="space-y-6 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm md:p-6 animate-in fade-in zoom-in duration-300 mt-4">

          <div className="mb-6 rounded-xl border border-yellow-400/50 bg-gradient-to-br from-yellow-50 to-orange-50 p-4 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-yellow-800">
              <CheckCircle2 className="h-5 w-5 text-yellow-600" /> Pending Chanda Approvals
            </h3>

            <div className="custom-scrollbar max-h-[300px] space-y-3 overflow-y-auto pr-2">
              {pendingChandaPayments.length === 0 ? (
                <div className="rounded-lg border border-yellow-200/50 bg-white/50 py-6 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-yellow-700/60">No pending approvals</p>
                </div>
              ) : (
                pendingChandaPayments.map((payment) => (
                  <div key={payment.id} className="flex flex-col justify-between gap-4 rounded-xl border border-yellow-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md md:flex-row md:items-center">

                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-black text-gray-800">{payment.userName || 'Unknown User'}</span>
                        <span className="rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 px-2 py-0.5 text-[10px] font-black text-white shadow-sm">₹{payment.amount || 0}</span>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        UTR: <span className="rounded bg-gray-100 px-1 py-0.5 text-gray-900">{payment.utr_number || 'N/A'}</span>
                      </p>
                      {payment.message && (
                        <p className="mt-2 rounded-lg border border-yellow-100/50 bg-yellow-50/50 p-2 text-[10px] italic text-gray-600">&quot;{payment.message}&quot;</p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => handleApproveChanda(payment.id)} className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-md transition-all hover:bg-green-700 active:scale-95 md:flex-none">Approve</button>
                      <button onClick={() => handleRejectChanda(payment.id)} className="flex-1 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-600 transition-all hover:bg-red-100 active:scale-95 md:flex-none">Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-4 border-b border-red-100 pb-4 md:flex-row md:items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-red-700">Manage Active Months:</span>
            <div className="flex flex-wrap gap-2">
              {MONTHS.map((month) => {
                const isBlocked = blockedMonths.includes(month);
                return (
                  <button key={month} type="button" onClick={() => toggleBlockMonth(month)} className={`rounded-full px-3 py-1 text-[10px] font-bold transition-colors md:text-xs ${isBlocked ? "bg-red-600 text-white shadow-inner" : "border border-red-200 bg-white text-red-600 hover:bg-red-100"}`}>
                    {month} {isBlocked ? "🚫" : ""}
                  </button>
                );
              })}
            </div>
            
            {mandalMembers.length === 0 && (
              <button onClick={handleRestoreOldData} disabled={isRestoring} className="ml-auto flex items-center gap-2 rounded-xl bg-yellow-500 px-4 py-2 text-xs font-bold text-yellow-900 shadow-sm hover:bg-yellow-400 disabled:opacity-50">
                {isRestoring ? 'Restoring...' : '📥 Restore Data'}
              </button>
            )}
            <p className="ml-auto hidden text-xs font-bold text-red-800 md:block">Paying Members: {payingMembersCount}</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="relative z-50 rounded-xl border border-red-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-red-800">Add / Update Payment</h3>
              <form onSubmit={handleLogPayment} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {/* 🔥 FINANCE SELECTS */}
                  <CustomSelect 
                    value={paymentMemberId} 
                    onChange={setPaymentMemberId} 
                    options={mandalMembers.map(m => ({ value: m.id, label: m.name }))} 
                    placeholder="Select Member" 
                    theme="light" 
                  />
                  <CustomSelect 
                    value={paymentMonth} 
                    onChange={setPaymentMonth} 
                    options={MONTHS.map(month => ({ value: month, label: month }))} 
                    theme="light" 
                  />
                </div>
                <div className="flex gap-2 mt-1">
                  <input min="1" className="w-full rounded-xl border border-gray-200 bg-gray-50 text-gray-900 p-2 text-sm outline-none focus:ring-1 focus:ring-[#5A0000] shadow-sm" placeholder="Amount" required type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                  <button type="submit" className="w-full rounded-xl bg-[#5a0000] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#7b0000] shadow-sm">Log Payment</button>
                </div>
              </form>
            </div>

            <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-red-800">Add New Member</h3>
              <form onSubmit={handleAddMember} className="flex flex-col gap-3">
                <input className="w-full rounded-xl border border-gray-200 bg-gray-50 text-gray-900 p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#5A0000] shadow-sm" placeholder="Enter Name (e.g. RAHUL)" required type="text" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 mt-1">
                  <input className="h-4 w-4 rounded border-gray-300 text-[#5A0000] focus:ring-[#5A0000]" type="checkbox" checked={isNewMemberHonorary} onChange={(e) => setIsNewMemberHonorary(e.target.checked)} />
                  Mark as Honorary member
                </label>
                <button type="submit" className="mt-auto rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-800 shadow-sm">Add to Mandal</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* TAB: CHANDA MANAGEMENT */}
      {activeTab === 'chanda' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 animate-in fade-in zoom-in duration-300 mt-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-1">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
              <PlusCircle className="h-5 w-5 text-[#5a0000]" />
              <h3 className="text-sm font-black uppercase tracking-wide text-gray-800">Add / Update Chanda</h3>
            </div>

            <form onSubmit={handleAddChanda} className="space-y-4">
              <div>
                <label className="mb-1 ml-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Registered User</label>
                <SearchableSelect
                  value={selectedUserUid}
                  onChange={setSelectedUserUid}
                  options={userSelectOptions}
                  placeholder="Select Registered User"
                />
              </div>

              <div>
                <label className="mb-1 ml-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={chandaAmount}
                  onChange={(e) => setChandaAmount(e.target.value)}
                  placeholder="101"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-bold text-black outline-none transition-all focus:border-[#5a0000] focus:bg-white"
                />
                <p className="mt-1 px-1 text-[9px] font-bold leading-tight text-gray-400">Same email again? The amount is added to the previous total.</p>
              </div>

              <div>
                <label className="mb-1 ml-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Remark</label>
                <input
                  type="text"
                  value={chandaMessage}
                  onChange={(e) => setChandaMessage(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-bold text-black outline-none transition-all focus:border-[#5a0000] focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={isChandaSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5a0000] px-4 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-[#7b0000] disabled:opacity-50"
              >
                <ArrowUpRight className="h-4 w-4" />
                {isChandaSubmitting ? 'Saving...' : 'Save Contribution'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm lg:col-span-2 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-gray-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-700">Live Chanda Ledger</h3>
              </div>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-green-800">
                ₹{mergedChandaList.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0).toLocaleString('en-IN')} Total
              </span>
            </div>

            <div className="max-h-[480px] overflow-x-auto custom-scrollbar">
              {mergedChandaList.length === 0 ? (
                <div className="py-14 text-center text-xs font-bold uppercase tracking-widest text-gray-400">No manual chanda entries yet.</div>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[9px] font-black uppercase tracking-wider text-gray-400">
                      <th className="p-4 text-left">Member</th>
                      <th className="p-4 text-left">Latest Remark</th>
                      <th className="p-4 text-center">Total</th>
                      <th className="p-4 text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {mergedChandaList.map((entry) => (
                      <tr key={entry.email || entry.id || entry.name} className="transition-colors hover:bg-gray-50/70">
                        <td className="p-4">
                          <p className="font-black uppercase tracking-wide text-gray-900">{entry.name || 'Anonymous Donor'}</p>
                          <p className="mt-0.5 text-[10px] font-bold text-gray-400">{entry.email}</p>
                        </td>
                        <td className="max-w-[220px] p-4 italic text-gray-500">&ldquo;{entry.latestMessage || 'No note'}&rdquo;</td>
                        <td className="p-4 text-center">
                          <span className="rounded-xl border border-green-100 bg-green-50 px-2.5 py-1 text-xs font-black text-green-700">
                            ₹{Number(entry.totalAmount || 0).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="p-4 text-right text-[10px] font-bold text-gray-400">
                          {formatLedgerDate(entry.lastUpdated)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* TAB 3: MEDIA / VAULT */}
      {activeTab === 'media' && (
        <div className="animate-in fade-in zoom-in duration-300 space-y-6">
          <div className="relative z-50 bg-[#1a0505]/80 backdrop-blur-xl border border-yellow-500/30 p-4 rounded-2xl shadow-lg">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500/50" />
                <input type="text" placeholder="Search by email or caption..." value={vaultSearch} onChange={(e) => setVaultSearch(e.target.value)} className="w-full bg-black/40 border border-yellow-500/20 rounded-xl py-2.5 pl-10 pr-4 text-sm text-yellow-100 placeholder-yellow-100/30 outline-none focus:border-yellow-400 transition-all shadow-inner" />
              </div>

              {/* 🔥 VAULT PREMIUM SELECTS (DARK MODE) */}
              <div className="flex flex-wrap gap-2 md:gap-3">
                <div className="flex-1 sm:flex-none min-w-[120px]">
                  <CustomSelect value={vaultType} onChange={setVaultType} options={[{value: 'all', label: 'All Media'}, {value: 'image', label: 'Images Only'}, {value: 'video', label: 'Videos Only'}]} theme="dark" />
                </div>
                <div className="flex-1 sm:flex-none min-w-[120px]">
                  <CustomSelect value={vaultPrivacy} onChange={setVaultPrivacy} options={[{value: 'all', label: 'All Privacy'}, {value: 'public', label: 'Public'}, {value: 'private', label: 'Private'}]} theme="dark" />
                </div>
                <div className="flex-1 sm:flex-none min-w-[120px]">
                  <CustomSelect value={vaultSort} onChange={setVaultSort} options={[{value: 'newest', label: 'Newest'}, {value: 'oldest', label: 'Oldest'}]} theme="dark" />
                </div>
                <div className="flex-1 sm:flex-none min-w-[130px]">
                  <CustomSelect value={vaultUploader} onChange={setVaultUploader} options={[{value: 'all', label: 'All Uploaders'}, ...uniqueUploaders.map(email => ({ value: email, label: email?.split('@')[0] }))]} theme="dark" />
                </div>
                <div className="flex-1 sm:flex-none min-w-[130px]">
                  <CustomSelect value={vaultDate} onChange={setVaultDate} options={[{value: 'all', label: 'All Time'}, {value: '7days', label: 'Last 7 Days'}, {value: '30days', label: 'Last 30 Days'}]} theme="dark" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
            {filteredVaultMedia.length === 0 ? (
              <div className="col-span-full py-12 text-center border border-white/5 rounded-2xl bg-white/5 backdrop-blur-sm">
                <p className="text-yellow-100/50 text-sm font-bold uppercase tracking-widest">No media matches your filters</p>
                <button onClick={() => { setVaultSearch(''); setVaultType('all'); setVaultPrivacy('all'); setVaultSort('newest'); setVaultUploader('all'); setVaultDate('all'); setVaultCaption('all'); }} className="mt-4 text-xs text-yellow-500 hover:text-yellow-400 underline underline-offset-4">
                  Clear All Filters
                </button>
              </div>
            ) : (
              filteredVaultMedia.slice(0, visibleCount).map((item: any, index: number) => (
                <div key={item.id} onClick={() => setSelectedIndex(index)} className="relative group rounded-xl overflow-hidden border border-yellow-500/20 aspect-square bg-black shadow-lg hover:shadow-[0_0_15px_rgba(202,138,4,0.3)] transition-all cursor-pointer">
                  {item.type?.startsWith('video') ? (
                    <>
                      <img src={getOptimizedMediaUrl(item.url, item.type)} className="w-full h-full object-cover" alt="video" loading="lazy" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20"><div className="rounded-full bg-black/40 backdrop-blur-md p-2"><Play className="w-4 h-4 sm:w-6 sm:h-6 fill-white text-white" /></div></div>
                    </>
                  ) : (
                    <img src={getOptimizedMediaUrl(item.url, item.type)} alt="Vault Media" className="w-full h-full object-cover" loading="lazy" />
                  )}

                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 sm:p-3 backdrop-blur-[2px]">
                    <div className="flex justify-between items-start gap-2 w-full">
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] sm:text-[10px] bg-black/60 text-yellow-400 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded backdrop-blur-md border border-yellow-500/30 truncate max-w-[80px] sm:max-w-[100px]" title={item.uploaderEmail}>{item.uploaderEmail?.split('@')[0]}</span>
                        {item.caption && <span className="text-[8px] text-white/70 truncate max-w-[100px] italic">&quot;{item.caption}&quot;</span>}
                      </div>
                      <button onClick={(e) => deleteMedia(item.id, e)} className="bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded border border-red-400/50 transition-colors shadow-sm"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    {item.isPrivate && <div className="self-end bg-gradient-to-r from-yellow-600 to-yellow-400 text-black text-[8px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex items-center gap-1 shadow-md"><Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Private</div>}
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

      {/* ============================== */}
      {/* TAB 4 & 5 (Security & Settings) untouched as they don't have dropdowns */}
      {activeTab === "security" && (
        <div className="space-y-3 animate-fade-in">
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="font-black text-gray-800 flex items-center gap-2 mb-3 text-sm"><AlertTriangle className="w-4 h-4 text-orange-500"/> Security Monitors</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-800">Auto-Ban System</p>
                  <p className="text-[9px] text-gray-500">Blocks after 3 failed passcodes</p>
                </div>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[8px] font-bold rounded uppercase">Active</span>
              </div>

              <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-800">Security Override</p>
                  <p className="text-[9px] text-gray-500">Reset failed attempt counters</p>
                </div>
                <button onClick={resetAllAttempts} className="px-2 py-1.5 bg-gray-800 text-white text-[9px] font-bold rounded hover:bg-black">Reset</button>
              </div>
            </div>
          </div>
          <div className="bg-[#1a0505] p-3 sm:p-4 rounded-xl shadow-xl border border-red-900/50 max-h-60 overflow-y-auto">
            <p className="text-red-400 font-bold mb-2 flex items-center gap-1.5 text-xs"><Activity className="w-3 h-3"/> Real Activity Stream</p>
            <div className="space-y-1.5 font-mono text-[9px] sm:text-[10px]">
              {activeUsers.map((user) => <p key={user.id || user.uid || user.email || user.lastLogin} className="text-gray-300"><span className="text-green-500">[{new Date(user.lastLogin).toLocaleTimeString()}]</span> {user.name} logged into the portal.</p>)}
            </div>
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="space-y-3 animate-fade-in">
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
            <h3 className="font-black text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2 text-sm"><Lock className="w-4 h-4 text-[#5A0000]"/> Access Rules</h3>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Secret Mandal Passcode</label>
              <div className="flex mt-1 gap-2">
                <input type="text" value={localPasscode} onChange={(e) => setLocalPasscode(e.target.value)} className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-[#5A0000]" />
                <button onClick={() => saveSettings('secretPasscode', localPasscode)} className="px-3 py-1.5 bg-[#5A0000] text-white font-bold text-[10px] rounded-lg shadow-md hover:bg-red-900">Update</button>
              </div>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-black text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2 text-sm"><Shield className="w-4 h-4 text-[#5A0000]"/> Anti-Leak & Downloads</h3>
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-bold text-gray-800">Allow HD Downloads</p></div>
              <button onClick={() => saveSettings('hdDownloads', !settings.hdDownloads)} className={`w-8 h-4 rounded-full transition-colors relative ${settings.hdDownloads ? 'bg-green-500' : 'bg-gray-300'}`}><div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${settings.hdDownloads ? 'translate-x-4' : 'translate-x-0.5'}`}></div></button>
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
