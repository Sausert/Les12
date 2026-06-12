import { GameProvider } from "@/components/GameProvider";
import { GameShell } from "@/components/GameShell";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <GameProvider>
      <GameShell>{children}</GameShell>
    </GameProvider>
  );
}
