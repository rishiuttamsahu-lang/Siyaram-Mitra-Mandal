"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type { FormEvent } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, setDoc, updateDoc } from "firebase/firestore";
import { Bell, ChevronDown, CheckCircle2 } from "lucide-react";

// 🔥 PREMIUM CUSTOM DROPDOWN COMPONENT
const CustomSelect = ({ value, onChange, options, placeholder, theme = 'light' }: { value: any, onChange: any, options: any[], placeholder?: string, theme?: 'light' | 'dark' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const isDark = theme === 'dark';

  const triggerDark = `bg-[#2a0808]/90 backdrop-blur-md border border-white/10 px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-black text-white uppercase tracking-widest hover:bg-[#3a0a0a] ${isOpen ? 'border-red-500 ring-1 ring-red-500/50' : ''}`;
  const triggerLight = `bg-white border border-gray-200 px-4 py-2 sm:py-2.5 text-[10px] sm:text-[10px] font-black uppercase text-gray-700 hover:bg-gray-50 shadow-sm ${isOpen ? 'border-yellow-500 ring-1 ring-yellow-500/30' : ''}`;
  const dropdownDark = 'bg-[#1a0505] border border-red-900/30 shadow-2xl';
  const dropdownLight = 'bg-white border border-gray-100 shadow-xl';

  const getOptionClass = (isSelected: boolean) => {
    if (isDark) return isSelected ? 'bg-red-500/20 text-red-400' : 'text-gray-300 hover:bg-[#2a0808] text-white';
    return isSelected ? 'bg-yellow-50 text-yellow-700' : 'text-gray-700 hover:bg-gray-50';
  };

  return (
    <div className={`relative w-48 sm:w-56 ${isOpen ? 'z-[100]' : 'z-10'}`} ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between w-full cursor-pointer select-none transition-all rounded-xl outline-none ${isDark ? triggerDark : triggerLight}`}>
        <span className="truncate pr-4">{selectedOption ? selectedOption.label : (placeholder || 'Select...')}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
      </div>

      {isOpen && (
        <div className={`absolute top-[calc(100%+6px)] right-0 min-w-full w-max rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[9999] ${isDark ? dropdownDark : dropdownLight}`}>
          <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
            {options.map((opt, idx) => {
              const isSelected = String(value) === String(opt.value);
              return (
                <div key={idx} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`px-4 py-3 cursor-pointer transition-colors text-[10px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center justify-between ${getOptionClass(isSelected)}`}>
                  <span className="whitespace-nowrap">{opt.label}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 ml-3 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
// 🔥 COMPONENT KHATAM

const MONTHLY_TARGET = 100;
const PREVIOUS_YEAR = 6500;
const MONTHS = [
  "SEPT", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG",
] as const;

type Month = (typeof MONTHS)[number];

type Member = {
  id: number;
  name: string;
  payments: Partial<Record<Month, number>>;
  isHonorary?: boolean;
};

const DEFAULT_MEMBERS: Member[] = [
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

function normalizeMemberCode(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function getCurrentTrackingMonth(): Month {
  const jsMonths: Month[] = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEPT", "OCT", "NOV", "DEC",
  ];
  return jsMonths[new Date().getMonth()];
}

export default function Dashboard({ userData }: { userData: any }) {
  const isAdmin = userData?.role === "Admin"; // Auth is now managed by Firebase Google Login

  const [currentTrackingMonth, setCurrentTrackingMonth] = useState<Month>(getCurrentTrackingMonth());
  const [blockedMonths, setBlockedMonths] = useState<Month[]>([]);
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [sysSettings, setSysSettings] = useState<any>(null);
  const [sortBy, setSortBy] = useState<string>("default"); // 🔥 SORTING STATE
  
  // 🔥 NAYA ARRAY: Sort Options ke liye
  const SORT_OPTIONS = [
    { value: "default", label: "ID (Default Order)" },
    { value: "name-asc", label: "Name (A-Z)" },
    { value: "name-desc", label: "Name (Z-A)" },
    { value: "paid-desc", label: "Highest Paid" },
    { value: "due-desc", label: "Highest Due" }
  ];
  
  const [paymentMemberId, setPaymentMemberId] = useState("");
  const [paymentMonth, setPaymentMonth] = useState<Month>(getCurrentTrackingMonth());
  const [paymentAmount, setPaymentAmount] = useState(String(MONTHLY_TARGET));
  const [newMemberName, setNewMemberName] = useState("");
  const [isNewMemberHonorary, setIsNewMemberHonorary] = useState(false);
  const [editCell, setEditCell] = useState<{ id: number | null; month: Month | null }>({ id: null, month: null });
  const [editValue, setEditValue] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  // 1. Fetch Real-time Data from Firebase
  useEffect(() => {
    // Listen to Members
    const unsubMembers = onSnapshot(collection(db, "mandal_members"), (snap) => {
      const fetchedMembers: Member[] = snap.docs.map(doc => ({
        id: doc.data().id,
        name: doc.data().name,
        payments: doc.data().payments || {},
        isHonorary: doc.data().isHonorary || false,
      }));
      // Sort by ID
      fetchedMembers.sort((a, b) => a.id - b.id);
      setMembers(fetchedMembers);
    });

    // Listen to Blocked Months Config
    const unsubConfig = onSnapshot(doc(db, "mandal_settings", "config"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().blockedMonths) {
        setBlockedMonths(docSnap.data().blockedMonths);
      }
    });

    const unsubSystem = onSnapshot(doc(db, 'mandal_settings', 'system'), (snap) => {
      if (snap.exists()) setSysSettings(snap.data());
    });

    return () => {
      unsubMembers();
      unsubConfig();
      unsubSystem();
    };
  }, []);

  useEffect(() => {
    setPaymentMonth(currentTrackingMonth);
  }, [currentTrackingMonth]);

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
      alert("Purana data Firebase mein successfully upload ho gaya!");
    } catch (error) {
      console.error(error);
      alert("Error: Data upload fail ho gaya.");
    }
    setIsRestoring(false);
  };

  const getMemberTotal = (payments: Member["payments"]) =>
    Object.values(payments).reduce((sum, amount) => sum + (amount ?? 0), 0);

  const currentMonthIndex = MONTHS.indexOf(currentTrackingMonth);
  const monthsPassed = MONTHS.slice(0, currentMonthIndex + 1);
  const chargeableMonths = monthsPassed.filter((month) => !blockedMonths.includes(month));
  const expectedTotalPerMember = chargeableMonths.length * MONTHLY_TARGET;
  const payingMembersCount = members.filter((member) => !member.isHonorary).length;
  const totalExpectedMandal = payingMembersCount * expectedTotalPerMember;
  const totalCollected = members.reduce((sum, member) => sum + getMemberTotal(member.payments), 0);
  const totalDeficit = Math.max(0, totalExpectedMandal - totalCollected);
  const grandTotal = totalCollected + PREVIOUS_YEAR;

  const monthlyTotals = useMemo(() =>
    MONTHS.reduce((acc, month) => {
      acc[month] = members.reduce((sum, member) => sum + (member.payments[month] || 0), 0);
      return acc;
    }, {} as Record<Month, number>),
  [members]);

  const toggleExpandedMember = (memberId: number) => {
    setExpandedMemberId((currentExpandedMemberId) =>
      currentExpandedMemberId === memberId ? null : memberId
    );
  };

  // --- FIREBASE WRITE OPERATIONS ---
  const toggleBlockMonth = async (month: Month) => {
    const newBlocked = blockedMonths.includes(month)
      ? blockedMonths.filter((m) => m !== month)
      : [...blockedMonths, month];
    
    await setDoc(doc(db, "mandal_settings", "config"), { blockedMonths: newBlocked }, { merge: true });
  };

  const handleLogPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const memberId = Number(paymentMemberId);
    const amount = Number(paymentAmount);

    if (!Number.isFinite(memberId) || !Number.isFinite(amount) || amount <= 0) {
      window.alert("Please choose a member and enter a valid amount.");
      return;
    }

    const memberToUpdate = members.find(m => m.id === memberId);
    if (!memberToUpdate) return;

    const currentAmount = memberToUpdate.payments[paymentMonth] || 0;

    await updateDoc(doc(db, "mandal_members", memberId.toString()), {
      [`payments.${paymentMonth}`]: currentAmount + amount
    });

    setPaymentAmount(String(MONTHLY_TARGET));
    setPaymentMemberId("");
  };

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = newMemberName.trim();
    if (!trimmedName) return;

    const memberCode = normalizeMemberCode(trimmedName);
    const alreadyExists = members.some((member) => normalizeMemberCode(member.name) === memberCode);
    if (alreadyExists) {
      window.alert("Member already exists.");
      return;
    }

    const nextId = members.length > 0 ? Math.max(...members.map((member) => member.id)) + 1 : 1;

    await setDoc(doc(db, "mandal_members", nextId.toString()), {
      id: nextId,
      name: trimmedName.toUpperCase(),
      payments: {},
      isHonorary: isNewMemberHonorary,
      createdAt: new Date().toISOString()
    });

    setNewMemberName("");
    setIsNewMemberHonorary(false);
  };

  // --- INLINE EDITING LOGIC (FIREBASE) ---
  const handleCellClick = (memberId: number, month: Month, currentValue: number | undefined) => {
    if (isAdmin && !blockedMonths.includes(month)) {
      setEditCell({ id: memberId, month: month });
      setEditValue(String(currentValue || ""));
    }
  };

  const saveInlineEdit = async () => {
    if (editCell.id !== null && editCell.month !== null) {
      const numValue = parseInt(editValue) || 0;
      await updateDoc(doc(db, "mandal_members", editCell.id.toString()), {
        [`payments.${editCell.month}`]: numValue
      });
    }
    setEditCell({ id: null, month: null });
    setEditValue("");
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") saveInlineEdit();
    if (e.key === "Escape") {
      setEditCell({ id: null, month: null });
      setEditValue("");
    }
  };

  // 🔥 YAHAN SE NAYA LOGIC SHURU HOTA HAI
  const sortedMembers = useMemo(() => {
    const monthsPassed = Math.max(0, MONTHS.indexOf(currentTrackingMonth) + 1);
    let sorted = [...members];
    
    switch (sortBy) {
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "paid-desc":
        sorted.sort((a, b) => {
          const totalA = Object.values(a.payments).reduce((sum, val) => sum + (val || 0), 0);
          const totalB = Object.values(b.payments).reduce((sum, val) => sum + (val || 0), 0);
          return totalB - totalA; // High to Low
        });
        break;
      case "due-desc":
        sorted.sort((a, b) => {
          const totalA = Object.values(a.payments).reduce((sum, val) => sum + (val || 0), 0);
          const deficitA = a.isHonorary ? 0 : Math.max(0, (monthsPassed * MONTHLY_TARGET) - totalA);
          const totalB = Object.values(b.payments).reduce((sum, val) => sum + (val || 0), 0);
          const deficitB = b.isHonorary ? 0 : Math.max(0, (monthsPassed * MONTHLY_TARGET) - totalB);
          return deficitB - deficitA; // High to Low Deficit
        });
        break;
      default:
        sorted.sort((a, b) => a.id - b.id); // Default by original ID
        break;
    }
    return sorted;
  }, [members, sortBy, currentTrackingMonth]);
  // 🔥 NAYA LOGIC YAHAN KHATAM HOTA HAI

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 text-gray-900 md:px-12 md:py-12 animate-fade-in" style={{ padding: 0 }}>
      <div className="mx-auto max-w-7xl space-y-6 md:space-y-8">
        
        {/* HEADER SECTION (Adapted for Cloud Dashboard) */}
        <header className="flex flex-col items-start justify-between gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              Siyaram Mitra Mandal
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 md:gap-3">
              <p className="text-xs font-medium uppercase tracking-widest text-gray-500 md:text-sm">Financial Tracker</p>
              <span className="text-gray-300">|</span>
              <div className="mt-1 flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 shadow-sm md:mt-0">
                <span className="text-[10px] font-semibold uppercase text-gray-500 md:text-xs">Track Up To:</span>
                <select
                  className="cursor-not-allowed appearance-none bg-transparent text-sm font-bold text-blue-600 outline-none"
                  value={currentTrackingMonth}
                  disabled
                >
                  {MONTHS.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-700">
                  Auto
                </span>
              </div>
            </div>
          </div>

          <div className="flex w-full items-center gap-4 md:w-auto">
            <div className="flex-grow rounded-xl border border-gray-200 bg-white px-5 py-3 text-left shadow-sm md:flex-grow-0 md:text-right">
              <span className="mb-1 block text-xs text-gray-500 uppercase tracking-wider">Grand Total (Inc. Prev Year)</span>
              <span className="text-xl font-bold text-green-700 md:text-2xl">₹{grandTotal.toLocaleString()}</span>
            </div>

            <div
              className={`relative flex items-center justify-center h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border-2 shadow-sm transition-all duration-300 md:h-16 md:w-16 ${
                isAdmin
                  ? "border-yellow-400 bg-yellow-50 shadow-[0_0_15px_rgba(250,204,21,0.6)] text-xs font-bold text-yellow-700 text-center leading-tight"
                  : "border-gray-200"
              }`}
              title={isAdmin ? "Admin Access Enabled" : "Viewer Access"}
            >
              {isAdmin ? "Admin Mode" : <img src="/logo.png" alt="Siyaram Mandal Logo" className="h-full w-full object-cover" />}
            </div>
          </div>
        </header>


        {sysSettings?.announcement && (
          <div className="mb-6 rounded-r-2xl border-l-4 border-yellow-500 bg-gradient-to-r from-yellow-50 to-orange-50 p-4 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-500 p-1.5 animate-pulse">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-tighter text-yellow-800">Mandal Announcement</p>
                <p className="mt-0.5 text-sm font-bold leading-tight text-gray-800">
                  {sysSettings.announcement}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <SummaryCard label="Total Collected (YTD)" value={`₹${totalCollected.toLocaleString()}`} />
          <SummaryCard label={`Total Dues (Up to ${currentTrackingMonth})`} value={`₹${totalDeficit.toLocaleString()}`} accentClassName="text-orange-600" badge={`₹${expectedTotalPerMember} Target`} />
          <SummaryCard label="Previous Year Balance" value={`₹${PREVIOUS_YEAR.toLocaleString()}`} muted />
        </div>

        {/* 🔥 UNIFIED SORT TOOLBAR (Mobile + Desktop dono ke liye) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm mt-2">
          <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
            👥 Member Records
          </h2>
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sort By:</span>
            
            {/* 🔥 NAYA PREMIUM DROPDOWN */}
            <CustomSelect 
              value={sortBy} 
              onChange={setSortBy} 
              options={SORT_OPTIONS} 
              theme="light" 
            />
            
          </div>
        </div>

        {/* MOBILE VIEW LIST */}
        <div className="block space-y-3 md:hidden">
          {sortedMembers.length === 0 && <p className="text-center text-gray-400 py-4 font-bold">No members yet. Admins can add or restore them above!</p>}
          {sortedMembers.map((member) => {
            const totalPaid = getMemberTotal(member.payments);
            const remaining = expectedTotalPerMember - totalPaid;
            const isExpanded = expandedMemberId === member.id;

            return (
              <div key={member.id} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <button type="button" onClick={() => toggleExpandedMember(member.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 truncate text-sm font-bold text-gray-900">
                      <span>{member.name}</span>
                      {member.isHonorary ? <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">Honorary</span> : null}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">Total Paid: <span className="font-semibold text-gray-800">₹{totalPaid}</span></div>
                  </div>

                  <div className="flex items-center gap-2">
                    {member.isHonorary ? <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-700">Honorary</span> : remaining > 0 ? <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-600">₹{remaining} Due</span> : remaining < 0 ? <span className="rounded-md bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700">Adv ₹{Math.abs(remaining)}</span> : <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">Clear</span>}
                    <span className="text-xs text-gray-400">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-50 bg-gray-50/60 px-4 pb-4 pt-3">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {MONTHS.map((month) => {
                        const isBlocked = blockedMonths.includes(month);
                        const isEditing = editCell.id === member.id && editCell.month === month;

                        return (
                          <div key={month} onClick={() => handleCellClick(member.id, month, member.payments[month])} className={`relative rounded-lg border p-2 text-center shadow-sm ${isBlocked ? "border-red-200 bg-gray-100" : isAdmin ? "border-yellow-300 cursor-pointer bg-white hover:bg-yellow-50" : "border-gray-100 bg-white"}`}>
                            <div className="text-[10px] font-bold uppercase text-gray-400">{month} {isBlocked ? "🚫" : ""}</div>
                            {isEditing ? (
                              <input type="number" autoFocus className="w-full border-b-2 border-[#5a0000] bg-transparent text-center text-sm font-bold outline-none" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveInlineEdit} onKeyDown={handleInlineKeyDown} />
                            ) : (
                              <div className={`text-sm font-semibold ${isBlocked ? "line-through text-gray-400" : "text-gray-800"}`}>{member.payments[month] ? `₹${member.payments[month]}` : "-"}</div>
                            )}
                            {isAdmin && !isBlocked && !isEditing && <span className="absolute right-1 top-1 text-[8px] text-yellow-500 opacity-50">✎</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                  {MONTHS.map((month) => <th key={month} className={`px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider ${blockedMonths.includes(month) ? "text-red-400" : "text-gray-500"}`}>{month} {blockedMonths.includes(month) ? "🚫" : ""}</th>)}
                  <th className="bg-blue-50 px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-900">Total</th>
                  <th className="bg-orange-50 px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-900">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedMembers.length === 0 && <tr><td colSpan={15} className="text-center text-gray-400 py-8 font-bold">No members yet. Admins can restore them using the yellow button above!</td></tr>}
                {sortedMembers.map((member) => {
                  const totalPaid = getMemberTotal(member.payments);
                  const remaining = expectedTotalPerMember - totalPaid;

                  return (
                    <tr key={member.id} className="transition-colors hover:bg-gray-50">
                      <td className="sticky left-0 bg-white px-6 py-4 text-sm font-medium text-gray-900 shadow-[1px_0_0_0_#f3f4f6]">
                        <div className="flex items-center gap-2">
                          <span>{member.name}</span>
                          {member.isHonorary && <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">Honorary</span>}
                        </div>
                      </td>
                      {MONTHS.map((month) => {
                        const isBlocked = blockedMonths.includes(month);
                        const isEditing = editCell.id === member.id && editCell.month === month;

                        return (
                          <td key={month} onClick={() => handleCellClick(member.id, month, member.payments[month])} className={`relative px-4 py-4 text-center text-sm transition-colors ${isBlocked ? "bg-gray-50 text-gray-400" : isAdmin ? "cursor-pointer hover:bg-yellow-50 hover:shadow-inner" : "text-gray-600"}`} title={isAdmin && !isBlocked ? "Click to edit" : ""}>
                            {isEditing ? (
                              <input type="number" autoFocus className="w-16 border-b-2 border-red-500 bg-transparent text-center font-bold text-[#5a0000] outline-none" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveInlineEdit} onKeyDown={handleInlineKeyDown} />
                            ) : (
                              <>{member.payments[month] ? `₹${member.payments[month]}` : "-"}{isAdmin && !isBlocked && !isEditing && <span className="absolute right-2 top-2 text-[10px] text-gray-300 group-hover:text-yellow-600">✎</span>}</>
                            )}
                          </td>
                        );
                      })}
                      {member.isHonorary ? (
                        <><td className="bg-purple-50/30 px-6 py-4 text-center text-sm font-bold text-gray-400">-</td><td className="bg-purple-50/30 px-6 py-4 text-center"><span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-800">Honorary</span></td></>
                      ) : (
                        <><td className="bg-blue-50/30 px-6 py-4 text-center text-sm font-bold text-gray-900">₹{totalPaid}</td><td className="bg-orange-50/30 px-6 py-4 text-center">{remaining > 0 ? <span className="text-sm font-semibold text-red-600">₹{remaining} Due</span> : remaining < 0 ? <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">+₹{Math.abs(remaining)} Advance</span> : <span className="text-sm font-semibold text-orange-600">Clear</span>}</td></>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td className="sticky left-0 bg-gray-50 px-6 py-4 text-sm font-bold text-gray-900">TOTAL</td>
                  {MONTHS.map((month) => <td key={month} className={`px-4 py-4 text-center text-sm font-bold ${blockedMonths.includes(month) ? "text-gray-400" : "text-gray-900"}`}>{monthlyTotals[month] > 0 ? `₹${monthlyTotals[month]}` : "-"}</td>)}
                  <td className="bg-blue-100/50 px-6 py-4 text-center text-sm font-bold text-blue-700">₹{totalCollected}</td>
                  <td className="bg-orange-100/50 px-6 py-4 text-center text-sm font-bold text-orange-700">₹{totalDeficit.toLocaleString()} Due</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accentClassName, muted, badge }: { label: string; value: string; accentClassName?: string; muted?: boolean; badge?: string; }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>
        {badge && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">{badge}</span>}
      </div>
      <span className={`text-3xl font-bold ${accentClassName ?? "text-gray-900"} ${muted ? "text-gray-400" : ""}`}>{value}</span>
    </div>
  );
}
