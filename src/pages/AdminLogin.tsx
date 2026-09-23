import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Shield, AlertCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AdminLogin = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/admin/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay for security
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (login(password)) {
      toast({
        title: 'Access Granted',
        description: 'Welcome to the Command Console',
      });
      navigate('/admin/dashboard');
    } else {
      setError('Invalid passkey. Access denied.');
      setPassword('');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#020817] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-yellow-500/20 selection:text-yellow-300">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      {/* Back button */}
      <div className="absolute top-6 left-6 z-20">
        <Button asChild variant="outline" size="sm" className="border-white/[0.08] hover:border-yellow-500/40 text-slate-300">
          <Link to="/" className="flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Arena
          </Link>
        </Button>
      </div>

      <div className="w-full max-w-md relative z-10 rounded-2xl border border-yellow-500/30 bg-[#09152A] p-6 sm:p-8 shadow-2xl shadow-black/60">
        <div className="text-center pb-6 border-b border-white/[0.08]">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center shadow-lg shadow-yellow-500/10">
            <Shield className="w-8 h-8 text-[#F5B82E]" />
          </div>
          <span className="text-[11px] uppercase tracking-[0.25em] font-semibold text-[#F5B82E]">
            Restricted Clearance
          </span>
          <h1 className="text-2xl sm:text-3xl font-display uppercase tracking-wider text-white mt-1">
            Admin Console
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            CricAuctionIPL Engine & Roster Control
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-6">
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              type="password"
              placeholder="Enter master passkey"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12 bg-slate-950/60 border-white/[0.12] text-white placeholder:text-slate-600 focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E] transition rounded-xl"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="gold"
            className="w-full h-12 font-bold uppercase tracking-wider text-xs"
            disabled={!password || isLoading}
          >
            {isLoading ? 'Authenticating...' : 'Access Command Console'}
          </Button>
        </form>

        <p className="text-center text-[11px] text-slate-500 mt-6 tracking-wide">
          Strictly authorized personnel only. All access attempts are logged.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;

