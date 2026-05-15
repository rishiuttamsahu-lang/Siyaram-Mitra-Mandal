"use client";

import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import Welcome from '@/components/Welcome';
import Gallery from '@/components/Gallery';
import Dashboard from '@/components/Dashboard';
import AdminPanel from '@/components/AdminPanel';
import UserProfile from '@/components/UserProfile';
import UploadSection from '@/components/UploadSection';
import ViewerHome from '@/components/ViewerHome';
import { SpotlightNav } from '@/components/ui/spotlight-nav';
import { LogOut, Shield } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState('dashboard');

  const [introPhase, setIntroPhase] = useState(1);
  const [typedText, setTypedText] = useState('');
  const [isTypingDone, setIsTypingDone] = useState(false);
  const [isSplashExiting, setIsSplashExiting] = useState(false);
  const [isShieldExiting, setIsShieldExiting] = useState(false);

  const [revealSequence, setRevealSequence] = useState(3);

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
              auth.signOut();
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

  // 2. 🔥 FIXED INTRO SEQUENCE (Ab ye kisi login pe depend nahi karega)
  useEffect(() => {
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

  // 3. Skip Function (Sirf logged in users ke liye secret skip)
  const handleSecretSkip = (targetPhase: number) => {
    if (user) {
      if (targetPhase === 2) setIsSplashExiting(true);
      if (targetPhase === 3) { /* nothing extra to exit here */ }
      if (targetPhase === 4) setIsShieldExiting(true);
      setTimeout(() => setIntroPhase(targetPhase), 500);
    }
  };

  // Phase 1 Rendering
  if (introPhase === 1) {
    return (
      <div onClick={() => handleSecretSkip(2)} className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#5a0000] via-[#3a0000] to-black px-6 transition-opacity duration-500 ${isSplashExiting ? "opacity-0" : "opacity-100"}`}>
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
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#5a0000] via-[#3a0000] to-black px-6 cursor-pointer" onClick={() => handleSecretSkip(3)}>
        <div className="max-w-3xl w-full relative z-10">
          <p className="text-yellow-50/90 text-lg md:text-2xl leading-relaxed text-center min-h-[200px]" style={{ fontFamily: "'Gotu', sans-serif" }}>
            {typedText}
            {!isTypingDone && <span className="animate-pulse border-r-2 border-yellow-400 ml-1"></span>}
          </p>
        </div>
        <button className="absolute bottom-12 text-yellow-500/50 hover:text-yellow-400 text-xs md:text-sm font-bold tracking-widest uppercase transition-colors" onClick={(e) => { e.stopPropagation(); handleSecretSkip(3); }}>
          Tap anywhere to skip ➔
        </button>
      </div>
    );
  }

  // Phase 3 Rendering (Shield)
  if (introPhase === 3) {
    return (
      <div onClick={() => handleSecretSkip(4)} className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#5a0000] via-[#3a0000] to-black px-6 transition-opacity duration-500 ${isShieldExiting ? 'opacity-0' : 'opacity-100'}`}>
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
  if (!user || !userData) {
    return <Welcome onAuthSuccess={(data: any) => setUserData(data)} />;
  }

  // MAIN APP AFTER LOGIN
  return (
    <main className="min-h-screen flex flex-col relative pb-28 bg-gray-50">
      
      {/* Top Header Bar - Slides from Top */}
      <div className={`w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm transition-all duration-700 transform ${revealSequence >= 2 ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <h1 className="text-lg font-black text-[#5A0000]" style={{ fontFamily: "'Rozha One', serif" }}>सियाराम</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-600">Hi, {userData.name?.split(' ')[0] || 'User'}</span>
          <button onClick={() => auth.signOut()} className="bg-red-50 text-red-600 p-2 rounded-full hover:bg-red-100 transition-colors">
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