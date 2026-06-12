"use client";

import { useGame } from "./GameProvider";
import { PlayerHeader } from "./PlayerHeader";
import { BottomNav } from "./BottomNav";
import { JailBanner } from "./JailBanner";
import { DeathScreen } from "./DeathScreen";

export function GameShell({ children }: { children: React.ReactNode }) {
  const { me } = useGame();

  return (
    <>
      <PlayerHeader />
      <JailBanner />
      <main className="px-4 pb-24 pt-4">{children}</main>
      <BottomNav />
      {me?.isDead && <DeathScreen />}
    </>
  );
}
