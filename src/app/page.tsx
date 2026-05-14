"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

const MONTHLY_TARGET = 100;
const PREVIOUS_YEAR = 6500;
const MONTHS = [
  "SEPT",
  "OCT",
  "NOV",
  "DEC",
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
] as const;

type Month = (typeof MONTHS)[number];

type Member = {
  id: number;
  name: string;
  payments: Partial<Record<Month, number>>;
  isHonorary?: boolean;
};

const STORAGE_KEYS = {
  members: "siyaram_members",
  blockedMonths: "siyaram_blocked_months",
  user: "siyaram_user",
  admin: "siyaram_admin",
} as const;

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
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEPT",
    "OCT",
    "NOV",
    "DEC",
  ];

  return jsMonths[new Date().getMonth()];
}

function isMonth(value: string): value is Month {
  return MONTHS.includes(value as Month);
}

function sanitizeMembers(value: unknown): Member[] {
  if (!Array.isArray(value)) {
    return DEFAULT_MEMBERS;
  }

  const validMembers = value.filter((item): item is Member => {
    if (!item || typeof item !== "object") return false;

    const candidate = item as Member;
    return (
      typeof candidate.id === "number" &&
      typeof candidate.name === "string" &&
      candidate.name.trim().length > 0 &&
      candidate.payments !== null &&
      typeof candidate.payments === "object"
    );
  });

  if (validMembers.length === 0) {
    return DEFAULT_MEMBERS;
  }

  const savedByName = new Map(validMembers.map((member) => [normalizeMemberCode(member.name), member]));
  const mergedMembers = [...validMembers];

  for (const defaultMember of DEFAULT_MEMBERS) {
    const existing = savedByName.get(normalizeMemberCode(defaultMember.name));
    if (!existing) {
      mergedMembers.push(defaultMember);
    }
  }

  return mergedMembers;
}

export default function CleanDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [isSplashExiting, setIsSplashExiting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<Member | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [adminError, setAdminError] = useState("");
  const [loginId, setLoginId] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [currentTrackingMonth, setCurrentTrackingMonth] = useState<Month>(getCurrentTrackingMonth());
  const [blockedMonths, setBlockedMonths] = useState<Month[]>([]);
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>(DEFAULT_MEMBERS);
  const [paymentMemberId, setPaymentMemberId] = useState("");
  const [paymentMonth, setPaymentMonth] = useState<Month>(getCurrentTrackingMonth());
  const [paymentAmount, setPaymentAmount] = useState(String(MONTHLY_TARGET));
  const [newMemberName, setNewMemberName] = useState("");
  const [isNewMemberHonorary, setIsNewMemberHonorary] = useState(false);
  const [editCell, setEditCell] = useState<{ id: number | null; month: Month | null }>({ id: null, month: null });
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedMembers = window.localStorage.getItem(STORAGE_KEYS.members);
      const savedBlockedMonths = window.localStorage.getItem(STORAGE_KEYS.blockedMonths);
      const savedUser = window.localStorage.getItem(STORAGE_KEYS.user);
      const savedAdmin = window.localStorage.getItem(STORAGE_KEYS.admin);

      if (savedMembers) {
        setMembers(sanitizeMembers(JSON.parse(savedMembers)));
      }

      if (savedBlockedMonths) {
        const parsedMonths = JSON.parse(savedBlockedMonths) as string[];
        setBlockedMonths(parsedMonths.filter(isMonth));
      }

      // Restore login session
      if (savedUser) {
        const user = JSON.parse(savedUser) as Member;
        setLoggedInUser(user);
        setIsLoggedIn(true);
      }

      if (savedAdmin === "true") {
        setIsAdmin(true);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEYS.members);
      window.localStorage.removeItem(STORAGE_KEYS.blockedMonths);
      window.localStorage.removeItem(STORAGE_KEYS.user);
      window.localStorage.removeItem(STORAGE_KEYS.admin);
    }

    const autoMonth = getCurrentTrackingMonth();
    setCurrentTrackingMonth(autoMonth);
    setPaymentMonth(autoMonth);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(members));
    window.localStorage.setItem(STORAGE_KEYS.blockedMonths, JSON.stringify(blockedMonths));
  }, [members, blockedMonths]);

  // Persist login state
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isLoggedIn && loggedInUser) {
      window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(loggedInUser));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.user);
    }
  }, [isLoggedIn, loggedInUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.admin, isAdmin ? "true" : "false");
  }, [isAdmin]);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => {
      setIsSplashExiting(true);
    }, 2500);

    const hideTimer = window.setTimeout(() => {
      setIsLoading(false);
      window.setTimeout(() => {
        setIsSplashVisible(false);
      }, 500);
    }, 3500);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    setPaymentMonth(currentTrackingMonth);
  }, [currentTrackingMonth]);

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
  const maxYearlyTarget = (MONTHS.length - blockedMonths.length) * MONTHLY_TARGET;

  const monthlyTotals = useMemo(
    () =>
      MONTHS.reduce((acc, month) => {
        acc[month] = members.reduce((sum, member) => sum + (member.payments[month] || 0), 0);
        return acc;
      }, {} as Record<Month, number>),
    [members]
  );

  const toggleExpandedMember = (memberId: number) => {
    setExpandedMemberId((currentExpandedMemberId) =>
      currentExpandedMemberId === memberId ? null : memberId
    );
  };

  const toggleBlockMonth = (month: Month) => {
    setBlockedMonths((currentBlockedMonths) =>
      currentBlockedMonths.includes(month)
        ? currentBlockedMonths.filter((blockedMonth) => blockedMonth !== month)
        : [...currentBlockedMonths, month]
    );
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");

    const normalizedId = normalizeMemberCode(loginId);
    const targetUser = members.find((member) => normalizeMemberCode(member.name) === normalizedId);
    const expectedPass = `${normalizedId}bappa`;

    if (targetUser && loginPass.trim().toLowerCase() === expectedPass) {
      setIsLoggedIn(true);
      setLoggedInUser(targetUser);
      return;
    }

    setLoginError("Invalid member ID or password.");
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoggedInUser(null);
    setIsAdmin(false);
    setLoginId("");
    setLoginPass("");
  };

  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false);
      setShowAdminModal(false);
      return;
    }

    setAdminPasscode("");
    setAdminError("");
    setShowAdminModal(true);
  };

  const verifyAdminPasscode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (adminPasscode === "Rishi@8468") {
      setIsAdmin(true);
      setShowAdminModal(false);
      setAdminPasscode("");
      setAdminError("");
      return;
    }

    setAdminError("Incorrect passcode. Access denied.");
  };

  const cancelAdminLogin = () => {
    setShowAdminModal(false);
    setAdminPasscode("");
    setAdminError("");
  };

  const handleLogPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const memberId = Number(paymentMemberId);
    const amount = Number(paymentAmount);

    if (!Number.isFinite(memberId) || !Number.isFinite(amount) || amount <= 0) {
      window.alert("Please choose a member and enter a valid amount.");
      return;
    }

    setMembers((currentMembers) =>
      currentMembers.map((member) => {
        if (member.id !== memberId) return member;

        const currentAmount = member.payments[paymentMonth] || 0;

        return {
          ...member,
          payments: {
            ...member.payments,
            [paymentMonth]: currentAmount + amount,
          },
        };
      })
    );

    setPaymentAmount(String(MONTHLY_TARGET));
    setPaymentMemberId("");
  };

  const handleAddMember = (event: FormEvent<HTMLFormElement>) => {
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

    setMembers((currentMembers) => [
      ...currentMembers,
      {
        id: nextId,
        name: trimmedName.toUpperCase(),
        payments: {},
        isHonorary: isNewMemberHonorary,
      },
    ]);

    setNewMemberName("");
    setIsNewMemberHonorary(false);
  };

  // --- INLINE EDITING LOGIC ---
  const handleCellClick = (memberId: number, month: Month, currentValue: number | undefined) => {
    if (isAdmin && !blockedMonths.includes(month)) {
      setEditCell({ id: memberId, month: month });
      setEditValue(String(currentValue || ""));
    }
  };

  const saveInlineEdit = () => {
    if (editCell.id !== null && editCell.month !== null) {
      const numValue = parseInt(editValue) || 0;
      const monthToUpdate = editCell.month; // Store in variable for TypeScript
      setMembers((currentMembers) =>
        currentMembers.map((member) => {
          if (member.id === editCell.id) {
            return {
              ...member,
              payments: {
                ...member.payments,
                [monthToUpdate]: numValue,
              },
            };
          }
          return member;
        })
      );
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

  if (isSplashVisible) {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#5a0000] via-[#3a0000] to-black px-6 transition-opacity duration-500 ${
          isSplashExiting ? "opacity-0" : "opacity-100"
        }`}
      >
        <style>{`
          @keyframes premiumFadeIn {
            0% { opacity: 0; transform: translateY(15px); filter: blur(4px); }
            100% { opacity: 1; transform: translateY(0); filter: blur(0); }
          }
          @keyframes lineExpand {
            0% { width: 0; opacity: 0; }
            100% { width: 12rem; opacity: 1; }
          }
          .animate-text-1 { animation: premiumFadeIn 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
          .animate-line { animation: lineExpand 1s ease-out 1s forwards; opacity: 0; }
          .animate-text-2 { opacity: 0; animation: premiumFadeIn 1.5s cubic-bezier(0.25, 1, 0.5, 1) 1.5s forwards; }
        `}</style>

        <div className="absolute h-[280px] w-[280px] rounded-full border border-yellow-600/30 shadow-[0_0_60px_rgba(202,138,4,0.15)] md:h-[380px] md:w-[380px]" />
        <div
          className="absolute h-[300px] w-[300px] rounded-full border-[2px] border-yellow-700/40 animate-ping md:h-[400px] md:w-[400px]"
          style={{ animationDuration: "3s" }}
        />
        <div className="absolute h-[320px] w-[320px] rounded-full border border-yellow-500/10 animate-pulse delay-300 md:h-[420px] md:w-[420px]" />

        <div className="relative z-10 flex flex-col items-center space-y-8 p-6 text-center drop-shadow-2xl">
          <h1
            className="animate-text-1 bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-5xl font-normal tracking-wide text-transparent md:text-7xl"
            style={{ fontFamily: "'Rozha One', serif", fontWeight: 400 }}
          >
            गणपती बाप्पा मोरया
          </h1>
          <div className="animate-line h-[2px] w-48 bg-gradient-to-r from-transparent via-yellow-600/80 to-transparent" />
          <h2
            className="animate-text-2 text-3xl font-bold tracking-wider text-yellow-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] md:text-5xl"
            style={{ fontFamily: "'Gotu', sans-serif", fontWeight: 400 }}
          >
            सियाराम मित्रमंडळ
          </h2>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
          <div className="bg-gradient-to-br from-[#5a0000] to-[#2e0000] px-8 py-8 text-center">
            <h1 className="text-3xl text-yellow-300" style={{ fontFamily: "'Rozha One', serif", fontWeight: 400 }}>
              Siyaram Mitra Mandal
            </h1>
            <p className="mt-2 text-sm font-medium text-red-100">Member Access Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 p-8">
            {loginError ? (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{loginError}</div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">Member ID</label>
              <input
                type="text"
                placeholder="Enter Member ID"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">Password</label>
              <input
                type="password"
                placeholder="Enter Password"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                value={loginPass}
                onChange={(event) => setLoginPass(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-[#5a0000] px-4 py-3 font-bold text-white shadow-lg transition-colors hover:bg-[#7b0000]"
            >
              Verify & Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 text-gray-900 md:px-12 md:py-12">
      {showAdminModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-gradient-to-br from-[#5a0000] to-[#2e0000] px-6 py-5 text-center">
              <h3 className="text-xl font-bold text-yellow-300">Admin Authorization</h3>
              <p className="mt-1 text-xs uppercase tracking-[0.3em] text-red-200">Security Gateway</p>
            </div>

            <form onSubmit={verifyAdminPasscode} className="space-y-4 p-6">
              {adminError ? (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-600">
                  {adminError}
                </div>
              ) : null}

              <input
                type="password"
                autoFocus
                placeholder="Enter Passcode"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center tracking-[0.3em] outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                value={adminPasscode}
                onChange={(event) => setAdminPasscode(event.target.value)}
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelAdminLogin}
                  className="w-full rounded-xl bg-gray-100 py-3 font-bold text-gray-600 transition-colors hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#5a0000] py-3 font-bold text-white shadow-md transition-colors hover:bg-[#7b0000]"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl space-y-6 md:space-y-8">
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
              <div
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  loggedInUser?.isHonorary ? "bg-purple-50 text-purple-700" : "bg-green-50 text-green-700"
                }`}
              >
                Logged in as {loggedInUser?.name}
                {loggedInUser?.isHonorary ? " 🌟 Honorary" : ""}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-semibold text-gray-500 underline decoration-gray-300 underline-offset-4 hover:text-red-600"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="flex w-full items-center gap-4 md:w-auto">
            <div className="flex-grow rounded-xl border border-gray-200 bg-white px-5 py-3 text-left shadow-sm md:flex-grow-0 md:text-right">
              <span className="mb-1 block text-xs text-gray-500 uppercase tracking-wider">Grand Total (Inc. Prev Year)</span>
              <span className="text-xl font-bold text-green-700 md:text-2xl">₹{grandTotal.toLocaleString()}</span>
            </div>

            <button
              type="button"
              onClick={handleAdminToggle}
              className={`relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border-2 shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 md:h-16 md:w-16 ${
                isAdmin
                  ? "border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)]"
                  : "border-gray-200 hover:border-[#5a0000]"
              }`}
              title="Admin Access"
              aria-label="Admin Access"
            >
              <img src="/logo.png" alt="Siyaram Mandal Logo" className="h-full w-full object-cover" />
            </button>
          </div>
        </header>

        {isAdmin ? (
          <div className="space-y-6 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm md:p-6">
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
                      onChange={(event) => setPaymentMemberId(event.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Select Member
                      </option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
                      value={paymentMonth}
                      onChange={(event) => setPaymentMonth(event.target.value as Month)}
                    >
                      {MONTHS.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      className="w-full rounded-lg border border-gray-200 p-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder="Amount"
                      required
                    />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-[#5a0000] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#7b0000]"
                    >
                      Log Payment
                    </button>
                  </div>
                </form>
              </div>

              <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-red-800">Add New Member</h3>
                <form onSubmit={handleAddMember} className="flex flex-col gap-3">
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
                    value={newMemberName}
                    onChange={(event) => setNewMemberName(event.target.value)}
                    placeholder="Enter Name (e.g. RAHUL)"
                    required
                  />

                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                    <input
                      type="checkbox"
                      checked={isNewMemberHonorary}
                      onChange={(event) => setIsNewMemberHonorary(event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    Mark as Honorary member
                  </label>

                  <button
                    type="submit"
                    className="mt-auto rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-green-800"
                  >
                    Add to Mandal
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <SummaryCard label="Total Collected (YTD)" value={`₹${totalCollected.toLocaleString()}`} />
          <SummaryCard
            label={`Total Dues (Up to ${currentTrackingMonth})`}
            value={`₹${totalDeficit.toLocaleString()}`}
            accentClassName="text-orange-600"
            badge={`₹${expectedTotalPerMember} Target`}
          />
          <SummaryCard label="Previous Year Balance" value={`₹${PREVIOUS_YEAR.toLocaleString()}`} muted />
        </div>

        <div className="block space-y-3 md:hidden">
          {members.map((member) => {
            const totalPaid = getMemberTotal(member.payments);
            const remaining = expectedTotalPerMember - totalPaid;
            const isExpanded = expandedMemberId === member.id;

            return (
              <div key={member.id} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleExpandedMember(member.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 truncate text-sm font-bold text-gray-900">
                      <span>{member.name}</span>
                      {member.isHonorary ? (
                        <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
                          Honorary
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Total Paid: <span className="font-semibold text-gray-800">₹{totalPaid}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {member.isHonorary ? (
                      <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-700">
                        Honorary
                      </span>
                    ) : remaining > 0 ? (
                      <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-600">
                        ₹{remaining} Due
                      </span>
                    ) : remaining < 0 ? (
                      <span className="rounded-md bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700">
                        Adv ₹{Math.abs(remaining)}
                      </span>
                    ) : (
                      <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">
                        Clear
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="border-t border-gray-50 bg-gray-50/60 px-4 pb-4 pt-3">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {MONTHS.map((month) => {
                        const isBlocked = blockedMonths.includes(month);
                        const isEditing = editCell.id === member.id && editCell.month === month;

                        return (
                          <div
                            key={month}
                            onClick={() => handleCellClick(member.id, month, member.payments[month])}
                            className={`relative rounded-lg border p-2 text-center shadow-sm ${
                              isBlocked
                                ? "border-red-200 bg-gray-100"
                                : isAdmin
                                  ? "border-yellow-300 cursor-pointer bg-white hover:bg-yellow-50"
                                  : "border-gray-100 bg-white"
                            }`}
                          >
                            <div className="text-[10px] font-bold uppercase text-gray-400">
                              {month} {isBlocked ? "🚫" : ""}
                            </div>
                            {isEditing ? (
                              <input
                                type="number"
                                autoFocus
                                className="w-full border-b-2 border-[#5a0000] bg-transparent text-center text-sm font-bold outline-none"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveInlineEdit}
                                onKeyDown={handleInlineKeyDown}
                              />
                            ) : (
                              <div
                                className={`text-sm font-semibold ${
                                  isBlocked ? "line-through text-gray-400" : "text-gray-800"
                                }`}
                              >
                                {member.payments[month] ? `₹${member.payments[month]}` : "-"}
                              </div>
                            )}
                            {isAdmin && !isBlocked && !isEditing && (
                              <span className="absolute right-1 top-1 text-[8px] text-yellow-500 opacity-50">✎</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  {MONTHS.map((month) => (
                    <th
                      key={month}
                      className={`px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider ${
                        blockedMonths.includes(month) ? "text-red-400" : "text-gray-500"
                      }`}
                    >
                      {month} {blockedMonths.includes(month) ? "🚫" : ""}
                    </th>
                  ))}
                  <th className="bg-blue-50 px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-900">
                    Total
                  </th>
                  <th className="bg-orange-50 px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-900">
                    Remaining
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((member) => {
                  const totalPaid = getMemberTotal(member.payments);
                  const remaining = expectedTotalPerMember - totalPaid;

                  return (
                    <tr key={member.id} className="transition-colors hover:bg-gray-50">
                      <td className="sticky left-0 bg-white px-6 py-4 text-sm font-medium text-gray-900 shadow-[1px_0_0_0_#f3f4f6]">
                        <div className="flex items-center gap-2">
                          <span>{member.name}</span>
                          {member.isHonorary ? (
                            <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
                              Honorary
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {MONTHS.map((month) => {
                        const isBlocked = blockedMonths.includes(month);
                        const isEditing = editCell.id === member.id && editCell.month === month;

                        return (
                          <td
                            key={month}
                            onClick={() => handleCellClick(member.id, month, member.payments[month])}
                            className={`relative px-4 py-4 text-center text-sm transition-colors ${
                              isBlocked
                                ? "bg-gray-50 text-gray-400"
                                : isAdmin
                                  ? "cursor-pointer hover:bg-yellow-50 hover:shadow-inner"
                                  : "text-gray-600"
                            }`}
                            title={isAdmin && !isBlocked ? "Click to edit" : ""}
                          >
                            {isEditing ? (
                              <input
                                type="number"
                                autoFocus
                                className="w-16 border-b-2 border-red-500 bg-transparent text-center font-bold text-[#5a0000] outline-none"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveInlineEdit}
                                onKeyDown={handleInlineKeyDown}
                              />
                            ) : (
                              <>
                                {member.payments[month] ? `₹${member.payments[month]}` : "-"}
                                {isAdmin && !isBlocked && !isEditing && (
                                  <span className="absolute right-2 top-2 text-[10px] text-gray-300 group-hover:text-yellow-600">✎</span>
                                )}
                              </>
                            )}
                          </td>
                        );
                      })}

                      {member.isHonorary ? (
                        <>
                          <td className="bg-purple-50/30 px-6 py-4 text-center text-sm font-bold text-gray-400">-</td>
                          <td className="bg-purple-50/30 px-6 py-4 text-center">
                            <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-800">
                              Honorary
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="bg-blue-50/30 px-6 py-4 text-center text-sm font-bold text-gray-900">
                            ₹{totalPaid}
                          </td>
                          <td className="bg-orange-50/30 px-6 py-4 text-center">
                            {remaining > 0 ? (
                              <span className="text-sm font-semibold text-red-600">₹{remaining} Due</span>
                            ) : remaining < 0 ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                +₹{Math.abs(remaining)} Advance
                              </span>
                            ) : (
                              <span className="text-sm font-semibold text-orange-600">Clear</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>

              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td className="sticky left-0 bg-gray-50 px-6 py-4 text-sm font-bold text-gray-900">TOTAL</td>
                  {MONTHS.map((month) => (
                    <td
                      key={month}
                      className={`px-4 py-4 text-center text-sm font-bold ${blockedMonths.includes(month) ? "text-gray-400" : "text-gray-900"}`}
                    >
                      {monthlyTotals[month] > 0 ? `₹${monthlyTotals[month]}` : "-"}
                    </td>
                  ))}
                  <td className="bg-blue-100/50 px-6 py-4 text-center text-sm font-bold text-blue-700">
                    ₹{totalCollected}
                  </td>
                  <td className="bg-orange-100/50 px-6 py-4 text-center text-sm font-bold text-orange-700">
                    ₹{totalDeficit.toLocaleString()} Due
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accentClassName,
  muted,
  badge,
}: Readonly<{
  label: string;
  value: string;
  accentClassName?: string;
  muted?: boolean;
  badge?: string;
}>) {
  return (
    <div className="flex flex-col justify-center rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>
        {badge ? (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">{badge}</span>
        ) : null}
      </div>
      <span className={`text-3xl font-bold ${accentClassName ?? "text-gray-900"} ${muted ? "text-gray-400" : ""}`}>
        {value}
      </span>
    </div>
  );
}