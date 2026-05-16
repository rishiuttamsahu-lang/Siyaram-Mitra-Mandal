"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import SphereImageGrid, { ImageData } from '@/components/ui/img-sphere';

export default function ViewerDashboard({ userData }: { userData?: any }) {
  const [sphereImages, setSphereImages] = useState<ImageData[]>([]);
  const [sphereSize, setSphereSize] = useState(300);

  // Responsive Sphere Size for Mobile & Desktop
  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      // Mobile pe edges se margin rakhna, aur Desktop pe max 500px dena
      setSphereSize(Math.min(width - 20, 500)); 
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Fetch Public Photos for the Sphere
  useEffect(() => {
    const q = query(
      collection(db, 'mandal_gallery'), 
      where('isPrivate', '==', false), 
      orderBy('createdAt', 'desc'),
      limit(30) // Thodi limit badha di taaki zyada variety photos aayen
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetchedImgs: ImageData[] = [];
      snap.docs.forEach(doc => {
        const data = doc.data();
        
        // 🔥 Video ko sphere se completely bahar nikal diya
        if (data.type?.startsWith('video')) return; 

        fetchedImgs.push({
          id: doc.id,
          // 🔥 Photo quality HD kar di (eco,w_400 ki jagah good,w_800)
          src: data.url.replace('/upload/', '/upload/q_auto:good,w_800/'),
          alt: data.caption || 'Mandal Memory',
          title: data.uploadedBy?.split(' ')[0],
          description: data.category
        });
      });

      // Sphere bhara hua dikhane ke liye duplicate logic
      const finalImages: ImageData[] = [];
      if (fetchedImgs.length > 0) {
        for (let i = 0; i < 40; i++) {
          const baseImg = fetchedImgs[i % fetchedImgs.length];
          finalImages.push({ ...baseImg, id: `${baseImg.id}-${i}` });
        }
        setSphereImages(finalImages);
      }
    });

    return () => unsub();
  }, []);

  return (
    <div className="w-full h-[calc(100vh-140px)] flex flex-col items-center justify-center relative animate-in fade-in duration-1000 overflow-hidden">
      
      {/* 3D SPHERE */}
      {sphereImages.length > 0 ? (
        <div className="absolute inset-0 flex items-center justify-center opacity-80 pointer-events-auto z-10 sm:mt-0 mt-4">
          <SphereImageGrid
            images={sphereImages}
            containerSize={sphereSize}
            sphereRadius={sphereSize * 0.45}
            baseImageScale={0.18}
            hoverScale={1.3}
            autoRotate={true}
            autoRotateSpeed={0.3}
          />
        </div>
      ) : (
        <div className="animate-pulse text-yellow-500/50 font-bold uppercase tracking-widest text-xs">
          Loading Vault...
        </div>
      )}
      
      {/* Premium Home Title */}
      <div className="absolute bottom-6 sm:bottom-10 z-20 text-center pointer-events-none drop-shadow-lg">
        {/* 🔥 TUMHARA CUSTOM LAB() GRADIENT APPLY KAR DIYA HAI YAHAN */}
        <h2 
          className="text-3xl font-black text-transparent bg-gradient-to-r from-[lab(56_94.47_98.89)] via-[#555555] to-[lab(2_11.19_3.81)] bg-clip-text drop-shadow-[0_0_10px_rgba(202,138,4,0.3)]" 
          style={{ fontFamily: "'Rozha One', serif" }}
        >
          सियाराम मित्र मंडल
        </h2>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-2">
          Interactive Vault
        </p>
      </div>
    </div>
  );
}
