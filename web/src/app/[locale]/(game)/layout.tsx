import { GameProvider } from "@/components/GameProvider";
import { PlayerHeader } from "@/components/PlayerHeader";
import { BottomNav } from "@/components/BottomNav";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <GameProvider>
      <PlayerHeader />
      <main className="px-4 pb-24 pt-4">{children}</main>
      <BottomNav />
    </GameProvider>
  );
}
