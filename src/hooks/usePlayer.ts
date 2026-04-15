'use client';

import { useState, useEffect, useCallback } from 'react';

const PLAYER_KEY = 'fantasy-gbbo-player-id';

export function usePlayer() {
  const [playerId, setPlayerIdState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(PLAYER_KEY);
    setPlayerIdState(stored);
    setLoaded(true);
  }, []);

  const setPlayerId = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem(PLAYER_KEY, id);
    } else {
      localStorage.removeItem(PLAYER_KEY);
    }
    setPlayerIdState(id);
  }, []);

  return { playerId, setPlayerId, loaded };
}

const ADMIN_KEY = 'fantasy-gbbo-admin';

export function useAdmin() {
  const [isAdmin, setIsAdminState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_KEY);
    setIsAdminState(stored === 'true');
    setLoaded(true);
  }, []);

  const login = useCallback((pin: string): boolean => {
    if (pin === process.env.NEXT_PUBLIC_ADMIN_PIN) {
      localStorage.setItem(ADMIN_KEY, 'true');
      setIsAdminState(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ADMIN_KEY);
    setIsAdminState(false);
  }, []);

  return { isAdmin, login, logout, loaded };
}
