import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/contexts/AdminContext';
import { Users, Shield, User, Search, CheckCircle2, Calendar, Clock, Filter, ShieldCheck, Mail } from 'lucide-react';

export interface UserAccountRecord {
  id: string;
  name: string;
  email: string;
  createdAt: any;
  lastLoginAt: any;
  status: string;
  role: string;
  auctionsWon?: number;
  auctionsPlayed?: number;
}

interface AdminAccountsPageProps {
  searchQuery?: string;
}

const formatDate = (val: any): string => {
  if (!val) return '—';
  try {
    let date: Date | null = null;
    if (typeof val === 'object' && val !== null && 'seconds' in val) {
      date = new Date(val.seconds * 1000);
    } else if (typeof val === 'object' && val !== null && typeof val.toDate === 'function') {
      date = val.toDate();
    } else if (typeof val === 'string' || typeof val === 'number') {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
      }
    }
    if (!date) return '—';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
};

const formatTime = (val: any): string => {
  if (!val) return '—';
  try {
    let date: Date | null = null;
    if (typeof val === 'object' && val !== null && 'seconds' in val) {
      date = new Date(val.seconds * 1000);
    } else if (typeof val === 'object' && val !== null && typeof val.toDate === 'function') {
      date = val.toDate();
    } else if (typeof val === 'string' || typeof val === 'number') {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
      }
    }
    if (!date) return '—';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

export const AdminAccountsPage = ({ searchQuery = '' }: AdminAccountsPageProps) => {
  const { isAdmin, adminEmail } = useAdmin();
  const [users, setUsers] = useState<UserAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<'all' | 'active' | 'admin' | 'user'>('all');
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const records: UserAccountRecord[] = snap.docs.map((d) => {
          const data = d.data();
          const email = String(data.email || '').trim();
          const name = String(data.name || data.managerName || data.displayName || email.split('@')[0] || 'User');
          const isDocAdmin = Boolean(
            (adminEmail && email && email.toLowerCase() === adminEmail.toLowerCase()) ||
            String(data.role || '').toLowerCase() === 'admin'
          );

          return {
            id: d.id,
            name,
            email: email || '—',
            createdAt: data.createdAt || null,
            lastLoginAt: data.lastLoginAt || data.lastSignInTime || data.updatedAt || null,
            status: String(data.status || 'ACTIVE').toUpperCase(),
            role: isDocAdmin ? 'Admin' : 'User',
            auctionsWon: Number(data.auctionsWon || 0),
            auctionsPlayed: Number(data.auctionsPlayed || 0),
          };
        });

        // Sort: Admins first, then by name
        records.sort((a, b) => {
          if (a.role === 'Admin' && b.role !== 'Admin') return -1;
          if (b.role === 'Admin' && a.role !== 'Admin') return 1;
          return a.name.localeCompare(b.name);
        });

        setUsers(records);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to listen to users collection:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin, adminEmail]);

  const activeSearch = (searchQuery || localSearch).trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role / Status Filter
      if (roleFilter === 'active' && u.status !== 'ACTIVE') return false;
      if (roleFilter === 'admin' && u.role !== 'Admin') return false;
      if (roleFilter === 'user' && u.role !== 'User') return false;

      // Search Query
      if (activeSearch) {
        const matchesName = u.name.toLowerCase().includes(activeSearch);
        const matchesEmail = u.email.toLowerCase().includes(activeSearch);
        const matchesId = u.id.toLowerCase().includes(activeSearch);
        if (!matchesName && !matchesEmail && !matchesId) return false;
      }

      return true;
    });
  }, [users, roleFilter, activeSearch]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-xl uppercase tracking-wider text-white">
              LOGGED-IN ACCOUNTS
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#F5B82E]/15 border border-[#F5B82E]/30 text-[#F5B82E] text-xs font-black tracking-widest font-mono">
              {users.length} {users.length === 1 ? 'USER' : 'USERS'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Registered manager profiles and authenticated accounts from the Firebase system.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#050B16] border border-white/[0.08] self-start sm:self-auto">
          {(['all', 'active', 'admin', 'user'] as const).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setRoleFilter(filterKey)}
              className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                roleFilter === filterKey
                  ? 'bg-[#F5B82E] text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {filterKey}
            </button>
          ))}
        </div>
      </div>

      {/* Internal Search when needed */}
      {!searchQuery && (
        <div className="max-w-xs relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by user or email..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#050B16] border border-white/[0.08] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#F5B82E] transition-all"
          />
        </div>
      )}

      {/* Accounts Table */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-2 border-[#F5B82E] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs uppercase tracking-widest text-slate-400">Loading accounts...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-white/[0.06] bg-[#050B16]/50">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No accounts match the criteria</p>
          <p className="text-xs text-slate-500 mt-0.5">Try adjusting your search query or role filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#050B16]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-slate-950/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 text-center">Role</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Created</th>
                <th className="py-3 px-4 text-right">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredUsers.map((u) => {
                const isAdminRole = u.role === 'Admin';
                const createdFormatted = formatDate(u.createdAt);
                const lastLoginFormatted = formatTime(u.lastLoginAt);

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    {/* User Name & Initial */}
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          isAdminRole
                            ? 'bg-[#F5B82E]/20 text-[#F5B82E] border border-[#F5B82E]/35'
                            : 'bg-slate-800 text-slate-300 border border-white/10'
                        }`}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate max-w-[140px] sm:max-w-[180px] font-bold text-slate-200">
                            {u.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]">
                            {u.id.slice(0, 10)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      {u.email !== '—' ? (
                        <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                          <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{u.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4 text-center">
                      {isAdminRole ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#F5B82E]/15 text-[#F5B82E] border border-[#F5B82E]/30 shadow-sm">
                          <ShieldCheck className="w-3 h-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-800/80 text-slate-400 border border-white/[0.06]">
                          <User className="w-3 h-3" />
                          User
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        {u.status}
                      </span>
                    </td>

                    {/* Account Creation Date */}
                    <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                      {createdFormatted !== '—' ? (
                        <div className="inline-flex items-center gap-1 text-slate-300">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{createdFormatted}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Last Login Date */}
                    <td className="py-3 px-4 text-right text-slate-400 font-mono text-[11px]">
                      {lastLoginFormatted !== '—' ? (
                        <div className="inline-flex items-center justify-end gap-1 text-slate-300">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{lastLoginFormatted}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAccountsPage;
