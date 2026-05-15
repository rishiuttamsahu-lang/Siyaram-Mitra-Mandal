"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { Upload, Play, Shield, Search, Filter, X, ChevronLeft, ChevronRight, Download, Smartphone, Heart, Trash2, Info, Share2, Bookmark, Edit, Save } from 'lucide-react';

const CATEGORIES = ["All", "Aarti", "Visarjan", "Decoration", "Mandal Setup", "Bappa Darshan", "Events", "Memories", "Celebration Moments"];

export default function Gallery({ userData }: { userData: any }) {
  const [media, setMedia] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true); // 🔥 Naya loading state
  const [isUploading, setIsUploading] = useState(false);
  const [isCloudinaryReady, setIsCloudinaryReady] = useState(false);
  const [adminSettings, setAdminSettings] = useState<any>(null);
  
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [mediaType, setMediaType] = useState("All");
  const [sortBy, setSortBy] = useState("Newest");

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedMedia = selectedIndex !== null ? displayedMedia()[selectedIndex] : null;

  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // 🔥 PHASE 3: Admin Edit States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCategory, setEditCategory] = useState("");
  const [editUploadedBy, setEditUploadedBy] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).cloudinary) setIsCloudinaryReady(true);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'mandal_settings', 'system'), (snap) => {
      if (snap.exists()) setAdminSettings(snap.data());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setIsLoading(true); // Fetch shuru hote hi loading ON
    
    // 1. Role ke hisab se query build karo (The Fix)
    let q;
    if (userData.role === 'Admin') {
      // Admin can request all documents
      q = query(collection(db, 'mandal_gallery'), orderBy('createdAt', 'desc'));
    } else {
      // Normal users MUST specifically request only public documents to pass Security Rules
      q = query(
        collection(db, 'mandal_gallery'), 
        where('isPrivate', '==', false), 
        orderBy('createdAt', 'desc')
      );
    }

    const unsub = onSnapshot(q, (snap) => {
      const allMedia: any[] = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      
      // Ab frontend filter ki zyada zaroorat nahi kyunki database hi filter karke de raha hai, 
      // par safety ke liye isey chhod sakte hain
      const filteredMedia = allMedia.filter((item: any) => {
        if (userData.role === 'Admin') return true;
        return item.isPrivate !== true; 
      });
      
      setMedia(filteredMedia);
      setIsLoading(false); // ✅ Data milte hi loading OFF
    }, (error) => {
      console.error("Gallery Fetch Error: ", error);
      setIsLoading(false); // Error aaye toh bhi loading band
    });

    return () => unsub();
  }, [userData.email, userData.role]);

  function displayedMedia() {
    let filtered = media.filter((item) => {
      const matchesCategory = activeCategory === "All" || item.category === activeCategory;
      const matchesSearch = item.uploadedBy?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (item.tags && item.tags.join(' ').toLowerCase().includes(searchQuery.toLowerCase())) ||
                            item.category?.toLowerCase().includes(searchQuery.toLowerCase());
      let matchesType = true;
      if (mediaType === "Photos") matchesType = item.type === "image";
      if (mediaType === "Videos") matchesType = item.type === "video";
      
      return matchesCategory && matchesSearch && matchesType;
    });

    filtered.sort((a, b) => {
      if (sortBy === "Newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "Oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "Popular") return (b.likes?.length || 0) - (a.likes?.length || 0);
      return 0;
    });

    return filtered;
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (selectedIndex === null || isEditModalOpen) return;
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'Escape') setSelectedIndex(null);
  }, [selectedIndex, isEditModalOpen, displayedMedia().length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev !== null ? (prev + 1) % displayedMedia().length : null));
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev !== null ? (prev - 1 + displayedMedia().length) % displayedMedia().length : null));
  };

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 50) handleNext();
    if (distance < -50) handlePrev();
    setTouchStart(0);
    setTouchEnd(0);
  };

  const toggleLike = async (mediaId: string, currentLikes: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    const mediaRef = doc(db, 'mandal_gallery', mediaId);
    if (currentLikes?.includes(userData.uid)) {
      await updateDoc(mediaRef, { likes: arrayRemove(userData.uid) });
    } else {
      await updateDoc(mediaRef, { likes: arrayUnion(userData.uid) });
    }
  };

  // 🔥 PHASE 3: Bookmark / Favorite System
  const toggleBookmark = async (mediaId: string, currentFavorites: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    const mediaRef = doc(db, 'mandal_gallery', mediaId);
    if (currentFavorites?.includes(userData.uid)) {
      await updateDoc(mediaRef, { favorites: arrayRemove(userData.uid) });
    } else {
      await updateDoc(mediaRef, { favorites: arrayUnion(userData.uid) });
    }
  };

  // 🔥 PHASE 3: Native Share System
  const handleShare = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Siyaram Mitra Mandal',
          text: 'Check out this memory from our Mandal Vault!',
          url: url
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  // 🔥 PHASE 3: Admin Edit System
  const openEditModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCategory(selectedMedia.category || "Events");
    setEditUploadedBy(selectedMedia.uploadedBy || "");
    setIsEditModalOpen(true);
  };

  const handleAdminEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedia) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'mandal_gallery', selectedMedia.id), {
        category: editCategory,
        uploadedBy: editUploadedBy
      });
      setIsEditModalOpen(false);
    } catch (err) {
      console.error("Edit failed", err);
    }
    setIsSaving(false);
  };

  const deleteMedia = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm('Permanently delete this from the Vault?')) {
      await deleteDoc(doc(db, 'mandal_gallery', id));
      setSelectedIndex(null);
    }
  };

  const getMediumQualityUrl = (url: string) => {
    if (!url.includes('/upload/')) return url;
    return url.replace('/upload/', '/upload/q_auto:eco,w_1080/');
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return 'Unknown Size';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const openUploadWidget = () => { 
    if (typeof window === 'undefined' || !(window as any).cloudinary) return;
    const widget = (window as any).cloudinary.createUploadWidget(
      { cloudName: 'dldkk7bql', uploadPreset: 'siyaram_prese', sources: ['local', 'camera', 'url'], resourceType: 'auto', maxFiles: 20 },
      async (error: any, result: any) => {
        if (!error && result && result.event === 'success') {
          setIsUploading(true);
          try {
            await addDoc(collection(db, 'mandal_gallery'), {
              url: result.info.secure_url, thumbnail: result.info.thumbnail_url || result.info.secure_url,
              type: result.info.resource_type, uploadedBy: userData.name, uploaderEmail: userData.email,
              createdAt: new Date().toISOString(), size: result.info.bytes, isPrivate: userData.isAccountPrivate || false,
              category: activeCategory !== "All" ? activeCategory : "Events", likes: [], favorites: [],
              resolution: result.info.width ? `${result.info.width}x${result.info.height}` : "HD"
            });
          } catch (err) {}
          setIsUploading(false);
        }
      }
    );
    widget.open();
  };

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      <Script src="https://upload-widget.cloudinary.com/global/all.js" strategy="afterInteractive" onLoad={() => setIsCloudinaryReady(true)} />

      {/* HEADER & FILTERS */}
      <div className="sticky top-[50px] z-30 bg-gray-50/90 backdrop-blur-xl border-b border-gray-200 px-3 py-3 -mx-4 sm:mx-0 sm:px-0 transition-all">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-[#5A0000] leading-none" style={{ fontFamily: "'Gotu', sans-serif" }}>Vault</h2>
            <Shield className="w-3.5 h-3.5 text-green-600 hidden sm:block" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="p-2 bg-white border border-gray-200 rounded-full text-gray-600 shadow-sm active:scale-95">
              <Search className="w-4 h-4" />
            </button>
            {userData?.role !== 'Viewer' && (
              <button onClick={openUploadWidget} disabled={isUploading || !isCloudinaryReady} className="flex items-center justify-center gap-1.5 rounded-full bg-[#5A0000] px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-lg active:scale-95 disabled:opacity-50">
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isUploading ? '...' : 'Upload'}</span>
              </button>
            )}
          </div>
        </div>

        {isSearchOpen && (
          <div className="mb-2 animate-fade-in">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input type="text" placeholder="Search by name or tag..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-gray-800 outline-none focus:border-[#5A0000] shadow-sm" />
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-2 px-1">
          <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} className="flex-1 text-[9px] sm:text-[10px] font-black uppercase bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none text-gray-600 focus:border-[#5A0000] shadow-sm">
            <option value="All">All Media</option>
            <option value="Photos">Photos Only</option>
            <option value="Videos">Videos Only</option>
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="flex-1 text-[9px] sm:text-[10px] font-black uppercase bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none text-gray-600 focus:border-[#5A0000] shadow-sm">
            <option value="Newest">Newest First</option>
            <option value="Oldest">Oldest First</option>
            <option value="Popular">Most Liked ❤️</option>
          </select>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${activeCategory === cat ? "bg-gray-900 text-white shadow-md" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* MASONRY GRID */}
      {isLoading ? (
        /* 🔥 Premium Loading Spinner */
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-gray-200 border-t-[#5a0000] animate-spin"></div>
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-b-yellow-500 animate-[spin_2s_linear_infinite]"></div>
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-gray-400 animate-pulse">
            Accessing Vault...
          </p>
        </div>
      ) : displayedMedia().length === 0 ? (
        <div className="py-24 text-center text-gray-400">
          <Filter className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-black uppercase tracking-widest">No memories found.</p>
        </div>
      ) : (
        <div className="columns-2 gap-2 space-y-2 md:gap-4 md:space-y-4 lg:columns-4 px-1 sm:px-0">
          {displayedMedia().map((item, index) => (
            <div key={item.id} onClick={() => setSelectedIndex(index)} className="group relative break-inside-avoid cursor-pointer overflow-hidden rounded-xl sm:rounded-2xl bg-gray-100 transition-all hover:opacity-90">
              {item.type === 'video' ? (
                <div className="relative">
                  <img src={item.thumbnail} className="h-auto w-full object-cover" alt="video" loading="lazy" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="rounded-full bg-black/40 backdrop-blur-md p-2 sm:p-3">
                      <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-white text-white" />
                    </div>
                  </div>
                </div>
              ) : (
                <img src={item.url.replace('/upload/', '/upload/q_auto:low,w_600/')} className="h-auto w-full object-cover" alt="memory" loading="lazy" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-12 opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100 flex justify-between items-end">
                <div className="flex flex-col">
                  <p className="text-[9px] sm:text-[10px] font-bold tracking-widest text-white uppercase drop-shadow-md">{item.uploadedBy.split(' ')[0]}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1"><Heart className={`w-3 h-3 ${item.likes?.includes(userData.uid) ? 'fill-red-500 text-red-500' : 'text-white'}`} /><span className="text-[8px] font-bold text-white">{item.likes?.length || 0}</span></span>
                  </div>
                </div>
                {item.category && <span className="text-[7px] px-1.5 py-0.5 bg-white/20 backdrop-blur-md rounded text-white font-black uppercase">{item.category}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* THE PREMIUM LIGHTBOX VIEWER */}
      {selectedMedia && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-xl animate-fade-in touch-none">
          
          <div className="absolute top-0 w-full p-4 flex justify-between items-start z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <div className="flex flex-col pointer-events-auto">
              <span className="text-white font-black uppercase tracking-widest text-sm">{selectedMedia.uploadedBy}</span>
              <span className="text-gray-400 text-[10px] font-bold uppercase">{new Date(selectedMedia.createdAt).toLocaleString()} • {selectedMedia.category || 'Event'}</span>
            </div>
            <button onClick={() => setSelectedIndex(null)} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 hover:rotate-90 transition-all pointer-events-auto">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div 
            className="flex-1 relative flex items-center justify-center overflow-hidden" 
            onClick={() => setSelectedIndex(null)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <button onClick={handlePrev} className="absolute left-4 z-50 p-3 bg-black/50 text-white rounded-full hover:bg-black/80 transition-all hidden sm:block"><ChevronLeft className="w-8 h-8" /></button>
            
            <div className="relative w-full h-full max-h-[70vh] flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
              {selectedMedia.type === 'video' ? (
                <video controls autoPlay className="max-h-full max-w-full rounded-lg shadow-2xl">
                  <source src={selectedMedia.url} type="video/mp4" />
                </video>
              ) : (
                <img src={selectedMedia.url} className="max-h-full max-w-full object-contain select-none rounded-lg shadow-2xl drop-shadow-2xl" alt="fullscreen" />
              )}

            </div>

            <button onClick={handleNext} className="absolute right-4 z-50 p-3 bg-black/50 text-white rounded-full hover:bg-black/80 transition-all hidden sm:block"><ChevronRight className="w-8 h-8" /></button>
          </div>

          <div className="w-full bg-black/80 p-4 pb-8 sm:pb-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10 z-50">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto overflow-x-auto scrollbar-hide">
              {/* Like */}
              <button onClick={(e) => toggleLike(selectedMedia.id, selectedMedia.likes || [], e)} className="flex items-center gap-2 p-2 px-3 sm:px-4 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95">
                <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${selectedMedia.likes?.includes(userData.uid) ? 'fill-red-500 text-red-500' : ''}`} />
                <span className="font-bold text-xs">{selectedMedia.likes?.length || 0}</span>
              </button>
              
              {/* Bookmark */}
              <button onClick={(e) => toggleBookmark(selectedMedia.id, selectedMedia.favorites || [], e)} className="flex items-center gap-2 p-2 px-3 sm:px-4 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95">
                <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 ${selectedMedia.favorites?.includes(userData.uid) ? 'fill-yellow-500 text-yellow-500' : ''}`} />
              </button>

              {/* Share */}
              <button onClick={(e) => handleShare(selectedMedia.url, e)} className="flex items-center gap-2 p-2 px-3 sm:px-4 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95">
                <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              
              {/* Admin Tools */}
              {(userData.role === 'Admin' || selectedMedia.uploaderEmail === userData.email) && (
                <div className="flex gap-2 ml-auto sm:ml-0">
                  {userData.role === 'Admin' && (
                    <button onClick={openEditModal} className="p-2 px-3 sm:px-4 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all active:scale-95 border border-blue-500/20">
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={(e) => deleteMedia(selectedMedia.id, e)} className="p-2 px-3 sm:px-4 rounded-xl bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 border border-red-500/20">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 bg-white/5 rounded-xl border border-white/10 text-gray-300 ml-auto sm:ml-0">
                <Info className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase tracking-widest">{selectedMedia.resolution} • {formatSize(selectedMedia.size)}</span>
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              {/* WhatsApp Size (SD) Button - High Visibility */}
              <a 
                href={selectedMedia.url.replace('/upload/', '/upload/q_auto:eco,w_1080/')} 
                target="_blank" 
                download 
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white text-[10px] font-bold uppercase tracking-widest transition-all border border-white/10 shadow-sm"
                style={{ color: 'beige' }}
              >
                <Smartphone className="w-4 h-4" /> SD Quality
              </a>
              {adminSettings?.hdDownloads && (
                <a href={selectedMedia.url} target="_blank" download className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-[#5A0000] text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95">
                  <Download className="w-4 h-4" /> Original HD
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 PHASE 3: ADMIN EDIT MODAL */}
      {isEditModalOpen && selectedMedia && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#1a0505] border border-red-900/30 w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative">
            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-white/50 hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-xl font-black text-white mb-1">Edit Metadata</h3>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-6">Admin Authority System</p>
            
            <form onSubmit={handleAdminEditSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Uploader Name</label>
                <input type="text" value={editUploadedBy} onChange={(e) => setEditUploadedBy(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-500" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Category</label>
                <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full bg-[#2a0808] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-500">
                  {CATEGORIES.filter(c => c !== "All").map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <button type="submit" disabled={isSaving} className="w-full bg-red-600 text-white py-3 mt-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 flex items-center justify-center gap-2">
                {isSaving ? "Saving..." : <><Save className="w-4 h-4" /> Apply Changes</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
