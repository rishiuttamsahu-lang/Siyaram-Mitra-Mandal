"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, getDoc } from 'firebase/firestore';
import {
  Shield, ShieldAlert, Ban, RefreshCcw, Key, Mail, User, Image as ImageIcon,
  BarChart2, Settings, Lock, Activity, Database, AlertTriangle, Trash2, Play, Search, Smartphone, Bell
} from 'lucide-react';

const adminTabs = [
  { id: "analytics", label: "Stats", icon: <BarChart2 size={14} /> },
  { id: "users", label: "Users", icon: <User size={14} /> },
  { id: "finance", label: "Finance", icon: <Database size={14} /> },
  { id: "media", label: "Vault", icon: <ImageIcon size={14} /> },
  { id: "security", label: "Security", icon: <Shield size={14} /> },
  { id: "settings", label: "Website", icon: <Settings size={14} /> },
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

  // Fetch Data (Fixed Permission Error)
  useEffect(() => {
    // 🔥 FIX: Agar user Admin nahi hai, toh background mein data fetch hi mat karo
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
      unsubConfig(); 
      unsubMandalMembers();
      unsubConfigBlock();
    };
  }, [currentUserData?.role]); // Dependency mein role add kiya

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


  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const activeUsers = users.filter((user) => user.lastLogin);
  const failedAttemptUsers = users.filter((user) => (user.failedAttempts || 0) > 0);

  const handleRoleChange = async (uid: string, newRole: string) => {
    if (!uid) {
      showToast("Error: User ID missing!", 'error');
      return;
    }

    try {
      const isBanned = newRole === 'Banned';
      await updateDoc(doc(db, 'users', uid), {
        role: newRole,
        isBanned: isBanned
      });
      showToast(`Role updated to ${newRole} 👑`, 'success');
    } catch (error: any) {
      console.error("Role Error:", error);
      showToast(`Error updating role: ${error.message}`, 'error');
    }
  };

  const deleteMedia = async (id: string) => {
    if (!id) {
      showToast("Error: Media ID missing!", 'error');
      return;
    }

    try {
      await deleteDoc(doc(db, 'mandal_gallery', id));
      showToast("Media deleted successfully! 🗑️", 'success');
    } catch (error: any) {
      console.error("Delete Error:", error);
      showToast(`Error deleting file: ${error.message}`, 'error');
    }
  };

  const saveSettings = async (key: string, value: any) => {
    try {
      const newSettings = { ...settings, [key]: value };
      await setDoc(doc(db, 'mandal_settings', 'system'), newSettings, { merge: true });
      setSettings(newSettings);
      showToast("Settings Updated Successfully! ✅", 'success');
    } catch (error: any) {
      console.error("Settings Error:", error);
      showToast(`Settings Error: ${error.message}`, 'error');
    }
  };

  const resetAllAttempts = () => {
    showToast("Feature integrated with backend later.", 'success');
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
          
          {/* Manage Active Months */}
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
            
            {/* Add / Update Payment */}
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

            {/* Add New Member */}
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
      {/* TAB 3: MEDIA / VAULT */}
      {activeTab === "media" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 animate-fade-in">
          {media.length === 0 && <p className="text-gray-400 text-xs font-bold col-span-full py-10 text-center">Vault is empty.</p>}

          {media.map((item) => (
            <div key={item.id} className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm flex flex-col group relative">
              <div className="h-24 sm:h-28 bg-black relative">
                <img src={item.thumbnail || item.url} className="w-full h-full object-cover opacity-90" alt="media" />
                {item.type === 'video' && <div className="absolute top-1.5 right-1.5 bg-black/60 p-1 rounded-full"><Play className="w-3 h-3 text-white" /></div>}
              </div>

              <div className="p-2 flex-1 flex flex-col justify-between">
                <div className="mb-2">
                  <p className="text-[7px] font-bold text-gray-400 uppercase tracking-wider">Uploaded By</p>
                  <p className="text-[10px] font-black text-gray-800 truncate">{item.uploadedBy}</p>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-[8px] text-gray-500 flex items-center gap-1">
                      <Database className="w-2 h-2" /> {formatBytes(item.size)} • {item.quality || 'HQ'}
                    </p>
                    <p className="text-[8px] text-[#5A0000] font-bold flex items-center gap-1 uppercase">
                      <Smartphone className="w-2 h-2" /> {item.deviceInfo || 'Web Browser'}
                    </p>
                  </div>
                </div>
                <button onClick={() => deleteMedia(item.id)} className="w-full py-1.5 bg-red-50 text-red-600 rounded-md text-[9px] font-bold hover:bg-red-100 flex items-center justify-center gap-1 transition-colors">
                  <Trash2 className="w-3 h-3" /> Force Delete
                </button>
              </div>
            </div>
          ))}
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

    </div>
  );
}
