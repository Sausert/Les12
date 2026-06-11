"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface MeState {
  id: string;
  username: string;
  locale: string;
  xp: number;
  cash: number;
  dirtyCash: number;
  heat: number;
  walletAddress: string | null;
  rank: { id: number; key: string };
  rankProgress: number;
  nextRank: { key: string; minXp: number } | null;
  cooldowns: { key: string; expiresAt: string }[];
}

interface GameContextValue {
  me: MeState | null;
  refresh: () => Promise<void>;
}

const GameContext = createContext<GameContextValue>({ me: null, refresh: async () => {} });

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeState | null>(null);

  const refresh = useCallback(
    () =>
      fetch("/api/me").then(async (res) => {
        if (res.ok) setMe(await res.json());
      }),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <GameContext.Provider value={{ me, refresh }}>{children}</GameContext.Provider>;
}

export function useGame() {
  return useContext(GameContext);
}
