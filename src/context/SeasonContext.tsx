"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { ChandaSeason } from '@/lib/types/season';
import { subscribeSeasons } from '@/lib/seasonService';

interface SeasonContextType {
  seasons: ChandaSeason[];
  activeSeason: ChandaSeason | null;
  selectedSeason: ChandaSeason | null;
  selectedSeasonId: string;
  setSelectedSeasonId: (id: string) => void;
  isHistoricalSeason: boolean;
  isEditableSeason: boolean;
  isLoading: boolean;
}

const LOCAL_STORAGE_KEY = 'mandal_selected_season_id';

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

export const SeasonProvider = ({ children }: { children: ReactNode }) => {
  const [seasons, setSeasons] = useState<ChandaSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonIdState] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Real-time subscription to chanda_seasons
  useEffect(() => {
    const unsubscribe = subscribeSeasons((fetchedSeasons) => {
      setSeasons(fetchedSeasons);
      setIsLoading(false);

      if (fetchedSeasons.length > 0) {
        // Retrieve stored selection
        const storedId = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
        const matchingStored = storedId ? fetchedSeasons.find(s => s.id === storedId) : null;

        // Default to active season, or matching stored, or first available season
        const active = fetchedSeasons.find(s => s.status === 'active') || fetchedSeasons[0];

        setSelectedSeasonIdState(prev => {
          if (prev && fetchedSeasons.some(s => s.id === prev)) {
            return prev;
          }
          return matchingStored ? matchingStored.id : (active ? active.id : '');
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const setSelectedSeasonId = (id: string) => {
    setSelectedSeasonIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, id);
    }
  };

  const activeSeason = useMemo(() => {
    return seasons.find(s => s.status === 'active') || null;
  }, [seasons]);

  const selectedSeason = useMemo(() => {
    return seasons.find(s => s.id === selectedSeasonId) || activeSeason || seasons[0] || null;
  }, [seasons, selectedSeasonId, activeSeason]);

  const isHistoricalSeason = useMemo(() => {
    if (!selectedSeason) return false;
    return selectedSeason.status === 'closed' || selectedSeason.status === 'archived';
  }, [selectedSeason]);

  const isEditableSeason = useMemo(() => {
    if (!selectedSeason) return false;
    return selectedSeason.status === 'active' || selectedSeason.status === 'draft';
  }, [selectedSeason]);

  return (
    <SeasonContext.Provider
      value={{
        seasons,
        activeSeason,
        selectedSeason,
        selectedSeasonId: selectedSeason?.id || selectedSeasonId,
        setSelectedSeasonId,
        isHistoricalSeason,
        isEditableSeason,
        isLoading
      }}
    >
      {children}
    </SeasonContext.Provider>
  );
};

export const useSeason = () => {
  const context = useContext(SeasonContext);
  if (!context) {
    throw new Error('useSeason must be used within a SeasonProvider');
  }
  return context;
};
