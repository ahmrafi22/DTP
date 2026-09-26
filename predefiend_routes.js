/**
 * Dhaka Tesla Pool: predefined road graph, legs and routes.
 *
 * Structure
 *   NODES   stops (id -> name, zone, lat, lng)
 *   EDGES   legs between two adjacent stops, each with its own distance, congestion, time and price
 *   ROUTES  38 named routes = ordered stop lists; legs are looked up from EDGES
 *
 * Notes
 *   - Coordinates are approximate (for demo matching only, not navigation).
 *   - Leg distance = straight-line km x ROAD_FACTOR, so legs are genuinely different lengths.
 *   - Leg price = km x rate x congestion factor, rounded to whole taka. Busy legs cost more per km.
 *   - All money is integer paisa (100 paisa = 1 taka).
 *   - Edges are undirected: a route can be travelled in either direction.
 */

// ---------- pricing config (tune freely) ----------
export const BASE_FARE_PAISA = 3000;          // ৳30 flat, once per passenger
const RATE_PER_KM_PAISA = 1800;               // ৳18 per km before congestion
const MIN_LEG_PAISA = 1000;                   // no leg cheaper than ৳10
const ROAD_FACTOR = 1.35;                     // straight line -> road distance
const BASE_SPEED_KMH = 28;                    // free-flow average speed
export const POOL_DISCOUNT_PCT = { 1: 0, 2: 20, 3: 30 };   // by riders sharing a leg

// ---------- nodes: id: [name, zone, lat, lng] ----------
const RAW_NODES = {
  // north
  uttara_sec18: ['Uttara Sector 18', 'north', 23.891979, 90.402534],
  abdullahpur: ['Abdullahpur', 'north', 23.879735, 90.402068],
  uttara_hb: ['Uttara House Building', 'north', 23.872963, 90.397517],
  rajlakshmi: ['Uttara Rajlakshmi', 'north', 23.863847, 90.404981],
  airport: ['Airport', 'north', 23.853712, 90.381518],
  kurmitola: ['Kurmitola', 'north', 23.816, 90.400189],
  khilkhet: ['Khilkhet', 'north', 23.830509, 90.416589],
  kuril: ['Kuril', 'north', 23.821067, 90.420964],
  bashundhara: ['Bashundhara R/A', 'north', 23.815209, 90.428087],
  purbachal: ['Purbachal', 'north', 23.776065, 90.500594],
  // north-central
  banani: ['Banani', 'north-central', 23.793995, 90.404263],
  gulshan2: ['Gulshan 2', 'north-central', 23.794397, 90.41435],
  gulshan1: ['Gulshan 1', 'north-central', 23.778854, 90.416705],
  baridhara: ['Baridhara', 'north-central', 23.805154, 90.419351],
  notun_bazar: ['Notun Bazar', 'north-central', 23.797281, 90.425579],
  badda: ['Badda', 'north-central', 23.779669, 90.426002],
  mohakhali: ['Mohakhali', 'north-central', 23.776569, 90.4001],
  // east
  aftabnagar: ['Aftabnagar', 'east', 23.748884, 90.449096],
  banasree: ['Banasree', 'east', 23.762016, 90.438523],
  rampura: ['Rampura', 'east', 23.759266, 90.42503],
  khilgaon: ['Khilgaon', 'east', 23.745681, 90.426479],
  basabo: ['Basabo', 'east', 23.735719, 90.431367],
  mugda: ['Mugda', 'east', 23.725594, 90.433668],
  kamalapur: ['Kamalapur', 'east', 23.729251, 90.426466],
  sayedabad: ['Sayedabad', 'east', 23.718094, 90.425718],
  jatrabari: ['Jatrabari', 'east', 23.709976, 90.434049],
  demra: ['Demra', 'east', 23.709152, 90.467188],
  // central
  motijheel: ['Motijheel', 'central', 23.733929, 90.418523],
  paltan: ['Paltan', 'central', 23.737225, 90.408941],
  gulistan: ['Gulistan', 'central', 23.725613, 90.412067],
  malibagh: ['Malibagh', 'central', 23.744888, 90.414683],
  moghbazar: ['Moghbazar', 'central', 23.749118, 90.402253],
  kawran_bazar: ['Karwan Bazar', 'central', 23.750531, 90.392846],
  farmgate: ['Farmgate', 'central', 23.757123, 90.390019],
  tejgaon: ['Tejgaon', 'central', 23.764075, 90.392765],
  shahbagh: ['Shahbagh', 'central', 23.738953, 90.395119],
  dhaka_univ: ['Dhaka University', 'central', 23.733802, 90.392322],
  new_market: ['New Market', 'central', 23.733117, 90.384416],
  science_lab: ['Science Lab', 'central', 23.738445, 90.384311],
  panthapath: ['Panthapath', 'central', 23.75212, 90.385216],
  // west (Dhanmondi / Mohammadpur)
  dhanmondi27: ['Dhanmondi 27', 'west', 23.755216, 90.376329],
  dhanmondi_satmasjid: ['Dhanmondi Satmasjid', 'west', 23.745852, 90.371305],
  mohammadpur: ['Mohammadpur', 'west', 23.765317, 90.359157],
  shyamoli: ['Shyamoli', 'west', 23.773658, 90.365838],
  agargaon: ['Agargaon', 'west', 23.777508, 90.380502],
  technical: ['Technical More', 'west', 23.781065, 90.352242],
  gabtoli: ['Gabtoli', 'west', 23.78061, 90.349405],
  // mirpur
  mirpur1: ['Mirpur 1', 'mirpur', 23.795509, 90.353591],
  shewrapara: ['Shewrapara', 'mirpur', 23.792257, 90.374289],
  kazipara: ['Kazipara', 'mirpur', 23.798507, 90.372108],
  mirpur10: ['Mirpur 10', 'mirpur', 23.806966, 90.368517],
  mirpur11: ['Mirpur 11', 'mirpur', 23.815799, 90.366017],
  mirpur12: ['Mirpur 12', 'mirpur', 23.830343, 90.362815],
  mirpur14: ['Mirpur 14', 'mirpur', 23.800005, 90.383013],
  mirpur_dohs: ['Mirpur DOHS', 'mirpur', 23.823153, 90.382252],
  // old dhaka
  azimpur: ['Azimpur', 'old-dhaka', 23.728536, 90.386019],
  lalbagh: ['Lalbagh', 'old-dhaka', 23.719804, 90.389889],
  chawkbazar: ['Chawkbazar', 'old-dhaka', 23.716498, 90.395823],
  babubazar: ['Babubazar', 'old-dhaka', 23.712363, 90.400407],
  sadarghat: ['Sadarghat', 'old-dhaka', 23.712742, 90.40528],
};

export const NODES = Object.fromEntries(
  Object.entries(RAW_NODES).map(([id, [name, zone, lat, lng]]) => [id, { id, name, zone, lat, lng }])
);

// ---------- edges: [from, to, congestionFactor] ----------
// congestion 1.0 = free-flowing, 1.6 = notoriously jammed
const RAW_EDGES = [
  // Uttara / Airport Road
  ['uttara_sec18', 'abdullahpur', 0.9], ['abdullahpur', 'uttara_hb', 1.0], ['uttara_hb', 'rajlakshmi', 1.1],
  ['rajlakshmi', 'airport', 1.0], ['airport', 'kurmitola', 1.0], ['kurmitola', 'banani', 1.2],
  ['banani', 'mohakhali', 1.4],
  // Khilkhet / Kuril / Bashundhara / Purbachal
  ['airport', 'khilkhet', 1.1], ['khilkhet', 'kuril', 1.2], ['kuril', 'bashundhara', 1.1],
  ['bashundhara', 'purbachal', 0.9], ['kuril', 'notun_bazar', 1.3],
  // Gulshan / Baridhara / Badda
  ['notun_bazar', 'baridhara', 1.2], ['baridhara', 'gulshan2', 1.2], ['gulshan2', 'banani', 1.2],
  ['gulshan2', 'gulshan1', 1.4], ['gulshan1', 'mohakhali', 1.3], ['gulshan1', 'badda', 1.5],
  ['notun_bazar', 'badda', 1.4],
  // East: Badda / Rampura / Khilgaon / Basabo
  ['badda', 'aftabnagar', 1.2], ['aftabnagar', 'banasree', 1.2], ['banasree', 'rampura', 1.3],
  ['badda', 'rampura', 1.5], ['rampura', 'khilgaon', 1.4], ['rampura', 'malibagh', 1.5],
  ['khilgaon', 'malibagh', 1.5], ['khilgaon', 'basabo', 1.3], ['basabo', 'mugda', 1.3],
  // South-east: Mugda / Kamalapur / Jatrabari / Demra
  ['mugda', 'kamalapur', 1.3], ['mugda', 'jatrabari', 1.4], ['kamalapur', 'sayedabad', 1.5],
  ['sayedabad', 'jatrabari', 1.6], ['jatrabari', 'demra', 1.2], ['kamalapur', 'motijheel', 1.4],
  // Central: Motijheel / Paltan / Gulistan / Malibagh / Moghbazar
  ['motijheel', 'paltan', 1.3], ['motijheel', 'gulistan', 1.4], ['paltan', 'gulistan', 1.3],
  ['paltan', 'malibagh', 1.5], ['paltan', 'shahbagh', 1.4], ['malibagh', 'moghbazar', 1.5],
  ['moghbazar', 'mohakhali', 1.5], ['moghbazar', 'kawran_bazar', 1.6],
  // Tejgaon / Farmgate / Karwan Bazar
  ['mohakhali', 'tejgaon', 1.4], ['tejgaon', 'farmgate', 1.4], ['farmgate', 'kawran_bazar', 1.6],
  ['kawran_bazar', 'shahbagh', 1.5], ['kawran_bazar', 'panthapath', 1.4], ['farmgate', 'agargaon', 1.3],
  // Shahbagh / University / New Market / Dhanmondi
  ['shahbagh', 'dhaka_univ', 1.4], ['dhaka_univ', 'new_market', 1.4], ['shahbagh', 'science_lab', 1.4],
  ['science_lab', 'new_market', 1.4], ['panthapath', 'science_lab', 1.5], ['panthapath', 'dhanmondi27', 1.5],
  ['dhanmondi27', 'dhanmondi_satmasjid', 1.3], ['dhanmondi_satmasjid', 'science_lab', 1.4],
  ['dhanmondi_satmasjid', 'mohammadpur', 1.3], ['dhanmondi27', 'mohammadpur', 1.4],
  // West: Shyamoli / Mohammadpur / Technical / Gabtoli
  ['dhanmondi27', 'shyamoli', 1.3], ['shyamoli', 'mohammadpur', 1.3], ['shyamoli', 'agargaon', 1.3],
  ['shyamoli', 'technical', 1.3], ['technical', 'gabtoli', 1.1], ['technical', 'mirpur1', 1.2],
  // Mirpur
  ['agargaon', 'shewrapara', 1.2], ['agargaon', 'mirpur14', 1.2], ['shewrapara', 'kazipara', 1.2],
  ['kazipara', 'mirpur10', 1.3], ['mirpur14', 'mirpur10', 1.2], ['mirpur14', 'banani', 1.1],
  ['mirpur10', 'mirpur1', 1.3], ['mirpur10', 'mirpur11', 1.2], ['mirpur11', 'mirpur12', 1.1],
  ['mirpur12', 'mirpur_dohs', 1.0], ['mirpur_dohs', 'kurmitola', 1.1],
  // Old Dhaka
  ['new_market', 'azimpur', 1.4], ['azimpur', 'lalbagh', 1.3], ['lalbagh', 'chawkbazar', 1.4],
  ['chawkbazar', 'babubazar', 1.3], ['chawkbazar', 'sadarghat', 1.5], ['sadarghat', 'babubazar', 1.4],
  ['sadarghat', 'gulistan', 1.6],
];

// ---------- build edges (distance, time, price) ----------
const toRad = (d) => (d * Math.PI) / 180;
function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const edgeKey = (a, b) => [a, b].sort().join('~');

export const EDGES = RAW_EDGES.map(([from, to, congestion]) => {
  if (!NODES[from] || !NODES[to]) throw new Error(`Unknown node in edge ${from}-${to}`);
  const km = Math.max(0.6, Math.round(haversineKm(NODES[from], NODES[to]) * ROAD_FACTOR * 10) / 10);
  const pricePaisa = Math.max(MIN_LEG_PAISA, Math.round((km * RATE_PER_KM_PAISA * congestion) / 100) * 100);
  const durationMin = Math.max(2, Math.round((km / (BASE_SPEED_KMH / congestion)) * 60));
  return { id: edgeKey(from, to), from, to, km, congestion, durationMin, pricePaisa };
});

export const EDGE_MAP = new Map(EDGES.map((e) => [e.id, e]));
export const getEdge = (a, b) => EDGE_MAP.get(edgeKey(a, b)) || null;

// adjacency list for graph algorithms
export const ADJACENCY = {};
for (const id of Object.keys(NODES)) ADJACENCY[id] = [];
for (const e of EDGES) {
  ADJACENCY[e.from].push({ to: e.to, edge: e });
  ADJACENCY[e.to].push({ to: e.from, edge: e });
}

// ---------- routes: [code, name, corridor, stops[]] ----------
const RAW_ROUTES = [
  ['R01', 'Uttara to Mohakhali (Airport Road)', 'Airport Road', ['uttara_hb', 'rajlakshmi', 'airport', 'kurmitola', 'banani', 'mohakhali']],
  ['R02', 'Uttara North to Airport', 'Uttara', ['uttara_sec18', 'abdullahpur', 'uttara_hb', 'rajlakshmi', 'airport']],
  ['R03', 'Airport to Purbachal', 'Kuril-Purbachal Expressway', ['airport', 'khilkhet', 'kuril', 'bashundhara', 'purbachal']],
  ['R04', 'Kuril to Rampura (Progoti Sarani)', 'Progoti Sarani', ['kuril', 'notun_bazar', 'badda', 'rampura']],
  ['R05', 'Banani to Mohakhali via Gulshan', 'Gulshan Ring', ['banani', 'gulshan2', 'gulshan1', 'mohakhali']],
  ['R06', 'Notun Bazar to Banani via Baridhara', 'Baridhara', ['notun_bazar', 'baridhara', 'gulshan2', 'banani']],
  ['R07', 'Gulshan 1 to Banasree', 'Badda-Aftabnagar', ['gulshan1', 'badda', 'aftabnagar', 'banasree']],
  ['R08', 'Banasree to Motijheel', 'Rampura-Malibagh', ['banasree', 'rampura', 'malibagh', 'paltan', 'motijheel']],
  ['R09', 'Badda to Mugda', 'Rampura-Basabo', ['badda', 'rampura', 'khilgaon', 'basabo', 'mugda']],
  ['R10', 'Mugda to Sadarghat', 'Kamalapur-Motijheel', ['mugda', 'kamalapur', 'motijheel', 'gulistan', 'sadarghat']],
  ['R11', 'Mugda to Demra', 'Dhaka-Demra Road', ['mugda', 'jatrabari', 'demra']],
  ['R12', 'Kamalapur to Jatrabari', 'Sayedabad', ['kamalapur', 'sayedabad', 'jatrabari']],
  ['R13', 'Mohakhali to Shahbagh', 'Tejgaon-Farmgate', ['mohakhali', 'tejgaon', 'farmgate', 'kawran_bazar', 'shahbagh']],
  ['R14', 'Mohakhali to Gulistan', 'Moghbazar-Malibagh', ['mohakhali', 'moghbazar', 'malibagh', 'paltan', 'gulistan']],
  ['R15', 'Moghbazar to Dhanmondi 27', 'Karwan Bazar-Panthapath', ['moghbazar', 'kawran_bazar', 'panthapath', 'dhanmondi27']],
  ['R16', 'Farmgate to Mohammadpur', 'Agargaon-Shyamoli', ['farmgate', 'agargaon', 'shyamoli', 'mohammadpur']],
  ['R17', 'Farmgate to Mirpur 12', 'Mirpur Road', ['farmgate', 'agargaon', 'mirpur14', 'mirpur10', 'mirpur11', 'mirpur12']],
  ['R18', 'Mirpur 10 to Gabtoli', 'Mirpur-Technical', ['mirpur10', 'mirpur1', 'technical', 'gabtoli']],
  ['R19', 'Agargaon to Mirpur 10', 'Shewrapara-Kazipara', ['agargaon', 'shewrapara', 'kazipara', 'mirpur10']],
  ['R20', 'Mirpur 12 to Banani via DOHS', 'Mirpur DOHS-Airport Road', ['mirpur12', 'mirpur_dohs', 'kurmitola', 'banani']],
  ['R21', 'Mirpur 14 to Banani', 'Kachukhet-Banani', ['mirpur14', 'banani']],
  ['R22', 'Technical to Panthapath', 'Shyamoli-Dhanmondi', ['technical', 'shyamoli', 'dhanmondi27', 'panthapath']],
  ['R23', 'Mohammadpur to New Market', 'Satmasjid Road', ['mohammadpur', 'dhanmondi_satmasjid', 'science_lab', 'new_market']],
  ['R24', 'Dhanmondi 27 to Satmasjid', 'Dhanmondi Inner', ['dhanmondi27', 'dhanmondi_satmasjid']],
  ['R25', 'Panthapath to Chawkbazar', 'Elephant Road-Azimpur', ['panthapath', 'science_lab', 'new_market', 'azimpur', 'lalbagh', 'chawkbazar']],
  ['R26', 'Shahbagh to New Market', 'University Road', ['shahbagh', 'dhaka_univ', 'new_market']],
  ['R27', 'Shahbagh to Motijheel', 'Purana Paltan', ['shahbagh', 'paltan', 'motijheel']],
  ['R28', 'Chawkbazar to Babubazar', 'Old Dhaka South', ['chawkbazar', 'sadarghat', 'babubazar']],
  ['R29', 'Old Dhaka Loop', 'Old Dhaka', ['azimpur', 'lalbagh', 'chawkbazar', 'babubazar', 'sadarghat', 'gulistan']],
  ['R30', 'Rampura to Malibagh via Khilgaon', 'Khilgaon-Malibagh', ['rampura', 'khilgaon', 'malibagh']],
  ['R31', 'Uttara to Motijheel (Express)', 'North-South Trunk', ['uttara_hb', 'rajlakshmi', 'airport', 'kurmitola', 'banani', 'mohakhali', 'tejgaon', 'farmgate', 'kawran_bazar', 'shahbagh', 'paltan', 'motijheel']],
  ['R32', 'Mirpur 12 to Motijheel', 'Mirpur-Farmgate-Motijheel', ['mirpur12', 'mirpur11', 'mirpur10', 'mirpur14', 'agargaon', 'farmgate', 'kawran_bazar', 'moghbazar', 'malibagh', 'paltan', 'motijheel']],
  ['R33', 'Bashundhara to Mohakhali', 'Kuril-Gulshan-Banani', ['bashundhara', 'kuril', 'notun_bazar', 'baridhara', 'gulshan2', 'banani', 'mohakhali']],
  ['R34', 'Gabtoli to Karwan Bazar', 'Technical-Farmgate', ['gabtoli', 'technical', 'shyamoli', 'agargaon', 'farmgate', 'kawran_bazar']],
  ['R35', 'Demra to Motijheel', 'Jatrabari-Sayedabad', ['demra', 'jatrabari', 'sayedabad', 'kamalapur', 'motijheel']],
  ['R36', 'Aftabnagar to Kuril', 'Badda-Notun Bazar', ['aftabnagar', 'badda', 'notun_bazar', 'kuril']],
  ['R37', 'Dhanmondi 27 to Mohammadpur (direct)', 'Mirpur Road South', ['dhanmondi27', 'mohammadpur']],
  ['R38', 'Shahbagh to Panthapath via Science Lab', 'Science Lab Road', ['shahbagh', 'science_lab', 'panthapath']],
];

export const ROUTES = RAW_ROUTES.map(([code, name, corridor, stops]) => {
  const legs = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const edge = getEdge(stops[i], stops[i + 1]);
    if (!edge) throw new Error(`Route ${code}: no edge between ${stops[i]} and ${stops[i + 1]}`);
    legs.push(edge);
  }
  return {
    id: code, code, name, corridor, stops, legs,
    totalKm: Math.round(legs.reduce((s, l) => s + l.km, 0) * 10) / 10,
    totalMin: legs.reduce((s, l) => s + l.durationMin, 0),
    totalPricePaisa: legs.reduce((s, l) => s + l.pricePaisa, 0),
  };
});

export const ROUTE_MAP = new Map(ROUTES.map((r) => [r.id, r]));
export const getRoute = (id) => ROUTE_MAP.get(id) || null;

// ---------- helpers ----------

/** Legs a passenger rides on a route, in travel order (works in either direction). */
export function legsBetween(routeId, fromId, toId) {
  const r = getRoute(routeId);
  if (!r) return null;
  const i = r.stops.indexOf(fromId);
  const j = r.stops.indexOf(toId);
  if (i === -1 || j === -1 || i === j) return null;
  return i < j ? r.legs.slice(i, j) : r.legs.slice(j, i).reverse();
}

/** Routes that contain both stops. */
export const findRoutes = (fromId, toId) =>
  ROUTES.filter((r) => r.stops.includes(fromId) && r.stops.includes(toId) && fromId !== toId);

/** Legs two trips have in common (used to decide if two requests are poolable). */
export function sharedLegs(legsA, legsB) {
  const ids = new Set(legsB.map((l) => l.id));
  return legsA.filter((l) => ids.has(l.id));
}

/** Poolable if they share at least one leg. */
export const isPoolable = (legsA, legsB) => sharedLegs(legsA, legsB).length > 0;

/**
 * Fare for one passenger.
 * ridersPerLeg: { [edgeId]: numberOfRidersOnThatLeg } (defaults to 1 = solo)
 * Returns integer paisa and a per-leg breakdown.
 */
export function priceLegs(legs, ridersPerLeg = {}) {
  let distanceCharge = 0;
  let poolDiscount = 0;
  const lines = legs.map((leg) => {
    const riders = Math.min(3, Math.max(1, ridersPerLeg[leg.id] || 1));
    const discountPct = POOL_DISCOUNT_PCT[riders];
    const discount = Math.round((leg.pricePaisa * discountPct) / 100);
    distanceCharge += leg.pricePaisa;
    poolDiscount += discount;
    return { edgeId: leg.id, from: leg.from, to: leg.to, riders, discountPct, pricePaisa: leg.pricePaisa, paidPaisa: leg.pricePaisa - discount };
  });
  return {
    baseFare: BASE_FARE_PAISA, distanceCharge, poolDiscount,
    total: BASE_FARE_PAISA + distanceCharge - poolDiscount,
    lines,
  };
}

/** Shortest path between any two stops by 'km', 'durationMin' or 'pricePaisa' (Dijkstra). */
export function shortestPath(fromId, toId, weight = 'km') {
  if (!NODES[fromId] || !NODES[toId]) return null;
  const dist = { [fromId]: 0 };
  const prev = {};
  const queue = new Set(Object.keys(NODES));
  while (queue.size) {
    let u = null;
    for (const n of queue) if (dist[n] !== undefined && (u === null || dist[n] < dist[u])) u = n;
    if (u === null || u === toId) break;
    queue.delete(u);
    for (const { to, edge } of ADJACENCY[u]) {
      const alt = dist[u] + edge[weight];
      if (dist[to] === undefined || alt < dist[to]) { dist[to] = alt; prev[to] = { node: u, edge }; }
    }
  }
  if (dist[toId] === undefined) return null;
  const stops = [toId];
  const legs = [];
  for (let n = toId; prev[n]; n = prev[n].node) { stops.unshift(prev[n].node); legs.unshift(prev[n].edge); }
  return { stops, legs, total: Math.round(dist[toId] * 10) / 10 };
}

export const formatTaka = (paisa) => `৳${(paisa / 100).toFixed(paisa % 100 ? 2 : 0)}`;

export default { NODES, EDGES, ADJACENCY, ROUTES, getRoute, getEdge, legsBetween, findRoutes, sharedLegs, isPoolable, priceLegs, shortestPath };