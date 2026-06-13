// Simulation Script to verify CricAuctionIPL Set progression and Accelerated Round flow
const SET_SEQUENCE = [
  "marquee-1",
  "marquee-2",
  "batters-1",
  "batters-2",
  "batters-3",
  "batters-4",
  "bowlers-1",
  "bowlers-2",
  "bowlers-3",
  "bowlers-4",
  "wicketkeepers-1",
  "wicketkeepers-2",
  "wicketkeepers-3",
  "wicketkeepers-4",
  "all-rounders-1",
  "all-rounders-2",
  "all-rounders-3",
  "all-rounders-4",
];

const SET_LABELS = {
  "marquee-1": "Marquee Set 1",
  "marquee-2": "Marquee Set 2",
  "batters-1": "Batsmen - Set 1",
  "batters-2": "Batsmen - Set 2",
  "batters-3": "Batsmen - Set 3",
  "batters-4": "Batsmen - Set 4",
  "bowlers-1": "Bowlers - Set 1",
  "bowlers-2": "Bowlers - Set 2",
  "bowlers-3": "Bowlers - Set 3",
  "bowlers-4": "Bowlers - Set 4",
  "wicketkeepers-1": "Wicket Keepers - Set 1",
  "wicketkeepers-2": "Wicket Keepers - Set 2",
  "wicketkeepers-3": "Wicket Keepers - Set 3",
  "wicketkeepers-4": "Wicket Keepers - Set 4",
  "all-rounders-1": "All-Rounders - Set 1",
  "all-rounders-2": "All-Rounders - Set 2",
  "all-rounders-3": "All-Rounders - Set 3",
  "all-rounders-4": "All-Rounders - Set 4",
};

// Replicate shuffleArray
const shuffleArray = (items) => {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Replicate normalizeCategory
const normalizeCategory = (playerData) => {
  const categoryText = String(playerData.category || playerData.pool || "").toLowerCase().replace(/[\s_-]+/g, "");
  const roleText = String(playerData.role || "").toLowerCase().replace(/[\s_-]+/g, "");
  const raw = `${categoryText} ${roleText}`;

  if (categoryText.includes("marquee")) return "marquee";
  if (roleText.includes("wicket") || categoryText.includes("wicketkeeper")) return "wicketkeepers";
  if (roleText.includes("allround") || categoryText.includes("allround")) return "all-rounders";
  if (roleText.includes("bowl") || categoryText.includes("bowler")) return "bowlers";
  if (["batters", "batsmen", "batter", "batsman"].some((v) => raw.includes(v))) return "batters";
  return "batters";
};

// Replicate buildAuctionSets
const buildAuctionSets = (players) => {
  const grouped = SET_SEQUENCE.reduce((acc, key) => ({ ...acc, [key]: [] }), {});

  // Group players by category
  const playersByCategory = {};
  players.forEach((player) => {
    const category = normalizeCategory(player);
    if (!playersByCategory[category]) {
      playersByCategory[category] = [];
    }
    playersByCategory[category].push(player);
  });

  // Distribute players
  Object.entries(playersByCategory).forEach(([category, catPlayers]) => {
    const sortedPlayers = [...catPlayers].sort((a, b) => {
      const rA = Number(a.rating ?? a.starRating ?? 3);
      const rB = Number(b.rating ?? b.starRating ?? 3);
      if (rA !== rB) return rB - rA;
      const pA = Number(a.basePrice ?? 0);
      const pB = Number(b.basePrice ?? 0);
      return pB - pA;
    });

    const maxSets = category === "marquee" ? 2 : 4;
    
    sortedPlayers.forEach((player, index) => {
      const explicit = Number(player.setNumber ?? player.set ?? player.setNo);
      const marquee = Number(player.marqueeSet);
      let setNo = 0;
      if (category === "marquee") {
        setNo = Number.isFinite(marquee) && marquee > 0 ? marquee : (Number.isFinite(explicit) && explicit > 0 ? explicit : 0);
      } else {
        setNo = Number.isFinite(explicit) && explicit > 0 ? explicit : 0;
      }

      if (setNo === 0) {
        setNo = (index % maxSets) + 1;
      }

      const key = `${category}-${Math.max(1, Math.min(maxSets, Math.floor(setNo)))}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(player);
    });
  });

  // Filter out empty sets, map to key/label/playerIds.
  // Note: We won't shuffle the outer sets sequence in this simulation to make progression readable (or we can keep it as is).
  // Real app shuffles the outer set sequence using shuffleArray. Let's replicate this exactly.
  const sets = SET_SEQUENCE
    .filter((key) => grouped[key] && grouped[key].length > 0)
    .map((key) => ({
      key,
      label: SET_LABELS[key] || key,
      playerIds: grouped[key].map((player) => player.id),
    }));

  return shuffleArray(sets);
};

// Mock Players List
const generateMockPlayers = () => {
  const list = [];
  let idCounter = 1;

  // Generate 5 Marquee
  for (let i = 1; i <= 6; i++) {
    list.push({ id: `p_${idCounter++}`, name: `Marquee Player ${i}`, pool: 'Marquee', role: 'Batsman', rating: 5, basePrice: 20000000 });
  }
  // Generate 12 Batters
  for (let i = 1; i <= 12; i++) {
    list.push({ id: `p_${idCounter++}`, name: `Batsman ${i}`, pool: 'Batsmen', role: 'Batsman', rating: 4, basePrice: 10000000 });
  }
  // Generate 12 Bowlers
  for (let i = 1; i <= 12; i++) {
    list.push({ id: `p_${idCounter++}`, name: `Bowler ${i}`, pool: 'Bowlers', role: 'Bowler', rating: 4, basePrice: 10000000 });
  }
  // Generate 12 Wicket Keepers
  for (let i = 1; i <= 12; i++) {
    list.push({ id: `p_${idCounter++}`, name: `WK ${i}`, pool: 'Wicket-Keepers', role: 'Wicket-Keeper', rating: 3, basePrice: 5000000 });
  }
  // Generate 12 All Rounders
  for (let i = 1; i <= 12; i++) {
    list.push({ id: `p_${idCounter++}`, name: `AllRounder ${i}`, pool: 'All-Rounders', role: 'All-Rounder', rating: 3, basePrice: 7500000 });
  }

  return list;
};

// Replicate progress logging
const logSetsAndUnsoldCount = (sessionData, queueIndex) => {
  const queue = sessionData.auctionQueue || [];
  const auctionSets = sessionData.auctionSets || [];
  const unsoldPlayers = sessionData.unsoldPlayers || [];

  const completedSets = auctionSets.filter(set => {
    return (set.playerIds || []).every(id => {
      const idx = queue.indexOf(id);
      return idx !== -1 && idx < queueIndex;
    });
  });

  console.log(`[AUCTION PROGRESS PROGRESS] Sets completed: ${completedSets.length}/${auctionSets.length}. Unsold players count: ${unsoldPlayers.length}.`);
};

// Run simulation
const run = () => {
  console.log("=== CricAuctionIPL Simulation Starting ===");
  const players = generateMockPlayers();
  console.log(`Total master players generated: ${players.length}`);

  // Build sets & queue
  const auctionSets = buildAuctionSets(players);
  const queue = auctionSets.flatMap((set) => set.playerIds);
  console.log("\nGenerated Sets Layout:");
  auctionSets.forEach((set, index) => {
    console.log(` - Set ${index + 1}: Key: ${set.key} | Label: "${set.label}" | Size: ${set.playerIds.length} players`);
  });

  const session = {
    phase: "AUCTION",
    auctionSets: auctionSets,
    auctionQueue: queue,
    queueIndex: -1,
    unsoldPlayers: [],
    isAcceleratedRound: false,
  };

  // Simulate progress transition and log set progression
  console.log("\n--- Starting Set Progression Simulation ---");
  let lastActiveSetKey = null;

  for (let i = 0; i < queue.length; i++) {
    session.queueIndex = i;
    
    // Find active set
    const currentPlayerId = queue[i];
    const activeSet = auctionSets.find(set => set.playerIds.includes(currentPlayerId));
    
    if (activeSet && activeSet.key !== lastActiveSetKey) {
      lastActiveSetKey = activeSet.key;
      const setIdx = auctionSets.findIndex(set => set.key === activeSet.key);
      console.log(`\n>>> Transitioning to Set Tracker: Set ${setIdx + 1} of ${auctionSets.length} ("${activeSet.label}")`);
    }

    // Every few players, simulate some unsold players
    if (i % 5 === 0) {
      session.unsoldPlayers.push(currentPlayerId);
    }

    logSetsAndUnsoldCount(session, i + 1);
  }

  console.log("\n--- End of Standard sets ---");
  const finalQueueIndex = queue.length;
  session.queueIndex = finalQueueIndex;
  logSetsAndUnsoldCount(session, finalQueueIndex);

  console.log(`\nUnsold players pool before Accelerated Round: ${session.unsoldPlayers.length} players`);
  
  // Simulate starting accelerated round
  const hasFinishedNormalQueue = session.queueIndex >= session.auctionQueue.length;
  if (hasFinishedNormalQueue && session.unsoldPlayers.length > 0) {
    console.log(`\n[ACCELERATED ROUND] Normal sets complete via loadNextPlayer. Unsold players count: ${session.unsoldPlayers.length}. Moving to Accelerated Round selection.`);
    
    console.log(`\n--- Starting Accelerated Round Queue Creation ---`);
    const unsold = shuffleArray(session.unsoldPlayers);
    console.log(`[ACCELERATED ROUND] Starting Accelerated Round. Unsold players count: ${unsold.length}`);
    
    // Update session state
    session.phase = "AUCTION";
    session.auctionQueue = unsold;
    session.queueIndex = -1;
    session.unsoldPlayers = [];
    session.isAcceleratedRound = true;
    
    console.log(`[ACCELERATED ROUND] New Accelerated queue created with ${session.auctionQueue.length} players:`, session.auctionQueue);
  }
};

run();
