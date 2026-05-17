"use client";

import React, { useEffect, useState } from 'react';
import { addDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  ArrowRight, Check, CheckCircle2, ChevronLeft, Crown,
  IndianRupee, Loader2, Medal, QrCode, ShieldCheck, Sparkles, Star, Zap
} from 'lucide-react';
import { db } from '@/lib/firebase';

type Donor = {
  id: string;
  name: string;
  email?: string;
  photo?: string | null;
  total: number;
  latestMessage?: string;
};

type PaymentDoc = {
  status?: string;
  userId?: string;
  userEmail?: string;
  timestamp?: { toMillis?: () => number };
  userName?: string;
  userPhoto?: string | null;
  amount?: number | string;
  message?: string;
};

type ContributeProps = {
  userData: {
    uid?: string;
    name?: string;
    email?: string;
    photoURL?: string | null;
  };
};

const MANDAL_UPI_ID = '8468988419@naviaxis';
const MANDAL_NAME = 'NEHA UTTAM KUMAR SAHU';

// ─── Inline Styles / CSS ────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Poppins:wght@400;500;600;700;800;900&family=Noto+Sans+Devanagari:wght@400;700;900&display=swap');

    :root {
      --saffron:       #FF6B00;
      --saffron-light: #FF8C38;
      --saffron-pale:  #FFF0E6;
      --gold:          #D4A017;
      --gold-light:    #F0C040;
      --gold-pale:     #FFF9E6;
      --vermillion:    #CC2200;
      --cream:         #FFFDF8;
      --ivory:         #FAF7F0;
      --brown-deep:    #5C2A00;
      --text-main:     #1A0A00;
      --text-sub:      #7A5030;
      --text-muted:    #B89070;
      --border-warm:   rgba(212,160,23,0.25);
      --shadow-warm:   0 8px 40px rgba(255,107,0,0.12);
      --shadow-gold:   0 4px 24px rgba(212,160,23,0.18);
      --glass:         rgba(255,253,248,0.85);
      --glass-heavy:   rgba(255,253,248,0.95);
    }

    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

    body { background: var(--cream); }

    .contribute-root {
      font-family: 'Poppins', sans-serif;
      background: linear-gradient(155deg, #FFF9F2 0%, #FFFDF8 40%, #FFF4E8 100%);
      min-height: 100dvh;
      position: relative;
      overflow-x: hidden;
    }

    /* ── Festive background particles ── */
    .bg-motif {
      position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
    }
    .bg-motif::before {
      content: '';
      position: absolute; inset: -20%;
      background:
        radial-gradient(circle at 15% 20%, rgba(255,107,0,0.07) 0%, transparent 45%),
        radial-gradient(circle at 85% 10%, rgba(212,160,23,0.09) 0%, transparent 40%),
        radial-gradient(circle at 50% 85%, rgba(204,34,0,0.05) 0%, transparent 45%);
    }
    .bg-mandala {
      position: fixed; top: -80px; right: -80px; width: 340px; height: 340px;
      opacity: 0.04; pointer-events: none; z-index: 0;
      background:
        repeating-conic-gradient(from 0deg at 50% 50%,
          var(--saffron) 0deg 10deg, transparent 10deg 20deg,
          var(--gold) 20deg 30deg, transparent 30deg 40deg);
      border-radius: 50%;
      animation: slowSpin 60s linear infinite;
    }
    .bg-mandala-2 {
      position: fixed; bottom: -60px; left: -60px; width: 240px; height: 240px;
      opacity: 0.05; pointer-events: none; z-index: 0;
      background:
        repeating-conic-gradient(from 0deg at 50% 50%,
          var(--gold) 0deg 15deg, transparent 15deg 30deg);
      border-radius: 50%;
      animation: slowSpin 40s linear infinite reverse;
    }

    @keyframes slowSpin { to { transform: rotate(360deg); } }

    /* ── Header ── */
    .header-hero {
      position: relative; z-index: 2;
      text-align: center;
      padding: 36px 20px 20px;
    }
    .om-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: linear-gradient(135deg, var(--saffron), var(--gold));
      color: white;
      font-size: 10px; font-weight: 800; letter-spacing: 0.18em;
      text-transform: uppercase;
      padding: 5px 14px 5px 10px;
      border-radius: 99px;
      margin-bottom: 14px;
      box-shadow: 0 4px 16px rgba(255,107,0,0.28);
    }
    .header-title {
      font-family: 'Playfair Display', serif;
      font-size: clamp(26px, 7vw, 36px);
      font-weight: 900;
      background: linear-gradient(135deg, var(--brown-deep) 0%, var(--saffron) 50%, var(--gold) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1.15;
      margin: 0 0 6px;
    }
    .header-sub {
      font-size: 12px; font-weight: 500; color: var(--text-sub);
      letter-spacing: 0.06em;
    }

    /* ── Tab Toggle ── */
    .tab-bar {
      position: relative; z-index: 2;
      display: flex;
      background: var(--glass-heavy);
      border: 1.5px solid var(--border-warm);
      border-radius: 99px;
      padding: 4px;
      margin: 0 auto 28px;
      max-width: 300px;
      box-shadow: 0 4px 24px rgba(212,160,23,0.10), inset 0 1px 0 rgba(255,255,255,0.9);
      backdrop-filter: blur(12px);
    }
    .tab-btn {
      flex: 1; border: none; cursor: pointer;
      padding: 10px 12px;
      border-radius: 99px;
      font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
      text-transform: uppercase;
      transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1);
      background: transparent; color: var(--text-muted);
      position: relative; z-index: 1;
    }
    .tab-btn.active {
      background: linear-gradient(135deg, var(--saffron), var(--saffron-light));
      color: white;
      box-shadow: 0 4px 18px rgba(255,107,0,0.35), 0 1px 0 rgba(255,255,255,0.3) inset;
      transform: scale(1.03);
    }

    /* ── Cards ── */
    .glass-card {
      background: var(--glass);
      backdrop-filter: blur(20px);
      border: 1.5px solid var(--border-warm);
      border-radius: 28px;
      box-shadow: var(--shadow-warm), 0 1px 0 rgba(255,255,255,0.95) inset;
      overflow: hidden;
    }
    .card-top-stripe {
      height: 3px;
      background: linear-gradient(90deg, var(--saffron), var(--gold-light), var(--saffron));
      background-size: 200% 100%;
      animation: shineStripe 3s linear infinite;
    }
    @keyframes shineStripe {
      0% { background-position: 0% 0%; }
      100% { background-position: 200% 0%; }
    }

    /* ── Amount Grid ── */
    .section-label {
      font-size: 10px; font-weight: 800; letter-spacing: 0.2em;
      text-transform: uppercase; color: var(--saffron); text-align: center;
      margin-bottom: 14px;
    }
    .amount-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      margin-bottom: 4px;
    }
    .amount-btn {
      position: relative; overflow: hidden;
      padding: 16px 8px;
      border-radius: 18px;
      border: 1.5px solid rgba(212,160,23,0.2);
      background: white;
      font-family: 'Poppins', sans-serif;
      font-size: 17px; font-weight: 700; color: var(--text-main);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
      box-shadow: 0 2px 12px rgba(0,0,0,0.05);
    }
    .amount-btn::before {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(255,107,0,0.06), rgba(212,160,23,0.08));
      opacity: 0;
      transition: opacity 0.3s;
    }
    .amount-btn:hover::before { opacity: 1; }
    .amount-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(255,107,0,0.15); }
    .amount-btn:active { transform: scale(0.96); }
    .amount-btn.selected {
      border-color: var(--saffron);
      background: linear-gradient(135deg, #FFF4EC, #FFF9E6);
      color: var(--saffron);
      box-shadow: 0 0 0 3px rgba(255,107,0,0.12), 0 6px 24px rgba(255,107,0,0.18);
      transform: scale(1.04);
    }
    .amount-btn.selected::after {
      content: '✓';
      position: absolute; top: 5px; right: 8px;
      font-size: 9px; font-weight: 900;
      color: var(--saffron); opacity: 0.7;
    }

    /* ── Divider ── */
    .or-divider {
      display: flex; align-items: center; gap: 12px;
      margin: 18px 0 14px;
      color: var(--text-muted); font-size: 10px; font-weight: 700;
      letter-spacing: 0.15em; text-transform: uppercase;
    }
    .or-divider::before, .or-divider::after {
      content: ''; flex: 1; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(212,160,23,0.3), transparent);
    }

    /* ── Inputs ── */
    .input-wrap { position: relative; margin-bottom: 12px; }
    .input-icon {
      position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
      color: var(--text-muted); pointer-events: none;
      transition: color 0.3s;
    }
    .input-wrap:focus-within .input-icon { color: var(--saffron); }
    .premium-input {
      width: 100%; padding: 15px 16px 15px 46px;
      border-radius: 16px;
      border: 1.5px solid rgba(212,160,23,0.2);
      background: white;
      font-family: 'Poppins', sans-serif;
      font-size: 15px; font-weight: 600; color: var(--text-main);
      outline: none;
      transition: all 0.3s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .premium-input::placeholder { color: var(--text-muted); font-weight: 400; }
    .premium-input:focus {
      border-color: var(--saffron);
      box-shadow: 0 0 0 4px rgba(255,107,0,0.08), 0 2px 12px rgba(255,107,0,0.1);
    }
    .premium-input-plain {
      width: 100%; padding: 15px 16px;
      border-radius: 16px;
      border: 1.5px solid rgba(212,160,23,0.2);
      background: white;
      font-family: 'Poppins', sans-serif;
      font-size: 14px; font-weight: 500; color: var(--text-main);
      outline: none;
      transition: all 0.3s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .premium-input-plain::placeholder { color: var(--text-muted); font-weight: 400; }
    .premium-input-plain:focus {
      border-color: var(--saffron);
      box-shadow: 0 0 0 4px rgba(255,107,0,0.08), 0 2px 12px rgba(255,107,0,0.1);
    }

    /* ── Buttons ── */
    .btn-primary {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      width: 100%; padding: 17px;
      border-radius: 18px;
      border: none; cursor: pointer;
      background: linear-gradient(135deg, var(--saffron) 0%, #FF8C38 50%, var(--gold) 100%);
      background-size: 200% 100%;
      color: white;
      font-family: 'Poppins', sans-serif;
      font-size: 13px; font-weight: 800; letter-spacing: 0.12em;
      text-transform: uppercase;
      box-shadow: 0 6px 28px rgba(255,107,0,0.35), 0 1px 0 rgba(255,255,255,0.2) inset;
      transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1);
      position: relative; overflow: hidden;
    }
    .btn-primary::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
      opacity: 0; transition: opacity 0.3s;
    }
    .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 36px rgba(255,107,0,0.4); }
    .btn-primary:hover:not(:disabled)::after { opacity: 1; }
    .btn-primary:active:not(:disabled) { transform: scale(0.97); }
    .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

    .btn-gold {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      width: 100%; padding: 16px;
      border-radius: 16px;
      border: none; cursor: pointer;
      background: linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%);
      color: var(--brown-deep);
      font-family: 'Poppins', sans-serif;
      font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
      box-shadow: 0 5px 20px rgba(212,160,23,0.3);
      transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    .btn-gold:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(212,160,23,0.4); }
    .btn-gold:active:not(:disabled) { transform: scale(0.97); }
    .btn-gold:disabled { opacity: 0.35; cursor: not-allowed; }

    .btn-outline {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: 15px;
      border-radius: 16px; cursor: pointer;
      border: 1.5px solid rgba(212,160,23,0.35);
      background: rgba(255,255,255,0.7);
      color: var(--text-sub);
      font-family: 'Poppins', sans-serif;
      font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
      transition: all 0.3s;
    }
    .btn-outline:hover { background: white; border-color: var(--saffron); color: var(--saffron); }
    .btn-outline:active { transform: scale(0.97); }

    .btn-back {
      display: inline-flex; align-items: center; gap: 5px;
      border: none; background: none; cursor: pointer;
      font-family: 'Poppins', sans-serif;
      font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--text-muted);
      padding: 0 0 16px;
      transition: color 0.2s;
    }
    .btn-back:hover { color: var(--saffron); }

    /* ── QR Card ── */
    .qr-amount-label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.18em;
      text-transform: uppercase; color: var(--text-sub); margin-bottom: 4px;
    }
    .qr-amount-value {
      font-family: 'Playfair Display', serif;
      font-size: 52px; font-weight: 900;
      background: linear-gradient(135deg, var(--saffron), var(--gold));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      line-height: 1; margin-bottom: 24px;
    }
    .qr-frame {
      display: inline-block;
      padding: 14px; border-radius: 22px;
      background: white;
      box-shadow: 0 8px 40px rgba(0,0,0,0.10), 0 0 0 1px rgba(212,160,23,0.2);
      margin-bottom: 20px;
    }
    .qr-frame img { border-radius: 12px; display: block; }
    .upi-hint {
      font-size: 10px; font-weight: 600; color: var(--text-muted);
      letter-spacing: 0.06em; margin-top: 6px;
    }

    /* ── Verification Section ── */
    .verify-header {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 14px;
    }
    .verify-badge {
      display: flex; align-items: center; gap: 6px;
      background: linear-gradient(135deg, #EFFFEF, #DCFFE0);
      border: 1px solid rgba(0,180,0,0.2);
      border-radius: 99px;
      padding: 5px 12px;
      font-size: 11px; font-weight: 700; color: #00800A;
      letter-spacing: 0.06em;
    }

    /* ── Success Screen ── */
    .success-icon-ring {
      width: 88px; height: 88px;
      border-radius: 50%;
      background: linear-gradient(135deg, #EFFFEF, #DCFFE0);
      border: 2px solid rgba(0,180,0,0.2);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px;
      animation: successPulse 2s ease-in-out infinite;
    }
    @keyframes successPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(0,200,50,0.3); }
      50% { box-shadow: 0 0 0 12px rgba(0,200,50,0); }
    }
    .success-title {
      font-family: 'Playfair Display', serif;
      font-size: 28px; font-weight: 900;
      color: var(--text-main); margin-bottom: 10px;
    }
    .success-sub {
      font-size: 13px; font-weight: 400; color: var(--text-sub);
      line-height: 1.7; margin-bottom: 28px;
    }

    /* ── Leaderboard ── */
    .lb-empty {
      text-align: center; padding: 48px 16px;
      background: white; border-radius: 24px;
      border: 1.5px solid var(--border-warm);
      box-shadow: var(--shadow-warm);
    }
    .lb-medal-ring {
      width: 70px; height: 70px; border-radius: 50%;
      background: linear-gradient(135deg, #FFF4E6, #FFF9E0);
      border: 2px solid rgba(212,160,23,0.25);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px;
    }

    .donor-card {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 16px;
      border-radius: 20px;
      background: white;
      border: 1.5px solid rgba(212,160,23,0.15);
      box-shadow: 0 2px 12px rgba(0,0,0,0.05);
      transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
      cursor: default;
      position: relative; overflow: hidden;
      animation: fadeSlideUp 0.5s ease both;
    }
    .donor-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(255,107,0,0.12); }
    .donor-card.top1 {
      background: linear-gradient(135deg, #FFF8E8 0%, #FFFCF0 100%);
      border-color: rgba(212,160,23,0.4);
      box-shadow: 0 4px 20px rgba(212,160,23,0.18);
    }
    .donor-card::before {
      content: '';
      position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
      border-radius: 3px 0 0 3px;
    }
    .donor-card.top1::before { background: linear-gradient(180deg, var(--gold), var(--saffron)); }
    .donor-card.top2::before { background: linear-gradient(180deg, #C0C0C0, #A8A8A8); }
    .donor-card.top3::before { background: linear-gradient(180deg, #CD7F32, #8B5A1F); }

    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .rank-circle {
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      font-size: 13px; font-weight: 800;
    }
    .rank-circle.gold   { background: linear-gradient(135deg, #FFF0A0, #F0C040); }
    .rank-circle.silver { background: linear-gradient(135deg, #E8E8E8, #C8C8C8); color: #555; }
    .rank-circle.bronze { background: linear-gradient(135deg, #F0D0A0, #CD7F32); color: #5C2A00; }
    .rank-circle.other  { background: rgba(0,0,0,0.06); color: var(--text-muted); }

    .donor-avatar {
      width: 48px; height: 48px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
      border: 2.5px solid rgba(212,160,23,0.3);
      background: linear-gradient(135deg, #FFF4E6, #FFF9E0);
      display: flex; align-items: center; justify-content: center;
      font-size: 19px; font-weight: 800; color: var(--saffron);
    }
    .donor-avatar.top1 { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(212,160,23,0.2); }

    .donor-name {
      font-size: 14px; font-weight: 700; color: var(--text-main);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;
    }
    .donor-name.top1 { color: var(--brown-deep); }
    .donor-msg {
      font-size: 11px; font-weight: 400; color: var(--text-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .donor-amount {
      font-size: 17px; font-weight: 800; color: var(--text-main);
      flex-shrink: 0; text-align: right;
    }
    .donor-amount.top1 { color: var(--saffron); font-size: 19px; }

    /* ── Floating om sparkles ── */
    .sparkle-dot {
      position: fixed; pointer-events: none; z-index: 0;
      width: 6px; height: 6px; border-radius: 50%;
      background: radial-gradient(circle, var(--gold-light), transparent);
      animation: floatDot var(--dur, 8s) ease-in-out var(--delay, 0s) infinite;
      opacity: 0.5;
    }
    @keyframes floatDot {
      0%, 100% { transform: translateY(0) scale(1); opacity: 0.5; }
      50% { transform: translateY(-18px) scale(1.3); opacity: 0.9; }
    }

    /* ── Content wrap ── */
    .content-wrap {
      position: relative; z-index: 2;
      max-width: 440px; margin: 0 auto;
      padding: 0 16px 100px;
    }

    /* ── Animate in ── */
    .anim-in {
      animation: fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both;
    }
    .anim-in-2 { animation-delay: 0.06s; }
    .anim-in-3 { animation-delay: 0.12s; }
    .anim-in-4 { animation-delay: 0.18s; }

    /* ── Live pulse dot ── */
    .live-dot {
      display: inline-block; width: 7px; height: 7px;
      border-radius: 50%; background: #22c55e;
      box-shadow: 0 0 0 2px rgba(34,197,94,0.3);
      animation: livePulse 1.5s ease-in-out infinite;
    }
    @keyframes livePulse {
      0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,0.3); }
      50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
    }

    /* mobile nav removed to avoid duplicate bottom nav with global SpotlightNav */

    /* ── Responsive tweaks ── */
    @media (min-width: 430px) {
      .amount-btn { font-size: 18px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `}</style>
);

const PRESET_AMOUNTS = [11, 21, 51, 101, 501, 1100];

const SPARKLE_POSITIONS = [
  { top: '12%',  left: '8%',  dur: '7s',  delay: '0s'   },
  { top: '25%',  left: '90%', dur: '9s',  delay: '1.5s' },
  { top: '60%',  left: '5%',  dur: '11s', delay: '3s'   },
  { top: '75%',  left: '88%', dur: '8s',  delay: '0.7s' },
  { top: '45%',  left: '50%', dur: '13s', delay: '2s'   },
];

export default function Contribute({ userData }: ContributeProps) {
  const [view, setView] = useState<'donate' | 'leaderboard'>('donate');
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [utr, setUtr] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Donor[]>([]);
  const [isQrLoaded, setIsQrLoaded] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    let approvedPayments: PaymentDoc[] = [];
    let manualChandaEntries: any[] = [];

    const recomputeLeaderboard = () => {
      const totals: Record<string, Donor & { latestAt?: number }> = {};

      const pushContribution = (key: string, contribution: Donor & { latestAt?: number }) => {
        const existing = totals[key];
        if (!existing) {
          totals[key] = contribution;
          return;
        }

        existing.total += contribution.total;
        if ((contribution.latestAt || 0) >= (existing.latestAt || 0)) {
          existing.latestAt = contribution.latestAt;
          existing.latestMessage = contribution.latestMessage;
          existing.photo = contribution.photo;
          existing.name = contribution.name;
          existing.email = contribution.email;
        }
      };

      approvedPayments.forEach((payment) => {
        if (payment.status !== 'Approved' || !payment.userId) return;
        const at = typeof payment.timestamp?.toMillis === 'function' ? payment.timestamp.toMillis() : 0;
        const key = payment.userEmail?.trim().toLowerCase() || payment.userId;
        pushContribution(key, {
          id: key,
          name: payment.userName || 'Anonymous',
          email: payment.userEmail || undefined,
          photo: payment.userPhoto || null,
          total: Number(payment.amount) || 0,
          latestMessage: payment.message || '',
          latestAt: at,
        });
      });

      manualChandaEntries.forEach((entry) => {
        const key = entry.email?.trim().toLowerCase();
        if (!key) return;
        const at = entry.lastUpdated ? new Date(entry.lastUpdated).getTime() : 0;
        pushContribution(key, {
          id: key,
          name: entry.name || 'Anonymous Donor',
          email: entry.email,
          photo: entry.photoURL || null,
          total: Number(entry.totalAmount) || 0,
          latestMessage: entry.latestMessage || '',
          latestAt: at,
        });
      });

      setLeaderboard(
        Object.values(totals)
          .sort((a, b) => b.total - a.total)
          .map(({ id, name, email, photo, total, latestMessage }) => ({ id, name, email, photo, total, latestMessage }))
      );
    };

    const unsubPayments = onSnapshot(
      query(collection(db, 'chanda_payments'), orderBy('timestamp', 'desc')),
      (snap) => {
        approvedPayments = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
        recomputeLeaderboard();
      },
      (error) => {
        console.error('Leaderboard listener error:', error);
      }
    );

    const unsubManual = onSnapshot(
      query(collection(db, 'mandal_chanda'), orderBy('lastUpdated', 'desc')),
      (snap) => {
        manualChandaEntries = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
        recomputeLeaderboard();
      },
      (error) => {
        console.warn('Manual chanda listener safely bypassed:', error.message);
        manualChandaEntries = [];
        recomputeLeaderboard();
      }
    );

    return () => {
      unsubPayments();
      unsubManual();
    };
  }, []);

  const finalAmount = amount ?? (customAmount ? parseInt(customAmount, 10) : 0);
  const canContinue = finalAmount > 0;
  const getUpiUrl = () =>
    `upi://pay?pa=${MANDAL_UPI_ID}&pn=${encodeURIComponent(MANDAL_NAME)}&am=${finalAmount}.00&cu=INR`;

  const handleProceed = () => {
    if (!canContinue) return;
    setAmount(finalAmount);
    setIsQrLoaded(false);
    setStep(2);
  };

  const handleSubmitChanda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || utr.length < 6) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'chanda_payments'), {
        userId: userData.uid || 'anonymous',
        userName: userData.name,
        userEmail: userData.email || '',
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

  const rankStyle = (i: number) => {
    if (i === 0) return 'top1';
    if (i === 1) return 'top2';
    if (i === 2) return 'top3';
    return '';
  };
  const rankCircleClass = (i: number) => {
    if (i === 0) return 'rank-circle gold';
    if (i === 1) return 'rank-circle silver';
    if (i === 2) return 'rank-circle bronze';
    return 'rank-circle other';
  };
  const rankLabel = (i: number) => {
    if (i === 0) return <Crown style={{ width: 16, height: 16, color: '#D4A017' }} />;
    return <span>{i + 1}</span>;
  };

  return (
    <div className="contribute-root">
      <GlobalStyles />

      {/* Background decorations */}
      <div className="bg-motif" />
      <div className="bg-mandala" />
      <div className="bg-mandala-2" />
      {SPARKLE_POSITIONS.map((s, i) => (
        <div
          key={i}
          className="sparkle-dot"
          style={{ top: s.top, left: s.left, ['--dur' as string]: s.dur, ['--delay' as string]: s.delay }}
        />
      ))}

      <div className="content-wrap">
        {/* ── Header ── */}
        <div className="header-hero anim-in">
          <div className="om-badge">
            <Sparkles style={{ width: 13, height: 13 }} />
            Siyaram Mitra Mandal
          </div>
          <h1 className="header-title">Mandal Vault</h1>
          <p className="header-sub">Your seva strengthens our celebration 🙏</p>
        </div>

        {/* ── Tab Bar ── */}
        <div className="tab-bar anim-in anim-in-2">
          <button
            className={`tab-btn ${view === 'donate' ? 'active' : ''}`}
            onClick={() => setView('donate')}
          >
            ✦ Contribute
          </button>
          <button
            className={`tab-btn ${view === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setView('leaderboard')}
          >
            Danveers
          </button>
        </div>

        {/* ══════════ DONATE VIEW ══════════ */}
        {view === 'donate' && (
          <div className="anim-in">
            {/* ── Step 1: Amount Selection ── */}
            {step === 1 && (
              <div className="glass-card anim-in" style={{ padding: '24px 20px 28px' }}>
                <div className="card-top-stripe" />
                <div style={{ paddingTop: 20 }}>
                  <p className="section-label">✦ Choose Your Offering ✦</p>
                  <div className="amount-grid">
                    {PRESET_AMOUNTS.map((value) => (
                      <button
                        key={value}
                        className={`amount-btn ${amount === value ? 'selected' : ''}`}
                        onClick={() => { setAmount(value); setCustomAmount(''); }}
                      >
                        ₹{value}
                      </button>
                    ))}
                  </div>

                  <div className="or-divider">or</div>

                  <div className="input-wrap">
                    <IndianRupee className="input-icon" style={{ width: 18, height: 18 }} />
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => { setCustomAmount(e.target.value); setAmount(null); }}
                      placeholder="Enter custom amount"
                      className="premium-input"
                      inputMode="numeric"
                    />
                  </div>

                  {canContinue && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      marginBottom: 14, padding: '10px 16px',
                      background: 'linear-gradient(135deg, rgba(255,107,0,0.06), rgba(212,160,23,0.08))',
                      borderRadius: 12, border: '1px solid rgba(255,107,0,0.15)',
                    }}>
                      <IndianRupee style={{ width: 14, height: 14, color: 'var(--saffron)' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--saffron)' }}>
                        ₹{finalAmount} selected
                      </span>
                    </div>
                  )}

                  <button className="btn-primary" onClick={handleProceed} disabled={!canContinue}>
                    Proceed to Pay
                    <ArrowRight style={{ width: 17, height: 17, transition: 'transform 0.3s' }} />
                  </button>

                  <p style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    🔒 100% secure via UPI
                  </p>
                </div>
              </div>
            )}

            {/* ── Step 2: QR / UTR Submission ── */}
            {step === 2 && (
              <div className="anim-in">
                <button className="btn-back" onClick={() => setStep(1)}>
                  <ChevronLeft style={{ width: 15, height: 15 }} /> Back
                </button>

                {/* QR Card */}
                <div className="glass-card" style={{ padding: '0 0 24px', textAlign: 'center', marginBottom: 16 }}>
                  <div className="card-top-stripe" />
                  <div style={{ padding: '22px 20px 0' }}>
                    <p className="qr-amount-label">Total Offering</p>
                    <p className="qr-amount-value">₹{amount}</p>

                    <div
                      className="qr-frame"
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 188,
                        minHeight: 188,
                      }}
                    >
                      {!isQrLoaded && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Loader2
                            style={{ width: 28, height: 28, color: 'var(--saffron)', animation: 'spin 1s linear infinite' }}
                          />
                        </div>
                      )}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getUpiUrl())}`}
                        alt="UPI QR Code"
                        style={{
                          width: 160,
                          height: 160,
                          borderRadius: 12,
                          display: 'block',
                          opacity: isQrLoaded ? 1 : 0,
                          transition: 'opacity 0.3s ease',
                        }}
                        onLoad={() => setIsQrLoaded(true)}
                      />
                    </div>

                    <a
                      href={getUpiUrl()}
                      target="_top"
                      rel="noopener noreferrer"
                      style={{ display: 'block', marginBottom: 0, textDecoration: 'none' }}
                    >
                      <div className="btn-gold" style={{ borderRadius: 14 }}>
                        <QrCode style={{ width: 16, height: 16 }} />
                        Open UPI App
                      </div>
                    </a>
                    <p className="upi-hint">Works with GPay · PhonePe · Paytm · BHIM</p>
                  </div>
                </div>

                {/* Verification Form */}
                <div className="glass-card" style={{ padding: '22px 20px 24px' }}>
                  <div className="verify-header">
                    <div className="verify-badge">
                      <ShieldCheck style={{ width: 13, height: 13 }} />
                      Payment Verification
                    </div>
                  </div>

                  <p style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 16, lineHeight: 1.6 }}>
                    After paying, enter your UTR/reference number below to confirm your seva.
                  </p>

                  <form onSubmit={handleSubmitChanda}>
                    <div style={{ marginBottom: 10 }}>
                      <input
                        required
                        type="text"
                        value={utr}
                        onChange={(e) => setUtr(e.target.value)}
                        placeholder="12-digit UTR / Reference No."
                        className="premium-input-plain"
                        inputMode="numeric"
                      />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Sankalp or blessings (optional)"
                        className="premium-input-plain"
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={isSubmitting || utr.length < 6}
                    >
                      {isSubmitting ? (
                        <Loader2 style={{ width: 17, height: 17, animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Check style={{ width: 17, height: 17 }} />
                      )}
                      {isSubmitting ? 'Submitting…' : 'Confirm Seva'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ── Step 3: Success ── */}
            {step === 3 && (
              <div className="glass-card anim-in" style={{ padding: '36px 24px', textAlign: 'center' }}>
                <div className="card-top-stripe" />
                <div style={{ paddingTop: 16 }}>
                  <div className="success-icon-ring">
                    <CheckCircle2 style={{ width: 44, height: 44, color: '#16a34a' }} />
                  </div>
                  <p className="success-title">Jai Ganesh! 🙏</p>
                  <p className="success-sub">
                    Your seva of <strong style={{ color: 'var(--saffron)' }}>₹{amount}</strong> has been received.
                    It will appear on the Danveers board once our admin verifies the payment.
                  </p>

                  {/* Diya decoration */}
                  <div style={{ fontSize: 32, marginBottom: 24, letterSpacing: 8 }}>🪔✨🪔</div>

                  <button
                    className="btn-primary"
                    onClick={() => {
                      setStep(1); setAmount(null); setUtr(''); setMessage('');
                      setView('leaderboard');
                    }}
                  >
                    <Star style={{ width: 16, height: 16 }} /> View Danveers
                  </button>
                  <button
                    className="btn-outline"
                    style={{ marginTop: 10 }}
                    onClick={() => { setStep(1); setAmount(null); setUtr(''); setMessage(''); }}
                  >
                    Contribute Again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════ LEADERBOARD VIEW ══════════ */}
        {view === 'leaderboard' && (
          <div className="anim-in">
            {/* Live header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16, padding: '0 4px',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sub)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Seva Champions
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="live-dot" />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', letterSpacing: '0.1em' }}>LIVE</span>
              </div>
            </div>

            {leaderboard.length === 0 ? (
              <div className="lb-empty anim-in">
                <div className="lb-medal-ring">
                  <Medal style={{ width: 30, height: 30, color: 'var(--gold)' }} />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  No Danveers Yet
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Be the first to offer seva to Bappa! 🙏
                </p>
                <button
                  className="btn-primary"
                  style={{ marginTop: 20 }}
                  onClick={() => setView('donate')}
                >
                  <Zap style={{ width: 15, height: 15 }} /> Be First
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {leaderboard.map((donor, index) => (
                  <div
                    key={donor.id}
                    className={`donor-card ${rankStyle(index)}`}
                    style={{ animationDelay: `${index * 0.06}s` }}
                  >
                    <div className={rankCircleClass(index)}>
                      {rankLabel(index)}
                    </div>

                    <div className={`donor-avatar ${index === 0 ? 'top1' : ''}`}>
                      {donor.photo ? (
                        <img src={donor.photo} alt={donor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span>{donor.name?.[0]?.toUpperCase()}</span>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className={`donor-name ${index === 0 ? 'top1' : ''}`}>{donor.name}</p>
                      {donor.latestMessage && (
                        <p className="donor-msg">&ldquo;{donor.latestMessage}&rdquo;</p>
                      )}
                    </div>

                    <div className={`donor-amount ${index === 0 ? 'top1' : ''}`}>
                      ₹{donor.total.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* mobile nav removed: use app-level SpotlightNav to avoid overlap */}

      {/* Spin keyframe for loader */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}