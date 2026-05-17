"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import {
  Mail, Lock, Unlock, Trash2, Edit3, Database, LayoutGrid, X, Settings, Save, Play, ChevronLeft, ChevronRight, Smartphone, Download, Image as ImageIcon, ShieldCheck, Camera, Loader2, CheckCircle2
} from 'lucide-react';

export default function UserProfile({ userData }: { userData: any }) {
  const [myMedia, setMyMedia] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("vault"); 
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Multi-Select States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const [displayName, setDisplayName] = useState(userData.name || '');
  const [bio, setBio] = useState(userData.bio || 'Member of Siyaram Mitra Mandal');
  const [photoURL, setPhotoURL] = useState(userData.photoURL || '');
  const [isAccountPrivate, setIsAccountPrivate] = useState(userData.isAccountPrivate || false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // 🔥 VIRTUALIZED SLIDER STATES
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedMedia = selectedIndex !== null ? myMedia[selectedIndex] : null;
  const [touchStart, setTouchStart] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const lastSwipeTime = useRef<number>(0);
  const [visibleCount, setVisibleCount] = useState(15);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    if (videoRef.current && selectedIndex !== null) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    }
  }, [selectedIndex]);

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        } else {
          setIsPlaying(true);
        }
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setProgress((current / total) * 100 || 0);
    }
  };

  const getOptimizedMediaUrl = (url: string, type: string) => {
    if (!url || !url.includes('/upload/')) return url;
    if (type?.startsWith('video')) return url.replace(/\.[^/.]+$/, '.jpg').replace('/upload/', '/upload/q_auto:good,w_800/');
    return url.replace('/upload/', '/upload/q_auto:good,w_600/');
  };

  useEffect(() => {
    if (activeTab !== 'vault') return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleCount((prev) => prev + 15);
      },
      { rootMargin: '200px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [activeTab, visibleCount, myMedia.length]);

  useEffect(() => {
    if (activeTab === 'vault') setVisibleCount(15);
  }, [activeTab]);

  useEffect(() => {
    if (!userData?.uid) return;
    const unsubUser = onSnapshot(doc(db, 'users', userData.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDisplayName(data.name || userData.name);
        setBio(data.bio || userData.bio);
        setPhotoURL(data.photoURL || userData.photoURL || '');
        setIsAccountPrivate(data.isAccountPrivate || false); 
      }
    });
    return () => unsubUser();
  }, [userData?.uid]);

  useEffect(() => {
    const q = query(collection(db, 'mandal_gallery'), where('uploaderEmail', '==', userData.email));
    const unsubMedia = onSnapshot(q, (snap) => {
      const mediaList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      mediaList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMyMedia(mediaList);
    });
    return () => unsubMedia();
  }, [userData.email]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setIsUploadingPhoto(true);
    try {
      const response = await fetch(`https://api.imgbb.com/1/upload?key=18689c27743c695f94310e3bd0a52c99`, {
        method: 'POST',
        body: formData
      });
      const result = await response.json();

      if (result.success) {
        const newUrl = result.data.url;
        setPhotoURL(newUrl);
        await updateDoc(doc(db, "users", userData.uid), { photoURL: newUrl });
      }
    } catch (error) {
      alert("Photo upload failed.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const toggleInstantPrivacy = async () => {
    const newStatus = !isAccountPrivate;
    setIsAccountPrivate(newStatus); 
    try {
      await updateDoc(doc(db, 'users', userData.uid), { isAccountPrivate: newStatus });
      if (newStatus && myMedia.length > 0) {
        const batch = writeBatch(db);
        myMedia.forEach((item) => {
          batch.update(doc(db, 'mandal_gallery', item.id), { isPrivate: true });
        });
        await batch.commit();
      }
    } catch (error: any) {
      alert("Error updating privacy. Please check your internet connection.");
      setIsAccountPrivate(!newStatus);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', userData.uid), { 
        name: displayName || "", 
        bio: bio || "",
        photoURL: photoURL || "", 
        isAccountPrivate: isAccountPrivate ?? false 
      });

      if (isAccountPrivate && myMedia.length > 0) {
        const batch = writeBatch(db);
        myMedia.forEach((item) => {
          const mediaRef = doc(db, 'mandal_gallery', item.id);
          batch.update(mediaRef, { isPrivate: true });
        });
        await batch.commit();
      }

      setIsEditModalOpen(false);
    } catch (error: any) {
      alert(`Failed to save profile: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Multi-Select Logic Functions
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const startSelectMode = (id: string) => {
    setIsSelectMode(true);
    setSelectedIds([id]);
  };

  const handleTouchStartLongPress = (id: string) => {
    longPressTimer.current = setTimeout(() => startSelectMode(id), 600);
  };

  const handleTouchEndLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds([]);
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} items permanently?`)) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => batch.delete(doc(db, 'mandal_gallery', id)));
      await batch.commit();
      exitSelectMode();
    } catch (err) { alert("Bulk delete failed"); }
  };

  const handleBulkLock = async (lock: boolean) => {
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => batch.update(doc(db, 'mandal_gallery', id), { isPrivate: lock }));
      await batch.commit();
      exitSelectMode();
    } catch (err) { alert("Bulk lock failed"); }
  };

  const handleDeleteRequest = (id: string, e?: React.MouseEvent) => {
    e?.preventDefault(); e?.stopPropagation();
    setMediaToDelete(id); 
  };

  const confirmDeleteMedia = async () => {
    if (!mediaToDelete) return;
    try {
      await deleteDoc(doc(db, 'mandal_gallery', mediaToDelete));
      if (selectedMedia?.id === mediaToDelete) setSelectedIndex(null); 
      setMediaToDelete(null);
    } catch (err: any) {
      alert("Delete failed.");
      setMediaToDelete(null);
    }
  };

  // 🔥 SWIPE AND NAVIGATION LOGIC
  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev !== null && prev < myMedia.length - 1 ? prev + 1 : prev));
  }, [myMedia.length]);

  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (selectedIndex === null || mediaToDelete) return;
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'Escape') setSelectedIndex(null);
  }, [selectedIndex, myMedia.length, mediaToDelete, handleNext, handlePrev]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    setSwipeOffset(e.targetTouches[0].clientX - touchStart);
  };

  const handleTouchEnd = () => {
    if (!touchStart) return;
    setIsSwiping(false);
    if (swipeOffset > 60) {
      lastSwipeTime.current = Date.now();
      handlePrev();
    }
    else if (swipeOffset < -60) {
      lastSwipeTime.current = Date.now();
      handleNext();
    }

    setSwipeOffset(0);
    setTouchStart(0);
  };

  const totalBytes = myMedia.reduce((acc, curr) => acc + (curr.size || 0), 0);
  const storageUsedMB = (totalBytes / (1024 * 1024)).toFixed(1);
  const storagePercent = Math.min((Number(storageUsedMB) / 500) * 100, 100);

  return (
    <main className="bg-gray-50 pt-0 min-h-screen animate-fade-in relative pb-28 -mx-4 sm:mx-0">
      
      {/* 1. Cover Photo */}
      <div className="h-32 sm:h-40 bg-gradient-to-r from-[#5A0000] via-[#8B0000] to-[#5A0000] relative">
         <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="px-5 pb-8 max-w-3xl mx-auto">
        
        {/* 2. Overlapping Avatar & Top Actions */}
        <div className="-mt-16 mb-6 relative flex justify-between items-end">
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 inline-block">
            <div className="w-full h-full rounded-full border-[6px] border-gray-50 bg-white flex items-center justify-center shadow-md overflow-hidden relative">
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-4xl sm:text-5xl font-black text-white drop-shadow-md">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
            <button onClick={() => setIsEditModalOpen(true)} className="absolute bottom-1 right-1 bg-white p-2 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors shadow-sm">
              <Edit3 className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 3. User Info Box */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{displayName || "User"}</h1>
            <span className="px-2 py-0.5 bg-yellow-100 border border-yellow-200 text-yellow-700 text-[10px] font-black uppercase tracking-widest rounded-md">
              {userData.role}
            </span>
          </div>
          <p className="text-gray-500 text-sm mb-2 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/>{userData.email}</p>
          <p className="text-gray-400 text-sm italic mb-5">"{bio}"</p>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={() => setIsEditModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl transition-colors text-[13px] font-bold shadow-sm">
              <Settings size={16} className="text-gray-500" /> Edit Profile
            </button>
          </div>
        </div>

        {/* 4. Sleek Horizontal Tabs */}
        <div className="flex gap-6 mb-6 border-b border-gray-200 overflow-x-auto whitespace-nowrap no-scrollbar pb-1">
          <button
            onClick={() => setActiveTab("vault")}
            className={`py-2 text-sm font-bold transition-all relative ${activeTab === "vault" ? "text-[#5A0000]" : "text-gray-400 hover:text-gray-600"}`}
          >
            <div className="flex items-center gap-2"><LayoutGrid size={16} /> My Vault</div>
            {activeTab === "vault" && <div className="absolute bottom-[-2px] left-0 w-full h-[2px] bg-[#5A0000] rounded-t-full" />}
          </button>
          
          <button
            onClick={() => setActiveTab("privacy")}
            className={`py-2 text-sm font-bold transition-all relative ${activeTab === "privacy" ? "text-[#5A0000]" : "text-gray-400 hover:text-gray-600"}`}
          >
            <div className="flex items-center gap-2"><ShieldCheck size={16} /> Security & Storage</div>
            {activeTab === "privacy" && <div className="absolute bottom-[-2px] left-0 w-full h-[2px] bg-[#5A0000] rounded-t-full" />}
          </button>
        </div>

        {/* ======================= */}
        {/* TAB CONTENT: MY VAULT   */}
        {/* ======================= */}
        {activeTab === "vault" && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="font-bold text-lg text-gray-800">{isSelectMode ? `${selectedIds.length} Selected` : 'Vault Memories'}</h2>
              <div className="flex items-center gap-2">
                {isSelectMode && <button onClick={exitSelectMode} className="text-[10px] font-bold text-red-600 uppercase tracking-widest px-2 py-0.5 border border-red-200 rounded hover:bg-red-50 transition-colors">Cancel</button>}
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${isAccountPrivate ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-green-100 text-green-600 border border-green-200'}`}>
                  {isAccountPrivate ? 'Private' : 'Public'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {myMedia.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-white border border-gray-200 rounded-[20px] shadow-sm">
                  <ImageIcon size={32} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-bold text-gray-400">Vault is empty</p>
                </div>
              ) : myMedia.slice(0, visibleCount).map((item, index) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                <div 
                  key={item.id} 
                  onMouseDown={() => handleTouchStartLongPress(item.id)}
                  onMouseUp={handleTouchEndLongPress}
                  onTouchStart={() => handleTouchStartLongPress(item.id)}
                  onTouchEnd={handleTouchEndLongPress}
                  onClick={() => isSelectMode ? toggleSelection(item.id) : setSelectedIndex(index)}
                  className={`group relative overflow-hidden rounded-[16px] border-2 bg-gray-100 cursor-pointer transition-all ${isSelected ? 'border-[#5a0000] scale-95 shadow-inner' : 'border-gray-200 shadow-sm hover:shadow-md'}`}
                >
                  <div className={`relative aspect-[4/5] sm:aspect-square ${isSelected ? 'opacity-70' : 'opacity-100'}`}>
                    {item.type === 'video' ? (
                      <>
                        <img src={getOptimizedMediaUrl(item.thumbnail || item.url, item.type)} className="h-full w-full object-cover" alt="video" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="rounded-full bg-black/50 p-2"><Play className="w-4 h-4 fill-white text-white" /></div>
                        </div>
                      </>
                    ) : (
                      <img src={getOptimizedMediaUrl(item.url, item.type)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" alt="memory" />
                    )}
                  </div>
                  
                  {isSelectMode && (
                    <div className={`absolute top-1.5 right-1.5 w-5 h-5 z-40 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-[#5a0000] border-[#5a0000]' : 'bg-white/40 border-white'}`}>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                  )}

                  {!isSelectMode && (
                    <button onClick={(e) => handleDeleteRequest(item.id, e)} className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-md bg-red-500/90 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all shadow-sm">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}

                  {!isSelectMode && (
                    <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      const newStatus = !item.isPrivate;
                      try {
                        await updateDoc(doc(db, 'mandal_gallery', item.id), { isPrivate: newStatus });
                      } catch (err) {
                        alert("Privacy update failed.");
                      }
                    }}
                    className="absolute left-1.5 top-1.5 z-30 transition-transform active:scale-90"
                    title={item.isPrivate ? "Unlock for Gallery" : "Lock from Gallery"}
                  >
                    {item.isPrivate ? (
                      <div className="rounded-md bg-black/60 p-1 backdrop-blur-sm border border-white/10">
                        <Lock className="w-2.5 h-2.5 text-red-400" />
                      </div>
                    ) : (
                      <div className="rounded-md bg-white/80 p-1 backdrop-blur-sm border border-gray-200 shadow-sm">
                        <Unlock className="w-2.5 h-2.5 text-gray-600" />
                      </div>
                    )}
                  </button>
                  )}
                </div>
              )})}
            </div>

            {myMedia.length > visibleCount && (
              <div ref={loadMoreRef} className="w-full flex justify-center py-6">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            )}
          </div>
        )}

      {isSelectMode && selectedIds.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] w-[90%] max-w-md bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 flex items-center justify-around animate-fade-in">
           <button onClick={() => handleBulkLock(true)} className="flex flex-col items-center gap-1 text-gray-600 hover:text-red-600 transition-colors"><Lock size={20}/><span className="text-[10px] font-bold">LOCK</span></button>
           <button onClick={() => handleBulkLock(false)} className="flex flex-col items-center gap-1 text-gray-600 hover:text-green-600 transition-colors"><Unlock size={20}/><span className="text-[10px] font-bold">UNLOCK</span></button>
           <button onClick={handleBulkDelete} className="flex flex-col items-center gap-1 text-red-600 hover:text-red-800 transition-colors"><Trash2 size={20}/><span className="text-[10px] font-bold">DELETE</span></button>
           <button onClick={exitSelectMode} className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"><X size={20}/><span className="text-[10px] font-bold">CLOSE</span></button>
        </div>
      )}

        {/* ============================== */}
        {/* TAB CONTENT: PRIVACY & STORAGE */}
        {/* ============================== */}
        {activeTab === "privacy" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-gray-200 rounded-2xl shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-50 text-red-500 rounded-xl"><Lock size={20} /></div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">Account Privacy</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">Hide your vault uploads from the public gallery</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                <span className="text-[10px] font-bold text-gray-600 uppercase">{isAccountPrivate ? 'Stealth Mode' : 'Public'}</span>
                <button onClick={toggleInstantPrivacy} className={`w-10 h-5 rounded-full transition-all relative ${isAccountPrivate ? 'bg-[#5A0000]' : 'bg-gray-300'}`}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all shadow-sm ${isAccountPrivate ? 'translate-x-5.5' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div className="bg-white p-5 flex items-center justify-between gap-4 border border-gray-200 rounded-2xl shadow-sm">
              <div className="flex items-center gap-4 w-full">
                <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl"><Database size={20} /></div>
                <div className="w-full">
                  <div className="flex justify-between items-end mb-1">
                    <h3 className="font-bold text-gray-800 text-sm">Cloud Storage</h3>
                    <span className="text-[10px] text-gray-500 font-bold">{storageUsedMB} MB / 500 MB</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500 transition-all" style={{ width: `${storagePercent}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-gray-200 p-6 w-full max-w-md rounded-3xl shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Edit Profile</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-2 border-b border-gray-100 mb-2">
                <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-gray-100 bg-gray-50">
                  {photoURL ? <img src={photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-2xl font-bold text-white drop-shadow-md">{displayName.charAt(0).toUpperCase()}</div>}
                  {isUploadingPhoto && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-5 h-5 text-white animate-spin" /></div>}
                </div>
                <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[11px] font-bold uppercase tracking-widest text-[#5A0000] hover:underline flex items-center gap-1">
                  <Camera size={12} /> Change Photo
                </button>
              </div>
              <div>
                <label className="block text-gray-500 text-xs font-bold mb-1.5 ml-1 uppercase tracking-widest">Display Name</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:border-[#5A0000] focus:outline-none" required />
              </div>
              <div>
                <label className="block text-gray-500 text-xs font-bold mb-1.5 ml-1 uppercase tracking-widest">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:border-[#5A0000] focus:outline-none min-h-[80px]" />
              </div>

              <div className="pt-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Privacy Control</p>
                <div 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer" 
                  onClick={() => setIsAccountPrivate(!isAccountPrivate)}
                >
                  <div className="flex items-center gap-3">
                    {isAccountPrivate ? <Lock className="w-4 h-4 text-red-600" /> : <Unlock className="w-4 h-4 text-green-600" />}
                    <span className="text-xs font-bold text-gray-700">{isAccountPrivate ? 'Private Account' : 'Public Account'}</span>
                  </div>
                  <div className={`w-8 h-4 rounded-full relative transition-all ${isAccountPrivate ? 'bg-[#5a0000]' : 'bg-gray-300'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${isAccountPrivate ? 'left-4.5' : 'left-0.5'}`} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 font-bold rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" disabled={isUpdating} className="flex-1 bg-[#5A0000] hover:bg-red-900 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {isUpdating ? 'Saving...' : <><Save size={16}/> Save</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔥 THE NEW LIGHTBOX VIEWER WITH SLIDE SWAP */}
      {selectedMedia && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-black/95 backdrop-blur-xl animate-fade-in touch-none">
          <div className="absolute top-0 w-full p-4 flex justify-between items-start z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <div className="flex flex-col pointer-events-auto">
              <span className="text-white font-black uppercase tracking-widest text-sm">{selectedMedia.uploadedBy}</span>
              <span className="text-gray-400 text-[10px] font-bold uppercase">{new Date(selectedMedia.createdAt).toLocaleString()}</span>
            </div>
            <button onClick={() => setSelectedIndex(null)} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all pointer-events-auto"><X className="w-5 h-5" /></button>
          </div>

          <div 
            className="flex-1 relative flex items-center overflow-hidden touch-none" 
            onClick={() => setSelectedIndex(null)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="absolute top-[15%] bottom-[15%] left-0 w-[30%] z-[45]" onClick={(e) => { e.stopPropagation(); if (Date.now() - lastSwipeTime.current < 300) return; handlePrev(); }} />
            <div className="absolute top-[15%] bottom-[15%] right-0 w-[30%] z-[45]" onClick={(e) => { e.stopPropagation(); if (Date.now() - lastSwipeTime.current < 300) return; handleNext(); }} />
            <button onClick={handlePrev} className="absolute left-4 z-50 p-3 bg-white/5 text-white rounded-full hover:bg-white/20 transition-all hidden sm:block"><ChevronLeft className="w-6 h-6" /></button>
            
            <div 
              className="flex w-full h-full items-center will-change-transform"
              style={{
                transform: `translate3d(calc(-${(selectedIndex || 0) * 100}% + ${swipeOffset}px), 0, 0)`,
                transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
              }}
            >
              {myMedia.map((item, index) => {
                const isNear = Math.abs(index - (selectedIndex || 0)) <= 1;

                return (
                  <div key={item.id} className="min-w-full h-full flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
                    {isNear ? (
                      item.type === 'video' ? (
                        index === selectedIndex ? (
                          <div className="relative w-full h-full flex items-center justify-center bg-black">
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-10 h-10 border-4 border-white/10 border-t-yellow-500 rounded-full animate-spin"></div>
                            </div>

                            <video
                              ref={videoRef}
                              src={item.url}
                              poster={getOptimizedMediaUrl(item.url, item.type)}
                              playsInline
                              loop
                              onClick={togglePlayPause}
                              onTimeUpdate={handleTimeUpdate}
                              className="max-h-full max-w-full object-contain pointer-events-auto rounded-xl shadow-2xl border border-white/10 relative z-10 bg-black/50"
                              style={{ willChange: 'transform', transform: 'translate3d(0,0,0)' }}
                            />
                            {!isPlaying && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                <div className="bg-black/50 backdrop-blur-sm rounded-full p-4"><Play className="w-12 h-12 text-white fill-white" /></div>
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-40">
                              <div className="h-full bg-white transition-all duration-75" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        ) : (
                          <div className="relative flex items-center justify-center max-h-full max-w-full rounded-xl overflow-hidden">
                            <img src={getOptimizedMediaUrl(item.thumbnail || item.url, item.type)} className="max-h-full max-w-full object-contain blur-[2px]" alt="video-poster" />
                            <Play className="absolute w-16 h-16 text-white/70" />
                          </div>
                        )
                      ) : (
                        <img src={item.url} className="max-h-full max-w-full object-contain select-none rounded-xl shadow-2xl border border-white/10 pointer-events-none" alt="fullscreen" />
                      )
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={handleNext} className="absolute right-4 z-50 p-3 bg-white/5 text-white rounded-full hover:bg-white/20 transition-all hidden sm:block"><ChevronRight className="w-6 h-6" /></button>
          </div>

          <div className="w-full bg-black/80 p-4 pb-8 sm:pb-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 z-50">
            <button onClick={(e) => handleDeleteRequest(selectedMedia.id, e)} className="flex items-center justify-center gap-2 w-full sm:w-auto p-2.5 px-4 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/20 active:scale-95">
              <Trash2 className="w-4 h-4" /> <span className="font-bold text-[10px] uppercase tracking-widest hidden sm:block">Delete memory</span>
            </button>
            <div className="flex gap-2 w-full sm:w-auto">
              <a 
                href={selectedMedia.url.replace('/upload/', '/upload/q_auto:eco,w_1080/')} 
                target="_blank" 
                download 
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white text-[10px] font-bold uppercase tracking-widest transition-all border border-white/10 shadow-sm"
                style={{ color: 'beige' }}
              >
                <Smartphone className="w-3.5 h-3.5" /> WhatsApp Size
              </a>
              <a href={selectedMedia.url} target="_blank" download style={{ color: '#000000' }} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-yellow-500 !text-black text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95">
                <Download className="w-3.5 h-3.5 !text-black" stroke="black" /> Original HD
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {mediaToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3"><Trash2 className="w-6 h-6 text-red-500" /></div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Memory?</h3>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setMediaToDelete(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={confirmDeleteMedia} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
