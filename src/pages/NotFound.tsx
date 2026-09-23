import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, Radio } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#020817] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-yellow-500/20 selection:text-yellow-300">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full text-center relative z-10 space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto text-[#F5B82E] shadow-xl shadow-yellow-500/10">
          <AlertTriangle className="w-10 h-10 text-[#F5B82E]" />
        </div>

        <div>
          <span className="text-xs uppercase tracking-widest font-semibold text-[#F5B82E]">
            Sector Signal Lost
          </span>
          <h1 className="text-6xl font-display uppercase tracking-widest text-white mt-1">
            404
          </h1>
          <h2 className="text-lg font-bold uppercase tracking-wider text-slate-200 mt-2">
            Auction Floor Unreachable
          </h2>
          <p className="text-sm text-slate-400 mt-3 leading-relaxed">
            The auction chamber or corridor you are attempting to access has either concluded, expired, or does not exist on the server network.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button asChild variant="gold" className="w-full sm:w-auto font-bold uppercase tracking-wider text-xs">
            <Link to="/" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Return to Arena
            </Link>
          </Button>

          <Button asChild variant="outline" className="w-full sm:w-auto border-white/[0.12] hover:border-yellow-500/40 text-slate-300 text-xs font-semibold">
            <Link to="/multiplayer" className="flex items-center gap-2">
              <Radio className="w-4 h-4" />
              Multiplayer Rooms
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

