import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainPanel } from "@/components/layout/MainPanel";
import { Game } from "@/lib/api";
import "./index.css";

function App() {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [profilesVersion, setProfilesVersion] = useState(0);

  // Callback to trigger sidebar profile reload after save
  const onProfileSaved = useCallback(() => {
    setProfilesVersion((v) => v + 1);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <Sidebar
        selectedGame={selectedGame}
        onSelectGame={setSelectedGame}
        profilesVersion={profilesVersion}
      />

      {/* Main Content */}
      <MainPanel selectedGame={selectedGame} onProfileSaved={onProfileSaved} />
    </div>
  );
}

export default App;
