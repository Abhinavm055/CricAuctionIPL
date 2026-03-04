import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { useGameData, GameSession } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  LogOut, 
  Users, 
  Database, 
  Settings, 
  Play, 
  Pause, 
  SkipForward,
  RefreshCcw,
  Edit,
  Trash2,
  Save,
  X,
  Wallet,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatPrice, IPL_TEAMS, IPL_TEAM_COLORS } from '@/lib/constants';
import { Player, POOL_ORDER } from '@/lib/samplePlayers';
import { StarRating } from '@/components/StarRating';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const AdminDashboard = () => {
  const { isAuthenticated, logout } = useAdmin();
  const { 
    sessions, 
    masterPlayerList,
    updateTeamPurse, 
    resetSessionToLobby, 
    forcePlayerSold,
    skipToNextPlayer,
    triggerAcceleratedRound,
    deleteSession 
  } = useGameData();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [selectedSession, setSelectedSession] = useState<GameSession | null>(null);
  const [editingPurse, setEditingPurse] = useState<{ teamId: string; value: string } | null>(null);
  const [playerFilter, setPlayerFilter] = useState<string>('all');
  const [playerSearch, setPlayerSearch] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: '', description: '', action: () => {} });

  // Redirect if not authenticated
  if (!isAuthenticated) {
    navigate('/admin');
    return null;
  }

  const handleLogout = () => {
    logout();
    toast({ title: 'Logged out successfully' });
    navigate('/admin');
  };

  const handlePurseUpdate = (sessionId: string, teamId: string) => {
    if (!editingPurse) return;
    const newPurse = parseInt(editingPurse.value) * 10000000; // Convert crores to absolute
    updateTeamPurse(sessionId, teamId, newPurse);
    toast({ title: 'Purse updated successfully' });
    setEditingPurse(null);
  };

  const getStatusColor = (status: GameSession['status']) => {
    const colors = {
      LOBBY: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      ACTIVE: 'bg-green-500/20 text-green-400 border-green-500/30',
      RTM_PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      ACCELERATED: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      FINISHED: 'bg-muted text-muted-foreground border-muted'
    };
    return colors[status];
  };

  const filteredPlayers = masterPlayerList.filter(player => {
    const matchesPool = playerFilter === 'all' || player.pool === playerFilter;
    const matchesSearch = player.name.toLowerCase().includes(playerSearch.toLowerCase());
    return matchesPool && matchesSearch;
  });

  // Demo sessions for display (since we don't have real backend)
  const demoSessions: GameSession[] = sessions.length > 0 ? sessions : [
    {
      id: 'demo1',
      code: 'ABCD',
      status: 'ACTIVE',
      createdAt: new Date(),
      hostTeamId: 'csk',
      currentPlayerIndex: 5,
      currentBid: 15000000,
      currentBidder: 'mi',
      currentPool: 'Marquee',
      soldPlayers: [],
      unsoldQueue: [],
      playerQueue: masterPlayerList,
      teams: IPL_TEAMS.map(team => ({
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        purseRemaining: team.purse - Math.floor(Math.random() * 200000000),
        squad: [],
        overseasCount: Math.floor(Math.random() * 4)
      }))
    },
    {
      id: 'demo2',
      code: 'EFGH',
      status: 'LOBBY',
      createdAt: new Date(Date.now() - 3600000),
      hostTeamId: 'rcb',
      currentPlayerIndex: 0,
      currentBid: 0,
      currentBidder: null,
      currentPool: 'Marquee',
      soldPlayers: [],
      unsoldQueue: [],
      playerQueue: masterPlayerList,
      teams: IPL_TEAMS.map(team => ({
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        purseRemaining: team.purse,
        squad: [],
        overseasCount: 0
      }))
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-xl tracking-wide">ADMIN PORTAL</h1>
              <p className="text-xs text-muted-foreground">CricAuctionIPL Control Center</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="sessions" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="sessions" className="gap-2">
              <Play className="w-4 h-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="players" className="gap-2">
              <Users className="w-4 h-4" />
              Players
            </TabsTrigger>
            <TabsTrigger value="database" className="gap-2">
              <Database className="w-4 h-4" />
              Raw Data
            </TabsTrigger>
          </TabsList>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {demoSessions.map(session => (
                <Card 
                  key={session.id} 
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    selectedSession?.id === session.id ? 'border-primary ring-1 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedSession(session)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-mono">{session.code}</CardTitle>
                      <Badge variant="outline" className={getStatusColor(session.status)}>
                        {session.status}
                      </Badge>
                    </div>
                    <CardDescription>
                      Created {session.createdAt.toLocaleTimeString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Host Team:</span>
                      <span className="font-medium">{session.hostTeamId.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Pool:</span>
                      <span className="font-medium">{session.currentPool}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Players Sold:</span>
                      <span className="font-medium">{session.soldPlayers.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unsold Queue:</span>
                      <span className="font-medium">{session.unsoldQueue.length}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Session Control Panel */}
            {selectedSession && (
              <Card className="border-primary/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      Session: <span className="font-mono text-primary">{selectedSession.code}</span>
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setConfirmDialog({
                            open: true,
                            title: 'Reset to Lobby',
                            description: 'This will reset the session to LOBBY state, clearing all sold players and restoring purses.',
                            action: () => {
                              resetSessionToLobby(selectedSession.id);
                              toast({ title: 'Session reset to LOBBY' });
                            }
                          });
                        }}
                      >
                        <RefreshCcw className="w-4 h-4 mr-1" />
                        Reset
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => {
                          setConfirmDialog({
                            open: true,
                            title: 'Delete Session',
                            description: 'This will permanently delete this game session.',
                            action: () => {
                              deleteSession(selectedSession.id);
                              setSelectedSession(null);
                              toast({ title: 'Session deleted' });
                            }
                          });
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Flow Controls */}
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm"
                      onClick={() => {
                        skipToNextPlayer(selectedSession.id);
                        toast({ title: 'Skipped to next player' });
                      }}
                    >
                      <SkipForward className="w-4 h-4 mr-1" />
                      Skip Player (Unsold)
                    </Button>
                    <Button 
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        triggerAcceleratedRound(selectedSession.id);
                        toast({ title: 'Accelerated Round started' });
                      }}
                      disabled={selectedSession.unsoldQueue.length === 0}
                    >
                      <Zap className="w-4 h-4 mr-1" />
                      Start Accelerated Round ({selectedSession.unsoldQueue.length})
                    </Button>
                  </div>

                  {/* Team Purses */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      Team Purses
                    </h4>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {selectedSession.teams.map(team => {
                        const teamColor = IPL_TEAM_COLORS[team.id];
                        return (
                          <div 
                            key={team.id}
                            className="p-3 rounded-lg border bg-card/50 flex items-center justify-between"
                            style={{ borderColor: teamColor?.primary + '40' }}
                          >
                            <div>
                              <span 
                                className="font-semibold"
                                style={{ color: teamColor?.primary }}
                              >
                                {team.shortName}
                              </span>
                              <p className="text-sm text-muted-foreground">
                                {formatPrice(team.purseRemaining)}
                              </p>
                            </div>
                            {editingPurse?.teamId === team.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  className="w-20 h-8"
                                  value={editingPurse.value}
                                  onChange={(e) => setEditingPurse({ ...editingPurse, value: e.target.value })}
                                  placeholder="Cr"
                                />
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8"
                                  onClick={() => handlePurseUpdate(selectedSession.id, team.id)}
                                >
                                  <Save className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8"
                                  onClick={() => setEditingPurse(null)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8"
                                onClick={() => setEditingPurse({ 
                                  teamId: team.id, 
                                  value: (team.purseRemaining / 10000000).toFixed(0) 
                                })}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Players Tab */}
          <TabsContent value="players" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                placeholder="Search players..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="sm:max-w-xs"
              />
              <Select value={playerFilter} onValueChange={setPlayerFilter}>
                <SelectTrigger className="sm:max-w-[180px]">
                  <SelectValue placeholder="Filter by pool" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pools</SelectItem>
                  {POOL_ORDER.map(pool => (
                    <SelectItem key={pool} value={pool}>{pool}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Pool</TableHead>
                      <TableHead>Base Price</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Overseas</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlayers.slice(0, 50).map(player => (
                      <TableRow key={player.id}>
                        <TableCell className="font-medium">{player.name}</TableCell>
                        <TableCell>{player.role}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{player.pool}</Badge>
                        </TableCell>
                        <TableCell>{formatPrice(player.basePrice)}</TableCell>
                        <TableCell>
                          <StarRating rating={player.starRating} size="sm" />
                        </TableCell>
                        <TableCell>
                          {player.isOverseas ? (
                            <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                              OS
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => setEditingPlayer(player)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredPlayers.length > 50 && (
                  <p className="text-center py-3 text-sm text-muted-foreground">
                    Showing 50 of {filteredPlayers.length} players
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Raw Data Tab */}
          <TabsContent value="database">
            <Card>
              <CardHeader>
                <CardTitle>Master Player List (JSON)</CardTitle>
                <CardDescription>
                  Complete raw data of all {masterPlayerList.length} players
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[600px] text-xs">
                  {JSON.stringify(masterPlayerList, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                confirmDialog.action();
                setConfirmDialog({ ...confirmDialog, open: false });
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Player Edit Dialog */}
      <Dialog open={!!editingPlayer} onOpenChange={() => setEditingPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
            <DialogDescription>Modify player details</DialogDescription>
          </DialogHeader>
          {editingPlayer && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={editingPlayer.name} disabled />
              </div>
              <div>
                <label className="text-sm font-medium">Star Rating</label>
                <Select 
                  value={editingPlayer.starRating.toString()}
                  onValueChange={(val) => setEditingPlayer({ ...editingPlayer, starRating: parseInt(val) as 1|2|3|4|5 })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(r => (
                      <SelectItem key={r} value={r.toString()}>{r} Star</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Pool</label>
                <Select 
                  value={editingPlayer.pool}
                  onValueChange={(val) => setEditingPlayer({ ...editingPlayer, pool: val as Player['pool'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POOL_ORDER.map(pool => (
                      <SelectItem key={pool} value={pool}>{pool}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlayer(null)}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (editingPlayer) {
                // update local master list
                // @ts-ignore
                updatePlayer(editingPlayer.id, {
                  starRating: editingPlayer.starRating,
                  pool: editingPlayer.pool,
                });
                toast({ title: 'Player updated' });
              }
              setEditingPlayer(null);
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
