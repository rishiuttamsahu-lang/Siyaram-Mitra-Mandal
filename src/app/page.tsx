"use client";

import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

import Welcome from '@/components/Welcome';
import BannedPage from '@/components/BannedPage';
import Gallery from '@/components/Gallery';
import Dashboard from '@/components/Dashboard';
import AdminPanel from '@/components/AdminPanel';
import UserProfile from '@/components/UserProfile';
import Contribute from '@/components/Contribute';
import UploadSection from '@/components/UploadSection';
import ViewerDashboard from '@/components/ViewerDashboard';
import { SpotlightNav } from '@/components/ui/spotlight-nav';
import { LogOut } from 'lucide-react';

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
  const [bannedUserData, setBannedUserData] = useState<AppUserData | null>(null);
  const bannedUserDataRef = useRef<AppUserData | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isDeviceBanned, setIsDeviceBanned] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSphereView, setShowSphereView] = useState(true);

  // Return Splash: Quick Screen 7 (English Welcome) for returning logged-in users
  const [showReturnSplash, setShowReturnSplash] = useState(false);
  const [isSplashExiting, setIsSplashExiting] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('mandal_device_banned') === 'true') {
        setIsDeviceBanned(true);
        setIsAuthChecking(false);
      }
    } catch (error) {
      console.error('Storage access error:', error);
    }
  }, []);

  const SeoH1 = (
    <h1 className="sr-only opacity-0 absolute pointer-events-none w-1 h-1 overflow-hidden" aria-hidden="false">
      Siyaram Mitra Mandal | Official Member Portal & Shanti Sagar Cha Maharaja
    </h1>
  );

  // 1. Auth Listener
  useEffect(() => {
    let unsubUserDoc = () => { };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);

          unsubUserDoc = onSnapshot(userRef, async (userSnap) => {
            if (userSnap.exists()) {
              const data = userSnap.data() as AppUserData;
              setUserData(data);
              setUser(currentUser);

              const isAdmin = data.role?.toLowerCase() === 'admin';

              if (isAdmin) {
                try {
                  localStorage.removeItem('mandal_device_banned');
                } catch { }
              }

              const deviceIsBanned = localStorage.getItem('mandal_device_banned') === 'true';

              if (!isAdmin && (data.isBanned || deviceIsBanned)) {
                if (!data.isBanned) {
                  try {
                    await updateDoc(userRef, { isBanned: true });
                  } catch (error) {
                    console.error('Auto-ban update failed:', error);
                    setIsAuthChecking(false);
                  }
                  return;
                }

                try {
                  localStorage.setItem('mandal_device_banned', 'true');
                } catch { }
                setIsDeviceBanned(true);
                bannedUserDataRef.current = data;
                setBannedUserData(data);
                setIsAuthChecking(false);
                return;
              }

              try {
                localStorage.removeItem('mandal_device_banned');
              } catch { }
              setIsDeviceBanned(false);
              bannedUserDataRef.current = null;
              setBannedUserData(null);

              // Returning logged-in user: Show quick Screen 7 English splash once
              const hasSeenSplash = sessionStorage.getItem(`smm_return_splash_${currentUser.uid}`);
              if (!hasSeenSplash) {
                setShowReturnSplash(true);
                sessionStorage.setItem(`smm_return_splash_${currentUser.uid}`, 'true');
              }
            } else {
              setUser(currentUser);
            }
            setIsAuthChecking(false);
          });
        } catch (error) {
          console.error("Firebase Connection Error:", error);
          setIsAuthChecking(false);
        }
      } else {
        unsubUserDoc();
        setUser(null);
        if (!bannedUserDataRef.current) {
          setUserData(null);
          setBannedUserData(null);
        }
        setIsAuthChecking(false);
      }
    });

    return () => {
      unsubscribe();
      unsubUserDoc();
    };
  }, []);

  // Timer for Return Splash (Screen 7)
  useEffect(() => {
    if (!showReturnSplash) return;
    const t1 = setTimeout(() => setIsSplashExiting(true), 2800);
    const t2 = setTimeout(() => setShowReturnSplash(false), 3300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [showReturnSplash]);

  const handleSkipReturnSplash = () => {
    setIsSplashExiting(true);
    setTimeout(() => setShowReturnSplash(false), 200);
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const targetColor = isAuthChecking || !user || showReturnSplash ? '#4A0001' : '#ffffff';

    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', targetColor);
    } else {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      metaThemeColor.setAttribute('content', targetColor);
      document.head.appendChild(metaThemeColor);
    }
  }, [isAuthChecking, user, showReturnSplash]);

  // Spinner while Firebase checks session
  if (isAuthChecking) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0202]">
        {SeoH1}
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-yellow-500 animate-spin"></div>
        </div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-yellow-500/80 animate-pulse">
          Opening Siyaram Mandal...
        </p>
      </div>
    );
  }

  const effectiveUserData = bannedUserData ?? userData;

  if (user && (isDeviceBanned || effectiveUserData?.isBanned)) {
    return <>{SeoH1}<BannedPage /></>;
  }

  // Not logged in: Directly show Google Sign-in screen with subsequent welcome transitions
  if (!user || !userData) {
    return (
      <>
        {SeoH1}
        <Welcome
          key={user?.uid ?? 'guest'}
          firebaseUser={user}
          onAuthSuccess={(data) => {
            setUserData(data);
            setUser(auth.currentUser);
          }}
        />
      </>
    );
  }

  // Returning user: Quick Screen 7 English Welcome Splash
  if (showReturnSplash) {
    return (
      <div
        onClick={handleSkipReturnSplash}
        className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#5a0000] via-[#3a0000] to-black px-6 transition-opacity duration-500 cursor-pointer select-none ${
          isSplashExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {SeoH1}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&family=Rozha+One&display=swap');
          .cinzel-font { font-family: "Cinzel", serif; }
          @keyframes premiumFadeIn {
            0% { opacity: 0; transform: translateY(12px); filter: blur(4px); }
            100% { opacity: 1; transform: translateY(0); filter: blur(0); }
          }
          .animate-splash-text { animation: premiumFadeIn 1s cubic-bezier(0.25, 1, 0.5, 1) both; }
        `}</style>
        <div className="relative z-10 flex flex-col items-center p-4 text-center drop-shadow-2xl w-full max-w-lg">
          <div className="animate-splash-text mb-3" style={{ animationDelay: '0.2s' }}>
            <img src="/royal-crest.png" alt="Crest" className="w-16 md:w-24 mx-auto drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]" />
          </div>
          <h1 className="cinzel-font font-bold tracking-widest leading-relaxed uppercase">
            <span className="block text-lg md:text-3xl mb-1 animate-splash-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent" style={{ animationDelay: '0.4s' }}>
              Welcome
            </span>
            <span className="block text-xs md:text-lg mb-1 text-yellow-500/80 animate-splash-text" style={{ animationDelay: '0.7s' }}>
              To
            </span>
            <span className="block text-xl sm:text-2xl md:text-5xl animate-splash-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent" style={{ animationDelay: '1s' }}>
              Siyaram Mitra Mandal
            </span>
          </h1>
          <p className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-yellow-500/40 animate-pulse">
            Tap anywhere to enter ➔
          </p>
        </div>
      </div>
    );
  }

  const isViewer = userData.role?.toLowerCase() === 'viewer';
  const isAdmin = userData.role?.toLowerCase() === 'admin';

  // MAIN PORTAL
  return (
    <main className="min-h-screen flex flex-col relative pb-28 bg-gray-50 animate-in fade-in duration-300">
      {SeoH1}

      {/* Top Header Bar */}
      <div className="w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <h1 className="text-lg font-black text-[#5A0000]" style={{ fontFamily: "'Rozha One', serif" }}>
          सियाराम
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-600">
            Hi, {userData.name?.split(' ')[0] || 'User'}
          </span>
          <button
            onClick={() => {
              void signOut(auth);
            }}
            className="bg-red-50 text-red-600 p-2 rounded-full hover:bg-red-100 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6" style={{ paddingTop: 0 }}>
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          isViewer ? (
            // Viewer Role: Sees 3D Vault directly (No Feed toggle)
            <div className="w-full">
              <ViewerDashboard userData={userData} />
            </div>
          ) : (
            // Member & Admin Roles: Toggle between 3D Vault and Members Feed
            <div className="w-full flex flex-col">
              <div className="w-full flex justify-center mt-2 mb-4 animate-in slide-in-from-top-4 duration-300 relative z-40">
                <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-full p-1 shadow-sm flex items-center gap-1">
                  <button
                    onClick={() => setShowSphereView(true)}
                    className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                      showSphereView
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-black shadow-md'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    3D Vault
                  </button>
                  <button
                    onClick={() => setShowSphereView(false)}
                    className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                      !showSphereView
                        ? 'bg-[#5a0000] text-white shadow-md'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Members Feed
                  </button>
                </div>
              </div>

              <div className="w-full relative">
                {showSphereView ? (
                  <div className="animate-in fade-in zoom-in-95 duration-300">
                    <ViewerDashboard userData={userData} />
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <Dashboard userData={userData} />
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {activeTab === 'gallery' && (
          <div className="animate-in fade-in duration-300">
            <Gallery userData={userData} />
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="animate-in fade-in duration-300">
            <UploadSection userData={userData} />
          </div>
        )}

        {activeTab === 'contribute' && (
          <div className="animate-in fade-in duration-300">
            <Contribute userData={userData} />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="animate-in fade-in duration-300">
            {isAdmin ? (
              <AdminPanel currentUserData={userData} />
            ) : (
              <UserProfile userData={userData} />
            )}
          </div>
        )}
      </div>

      {/* BOTTOM SPOTLIGHT NAVIGATION */}
      <div className="fixed bottom-0 w-full z-50">
        <SpotlightNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userRole={userData.role}
          isBanned={!!effectiveUserData?.isBanned}
        />
      </div>
    </main>
  );
}