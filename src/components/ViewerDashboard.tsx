"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import SphereImageGrid, { ImageData } from '@/components/ui/img-sphere';

export default function ViewerDashboard({ userData }: { userData?: any }) {
  const [sphereImages, setSphereImages] = useState<ImageData[]>([]);
  const [sphereSize, setSphereSize] = useState(300);
  const [uniqueCount, setUniqueCount] = useState(0);

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
    // 🔥 FIX: Firebase requires `isPrivate == false` for Viewer access according to your Security Rules.
    const q = query(
      collection(db, 'mandal_gallery'), 
      where('isPrivate', '==', false),
      orderBy('createdAt', 'desc'),
      limit(10000)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetchedImgs: ImageData[] = [];
      const seenIds = new Set<string>();

      console.log(`📦 Database me total ${snap.docs.length} items mile.`);

      snap.docs.forEach(doc => {
        const data = doc.data();
        
        // Error protection & Videos ignore
        if (!data) {
          console.log(`❌ Rejecting [${doc.id}]: document data missing hai.`);
          return;
        }
        if (!data.url) {
          console.log(`❌ Rejecting [${doc.id}]: URL missing hai.`);
          return;
        }
        if (data.isPrivate === true) {
          console.log(`🔒 Rejecting [${doc.id}]: isPrivate true hai.`);
          return;
        }
        if (data.type?.startsWith('video')) {
          console.log(`🎥 Rejecting [${doc.id}]: item video hai.`);
          return; 
        }

        // Duplicate ID filter
        if (seenIds.has(doc.id)) {
          console.log(`♻️ Rejecting [${doc.id}]: duplicate ID mila.`);
          return;
        }
        seenIds.add(doc.id);

        fetchedImgs.push({
          id: doc.id,
          src: data.url.replace('/upload/', '/upload/q_auto:eco,w_300/'),
          hdSrc: data.url.replace('/upload/', '/upload/q_auto:good,w_1080/'),
          alt: data.caption || 'Mandal Memory',
          title: data.uploadedBy?.split(' ')[0] || 'Member',
          description: data.category || 'Vault Memory'
        });
      });

      console.log(`✅ Valid Public Photos mili: ${fetchedImgs.length}`);

      if (fetchedImgs.length === 0) {
        setSphereImages([]);
        return;
      }

// Sphere ko poora bharne ke liye kam se kam 30 items chahiye
      const MIN_SPHERE_NODES = 30;
      let finalImages: ImageData[] = [];
      const targetCount = Math.max(MIN_SPHERE_NODES, fetchedImgs.length);

      let sourceArray = [...fetchedImgs];
      
      // Keep adding shuffled chunks of the original array until we reach the target count
      while (finalImages.length < targetCount) {
         // Shuffle the small array every time we add a chunk
         const shuffledChunk = [...sourceArray].sort(() => 0.5 - Math.random());
         
         for (const img of shuffledChunk) {
             if (finalImages.length >= targetCount) break;
             finalImages.push({
                 ...img,
                 id: `${img.id}_copy_${finalImages.length}`
             });
         }
      }

      setSphereImages(finalImages);
    }, (error) => {
      console.error("🔥 SPHERE FETCH ERROR:", error.message);
    });

    return () => unsub();
  }, []);

  return (
    <div className="w-full h-[calc(100vh-140px)] flex flex-col items-center justify-center relative animate-in fade-in duration-1000 overflow-hidden">
      
      {/* 3D SPHERE */}
      {sphereImages.length > 0 ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto sm:mt-0 -mt-24">
          <SphereImageGrid
            images={sphereImages}
            containerSize={sphereSize}
            sphereRadius={sphereSize * 0.45}
            baseImageScale={0.18}
            hoverScale={1.3}
            autoRotate={true}
            autoRotateSpeed={0.3}
            className="opacity-80"
          />
        </div>
      ) : (
        <div className="animate-pulse text-yellow-500/50 font-bold uppercase tracking-widest text-xs">
          Loading Vault...
        </div>
      )}
      
      {/* Premium Home Title */}
      <div className="absolute bottom-6 sm:bottom-10 z-0 text-center pointer-events-none drop-shadow-lg">
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
