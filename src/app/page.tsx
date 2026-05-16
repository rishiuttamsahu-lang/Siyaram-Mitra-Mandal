"use client";

import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import Welcome from '@/components/Welcome';
import Gallery from '@/components/Gallery';
import Dashboard from '@/components/Dashboard';
import AdminPanel from '@/components/AdminPanel';
import UserProfile from '@/components/UserProfile';
import Contribute from '@/components/Contribute';
import UploadSection from '@/components/UploadSection';
import ViewerHome from '@/components/ViewerHome';
import { SpotlightNav } from '@/components/ui/spotlight-nav';
import { LogOut, Shield } from 'lucide-react';

export default function Home() {
  type AppUserData = {
    name?: string;
    email?: string;
    role?: string;
    photoURL?: string;
    isBanned?: boolean;
  };

  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<AppUserData | null>(null);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isPasscodeVerified, setIsPasscodeVerified] = useState(false);

  const [introPhase, setIntroPhase] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [isTypingDone, setIsTypingDone] = useState(false);
  const [isSplashExiting, setIsSplashExiting] = useState(false);
  const [isShieldExiting, setIsShieldExiting] = useState(false);

  const [revealSequence, setRevealSequence] = useState(3);

  // Restore the saved passcode session for the signed-in user.
  useEffect(() => {
    if (!user?.uid) return;

    try {
      const savedAuth = localStorage.getItem(`mandal_pass_auth_${user.uid}`);
      if (savedAuth === 'true') {
        setIsPasscodeVerified(true);
      }
    } catch {
      // Ignore storage failures in restrictive browser modes.
    }
  }, [user?.uid]);

  const welcomeText = "Deviyon aur sajjanon, Siyaram Mitra Mandal mein aapka hardik swagat hai. Yeh portal Bappa ki aarti, visarjan aur mandal ki pavitra yaadon ko ek saath sanjone ke liye banaya gaya hai. Yahan aap mandal se judi photos aur videos dekh aur upload kar sakte hain. Yeh website keval Siyaram Mitra Mandal parivar ke sadasyon aur mataon-behnon ke liye hai, taaki sabhi ki privacy aur sammaan poori tarah surakshit rahe. Kisi baahari vyakti ko yahan pravesh ki anumati nahi hai.";

  // 1. Auth Listener: Isko intro se alag rakho
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (!data.isBanned) {
              setUserData(data);
              setUser(currentUser);
              
              if (data.role?.toLowerCase() === 'viewer') {
                setRevealSequence(0);
              } else {
                setRevealSequence(3);
              }
            } else {
              void signOut(auth);
            }
          } else {
            setUser(currentUser);
          }
        } catch (error) {
          console.error("Firebase Connection Error:", error);
        }
      } else {
        setUser(null);
        setUserData(null);
        setIsPasscodeVerified(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 🔥 NEW: Step-by-step transition logic
  useEffect(() => {
    if (revealSequence === 1) {
      const t1 = setTimeout(() => setRevealSequence(2), 700);
      return () => clearTimeout(t1);
    } else if (revealSequence === 2) {
      const t2 = setTimeout(() => setRevealSequence(3), 700);
      return () => clearTimeout(t2);
    }
  }, [revealSequence]);

  // 2. REAL LOADING BAR + INTRO SEQUENCE
  useEffect(() => {
    if (introPhase === 0) {
      let isFontsLoaded = false;

      const loadAllFonts = async () => {
        if (typeof document !== 'undefined' && document.fonts) {
          try {
            await Promise.all([
              document.fonts.load('400 16px "Rozha One"'),
              document.fonts.load('400 16px "Cinzel"'),
              document.fonts.load('700 16px "Cinzel"'),
              document.fonts.load('900 16px "Cinzel"'),
              document.fonts.load('400 16px "Gotu"'),
              document.fonts.load('700 16px "Gotu"'),
              document.fonts.load('900 16px "Gotu"')
            ]);
            await document.fonts.ready;
            isFontsLoaded = true;
          } catch (err) {
            console.warn('Font loading issue:', err);
            isFontsLoaded = true;
          }
        } else {
          isFontsLoaded = true;
        }
      };

      loadAllFonts();

      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (!isFontsLoaded && prev >= 89) {
            return 89;
          }

          if (isFontsLoaded && prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setIntroPhase(1), 500);
            return 100;
          }

          const speed = isFontsLoaded && prev >= 89 ? 11 : Math.floor(Math.random() * 15) + 5;
          return Math.min(prev + speed, 100);
        });
      }, 100);

      return () => clearInterval(interval);
    }

    if (introPhase === 1) {
      const t1 = setTimeout(() => setIsSplashExiting(true), 4000);
      const t2 = setTimeout(() => setIntroPhase(2), 4500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    
    if (introPhase === 2) {
      let i = 0;
      const typingInterval = setInterval(() => {
        if (i < welcomeText.length) {
          setTypedText(welcomeText.slice(0, i + 1));
          i++;
        } else {
          clearInterval(typingInterval);
          setIsTypingDone(true);
          setTimeout(() => setIntroPhase(3), 3500);
        }
      }, 40);
      return () => clearInterval(typingInterval);
    }

    if (introPhase === 3) {
      const t3 = setTimeout(() => setIsShieldExiting(true), 2500);
      const t4 = setTimeout(() => setIntroPhase(4), 3000);
      return () => { clearTimeout(t3); clearTimeout(t4); };
    }
  }, [introPhase]);

  // 3. Universal tap skip
  const handleUniversalSkip = (targetPhase: number) => {
    if (targetPhase === 2) setIsSplashExiting(true);
    if (targetPhase === 4) setIsShieldExiting(true);
    setTimeout(() => setIntroPhase(targetPhase), 300);
  };

  if (introPhase === 0) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0202] select-none">
        <div className="w-64 relative mt-10">
          <div className="absolute -top-6 left-0 w-full flex justify-center">
            <span className="text-yellow-400 text-xs font-black tracking-widest" style={{ fontFamily: "'Cinzel', serif" }}>
              {loadingProgress}%
            </span>
          </div>

          <div className="h-[1px] w-full bg-white/10 rounded-full relative">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-transparent via-yellow-600 to-yellow-200 transition-all duration-150 ease-linear rounded-full"
              style={{ width: `${loadingProgress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-yellow-100 rounded-full shadow-[0_0_10px_#fff,0_0_20px_#eab308,0_0_30px_#eab308] blur-[0.5px]" />
            </div>
          </div>

          <span className="block text-center mt-4 text-yellow-500/20 text-[8px] uppercase tracking-[0.3em] font-black animate-pulse">
            Syncing Vault...
          </span>

          <div className="absolute top-[-9999px] left-[-9999px] opacity-0 pointer-events-none select-none">
            <span style={{ fontFamily: "'Rozha One', serif", fontWeight: 400 }}>गणपती बाप्पा मोरया</span>
            <span style={{ fontFamily: "'Gotu', sans-serif", fontWeight: 700 }}>सियाराम मित्रमंडळ</span>
            <span style={{ fontFamily: "'Gotu', sans-serif", fontWeight: 900 }}>Welcome</span>
            <span style={{ fontFamily: "'Cinzel', serif", fontWeight: 900 }}>100% Secured</span>
          </div>
        </div>
      </div>
    );
  }

  // Phase 1 Rendering
  if (introPhase === 1) {
    return (
      <div onClick={() => handleUniversalSkip(2)} className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#5a0000] via-[#3a0000] to-black px-6 transition-opacity duration-500 cursor-pointer ${isSplashExiting ? "opacity-0" : "opacity-100"}`}>
        <style>{`
          @keyframes premiumFadeIn { 0% { opacity: 0; transform: translateY(15px); filter: blur(4px); } 100% { opacity: 1; transform: translateY(0); filter: blur(0); } }
          @keyframes lineExpand { 0% { width: 0; opacity: 0; } 100% { width: 12rem; opacity: 1; } }
          .animate-text-1 { animation: premiumFadeIn 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
          .animate-line { animation: lineExpand 1s ease-out 1s forwards; opacity: 0; }
          .animate-text-2 { opacity: 0; animation: premiumFadeIn 1.5s cubic-bezier(0.25, 1, 0.5, 1) 1.5s forwards; }
        `}</style>
        <div className="absolute h-[280px] w-[280px] rounded-full border border-yellow-600/30 shadow-[0_0_60px_rgba(202,138,4,0.15)] md:h-[380px] md:w-[380px]" />
        <div className="absolute h-[300px] w-[300px] rounded-full border-[2px] border-yellow-700/40 animate-ping md:h-[400px] md:w-[400px]" style={{ animationDuration: "3s" }} />
        <div className="relative z-10 flex flex-col items-center space-y-8 p-6 text-center drop-shadow-2xl">
          <h1 className="animate-text-1 font-normal tracking-wide" style={{ fontFamily: "'Rozha One', serif" }}>
            <span className="bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-5xl md:text-7xl text-transparent">गणपती बाप्पा मोरया</span>
          </h1>
          <div className="animate-line h-[2px] w-48 bg-gradient-to-r from-transparent via-yellow-600/80 to-transparent" />
          <h2 className="animate-text-2 text-3xl md:text-5xl font-bold tracking-wider text-yellow-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style={{ fontFamily: "'Gotu', sans-serif" }}>सियाराम मित्रमंडळ</h2>
        </div>
      </div>
    );
  }

  // Phase 2 Rendering (Typewriter)
  if (introPhase === 2) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#5a0000] via-[#3a0000] to-black px-6 cursor-pointer" onClick={() => handleUniversalSkip(3)}>
        <div className="max-w-3xl w-full relative z-10">
          <p className="text-yellow-50/90 text-lg md:text-2xl leading-relaxed text-center min-h-[200px]" style={{ fontFamily: "'Gotu', sans-serif" }}>
            {typedText}
            {!isTypingDone && <span className="animate-pulse border-r-2 border-yellow-400 ml-1"></span>}
          </p>
        </div>
        <button className="absolute bottom-12 text-yellow-500/50 hover:text-yellow-400 text-xs md:text-sm font-bold tracking-widest uppercase transition-colors" onClick={(e) => { e.stopPropagation(); handleUniversalSkip(3); }}>
          Tap anywhere to skip ➔
        </button>
      </div>
    );
  }

  // Phase 3 Rendering (Shield)
  if (introPhase === 3) {
    return (
      <div onClick={() => handleUniversalSkip(4)} className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#5a0000] via-[#3a0000] to-black px-6 transition-opacity duration-500 cursor-pointer ${isShieldExiting ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-yellow-400/20 animate-ping" style={{ animationDuration: '2.5s' }} />
            <div className="absolute inset-2 rounded-full bg-yellow-400/30 animate-pulse" />
            <Shield className="relative z-10 h-16 w-16 text-yellow-500 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]" strokeWidth={1.5} />
          </div>
          <div className="space-y-3 text-center">
            <h3 className="text-2xl font-black tracking-tight text-yellow-50 md:text-4xl" style={{ fontFamily: "'Gotu', sans-serif" }}>100% Secured & Private</h3>
            <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-yellow-600/50 to-transparent" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-200/70 md:text-xs">For Members of Siyaram Mitra Mandal</p>
          </div>
        </div>
      </div>
    );
  }

  // Phase 4: Final Check (Login dikhana hai ya App)
  if (!user || !userData || !isPasscodeVerified) {
    return <Welcome key={user?.uid ?? 'guest'} firebaseUser={user} onAuthSuccess={(data) => { setUserData(data); setIsPasscodeVerified(true); }} />;
  }

  // MAIN APP AFTER LOGIN
  return (
    <main className="min-h-screen flex flex-col relative pb-28 bg-gray-50">
      
      {/* Top Header Bar - Slides from Top */}
      <div className={`w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm transition-all duration-700 transform ${revealSequence >= 2 ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <h1 className="text-lg font-black text-[#5A0000]" style={{ fontFamily: "'Rozha One', serif" }}>सियाराम</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-600">Hi, {userData.name?.split(' ')[0] || 'User'}</span>
          <button onClick={() => { void signOut(auth); setIsPasscodeVerified(false); }} className="bg-red-50 text-red-600 p-2 rounded-full hover:bg-red-100 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6" style={{ paddingTop: 0 }}>
        
        {/* TAB RENDERING */}
        {activeTab === 'dashboard' && (
          userData.role?.toLowerCase() === 'viewer' ? (
            <ViewerHome userData={userData} onExplore={() => {
              setRevealSequence(1);
              setActiveTab('gallery');
            }} />
          ) : (
            <div className={`transition-opacity duration-1000 ${revealSequence >= 3 ? 'opacity-100' : 'opacity-0'}`}>
              <Dashboard userData={userData} />
            </div>
          )
        )}
        
        {activeTab === 'gallery' && (
          <div className={`transition-opacity duration-1000 ${revealSequence >= 3 ? 'opacity-100' : 'opacity-0'}`}>
            <Gallery userData={userData} />
          </div>
        )}
        
        {activeTab === 'upload' && (
          <div className={`transition-opacity duration-1000 ${revealSequence >= 3 ? 'opacity-100' : 'opacity-0'}`}>
            <UploadSection userData={userData} />
          </div>
        )}

        {activeTab === 'contribute' && (
          <div className={`transition-opacity duration-1000 ${revealSequence >= 3 ? 'opacity-100' : 'opacity-0'}`}>
            <Contribute userData={userData} />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className={`transition-opacity duration-1000 ${revealSequence >= 3 ? 'opacity-100' : 'opacity-0'}`}>
            {userData.role === 'Admin' ? (
              <AdminPanel currentUserData={userData} />
            ) : (
              <UserProfile userData={userData} />
            )}
          </div>
        )}
      </div>

      {/* BOTTOM SPOTLIGHT NAVIGATION - Slides from Bottom */}
      <div className={`fixed bottom-0 w-full z-50 transition-all duration-700 transform ${revealSequence >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
        <SpotlightNav activeTab={activeTab} setActiveTab={setActiveTab} userRole={userData.role} />
      </div>
      
    </main>
  );
}