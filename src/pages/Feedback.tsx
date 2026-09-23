import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send, CheckCircle2, User, Mail, Sparkles, HelpCircle, Bug, ArrowLeft } from 'lucide-react';

const CATEGORIES = [
  { id: 'suggestion', label: 'Feature Idea', icon: Sparkles },
  { id: 'balance', label: 'Auction Balance', icon: HelpCircle },
  { id: 'bug', label: 'Bug Report', icon: Bug },
  { id: 'general', label: 'General Feedback', icon: MessageSquare },
];

const Feedback = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        name: name.trim(),
        email: email.trim(),
        category,
        message: message.trim(),
        createdAt: serverTimestamp(),
      });
      setDone(true);
      setName('');
      setEmail('');
      setMessage('');
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020817] text-white flex flex-col selection:bg-yellow-500/20 selection:text-yellow-300">
      {/* Top Header Navigation (No Landing Tagbar) */}
      <header className="relative z-20 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between">
        <Button asChild variant="outline" size="sm" className="border-white/[0.12] hover:border-yellow-500/40 text-slate-300">
          <Link to="/" className="flex items-center gap-1.5 text-xs font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Arena
          </Link>
        </Button>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-semibold tracking-wider uppercase mb-3">
            <MessageSquare className="w-3.5 h-3.5 text-yellow-400" />
            Tactical Feedback Portal
          </div>
          <h1 className="text-3xl sm:text-4xl font-display uppercase tracking-wider text-white">
            Dispatch <span className="text-[#F5B82E]">Feedback</span>
          </h1>
          <p className="mt-2 text-slate-400 text-sm leading-relaxed">
            Report gameplay bugs, suggest new tactical features, or request tournament roster updates directly to the development team.
          </p>
        </div>

        {/* Feedback Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#09152A] p-6 sm:p-8 shadow-xl shadow-black/40 relative overflow-hidden">
          {done ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold uppercase tracking-wide text-white">Dispatch Received</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Thank you for contributing to CricAuctionIPL. Our development team inspects every tactical log to refine the simulation.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDone(false)}
                className="mt-4 border-white/[0.12] hover:border-yellow-500/40 text-slate-200"
              >
                Send Another Dispatch
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Category Pills */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                  Feedback Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-[#F5B82E]/15 border-[#F5B82E] text-[#F5B82E] shadow-sm shadow-yellow-500/20'
                            : 'bg-slate-950/40 border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Manager Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. CaptainCool7"
                      required
                      className="w-full rounded-xl bg-slate-950/60 border border-white/[0.08] pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      placeholder="manager@franchise.com"
                      required
                      className="w-full rounded-xl bg-slate-950/60 border border-white/[0.08] pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E] transition"
                    />
                  </div>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Detailed Notes / Bug Reproduction
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your suggestion, encounter, or balance observation..."
                  required
                  rows={5}
                  className="w-full rounded-xl bg-slate-950/60 border border-white/[0.08] p-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E] transition resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="gold"
                  disabled={submitting}
                  className="w-full py-3 h-auto text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Transmitting...' : 'Transmit Feedback Dispatch'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default Feedback;

