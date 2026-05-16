"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, getDoc } from 'firebase/firestore';
import UserProfile from '@/components/UserProfile';
import {
  Shield, ShieldAlert, Ban, RefreshCcw, Key, Mail, User, Image as ImageIcon,
  BarChart2, Settings, Lock, Activity, Database, AlertTriangle, Trash2, Search, Bell, UserCircle, CheckCircle2,
  Play, ChevronLeft, ChevronRight, X, Download, Smartphone, Unlock // 🔥 NAYE IMPORTS ADD KIYE
} from 'lucide-react';

const adminTabs = [
  { id: "analytics", label: "Stats", icon: <BarChart2 size={14} /> },
  { id: "users", label: "Users", icon: <User size={14} /> },
  { id: "finance", label: "Finance", icon: <Database size={14} /> },
  { id: "media", label: "Vault", icon: <ImageIcon size={14} /> },
  { id: "security", label: "Security", icon: <Shield size={14} /> },
  { id: "settings", label: "Website", icon: <Settings size={14} /> },
  { id: "profile", label: "Profile", icon: <UserCircle size={14} /> },
];

const MONTHLY_TARGET = 100;
const MONTHS = [
  "SEPT", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG",
] as const;
type Month = (typeof MONTHS)[number];

function normalizeMemberCode(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}
function getCurrentTrackingMonth(): Month {
  const jsMonths: Month[] = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEPT", "OCT", "NOV", "DEC",
  ];
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

export default function AdminPanel({ currentUserData }: { currentUserData: any }) {
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

  // 🔥 VAULT SLIDER STATES
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const [settings, setSettings] = useState<any>({
    watermarkEnabled: true,
    hdDownloads: true,
    secretPasscode: "siyaram2026",
    announcement: "",
    notifications: [],
  });

  useEffect(() => {
    if (currentUserData?.role !== 'Admin') return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const fetchedUsers = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      fetchedUsers.sort((a, b) => {
        const roleOrder: any = { 'Admin': 1, 'Member': 2, 'Viewer': 3, 'Banned': 4 };
        return (roleOrder[a.role] || 5) - (roleOrder[b.role] || 5);
      });
      setUsers(fetchedUsers);
    });

    const qMedia = query(collection(db, 'mandal_gallery'), orderBy('createdAt', 'desc'));
    const unsubMedia = onSnapshot(qMedia, (snap) => {
      setMedia(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });

    const qChandaPayments = query(collection(db, 'chanda_payments'), orderBy('timestamp', 'desc'));
    const unsubChandaPayments = onSnapshot(qChandaPayments, (snap) => {
      setChandaPayments(snap.docs.map((chandaDoc) => ({ id: chandaDoc.id, ...(chandaDoc.data() as any) })));
    });

    const checkAndFetchSettings = async () => {
      const settingsRef = doc(db, 'mandal_settings', 'system');
      const snap = await getDoc(settingsRef);
      if (!snap.exists()) {
        await setDoc(settingsRef, {
          watermarkEnabled: true,
          hdDownloads: true,
          secretPasscode: "siyaram2026",
        });
      }
    };
    checkAndFetchSettings();

    const unsubConfig = onSnapshot(doc(db, 'mandal_settings', 'system'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings(data);
        setLocalPasscode(data.secretPasscode || "siyaram2026");
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
        };
      });
      fetchedMembers.sort((a, b) => a.id - b.id);
      setMandalMembers(fetchedMembers);
    });

    const unsubConfigBlock = onSnapshot(doc(db, "mandal_settings", "config"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().blockedMonths) {
        setBlockedMonths(docSnap.data().blockedMonths);
      }
    });

    return () => { 
      unsubUsers(); 
      unsubMedia(); 
      unsubChandaPayments();
      unsubConfig(); 
      unsubMandalMembers();
      unsubConfigBlock();
    };
  }, [currentUserData?.role]);

  const toggleBlockMonth = async (month: Month) => {
    const newBlocked = blockedMonths.includes(month)
      ? blockedMonths.filter((m) => m !== month)
      : [...blockedMonths, month];
    await setDoc(doc(db, "mandal_settings", "config"), { blockedMonths: newBlocked }, { merge: true });
  };

  const handleLogPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const memberId = Number(paymentMemberId);
    const amount = Number(paymentAmount);
    if (!Number.isFinite(memberId) || !Number.isFinite(amount) || amount <= 0) {
      showToast("Please choose a member and enter a valid amount.", 'error');
      return;
    }
    const memberToUpdate = mandalMembers.find(m => m.id === memberId);
    if (!memberToUpdate) return;
    const currentAmount = memberToUpdate.payments[paymentMonth] || 0;
    await updateDoc(doc(db, "mandal_members", memberId.toString()), {
      [`payments.${paymentMonth}`]: currentAmount + amount
    });
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
    if (alreadyExists) {
      showToast("Member already exists.", 'error');
      return;
    }
    const nextId = mandalMembers.length > 0 ? Math.max(...mandalMembers.map((member) => member.id)) + 1 : 1;
    await setDoc(doc(db, "mandal_members", nextId.toString()), {
      id: nextId,
      name: trimmedName.toUpperCase(),
      payments: {},
      isHonorary: isNewMemberHonorary,
      createdAt: new Date().toISOString()
    });
    setNewMemberName("");
    setIsNewMemberHonorary(false);
    showToast(`Member Added! 🎉`, 'success');
  };

  const handleRestoreOldData = async () => {
    if (!confirm("Kya aap sach mein purana list wapas Firebase mein daalna chahte hain?")) return;
    setIsRestoring(true);
    try {
      for (const member of DEFAULT_MEMBERS) {
        await setDoc(doc(db, "mandal_members", member.id.toString()), {
          id: member.id,
          name: member.name,
          payments: member.payments,
          isHonorary: member.isHonorary || false,
          createdAt: new Date().toISOString()
        });
      }
      showToast("Purana data restored! 📥", 'success');
    } catch (error) {
      console.error(error);
      showToast("Error: Data restore failed.", 'error');
    }
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

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const uniqueUploaders = Array.from(new Set(media.map((m: any) => m.uploaderEmail))).filter(Boolean) as string[];

  const filteredVaultMedia = media.filter((item: any) => {
    const searchMatch = item.uploaderEmail?.toLowerCase().includes(vaultSearch.toLowerCase()) ||
                        (item.caption && item.caption.toLowerCase().includes(vaultSearch.toLowerCase()));

    const typeMatch = vaultType === 'all' ? true :
                      vaultType === 'image' ? item.type?.startsWith('image') :
                      item.type?.startsWith('video');

    const privacyMatch = vaultPrivacy === 'all' ? true :
                         vaultPrivacy === 'private' ? item.isPrivate === true :
                         item.isPrivate === false;

    const uploaderMatch = vaultUploader === 'all' ? true : item.uploaderEmail === vaultUploader;

    const itemDate = new Date(item.timestamp?.seconds ? item.timestamp.seconds * 1000 : item.createdAt || 0);
    const now = new Date();
    const daysDiff = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
    let dateMatch = true;
    if (vaultDate === '7days') dateMatch = daysDiff <= 7;
    if (vaultDate === '30days') dateMatch = daysDiff <= 30;

    const captionMatch = vaultCaption === 'all' ? true :
                         vaultCaption === 'has_caption' ? !!item.caption :
                         !item.caption;

    return searchMatch && typeMatch && privacyMatch && uploaderMatch && dateMatch && captionMatch;
  }).sort((a: any, b: any) => {
    const timeA = a.timestamp?.seconds || a.createdAt || 0;
    const timeB = b.timestamp?.seconds || b.createdAt || 0;
    return vaultSort === 'newest' ? timeB - timeA : timeA - timeB;
  });

  const activeUsers = users.filter((user) => user.lastLogin);
  const failedAttemptUsers = users.filter((user) => (user.failedAttempts || 0) > 0);

  const handleRoleChange = async (uid: string, newRole: string) => {
    if (!uid) return;
    try {
      const isBanned = newRole === 'Banned';
      await updateDoc(doc(db, 'users', uid), {
        role: newRole,
        isBanned: isBanned
      });
      showToast(`Role updated to ${newRole} 👑`, 'success');
    } catch (error: any) {
      showToast(`Error updating role: ${error.message}`, 'error');
    }
  };

  const handleApproveChanda = async (id: string) => {
    try {
      await updateDoc(doc(db, 'chanda_payments', id), { status: 'Approved' });
      showToast('Chanda approved successfully! ✅', 'success');
    } catch (error) {
      showToast('Unable to approve this payment.', 'error');
    }
  };

  const handleRejectChanda = async (id: string) => {
    if (!window.confirm('Are you sure you want to reject this payment?')) return;
    try {
      await updateDoc(doc(db, 'chanda_payments', id), { status: 'Rejected' });
      showToast('Payment marked as rejected.', 'success');
    } catch (error) {
      showToast('Unable to reject this payment.', 'error');
    }
  };

  const deleteMedia = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!id) return;
    if (confirm('Permanently delete this from the Vault?')) {
      try {
        await deleteDoc(doc(db, 'mandal_gallery', id));
        if (selectedIndex !== null && filteredVaultMedia[selectedIndex]?.id === id) {
          setSelectedIndex(null);
        }
        showToast("Media deleted successfully! 🗑️", 'success');
      } catch (error: any) {
        showToast(`Error deleting file: ${error.message}`, 'error');
      }
    }
  };

  const saveSettings = async (key: string, value: any) => {
    try {
      const newSettings = { ...settings, [key]: value };
      await setDoc(doc(db, 'mandal_settings', 'system'), newSettings, { merge: true });
      setSettings(newSettings);
      showToast("Settings Updated Successfully! ✅", 'success');
    } catch (error: any) {
      showToast(`Settings Error: ${error.message}`, 'error');
    }
  };

  const resetAllAttempts = () => {
    showToast("Feature integrated with backend later.", 'success');
  };

  // 🔥 VAULT LIGHTBOX SLIDER LOGIC
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

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setIsSwiping(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    setSwipeOffset(e.targetTouches[0].clientX - touchStart);
  };
  const handleTouchEnd = () => {
    if (!touchStart) return;
    setIsSwiping(false);
    if (swipeOffset > 60) handlePrev();
    else if (swipeOffset < -60) handleNext();
    setSwipeOffset(0);
    setTouchStart(0);
  };


  if (currentUserData?.role !== 'Admin') {
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
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-[#5A0000] to-[#7B0000] text-white shadow-md"
                  : "bg-white border border-gray-200 text-gray-500 hover:bg-red-50"
              }`}
            >
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
            <input
              type="text"
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm font-bold outline-none focus:border-[#5A0000]"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            {filteredUsers.map((user) => (
              <div key={user.uid} className={`bg-white rounded-xl border ${user.isBanned ? 'border-red-200 bg-red-50' : 'border-gray-100 shadow-sm'} p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center font-black text-white text-xs sm:text-sm ${user.role === 'Admin' ? 'bg-yellow-500' : user.isBanned ? 'bg-red-500' : 'bg-[#5A0000]'}`}>
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-xs sm:text-sm truncate flex items-center gap-1.5">
                          {user.name || 'Unknown User'} {user.uid === currentUserData.uid && <span className="text-[7px] sm:text-[8px] bg-gray-200 px-1 py-0.5 rounded text-gray-600">YOU</span>}
                    </p>
                        <p className="text-[9px] sm:text-[10px] font-semibold text-gray-400 truncate flex items-center gap-1"><Mail className="w-2.5 h-2.5 shrink-0" /> {user.email || 'No email'}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${(user.failedAttempts || 0) >= 2 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                        Attempts: {user.failedAttempts || 0}/3
                      </span>
                      {user.lastLogin && (
                        <span className="text-[8px] text-gray-400 font-medium">
                          Last Active: {new Date(user.lastLogin).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0">
                  <select
                        value={user.role || 'Viewer'}
                        onChange={(e) => handleRoleChange(user.id || user.uid, e.target.value)}
                        className="bg-gray-50 border border-gray-200 text-[10px] sm:text-xs font-bold rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#5A0000] cursor-pointer"
                  >
                    <option value="Viewer">Viewer</option>
                    <option value="Member">Member</option>
                    <option value="Admin">Admin</option>
                    <option value="Banned">Ban User</option>
                  </select>

                  {user.isBanned && (
                    <button onClick={() => handleRoleChange(user.id || user.uid, 'Viewer')} className="p-1.5 bg-green-100 text-green-700 rounded-md hover:bg-green-200" title="Unban User">
                      <RefreshCcw className="w-3 h-3" />
                    </button>
                  )}
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
                        <span className="rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
                          ₹{payment.amount || 0}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        UTR:{' '}
                        <span className="rounded bg-gray-100 px-1 py-0.5 text-gray-900">
                          {payment.utr_number || 'N/A'}
                        </span>
                      </p>
                      {payment.message && (
                        <p className="mt-2 rounded-lg border border-yellow-100/50 bg-yellow-50/50 p-2 text-[10px] italic text-gray-600">
                          &quot;{payment.message}&quot;
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => handleApproveChanda(payment.id)}
                        className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-md transition-all hover:bg-green-700 active:scale-95 md:flex-none"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectChanda(payment.id)}
                        className="flex-1 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-600 transition-all hover:bg-red-100 active:scale-95 md:flex-none"
                      >
                        Reject
                      </button>
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
                  <button 
                    key={month} 
                    type="button" 
                    onClick={() => toggleBlockMonth(month)} 
                    className={`rounded-full px-3 py-1 text-[10px] font-bold transition-colors md:text-xs ${
                      isBlocked
                        ? "bg-red-600 text-white shadow-inner"
                        : "border border-red-200 bg-white text-red-600 hover:bg-red-100"
                    }`}
                  >
                    {month} {isBlocked ? "🚫" : ""}
                  </button>
                );
              })}
            </div>
            
            {mandalMembers.length === 0 && (
              <button
                onClick={handleRestoreOldData}
                disabled={isRestoring}
                className="ml-auto flex items-center gap-2 rounded-xl bg-yellow-500 px-4 py-2 text-xs font-bold text-yellow-900 shadow-sm hover:bg-yellow-400 disabled:opacity-50"
              >
                {isRestoring ? 'Restoring...' : '📥 Restore Data'}
              </button>
            )}
            
            <p className="ml-auto hidden text-xs font-bold text-red-800 md:block">Paying Members: {payingMembersCount}</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-red-800">Add / Update Payment</h3>
              <form onSubmit={handleLogPayment} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select 
                    className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm outline-none focus:ring-2 focus:ring-red-500" 
                    value={paymentMemberId}
                    onChange={(e) => setPaymentMemberId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select Member</option>
                    {mandalMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <select 
                    className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
                    value={paymentMonth}
                    onChange={(e) => setPaymentMonth(e.target.value as Month)}
                  >
                    {MONTHS.map((month) => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input min="1" className="w-full rounded-lg border border-gray-200 p-2 text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="Amount" required type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                  <button type="submit" className="w-full rounded-lg bg-[#5a0000] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#7b0000]">Log Payment</button>
                </div>
              </form>
            </div>

            <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-red-800">Add New Member</h3>
              <form onSubmit={handleAddMember} className="flex flex-col gap-3">
                <input className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="Enter Name (e.g. RAHUL)" required type="text" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                  <input className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" type="checkbox" checked={isNewMemberHonorary} onChange={(e) => setIsNewMemberHonorary(e.target.checked)} />
                  Mark as Honorary member
                </label>
                <button type="submit" className="mt-auto rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-green-800">Add to Mandal</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* TAB 3: MEDIA / VAULT (WITH LIGHTBOX FIXES) */}
      {activeTab === 'media' && (
        <div className="animate-in fade-in zoom-in duration-300 space-y-6">
          <div className="bg-[#1a0505]/80 backdrop-blur-xl border border-yellow-500/30 p-4 rounded-2xl shadow-lg">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500/50" />
                <input
                  type="text"
                  placeholder="Search by email or caption..."
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  className="w-full bg-black/40 border border-yellow-500/20 rounded-xl py-2 pl-10 pr-4 text-sm text-yellow-100 placeholder-yellow-100/30 outline-none focus:border-yellow-400 transition-all shadow-inner"
                />
              </div>

              <div className="flex flex-wrap gap-2 md:gap-3">
                <select value={vaultType} onChange={(e) => setVaultType(e.target.value)} className="bg-[#2a0808] border border-yellow-500/20 rounded-xl px-3 py-2 text-xs font-bold text-yellow-100 outline-none cursor-pointer focus:border-yellow-400 uppercase tracking-widest shadow-inner">
                  <option value="all">All Media</option>
                  <option value="image">Images Only</option>
                  <option value="video">Videos Only</option>
                </select>

                <select value={vaultPrivacy} onChange={(e) => setVaultPrivacy(e.target.value)} className="bg-[#2a0808] border border-yellow-500/20 rounded-xl px-3 py-2 text-xs font-bold text-yellow-100 outline-none cursor-pointer focus:border-yellow-400 uppercase tracking-widest shadow-inner">
                  <option value="all">All Privacy</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>

                <select value={vaultSort} onChange={(e) => setVaultSort(e.target.value)} className="bg-[#2a0808] border border-yellow-500/20 rounded-xl px-3 py-2 text-xs font-bold text-yellow-100 outline-none cursor-pointer focus:border-yellow-400 uppercase tracking-widest shadow-inner">
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>

                <select value={vaultUploader} onChange={(e) => setVaultUploader(e.target.value)} className="bg-[#2a0808] border border-yellow-500/20 rounded-xl px-3 py-2 text-xs font-bold text-yellow-100 outline-none cursor-pointer focus:border-yellow-400 uppercase tracking-widest shadow-inner max-w-[150px] truncate">
                  <option value="all">All Uploaders</option>
                  {uniqueUploaders.map((email: string) => (
                    <option key={email} value={email}>{email?.split('@')[0]}</option>
                  ))}
                </select>

                <select value={vaultDate} onChange={(e) => setVaultDate(e.target.value)} className="bg-[#2a0808] border border-yellow-500/20 rounded-xl px-3 py-2 text-xs font-bold text-yellow-100 outline-none cursor-pointer focus:border-yellow-400 uppercase tracking-widest shadow-inner">
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                </select>
              </div>
            </div>
          </div>

          {/* 🔥 FIX: Changed to grid-cols-3 for mobile */}
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
            {filteredVaultMedia.length === 0 ? (
              <div className="col-span-full py-12 text-center border border-white/5 rounded-2xl bg-white/5 backdrop-blur-sm">
                <p className="text-yellow-100/50 text-sm font-bold uppercase tracking-widest">No media matches your filters</p>
                <button
                  onClick={() => {
                    setVaultSearch(''); setVaultType('all'); setVaultPrivacy('all');
                    setVaultSort('newest'); setVaultUploader('all'); setVaultDate('all'); setVaultCaption('all');
                  }}
                  className="mt-4 text-xs text-yellow-500 hover:text-yellow-400 underline underline-offset-4"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              filteredVaultMedia.map((item: any, index: number) => (
                <div key={item.id} onClick={() => setSelectedIndex(index)} className="relative group rounded-xl overflow-hidden border border-yellow-500/20 aspect-square bg-black shadow-lg hover:shadow-[0_0_15px_rgba(202,138,4,0.3)] transition-all cursor-pointer">
                  {item.type?.startsWith('video') ? (
                    <>
                      <img src={item.thumbnail} className="w-full h-full object-cover" alt="video" loading="lazy" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="rounded-full bg-black/40 backdrop-blur-md p-2">
                          <Play className="w-4 h-4 sm:w-6 sm:h-6 fill-white text-white" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img src={item.url.replace('/upload/', '/upload/q_auto:low,w_600/')} alt="Vault Media" className="w-full h-full object-cover" loading="lazy" />
                  )}

                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 sm:p-3 backdrop-blur-[2px]">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] sm:text-[10px] bg-black/60 text-yellow-400 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded backdrop-blur-md border border-yellow-500/30 truncate max-w-[80px] sm:max-w-[100px]" title={item.uploaderEmail}>
                          {item.uploaderEmail?.split('@')[0]}
                        </span>
                      </div>
                    </div>
                    {item.isPrivate && (
                      <div className="self-end bg-gradient-to-r from-yellow-600 to-yellow-400 text-black text-[8px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex items-center gap-1 shadow-md">
                        <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Private
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* 🔥 THE NEW PREMIUM LIGHTBOX VIEWER FOR ADMIN */}
          {selectedMedia && (
            <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-xl animate-fade-in touch-none">
              
              <div className="absolute top-0 w-full p-4 flex justify-between items-start z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <div className="flex flex-col pointer-events-auto">
                  <span className="text-white font-black uppercase tracking-widest text-sm">{selectedMedia.uploadedBy}</span>
                  <span className="text-gray-400 text-[10px] font-bold uppercase">{new Date(selectedMedia.createdAt).toLocaleString()} • {selectedMedia.category || 'Event'}</span>
                </div>
                <button onClick={() => setSelectedIndex(null)} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all pointer-events-auto">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div 
                className="flex-1 relative flex items-center overflow-hidden touch-none" 
                onClick={() => setSelectedIndex(null)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <button onClick={handlePrev} className="absolute left-4 z-50 p-3 bg-white/5 text-white rounded-full hover:bg-white/20 transition-all hidden sm:block"><ChevronLeft className="w-6 h-6" /></button>
                
                <div 
                  className="flex w-full h-full items-center will-change-transform"
                  style={{
                    transform: `translate3d(calc(-${(selectedIndex || 0) * 100}% + ${swipeOffset}px), 0, 0)`,
                    transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                  }}
                >
                  {filteredVaultMedia.map((item: any, index: number) => {
                    const isNear = Math.abs(index - (selectedIndex || 0)) <= 1;

                    return (
                      <div key={item.id} className="min-w-full h-full flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
                        {isNear ? (
                          item.type?.startsWith('video') ? (
                            index === selectedIndex ? (
                              <video controls autoPlay className="max-h-full max-w-full rounded-xl shadow-2xl border border-white/10">
                                <source src={item.url} type="video/mp4" />
                              </video>
                            ) : (
                              <div className="relative flex items-center justify-center max-h-full max-w-full rounded-xl overflow-hidden">
                                <img src={item.thumbnail} className="max-h-full max-w-full object-contain blur-[2px]" alt="video-poster" />
                                <Play className="absolute w-16 h-16 text-white/70" />
                              </div>
                            )
                          ) : (
                            <img src={item.url} className="max-h-full max-w-full object-contain select-none rounded-xl shadow-2xl border border-white/10 pointer-events-none" alt="fullscreen" />
                          )
                        ) : (
                          <div className="w-full h-full" />
                        )}
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
                  <a 
                    href={selectedMedia.url.replace('/upload/', '/upload/q_auto:eco,w_1080/')} 
                    target="_blank" 
                    download 
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white text-[10px] font-bold uppercase tracking-widest transition-all border border-white/10 shadow-sm"
                    style={{ color: 'beige' }}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> WhatsApp Size
                  </a>
                  <a href={selectedMedia.url} target="_blank" download className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95">
                    <Download className="w-3.5 h-3.5" /> Original HD
                  </a>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ============================== */}
      {/* TAB 4: SECURITY */}
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
                <button onClick={resetAllAttempts} className="px-2 py-1.5 bg-gray-800 text-white text-[9px] font-bold rounded hover:bg-black">
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#1a0505] p-3 sm:p-4 rounded-xl shadow-xl border border-red-900/50 max-h-60 overflow-y-auto">
            <p className="text-red-400 font-bold mb-2 flex items-center gap-1.5 text-xs"><Activity className="w-3 h-3"/> Real Activity Stream</p>
            <div className="space-y-1.5 font-mono text-[9px] sm:text-[10px]">
              {activeUsers.map((user, index) => (
                <p key={`login-${index}`} className="text-gray-300">
                  <span className="text-green-500">[{new Date(user.lastLogin).toLocaleTimeString()}]</span> {user.name} logged into the portal.
                </p>
              ))}
              {failedAttemptUsers.map((user, index) => (
                <p key={`fail-${index}`} className="text-red-400">
                  <span className="opacity-50">[{new Date().toLocaleDateString()}]</span> Alert: {user.name} failed passcode ({user.failedAttempts} times).
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* TAB 5: SETTINGS */}
      {activeTab === "settings" && (
        <div className="space-y-3 animate-fade-in">

          <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
            <h3 className="font-black text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2 text-sm">
              <Lock className="w-4 h-4 text-[#5A0000]"/> Access Rules
            </h3>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Secret Mandal Passcode</label>
              <div className="flex mt-1 gap-2">
                <input
                  type="text"
                  value={localPasscode}
                  onChange={(e) => setLocalPasscode(e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-800 outline-none focus:border-[#5A0000]"
                />
                <button onClick={() => saveSettings('secretPasscode', localPasscode)} className="px-3 py-1.5 bg-[#5A0000] text-white font-bold text-[10px] rounded-lg shadow-md hover:bg-red-900">Update</button>
              </div>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-black text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2 text-sm">
              <Shield className="w-4 h-4 text-[#5A0000]"/> Anti-Leak & Downloads
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800">Allow HD Downloads</p>
                <p className="text-[9px] text-gray-500">Members can download RAW files</p>
              </div>
              <button onClick={() => saveSettings('hdDownloads', !settings.hdDownloads)} className={`w-8 h-4 rounded-full transition-colors relative ${settings.hdDownloads ? 'bg-green-500' : 'bg-gray-300'}`}>
                <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${settings.hdDownloads ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
              </button>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
            <h3 className="font-black text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2 text-sm">
              <Bell className="w-4 h-4 text-[#5A0000]"/> Live Portal Announcement
            </h3>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Home Screen Message</label>
              <textarea
                value={settings.announcement || ""}
                onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}
                className="mt-1 min-h-[80px] w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs font-bold text-gray-800 outline-none focus:border-[#5A0000]"
                placeholder="Type important notice here..."
              />
              <button
                onClick={() => saveSettings('announcement', settings.announcement)}
                className="mt-2 w-full rounded-lg bg-[#5A0000] py-2 text-[10px] font-bold text-white shadow-md transition-colors hover:bg-red-900"
              >
                Broadcast to All Members 📢
              </button>
            </div>
          </div>

        </div>
      )}

      {activeTab === "profile" && (
        <div className="animate-in fade-in zoom-in duration-300">
          {currentUserData ? (
            <UserProfile userData={currentUserData} />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-500 shadow-sm">
              Loading profile...
            </div>
          )}
        </div>
      )}

    </div>
  );
}
