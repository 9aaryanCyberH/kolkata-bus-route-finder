// ---------------- Map & state ----------------
const map = L.map('map').setView([22.5726, 88.3639], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let allRoutes = [];
let routeLayers = []; // {name, polyline, markers, label, color}
let stopIndex = new Map(); // normalized stop -> [{routeName, stopIndex}]
let allStopNames = new Set();
let activeHighlights = [];

// Elements
const routesJsonEl = document.getElementById('routes-json');
const routesData = JSON.parse(routesJsonEl.textContent);
const fromInput = document.getElementById('from');
const toInput = document.getElementById('to');
const datalist = document.getElementById('stops-list');
const resultsDiv = document.getElementById('results');
const form = document.getElementById('search-form');
const resetBtn = document.getElementById('reset');
const locBtn = document.getElementById('loc-btn');
const timeEl = document.getElementById('local-time');
const weatherEl = document.getElementById('weather');

// ---------------- Utilities ----------------
const norm = s => (s || '').trim().toLowerCase();
function midCoord(coords){ return coords[Math.floor(coords.length/2)]; }
function clearLayerGroup(arr){ arr.forEach(x=>{ if(x.remove) x.remove(); }); }
function fitBoundsOfLayers(layers){
  if(!layers || layers.length===0) return;
  const bounds = layers[0].getBounds();
  let combined = bounds;
  for(let i=1;i<layers.length;i++) combined = combined.extend(layers[i].getBounds());
  map.fitBounds(combined, {padding:[20,20]});
}

// ---------------- Build index & render ----------------
function buildIndexAndRender(data){
  allRoutes = data.routes;
  // populate stop index + datalist
  allRoutes.forEach(route=>{
    route.stops.forEach((s, idx)=>{
      const key = norm(s.name);
      allStopNames.add(s.name);
      if(!stopIndex.has(key)) stopIndex.set(key, []);
      stopIndex.get(key).push({routeName: route.name, index: idx});
    });
  });
  datalist.innerHTML = Array.from(allStopNames).sort().map(n => `<option value="${n}"></option>`).join('');

  // draw routes
  allRoutes.forEach(route=>{
    const coords = route.stops.map(s => s.coords);
    const poly = L.polyline(coords, {color: route.color, weight:4, opacity:0.9}).addTo(map);
    const markers = route.stops.map(s => L.marker(s.coords).bindPopup(`<b>${s.name}</b><br/>Route ${route.name}`).addTo(map));
    const lbl = L.marker(midCoord(coords), {
      icon: L.divIcon({className:'route-label', html:`<div style="background:rgba(0,0,0,0.7);color:#fff;padding:4px 8px;border-radius:6px">${route.name}</div>`})
    }).addTo(map);
    routeLayers.push({name: route.name, polyline: poly, markers: markers, label: lbl, color: route.color, coords});
  });

  // fit to all
  const boundsList = routeLayers.map(r=>L.latLngBounds(r.coords));
  if(boundsList.length) fitBoundsOfLayers(boundsList.map(b=>L.rectangle(b).addTo(map)));
}

// ---------------- Highlight & dim ----------------
function dimAll(){
  routeLayers.forEach(rl=>{
    rl.polyline.setStyle({opacity:0.2, weight:3});
    rl.markers.forEach(m => m.getElement()?.classList?.add('dimmed'));
    rl.label.getElement()?.classList?.add('dimmed');
  });
}
function resetStyles(){
  routeLayers.forEach(rl=>{
    rl.polyline.setStyle({color: rl.color, opacity:0.9, weight:4});
    rl.markers.forEach(m => m.getElement()?.classList?.remove('dimmed'));
    rl.label.getElement()?.classList?.remove('dimmed');
  });
  clearLayerGroup(activeHighlights);
  activeHighlights = [];
}
function highlightRoutesByName(names){
  const highlightLayers = [];
  routeLayers.forEach(rl=>{
    if(names.has(rl.name)){
      rl.polyline.setStyle({color:'#ef4444', weight:6, opacity:1});
      rl.markers.forEach(m => m.getElement()?.classList?.remove('dimmed'));
      rl.label.getElement()?.classList?.remove('dimmed');
      highlightLayers.push(rl.polyline);
    }
  });
  if(highlightLayers.length) fitBoundsOfLayers(highlightLayers);
}

// ---------------- Search logic ----------------
function findRoutesBetween(fromName, toName){
  const fKey = norm(fromName), tKey = norm(toName);
  const fHits = stopIndex.get(fKey) || [];
  const tHits = stopIndex.get(tKey) || [];
  if(fHits.length===0 || tHits.length===0) return [];

  // Map of route->toIndices
  const toByRoute = new Map();
  tHits.forEach(h=>{
    if(!toByRoute.has(h.routeName)) toByRoute.set(h.routeName, []);
    toByRoute.get(h.routeName).push(h.index);
  });

  const matches = [];
  fHits.forEach(fh=>{
    const cand = toByRoute.get(fh.routeName);
    if(!cand) return;
    cand.forEach(toIdx=>{
      if(toIdx !== fh.index){
        const dir = (toIdx > fh.index) ? "→" : "←";
        matches.push({routeName: fh.routeName, fromIdx: fh.index, toIdx, dir});
      }
    });
  });
  return matches;
}

function renderResults(fromName, toName, matches){
  if(matches.length===0){
    resultsDiv.innerHTML = `<div class="result-card"><h3>No direct buses found</h3><p>Try nearby major stops or check spelling (autocomplete helps).</p></div>`;
    return;
  }
  // Group by route
  const byRoute = new Map();
  matches.forEach(m=>{
    if(!byRoute.has(m.routeName)) byRoute.set(m.routeName, []);
    byRoute.get(m.routeName).push(m);
  });

  let html = '';
  byRoute.forEach((arr, routeName)=>{
    const rl = routeLayers.find(r=>r.name===routeName);
    const color = rl?.color || '#666';
    const dirs = [...new Set(arr.map(a=>a.dir))].join(' / ');
    // show timings from dataset
    const routeData = routesData.routes.find(r => r.name === routeName);
    const timings = routeData?.timings ? routeData.timings.join(', ') : 'N/A';
    html += `<div class="result-card">
      <h3>${routeName} <span class="route-chip"><span class="route-color" style="background:${color}"></span>${routeName}</span></h3>
      <p><strong>${fromName}</strong> to <strong>${toName}</strong> • Direction: ${dirs}</p>
      <p><strong>Timings:</strong> ${timings}</p>
      <p><button data-route="${routeName}" class="show-route">Show & Highlight</button></p>
    </div>`;
  });

  resultsDiv.innerHTML = html;

  // attach click handlers
  document.querySelectorAll('.show-route').forEach(btn=>{
    btn.addEventListener('click', () => {
      const rn = btn.getAttribute('data-route');
      resetStyles();
      dimAll();
      highlightRoutesByName(new Set([rn]));
    });
  });
}

// ---------------- Form handlers ----------------
form.addEventListener('submit', e=>{
  e.preventDefault();
  const fromVal = fromInput.value.trim();
  const toVal = toInput.value.trim();
  if(!fromVal || !toVal){
    resultsDiv.innerHTML = `<div class="result-card"><p>Please enter both stops.</p></div>`;
    return;
  }
  resetStyles();
  dimAll();
  const matches = findRoutesBetween(fromVal, toVal);
  const names = new Set(matches.map(m=>m.routeName));
  if(names.size) highlightRoutesByName(names);
  renderResults(fromVal, toVal, matches);
});

resetBtn.addEventListener('click', ()=>{
  fromInput.value=''; toInput.value='';
  resultsDiv.innerHTML = `<p>Enter both From and To stops to find buses.</p>`;
  resetStyles();
});

// ---------------- Geolocation & weather (Open-Meteo, no key) ----------------
locBtn.addEventListener('click', ()=> {
  if(!navigator.geolocation){
    alert('Geolocation not supported');
    return;
  }
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    L.circle([lat, lon], {radius: 100, color:'#0a66c2'}).addTo(map);
    map.setView([lat, lon], 13);
    fetchWeather(lat, lon);
  }, err=>{
    alert('Unable to get your location: ' + err.message);
  });
});

function fetchWeather(lat, lon){
  // Open-Meteo current weather endpoint (no API key)
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
  weatherEl.textContent = '🌤️ Loading weather...';
  fetch(u)
    .then(r => r.json())
    .then(data=>{
      if(data && data.current_weather){
        const cw = data.current_weather;
        const temp = cw.temperature;
        const wcode = cw.weathercode; // could map codes -> text if desired
        weatherEl.textContent = `🌤️ ${temp}°C • wind ${cw.windspeed} km/h`;
      } else {
        weatherEl.textContent = '⚠️ Weather unavailable';
      }
    })
    .catch(()=>{
      weatherEl.textContent = '⚠️ Weather fetch failed';
    });
}

// ---------------- Clock ----------------
function updateClock(){ timeEl.textContent = '🕒 ' + new Date().toLocaleString(); }
setInterval(updateClock, 1000);
updateClock();

// ---------------- Initialize ----------------
buildIndexAndRender(routesData);

// Optionally request geolocation at load (commented out to avoid immediate prompt)
// if(navigator.geolocation){ navigator.geolocation.getCurrentPosition(p=>fetchWeather(p.coords.latitude, p.coords.longitude)); }
