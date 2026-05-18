"use client";

import React, { useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { LogOut, Info } from 'lucide-react';
import Image from 'next/image';

export default function BannedPage() {

  const handleLogout = () => {
    signOut(auth);
    if (auth.currentUser) {
      localStorage.removeItem(`mandal_pass_auth_${auth.currentUser.uid}`);
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined' && document.fonts) {
        document.fonts.load('600 16px "Inter"');
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F9FAFB] px-4 sm:px-6 select-none animate-in fade-in duration-500">
      
      {/* Background subtle elements */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-[#5A0000]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-200/50 via-transparent to-transparent pointer-events-none" />

      {/* Clean Professional Card */}
      <div className="relative bg-white border border-gray-200/60 rounded-3xl max-w-[28rem] w-full text-center shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] overflow-hidden">
        
        <div className="p-8 sm:p-10 flex flex-col items-center">
            
            {/* 🔥 Official Mandal Logo */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-6 drop-shadow-md">
                <Image 
                src="/logo.png" 
                    alt="Siyaram Mitra Mandal Logo" 
                    fill
                    className="object-contain"
                    priority
                />
            </div>
            
            {/* Header */}
            <h1 className="text-2xl sm:text-[26px] font-bold text-gray-900 mb-2 tracking-tight">
                Account Suspended
            </h1>
            
            {/* Subtext */}
            <span className="block text-xs font-semibold uppercase tracking-widest text-red-600 mb-6 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                Access Revoked
            </span>
            
            {/* Divider */}
            <div className="w-12 h-0.5 bg-gray-200 rounded-full mx-auto mb-6" />

            {/* Message Body */}
            <p className="text-gray-600 text-sm sm:text-[15px] leading-relaxed mb-6 font-medium text-center">
               Your access to the <strong className="text-gray-900">Siyaram Mitra Mandal</strong> portal has been restricted due to a policy violation or unauthorized activity.
            </p>

            {/* Info Box */}
            <div className="bg-gray-50 rounded-xl p-4 mb-8 w-full border border-gray-100 flex items-start gap-3 text-left">
                <Info className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium leading-relaxed">
                   If you believe this suspension is an error, please reach out to the managing committee directly for clarification.
                </p>
            </div>

            {/* Clean CTA Button matched with Brand Color */}
            <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-[#5A0000] hover:bg-[#7a0000] text-white font-semibold text-sm py-3.5 sm:py-4 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
            >
                <LogOut className="w-4 h-4" /> Sign out safely
            </button>
        </div>
      </div>
      
       {/* Footer Branding */}
      <p className="absolute bottom-8 text-gray-400 text-[10px] font-semibold uppercase tracking-widest">
         Siyaram Mitra Mandal Security System
      </p>

    </div>
  );
}