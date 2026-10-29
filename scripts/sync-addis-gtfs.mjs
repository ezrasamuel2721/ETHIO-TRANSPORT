import { mkdir, writeFile } from "node:fs/promises";

const BASE = "https://raw.githubusercontent.com/AddisMap/AddisMapTransit-gtfs/main/";
const files = ["routes.txt", "trips.txt", "stop_times.txt", "stops.txt"];

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(v => v !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some(v => v !== "")) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map(x => x.trim());
  return rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

async function get(name) {
  const r = await fetch(BASE + name);
  if (!r.ok) throw new Error(`Failed to fetch ${name}: ${r.status}`);
  return parseCSV(await r.text());
}

const [routes, trips, stopTimes, stops] = await Promise.all(files.map(get));

const selectedTrips = new Map();
for (const t of trips) {
  const route = routes.find(r => r.route_id === t.route_id);
  if (!route || !route.route_short_name) continue;
  const key = route.route_short_name + "|" + (t.direction_id || "0");
  if (!selectedTrips.has(key)) selectedTrips.set(key, t.trip_id);
}

const wantedTrip = new Map();
for (const [key, tripId] of selectedTrips) wantedTrip.set(tripId, key);

const sequences = new Map();
for (const st of stopTimes) {
  const key = wantedTrip.get(st.trip_id);
  if (!key) continue;
  if (!sequences.has(key)) sequences.set(key, []);
  sequences.get(key).push({
    stop_id: st.stop_id,
    stop_sequence: Number(st.stop_sequence || 0)
  });
}

const stopMap = new Map(stops.map(s => [s.stop_id, s]));
const output = {
  generatedAt: new Date().toISOString(),
  source: "AddisMapTransit GTFS / OpenStreetMap",
  sourceUrl: "https://github.com/AddisMap/AddisMapTransit-gtfs",
  routeCount: routes.filter(r => r.route_short_name).length,
  routes: {}
};

for (const r of routes) {
  const code = (r.route_short_name || "").trim();
  if (!code) continue;
  const directions = [];
  for (const dir of ["0", "1"]) {
    const seq = sequences.get(code + "|" + dir);
    if (!seq?.length) continue;
    const seen = new Set();
    const routeStops = seq.sort((a,b) => a.stop_sequence - b.stop_sequence)
      .map(x => {
        if (seen.has(x.stop_id)) return null;
        seen.add(x.stop_id);
        const s = stopMap.get(x.stop_id);
        if (!s) return null;
        return {
          id: x.stop_id,
          name: s.stop_name || x.stop_id,
          latitude: Number(s.stop_lat),
          longitude: Number(s.stop_lon),
          stop_sequence: x.stop_sequence
        };
      }).filter(Boolean);
    if (routeStops.length) directions.push({ direction_id: Number(dir), stops: routeStops });
  }
  output.routes[code] = {
    route_id: r.route_id,
    route_short_name: code,
    route_long_name: r.route_long_name || code,
    route_type: Number(r.route_type || 3),
    directions
  };
}

await mkdir("public/data", { recursive: true });
await writeFile("public/data/addis-gtfs-routes.json", JSON.stringify(output));
console.log(`Generated ${Object.keys(output.routes).length} routes with stop sequences.`);
