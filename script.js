// Initialize map
const map = L.map("map").setView([22.57, 88.36], 12);

// Add OpenStreetMap tile layer
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let activeLayers = [];

// Function to highlight bus routes
function drawRoute(route) {
  // Clear old routes
  activeLayers.forEach(layer => map.removeLayer(layer));
  activeLayers = [];

  const latlngs = route.stops.map(s => s.coords);
  const polyline = L.polyline(latlngs, { color: "blue", weight: 5 }).addTo(map);
  activeLayers.push(polyline);

  // Add stop markers
  route.stops.forEach(stop => {
    const marker = L.marker(stop.coords).addTo(map).bindPopup(`<b>${stop.name}</b>`);
    activeLayers.push(marker);
  });

  map.fitBounds(polyline.getBounds());
}

// Search function
function findRoutes() {
  const from = document.getElementById("fromInput").value.trim().toLowerCase();
  const to = document.getElementById("toInput").value.trim().toLowerCase();
  const resultsDiv = document.getElementById("results");

  let foundRoutes = [];

  busRoutes.forEach(route => {
    const stopNames = route.stops.map(s => s.name.toLowerCase());
    if (stopNames.includes(from) && stopNames.includes(to)) {
      foundRoutes.push(route);
    }
  });

  if (foundRoutes.length === 0) {
    resultsDiv.innerHTML = "<p>No direct bus routes found.</p>";
  } else {
    resultsDiv.innerHTML = "<h3>Available Buses:</h3>";
    foundRoutes.forEach(route => {
      const btn = document.createElement("button");
      btn.innerText = `Bus ${route.number}`;
      btn.onclick = () => drawRoute(route);
      resultsDiv.appendChild(btn);
    });
  }
}
