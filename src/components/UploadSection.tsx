"use client";

import React, { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { db } from '@/lib/firebase';
import { getTimestampMillis } from '@/lib/utils';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { Upload, Sparkles, Image as ImageIcon, Video, Lock, Globe, Trash2, CheckCircle2, Loader2, FolderPlus, Layers } from 'lucide-react';

const CATEGORIES = ["Aarti", "Visarjan", "Decoration", "Mandal Setup", "Bappa Darshan", "Events", "Memories", "Celebration Moments"];

export default function UploadSection({ userData }: { userData: any }) {
  const [activeCategory, setActiveCategory] = useState<string>("Events");
  const [isPrivate, setIsPrivate] = useState<boolean>(userData?.isAccountPrivate || false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [myMedia, setMyMedia] = useState<any[]>([]);
  const [isCloudinaryReady, setIsCloudinaryReady] = useState<boolean>(false);

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
              thumbnail: result.info.thumbnail_url || result.info.secure_url,
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

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24 animate-in fade-in duration-300">
      <Script
        src="https://upload-widget.cloudinary.com/global/all.js"
        strategy="afterInteractive"
        onLoad={() => setIsCloudinaryReady(true)}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#5A0000] to-[#800000] rounded-3xl p-6 text-white shadow-xl mb-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
          <Upload size={200} />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-xs font-bold uppercase tracking-widest mb-3">
            <Sparkles size={14} /> Official Mandal Vault Uploader
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Rozha One', serif" }}>
            गैलरी में अपनी फोटो/वीडियो अपलोड करें
          </h1>
          <p className="text-red-100 text-xs sm:text-sm mt-1 max-w-xl">
            Aarti, visarjan, aur mandal ke pavitra karyakramon ki yaadein safe tarike se vault me upload karein.
          </p>
        </div>
      </div>

      {/* Upload Settings & Action Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-sm mb-8">
        <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Layers size={16} className="text-[#5A0000]" /> Select Category & Privacy
        </h2>

        {/* Category Selector */}
        <div className="mb-6">
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-2">
            Target Category
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeCategory === cat
                    ? "bg-[#5A0000] text-white shadow-md scale-105"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy Toggle */}
        <div className="mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPrivate ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
              {isPrivate ? <Lock size={20} /> : <Globe size={20} />}
            </div>
            <div>
              <p className="text-xs font-black text-gray-800 uppercase tracking-wider">
                {isPrivate ? "Private Vault Record" : "Public Gallery View"}
              </p>
              <p className="text-[11px] text-gray-500">
                {isPrivate ? "Only you can see this upload in your private vault" : "All members can view this photo/video"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPrivate(!isPrivate)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              isPrivate ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isPrivate ? "Private Mode" : "Public Mode"}
          </button>
        </div>

        {/* Big Upload Area */}
        <div
          onClick={openUploadWidget}
          className="border-2 border-dashed border-red-200 hover:border-[#5A0000] bg-red-50/40 hover:bg-red-50/80 rounded-3xl p-8 text-center cursor-pointer transition-all duration-300 group flex flex-col items-center justify-center gap-4"
        >
          <div className="w-16 h-16 rounded-full bg-[#5A0000] text-yellow-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            {isUploading ? <Loader2 className="animate-spin" size={32} /> : <Upload size={32} />}
          </div>
          <div>
            <h3 className="text-base font-black text-gray-800 uppercase tracking-wider group-hover:text-[#5A0000] transition-colors">
              Click to Select Photos or Videos
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Supports HD Images, MP4 Videos & Camera capture (Max 20 files at once)
            </p>
          </div>
          <button
            type="button"
            className="mt-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#5A0000] to-[#800000] text-white text-xs font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all"
          >
            Choose Files
          </button>
        </div>

        {uploadSuccess && (
          <div className="mt-4 p-3 rounded-2xl bg-green-50 text-green-800 text-xs font-bold flex items-center gap-2 border border-green-200 animate-in fade-in">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            {uploadSuccess}
          </div>
        )}
      </div>

      {/* User's Recent Uploads */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
            <FolderPlus size={16} className="text-[#5A0000]" /> Your Uploaded Media ({myMedia.length})
          </h2>
        </div>

        {myMedia.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <ImageIcon size={36} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">No Uploads Found Yet</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Use the upload button above to add your first photo or video.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {myMedia.map((item) => (
              <div key={item.id} className="group relative bg-gray-100 rounded-2xl overflow-hidden shadow-sm aspect-square border border-gray-200">
                {item.type?.startsWith('video') ? (
                  <video src={item.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={item.url} alt="Upload" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleDeleteMedia(item.id)}
                      className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-md"
                      title="Delete Upload"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase bg-yellow-500 text-black px-1.5 py-0.5 rounded-md inline-block mb-1">
                      {item.category || 'Events'}
                    </span>
                    <p className="text-[9px] text-gray-300 font-bold">
                      {new Date(getTimestampMillis(item)).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}