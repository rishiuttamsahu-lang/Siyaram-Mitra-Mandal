"use client";

import React, { useEffect, useState } from 'react';
import { auth, db, googleProvider } from '@/lib/firebase';
import { signInWithPopup, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

type UserData = {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  isAccountPrivate: boolean;
  createdAt: string;
  role: string;
  isBanned: boolean;
  failedAttempts: number;
  lastLogin: string;
  joinedAt: string;
  history: Array<{
    type: string;
    text: string;
    time: string;
  }>;
};

type WelcomeProps = {
  onAuthSuccess: (data: UserData) => void;
  firebaseUser: User | null;
};

export default function Welcome({ onAuthSuccess, firebaseUser }: WelcomeProps) {
  // Phase 1: Google Sign In
  // Phase 3: Hindi Welcome Splash
  // Phase 4: English Welcome Splash
  // Phase 5: Permission Granted / Profile Card
  const [phase, setPhase] = useState<1 | 3 | 4 | 5>(1);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canTap, setCanTap] = useState(false);
  const [cachedUserData, setCachedUserData] = useState<UserData | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setErrorMsg('');
      setIsLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const currentUser = result.user;
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);

      const existingData = userSnap.exists() ? (userSnap.data() as Partial<UserData>) : null;

      if (existingData?.isBanned) {
        setErrorMsg('Aapka account block kar diya gaya hai. Admin se sampark karein.');
        setIsLoading(false);
        return;
      }

      const loginHistoryEntry = {
        type: 'login',
        text: 'Account logged in',
        time: new Date().toISOString(),
      };

      const userData: UserData = {
        uid: currentUser.uid,
        name: currentUser.displayName || 'Member',
        email: currentUser.email || '',
        photoURL: currentUser.photoURL || '',
        isAccountPrivate: existingData?.isAccountPrivate || false,
        createdAt: existingData?.createdAt || new Date().toISOString(),
        role: existingData?.role || 'Viewer',
        isBanned: false,
        failedAttempts: 0,
        lastLogin: new Date().toISOString(),
        joinedAt: existingData?.joinedAt || new Date().toISOString(),
        history: [loginHistoryEntry, ...((existingData?.history as UserData['history']) || [])].slice(0, 20),
      };

      const isNewMember = !existingData;
      await setDoc(userRef, userData, { merge: true });

      if (isNewMember) {
        // Dual-key backup notification for new join
        const sendNotification = async () => {
          const payload = {
            subject: '🇳🇪🇼 New Visitor/Member Joined Siyaram Mitra Mandal!',
            from_name: 'Mandal Portal System',
            message: `Hello Admin,\n\nEk naye visitor/member ne portal join kiya hai.\n\n👤 Name: ${userData.name}\n✉️ Email: ${userData.email}\n⏰ Time: ${new Date().toLocaleString()}\n\nAap Admin Panel me jaakar inki details check kar sakte hain.`,
          };

          try {
            const response = await fetch('https://api.web3forms.com/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({
                access_key: 'bdb8b4b9-d252-4522-808b-f85f80ee402a',
                ...payload
              }),
            });
            if (!response.ok) throw new Error("Primary key failed");
          } catch {
            try {
              await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                  access_key: '6d1f3390-fce7-4341-9111-c6efb1207c3e',
                  ...payload
                }),
              });
            } catch (err) {
              console.error('Web3Forms notification error:', err);
            }
          }
        };
        void sendNotification();
      }

      setCachedUserData(userData);
      setIsLoading(false);
      // Immediately progress to Hindi Welcome splash (Screen 6)
      setPhase(3);
    } catch (error: unknown) {
      console.error('Google sign-in error:', error);
      const msg = error instanceof Error ? error.message : 'Login fail ho gaya. Dobara try karein.';
      setErrorMsg(msg);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (phase === 3) {
      timer = setTimeout(() => setPhase(4), 5000);
    } else if (phase === 4) {
      timer = setTimeout(() => setPhase(5), 4500);
    } else if (phase === 5) {
      timer = setTimeout(() => setCanTap(true), 1000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [phase]);

  const handleExploreClick = () => {
    if (!canTap || !cachedUserData) return;
    onAuthSuccess(cachedUserData);
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden px-4 py-10 transition-colors duration-700 ${
        phase >= 3 ? 'bg-gradient-to-br from-[#5a0000] via-[#3a0000] to-black select-none' : 'bg-gray-50'
      }`}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&family=Rozha+One&display=swap');

        .cinzel-font { font-family: "Cinzel", serif; }

        @keyframes premiumFadeIn {
          0% { opacity: 0; transform: translateY(15px); filter: blur(4px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        @keyframes fadeOutPhase {
          0% { opacity: 1; }
          100% { opacity: 0; transform: scale(0.95); filter: blur(4px); }
        }

        .animate-hindi-line { animation: premiumFadeIn 1.2s cubic-bezier(0.25, 1, 0.5, 1) both; }
        .fade-out-phase { animation: fadeOutPhase 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
      `}</style>

      {/* Screen 4: Clean Google Sign-in */}
      {phase === 1 && (
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-gradient-to-br from-[#5a0000] to-[#2e0000] px-8 py-8 text-center">
            <h1 className="text-3xl text-yellow-300" style={{ fontFamily: "'Rozha One', serif", fontWeight: 400 }}>
              Siyaram Mitra Mandal
            </h1>
            <p className="mt-2 text-sm font-medium text-red-100">Member & Visitor Access Portal</p>
          </div>

          <div className="p-8 space-y-5">
            {errorMsg && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 text-center">
                {errorMsg}
              </div>
            )}

            <div className="space-y-6 py-4 animate-fade-in">
              <div className="text-center space-y-1 mb-6">
                <p className="text-sm font-bold text-gray-700">Mandal ki yaadon mein pravesh karein</p>
                <p className="text-xs text-gray-500">Apne Google account se aage badhein</p>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:border-red-400 focus:ring-2 focus:ring-red-100 active:scale-95"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
                {isLoading ? 'Connecting to Portal...' : 'Sign in with Google'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen 6: Hindi Welcome Splash */}
      {phase === 3 && cachedUserData && (
        <div className="relative z-10 flex flex-col items-center p-4 text-center drop-shadow-2xl fade-out-phase w-full pointer-events-none" style={{ animationDelay: '4.4s' }}>
          <h1 className="font-normal leading-relaxed" style={{ fontFamily: "'Rozha One', serif" }}>
            <span className="block text-3xl sm:text-4xl md:text-6xl mb-1 animate-hindi-line bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent" style={{ animationDelay: '0.8s' }}>
              सियाराम मित्र मंडल
            </span>
            <span className="block text-xl sm:text-2xl md:text-4xl mb-1 text-yellow-500/90 animate-hindi-line" style={{ animationDelay: '1.8s' }}>
              में
            </span>
            <span className="block text-3xl sm:text-4xl md:text-6xl animate-hindi-line bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent" style={{ animationDelay: '2.8s' }}>
              आपका स्वागत है
            </span>
          </h1>
        </div>
      )}

      {/* Screen 7: English Welcome Splash */}
      {phase === 4 && cachedUserData && (
        <div className="relative z-10 flex flex-col items-center p-4 text-center drop-shadow-2xl fade-out-phase w-full pointer-events-none" style={{ animationDelay: '3.9s' }}>
          <h1 className="cinzel-font font-bold tracking-widest leading-relaxed uppercase">
            <span className="block text-lg md:text-3xl mb-1 animate-hindi-line bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent" style={{ animationDelay: '1.5s' }}>
              Welcome
            </span>
            <span className="block text-xs md:text-lg mb-1 text-yellow-500/80 animate-hindi-line" style={{ animationDelay: '2.5s' }}>
              To
            </span>
            <span className="block text-xl sm:text-2xl md:text-5xl animate-hindi-line bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent" style={{ animationDelay: '3.5s' }}>
              Siyaram Mitra Mandal
            </span>
          </h1>
        </div>
      )}

      {/* Screen 8: Permission Granted / User Profile Welcome */}
      {phase === 5 && cachedUserData && (
        <div className="relative z-10 flex flex-col items-center p-4 text-center animate-hindi-line w-full max-w-sm mx-auto pointer-events-auto" style={{ animationDelay: '0.5s' }}>
          <div className="relative w-24 h-24 md:w-40 md:h-40 mb-6 md:mb-8 pointer-events-none">
            <div className="absolute inset-0 bg-yellow-500/20 blur-2xl md:blur-3xl rounded-full animate-pulse" />
            <div className="w-full h-full rounded-full border-[3px] md:border-4 border-yellow-500/50 p-1 bg-[#0a0202] shadow-[0_0_30px_rgba(255,215,0,0.2)] relative z-10">
              {cachedUserData.photoURL ? (
                <img src={cachedUserData.photoURL} className="w-full h-full rounded-full object-cover" alt="Profile" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl md:text-4xl font-black text-yellow-500 bg-gray-800 rounded-full">
                  {cachedUserData.name?.[0] || 'U'}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1 md:space-y-2 mb-8 md:mb-10 pointer-events-none">
            <p className="text-green-400 font-bold text-[9px] md:text-xs tracking-[0.3em] uppercase animate-pulse">Permission Granted</p>
            <h2 className="cinzel-font text-white text-2xl md:text-4xl font-bold tracking-tight">
              {cachedUserData.name?.split(' ')[0] || 'User'} <span className="text-yellow-500/80">{cachedUserData.name?.split(' ').slice(1).join(' ') || ''}</span>
            </h2>
            <p className="text-yellow-100/40 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.15em] pt-1 md:pt-2">
              Official Member of Siyaram Mitra Mandal
            </p>
          </div>

          <button
            onClick={handleExploreClick}
            className={`px-8 py-3 md:px-10 md:py-3.5 bg-gradient-to-r from-yellow-600 to-yellow-400 text-black text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] rounded-full shadow-[0_8px_15px_rgba(202,138,4,0.2)] active:scale-95 transition-all hover:brightness-110 ${canTap ? '' : 'opacity-50 cursor-not-allowed'}`}
          >
            Explore Our Memories
          </button>
        </div>
      )}
    </div>
  );
}
