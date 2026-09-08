import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Matches from "./pages/Matches";
import MatchDetails from "./pages/MatchDetails";
import Series from "./pages/Series";
import SeriesDetails from "./pages/SeriesDetails";
import Teams from "./pages/Teams";
import TeamDetails from "./pages/TeamDetails";
import Players from "./pages/Players";
import PlayerDetails from "./pages/PlayerDetails";
import Rankings from "./pages/Rankings";
import Stats from "./pages/Stats";
import News from "./pages/News";
import NewsDetails from "./pages/NewsDetails";
import Search from "./pages/Search";
import MainLayout from "./layouts/MainLayout";
import WebSocketTest from "./components/WebSocketTest";

function App() {
  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />

        <Route path="/matches" element={<Matches />} />
        <Route path="/matches/:matchId" element={<MatchDetails />} />

        <Route path="/series" element={<Series />} />
        <Route path="/series/:seriesId" element={<SeriesDetails />} />

        <Route path="/teams" element={<Teams />} />
        <Route path="/teams/:teamId" element={<TeamDetails />} />

        <Route path="/players" element={<Players />} />
        <Route path="/players/:playerId" element={<PlayerDetails />} />

        <Route path="/rankings" element={<Rankings />} />

        <Route path="/stats" element={<Stats />} />

        <Route path="/news" element={<News />} />
        <Route path="/news/:newsId" element={<NewsDetails />} />

        <Route path="/search" element={<Search />} />
        </Route>
      </Routes>
    </BrowserRouter>
    <WebSocketTest/>
    </>
  );
}

export default App;