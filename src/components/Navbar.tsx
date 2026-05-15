"use client";

import React from 'react';
import { auth } from '@/lib/firebase';
import { LayoutDashboard, Image as ImageIcon, UserCog, LogOut, Sparkles } from 'lucide-react';

export default function Navbar({ userData, activeTab, setActiveTab }: { userData: any, activeTab: string, setActiveTab: (tab: string) => void }) {
  const tabs = [
    { id: 'gallery', label: 'Vault', icon: ImageIcon, show: true },
    { id: 'dashboard', label: 'Finance', icon: LayoutDashboard, show: userData?.role !== 'Viewer' },
    { id: 'admin', label: 'Admin', icon: UserCog, show: userData?.role === 'Admin' },
  ];

  return (
    <nav className="bg-white/80 backdrop-blur-lg border-b border-gray-100 sticky top-0 z-40 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16 md:h-20">
        
        {/* Logo & Brand */}
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('gallery')}>
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-[#5A0000] shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:shadow-md">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover bg-white" />
          </div>
          <div className="hidden md:block">
            <span className="font-bold text-[#5A0000] text-xl tracking-wide transition-colors duration-300 group-hover:text-red-800" style={{ fontFamily: "'Rozha One', serif" }}>
              सियाराम मित्रमंडळ
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 md:gap-4 bg-gray-50/50 p-1 md:p-1.5 rounded-2xl border border-gray-100">
          {tabs.map((tab) => tab.show && (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                activeTab === tab.id 
                  ? 'bg-gradient-to-br from-[#5A0000] to-[#7B0000] text-white shadow-md transform scale-100' 
                  : 'text-gray-500 hover:bg-red-50 hover:text-[#5A0000] scale-95 hover:scale-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Profile & Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-xs font-black text-gray-800 tracking-wide">
              {userData?.name}
            </span>
            <span className="text-[10px] font-bold text-[#5A0000] uppercase tracking-widest flex items-center gap-1">
              {userData?.role === 'Admin' && <Sparkles className="w-3 h-3 text-yellow-500" />}
              {userData?.role}
            </span>
          </div>
          
          <div className="h-8 w-[1px] bg-gray-200 mx-1 hidden md:block"></div>
          
          <button 
            onClick={() => auth.signOut()} 
            className="p-2.5 text-gray-400 hover:text-white transition-all duration-300 bg-gray-50 hover:bg-red-600 hover:shadow-md rounded-full border border-gray-100"
            title="Logout"
          >
            <LogOut className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

      </div>
    </nav>
  );
}
