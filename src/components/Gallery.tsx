"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Script from 'next/script';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { Upload, Play, Shield, Search, Filter, X, ChevronLeft, ChevronRight, Download, Smartphone, Heart, Trash2, Info, Share2, Bookmark, Edit, Save, ChevronDown, CheckCircle2 } from 'lucide-react';

const CATEGORIES = ["All", "Aarti", "Visarjan", "Decoration", "Mandal Setup", "Bappa Darshan", "Events", "Memories", "Celebration Moments"];

const CustomSelect = ({ value, onChange, options, placeholder, theme = 'light' }: { value: any, onChange: any, options: any[], placeholder?: string, theme?: 'light' | 'dark' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const isDark = theme === 'dark';

  const triggerDark = `bg-[#2a0808]/90 backdrop-blur-md border border-white/10 px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-black text-white uppercase tracking-widest hover:bg-[#3a0a0a] ${isOpen ? 'border-red-500 ring-1 ring-red-500/50' : ''}`;
  const triggerLight = `bg-white border border-gray-200 px-3 py-2 sm:py-2.5 text-[9px] sm:text-[10px] font-black uppercase text-gray-700 hover:bg-gray-50 shadow-sm ${isOpen ? 'border-[#5A0000] ring-1 ring-[#5A0000]/30' : ''}`;
  const dropdownDark = 'bg-[#1a0505] border border-red-900/30 shadow-2xl';
  const dropdownLight = 'bg-white border border-gray-100 shadow-xl';

  const getOptionClass = (isSelected: boolean) => {
    if (isDark) return isSelected ? 'bg-red-500/20 text-red-400' : 'text-gray-300 hover:bg-[#2a0808] text-white';
    return isSelected ? 'bg-red-50 text-[#5A0000]' : 'text-gray-700 hover:bg-gray-50';
  };

  return (
    <div className={`relative w-full ${isOpen ? 'z-[100]' : 'z-10'}`} ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between w-full cursor-pointer select-none transition-all rounded-lg sm:rounded-xl outline-none ${isDark ? triggerDark : triggerLight}`}>
        <span className="truncate pr-4">{selectedOption ? selectedOption.label : (placeholder || 'Select...')}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
      </div>

      {isOpen && (
        <div className={`absolute top-[calc(100%+6px)] left-0 min-w-full w-max rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[9999] ${isDark ? dropdownDark : dropdownLight}`}>
          <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
            {options.map((opt, idx) => {
              const isSelected = String(value) === String(opt.value);
              return (
                <div key={idx} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`px-4 py-3 cursor-pointer transition-colors text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-between ${getOptionClass(isSelected)}`}>
                  <span className="whitespace-nowrap">{opt.label}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 ml-3 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default function Gallery({ userData }: { userData: any }) {
  const [media, setMedia] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isCloudinaryReady, setIsCloudinaryReady] = useState(false);
  const [adminSettings, setAdminSettings] = useState<any>(null);

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [mediaType, setMediaType] = useState('All');
  const [sortBy, setSortBy] = useState('Newest');

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedMedia = selectedIndex !== null ? displayedMedia()[selectedIndex] : null;

  const [touchStart, setTouchStart] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [editUploadedBy, setEditUploadedBy] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  // Properly handle play() promises to avoid AbortError when the user swipes or pauses quickly.
  useEffect(() => {
    setProgress(0);

    if (videoRef.current && selectedIndex !== null) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((error) => {
            console.log('Auto-play interrupted or blocked:', error);
            setIsPlaying(false);
          });
      }
    }
  }, [selectedIndex]);

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
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
    if (!videoRef.current) return;

    const current = videoRef.current.currentTime;
    const total = videoRef.current.duration;
    setProgress((current / total) * 100 || 0);
  };

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
    setIsLoading(true);
    let q;
    if (userData.role === 'Admin') {
      q = query(collection(db, 'mandal_gallery'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'mandal_gallery'), where('isPrivate', '==', false), orderBy('createdAt', 'desc'));
    }

    const unsub = onSnapshot(q, (snap) => {
      const allMedia: any[] = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      const filteredMedia = allMedia.filter((item: any) => userData.role === 'Admin' || item.isPrivate !== true);
      setMedia(filteredMedia);
      setIsLoading(false);
    }, (error) => {
      console.error('Gallery Fetch Error: ', error);
      setIsLoading(false);
    });

    return () => unsub();
  }, [userData.email, userData.role]);

  function displayedMedia() {
    const filtered = media.filter((item) => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const matchesSearch = item.uploadedBy?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.tags && item.tags.join(' ').toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesType = true;
      if (mediaType === 'Photos') matchesType = item.type === 'image';
      if (mediaType === 'Videos') matchesType = item.type === 'video';

      return matchesCategory && matchesSearch && matchesType;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'Newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'Oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'Popular') return (b.likes?.length || 0) - (a.likes?.length || 0);
      return 0;
    });

    return filtered;
  }

  const displayedMediaCount = displayedMedia().length;

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev !== null && prev < displayedMediaCount - 1 ? prev + 1 : prev));
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (selectedIndex === null || isEditModalOpen) return;
    if (e.key === 'ArrowRight') setSelectedIndex((prev) => (prev !== null && prev < displayedMediaCount - 1 ? prev + 1 : prev));
    if (e.key === 'ArrowLeft') setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
    if (e.key === 'Escape') setSelectedIndex(null);
  }, [selectedIndex, isEditModalOpen, displayedMediaCount]);

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
    if (swipeOffset > 60) handlePrev();
    else if (swipeOffset < -60) handleNext();
    setSwipeOffset(0);
    setTouchStart(0);
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

  const toggleBookmark = async (mediaId: string, currentFavorites: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    const mediaRef = doc(db, 'mandal_gallery', mediaId);
    if (currentFavorites?.includes(userData.uid)) {
      await updateDoc(mediaRef, { favorites: arrayRemove(userData.uid) });
    } else {
      await updateDoc(mediaRef, { favorites: arrayUnion(userData.uid) });
    }
  };

  const handleShare = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Siyaram Mitra Mandal', text: 'Check out this memory from our Mandal Vault!', url });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  const openEditModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCategory(selectedMedia.category || 'Events');
    setEditUploadedBy(selectedMedia.uploadedBy || '');
    setIsEditModalOpen(true);
  };

  const handleAdminEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedia) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'mandal_gallery', selectedMedia.id), { category: editCategory, uploadedBy: editUploadedBy });
      setIsEditModalOpen(false);
    } catch {}
    setIsSaving(false);
  };

  const deleteMedia = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm('Permanently delete this from the Vault?')) {
      await deleteDoc(doc(db, 'mandal_gallery', id));
      setSelectedIndex(null);
    }
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
              url: result.info.secure_url,
              thumbnail: result.info.thumbnail_url || result.info.secure_url,
              type: result.info.resource_type,
              uploadedBy: userData.name,
              uploaderEmail: userData.email,
              createdAt: new Date().toISOString(),
              size: result.info.bytes,
              isPrivate: userData.isAccountPrivate || false,
              category: activeCategory !== 'All' ? activeCategory : 'Events',
              likes: [],
              favorites: [],
              resolution: result.info.width ? `${result.info.width}x${result.info.height}` : 'HD',
            });
          } catch {}
          setIsUploading(false);
        }
      }
    );
    widget.open();
  };

  const getOptimizedMediaUrl = (url: string, type: string) => {
    if (!url || !url.includes('/upload/')) return url;
    if (type?.startsWith('video')) return url.replace(/\.[^/.]+$/, '.jpg').replace('/upload/', '/upload/q_auto:good,w_800/');
    return url.replace('/upload/', '/upload/q_auto:good,w_600/');
  };

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      <Script src="https://upload-widget.cloudinary.com/global/all.js" strategy="afterInteractive" onLoad={() => setIsCloudinaryReady(true)} />

      <div className="sticky top-[50px] z-30 bg-gray-50/90 backdrop-blur-xl border-b border-gray-200 px-3 py-3 -mx-4 sm:mx-0 sm:px-0 transition-all">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-[#5A0000] leading-none" style={{ fontFamily: "'Gotu', sans-serif" }}>Gallery</h2>
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
          <div className="flex-1">
            <CustomSelect value={mediaType} onChange={setMediaType} options={[{ value: 'All', label: 'All Media' }, { value: 'Photos', label: 'Photos Only' }, { value: 'Videos', label: 'Videos Only' }]} theme="light" />
          </div>
          <div className="flex-1">
            <CustomSelect value={sortBy} onChange={setSortBy} options={[{ value: 'Newest', label: 'Newest First' }, { value: 'Oldest', label: 'Oldest First' }, { value: 'Popular', label: 'Most Liked ❤️' }]} theme="light" />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${activeCategory === cat ? 'bg-gray-900 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-gray-200 border-t-[#5a0000] animate-spin" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-b-yellow-500 animate-[spin_2s_linear_infinite]" />
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-gray-400 animate-pulse">Loading Gallery...</p>
        </div>
      ) : displayedMedia().length === 0 ? (
        <div className="py-24 text-center text-gray-400">
          <Filter className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-black uppercase tracking-widest">No memories found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 md:gap-4 md:grid-cols-4 lg:grid-cols-5 px-1 sm:px-0">
          {displayedMedia().map((item, index) => (
            <div key={item.id} onClick={() => setSelectedIndex(index)} className="group relative break-inside-avoid cursor-pointer overflow-hidden rounded-lg sm:rounded-2xl bg-gray-100 transition-all hover:opacity-90 aspect-square sm:aspect-square shadow-sm">
              {item.type === 'video' ? (
                <div className="relative h-full w-full">
                  <img src={getOptimizedMediaUrl(item.url, item.type)} className="h-full w-full object-cover" alt="video" loading="lazy" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="rounded-full bg-black/40 backdrop-blur-md p-2">
                      <Play className="w-4 h-4 sm:w-6 sm:h-6 fill-white text-white" />
                    </div>
                  </div>
                </div>
              ) : (
                <img src={getOptimizedMediaUrl(item.url, item.type)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" alt="memory" loading="lazy" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 pt-8 opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100 flex justify-between items-end">
                <div className="flex flex-col">
                  <p className="text-[8px] sm:text-[10px] font-bold tracking-widest text-white uppercase drop-shadow-md truncate max-w-[60px] sm:max-w-[100px]">{item.uploadedBy.split(' ')[0]}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Heart className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${item.likes?.includes(userData.uid) ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                    <span className="text-[8px] font-bold text-white">{item.likes?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedMedia && (
        <div className="fixed inset-0 z-[10000] flex flex-col bg-black animate-fade-in touch-none">
          <div className="absolute top-0 w-full p-4 flex justify-between items-start z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <div className="flex flex-col pointer-events-auto">
              <span className="text-white font-black uppercase tracking-widest text-sm drop-shadow-md">{selectedMedia.uploadedBy}</span>
              <span className="text-gray-300 text-[10px] font-bold uppercase drop-shadow-md">{new Date(selectedMedia.createdAt).toLocaleString()} • {selectedMedia.category || 'Event'}</span>
            </div>
            <button onClick={() => setSelectedIndex(null)} className="p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all pointer-events-auto border border-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 relative flex items-center overflow-hidden touch-none" onClick={() => setSelectedIndex(null)} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <button onClick={handlePrev} className="absolute left-4 z-50 p-3 bg-black/50 text-white rounded-full hover:bg-black/80 transition-all hidden sm:block pointer-events-auto"><ChevronLeft className="w-8 h-8" /></button>

            <div className="flex w-full h-full items-center will-change-transform" style={{ transform: `translate3d(calc(-${(selectedIndex || 0) * 100}% + ${swipeOffset}px), 0, 0)`, transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}>
              {displayedMedia().map((item, index) => {
                const isNear = Math.abs(index - (selectedIndex || 0)) <= 1;

                return (
                  <div key={item.id} className="min-w-full h-full flex items-center justify-center px-0 relative" onClick={(e) => e.stopPropagation()}>
                    {isNear ? (
                      item.type === 'video' ? (
                        index === selectedIndex ? (
                          <div className="relative w-full h-full flex items-center justify-center bg-black">
                            <video
                              ref={videoRef}
                              src={item.url}
                              playsInline
                              loop
                              onClick={togglePlayPause}
                              onTimeUpdate={handleTimeUpdate}
                              className="max-h-full max-w-full object-contain pointer-events-auto"
                              style={{ willChange: 'transform', transform: 'translate3d(0,0,0)' }}
                            />

                            {!isPlaying && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="bg-black/50 backdrop-blur-sm rounded-full p-4">
                                  <Play className="w-12 h-12 text-white fill-white" />
                                </div>
                              </div>
                            )}

                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-40">
                              <div className="h-full bg-white transition-all duration-75" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        ) : (
                          <div className="relative w-full h-full flex items-center justify-center bg-black">
                            <img src={getOptimizedMediaUrl(item.url, item.type)} className="max-h-full max-w-full object-contain" alt="video-poster" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <Play className="w-16 h-16 text-white/50" />
                            </div>
                          </div>
                        )
                      ) : (
                        <img src={getOptimizedMediaUrl(item.url, item.type)} className="max-h-full max-w-full object-contain select-none pointer-events-none" alt="fullscreen" />
                      )
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={handleNext} className="absolute right-4 z-50 p-3 bg-black/50 text-white rounded-full hover:bg-black/80 transition-all hidden sm:block pointer-events-auto"><ChevronRight className="w-8 h-8" /></button>
          </div>

          <div className="absolute bottom-0 w-full p-4 pb-8 sm:pb-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-50 pointer-events-none">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto overflow-x-auto scrollbar-hide pointer-events-auto">
              <button onClick={(e) => toggleLike(selectedMedia.id, selectedMedia.likes || [], e)} className="flex items-center gap-2 p-2 px-3 sm:px-4 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all active:scale-95">
                <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${selectedMedia.likes?.includes(userData.uid) ? 'fill-red-500 text-red-500' : ''}`} />
                <span className="font-bold text-xs">{selectedMedia.likes?.length || 0}</span>
              </button>

              <button onClick={(e) => toggleBookmark(selectedMedia.id, selectedMedia.favorites || [], e)} className="flex items-center gap-2 p-2 px-3 sm:px-4 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all active:scale-95">
                <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 ${selectedMedia.favorites?.includes(userData.uid) ? 'fill-yellow-500 text-yellow-500' : ''}`} />
              </button>

              <button onClick={(e) => handleShare(selectedMedia.url, e)} className="flex items-center gap-2 p-2 px-3 sm:px-4 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all active:scale-95">
                <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {(userData.role === 'Admin' || selectedMedia.uploaderEmail === userData.email) && (
                <div className="flex gap-2 ml-auto sm:ml-0">
                  {userData.role === 'Admin' && (
                    <button onClick={openEditModal} className="p-2 px-3 sm:px-4 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all active:scale-95 border border-blue-500/20">
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={(e) => deleteMedia(selectedMedia.id, e)} className="p-2 px-3 sm:px-4 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 border border-red-500/20">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 text-gray-300 ml-auto sm:ml-0">
                <Info className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase tracking-widest">{selectedMedia.resolution} • {formatSize(selectedMedia.size)}</span>
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto pointer-events-auto">
              <a href={selectedMedia.url.replace('/upload/', '/upload/q_auto:eco,w_1080/')} target="_blank" download className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70 text-white text-[10px] font-bold uppercase tracking-widest transition-all border border-white/10 shadow-sm">
                <Smartphone className="w-4 h-4" /> SD
              </a>
              {adminSettings?.hdDownloads && (
                <a href={selectedMedia.url} target="_blank" download className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-gray-200 text-black text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95">
                  <Download className="w-4 h-4" /> Original HD
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedMedia && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#1a0505] border border-red-900/30 w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative">
            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
            <h3 className="text-xl font-black text-white mb-1">Edit Metadata</h3>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-6">Admin Authority System</p>

            <form onSubmit={handleAdminEditSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Uploader Name</label>
                <input type="text" value={editUploadedBy} onChange={(e) => setEditUploadedBy(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-500" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Category</label>
                <CustomSelect value={editCategory} onChange={setEditCategory} options={CATEGORIES.filter(c => c !== 'All').map(cat => ({ value: cat, label: cat }))} theme="dark" />
              </div>
              <button type="submit" disabled={isSaving} className="w-full bg-red-600 text-white py-3 mt-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 flex items-center justify-center gap-2">
                {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Apply Changes</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}