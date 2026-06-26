import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Lobby from "./pages/Lobby";
import NotFound from "./pages/NotFound";
import { AdminProvider } from "@/contexts/AdminContext";
import { GameDataProvider } from "@/contexts/GameDataContext";
import Multiplayer from "./pages/Multiplayer";
import RetentionReview from "./pages/RetentionReview";
import AdminPage from "./pages/AdminPage";
import Feedback from "./pages/Feedback";
import Profile from "./pages/Profile";
import { AddToHomeScreenButton } from "./components/AddToHomeScreenButton";
import JoinRoom from "./pages/JoinRoom";

const Auction = lazy(() => import("./pages/Auction"));
const Retention = lazy(() => import("./pages/Retention"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Summary = lazy(() => import("./pages/Summary"));
const Tournament = lazy(() => import("./pages/Tournament"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AdminProvider>
      <GameDataProvider>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AddToHomeScreenButton />
              <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-primary font-display text-2xl animate-pulse">Loading...</div>}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/multiplayer" element={<Multiplayer />} />
                  <Route path="/join/:roomCode" element={<JoinRoom />} />
                  <Route path="/lobby/:gameCode" element={<Lobby />} />
                  <Route path="/retention/:gameCode" element={<Retention />} />
                  <Route path="/retention-review/:gameCode" element={<RetentionReview />} />
                  <Route path="/auction/:gameCode" element={<Auction />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/summary/:gameCode" element={<Summary />} />
                  <Route path="/feedback" element={<Feedback />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/tournament" element={<Tournament />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </GameDataProvider>
    </AdminProvider>
  </QueryClientProvider>
);

export default App;
