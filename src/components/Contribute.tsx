"use client";

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ArrowRight, CheckCircle2, Crown, IndianRupee, Loader2, Medal, QrCode, Trophy } from 'lucide-react';

type Donor = {
  id: string;
  name: string;
  photo?: string | null;
  total: number;
  latestMessage?: string;
};

export default function Contribute({ userData }: { userData: any }) {
  const [view, setView] = useState<'donate' | 'leaderboard'>('donate');
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [utr, setUtr] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Donor[]>([]);

  const MANDAL_UPI_ID = '8468988419@naviaxis';
  const MANDAL_NAME = 'NEHA UTTAM KUMAR SAHU';

  useEffect(() => {
    const q = query(collection(db, 'chanda_payments'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const payments = snap.docs.map((doc) => doc.data() as any);
        const approved = payments.filter((payment) => payment.status === 'Approved');
        const userTotals: Record<string, Donor & { latestAt?: number }> = {};

        approved.forEach((payment: any) => {
          if (!payment.userId) return;
          const paymentTime = typeof payment.timestamp?.toMillis === 'function' ? payment.timestamp.toMillis() : 0;

          if (!userTotals[payment.userId]) {
            userTotals[payment.userId] = {
              id: payment.userId,
              name: payment.userName || 'Anonymous',
              photo: payment.userPhoto || null,
              total: 0,
              latestMessage: payment.message || '',
              latestAt: paymentTime,
            };
          }

          userTotals[payment.userId].total += Number(payment.amount) || 0;
          if (paymentTime > (userTotals[payment.userId].latestAt || 0)) {
            userTotals[payment.userId].latestAt = paymentTime;
            userTotals[payment.userId].latestMessage = payment.message || '';
          }
        });

        const sortedLeaderboard = Object.values(userTotals)
          .sort((a, b) => b.total - a.total)
          .map(({ latestAt, ...donor }) => donor);

        setLeaderboard(sortedLeaderboard);
      },
      (error) => {
        console.error('Leaderboard listener error:', error);
        setLeaderboard([]);
      }
    );

    return () => unsub();
  }, []);

  const handleProceed = () => {
    const finalAmount = amount || parseInt(customAmount);
    if (finalAmount && finalAmount > 0) {
      setAmount(finalAmount);
      setStep(2);
    }
  };

  const getUpiUrl = () => {
    return `upi://pay?pa=${MANDAL_UPI_ID}&pn=${encodeURIComponent(MANDAL_NAME)}&am=${amount}&cu=INR`;
  };

  const handleSubmitChanda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utr || utr.length < 6) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'chanda_payments'), {
        userId: userData.uid || 'anonymous',
        userName: userData.name,
        userPhoto: userData.photoURL || null,
        amount,
        utr_number: utr,
        message,
        status: 'Pending',
        timestamp: new Date(),
      });
      setStep(3);
    } catch (error) {
      console.error('Error submitting contribution:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center pb-20">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-4 mt-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-yellow-200/50 bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-[0_0_30px_rgba(202,138,4,0.3)]">
            <Trophy className="h-8 w-8 text-[#5a0000]" />
          </div>
          <h2 className="bg-gradient-to-r from-yellow-500 to-yellow-200 bg-clip-text text-3xl font-black text-transparent drop-shadow-md" style={{ fontFamily: "'Cinzel', serif" }}>
            Mandal Chanda
          </h2>

          <div className="mx-auto mt-4 flex w-3/4 rounded-full border border-yellow-500/30 bg-[#2a0808]/80 p-1 shadow-inner backdrop-blur-xl">
            <button
              onClick={() => setView('donate')}
              className={`flex-1 rounded-full py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'donate' ? 'bg-gradient-to-r from-yellow-600 to-yellow-400 text-black shadow-[0_0_15px_rgba(202,138,4,0.5)]' : 'text-yellow-100/60 hover:text-yellow-100'}`}
            >
              Donate
            </button>
            <button
              onClick={() => setView('leaderboard')}
              className={`flex-1 rounded-full py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'leaderboard' ? 'bg-gradient-to-r from-yellow-600 to-yellow-400 text-black shadow-[0_0_15px_rgba(202,138,4,0.5)]' : 'text-yellow-100/60 hover:text-yellow-100'}`}
            >
              Leaderboard
            </button>
          </div>
        </div>

        {view === 'donate' && (
          <div className="animate-in slide-in-from-left duration-300">
            {step === 1 && (
              <div className="rounded-3xl border border-yellow-500/20 bg-[#1a0505]/70 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                <h3 className="mb-4 text-center text-sm font-bold uppercase tracking-wider text-yellow-500 drop-shadow-sm">Select Amount</h3>

                <div className="mb-6 grid grid-cols-3 gap-3">
                  {[11, 21, 51, 101, 501, 1100].map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        setAmount(val);
                        setCustomAmount('');
                      }}
                      className={`rounded-xl border py-3 text-sm font-bold transition-all ${
                        amount === val
                          ? 'scale-105 border-yellow-400 bg-gradient-to-r from-yellow-600 to-yellow-400 text-black shadow-[0_0_20px_rgba(202,138,4,0.4)]'
                          : 'border-white/10 bg-white/5 text-yellow-100 hover:border-yellow-500/30 hover:bg-white/10'
                      }`}
                    >
                      ₹{val}
                    </button>
                  ))}
                </div>

                <div className="relative mb-6">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <IndianRupee className="h-4 w-4 text-yellow-500/50" />
                  </div>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setAmount(null);
                    }}
                    placeholder="Other Amount"
                    className="w-full rounded-xl border border-yellow-500/20 bg-[#3a0a0a]/50 py-3 pl-10 pr-4 text-yellow-100 outline-none transition-all placeholder:text-yellow-100/40 focus:border-yellow-400 focus:bg-[#4a0d0d]/50 shadow-inner"
                  />
                </div>

                <button
                  onClick={handleProceed}
                  disabled={!amount && (!customAmount || parseInt(customAmount) <= 0)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-600 to-yellow-400 py-4 text-xs font-black uppercase tracking-widest text-black shadow-[0_5px_15px_rgba(202,138,4,0.3)] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Proceed <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 rounded-3xl border border-yellow-500/20 bg-[#1a0505]/70 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                <div className="border-b border-white/10 pb-4 text-center">
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-yellow-100/60">Paying Amount</p>
                  <h3 className="bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-5xl font-black text-transparent drop-shadow-md">₹{amount}</h3>
                </div>

                <div className="flex flex-col items-center rounded-2xl border-4 border-yellow-500/30 bg-white p-4 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getUpiUrl())}`}
                    alt="UPI QR Code"
                    className="h-48 w-48 rounded-xl mix-blend-multiply"
                  />
                  <p className="mt-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-600">
                    Scan with any UPI App<br />
                    (GPay, PhonePe, Paytm)
                  </p>
                </div>

                <a
                  href={getUpiUrl()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-green-600 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all hover:brightness-110 active:scale-95"
                >
                  <QrCode className="h-5 w-5" /> Pay via UPI App
                </a>

                <form onSubmit={handleSubmitChanda} className="space-y-4 border-t border-white/10 pt-4">
                  <h4 className="text-center text-sm font-bold uppercase tracking-wider text-yellow-500 drop-shadow-sm">Enter Details After Payment</h4>

                  <div>
                    <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-yellow-100/70">Transaction ID (UTR) *</label>
                    <input
                      required
                      type="text"
                      value={utr}
                      onChange={(e) => setUtr(e.target.value)}
                      placeholder="e.g. 31234567890"
                      className="mt-1 w-full rounded-xl border border-yellow-500/20 bg-[#3a0a0a]/50 px-4 py-3 text-yellow-100 outline-none transition-all placeholder:text-yellow-100/40 focus:border-yellow-400 focus:bg-[#4a0d0d]/50 shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-yellow-100/70">Sankalp / Message (Optional)</label>
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="e.g. Ganpati Bappa Morya!"
                      className="mt-1 w-full rounded-xl border border-yellow-500/20 bg-[#3a0a0a]/50 px-4 py-3 text-yellow-100 outline-none transition-all placeholder:text-yellow-100/40 focus:border-yellow-400 focus:bg-[#4a0d0d]/50 shadow-inner"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || utr.length < 6}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-600 to-yellow-400 py-4 text-xs font-black uppercase tracking-widest text-black shadow-[0_0_20px_rgba(202,138,4,0.3)] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Submit Verification
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-white/50 transition-colors hover:text-white"
                  >
                    Change Amount
                  </button>
                </form>
              </div>
            )}

            {step === 3 && (
              <div className="mt-6 space-y-4 rounded-3xl border border-green-500/30 bg-[#1a0505]/70 p-8 text-center shadow-[0_0_30px_rgba(34,197,94,0.15)] backdrop-blur-2xl animate-in zoom-in duration-500">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-green-500/50 bg-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                  <CheckCircle2 className="h-10 w-10 text-green-400" />
                </div>
                <h3 className="text-2xl font-black text-white drop-shadow-md" style={{ fontFamily: "'Cinzel', serif" }}>Details Sent!</h3>
                <p className="px-4 text-xs leading-relaxed text-yellow-100/80">
                  Aapka chanda record Admin ke paas verification ke liye bhej diya gaya hai. Approve hote hi aapka naam Leaderboard par chamkega!
                </p>
                <button
                  onClick={() => {
                    setStep(1);
                    setAmount(null);
                    setUtr('');
                    setMessage('');
                    setView('leaderboard');
                  }}
                  className="mt-6 rounded-full border border-yellow-500/50 px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-yellow-500 transition-all shadow-sm hover:bg-yellow-500/20"
                >
                  View Leaderboard
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'leaderboard' && (
          <div className="animate-in slide-in-from-right duration-300 space-y-4">
            {leaderboard.length === 0 ? (
              <div className="rounded-3xl border border-yellow-500/20 bg-[#1a0505]/70 p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                <Crown className="mx-auto mb-3 h-12 w-12 text-yellow-500/40" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-500 drop-shadow-sm">No Donations Yet</h3>
                <p className="mt-2 text-xs text-yellow-100/60">Pehle Danveer baniye aur Leaderboard par apna naam likhwaiye!</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4">
                  {leaderboard.slice(0, 3).map((donor, index) => {
                    const isRank1 = index === 0;
                    const isRank2 = index === 1;

                    return (
                      <div
                        key={donor.id}
                        className={`relative flex items-center rounded-2xl p-4 backdrop-blur-xl transition-all hover:scale-[1.02] ${
                          isRank1
                            ? 'border border-yellow-400/80 bg-gradient-to-r from-[#3a0a0a]/90 to-[#2a0505]/90 py-6 shadow-[0_0_25px_rgba(202,138,4,0.4)]'
                            : isRank2
                              ? 'border border-gray-300/50 bg-[#1a0505]/80 shadow-[0_0_15px_rgba(209,213,219,0.1)]'
                              : 'border border-amber-600/50 bg-[#1a0505]/80 shadow-[0_0_15px_rgba(217,119,6,0.1)]'
                        }`}
                      >
                        <div className="absolute -left-3 -top-3">
                          {isRank1 ? (
                            <div className="animate-pulse rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 p-2.5 text-black shadow-[0_0_15px_rgba(255,215,0,0.8)]">
                              <Crown className="h-5 w-5" />
                            </div>
                          ) : isRank2 ? (
                            <div className="rounded-full bg-gradient-to-br from-gray-200 to-gray-400 p-2 text-gray-900 shadow-md">
                              <Medal className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="rounded-full bg-gradient-to-br from-amber-500 to-amber-700 p-2 text-white shadow-md">
                              <Medal className="h-4 w-4" />
                            </div>
                          )}
                        </div>

                        <div className={`shrink-0 overflow-hidden rounded-full border-2 bg-black ${isRank1 ? 'h-16 w-16 border-yellow-400 shadow-[0_0_10px_rgba(255,215,0,0.5)]' : 'h-12 w-12 border-white/20'}`}>
                          {donor.photo ? (
                            <img src={donor.photo} alt={donor.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-yellow-500">{donor.name?.[0] || 'D'}</div>
                          )}
                        </div>

                        <div className="ml-4 flex-1">
                          <h3 className={`font-black tracking-tight drop-shadow-md ${isRank1 ? 'text-xl text-yellow-400' : 'text-lg text-white'}`} style={{ fontFamily: "'Cinzel', serif" }}>
                            {donor.name}
                          </h3>
                          {donor.latestMessage && (
                            <p className="mt-0.5 line-clamp-1 text-[10px] italic text-yellow-100/70">"{donor.latestMessage}"</p>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <p className={`font-black tracking-wider drop-shadow-md ${isRank1 ? 'text-2xl text-yellow-400' : 'text-xl text-yellow-500'}`}>
                            ₹{donor.total}
                          </p>
                          <p className="text-[8px] uppercase tracking-widest text-yellow-100/50 font-bold">Total Chanda</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {leaderboard.length > 3 && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-[#1a0505]/70 p-2 shadow-lg backdrop-blur-xl">
                    <h4 className="mb-2 border-b border-white/5 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-yellow-500 drop-shadow-sm">Other Danveers</h4>
                    <div className="space-y-2">
                      {leaderboard.slice(3).map((donor, index) => (
                        <div key={donor.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-[#2a0808]/50 p-3 transition-colors hover:bg-[#3a0a0a]/70">
                          <div className="flex items-center gap-3">
                            <span className="w-4 text-right text-[10px] font-black text-white/40">#{index + 4}</span>
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/50">
                              {donor.photo ? <img src={donor.photo} alt={donor.name} className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-yellow-500">{donor.name?.[0] || 'D'}</span>}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white/90 drop-shadow-sm">{donor.name}</p>
                            </div>
                          </div>
                          <p className="text-sm font-black text-yellow-500/90 drop-shadow-sm">₹{donor.total}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}