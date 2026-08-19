"use client";

import React, { useState, useEffect } from 'react';
import Script from 'next/script';
import { db } from '@/lib/firebase';
import { getTimestampMillis } from '@/lib/utils';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { Upload, Sparkles, Image as ImageIcon, Globe, Lock, Trash2, CheckCircle2, Loader2, FolderPlus, Play } from 'lucide-react';

const CATEGORIES = ["Aarti", "Visarjan", "Decoration", "Mandal Setup", "Bappa Darshan", "Events", "Memories", "Moments"];

export default function UploadSection({ userData }: { userData: any }) {
  const [activeCategory, setActiveCategory] = useState<string>("Events");
  const [isPrivate, setIsPrivate] = useState<boolean>(userData?.isAccountPrivate || false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [myMedia, setMyMedia] = useState<any[]>([]);
  const [, setIsCloudinaryReady] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).cloudinary) {
      setIsCloudinaryReady(true);
    }
  }, []);

  // Real-time listener for current user's uploads
  useEffect(() => {
    if (!userData?.email) return;
    const q = query(collection(db, 'mandal_gallery'), where('uploaderEmail', '==', userData.email));
    const unsub = onSnapshot(q, (snap) => {
      const mediaList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      mediaList.sort((a: any, b: any) => getTimestampMillis(b) - getTimestampMillis(a));
      setMyMedia(mediaList);
    });
    return () => unsub();
  }, [userData?.email]);

  const openUploadWidget = () => {
    if (typeof window === 'undefined' || !(window as any).cloudinary) {
      alert("Upload widget loading, please try again in a moment.");
      return;
    }

    const widget = (window as any).cloudinary.createUploadWidget(
      {
        cloudName: 'dldkk7bql',
        uploadPreset: 'siyaram_prese',
        sources: ['local', 'camera', 'url'],
        resourceType: 'auto',
        maxFiles: 20,
        styles: {
          palette: {
            window: "#1a0505",
            windowBorder: "#5A0000",
            tabIcon: "#EAB308",
            menuBg: "#1a0505",
            textDark: "#000000",
            textLight: "#FFFFFF",
            link: "#EAB308",
            action: "#5A0000",
            inactiveTabIcon: "#9CA3AF",
            error: "#EF4444",
            inProgress: "#3B82F6",
            complete: "#22C55E",
            sourceBg: "#2A0808"
          }
        }
      },
      async (error: any, result: any) => {
        if (!error && result && result.event === 'success') {
          setIsUploading(true);
          try {
            await addDoc(collection(db, 'mandal_gallery'), {
              url: result.info.secure_url,
              thumbnail: result.info.thumbnail_url || (result.info.resource_type === 'video' ? result.info.secure_url.replace(/\.[^/.]+$/, ".jpg") : result.info.secure_url),
              type: result.info.resource_type || 'image',
              uploadedBy: userData?.name || 'Mandal Member',
              uploaderEmail: userData?.email || '',
              createdAt: new Date().toISOString(),
              size: result.info.bytes || 0,
              isPrivate: isPrivate,
              category: activeCategory,
              likes: [],
              favorites: [],
              resolution: result.info.width ? `${result.info.width}x${result.info.height}` : 'HD',
            });
            setUploadSuccess(`Upload successful! Listed under "${activeCategory}".`);
            setTimeout(() => setUploadSuccess(null), 4000);
          } catch (err: any) {
            console.error("Upload firestore save error:", err);
          } finally {
            setIsUploading(false);
          }
        }
      }
    );
    widget.open();
  };

  const handleDeleteMedia = async (id: string) => {
    if (!window.confirm("Kya aap sach me is photo/video ko delete karna chahte hain?")) return;
    try {
      await deleteDoc(doc(db, 'mandal_gallery', id));
    } catch (err) {
      alert("Delete failed");
    }
  };

  const getThumbnailUrl = (item: any) => {
    if (item.thumbnail) return item.thumbnail;
    if (item.type === 'video' && item.url) {
      return item.url.replace(/\.[^/.]+$/, ".jpg");
    }
    return item.url;
  };

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 pb-24 animate-in fade-in duration-300 space-y-3.5">
      <Script
        src="https://upload-widget.cloudinary.com/global/all.js"
        strategy="afterInteractive"
        onLoad={() => setIsCloudinaryReady(true)}
      />

      {/* 🌟 Compact Festive Header */}
      <div className="bg-gradient-to-r from-[#5A0000] to-[#800000] rounded-2xl p-4 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-[9px] font-black uppercase tracking-widest mb-1.5">
              <Sparkles className="w-3 h-3" /> Mandal Vault
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight" style={{ fontFamily: '"Rozha One", serif' }}>
              Upload Media
            </h1>
            <p className="text-red-100 text-[10px] sm:text-xs mt-0.5 leading-tight">
              Aarti, visarjan aur utsav ki yaadein vault me save karein.
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-yellow-300" />
          </div>
        </div>
      </div>

      {/* ⚙️ Upload Control Card */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-gray-100 shadow-xs space-y-3">
        {/* Horizontal Scrollable Category Bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Category</label>
            <span className="text-[9px] font-bold text-gray-400">Swipe to select</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar -mx-1 px-1">
            {CATEGORIES.map((cat) => {
              const isSelected = cat === activeCategory;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#5A0000] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact Privacy Strip */}
        <div className="bg-gray-50/80 px-3 py-2 rounded-xl border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isPrivate ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
            </div>
            <span className="text-[11px] font-black text-gray-800 uppercase tracking-wide">
              {isPrivate ? "Private Vault" : "Public Gallery"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsPrivate(!isPrivate)}
            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              isPrivate
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {isPrivate ? "Only Me" : "All Members"}
          </button>
        </div>

        {/* Sleek Tap Dropzone */}
        <div
          onClick={openUploadWidget}
          className="border-2 border-dashed border-red-200 hover:border-[#5A0000] bg-red-50/30 hover:bg-red-50/60 rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 active:scale-98"
        >
          <div className="w-11 h-11 rounded-full bg-[#5A0000] text-yellow-400 flex items-center justify-center shadow-sm">
            {isUploading ? <Loader2 className="animate-spin w-5 h-5" /> : <Upload className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-xs font-black text-gray-900 uppercase tracking-wide">
              Tap to Select Photos / Videos
            </h3>
            <p className="text-[10px] text-gray-400 font-bold mt-0.5">
              Images, MP4 Videos & Camera (Max 20 files)
            </p>
          </div>
        </div>

        {uploadSuccess && (
          <div className="p-2.5 rounded-xl bg-green-50 text-green-800 text-[11px] font-bold flex items-center gap-2 border border-green-200 animate-in fade-in">
            <CheckCircle2 size={14} className="text-green-600 shrink-0" />
            {uploadSuccess}
          </div>
        )}
      </div>

      {/* 🖼️ Uploaded Media Grid */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-gray-100 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h2 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
            <FolderPlus className="w-3.5 h-3.5 text-[#5A0000]" /> Uploaded Media ({myMedia.length})
          </h2>
          <span className="text-[9px] font-bold text-gray-400 uppercase">Recent First</span>
        </div>

        {myMedia.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <ImageIcon size={28} className="mx-auto text-gray-300 mb-1.5" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">No Uploads Found Yet</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Use the upload button above to add photos or videos.</p>
          </div>
        ) : (
          /* 3-Column Touch Optimized Layout */
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {myMedia.map((item: any) => (
              <div
                key={item.id}
                className="group relative bg-gray-100 rounded-xl overflow-hidden shadow-2xs aspect-square border border-gray-200/80 select-none"
              >
                {item.type === 'video' ? (
                  <>
                    <img
                      src={getThumbnailUrl(item)}
                      className="w-full h-full object-cover"
                      alt="video thumbnail"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                      <div className="rounded-full bg-black/50 p-1.5 text-white">
                        <Play className="w-3 h-3 fill-white" />
                      </div>
                    </div>
                  </>
                ) : (
                  <img
                    src={getThumbnailUrl(item)}
                    className="w-full h-full object-cover"
                    alt="upload"
                    loading="lazy"
                  />
                )}

                {/* Persistent Touch Delete Action */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMedia(item.id);
                  }}
                  className="absolute top-1 right-1 p-1 bg-black/60 active:bg-red-600 text-white rounded-md backdrop-blur-xs transition-colors z-10 cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>

                {/* Bottom Info Tag */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-3 flex items-end justify-between pointer-events-none">
                  <span className="text-[8px] font-black uppercase text-yellow-300 truncate max-w-[60px]">
                    {item.category || 'Events'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}