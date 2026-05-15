"use client";

import React, { useState } from 'react';
import { auth, db, googleProvider } from '@/lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function Welcome({ onAuthSuccess }: { onAuthSuccess: (data: any) => void }) {
  const [phase, setPhase] = useState(1); // 1 = Google Login, 2 = Passcode
  const [user, setUser] = useState<any>(null);
  const [passcode, setPasscode] = useState('');
  const [attempts, setAttempts] = useState(3);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const currentUser = result.user;
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.isBanned) {
          setErrorMsg("Aapka account block kar diya gaya hai. Admin se sampark karein.");
          auth.signOut();
        } else {
          onAuthSuccess(userData);
        }
      } else {
        setUser(currentUser);
        setPhase(2);
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      const msg = error?.message || "Login fail ho gaya. Dobara try karein.";
      setErrorMsg(msg);
    }
    setIsLoading(false);
  };

  const verifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      const settingsSnap = await getDoc(doc(db, 'mandal_settings', 'system'));
      const realPasscode = settingsSnap.exists() && settingsSnap.data().secretPasscode
        ? settingsSnap.data().secretPasscode
        : 'siyaram2026';

      if (passcode.trim().toLowerCase() === realPasscode.trim().toLowerCase()) {
        const userSnap = await getDoc(userRef);
        const existingData = userSnap.exists() ? userSnap.data() : null;
        const loginHistoryEntry = {
          type: 'login',
          text: 'Account logged in',
          time: new Date().toISOString(),
        };
        const userData = {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          photoURL: user.photoURL || '',
          isAccountPrivate: false,
          createdAt: new Date().toISOString(),
          role: 'Viewer',
          isBanned: false,
          failedAttempts: 0,
          lastLogin: new Date().toISOString(),
          joinedAt: existingData?.joinedAt || new Date().toISOString(),
          history: [loginHistoryEntry, ...(existingData?.history || [])].slice(0, 20),
        };
        await setDoc(userRef, userData, { merge: true });
        onAuthSuccess(userData);
      } else {
        const userSnap = await getDoc(userRef);
        const currentData = userSnap.data();
        const newAttempts = (currentData?.failedAttempts || 0) + 1;

        if (newAttempts >= 3) {
          await setDoc(userRef, {
            uid: user.uid,
            name: user.displayName,
            email: user.email,
            role: 'Banned',
            isBanned: true,
            failedAttempts: newAttempts,
            banReason: '3 incorrect passcode attempts'
          }, { merge: true });
          setErrorMsg('3 attempts khatam. Aapka account block kar diya gaya hai.');
          setTimeout(() => { auth.signOut(); window.location.reload(); }, 3000);
        } else {
          await setDoc(userRef, { failedAttempts: newAttempts }, { merge: true });
          setAttempts(3 - newAttempts);
          setErrorMsg(`Galat Passcode! (${3 - newAttempts} attempts left)`);
        }
      }
    } catch {
      setErrorMsg('Error connecting to server. Try again.');
    }

    setPasscode('');
    setIsLoading(false);
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
              </div>

              <div>
                <input
                  type="password"
                  placeholder="Enter Passcode"
                  className="w-full rounded-xl border border-gray-200 px-4 py-4 text-center tracking-[0.3em] font-bold outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  value={passcode}
                  onChange={(event) => setPasscode(event.target.value)}
                  autoFocus
                  required
                />
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
