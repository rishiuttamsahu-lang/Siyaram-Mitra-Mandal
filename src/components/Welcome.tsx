"use client";

import React, { useState } from 'react';
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
  const [phase, setPhase] = useState<1 | 2>(firebaseUser ? 2 : 1);
  const [user, setUser] = useState<User | null>(firebaseUser);
  const [passcode, setPasscode] = useState('');
  const [attempts, setAttempts] = useState(3);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPasscode, setShowPasscode] = useState(false);

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
          setErrorMsg("Aapka account block kar diya gaya hai. Admin se sampark karein.");
          await signOut(auth);
          setIsLoading(false);
          return;
        }
      }

      setUser(currentUser);
      setAttempts(3);
      setPhase(2);
    } catch (error: unknown) {
      console.error('Google sign-in error:', error);
      const msg = error instanceof Error ? error.message : "Login fail ho gaya. Dobara try karein.";
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
      const realPasscode = settingsData?.secretPasscode
        ? settingsData.secretPasscode
        : 'siyaram2026';

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
          try {
            await fetch('https://api.web3forms.com/submit', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                access_key: 'bdb8b4b9-d252-4522-808b-f85f80ee402a',
                subject: '🚨 New Member Joined Siyaram Mitra Mandal!',
                from_name: 'Mandal Portal System',
                message: `Hello Admin,\n\nEk naye member ne portal join kiya hai aur passcode verify kar liya hai.\n\n👤 Name: ${userData.name}\n📧 Email: ${userData.email}\n⏰ Time: ${new Date().toLocaleString()}\n\nAap Admin Panel me jaakar inki details check kar sakte hain.`,
              }),
            });
          } catch (formError) {
            console.error('Failed to send Web3Forms notification:', formError);
          }
        }

        // persist passcode success so page.tsx can gate without reload
        try {
          localStorage.setItem(`mandal_pass_auth_${user.uid}`, 'true');
        } catch (e) {
          /* ignore storage errors (e.g., SSR or private mode) */
        }

        onAuthSuccess(userData);
      } else {
        const userSnap = await getDoc(userRef);
        const currentData = userSnap.data() as Partial<UserData> | undefined;
        const newAttempts = (currentData?.failedAttempts || 0) + 1;

        if (newAttempts >= 3) {
          await setDoc(userRef, {
            uid: user.uid,
            name: user.displayName || 'Member',
            email: user.email || '',
            role: 'Banned',
            isBanned: true,
            failedAttempts: newAttempts,
            banReason: '3 incorrect passcode attempts'
          }, { merge: true });
          setErrorMsg('3 attempts khatam. Aapka account block kar diya gaya hai.');
          setTimeout(() => { void signOut(auth); window.location.reload(); }, 3000);
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 animate-fade-in">
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
                <p className="text-sm font-bold text-gray-700">Swagat hai, <span className="text-[#5a0000]">{user?.displayName}</span></p>
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
    </div>
  );
}
