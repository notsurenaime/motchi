import { Routes, Route } from "react-router-dom";
import { useState } from "react";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import Detail from "./pages/Detail";
import Watch from "./pages/Watch";
import Downloads from "./pages/Downloads";
import Watchlist from "./pages/Watchlist";
import Profiles from "./pages/Profiles";

export default function App() {
  const [profileId, setProfileId] = useState<number>(() => {
    const saved = localStorage.getItem("motchi-profile");
    return saved ? parseInt(saved) : 0;
  });

  const selectProfile = (id: number) => {
    setProfileId(id);
    localStorage.setItem("motchi-profile", String(id));
  };

  if (!profileId) {
    return <Profiles onSelect={selectProfile} />;
  }

  return (
    <Layout onSwitchProfile={() => selectProfile(0)}>
      <Routes>
        <Route path="/" element={<Home profileId={profileId} />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/anime/:id" element={<Detail profileId={profileId} />} />
        <Route
          path="/watch/:id/:episode"
          element={<Watch profileId={profileId} />}
        />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="/watchlist" element={<Watchlist profileId={profileId} />} />
      </Routes>
    </Layout>
  );
}
