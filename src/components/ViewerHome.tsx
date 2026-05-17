"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

type ViewerHomeUserData = {
  name?: string;
  photoURL?: string;
};

type ViewerHomeProps = {
  userData: ViewerHomeUserData;
  onExplore: () => void;
};

export default function ViewerHome({ userData, onExplore }: ViewerHomeProps) {
  const [phase, setPhase] = useState(1);
  const [members, setMembers] = useState<string[]>([]);
  const [currentFlashMember, setCurrentFlashMember] = useState("");
  const [flashPos, setFlashPos] = useState({ top: '50%', left: '50%' });
  const [isExiting, setIsExiting] = useState(false);
  const [canTap, setCanTap] = useState(false);

  // 1. Fetch Member Names for Background Animation
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mandal_members"), (snap) => {
      const names = snap.docs.map(doc => doc.data().name).filter(n => n);
      setMembers(names);
    });
    return () => unsub();
  }, []);

  // 2. Phase Controller (Phase 1 -> Phase 2 -> Phase 3)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tapLockTimer: ReturnType<typeof setTimeout> = setTimeout(() => setCanTap(true), 500);

    if (phase === 1) {
      timer = setTimeout(() => setPhase(2), 7000);
    } else if (phase === 2) {
      timer = setTimeout(() => setPhase(3), 6000);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (tapLockTimer) clearTimeout(tapLockTimer);
    };
  }, [phase]);

  // 3. Background Names Flashing Logic (Safe Bounds for Mobile)
  useEffect(() => {
    if (phase === 3 && members.length > 0) {
      const interval = setInterval(() => {
        const randomName = members[Math.floor(Math.random() * members.length)];
        setCurrentFlashMember(randomName);
        
        // 🔥 FIXED: Keeping left between 30% and 70% so names NEVER go out of screen
        setFlashPos({
          top: `${Math.random() * 60 + 20}%`,
          left: `${Math.random() * 40 + 30}%`
        });
      }, 1500); 

      return () => clearInterval(interval);
    }
  }, [phase, members]);

  const handleExploreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canTap) return;
    setIsExiting(true);
    setTimeout(() => {
      onExplore(); 
    }, 700);
  };

  const handleScreenTap = () => {
    if (isExiting || !canTap) return;

    if (phase === 1) {
      setCanTap(false);
      setPhase(2);
    } else if (phase === 2) {
      setCanTap(false);
      setPhase(3);
    } else if (phase === 3) {
      setIsExiting(true);
      setTimeout(() => onExplore(), 800);
    }
  };

  return (
    <div 
      onClick={handleScreenTap}
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#5a0000] via-[#3a0000] to-black px-4 md:px-6 transition-opacity duration-700 ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'} select-none`}
    >
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&family=Rozha+One&display=swap');
        
        .cinzel-font { font-family: "Cinzel", serif; }

        @keyframes premiumFadeIn { 
          0% { opacity: 0; transform: translateY(10px); filter: blur(4px); } 
          100% { opacity: 1; transform: translateY(0); filter: blur(0); } 
        }
        @keyframes fadeOutCinematic {
          0% { opacity: 1; filter: blur(0); transform: scale(1); }
          100% { opacity: 0; filter: blur(10px); transform: scale(1.05); }
        }
        @keyframes memberNameFlash { 
          0% { opacity: 0; filter: blur(4px); transform: scale(0.9) translate(-50%, -50%); } 
          50% { opacity: 0.4; filter: blur(0px); transform: scale(1) translate(-50%, -50%); } 
          100% { opacity: 0; filter: blur(4px); transform: scale(1.1) translate(-50%, -50%); } 
        }
        
        .animate-hindi-line { animation: premiumFadeIn 1.5s cubic-bezier(0.25, 1, 0.5, 1) both; }
        .fade-out-phase { animation: fadeOutCinematic 1.5s ease-in-out forwards; }
        .animate-member-flash { animation: memberNameFlash 1.5s ease-in-out forwards; }
      `}</style>

      {/* BACKGROUND RINGS */}
      <div className="absolute h-[250px] w-[250px] md:h-[380px] md:w-[380px] rounded-full border border-yellow-600/30 shadow-[0_0_60px_rgba(202,138,4,0.15)] pointer-events-none" />
      <div className="absolute h-[280px] w-[280px] md:h-[400px] md:w-[400px] rounded-full border-[2px] border-yellow-700/40 animate-ping pointer-events-none" style={{ animationDuration: "3s" }} />

      {/* 🌪️ BACKGROUND FLASHING NAMES (Phase 3 Only) */}
      {phase === 3 && currentFlashMember && (
        <div 
          key={currentFlashMember}
          style={{ top: flashPos.top, left: flashPos.left }}
          className="absolute pointer-events-none z-0 w-[200vw] text-center animate-member-flash"
        >
          {/* Mobile pe size text-2xl kiya hai aur opacity kam ki hai taaki clean lage */}
          <h3 className="cinzel-font text-2xl md:text-5xl lg:text-7xl font-bold text-yellow-500 uppercase tracking-tighter whitespace-nowrap drop-shadow-[0_0_8px_rgba(255,215,0,0.6)]">
            {currentFlashMember}
          </h3>
        </div>
      )}

      {/* PHASE 1: HINDI WELCOME */}
      {phase === 1 && (
        <div className="relative z-10 flex flex-col items-center p-4 text-center drop-shadow-2xl fade-out-phase w-full pointer-events-none" style={{ animationDelay: '5.5s' }}>
          <h1 className="font-normal leading-relaxed" style={{ fontFamily: "'Rozha One', serif" }}>
            <span className="block text-3xl sm:text-4xl md:text-6xl mb-1 animate-hindi-line bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent" style={{ animationDelay: '0.8s' }}>सियाराम मित्र मंडल</span>
            <span className="block text-xl sm:text-2xl md:text-4xl mb-1 text-yellow-500/90 animate-hindi-line" style={{ animationDelay: '1.8s' }}>में</span>
            <span className="block text-3xl sm:text-4xl md:text-6xl animate-hindi-line bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent" style={{ animationDelay: '2.8s' }}>आपका स्वागत है</span>
          </h1>
        </div>
      )}

      {/* PHASE 2: ENGLISH WELCOME */}
      {phase === 2 && (
        <div className="relative z-10 flex flex-col items-center p-4 text-center drop-shadow-2xl fade-out-phase w-full pointer-events-none" style={{ animationDelay: '4.5s' }}>
          <div className="animate-hindi-line mb-3 md:mb-5" style={{ animationDelay: '0.5s' }}>
            <img src="/royal-crest.png" alt="Crest" className="w-16 md:w-28 mx-auto drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]" />
          </div>
          <h1 className="cinzel-font font-bold tracking-widest leading-relaxed uppercase">
            <span className="block text-lg md:text-3xl mb-1 animate-hindi-line bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent" style={{ animationDelay: '1.5s' }}>Welcome</span>
            <span className="block text-xs md:text-lg mb-1 text-yellow-500/80 animate-hindi-line" style={{ animationDelay: '2.5s' }}>To</span>
            <span className="block text-xl sm:text-2xl md:text-5xl animate-hindi-line bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent" style={{ animationDelay: '3.5s' }}>Siyaram Mitra Mandal</span>
          </h1>
        </div>
      )}

      {/* PHASE 3: PROFILE & FINAL USER ACCESS */}
      {phase === 3 && (
        <div className="relative z-10 flex flex-col items-center p-4 text-center animate-hindi-line w-full max-w-sm mx-auto pointer-events-auto" style={{ animationDelay: '0.5s' }}>
          
          {/* 🔥 Reduced Profile Photo Size for Mobile */}
          <div className="relative w-24 h-24 md:w-40 md:h-40 mb-6 md:mb-8 pointer-events-none">
            <div className="absolute inset-0 bg-yellow-500/20 blur-2xl md:blur-3xl rounded-full animate-pulse"></div>
            <div className="w-full h-full rounded-full border-[3px] md:border-4 border-yellow-500/50 p-1 bg-[#0a0202] shadow-[0_0_30px_rgba(255,215,0,0.2)] relative z-10">
              {userData.photoURL ? (
                <img src={userData.photoURL} className="w-full h-full rounded-full object-cover" alt="Profile" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl md:text-4xl font-black text-yellow-500 bg-gray-800 rounded-full">{userData.name?.[0] || 'U'}</div>
              )}
            </div>
          </div>

          {/* 🔥 Slimmer Text Layout */}
          <div className="space-y-1 md:space-y-2 mb-8 md:mb-10 pointer-events-none">
            <p className="text-green-400 font-bold text-[9px] md:text-xs tracking-[0.3em] uppercase animate-pulse">Permission Granted</p>
            <h2 className="cinzel-font text-white text-2xl md:text-4xl font-bold tracking-tight">
              {userData.name?.split(' ')[0] || 'User'} <span className="text-yellow-500/80">{userData.name?.split(' ').slice(1).join(' ') || ''}</span>
            </h2>
            <p className="text-yellow-100/40 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.15em] pt-1 md:pt-2">
              Official Member of Siyaram Mitra Mandal
            </p>
          </div>

          {/* 🔥 Sleek Explore Button */}
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
