"use client";

import React, { useState } from 'react';
import { Home, Library, Upload, User, Coins, Loader2 } from "lucide-react";

interface SpotlightNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole?: string;
}

export const SpotlightNav = ({ activeTab, setActiveTab, userRole }: SpotlightNavProps) => {
  const [loadingTab, setLoadingTab] = useState<string | null>(null);

  const navItems = [
    { id: "dashboard", label: "Home", icon: <Home size={22} />, hideForViewer: true },
    { id: "gallery", label: "Vault", icon: <Library size={22} /> },
    { id: "upload", label: "Upload", icon: <Upload size={22} /> },
    { id: "contribute", label: "Donate", icon: <Coins size={22} /> },
    { id: "profile", label: "Profile", icon: <User size={22} /> },
  ];

  const visibleNavItems = navItems.filter(item => !(userRole === 'Viewer' && item.hideForViewer));

  const handleTabClick = (id: string) => {
    if (activeTab !== id) {
      setLoadingTab(id);

      setTimeout(() => {
        setActiveTab(id);
        setLoadingTab(null);
      }, 300);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-[#1a0505]/95 backdrop-blur-xl border-t border-white/10 px-2 py-3 pb-safe h-[60px]">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {visibleNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id)}
            className={`flex flex-col items-center gap-1.5 transition-colors outline-none w-16 ${
              activeTab === item.id
                ? "text-yellow-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <div className="relative">
              {loadingTab === item.id ? (
                <Loader2 className="animate-spin text-yellow-400" size={22} />
              ) : (
                item.icon
              )}

              {item.id === "profile" && !loadingTab && activeTab !== "profile" && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-[1.5px] border-[#1a0505]"></span>
              )}
            </div>
            <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
