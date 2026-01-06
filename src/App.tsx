import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainPanel } from "@/components/layout/MainPanel";
import { Game } from "@/lib/api";
import "./index.css";

function App() {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <Sidebar
        selectedGame={selectedGame}
        onSelectGame={setSelectedGame}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Main Content */}
      <MainPanel selectedGame={selectedGame} />
    </div>
  );
}

export default App;
