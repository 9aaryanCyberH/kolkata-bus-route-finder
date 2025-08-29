// Initialize map
const map = L.map('map').setView([22.5726, 88.3639], 12); // Kolkata center

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

// Show current datetime
function updateDateTime() {
  document.getElementById("datetime").innerText = "🕒 " + new Date().toLocaleString();
}
setInterval(updateDateTime, 1000);
updateDateTime();

// Weather API (OpenWeatherMap - replace with your API key)
function getWeather(lat, lon) {
  const apiKey = "YOUR_API_KEY"; 
  fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("weather").innerText =
        `🌤️ ${data.name}: ${data.main.temp}°C, ${data.weather[0].description}`;
    })
    .catch(() => {
      document.getElementById("weather").innerText = "⚠️ Weather data unavailable";
    });
}

// Get geolocation
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(pos => {
    getWeather(pos.coords.latitude, pos.coords.longitude);
  });
}

// Find route
function findRoute() {
  const from = document.getElementById("from").value.trim();
  const to = document.getElementById("to").value.trim();
  const results = document.getElementById("results");
  results.innerHTML = "";

  let found = false;

  busRoutes.forEach(route => {
    if (route.stops.includes(from) && route.stops.includes(to)) {
      found = true;

      // Show info
      results.innerHTML += `<h3>Bus ${route.number}</h3>
        <p>Stops: ${route.stops.join(" → ")}</p>
        <p>Timings: ${route.timings.join(", ")}</p>`;

      // Highlight route on map
      const polyline = L.polyline(route.coordinates, {color: 'blue'}).addTo(map);
      map.fitBounds(polyline.getBounds());

      // Add stop markers
      route.coordinates.forEach((coord, i) => {
        L.marker(coord).addTo(map).bindPopup(route.stops[i]);
      });
    }
  });

  if (!found) {
    results.innerHTML = "<p>❌ No direct bus route found for this journey.</p>";
  }
}
