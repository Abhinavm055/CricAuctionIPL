import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Lobby from "./pages/Lobby";
import Auction from "./pages/Auction";
import NotFound from "./pages/NotFound";
import { AdminProvider } from "./contexts/AdminContext";
import { GameDataProvider } from "./contexts/GameDataContext";
import Multiplayer from "./pages/Multiplayer";
import Retention from "./pages/Retention";
import RetentionReview from "./pages/RetentionReview";
import AdminPage from "./pages/AdminPage";
import Leaderboard from "./pages/Leaderboard";
import Feedback from "./pages/Feedback";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AdminProvider>
      <GameDataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/multiplayer" element={<Multiplayer />} />
              <Route path="/lobby/:gameCode" element={<Lobby />} />
              <Route path="/retention/:gameCode" element={<Retention />} />
              <Route path="/retention-review/:gameCode" element={<RetentionReview />} />
              <Route path="/auction/:gameCode" element={<Auction />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>

            
          </BrowserRouter>
        </TooltipProvider>
      </GameDataProvider>
    </AdminProvider>
  </QueryClientProvider>
);

export default App;
