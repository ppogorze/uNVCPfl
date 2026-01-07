import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainPanel } from "@/components/layout/MainPanel";
import { ProfileManagerPanel } from "@/components/layout/ProfileManagerPanel";
import { ScreenSettingsPanel } from "@/components/layout/ScreenSettingsPanel";
import { Game } from "@/lib/api";
import "./index.css";

type ActivePanel = "game" | "global" | "screen" | "profiles";

function App() {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>("global");
  const [profilesVersion, setProfilesVersion] = useState(0);

  // Callback to trigger sidebar profile reload after save
  const onProfileSaved = useCallback(() => {
    setProfilesVersion((v) => v + 1);
  }, []);

  const handleSelectGame = (game: Game | null) => {
    setSelectedGame(game);
    setActivePanel(game ? "game" : "global");
  };

  const handleSelectScreen = () => {
    setSelectedGame(null);
    setActivePanel("screen");
  };

  const handleSelectProfiles = () => {
    setSelectedGame(null);
    setActivePanel("profiles");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <Sidebar
        selectedGame={selectedGame}
        onSelectGame={handleSelectGame}
        activePanel={activePanel}
        onSelectScreen={handleSelectScreen}
        onSelectProfiles={handleSelectProfiles}
        profilesVersion={profilesVersion}
      />

      {/* Main Content */}
      {activePanel === "profiles" ? (
        <ProfileManagerPanel />
      ) : activePanel === "screen" ? (
        <ScreenSettingsPanel />
      ) : (
        <MainPanel selectedGame={selectedGame} onProfileSaved={onProfileSaved} />
      )}
    </div>
  );
}

export default App;
