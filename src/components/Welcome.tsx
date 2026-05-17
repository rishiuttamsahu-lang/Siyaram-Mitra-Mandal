"use client";

import React, { useEffect, useState } from 'react';
import { auth, db, googleProvider } from '@/lib/firebase';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Eye, EyeOff } from 'lucide-react';

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
  const [phase, setPhase] = useState<1 | 2 | 3 | 4 | 5>(firebaseUser ? 2 : 1);
  const [user, setUser] = useState<User | null>(firebaseUser);
  const [passcode, setPasscode] = useState('');
  const [attempts, setAttempts] = useState(3);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPasscode, setShowPasscode] = useState(false);
  const [canTap, setCanTap] = useState(false);
  const [cachedUserData, setCachedUserData] = useState<UserData | null>(null);

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const currentUser = result.user;
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data() as Partial<UserData> & { isBanned?: boolean };
        if (userData.isBanned) {
          setErrorMsg('Aapka account block kar diya gaya hai. Admin se sampark karein.');
          await signOut(auth);
          return;
        }
      }

      setUser(currentUser);
      setAttempts(3);
      setPhase(2);
    } catch (error: unknown) {
      console.error('Google sign-in error:', error);
      const msg = error instanceof Error ? error.message : 'Login fail ho gaya. Dobara try karein.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      if (!user) {
        setErrorMsg('Session expired. Please login again.');
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      const settingsSnap = await getDoc(doc(db, 'mandal_settings', 'system'));
      const settingsData = settingsSnap.exists() ? (settingsSnap.data() as { secretPasscode?: string }) : null;
      const realPasscode = settingsData?.secretPasscode ?? 'siyaram2026';

      if (passcode.trim().toLowerCase() === realPasscode.trim().toLowerCase()) {
        const userSnap = await getDoc(userRef);
        const existingData = userSnap.exists() ? (userSnap.data() as Partial<UserData>) : null;
        const loginHistoryEntry = {
          type: 'login',
          text: 'Account logged in',
          time: new Date().toISOString(),
        };

        const userData: UserData = {
          uid: user.uid,
          name: user.displayName || 'Member',
          email: user.email || '',
          photoURL: user.photoURL || '',
          isAccountPrivate: existingData?.isAccountPrivate || false,
          createdAt: existingData?.createdAt || new Date().toISOString(),
          role: existingData?.role || 'Viewer',
          isBanned: existingData?.isBanned || false,
          failedAttempts: 0,
          lastLogin: new Date().toISOString(),
          joinedAt: existingData?.joinedAt || new Date().toISOString(),
          history: [loginHistoryEntry, ...((existingData?.history as UserData['history']) || [])].slice(0, 20),
        };

        const isNewMember = !existingData;
        await setDoc(userRef, userData, { merge: true });

        if (isNewMember) {
          // 🔥 DUAL-KEY BACKUP FALLBACK SYSTEM (250 Quota Safeguard)
          const sendNotification = async () => {
            const payload = {
              subject: '🇳🇪🇼 New Member Joined Siyaram Mitra Mandal!',
              from_name: 'Mandal Portal System',
              message: `Hello Admin,\n\nEk naye member ne portal join kiya hai aur passcode verify kar liya hai.\n\n👤 Name: ${userData.name}\n✉️ Email: ${userData.email}\n⏰ Time: ${new Date().toLocaleString()}\n\nAap Admin Panel me jaakar inki details check kar sakte hain.`,
            };

            try {
              // Try with the Primary Key (New Key)
              console.log("Attempting notification with Primary Web3Form Key...");
              const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                  access_key: 'bdb8b4b9-d252-4522-808b-f85f80ee402a', // 🔑 Primary Key
                  ...payload
                }),
              });

              if (!response.ok) throw new Error("Primary Key quota exhausted or failed");
              console.log("Notification sent successfully via Primary Key!");
            } catch (primaryError) {
              console.warn("Primary key failed, shifting to Backup Key...", primaryError);
              
              // 🔥 FALLBACK: Trigger via Backup Key (Old Key) if primary fails/exhausts
              try {
                await fetch('https://api.web3forms.com/submit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                  body: JSON.stringify({
                    access_key: '6d1f3390-fce7-4341-9111-c6efb1207c3e', // 🔑 Backup Key
                    ...payload
                  }),
                });
                console.log("Notification sent successfully via Backup Key!");
              } catch (backupError) {
                console.error('Both Web3Forms keys failed:', backupError);
              }
            }
          };

          // Trigger the smart function call
          void sendNotification();
        }


        setCachedUserData(userData);
        setCanTap(false);

        try {
          localStorage.setItem(`mandal_pass_auth_${user.uid}`, 'true');
        } catch {
          // ignore storage errors
        }

        setPhase(3);
      } else {
        const userSnap = await getDoc(userRef);
        const currentData = userSnap.data() as Partial<UserData> | undefined;
        const newAttempts = (currentData?.failedAttempts || 0) + 1;

        if (newAttempts >= 3) {
          await setDoc(
            userRef,
            {
              uid: user.uid,
              name: user.displayName || 'Member',
              email: user.email || '',
              role: 'Banned',
              isBanned: true,
              failedAttempts: newAttempts,
              banReason: '3 incorrect passcode attempts',
            },
            { merge: true }
          );
          setErrorMsg('3 attempts khatam. Aapka account block kar diya gaya hai.');
          setTimeout(() => {
            void signOut(auth);
            window.location.reload();
          }, 3000);
        } else {
          await setDoc(userRef, { failedAttempts: newAttempts }, { merge: true });
          setAttempts(3 - newAttempts);
          setErrorMsg(`Galat Passcode! (${3 - newAttempts} attempts left)`);
        }
      }
    } catch (error) {
      console.error('Passcode verification error:', error);
      setErrorMsg('Error connecting to server. Try again.');
    } finally {
      setPasscode('');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (phase === 3) {
      timer = setTimeout(() => setPhase(4), 5500);
    } else if (phase === 4) {
      timer = setTimeout(() => setPhase(5), 4500);
    } else if (phase === 5) {
      timer = setTimeout(() => setCanTap(true), 1200);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [phase]);

  const handleExploreClick = () => {
    if (!canTap || !cachedUserData) return;

    try {
      localStorage.setItem(`mandal_pass_auth_${cachedUserData.uid}`, 'true');
    } catch {
      // ignore storage errors
    }

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

      {phase <= 2 && (
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
          <div className="bg-gradient-to-br from-[#5a0000] to-[#2e0000] px-8 py-8 text-center">
            <h1 className="text-3xl text-yellow-300" style={{ fontFamily: "'Rozha One', serif", fontWeight: 400 }}>
              Siyaram Mitra Mandal
            </h1>
            <p className="mt-2 text-sm font-medium text-red-100">Member Access Portal</p>
          </div>

          <div className="p-8 space-y-5">
            {errorMsg && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 text-center">
                {errorMsg}
              </div>
            )}

            {phase === 1 ? (
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
                  {isLoading ? 'Verifying Identity...' : 'Sign in with Google'}
                </button>
              </div>
            ) : (
              <form onSubmit={verifyPasscode} className="space-y-5 animate-fade-in py-2">
                <div className="text-center mb-2">
                  <p className="text-sm font-bold text-gray-700">
                    Swagat hai, <span className="text-[#5a0000]">{user?.displayName}</span>
                  </p>
                  <p className="text-xs font-semibold text-gray-500 mt-1">Kripya Mandal ka Secret Passcode darj karein</p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">{attempts} attempts left</p>
                </div>

                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    placeholder="Enter Passcode"
                    className="w-full rounded-xl border border-gray-200 px-4 py-4 pr-12 text-center tracking-[0.3em] font-bold text-black outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    value={passcode}
                    onChange={(event) => setPasscode(event.target.value)}
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-[#5a0000]"
                    aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                  >
                    {showPasscode ? <EyeOff size={22} /> : <Eye size={22} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-xl bg-[#5a0000] px-4 py-4 font-bold text-white shadow-lg transition-colors hover:bg-[#7b0000]"
                >
                  {isLoading ? 'Checking...' : 'Enter Vault'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {phase === 3 && cachedUserData && (
        <div className="relative z-10 flex flex-col items-center p-4 text-center drop-shadow-2xl fade-out-phase w-full pointer-events-none" style={{ animationDelay: '4.9s' }}>
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
