"use client";

import React, { useEffect, useState } from 'react';
import Script from 'next/script';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { UploadCloud, CheckCircle2, Image as ImageIcon, Video, Loader2 } from 'lucide-react';

export default function UploadSection({ userData }: { userData: any }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isWidgetOpening, setIsWidgetOpening] = useState(false);
  const [isCloudinaryReady, setIsCloudinaryReady] = useState(false);
  const [lastUploads, setLastUploads] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).cloudinary) {
      setIsCloudinaryReady(true);
    }
  }, []);

  const openUploadWidget = () => {
    if (!isCloudinaryReady) return;

    setIsWidgetOpening(true);

    const widget = (window as any).cloudinary.createUploadWidget(
      {
        cloudName: 'dldkk7bql',
        uploadPreset: 'siyaram_prese',
        sources: ['local', 'camera', 'url'],
        resourceType: 'auto',
        multiple: true,
        maxFiles: 20,
        quality: 'original',
        clientAllowedFormats: ['png', 'jpg', 'jpeg', 'mp4', 'mov', 'webp'],
        googleApiKey: '<optional_key>',
        showAdvancedOptions: false,
        cropping: false,
        dropPane: "#upload-drop-zone",
        // 🔥 Minimal Light Theme for Cloudinary Widget
        styles: {
          palette: {
            window: '#FFFFFF',
            windowBorder: '#E5E7EB',
            tabIcon: '#5A0000',
            menuIcons: '#5A0000',
            textDark: '#111827',
            textLight: '#6B7280',
            link: '#5A0000',
            action: '#5A0000', // Dashboard Red
            inactiveTabIcon: '#9CA3AF',
            error: '#EF4444',
            inProgress: '#3B82F6',
            complete: '#10B981',
            sourceBg: '#F9FAFB'
          },
          fonts: {
            default: null,
            "'Inter', sans-serif": {
              url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
              active: true
            }
          }
        },
      },
      async (error: any, result: any) => {
        if (result && result.event === 'close') {
          setIsWidgetOpening(false);
        }

        if (!error && result && result.event === 'success') {
          setIsUploading(true);
          setIsWidgetOpening(false);
          try {
            const getDeviceInfo = () => {
              const ua = navigator.userAgent;
              if (/android/i.test(ua)) return 'Android';
              if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
              if (/Windows/i.test(ua)) return 'Windows';
              if (/Mac/i.test(ua)) return 'Mac';
              return 'Unknown';
            };

            const mediaData = {
              url: result.info.secure_url,
              thumbnail: result.info.thumbnail_url || result.info.secure_url,
              type: result.info.resource_type,
              uploadedBy: userData.name,
              uploaderEmail: userData.email,
              isPrivate: userData.isAccountPrivate || false,
              deviceInfo: getDeviceInfo(),
              createdAt: new Date().toISOString(),
              size: result.info.bytes,
              quality: result.info.width ? `${result.info.width}x${result.info.height}` : 'HD',
              category: "Events",
              likes: [],
              favorites: []
            };

            await addDoc(collection(db, 'mandal_gallery'), mediaData);

            const userRef = doc(db, 'users', userData.uid);
            const userSnap = await getDoc(userRef);
            const existingData = userSnap.exists() ? userSnap.data() : null;
            
            await setDoc(userRef, {
              history: [{
                type: 'upload',
                text: `Uploaded ${result.info.resource_type === 'video' ? 'Video' : 'Photo'}`,
                time: new Date().toISOString(),
              }, ...(existingData?.history || [])].slice(0, 20),
              lastUploadAt: new Date().toISOString(),
            }, { merge: true });

            setLastUploads(prev => [mediaData, ...prev].slice(0, 2)); 
          } catch (err) {
            console.error('Save error:', err);
          }
          setIsUploading(false);
        }
      }
    );

    widget.open();

    setTimeout(() => setIsWidgetOpening(false), 5000);
  };

  const formatSize = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1) + ' MB';

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-20 flex flex-col items-center animate-fade-in bg-gray-50 min-h-screen">
      <Script src="https://upload-widget.cloudinary.com/global/all.js" strategy="afterInteractive" onLoad={() => setIsCloudinaryReady(true)} />

      {/* Clean Minimalist Upload Card */}
      <div id="upload-drop-zone" className="w-full bg-white border border-gray-200 rounded-3xl p-8 sm:p-14 text-center transition-all duration-300 shadow-sm hover:shadow-md group">
        
        {/* Animated Icon */}
        <div className="mx-auto w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mb-8 border border-red-100 transition-transform duration-500 group-hover:scale-110 group-hover:bg-red-100">
           <UploadCloud className="w-8 h-8 text-[#5a0000] transition-colors" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-3">Upload Media</h2>
        <p className="text-sm text-gray-500 mb-10 max-w-sm mx-auto leading-relaxed">
          Select photos or videos to securely store them in the Vault. We preserve original 4K/HD quality.
        </p>

        {/* Action Button */}
        <button
          onClick={openUploadWidget}
          disabled={isUploading || isWidgetOpening || !isCloudinaryReady}
          className={`relative overflow-hidden w-full sm:w-auto mx-auto flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold transition-all duration-300 active:scale-95 ${
            isCloudinaryReady && !isWidgetOpening
              ? 'bg-[#5a0000] text-white hover:bg-[#7b0000] shadow-sm'
              : 'cursor-not-allowed bg-gray-100 text-gray-400'
          }`}
        >
          {isUploading || isWidgetOpening ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
          {isUploading ? 'Uploading...' : isWidgetOpening ? 'Connecting Vault...' : isCloudinaryReady ? 'Select Files' : 'Connecting...'}
        </button>
      </div>

      {/* Minimal Recent Uploads Indicator */}
      {lastUploads.length > 0 && (
        <div className="mt-8 w-full animate-fade-in flex flex-col items-center">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
             <CheckCircle2 className="w-4 h-4 text-green-500" /> Upload Successful
          </p>
          
          <div className="flex flex-wrap justify-center gap-3 w-full max-w-md">
            {lastUploads.map((media, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-2 pr-4 shadow-sm">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                  <img src={media.thumbnail} alt="preview" className="w-full h-full object-cover" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-bold text-gray-800 flex items-center gap-1 uppercase tracking-wider">
                    {media.type === 'video' ? <Video className="w-3 h-3 text-[#5a0000]"/> : <ImageIcon className="w-3 h-3 text-[#5a0000]"/>}
                    {media.quality}
                  </p>
                  <p className="text-[9px] text-gray-500 font-medium mt-0.5">{formatSize(media.size)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}