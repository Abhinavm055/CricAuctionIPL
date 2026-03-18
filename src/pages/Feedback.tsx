import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';

const Feedback = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        name,
        email,
        message,
        createdAt: serverTimestamp(),
      });
      setDone(true);
      setName('');
      setEmail('');
      setMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-4xl text-primary">FEEDBACK</h1>
          <Button asChild variant="outline"><Link to="/">Back</Link></Button>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-yellow-400/30 bg-[#0f172a] p-5 space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            className="w-full rounded-lg bg-[#111b31] border border-white/15 px-3 py-2 focus:outline-none focus:border-yellow-400"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            required
            className="w-full rounded-lg bg-[#111b31] border border-white/15 px-3 py-2 focus:outline-none focus:border-yellow-400"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message"
            required
            rows={5}
            className="w-full rounded-lg bg-[#111b31] border border-white/15 px-3 py-2 focus:outline-none focus:border-yellow-400"
          />
          <Button
            type="submit"
            variant="gold"
            disabled={submitting}
            className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:shadow-[0_0_16px_rgba(251,191,36,0.7)]"
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
          {done && <p className="text-emerald-400 text-sm">Thanks! Feedback submitted.</p>}
        </form>
      </div>
    </div>
  );
};

export default Feedback;
