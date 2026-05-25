"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type { FormEvent } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, addDoc, orderBy, serverTimestamp } from "firebase/firestore";
import { Bell, ChevronDown, CheckCircle2, Building2, Users, IndianRupee, Layers, Search, Save, Store, UserPlus, Home, X, Trash2, AlertCircle } from "lucide-react";

type BuildingPayment = {
  id: string;
  wing: string;
  floor: string;
  room: string;
  name?: string;
  amount: number;
  status: 'Pending' | 'Collected';
};

type OtherPayment = {
  id: string;
  name: string;
  amount: number;
  status: 'Pending' | 'Collected';
  timestamp?: any;
};

type ExpenseLog = {
  id: string;
  name: string;
  amount: number;
  date: string;
  time: string;
  timestamp?: any;
};

// 🔥 PREMIUM CUSTOM DROPDOWN COMPONENT
const CustomSelect = ({ value, onChange, options, placeholder, theme = 'light', className = 'w-full' }: { value: any, onChange: any, options: any[], placeholder?: string, theme?: 'light' | 'dark', className?: string }) => {
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
    <div className={`relative ${className} ${isOpen ? 'z-[100]' : 'z-10'}`} ref={dropdownRef}>
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

  const [activeSubTab, setActiveSubTab] = useState<'members' | 'buildings' | 'others' | 'expenses'>('buildings'); // Default to buildings
  const [expenseLogs, setExpenseLogs] = useState<ExpenseLog[]>([]);
  const [activeWing, setActiveWing] = useState<'A' | 'B'>('A');

  // Building management states
  const [buildingPayments, setBuildingPayments] = useState<BuildingPayment[]>([]);
  const [selectedFlat, setSelectedFlat] = useState<string | null>(null);
  const [inputName, setInputName] = useState<string>('');
  const [inputAmount, setInputAmount] = useState<string>('');
  const [inputStatus, setInputStatus] = useState<'Pending' | 'Collected'>('Pending');
  const [isUpdatingFlat, setIsUpdatingFlat] = useState(false);

  // Others (Dost & Dukan) states
  const [otherPayments, setOtherPayments] = useState<OtherPayment[]>([]);
  const [otherName, setOtherName] = useState('');
  const [otherAmount, setOtherAmount] = useState('');
  const [otherStatus, setOtherStatus] = useState<'Pending' | 'Collected'>('Collected');
  const [isAddingOther, setIsAddingOther] = useState(false);

  // Configuration matrices matching your plan layout
  const FLOORS = ['3', '2', '1', '0']; // 3rd down to Ground floor
  const ROOM_SUFFIXES = ['1', '2', '3', '4'];

  const getRoomNumber = (floor: string, suffix: string) => {
    if (floor === '0') return `00${suffix}`;
    return `${floor}0${suffix}`;
  };

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

  // 🔥 UPGRADED TOAST NOTIFICATION STATES
  const [toast, setToast] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
    show: false, title: '', message: '', type: 'success'
  });
  const [toastProgress, setToastProgress] = useState(100);

  // 🔥 SWIPE GESTURE TRACKING REFS
  const touchStartX = useRef<number>(0);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const toastDuration = 4000; // 4 seconds total
  const progressInterval = useRef<any>(null);
  const autoCloseTimeout = useRef<any>(null);

  // 🔥 TRIGGER APP-LIKE TOAST WITH TIMELINE BAR
  const triggerToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    // Clear any previous interval logs safely
    clearInterval(progressInterval.current);
    clearTimeout(autoCloseTimeout.current);

    setSwipeOffset(0);
    setIsSwiping(false);
    setToastProgress(100);
    setToast({ show: true, title, message, type });

    // Progress Bar Decrement Loop (Smooth Timeline frame)
    const startTime = Date.now();
    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / toastDuration) * 100);
      setToastProgress(remaining);
      if (remaining <= 0) clearInterval(progressInterval.current);
    }, 30);

    // Auto close triggers
    autoCloseTimeout.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, toastDuration);
  };

  // 🔥 SWIPE HANDLERS FOR MOBILE TOUCH GESTURES
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
    // Pause timers while user is holding/dragging the toast
    clearInterval(progressInterval.current);
    clearTimeout(autoCloseTimeout.current);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    // Only allow swiping to the right side (like native notifications)
    if (diff > 0) {
      setSwipeOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    // If swiped more than 120px, dismiss it immediately with swipe animation speed
    if (swipeOffset > 120) {
      setSwipeOffset(500); // Push completely out of view area
      setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
        setSwipeOffset(0);
      }, 150);
    } else {
      // Snapback to center position if swipe gesture distance was short
      setSwipeOffset(0);
      // Resume fast countdown closure
      autoCloseTimeout.current = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 1500);
    }
  };

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

  // Fetch Building Data Streams from Firestore
  useEffect(() => {
    const q = query(collection(db, "building_chanda"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BuildingPayment[];
      setBuildingPayments(data);
    });
    return () => unsub();
  }, []);

  // Fetch Others Data
  useEffect(() => {
    const q = query(collection(db, "other_chanda"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OtherPayment[];
      setOtherPayments(data);
    });
    return () => unsub();
  }, []);

  // 🔥 NAYA REAL-TIME LISTENER FOR EXPENSES (KHARCHA LOGS)
  useEffect(() => {
    const q = query(collection(db, "expenses_log"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        amount: Number(doc.data().amount) || 0,
        date: doc.data().date || '',
        time: doc.data().time || '',
        timestamp: doc.data().timestamp
      })) as ExpenseLog[];
      setExpenseLogs(data);
    }, (error) => {
      console.error("🔥 Expenses fetch error:", error.message);
    });
    return () => unsub();
  }, []);

  // Compute building live metrics
  const buildingMetrics = useMemo(() => {
    const totals = { totalCollected: 0, collectedCount: 0, pendingCount: 0 };
    buildingPayments.forEach(p => {
      if (p.status === 'Collected') {
        totals.totalCollected += (Number(p.amount) || 0);
        totals.collectedCount++;
      } else {
        totals.pendingCount++;
      }
    });
    return totals;
  }, [buildingPayments]);

  // Compute others metrics
  const otherMetrics = useMemo(() => {
    const totals = { totalCollected: 0, entryCount: 0 };
    otherPayments.forEach(p => {
      if (p.status === 'Collected') {
        totals.totalCollected += (Number(p.amount) || 0);
      }
      totals.entryCount++;
    });
    return totals;
  }, [otherPayments]);

  const handleSelectFlatTile = (wing: string, roomNum: string) => {
    const flatId = `${wing}_${roomNum}`;
    const match = buildingPayments.find(p => p.id === flatId);
    setSelectedFlat(flatId);
    setInputName(match?.name || '');
    setInputAmount(match ? String(match.amount) : '');
    setInputStatus(match ? match.status : 'Pending');
  };

  const handleSaveFlatChanda = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFlat) return;

    setIsUpdatingFlat(true);
    try {
      const [wing, room] = selectedFlat.split('_');
      const floor = room.startsWith('0') ? '0' : room[0];

      await setDoc(doc(db, "building_chanda", selectedFlat), {
        wing,
        floor,
        room,
        name: inputName.trim(),
        amount: Number(inputAmount) || 0,
        status: inputStatus,
        lastUpdated: serverTimestamp()
      }, { merge: true });

      setSelectedFlat(null);
      triggerToast("Success ✅", `Flat ${room} data updated successfully!`, "success");
    } catch (err) {
      console.error(err);
      triggerToast("Error ❌", "Permission Denied or Database Error", "error");
    } finally {
      setIsUpdatingFlat(false);
    }
  };

  const handleAddOtherChanda = async (e: FormEvent) => {
    e.preventDefault();
    if (!otherName.trim() || !otherAmount) return;
    setIsAddingOther(true);
    try {
      await addDoc(collection(db, "other_chanda"), {
        name: otherName.trim(),
        amount: Number(otherAmount),
        status: otherStatus,
        timestamp: serverTimestamp()
      });
      setOtherName('');
      setOtherAmount('');
      setOtherStatus('Collected');
      triggerToast("Saved ✅", "New ledger log entry added!", "success");
    } catch (err) {
      console.error(err);
      triggerToast("Error ❌", "Could not save entry.", "error");
    } finally {
      setIsAddingOther(false);
    }
  };

  // 🔥 NEW LOG DELETE HANDLER
  const handleDeleteOtherLog = async (id: string, name: string) => {
    const confirmDelete = window.confirm(`Kya aap "${name}" ka record sach me delete karna chahte hain?`);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "other_chanda", id));
      triggerToast("Deleted 🗑️", "Record permanently removed from logs.", "info");
    } catch (err) {
      console.error(err);
      triggerToast("Error ❌", "Sufficient permission missing.", "error");
    }
  };

  // 🔥 DEDICATED EXPENSE LOG DELETE HANDLER FOR 4TH TAB
  const handleDeleteExpenseLog = async (id: string, name: string) => {
    // Debugging alert taaki pata chale button trigger hua
    console.log("Delete trigger for ID:", id, "Name:", name);
    
    if (!id) {
      alert("Error: Expense ID nahi mili!");
      return;
    }

    const confirmDelete = window.confirm(`Kya aap "${name}" ka expense record sach me delete karna chahte hain?`);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "expenses_log", id));
      triggerToast("Deleted 🗑️", "Expense record permanently removed from logs.", "info");
    } catch (err: any) {
      console.error("Firebase deletion crashed: ", err);
      alert("Firebase Error: " + err.message);
    }
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
      triggerToast("Success ✅", "Purana data successfully upload ho gaya!", "success");
    } catch (error) {
      console.error(error);
      triggerToast("Error ❌", "Data upload fail ho gaya.", "error");
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
  
  // 1. Saare alag-alag tabs ki kamai (Income) calculate karo
  const totalCollected = members.reduce((sum, member) => sum + getMemberTotal(member.payments), 0);
  const totalBuildingCollected = buildingPayments.reduce((sum, p) => p.status === 'Collected' ? sum + (Number(p.amount) || 0) : sum, 0);
  const totalOthersCollected = otherPayments.reduce((sum, p) => p.status === 'Collected' ? sum + (Number(p.amount) || 0) : sum, 0);
  const totalDeficit = Math.max(0, totalExpectedMandal - totalCollected);

  // 2. Pure 4th Tab ka total kharcha (Expenses) nikalon
  const totalExpensesDeduction = expenseLogs.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  // 3. 🔥 THE MASTER BALANCED FORMULA: Total Income - Total Expenses + Backlog
  const grandTotal = (totalCollected + totalBuildingCollected + totalOthersCollected + PREVIOUS_YEAR) - totalExpensesDeduction;

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
    <div className="min-h-screen bg-gray-50/50 pb-24 relative overflow-x-hidden" style={{ padding: 0 }}>
      {/* 🔥 SWIPE-TO-DISMISS TOAST NOTIFICATION PRESET WITH DYNAMIC METRIC LINE */}
      {toast.show && (
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translate3d(calc(-50% + ${swipeOffset}px), 0, 0)`,
            transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)'
          }}
          className="fixed top-4 left-1/2 z-[10000] w-[92%] max-w-xs bg-white/95 backdrop-blur-md p-3 rounded-xl border border-gray-100 shadow-xl flex flex-col overflow-hidden touch-none select-none active:cursor-grabbing"
        >
          <div className="flex items-start gap-2.5">
            <div className={`p-1.5 rounded-lg text-white mt-0.5 ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-[11px] font-black uppercase tracking-wider text-gray-900 leading-none">{toast.title}</h5>
              <p className="text-[10px] font-bold text-gray-500 mt-0.5 leading-tight">{toast.message}</p>
            </div>
            <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="text-gray-300 hover:text-gray-600 p-0.5 shrink-0 cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* 🔥 REAL-TIME DOWN-COUNT TIMELINE LOADING PROGRESS BAR */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gray-100">
            <div
              style={{ width: `${toastProgress}%` }}
              className={`h-full transition-all duration-75 ${toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}
            />
          </div>

          {/* Mobile Swipe Subtle Indicator Handle */}
          <div className="w-8 h-1 bg-gray-200/60 rounded-full mx-auto mt-2 block sm:hidden"></div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#5A0000] to-[#3A0000] px-4 pt-8 pb-20 text-white text-center rounded-b-[2rem] shadow-lg relative">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Small Logo / Admin Indicator */}
          <div
            className={`relative flex items-center justify-center h-10 w-10 overflow-hidden rounded-full border shadow-sm transition-all duration-300 shrink-0 ${isAdmin
              ? "border-yellow-400 bg-yellow-50 shadow-[0_0_10px_rgba(250,204,21,0.6)] text-[8px] font-black text-yellow-700 text-center leading-none uppercase"
              : "border-white/20 bg-white/10"
              }`}
            title={isAdmin ? "Admin Access Enabled" : "Viewer Access"}
          >
            {isAdmin ? "Admin" : <img src="/logo.png" alt="Siyaram Mandal Logo" className="h-full w-full object-cover" />}
          </div>

          {/* Title */}
          <div className="flex-1 text-center">
            <h1
              className="text-xl sm:text-2xl font-black uppercase tracking-widest text-yellow-400 leading-tight font-cinzel"
            >
              Siyaram Mitra Mandal
            </h1>
            <p
              className="text-[10px] text-red-200 mt-0.5 uppercase tracking-widest font-black font-cinzel"
            >
              Ledger Dashboard
            </p>
          </div>

          {/* Grand Total Micro Card */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-xl text-right shrink-0">
            <span className="block text-[8px] text-red-200 uppercase tracking-wider font-bold">Grand Total</span>
            <span className="text-sm font-black text-green-300">₹{grandTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 🔥 THE MASTER RESPONSIVE WRAPPER */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 -mt-12 relative z-10 space-y-4">


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

        {/* 4-WAY SUB-TAB NAVIGATION */}
        <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex gap-1 mb-4">
          <button
            onClick={() => setActiveSubTab('members')}
            className={`flex-1 py-2 px-1 rounded-lg font-black text-[9px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${activeSubTab === 'members' ? 'bg-[#5A0000] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Users className="w-3.5 h-3.5" /> Members
          </button>
          <button
            onClick={() => setActiveSubTab('buildings')}
            className={`flex-1 py-2 px-1 rounded-lg font-black text-[9px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${activeSubTab === 'buildings' ? 'bg-[#5A0000] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Building2 className="w-3.5 h-3.5" /> Buildings
          </button>
          <button
            onClick={() => setActiveSubTab('others')}
            className={`flex-1 py-2 px-1 rounded-lg font-black text-[9px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${activeSubTab === 'others' ? 'bg-[#5A0000] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Store className="w-3.5 h-3.5" /> Dost & Dukan
          </button>
          <button
            onClick={() => setActiveSubTab('expenses')}
            className={`flex-1 py-2 px-1 rounded-lg font-black text-[9px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${activeSubTab === 'expenses' ? 'bg-[#5A0000] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <IndianRupee className="w-3.5 h-3.5" /> Kharcha
          </button>
        </div>

        {/* Master Tab Content Card */}
        <div className="bg-white p-3 sm:p-5 rounded-3xl border border-gray-100 shadow-sm min-h-[500px]">
          {activeSubTab === 'members' ? (
            <>
              {/* SUMMARY CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SummaryCard label="Total Collected (YTD)" value={`₹${totalCollected.toLocaleString()}`} />
                <SummaryCard label={`Total Dues (Up to ${currentTrackingMonth})`} value={`₹${totalDeficit.toLocaleString()}`} accentClassName="text-orange-600" badge={`₹${expectedTotalPerMember} Target`} />
                <SummaryCard label="Previous Year Balance" value={`₹${PREVIOUS_YEAR.toLocaleString()}`} muted />
              </div>

              {/* 🔥 UNIFIED SORT TOOLBAR (Mobile + Desktop dono ke liye) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50 mt-3">
                <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                  <h2 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-1.5">
                    👥 Member Records
                  </h2>
                  <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2 py-0.5 shadow-sm sm:hidden">
                    <span className="text-[9px] font-semibold uppercase text-gray-500">Track:</span>
                    <span className="text-[10px] font-bold text-blue-600">{currentTrackingMonth}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 shadow-sm">
                    <span className="text-[9px] font-semibold uppercase text-gray-500">Track up to:</span>
                    <span className="text-[10px] font-bold text-blue-600">{currentTrackingMonth}</span>
                  </div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Sort:</span>

                  {/* 🔥 NAYA PREMIUM DROPDOWN */}
                  <CustomSelect
                    value={sortBy}
                    onChange={setSortBy}
                    options={SORT_OPTIONS}
                    theme="light"
                    className="w-40 sm:w-48"
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

              {/* 🖥️ SLEEK DESKTOP TABLE */}
              <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-500 whitespace-nowrap shadow-[2px_0_5px_rgba(0,0,0,0.02)]">Name</th>
                        {MONTHS.map((month) => <th key={month} className={`px-2 py-2.5 text-center text-[10px] font-black uppercase tracking-widest ${blockedMonths.includes(month) ? "text-red-400" : "text-gray-500"}`}>{month} {blockedMonths.includes(month) ? "🚫" : ""}</th>)}
                        <th className="bg-blue-50 px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-gray-900 border-l border-white">Total</th>
                        <th className="bg-orange-50 px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-gray-900 border-l border-white">Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedMembers.length === 0 && <tr><td colSpan={15} className="text-center text-gray-400 py-6 text-xs font-bold uppercase tracking-widest">No members yet. Admins can restore them using the yellow button above!</td></tr>}
                      {sortedMembers.map((member) => {
                        const totalPaid = getMemberTotal(member.payments);
                        const remaining = expectedTotalPerMember - totalPaid;

                        return (
                          <tr key={member.id} className="transition-colors hover:bg-gray-50/80 bg-white group">
                            <td className="sticky left-0 bg-white group-hover:bg-gray-50/80 px-3 py-2 text-xs font-bold text-gray-900 shadow-[2px_0_5px_rgba(0,0,0,0.02)] whitespace-nowrap transition-colors">
                              <div className="flex items-center gap-2">
                                <span>{member.name}</span>
                                {member.isHonorary && <span className="rounded-md border border-purple-200 bg-purple-50 px-1.5 py-[2px] text-[8px] font-black uppercase tracking-wider text-purple-700">Honorary</span>}
                              </div>
                            </td>
                            {MONTHS.map((month) => {
                              const isBlocked = blockedMonths.includes(month);
                              const isEditing = editCell.id === member.id && editCell.month === month;

                              return (
                                <td
                                  key={month}
                                  onClick={() => handleCellClick(member.id, month, member.payments[month])}
                                  className={`
                                  relative px-2 py-2 text-center text-[11px] font-black transition-all cursor-pointer group
                                  ${isBlocked ? "bg-gray-50 text-gray-400 cursor-not-allowed" : "text-gray-700 hover:bg-yellow-50 hover:shadow-inner"}
                                `}
                                  title={isAdmin && !isBlocked ? "Click to edit amount" : ""}
                                >
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      autoFocus
                                      className="w-12 border-b-2 border-[#5a0000] bg-transparent text-center font-black text-[#5a0000] outline-none text-[11px]"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={saveInlineEdit}
                                      onKeyDown={handleInlineKeyDown}
                                    />
                                  ) : (
                                    <>
                                      {member.payments[month] ? `₹${member.payments[month]}` : "-"}

                                      {/* 🔥 EDIT ICON: Sirf hover par dikhega, clean UI */}
                                      {isAdmin && !isBlocked && (
                                        <span className="absolute right-0.5 top-0.5 text-[8px] text-gray-300 group-hover:text-yellow-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                          ✎
                                        </span>
                                      )}
                                    </>
                                  )}
                                </td>
                              );
                            })}
                            {member.isHonorary ? (
                              <><td className="bg-purple-50/30 px-3 py-2 text-center text-xs font-bold text-gray-400">-</td><td className="bg-purple-50/30 px-3 py-2 text-center"><span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-purple-800">Honorary</span></td></>
                            ) : (
                              <><td className="bg-blue-50/30 px-3 py-2 text-center text-xs font-black text-blue-700">₹{totalPaid}</td><td className="bg-orange-50/30 px-3 py-2 text-center">{remaining > 0 ? <span className="text-[10px] font-black text-red-600">₹{remaining} Due</span> : remaining < 0 ? <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-800">+₹{Math.abs(remaining)} Adv</span> : <span className="text-[10px] font-black text-gray-400">Clear</span>}</td></>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                      <tr>
                        <td className="sticky left-0 bg-gray-50 px-3 py-2.5 text-[11px] font-black text-gray-900 uppercase tracking-widest shadow-[2px_0_5px_rgba(0,0,0,0.02)]">Total</td>
                        {MONTHS.map((month) => <td key={month} className={`px-2 py-2.5 text-center text-xs font-black ${blockedMonths.includes(month) ? "text-gray-400" : "text-gray-900"}`}>{monthlyTotals[month] > 0 ? `₹${monthlyTotals[month]}` : "-"}</td>)}
                        <td className="bg-blue-100/50 px-3 py-2.5 text-center text-xs font-black text-blue-800 border-l border-white">₹{totalCollected}</td>
                        <td className="bg-orange-100/50 px-3 py-2.5 text-center text-xs font-black text-orange-800 border-l border-white">₹{totalDeficit.toLocaleString()} Due</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : activeSubTab === 'buildings' ? (
            /* 🏢 SLEEK & COMPACT BUILDING MATRIX */
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Tiny Metrics Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white border border-gray-100 p-2 sm:p-3 rounded-xl text-center shadow-sm">
                  <span className="text-[8px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Total</span>
                  <span className="text-xs sm:text-sm font-black text-green-700">₹{buildingMetrics.totalCollected.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-white border border-gray-100 p-2 sm:p-3 rounded-xl text-center shadow-sm">
                  <span className="text-[8px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Collected</span>
                  <span className="text-xs sm:text-sm font-black text-blue-700">{buildingMetrics.collectedCount}</span>
                </div>
                <div className="bg-white border border-gray-100 p-2 sm:p-3 rounded-xl text-center shadow-sm">
                  <span className="text-[8px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Pending</span>
                  <span className="text-xs sm:text-sm font-black text-red-600">{buildingMetrics.pendingCount}</span>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-3 sm:p-4 shadow-sm space-y-4">

                {/* Wing Switcher - Compact */}
                <div className="flex justify-center border-b border-gray-100 pb-3">
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                    <button onClick={() => setActiveWing('A')} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeWing === 'A' ? 'bg-[#5A0000] text-white shadow-sm' : 'text-gray-500'}`}>A WING</button>
                    <button onClick={() => setActiveWing('B')} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeWing === 'B' ? 'bg-[#5A0000] text-white shadow-sm' : 'text-gray-500'}`}>B WING</button>
                  </div>
                </div>

                {/* Compact Editor Modal */}
                {selectedFlat && (
                  <form onSubmit={handleSaveFlatChanda} className="bg-red-50/80 border border-red-200 p-3 rounded-xl space-y-3 animate-in fade-in duration-200 shadow-sm">
                    <div className="flex items-center justify-between border-b border-red-100 pb-2">
                      <h4 className="text-[11px] font-black text-red-950 uppercase tracking-wide flex items-center gap-1"><Home className="w-3 h-3 text-[#5A0000]" /> {activeWing}-{selectedFlat.split('_')[1]}</h4>
                      <button type="button" onClick={() => setSelectedFlat(null)} className="text-[9px] font-bold text-gray-500 hover:text-red-700 bg-white px-2 py-1 rounded border border-gray-200 cursor-pointer">Close</button>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[8px] font-black uppercase text-gray-500 block mb-0.5">Resident / Family Name</label>
                        <input type="text" placeholder="Name (Optional)" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg font-bold text-[10px] outline-none" value={inputName} onChange={(e) => setInputName(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[8px] font-black uppercase text-gray-500 block mb-0.5">Amount (₹)</label>
                          <input type="number" required placeholder="501" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg font-bold text-[10px] outline-none" value={inputAmount} onChange={(e) => setInputAmount(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[8px] font-black uppercase text-gray-500 block mb-0.5">Status</label>
                          <CustomSelect value={inputStatus} onChange={(val: 'Pending' | 'Collected') => setInputStatus(val)} options={[{ value: 'Pending', label: '❌ Pend' }, { value: 'Collected', label: '✅ Done' }]} />
                        </div>
                      </div>
                    </div>
                    <button type="submit" disabled={isUpdatingFlat} className="w-full bg-[#5A0000] text-white font-black uppercase text-[10px] py-2 rounded-lg shadow-sm cursor-pointer">{isUpdatingFlat ? "Saving..." : "Save Record"}</button>
                  </form>
                )}

                {/* 🏢 REALISTIC LITTLE DARK SKIN COLOR BUILDING ARCHITECTURE */}
                <div className="relative mx-auto w-full max-w-sm mt-2">
                  {/* Roof */}
                  <div className="w-full h-4 sm:h-5 bg-[#4A2711] rounded-t-xl shadow-inner border-b-2 border-[#2D170A] flex items-center justify-center">
                    <span className="text-white/40 text-[7px] sm:text-[8px] font-black uppercase tracking-[0.2em]">{activeWing} WING</span>
                  </div>

                  {/* Building Body (Little Dark Skin Texture Palette: #6E3C1A) */}
                  <div className="bg-[#6E3C1A] p-2 sm:p-2.5 shadow-xl relative border-x-[3px] border-[#4A2711] rounded-b-sm">
                    <div className="space-y-2">
                      {FLOORS.map((floor) => (
                        <div key={floor} className="flex flex-row items-stretch gap-1.5 bg-[#593014]/95 p-1.5 rounded-lg border-b-2 border-[#4A2711] shadow-inner">

                          {/* Floor Indicator Elevator Box */}
                          <div className="flex items-center justify-center bg-[#2D170A] rounded-md w-6 sm:w-8 text-yellow-400 font-black text-[8px] uppercase tracking-tighter border border-[#1F0F06] shadow-inner shrink-0">
                            {floor === '0' ? 'GR' : `${floor}F`}
                          </div>

                          {/* Flat Windows Matrix */}
                          <div className="grid grid-cols-4 gap-1.5 flex-1">
                            {ROOM_SUFFIXES.map((suffix) => {
                              const roomNum = getRoomNumber(floor, suffix);
                              const flatId = `${activeWing}_${roomNum}`;
                              const paymentMatch = buildingPayments.find(p => p.id === flatId);
                              const isCollected = paymentMatch?.status === 'Collected' && (Number(paymentMatch.amount) > 0);
                              const isSelected = selectedFlat === flatId;

                              return (
                                <div
                                  key={roomNum}
                                  onClick={() => handleSelectFlatTile(activeWing, roomNum)}
                                  className={`cursor-pointer p-1.5 rounded-md flex flex-col items-center justify-center relative overflow-hidden transition-all border-b-[2px] active:scale-95 select-none
                                  ${isCollected
                                      ? 'bg-green-50/95 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                                      : 'bg-[#FFFBF5]/95 border-[#C4A484] hover:bg-white'} 
                                  ${isSelected ? 'ring-[1.5px] ring-red-500 border-transparent' : ''}`}
                                >
                                  {/* Window Glass Reflection Effect */}
                                  <div className="absolute top-0 right-0 w-6 h-10 bg-white/20 rotate-45 transform translate-x-3 -translate-y-3 pointer-events-none"></div>

                                  {/* Window Number */}
                                  <span className={`font-black text-[10px] leading-none z-10 ${isCollected ? 'text-green-900' : 'text-[#4A2711]'}`}>
                                    {roomNum}
                                  </span>

                                  {/* Name (Tiny) */}
                                  <span className={`text-[6px] font-bold truncate w-full text-center leading-tight mt-0.5 z-10 ${isCollected ? 'text-green-700' : 'text-[#6E3C1A]'}`}>
                                    {paymentMatch?.name ? paymentMatch.name : '-'}
                                  </span>

                                  {/* Amount/Status Badge */}
                                  <div className={`mt-0.5 px-1 py-[1px] rounded-[3px] text-[6px] sm:text-[7px] font-black w-full text-center z-10 ${isCollected ? 'bg-green-200/50 text-green-800' : 'bg-[#DFD3C3] text-[#4A2711]'}`}>
                                    {isCollected ? `₹${paymentMatch.amount}` : 'PENDING'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Foundation */}
                  <div className="w-full h-2 bg-[#2D170A] rounded-b-lg shadow-xl mt-[-2px]"></div>
                </div>
              </div>
            </div>
          ) : activeSubTab === 'others' ? (
            /* OTHERS (Dost & Dukan) TAB - COMPACT */
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white border border-gray-100 p-3 rounded-xl text-center shadow-sm">
                  <span className="text-[8px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Total Extra</span>
                  <span className="text-sm font-black text-green-700">₹{otherMetrics.totalCollected.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-white border border-gray-100 p-3 rounded-xl text-center shadow-sm">
                  <span className="text-[8px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Total Entries</span>
                  <span className="text-sm font-black text-gray-800">{otherMetrics.entryCount} Logs</span>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-widest mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2"><UserPlus className="w-3 h-3 text-[#5A0000]" /> New Entry</h3>
                <form onSubmit={handleAddOtherChanda} className="space-y-3">
                  <div>
                    <label className="text-[8px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Name / Shop</label>
                    <input type="text" required placeholder="E.g., Raju Store" className="w-full px-3 py-2 border border-gray-200 rounded-lg font-bold text-[10px] bg-gray-50 outline-none focus:bg-white focus:border-[#5A0000]" value={otherName} onChange={(e) => setOtherName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Amount (₹)</label>
                      <input type="number" required placeholder="101" className="w-full px-3 py-2 border border-gray-200 rounded-lg font-bold text-[10px] bg-gray-50 outline-none focus:bg-white focus:border-[#5A0000]" value={otherAmount} onChange={(e) => setOtherAmount(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Status</label>
                      <CustomSelect value={otherStatus} onChange={(val: 'Pending' | 'Collected') => setOtherStatus(val)} options={[{ value: 'Pending', label: '❌ Pend' }, { value: 'Collected', label: '✅ Done' }]} />
                    </div>
                  </div>
                  <button type="submit" disabled={isAddingOther} className="w-full bg-[#5A0000] text-white font-black uppercase text-[10px] py-2.5 rounded-lg shadow-sm mt-1 cursor-pointer">{isAddingOther ? "Adding..." : "Add to Ledger"}</button>
                </form>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">Recent Logs</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                  {otherPayments.length === 0 ? (
                    <p className="text-center text-[9px] font-bold uppercase tracking-widest text-gray-400 py-4">No entries yet.</p>
                  ) : (
                    otherPayments.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-2 border border-gray-100 rounded-lg bg-gray-50/50 group transition-all">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={`w-6 h-6 rounded flex items-center justify-center font-black text-[9px] shrink-0 ${entry.status === 'Collected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {entry.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <p className="text-[10px] font-black text-gray-800 uppercase leading-none truncate">{entry.name}</p>
                            <p className="text-[8px] font-bold text-gray-400 mt-0.5">{entry.status}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 pl-2">
                          <span className={`font-black text-xs ${entry.status === 'Collected' ? 'text-green-700' : 'text-gray-400'}`}>₹{entry.amount}</span>

                          {/* 🔥 DELETE ACTION BUTTON */}
                          <button
                            onClick={() => handleDeleteOtherLog(entry.id, entry.name)}
                            className="text-gray-300 hover:text-red-600 p-1 rounded-md hover:bg-red-50 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                            title="Delete Log Entry"
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
          ) : activeSubTab === 'expenses' ? (
            /* 🔥 NEW EXPENSES 4TH TAB - UPDATED BULLETPROOF UI */
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-white border border-gray-100 p-4 rounded-xl text-center shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">Total Kharcha (Expenses)</span>
                <span className="text-2xl font-black text-red-600">
                  ₹{expenseLogs.reduce((sum, exp) => sum + Number(exp.amount), 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">
                  Expense Logs
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                  {expenseLogs.length === 0 ? (
                     <p className="text-center text-[9px] font-bold uppercase tracking-widest text-gray-400 py-4">No expenses recorded yet.</p>
                  ) : (
                    expenseLogs.map((exp) => (
                      <div key={exp.id || Math.random().toString()} className="flex items-center justify-between p-2.5 border border-red-100 rounded-lg bg-red-50/20 group transition-all">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-black text-xs shrink-0">
                            <IndianRupee className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-black text-gray-800 uppercase leading-none truncate">{exp.name}</p>
                            <p className="text-[9px] font-bold text-gray-400 mt-1">{exp.date} • {exp.time}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 pl-2">
                          <span className="font-black text-xs text-red-600">-₹{exp.amount}</span>
                          
                          {/* 🔥 ACTION BUTTON WITH POINTER BLOCK RESOLUTION */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteExpenseLog(exp.id, exp.name);
                              }}
                              className="text-gray-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 md:opacity-0 group-hover:opacity-100 transition-all cursor-pointer relative z-50 block"
                              title="Delete Log Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, accentClassName, muted, badge }: { label: string; value: string; accentClassName?: string; muted?: boolean; badge?: string; }) {
  return (
    <div className="flex flex-col justify-center rounded-xl border border-gray-100 bg-white p-3 sm:p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-1.5">
        <span className="text-[9px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 truncate">{label}</span>
        {badge && <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[8px] font-bold text-orange-800 shrink-0 hidden sm:inline-block">{badge}</span>}
      </div>
      <span className={`text-base sm:text-xl md:text-2xl font-black tracking-tight ${accentClassName ?? "text-gray-900"} ${muted ? "text-gray-400" : ""}`}>{value}</span>
      {badge && <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[8px] font-bold text-orange-800 shrink-0 self-start mt-1 sm:hidden">{badge}</span>}
    </div>
  );
}
