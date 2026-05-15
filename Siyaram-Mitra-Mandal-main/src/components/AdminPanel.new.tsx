"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Shield, ShieldAlert, Ban, RefreshCcw, Key, Mail } from 'lucide-react';

export default function AdminPanel({ currentUserData }: { currentUserData: any }) {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const fetchedUsers = snap.docs.map(doc => doc.data());
      fetchedUsers.sort((a, b) => {
        const roleOrder: any = { 'Admin': 1, 'Member': 2, 'Viewer': 3, 'Banned': 4 };
        return (roleOrder[a.role] || 5) - (roleOrder[b.role] || 5);
      });
      setUsers(fetchedUsers);
    });
    return () => unsub();
  }, []);

  const handleRoleChange = async (uid: string, newRole: string) => {
    if (currentUserData.uid === uid && newRole !== 'Admin') {
      if (!confirm("⚠️ WARNING: Aap apni Admin power hata rahe hain! Kya aap sure hain?")) return;
    }

    const isBanned = newRole === 'Banned';
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole, isBanned: isBanned });
    } catch (error) {
      alert("Update fail ho gaya.");
    }
  };

  if (currentUserData?.role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-500">
        <ShieldAlert className="w-16 h-16 mb-4 opacity-50" />
        <h2 className="text-2xl font-black">Access Denied</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20 px-2 sm:px-0">
      
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-2xl sm:text-3xl font-black text-gray-900" style={{ fontFamily: "'Gotu', sans-serif" }}>Mandal Control</h2>
        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400 mt-1 flex items-center gap-2">
          <Key className="w-3 h-3 text-[#5A0000]" /> Access & Role Management
        </p>
      </div>

      {/* USER CARDS */}
      <div className="grid grid-cols-1 gap-4">
        {users.map((user) => (
          <div key={user.uid} className={`bg-white rounded-2xl border ${user.isBanned ? 'border-red-100 bg-red-50/20' : 'border-gray-100 shadow-sm'} p-4 transition-all`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              
              {/* Left: Identity */}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-black text-white shadow-inner shrink-0 ${
                  user.role === 'Admin' ? 'bg-yellow-500' : user.isBanned ? 'bg-red-500' : 'bg-[#5A0000]'
                }`}>
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate flex items-center gap-2">
                    {user.name} 
                    {user.uid === currentUserData.uid && <span className="text-[8px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">YOU</span>}
                  </p>
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-400 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {user.email}
                  </p>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-3 sm:pt-0">
                
                {/* Role Badge - Mobile Friendly */}
                <div className="sm:hidden">
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border ${
                    user.role === 'Admin' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                    user.role === 'Member' ? 'bg-green-50 text-green-700 border-green-100' :
                    user.isBanned ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                  }`}>
                    {user.role}
                  </span>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <select 
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                    className="bg-gray-100 border-none text-[11px] sm:text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#5A0000]/20"
                  >
                    <option value="Viewer">Viewer</option>
                    <option value="Member">Member</option>
                    <option value="Admin">Admin</option>
                    <option value="Banned">Ban User</option>
                  </select>

                  {user.isBanned && (
                    <button 
                      onClick={() => handleRoleChange(user.uid, 'Viewer')}
                      className="p-2 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors"
                      title="Unban"
                    >
                      <RefreshCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && <div className="text-center py-10 text-gray-400 font-bold">Fetching members...</div>}
    </div>
  );
}
