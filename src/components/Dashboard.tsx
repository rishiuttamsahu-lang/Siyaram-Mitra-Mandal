"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type { FormEvent } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, addDoc, orderBy, serverTimestamp } from "firebase/firestore";
import { Bell, ChevronDown, CheckCircle2, Building2, Users, IndianRupee, Layers, Search, Save, Store, UserPlus, Home, X, Trash2, AlertCircle } from "lucide-react";
import { Building, Wing, Flat } from "@/lib/types/building";
import { subscribeBuildings, subscribeWings, subscribeFlats, createOrUpdateFlat, calculateWingMetrics, WingMetricsSummary } from "@/lib/buildingService";
import { ChandaSeason, MonthlyDue } from "@/lib/types/season";
import { subscribeSeasons, subscribeMonthlyDues, resolveEffectivePeriodStatus, MANDAL_MONTHS } from "@/lib/seasonService";

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

type Member = {
  id: number;
  name: string;
  payments: Record<string, number>;
  isHonorary?: boolean;
  isRemoved?: boolean;
  exemptMonths?: string[];
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

// 🔥 MODERN PROFESSIONAL GLASSMORPHIC SEASON DROPDOWN
const SeasonDropdown = ({
  seasons,
  selectedId,
  onSelect,
}: {
  seasons: ChandaSeason[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeSeason = seasons.find((s) => s.id === selectedId) || seasons[0];

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`group inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-xs ${
          isOpen
            ? 'bg-black/80 text-yellow-300 border border-yellow-400 ring-2 ring-yellow-400/20'
            : 'bg-black/40 hover:bg-black/60 text-yellow-200 border border-yellow-500/30 hover:border-yellow-400/60'
        } backdrop-blur-md`}
        aria-expanded={isOpen}
        aria-label="Select Season"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="truncate max-w-[130px] sm:max-w-[180px]">
          {activeSeason?.name ? `Season ${activeSeason.name}` : 'Select Season'}
        </span>
        {activeSeason?.status && (
          <span className={`text-[8px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
            activeSeason.status === 'active'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
          }`}>
            {activeSeason.status}
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 text-yellow-400/70 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-yellow-300' : 'group-hover:text-yellow-300'
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 min-w-[210px] sm:min-w-[250px] bg-[#1a0505]/95 backdrop-blur-2xl border border-yellow-500/30 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] p-1.5 z-[9999] animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 border-b border-white/10 flex items-center justify-between">
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-yellow-500/80">
              Select Chanda Season
            </span>
            <span className="text-[8px] text-gray-400 font-medium">
              {seasons.length} Available
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto custom-scrollbar p-1 space-y-1">
            {seasons.map((s) => {
              const isSelected = s.id === selectedId;
              const isActive = s.status === 'active';
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onSelect(s.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/40 shadow-xs'
                      : 'hover:bg-white/5 text-gray-300 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">
                        Season {s.name}
                      </span>
                      <span
                        className={`text-[8px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/10 text-gray-400 border border-white/10'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    {s.displayName && s.displayName !== s.name && (
                      <p className="text-[9px] text-gray-400 truncate mt-0.5 font-medium">
                        {s.displayName}
                      </p>
                    )}
                  </div>

                  {isSelected && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const PREVIOUS_YEAR = 6500;
const MONTHS = [
  "SEPT", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG",
] as const;

const DELETE_SYNC_BASE_URL = process.env.NEXT_PUBLIC_RENDER_BOT_URL?.replace(/\/$/, "");

type Month = string;

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

function getCurrentTrackingMonth(): string {
  const jsMonths = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEPT", "OCT", "NOV", "DEC",
  ];
  return jsMonths[new Date().getMonth()];
}

export default function Dashboard({ userData }: { userData: any }) {
  const isAdmin = userData?.role === "Admin"; // Auth is now managed by Firebase Google Login

  const [currentTrackingMonth, setCurrentTrackingMonth] = useState<string>(getCurrentTrackingMonth());
  const [blockedMonths, setBlockedMonths] = useState<string[]>([]);
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [sysSettings, setSysSettings] = useState<any>(null);
  const [previousYearBalance, setPreviousYearBalance] = useState<number>(6500);
  const [sortBy, setSortBy] = useState<string>("default"); // 🔥 SORTING STATE

  const [activeSubTab, setActiveSubTab] = useState<'members' | 'buildings' | 'others' | 'expenses'>('buildings'); // Default to buildings
  const [expenseLogs, setExpenseLogs] = useState<ExpenseLog[]>([]);
  const [activeWing, setActiveWing] = useState<string>('A');

  // Dynamic Building Hierarchy States
  const [dynBuildings, setDynBuildings] = useState<Building[]>([]);
  const [activeBuildingId, setActiveBuildingId] = useState<string | null>(null);
  const [dynWings, setDynWings] = useState<Wing[]>([]);
  const [dynFlats, setDynFlats] = useState<Flat[]>([]);

  // Dynamic Seasons & Monthly Schedules
  const [dynSeasons, setDynSeasons] = useState<ChandaSeason[]>([]);
  const [selectedDashboardSeasonId, setSelectedDashboardSeasonId] = useState<string | null>(null);
  const [seasonMonthlyDues, setSeasonMonthlyDues] = useState<MonthlyDue[]>([]);

  // Building management states
  const [buildingPayments, setBuildingPayments] = useState<BuildingPayment[]>([]);
  const [selectedFlat, setSelectedFlat] = useState<string | null>(null);
  const [inputName, setInputName] = useState<string>('');
  const [inputAmount, setInputAmount] = useState<string>('');
  const [inputStatus, setInputStatus] = useState<'Pending' | 'Collected'>('Pending');
  const [isUpdatingFlat, setIsUpdatingFlat] = useState(false);

  // Flat Autosave refs
  const flatEditorRef = useRef<HTMLFormElement>(null);
  const flatDraftRef = useRef({ name: inputName, amount: inputAmount, status: inputStatus, flatId: selectedFlat });

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
  const [paymentMonth, setPaymentMonth] = useState<string>(getCurrentTrackingMonth());
  const [paymentAmount, setPaymentAmount] = useState('100');
  const [newMemberName, setNewMemberName] = useState("");
  const [isNewMemberHonorary, setIsNewMemberHonorary] = useState(false);
  const [editCell, setEditCell] = useState<{ id: number | null; dueKey: string | null }>({ id: null, dueKey: null });
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
    const unsubMembers = onSnapshot(collection(db, "mandal_members"), (snap) => {
      const fetchedMembers: Member[] = snap.docs.map(doc => ({
        id: doc.data().id,
        name: doc.data().name,
        payments: doc.data().payments || {},
        isHonorary: doc.data().isHonorary || false,
        isRemoved: doc.data().isRemoved || false,
        exemptMonths: doc.data().exemptMonths || [],
      }));
      // Sort by ID
      fetchedMembers.sort((a, b) => a.id - b.id);
      setMembers(fetchedMembers);
    });

    // Listen to Blocked Months Config & Opening Balance
    const unsubConfig = onSnapshot(doc(db, "mandal_settings", "config"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.blockedMonths) setBlockedMonths(data.blockedMonths);
        if (data.previousYearBalance !== undefined) setPreviousYearBalance(Number(data.previousYearBalance) || 0);
        else if (data.openingBalance !== undefined) setPreviousYearBalance(Number(data.openingBalance) || 0);
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

  const getDynamicTargetForMonth = (month: string): number => {
    const match = seasonMonthlyDues.find(d => (d.periodKey === month || d.monthKey === month || d.id === month));
    if (match && typeof match.dueAmount === 'number') {
      return match.dueAmount;
    }
    return ["JUN", "JUL", "AUG"].includes(month) ? 200 : 100;
  };

  useEffect(() => {
    setPaymentMonth(currentTrackingMonth);
    setPaymentAmount(String(getDynamicTargetForMonth(currentTrackingMonth)));
  }, [currentTrackingMonth, seasonMonthlyDues]);

  // Fetch Building Data Streams from Firestore (Legacy + Dynamic bridge)
  useEffect(() => {
    const q = query(collection(db, "building_chanda"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BuildingPayment[];
      setBuildingPayments(data);
    });
    return () => unsub();
  }, []);

  // Dynamic Buildings Listener
  useEffect(() => {
    const unsub = subscribeBuildings((bList) => {
      setDynBuildings(bList);
      if (bList.length > 0 && !activeBuildingId) {
        setActiveBuildingId(bList[0].id);
      }
    });
    return () => unsub();
  }, [activeBuildingId]);

  // Dynamic Wings Listener
  useEffect(() => {
    if (!activeBuildingId) {
      setDynWings([]);
      return;
    }
    const unsub = subscribeWings(activeBuildingId, (wList) => {
      setDynWings(wList);
      if (wList.length > 0 && !wList.some(w => w.code === activeWing)) {
        setActiveWing(wList[0].code);
      }
    });
    return () => unsub();
  }, [activeBuildingId, activeWing]);

  // Dynamic Flats Listener
  useEffect(() => {
    if (!activeBuildingId) return;
    const currentWingObj = dynWings.find(w => w.code === activeWing);
    if (!currentWingObj) {
      setDynFlats([]);
      return;
    }
    const unsub = subscribeFlats(activeBuildingId, currentWingObj.id, (fList) => {
      setDynFlats(fList);
    });
    return () => unsub();
  }, [activeBuildingId, dynWings, activeWing]);

  // Dynamic Seasons Listener
  useEffect(() => {
    const unsub = subscribeSeasons((sList) => {
      setDynSeasons(sList);
      if (sList.length > 0 && !selectedDashboardSeasonId) {
        const active = sList.find(s => s.status === 'active') || sList[0];
        setSelectedDashboardSeasonId(active.id);
      }
    });
    return () => unsub();
  }, [selectedDashboardSeasonId]);

  // Dynamic Monthly Dues Listener
  useEffect(() => {
    if (!selectedDashboardSeasonId) {
      setSeasonMonthlyDues([]);
      return;
    }
    const unsub = subscribeMonthlyDues(selectedDashboardSeasonId, (dList) => {
      setSeasonMonthlyDues(dList);
    });
    return () => unsub();
  }, [selectedDashboardSeasonId]);

  // Dynamic Schedule
  const activeSchedule: MonthlyDue[] = useMemo(() => {
    if (seasonMonthlyDues.length > 0) return seasonMonthlyDues;
    const currentSeason = dynSeasons.find(s => s.id === selectedDashboardSeasonId);
    const startYear = parseInt((currentSeason?.startDate || '2025-09-01').split('-')[0], 10) || 2025;
    return MANDAL_MONTHS.map((m, idx) => {
      const calculatedYear = idx < 4 ? startYear : startYear + 1;
      return {
        id: m.key,
        seasonId: selectedDashboardSeasonId || 'default',
        monthKey: m.key,
        periodKey: m.key,
        monthName: m.name,
        year: calculatedYear,
        monthOrder: m.order,
        dueAmount: m.defaultAmount,
        status: 'open' as const,
        locked: false
      };
    });
  }, [seasonMonthlyDues, dynSeasons, selectedDashboardSeasonId]);

  const getMemberPaymentForDue = (payments: Record<string, number> | undefined, due: MonthlyDue): number => {
    if (!payments) return 0;
    const pKey = due.periodKey;
    const mKey = due.monthKey;
    const id = due.id;
    if (pKey && payments[pKey] !== undefined) return Number(payments[pKey]) || 0;
    if (mKey && payments[mKey] !== undefined) return Number(payments[mKey]) || 0;
    if (id && payments[id] !== undefined) return Number(payments[id]) || 0;
    return 0;
  };

  // Group dynamic flats by floor
  const dynamicFlatsByFloor = useMemo(() => {
    if (dynFlats.length === 0) return null;
    const map: Record<string, Flat[]> = {};
    dynFlats.forEach(flat => {
      const floorKey = flat.floor !== undefined && flat.floor !== '' ? String(flat.floor) : '0';
      if (!map[floorKey]) map[floorKey] = [];
      map[floorKey].push(flat);
    });
    const sortedKeys = Object.keys(map).sort((a, b) => Number(b) - Number(a));
    return sortedKeys.map(k => ({ floor: k, items: map[k] }));
  }, [dynFlats]);

  // Fetch Others Data
  useEffect(() => {
    const q = query(collection(db, "other_chanda"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OtherPayment[];
      setOtherPayments(data);
    });
    return () => unsub();
  }, []);

  // 🔥 REAL-TIME LISTENER FOR EXPENSES
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
      if (p.status === 'Collected' && (Number(p.amount) || 0) > 0) {
        totals.totalCollected += (Number(p.amount) || 0);
        totals.collectedCount++;
      } else {
        totals.pendingCount++;
      }
    });
    return totals;
  }, [buildingPayments]);

  // Compute per-wing summary metrics
  const wingWiseMetrics = useMemo(() => {
    const wingMap: Record<string, { total: number; collected: number; pending: number; count: number; collectedCount: number }> = {};
    
    // Detected wing codes
    const wingCodes = dynWings.length > 0
      ? dynWings.map(w => w.code)
      : Array.from(new Set(buildingPayments.map(p => p.wing || (p.id.includes('_') ? p.id.split('_')[0] : 'A'))));

    wingCodes.forEach(w => {
      wingMap[w] = { total: 0, collected: 0, pending: 0, count: 0, collectedCount: 0 };
    });

    buildingPayments.forEach(p => {
      const w = p.wing || (p.id.includes('_') ? p.id.split('_')[0] : 'A');
      if (!wingMap[w]) {
        wingMap[w] = { total: 0, collected: 0, pending: 0, count: 0, collectedCount: 0 };
      }
      const amt = Number(p.amount) || 0;
      wingMap[w].count++;
      if (p.status === 'Collected' && amt > 0) {
        wingMap[w].collected += amt;
        wingMap[w].collectedCount++;
      } else {
        wingMap[w].pending += (amt > 0 ? amt : 500);
      }
      wingMap[w].total += amt;
    });

    return wingMap;
  }, [dynWings, buildingPayments]);

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

  // Keep draft in sync for outside-click autosave
  useEffect(() => {
    flatDraftRef.current = { name: inputName, amount: inputAmount, status: inputStatus, flatId: selectedFlat };
  }, [inputName, inputAmount, inputStatus, selectedFlat]);

  const autoSaveCurrentFlat = async () => {
    const currentDraft = flatDraftRef.current;
    if (!currentDraft.flatId) return;

    const [wing, room] = currentDraft.flatId.split('_');
    const amt = Number(currentDraft.amount) || 0;
    const derivedStatus: 'Pending' | 'Collected' = amt > 0 ? 'Collected' : 'Pending';

    try {
      await setDoc(doc(db, "building_chanda", currentDraft.flatId), {
        wing,
        floor: room.startsWith('0') ? '0' : room[0],
        room,
        name: currentDraft.name.trim(),
        amount: amt,
        status: derivedStatus,
        lastUpdated: serverTimestamp()
      }, { merge: true });

      if (activeBuildingId) {
        const currentWingObj = dynWings.find(w => w.code === wing);
        if (currentWingObj) {
          await createOrUpdateFlat(activeBuildingId, currentWingObj.id, {
            flatNumber: room,
            residentName: currentDraft.name.trim(),
            paidChanda: amt,
            paymentStatus: amt > 0 ? 'Paid' : 'Due'
          });
        }
      }
    } catch (err) {
      console.warn("Flat auto-save error:", err);
      triggerToast("Autosave Error", "Could not save flat update", "error");
    }
  };

  // Outside interaction listener for flat editor autosave
  useEffect(() => {
    const handleOutsideInteraction = (event: MouseEvent | TouchEvent) => {
      if (selectedFlat && flatEditorRef.current && !flatEditorRef.current.contains(event.target as Node)) {
        autoSaveCurrentFlat();
        setSelectedFlat(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideInteraction);
    document.addEventListener('touchstart', handleOutsideInteraction);
    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('touchstart', handleOutsideInteraction);
    };
  }, [selectedFlat, activeBuildingId, dynWings]);

  const handleSelectFlatTile = (wing: string, roomNum: string) => {
    if (selectedFlat) {
      autoSaveCurrentFlat();
    }
    const flatId = `${wing}_${roomNum}`;
    const match = buildingPayments.find(p => p.id === flatId);
    setSelectedFlat(flatId);
    setInputName(match?.name || '');
    setInputAmount(match && match.amount > 0 ? String(match.amount) : '');
    setInputStatus(match ? match.status : 'Pending');
  };

  const handleSaveFlatChanda = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFlat) return;

    setIsUpdatingFlat(true);
    try {
      await autoSaveCurrentFlat();
      setSelectedFlat(null);
      triggerToast("Success ✅", `Flat saved successfully!`, "success");
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

  // Log Delete Handler
  const handleDeleteOtherLog = async (id: string, name: string, amount: number) => {
    const confirmDelete = window.confirm(`Kya aap "${name}" ka record sach me delete karna chahte hain?`);
    if (!confirmDelete) return;

    try {
      if (DELETE_SYNC_BASE_URL) {
        try {
          const res = await fetch(`${DELETE_SYNC_BASE_URL}/api/delete-sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, amount, type: "Income" })
          });
          if (!res.ok) {
            console.warn(`⚠️ [Dashboard] delete-sync responded with status ${res.status}`);
          }
        } catch (syncErr) {
          console.warn("⚠️ [Dashboard] Bot sync endpoint unreachable:", syncErr);
        }
      }

      await deleteDoc(doc(db, "other_chanda", id));
      triggerToast("Deleted 🗑️", "Record permanently removed from logs.", "info");
    } catch (err) {
      console.error(err);
      triggerToast("Error ❌", "Sufficient permission missing.", "error");
    }
  };

  // Dedicated Expense Log Delete Handler
  const handleDeleteExpenseLog = async (id: string, name: string, amount: number) => {
    if (!id) {
      triggerToast("Error ❌", "Expense ID nahi mili!", "error");
      return;
    }

    try {
      if (DELETE_SYNC_BASE_URL) {
        try {
          const res = await fetch(`${DELETE_SYNC_BASE_URL}/api/delete-sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, amount, type: "Expense" })
          });
          if (!res.ok) {
            console.warn(`⚠️ [Dashboard] delete-sync responded with status ${res.status}`);
          }
        } catch (syncErr) {
          console.warn("⚠️ [Dashboard] Bot sync endpoint unreachable:", syncErr);
        }
      }

      await deleteDoc(doc(db, "expenses_log", id));
      triggerToast("Deleted 🗑️", `"${name}" ka kharcha permanently hata diya gaya.`, "info");
    } catch (err: any) {
      console.error("Firebase deletion crashed: ", err);
      triggerToast("Error ❌", "Hataane me koi dikkat aayi.", "error");
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

  const getMemberTotal = (payments: Record<string, number> | undefined) =>
    Object.values(payments || {}).reduce((sum, amount) => sum + (Number(amount) || 0), 0);

  // Find current tracking month cutoff in the active season schedule
  const currentTrackingDueIndex = useMemo(() => {
    const norm = currentTrackingMonth.trim().toUpperCase();
    const idx = activeSchedule.findIndex(d => {
      const pKey = (d.periodKey || '').toUpperCase();
      const mKey = (d.monthKey || '').toUpperCase();
      const id = (d.id || '').toUpperCase();
      const name = (d.monthName || '').toUpperCase();
      return pKey === norm || mKey === norm || id === norm || name === norm || name.startsWith(norm);
    });
    return idx >= 0 ? idx : activeSchedule.length - 1;
  }, [activeSchedule, currentTrackingMonth]);

  const chargeableSchedule = useMemo(() => {
    return activeSchedule.slice(0, currentTrackingDueIndex + 1);
  }, [activeSchedule, currentTrackingDueIndex]);

  // Dynamic Expected Target Per Member (Calculated strictly up to tracking cutoff)
  const getMemberExpectedTotal = (member: Member) => {
    const memberExempt: string[] = member.exemptMonths || [];
    let expected = 0;
    chargeableSchedule.forEach(due => {
      const pKey = due.periodKey || due.monthKey || due.id;
      const status = resolveEffectivePeriodStatus(pKey, due, blockedMonths, memberExempt);
      if (!status.isBlocked) {
        expected += (typeof due.dueAmount === 'number' ? due.dueAmount : 100);
      }
    });

    if (member.isRemoved) {
      const paidTotal = getMemberTotal(member.payments);
      return Math.min(paidTotal, expected);
    }
    return expected;
  };

  const expectedTotalPerMember = useMemo(() => {
    let sum = 0;
    chargeableSchedule.forEach(due => {
      const pKey = due.periodKey || due.monthKey || due.id;
      const status = resolveEffectivePeriodStatus(pKey, due, blockedMonths, []);
      if (!status.isBlocked) {
        sum += (typeof due.dueAmount === 'number' ? due.dueAmount : 100);
      }
    });
    return sum;
  }, [chargeableSchedule, blockedMonths]);

  const payingMembersCount = members.filter((member) => !member.isHonorary && !member.isRemoved).length;
  const totalExpectedMandal = members.filter((member) => !member.isHonorary && !member.isRemoved).reduce((sum, member) => sum + getMemberExpectedTotal(member), 0);
  
  // Total Income
  const totalCollected = members.reduce((sum, member) => sum + getMemberTotal(member.payments), 0);
  const totalBuildingCollected = buildingPayments.reduce((sum, p) => (p.status === 'Collected' && (Number(p.amount) || 0) > 0) ? sum + (Number(p.amount) || 0) : sum, 0);
  const totalOthersCollected = otherPayments.reduce((sum, p) => p.status === 'Collected' ? sum + (Number(p.amount) || 0) : sum, 0);
  const totalDeficit = Math.max(0, totalExpectedMandal - totalCollected);

  // Total Expenses
  const totalExpensesDeduction = expenseLogs.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  // Master Balanced Formula
  const grandTotal = (totalCollected + totalBuildingCollected + totalOthersCollected + previousYearBalance) - totalExpensesDeduction;

  const periodTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    activeSchedule.forEach(due => {
      const key = due.periodKey || due.monthKey || due.id;
      totals[key] = members.reduce((sum, member) => sum + getMemberPaymentForDue(member.payments, due), 0);
    });
    return totals;
  }, [members, activeSchedule]);

  const toggleExpandedMember = (memberId: number) => {
    setExpandedMemberId((currentExpandedMemberId) =>
      currentExpandedMemberId === memberId ? null : memberId
    );
  };

  // --- FIREBASE WRITE OPERATIONS ---
  const toggleBlockMonth = async (monthKey: string) => {
    const newBlocked = blockedMonths.includes(monthKey)
      ? blockedMonths.filter((m) => m !== monthKey)
      : [...blockedMonths, monthKey];

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

    const targetDue = activeSchedule.find(d => (d.periodKey === paymentMonth || d.monthKey === paymentMonth || d.id === paymentMonth));
    setPaymentAmount(String(targetDue?.dueAmount || 100));
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

  // --- INLINE EDITING LOGIC ---
  const handleCellClick = (memberId: number, due: MonthlyDue, currentValue: number | undefined) => {
    const pKey = due.periodKey || due.monthKey || due.id;
    const status = resolveEffectivePeriodStatus(pKey, due, blockedMonths, []);
    if (isAdmin && !status.isBlocked) {
      setEditCell({ id: memberId, dueKey: pKey });
      setEditValue(String(currentValue || ""));
    }
  };

  const saveInlineEdit = async () => {
    if (editCell.id !== null && editCell.dueKey !== null) {
      const numValue = parseInt(editValue) || 0;
      await updateDoc(doc(db, "mandal_members", editCell.id.toString()), {
        [`payments.${editCell.dueKey}`]: numValue
      });
    }
    setEditCell({ id: null, dueKey: null });
    setEditValue("");
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") saveInlineEdit();
    if (e.key === "Escape") {
      setEditCell({ id: null, dueKey: null });
      setEditValue("");
    }
  };

  const sortedMembers = useMemo(() => {
    let sorted = [...members].filter((m) => !m.isRemoved);

    switch (sortBy) {
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "paid-desc":
        sorted.sort((a, b) => {
          const totalA = getMemberTotal(a.payments);
          const totalB = getMemberTotal(b.payments);
          return totalB - totalA;
        });
        break;
      case "due-desc":
        sorted.sort((a, b) => {
          const totalA = getMemberTotal(a.payments);
          const deficitA = a.isHonorary || a.isRemoved ? 0 : Math.max(0, getMemberExpectedTotal(a) - totalA);
          const totalB = getMemberTotal(b.payments);
          const deficitB = b.isHonorary || b.isRemoved ? 0 : Math.max(0, getMemberExpectedTotal(b) - totalB);
          return deficitB - deficitA;
        });
        break;
      default:
        sorted.sort((a, b) => a.id - b.id);
        break;
    }
    return sorted;
  }, [members, sortBy, activeSchedule, blockedMonths]);

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

      {/* Header Banner - Compact on Mobile */}
      <div className="bg-gradient-to-br from-[#5A0000] to-[#3A0000] px-3 sm:px-4 pt-6 pb-16 sm:pt-8 sm:pb-20 text-white text-center rounded-b-[1.5rem] sm:rounded-b-[2rem] shadow-md relative">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Small Logo / Admin Indicator */}
          <div
            className={`relative flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 overflow-hidden rounded-full border shadow-sm transition-all duration-300 shrink-0 ${isAdmin
              ? "border-yellow-400 bg-yellow-50 shadow-[0_0_10px_rgba(250,204,21,0.6)] text-[7px] sm:text-[8px] font-black text-yellow-700 text-center leading-none uppercase"
              : "border-white/20 bg-white/10"
              }`}
            title={isAdmin ? "Admin Access Enabled" : "Viewer Access"}
          >
            {isAdmin ? "Admin" : <img src="/logo.png" alt="Siyaram Mandal Logo" className="h-full w-full object-cover" />}
          </div>

          {/* Title */}
          <div className="flex-1 text-center">
            <h1
              className="text-lg sm:text-2xl font-black uppercase tracking-widest text-yellow-400 leading-tight font-cinzel"
            >
              Siyaram Mitra Mandal
            </h1>
            <p
              className="text-[9px] sm:text-[10px] text-red-200 mt-0.5 uppercase tracking-widest font-black font-cinzel"
            >
              Ledger Dashboard
            </p>

            {dynSeasons.length > 0 && (
              <div className="flex items-center justify-center mt-2">
                <SeasonDropdown
                  seasons={dynSeasons}
                  selectedId={selectedDashboardSeasonId}
                  onSelect={setSelectedDashboardSeasonId}
                />
              </div>
            )}
          </div>

          {/* Grand Total Micro Card - Compact */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-right shrink-0">
            <span className="block text-[7px] sm:text-[8px] text-red-200 uppercase tracking-wider font-bold">Total</span>
            <span className="text-xs sm:text-sm font-black text-green-300">₹{grandTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 🔥 THE MASTER RESPONSIVE WRAPPER */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 -mt-12 relative z-10 space-y-3 sm:space-y-4">


        {sysSettings?.announcement && (
          <div className="mb-4 sm:mb-6 rounded-r-2xl border-l-4 border-yellow-500 bg-gradient-to-r from-yellow-50 to-orange-50 p-3 sm:p-4 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="rounded-full bg-yellow-500 p-1.5 animate-pulse shrink-0">
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <div>
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-tighter text-yellow-800">Mandal Announcement</p>
                <p className="mt-0.5 text-xs sm:text-sm font-bold leading-tight text-gray-800">
                  {sysSettings.announcement}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 4-WAY SUB-TAB NAVIGATION (Optimized for Mobile) */}
        <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex gap-1 mb-3 sm:mb-4 overflow-x-auto custom-scrollbar scroll-smooth">
          <button
            onClick={() => setActiveSubTab('members')}
            className={`shrink-0 min-w-[85px] sm:min-w-0 sm:flex-1 py-2 px-2 sm:px-3 rounded-lg font-black text-[9px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeSubTab === 'members' ? 'bg-[#5A0000] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Users className="w-3.5 h-3.5" /> Members
          </button>
          
          <button
            onClick={() => setActiveSubTab('buildings')}
            className={`shrink-0 min-w-[85px] sm:min-w-0 sm:flex-1 py-2 px-2 sm:px-3 rounded-lg font-black text-[9px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeSubTab === 'buildings' ? 'bg-[#5A0000] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Building2 className="w-3.5 h-3.5" /> Buildings
          </button>
          
          <button
            onClick={() => setActiveSubTab('others')}
            className={`shrink-0 min-w-[95px] sm:min-w-0 sm:flex-1 py-2 px-2 sm:px-3 rounded-lg font-black text-[9px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeSubTab === 'others' ? 'bg-[#5A0000] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Store className="w-3.5 h-3.5" /> Dost/Dukan
          </button>
          
          <button
            onClick={() => setActiveSubTab('expenses')}
            className={`shrink-0 min-w-[85px] sm:min-w-0 sm:flex-1 py-2 px-2 sm:px-3 rounded-lg font-black text-[9px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeSubTab === 'expenses' ? 'bg-[#5A0000] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <IndianRupee className="w-3.5 h-3.5" /> Kharcha
          </button>
        </div>

        {/* Master Tab Content Card */}
        <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm min-h-[500px]">
          {activeSubTab === 'members' ? (
            <>
              {/* SUMMARY CARDS - Responsive Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <SummaryCard label="Collected (YTD)" value={`₹${totalCollected.toLocaleString()}`} />
                <SummaryCard label="Total Dues" value={`₹${totalDeficit.toLocaleString()}`} accentClassName="text-orange-600" badge={`₹${expectedTotalPerMember}`} />
                <div className="col-span-2 sm:col-span-1">
                  <SummaryCard label="Previous Balance" value={`₹${previousYearBalance.toLocaleString()}`} muted />
                </div>
              </div>

              {/* 🔥 UNIFIED SORT TOOLBAR (Mobile + Desktop dono ke liye) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border border-gray-100 bg-gray-50/50 mt-2.5 sm:mt-3">
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
                    className="w-36 sm:w-48"
                  />
                </div>
              </div>

              {/* 📱 MOBILE VIEW LIST - Sleek Cards */}
              <div className="block space-y-2 md:hidden mt-2.5">
                {sortedMembers.length === 0 && (
                  <p className="text-center text-[10px] text-gray-400 py-4 font-medium uppercase tracking-wider">
                    No members found.
                  </p>
                )}
                {sortedMembers.map((member) => {
                  const totalPaid = getMemberTotal(member.payments);
                  const remaining = getMemberExpectedTotal(member) - totalPaid;
                  const isExpanded = expandedMemberId === member.id;

                  return (
                    <div
                      key={member.id}
                      className="overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-2xs transition-all hover:border-gray-300"
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpandedMember(member.id)}
                        className="flex w-full items-center justify-between p-2.5 sm:p-3 text-left cursor-pointer"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-gray-900 truncate tracking-tight">{member.name}</span>
                            {member.isHonorary && (
                              <span className="rounded border border-purple-200 bg-purple-50 px-1.5 py-[1px] text-[7.5px] font-semibold uppercase tracking-wider text-purple-700">
                                Honorary
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 font-normal mt-0.5">
                            Paid: <span className="font-semibold text-gray-800">₹{totalPaid.toLocaleString('en-IN')}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {member.isHonorary ? (
                            <span className="text-[9px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                              Honorary
                            </span>
                          ) : remaining > 0 ? (
                            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/80">
                              ₹{remaining.toLocaleString('en-IN')} Due
                            </span>
                          ) : remaining < 0 ? (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                              Adv ₹{Math.abs(remaining).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                              Clear ✅
                            </span>
                          )}
                          <span className="text-[9px] text-gray-400 font-mono ml-0.5">{isExpanded ? "▲" : "▼"}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50/70 p-2.5">
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                            {activeSchedule.map((due) => {
                              const pKey = due.periodKey || due.monthKey || due.id;
                              const status = resolveEffectivePeriodStatus(pKey, due, blockedMonths, member.exemptMonths || []);
                              const isBlocked = status.isBlocked;
                              const isEditing = editCell.id === member.id && editCell.dueKey === pKey;
                              const paidVal = getMemberPaymentForDue(member.payments, due);

                              return (
                                <div
                                  key={due.id}
                                  onClick={() => handleCellClick(member.id, due, paidVal)}
                                  className={`relative rounded-lg border p-1.5 text-center transition-all ${
                                    isBlocked
                                      ? "border-red-200/80 bg-red-50/40"
                                      : isAdmin
                                      ? "border-amber-200 bg-white hover:bg-amber-50 cursor-pointer shadow-2xs"
                                      : "border-gray-200 bg-white"
                                  }`}
                                  title={status.reasonText}
                                >
                                  <div className="text-[8.5px] font-medium uppercase text-gray-500 truncate">
                                    {due.monthName ? due.monthName.slice(0, 4) : due.monthKey} {due.year ? `'${String(due.year).slice(-2)}` : ''} {isBlocked ? `🚫` : ""}
                                  </div>
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      autoFocus
                                      className="w-full border-b border-[#5a0000] bg-transparent text-center text-xs font-semibold outline-none text-[#5a0000]"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={saveInlineEdit}
                                      onKeyDown={handleInlineKeyDown}
                                    />
                                  ) : (
                                    <div className={`text-xs font-semibold mt-0.5 ${isBlocked ? "line-through text-gray-400" : paidVal > 0 ? "text-gray-800" : "text-gray-400 font-normal"}`}>
                                      {paidVal > 0 ? `₹${paidVal}` : "-"}
                                    </div>
                                  )}
                                  {isBlocked && (
                                    <span className="block text-[7px] font-medium text-red-600 truncate mt-0.5">
                                      {status.badgeText}
                                    </span>
                                  )}
                                  {isAdmin && !isBlocked && !isEditing && (
                                    <span className="absolute right-1 top-1 text-[7px] text-amber-500 opacity-60">✎</span>
                                  )}
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

              {/* 🖥️ SLEEK & CLEAN DESKTOP TABLE */}
              <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs md:block">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/90 text-gray-600">
                        <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-700 whitespace-nowrap border-r border-gray-200 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.06)] min-w-[130px]">
                          Member Name
                        </th>
                        {activeSchedule.map((due) => {
                          const pKey = due.periodKey || due.monthKey || due.id;
                          const isBlocked = blockedMonths.includes(pKey) || due.locked;
                          const shortName = due.monthName ? due.monthName.slice(0, 4).toUpperCase() : due.monthKey;
                          return (
                            <th
                              key={due.id}
                              className={`px-2 py-2 text-center text-[10px] font-bold uppercase tracking-tight min-w-[62px] ${
                                isBlocked ? "text-rose-500 bg-rose-50/30" : "text-gray-600"
                              }`}
                            >
                              <div className="flex items-center justify-center gap-0.5">
                                <span>{shortName}</span>
                                {isBlocked && <span className="text-[9px]">🚫</span>}
                              </div>
                              {due.year && (
                                <span className="block text-[8px] font-medium text-gray-400 tracking-tighter leading-none mt-0.5">
                                  {due.year}
                                </span>
                              )}
                            </th>
                          );
                        })}
                        <th className="bg-blue-50/90 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-blue-900 border-l border-gray-200 min-w-[70px]">
                          Total
                        </th>
                        <th className="bg-amber-50/90 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-amber-900 border-l border-gray-200 min-w-[85px]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedMembers.length === 0 && (
                        <tr>
                          <td
                            colSpan={activeSchedule.length + 3}
                            className="text-center text-gray-400 py-8 text-xs font-medium uppercase tracking-wider"
                          >
                            No members found.
                          </td>
                        </tr>
                      )}
                      {sortedMembers.map((member) => {
                        const totalPaid = getMemberTotal(member.payments);
                        const remaining = getMemberExpectedTotal(member) - totalPaid;

                        return (
                          <tr key={member.id} className="transition-colors hover:bg-amber-50/20 bg-white group">
                            <td className="sticky left-0 z-10 bg-white group-hover:bg-amber-50/30 px-3 py-2 text-xs font-semibold text-gray-900 border-r border-gray-200 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.06)] whitespace-nowrap transition-colors">
                              <div className="flex items-center gap-1.5">
                                <span className="tracking-tight">{member.name}</span>
                                {member.isHonorary && (
                                  <span className="rounded border border-purple-200 bg-purple-50 px-1.5 py-[1px] text-[7.5px] font-semibold uppercase tracking-wider text-purple-700">
                                    Honorary
                                  </span>
                                )}
                              </div>
                            </td>
                            {activeSchedule.map((due) => {
                              const pKey = due.periodKey || due.monthKey || due.id;
                              const status = resolveEffectivePeriodStatus(pKey, due, blockedMonths, member.exemptMonths || []);
                              const isBlocked = status.isBlocked;
                              const isEditing = editCell.id === member.id && editCell.dueKey === pKey;
                              const paidAmt = getMemberPaymentForDue(member.payments, due);

                              return (
                                <td
                                  key={due.id}
                                  onClick={() => handleCellClick(member.id, due, paidAmt)}
                                  className={`
                                    relative px-1.5 py-2 text-center text-xs transition-all select-none
                                    ${
                                      isBlocked
                                        ? "bg-rose-50/25 text-gray-400 cursor-not-allowed"
                                        : isAdmin
                                        ? "text-gray-800 hover:bg-amber-100/50 cursor-pointer font-medium"
                                        : "text-gray-800 font-medium"
                                    }
                                  `}
                                  title={isBlocked ? status.reasonText : isAdmin ? "Click to edit amount" : ""}
                                >
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      autoFocus
                                      className="w-12 border-b border-[#5a0000] bg-transparent text-center font-semibold text-[#5a0000] outline-none text-xs"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={saveInlineEdit}
                                      onKeyDown={handleInlineKeyDown}
                                    />
                                  ) : (
                                    <div className="flex items-center justify-center relative">
                                      <span
                                        className={
                                          isBlocked
                                            ? "line-through text-gray-400 text-[11px]"
                                            : paidAmt > 0
                                            ? "font-semibold text-gray-800"
                                            : "text-gray-300 font-normal"
                                        }
                                      >
                                        {paidAmt > 0 ? `₹${paidAmt}` : "-"}
                                      </span>
                                      {isAdmin && !isBlocked && (
                                        <span className="absolute -right-1 top-0 text-[7px] text-amber-500 opacity-0 group-hover:opacity-60 transition-opacity">
                                          ✎
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            {member.isHonorary ? (
                              <>
                                <td className="bg-purple-50/20 px-3 py-2 text-center text-xs font-normal text-gray-400 border-l border-gray-200">
                                  -
                                </td>
                                <td className="bg-purple-50/20 px-3 py-2 text-center border-l border-gray-200">
                                  <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-100 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-purple-800">
                                    Honorary
                                  </span>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="bg-blue-50/30 px-3 py-2 text-center text-xs font-semibold text-blue-800 border-l border-gray-200">
                                  ₹{totalPaid.toLocaleString('en-IN')}
                                </td>
                                <td className="bg-amber-50/30 px-3 py-2 text-center border-l border-gray-200 whitespace-nowrap">
                                  {remaining > 0 ? (
                                    <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
                                      ₹{remaining.toLocaleString('en-IN')} Due
                                    </span>
                                  ) : remaining < 0 ? (
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                                      +₹{Math.abs(remaining).toLocaleString('en-IN')} Adv
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                                      Clear ✅
                                    </span>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-200 bg-gray-50/95 font-semibold">
                      <tr>
                        <td className="sticky left-0 bg-gray-50 px-3 py-2 text-[10px] font-bold text-gray-800 uppercase tracking-wider border-r border-gray-200 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.06)]">
                          Total (₹)
                        </td>
                        {activeSchedule.map((due) => {
                          const pKey = due.periodKey || due.monthKey || due.id;
                          const total = periodTotals[pKey] || 0;
                          return (
                            <td key={due.id} className="px-1.5 py-2 text-center text-xs font-semibold text-gray-800">
                              {total > 0 ? `₹${total.toLocaleString('en-IN')}` : "-"}
                            </td>
                          );
                        })}
                        <td className="bg-blue-100/60 px-3 py-2 text-center text-xs font-semibold text-blue-900 border-l border-gray-200">
                          ₹{totalCollected.toLocaleString('en-IN')}
                        </td>
                        <td className="bg-amber-100/60 px-3 py-2 text-center text-xs font-semibold text-amber-900 border-l border-gray-200 whitespace-nowrap">
                          ₹{totalDeficit.toLocaleString('en-IN')} Due
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : activeSubTab === 'buildings' ? (
            /* 🏢 SLEEK & COMPACT BUILDING MATRIX */
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Overall Building Metrics Grid */}
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

              {/* Per-Wing Collection Summary Cards (Centered & Concise) */}
              <div className="flex flex-wrap justify-center items-stretch gap-2 sm:gap-2.5 max-w-2xl mx-auto">
                {Object.entries(wingWiseMetrics).map(([wCode, wData]) => {
                  const isSelected = activeWing === wCode;
                  const total = wData.count || 0;
                  const collected = wData.collectedCount || 0;
                  const pending = Math.max(0, total - collected);
                  const progressPct = total > 0 ? Math.round((collected / total) * 100) : 0;

                  return (
                    <div
                      key={wCode}
                      onClick={() => setActiveWing(wCode)}
                      className={`flex-1 min-w-[140px] max-w-[210px] p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                        isSelected
                          ? 'bg-white border-[#5a0000] ring-2 ring-[#5a0000]/15 shadow-xs'
                          : 'bg-white border-gray-200/90 hover:border-gray-300 hover:shadow-2xs shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[11px] sm:text-xs font-bold uppercase tracking-tight ${isSelected ? 'text-[#5a0000]' : 'text-gray-900'}`}>
                          {wCode} Wing
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-emerald-700">
                          ₹{wData.collected.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {/* Collection Progress Bar */}
                      <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden my-1.5">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span className="text-gray-400 font-medium">{total} Flats</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60" title="Collected">
                            ✓ {collected}
                          </span>
                          <span className="text-[9px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60" title="Pending">
                            ✗ {pending}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white border border-gray-200/90 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3.5">

                {/* Wing Switcher - Compact Segmented */}
                <div className="flex justify-center border-b border-gray-100 pb-2.5">
                  <div className="flex gap-1.5 p-1 bg-gray-100/90 rounded-xl overflow-x-auto max-w-full custom-scrollbar border border-gray-200/60">
                    {dynWings.length > 0 ? (
                      dynWings.map((w) => (
                        <button
                          key={w.id}
                          onClick={() => setActiveWing(w.code)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                            activeWing === w.code ? 'bg-[#5A0000] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                          }`}
                        >
                          {w.name}
                        </button>
                      ))
                    ) : (
                      <>
                        <button onClick={() => setActiveWing('A')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${activeWing === 'A' ? 'bg-[#5A0000] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}>A WING</button>
                        <button onClick={() => setActiveWing('B')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${activeWing === 'B' ? 'bg-[#5A0000] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}>B WING</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Compact Editor Modal with Autosave & Blur */}
                {selectedFlat && (
                  <form
                    ref={flatEditorRef}
                    onSubmit={handleSaveFlatChanda}
                    className="bg-red-50/80 border border-red-200 p-3 rounded-xl space-y-3 animate-in fade-in duration-200 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-red-100 pb-2">
                      <h4 className="text-[11px] font-black text-red-950 uppercase tracking-wide flex items-center gap-1"><Home className="w-3 h-3 text-[#5A0000]" /> {activeWing}-{selectedFlat.split('_')[1]}</h4>
                      <button
                        type="button"
                        onClick={() => {
                          autoSaveCurrentFlat();
                          setSelectedFlat(null);
                        }}
                        className="text-[9px] font-bold text-gray-500 hover:text-red-700 bg-white px-2 py-1 rounded border border-gray-200 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[8px] font-black uppercase text-gray-500 block mb-0.5">Resident / Family Name</label>
                        <input
                          type="text"
                          placeholder="Name (Optional)"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg font-bold text-[10px] outline-none"
                          value={inputName}
                          onChange={(e) => setInputName(e.target.value)}
                          onBlur={autoSaveCurrentFlat}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[8px] font-black uppercase text-gray-500 block mb-0.5">Amount (₹)</label>
                          <input
                            type="number"
                            placeholder="501"
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg font-bold text-[10px] outline-none"
                            value={inputAmount}
                            onChange={(e) => setInputAmount(e.target.value)}
                            onBlur={autoSaveCurrentFlat}
                          />
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
                      {dynamicFlatsByFloor && dynamicFlatsByFloor.length > 0 ? (
                        dynamicFlatsByFloor.map(({ floor, items }) => (
                          <div key={floor} className="flex flex-row items-stretch gap-1.5 bg-[#593014]/95 p-1.5 rounded-lg border-b-2 border-[#4A2711] shadow-inner">
                            {/* Floor Indicator Elevator Box */}
                            <div className="flex items-center justify-center bg-[#2D170A] rounded-md w-6 sm:w-8 text-yellow-400 font-black text-[8px] uppercase tracking-tighter border border-[#1F0F06] shadow-inner shrink-0">
                              {floor === '0' ? 'GR' : `${floor}F`}
                            </div>

                            {/* Flat Windows Matrix */}
                            <div className="grid grid-cols-4 gap-1.5 flex-1">
                              {items.map((flat) => {
                                const isCollected = flat.paymentStatus === 'Paid' || (Number(flat.paidChanda) > 0 && Number(flat.paidChanda) >= Number(flat.expectedChanda));
                                const isPartial = flat.paymentStatus === 'Partially Paid' || (!isCollected && Number(flat.paidChanda) > 0);
                                const isSelected = selectedFlat === flat.id || selectedFlat === `${activeWing}_${flat.flatNumber}`;

                                return (
                                  <div
                                    key={flat.id}
                                    onClick={() => handleSelectFlatTile(activeWing, flat.flatNumber)}
                                    className={`cursor-pointer p-1.5 rounded-md flex flex-col items-center justify-center relative overflow-hidden transition-all border-b-[2px] active:scale-95 select-none
                                    ${isCollected
                                        ? 'bg-green-50/95 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                                        : isPartial
                                        ? 'bg-amber-50/95 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                                        : 'bg-[#FFFBF5]/95 border-[#C4A484] hover:bg-white'} 
                                    ${isSelected ? 'ring-[1.5px] ring-red-500 border-transparent' : ''}`}
                                  >
                                    {/* Window Glass Reflection Effect */}
                                    <div className="absolute top-0 right-0 w-6 h-10 bg-white/20 rotate-45 transform translate-x-3 -translate-y-3 pointer-events-none"></div>

                                    {/* Window Number */}
                                    <span className={`font-black text-[10px] leading-none z-10 ${isCollected ? 'text-green-900' : 'text-[#4A2711]'}`}>
                                      {flat.flatNumber}
                                    </span>

                                    {/* Name (Tiny) */}
                                    <span className={`text-[6px] font-bold truncate w-full text-center leading-tight mt-0.5 z-10 ${isCollected ? 'text-green-700' : 'text-[#6E3C1A]'}`}>
                                      {flat.residentName || '-'}
                                    </span>

                                    {/* Amount/Status Badge */}
                                    <div className={`mt-0.5 px-1 py-[1px] rounded-[3px] text-[6px] sm:text-[7px] font-black w-full text-center z-10 ${isCollected ? 'bg-green-200/50 text-green-800' : isPartial ? 'bg-amber-200/50 text-amber-900' : 'bg-[#DFD3C3] text-[#4A2711]'}`}>
                                      {isCollected ? `₹${flat.paidChanda}` : isPartial ? `₹${flat.paidChanda} P` : 'PENDING'}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      ) : (
                        FLOORS.map((floor) => (
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
                        ))
                      )}
                    </div>
                  </div>
                  {/* Foundation */}
                  <div className="w-full h-2 bg-[#2D170A] rounded-b-lg shadow-xl mt-[-2px]"></div>
                </div>
              </div>
            </div>
          ) : activeSubTab === 'others' ? (
            /* OTHERS (Dost & Dukan) TAB - COMPACT */
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white border border-gray-100 p-2.5 sm:p-3 rounded-xl text-center shadow-xs">
                  <span className="text-[8px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Total Extra</span>
                  <span className="text-xs sm:text-sm font-black text-green-700">₹{otherMetrics.totalCollected.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-white border border-gray-100 p-2.5 sm:p-3 rounded-xl text-center shadow-xs">
                  <span className="text-[8px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Total Entries</span>
                  <span className="text-xs sm:text-sm font-black text-gray-800">{otherMetrics.entryCount} Logs</span>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs">
                <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-widest mb-2.5 flex items-center gap-1.5 border-b border-gray-100 pb-2"><UserPlus className="w-3 h-3 text-[#5A0000]" /> New Entry</h3>
                <form onSubmit={handleAddOtherChanda} className="space-y-2.5">
                  <div>
                    <label className="text-[8px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Name / Shop</label>
                    <input type="text" required placeholder="E.g., Raju Store" className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg font-bold text-xs bg-gray-50 outline-none focus:bg-white focus:border-[#5A0000]" value={otherName} onChange={(e) => setOtherName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Amount (₹)</label>
                      <input type="number" required placeholder="101" className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg font-bold text-xs bg-gray-50 outline-none focus:bg-white focus:border-[#5A0000]" value={otherAmount} onChange={(e) => setOtherAmount(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Status</label>
                      <CustomSelect value={otherStatus} onChange={(val: 'Pending' | 'Collected') => setOtherStatus(val)} options={[{ value: 'Pending', label: '❌ Pend' }, { value: 'Collected', label: '✅ Done' }]} />
                    </div>
                  </div>
                  <button type="submit" disabled={isAddingOther} className="w-full bg-[#5A0000] text-white font-black uppercase text-[10px] py-2 rounded-lg shadow-xs mt-1 cursor-pointer">{isAddingOther ? "Adding..." : "Add to Ledger"}</button>
                </form>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs">
                <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-widest mb-2.5 border-b border-gray-100 pb-1.5">Recent Logs</h3>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                  {otherPayments.length === 0 ? (
                    <p className="text-center text-[9px] font-bold uppercase tracking-widest text-gray-400 py-3">No entries yet.</p>
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

                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          <span className={`font-black text-xs ${entry.status === 'Collected' ? 'text-green-700' : 'text-gray-400'}`}>₹{entry.amount}</span>

                          {/* 🔥 DELETE ACTION BUTTON */}
                          <button
                            onClick={() => handleDeleteOtherLog(entry.id, entry.name, entry.amount)}
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
            /* 🔥 EXPENSES TAB - COMPACT MOBILE */
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="bg-white border border-gray-100 p-3 sm:p-4 rounded-xl text-center shadow-xs">
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Total Kharcha (Expenses)</span>
                <span className="text-xl sm:text-2xl font-black text-red-600">
                  ₹{expenseLogs.reduce((sum, exp) => sum + Number(exp.amount), 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs">
                <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-widest mb-2.5 border-b border-gray-100 pb-1.5">
                  Expense Logs
                </h3>
                <div className="space-y-1.5 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                  {expenseLogs.length === 0 ? (
                     <p className="text-center text-[9px] font-bold uppercase tracking-widest text-gray-400 py-3">No expenses recorded yet.</p>
                  ) : (
                    expenseLogs.map((exp, index) => (
                      <div key={exp.id || index} className="flex items-center justify-between p-2 border border-red-100 rounded-lg bg-red-50/20 group transition-all">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-black text-xs shrink-0">
                            <IndianRupee className="w-3 h-3" />
                          </div>
                          <div className="truncate">
                            <p className="text-[11px] font-black text-gray-800 uppercase leading-none truncate">{exp.name}</p>
                            <p className="text-[8px] font-bold text-gray-400 mt-0.5">{exp.date} • {exp.time}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          <span className="font-black text-xs text-red-600">-₹{exp.amount}</span>
                          
                          {/* 🔥 UPDATED ACTION BUTTON WITH EVENT PASSING */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteExpenseLog(exp.id, exp.name, exp.amount);
                              }}
                              className="text-gray-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all cursor-pointer relative z-50 block"
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
