import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainPanel } from "@/components/layout/MainPanel";
import { ScreenSettingsPanel } from "@/components/layout/ScreenSettingsPanel";
import { Game, GameProfile } from "@/lib/api";
import "./index.css";

type ActivePanel = "game" | "global" | "screen" | "profile";

function App() {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<GameProfile | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>("global");
  const [profilesVersion, setProfilesVersion] = useState(0);

  // Callback to trigger sidebar profile reload after save
  const onProfileSaved = useCallback(() => {
    setProfilesVersion((v) => v + 1);
  }, []);

  const handleSelectGame = (game: Game | null) => {
    setSelectedGame(game);
    setSelectedProfile(null);
    setActivePanel(game ? "game" : "global");
  };

  const handleSelectProfile = (profile: GameProfile | null) => {
    setSelectedProfile(profile);
    setSelectedGame(null);
    setActivePanel(profile ? "profile" : "global");
  };

  const handleSelectScreen = () => {
    setSelectedGame(null);
    setSelectedProfile(null);
    setActivePanel("screen");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <Sidebar
        selectedGame={selectedGame}
        selectedProfile={selectedProfile}
        onSelectGame={handleSelectGame}
        onSelectProfile={handleSelectProfile}
        activePanel={activePanel}
        onSelectScreen={handleSelectScreen}
        profilesVersion={profilesVersion}
      />

      {/* Main Content */}
      {activePanel === "screen" ? (
        <ScreenSettingsPanel />
      ) : activePanel === "profile" && selectedProfile ? (
        <MainPanel 
          selectedGame={null} 
          selectedProfile={selectedProfile}
          onProfileSaved={onProfileSaved} 
        />
      ) : (
        <MainPanel selectedGame={selectedGame} onProfileSaved={onProfileSaved} />
      )}
    </div>
  );
}

export default App;
