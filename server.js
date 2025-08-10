import http from 'http';
import { WebSocketServer } from 'ws';

const server = http.createServer((req, res) => {
  res.writeHead(200, {'content-type':'text/plain'});
  res.end('ok');
});

const wss = new WebSocketServer({ server });
console.log('EEW Edge HTTP/WS listening on :8080');

const RING = [];
const MAX_AGE_MS = 4000;

function prune(){
  const now = Date.now();
  while (RING.length && (now - RING[0].ts) > MAX_AGE_MS) RING.shift();
}

function haversine(lat1, lon1, lat2, lon2){
  const R=6371, toRad=v=>v*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

function clusterAndLog(){
  prune();
  const items = RING.slice();
  if (items.length < 12) return;
  const CLUSTER_DIST = 20; // km
  const clusters = [];
  for (const it of items){
    let placed = false;
    for (const c of clusters){
      if (c.some(x => haversine(x.lat,x.lon,it.lat,it.lon) < CLUSTER_DIST)){ c.push(it); placed = true; break; }
    }
    if (!placed) clusters.push([it]);
  }
  const candidates = clusters.filter(c => c.length >= 12);
  for (const c of candidates){
    const t0 = Math.min(...c.map(x=>x.ts));
    const lat = c.reduce((a,b)=>a+b.lat,0)/c.length;
    const lon = c.reduce((a,b)=>a+b.lon,0)/c.length;
    console.log('EEW candidate:', {t0:new Date(t0).toISOString(), lat, lon, count:c.length});
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const m = JSON.parse(data.toString());
      const ts = Date.parse(m.t);
      if (!m || !m.lat || !m.lon || !ts) return;
      RING.push({ ts, lat: m.lat, lon: m.lon, gh: m.gh });
      clusterAndLog();
    } catch (e) {
      console.error('bad message', e);
    }
  });
});

server.listen(8080);
