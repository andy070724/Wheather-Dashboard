const STORAGE_KEY = 'weather_dashboard_history';
let unit = 'metric'; // metric = C + km/h, imperial = F + mph
let currentData = null;
let tempChartInstance = null;
let currentCoords = null;
let currentPlaceName = null;

const weatherCodeMap = {
  0:{desc:'Clear sky', icon:'☀️'},
  1:{desc:'Mainly clear', icon:'🌤️'},
  2:{desc:'Partly cloudy', icon:'⛅'},
  3:{desc:'Overcast', icon:'☁️'},
  45:{desc:'Fog', icon:'🌫️'},
  48:{desc:'Depositing rime fog', icon:'🌫️'},
  51:{desc:'Light drizzle', icon:'🌦️'},
  53:{desc:'Drizzle', icon:'🌦️'},
  55:{desc:'Dense drizzle', icon:'🌧️'},
  61:{desc:'Slight rain', icon:'🌧️'},
  63:{desc:'Rain', icon:'🌧️'},
  65:{desc:'Heavy rain', icon:'🌧️'},
  71:{desc:'Slight snow', icon:'🌨️'},
  73:{desc:'Snow', icon:'🌨️'},
  75:{desc:'Heavy snow', icon:'❄️'},
  80:{desc:'Rain showers', icon:'🌦️'},
  81:{desc:'Rain showers', icon:'🌧️'},
  82:{desc:'Violent showers', icon:'⛈️'},
  95:{desc:'Thunderstorm', icon:'⛈️'},
  96:{desc:'Thunderstorm + hail', icon:'⛈️'},
  99:{desc:'Thunderstorm + hail', icon:'⛈️'}
};

function getWeatherInfo(code){
  return weatherCodeMap[code] || {desc:'Unknown', icon:'❓'};
}

function getHistory(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveHistory(entry){
  try{
    let hist = getHistory().filter(h => h.name.toLowerCase() !== entry.name.toLowerCase());
    hist.unshift(entry);
    hist = hist.slice(0,6);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hist));
  }catch(e){}
}
function renderHistoryDropdown(){
  const hist = getHistory();
  const el = document.getElementById('historyDropdown');
  if(hist.length===0){ el.classList.remove('show'); return; }
  el.innerHTML = hist.map(h => `<div class="history-item" data-lat="${h.lat}" data-lon="${h.lon}" data-name="${h.name.replace(/"/g,'&quot;')}">
    <span>${h.name}</span><span style="color:rgba(255,255,255,.5);font-size:12px;">recent</span>
  </div>`).join('');
}

function setBackgroundTheme(weatherCode, isDay){
  let g1,g2;
  if(!isDay){
    g1 = '#0f2027'; g2 = '#203a43';
  } else if([0,1].includes(weatherCode)){
    g1 = '#4facfe'; g2 = '#00c4ff';
  } else if([2,3,45,48].includes(weatherCode)){
    g1 = '#757f9a'; g2 = '#d7dde8';
  } else if([51,53,55,61,63,65,80,81,82].includes(weatherCode)){
    g1 = '#3a6073'; g2 = '#16222a';
  } else if([71,73,75].includes(weatherCode)){
    g1 = '#83a4d4'; g2 = '#b6fbff';
  } else if([95,96,99].includes(weatherCode)){
    g1 = '#232526'; g2 = '#414345';
  } else {
    g1 = '#4facfe'; g2 = '#00c4ff';
  }
  document.documentElement.style.setProperty('--bg1', g1);
  document.documentElement.style.setProperty('--bg2', g2);
}

function toF(c){ return c*9/5+32; }
function toMph(kmh){ return kmh*0.621371; }

function showSkeletons(){
  document.getElementById('currentArea').innerHTML = '<div class="card"><div class="skeleton sk-current"></div></div>';
  document.getElementById('forecastCard').style.display='none';
  document.getElementById('forecastSkeleton').style.display='block';
  document.getElementById('chartCard').style.display='none';
  document.getElementById('chartSkeleton').style.display='block';
  document.getElementById('gaugeCard').style.display='none';
  document.getElementById('errorArea').innerHTML='';
}

function showError(msg){
  document.getElementById('errorArea').innerHTML = `<div class="card error-box">${msg}</div>`;
  document.getElementById('currentArea').innerHTML = '';
  document.getElementById('forecastSkeleton').style.display='none';
  document.getElementById('chartSkeleton').style.display='none';
}

async function geocodeCity(name){
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Geocoding request failed');
  const data = await res.json();
  if(!data.results || data.results.length===0) throw new Error('City not found');
  const r = data.results[0];
  return { lat:r.latitude, lon:r.longitude, name: r.name + (r.admin1 ? ', '+r.admin1 : '') + (r.country ? ', '+r.country : '') };
}

async function reverseGeocode(lat, lon){
  try{
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    if(data.results && data.results.length>0){
      const r = data.results[0];
      return r.name + (r.admin1 ? ', '+r.admin1 : '');
    }
  }catch(e){}
  return `Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}`;
}

async function fetchWeatherBundle(lat, lon){
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,uv_index` +
    `&hourly=temperature_2m,weather_code,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max` +
    `&forecast_days=6&timezone=auto`;
  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`;

  const [weatherRes, airRes] = await Promise.all([
    fetch(weatherUrl),
    fetch(airUrl).catch(()=>null)
  ]);
  if(!weatherRes.ok) throw new Error('Weather request failed');
  const weatherData = await weatherRes.json();
  let airData = null;
  if(airRes && airRes.ok){
    try{ airData = await airRes.json(); }catch(e){}
  }
  return { weatherData, airData };
}

function renderCurrent(weatherData, placeName){
  const c = weatherData.current;
  const info = getWeatherInfo(c.weather_code);
  const isDay = c.is_day === 1;
  setBackgroundTheme(c.weather_code, isDay);

  const temp = unit==='metric' ? Math.round(c.temperature_2m) : Math.round(toF(c.temperature_2m));
  const feels = unit==='metric' ? Math.round(c.apparent_temperature) : Math.round(toF(c.apparent_temperature));
  const wind = unit==='metric' ? Math.round(c.wind_speed_10m) : Math.round(toMph(c.wind_speed_10m));
  const tUnit = unit==='metric' ? '°C' : '°F';
  const wUnit = unit==='metric' ? 'km/h' : 'mph';

  document.getElementById('currentArea').innerHTML = `
    <div class="card">
      <div class="current">
        <div class="current-left">
          <div class="icon" aria-hidden="true">${info.icon}</div>
          <div>
            <p class="place">${placeName}</p>
            <p class="desc">${info.desc} · ${isDay ? 'Day' : 'Night'}</p>
            <p class="feels">Feels like ${feels}${tUnit}</p>
          </div>
        </div>
        <div class="temp-big">${temp}${tUnit}</div>
      </div>
      <div class="stats-row">
        <div class="stat-tile"><div class="val">${Math.round(c.relative_humidity_2m)}%</div><div class="lab">Humidity</div></div>
        <div class="stat-tile"><div class="val">${wind} ${wUnit}</div><div class="lab">Wind</div></div>
        <div class="stat-tile"><div class="val">${c.uv_index != null ? Math.round(c.uv_index) : '–'}</div><div class="lab">UV index</div></div>
      </div>
    </div>
  `;
}

function renderForecast(weatherData){
  const daily = weatherData.daily;
  const days = daily.time.slice(0,5);
  const grid = days.map((dateStr, i) => {
    const info = getWeatherInfo(daily.weather_code[i]);
    const hi = unit==='metric' ? Math.round(daily.temperature_2m_max[i]) : Math.round(toF(daily.temperature_2m_max[i]));
    const lo = unit==='metric' ? Math.round(daily.temperature_2m_min[i]) : Math.round(toF(daily.temperature_2m_min[i]));
    const d = new Date(dateStr + 'T00:00:00');
    const dayLabel = i===0 ? 'Today' : d.toLocaleDateString(undefined,{weekday:'short'});
    return `<div class="fcard">
      <div class="day">${dayLabel}</div>
      <div class="ficon" aria-hidden="true">${info.icon}</div>
      <div class="hi">${hi}°</div>
      <div class="lo">${lo}°</div>
    </div>`;
  }).join('');
  document.getElementById('forecastGrid').innerHTML = grid;
  document.getElementById('forecastSkeleton').style.display='none';
  document.getElementById('forecastCard').style.display='block';
}

function renderChart(weatherData){
  const hourly = weatherData.hourly;
  const now = new Date();
  const nowIdx = hourly.time.findIndex(t => new Date(t) >= now);
  const startIdx = Math.max(0, nowIdx);
  const labels = hourly.time.slice(startIdx, startIdx+24).map(t => {
    const d = new Date(t);
    return d.toLocaleTimeString(undefined,{hour:'numeric'});
  });
  const temps = hourly.temperature_2m.slice(startIdx, startIdx+24).map(t => unit==='metric' ? Math.round(t*10)/10 : Math.round(toF(t)*10)/10);

  const ctx = document.getElementById('tempChart');
  if(tempChartInstance){ tempChartInstance.destroy(); }
  tempChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Temperature',
        data: temps,
        borderColor: '#ffffff',
        backgroundColor: 'rgba(255,255,255,0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,0.75)', maxTicksLimit: 8 }, grid: { display:false } },
        y: { ticks: { color: 'rgba(255,255,255,0.75)' }, grid: { color: 'rgba(255,255,255,0.12)' } }
      }
    }
  });
  document.getElementById('chartSkeleton').style.display='none';
  document.getElementById('chartCard').style.display='block';
}

function radialGaugeSVG(pct, colorStroke){
  const r = 40, c = 2*Math.PI*r;
  const offset = c - (Math.min(Math.max(pct,0),100)/100)*c;
  return `<svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="8"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="${colorStroke}" stroke-width="8"
      stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"
      transform="rotate(-90 50 50)"/>
  </svg>`;
}

function renderGauges(weatherData, airData){
  const c = weatherData.current;
  const humidity = Math.round(c.relative_humidity_2m);
  const uv = c.uv_index != null ? Math.round(c.uv_index) : 0;
  const uvPct = Math.min(uv/11*100, 100);
  const windKmh = c.wind_speed_10m;
  const windPct = Math.min(windKmh/80*100, 100);
  const windDisplay = unit==='metric' ? Math.round(windKmh)+' km/h' : Math.round(toMph(windKmh))+' mph';
  const aqi = airData && airData.current ? airData.current.us_aqi : null;

  let html = `
    <div class="gauge">
      ${radialGaugeSVG(humidity, '#4facfe')}
      <div class="g-val">${humidity}%</div>
      <div class="g-lab">Humidity</div>
    </div>
    <div class="gauge">
      ${radialGaugeSVG(uvPct, '#fab219')}
      <div class="g-val">${uv}</div>
      <div class="g-lab">UV index</div>
    </div>
    <div class="gauge">
      ${radialGaugeSVG(windPct, '#1baf7a')}
      <div class="g-val">${windDisplay}</div>
      <div class="g-lab">Wind speed</div>
    </div>
  `;
  if(aqi != null){
    const aqiPct = Math.min(aqi/300*100,100);
    html += `
    <div class="gauge">
      ${radialGaugeSVG(aqiPct, '#e34948')}
      <div class="g-val">${aqi}</div>
      <div class="g-lab">Air quality (US AQI)</div>
    </div>`;
  }
  document.getElementById('gaugesArea').innerHTML = html;
  document.getElementById('gaugeCard').style.display='block';
}

async function loadWeather(lat, lon, name){
  showSkeletons();
  try{
    currentCoords = {lat, lon};
    currentPlaceName = name;
    const { weatherData, airData } = await fetchWeatherBundle(lat, lon);
    currentData = weatherData;
    renderCurrent(weatherData, name);
    renderForecast(weatherData);
    renderChart(weatherData);
    renderGauges(weatherData, airData);
    saveHistory({ name, lat, lon });
    renderHistoryDropdown();
  }catch(err){
    showError(`Couldn't load weather data. ${err.message || 'Please try again.'}`);
  }
}

async function handleSearch(query){
  if(!query || !query.trim()) return;
  showSkeletons();
  try{
    const place = await geocodeCity(query.trim());
    await loadWeather(place.lat, place.lon, place.name);
  }catch(err){
    showError(`Couldn't find "${query}". Try a different city name.`);
  }
}

function refreshAllDisplays(){
  if(!currentData) return;
  renderCurrent(currentData, currentPlaceName);
  renderForecast(currentData);
  renderChart(currentData);
  fetchWeatherBundle(currentCoords.lat, currentCoords.lon).then(({airData})=>{
    renderGauges(currentData, airData);
  }).catch(()=>{ renderGauges(currentData, null); });
}

function initApp(){
  document.getElementById('searchInput').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      handleSearch(e.target.value);
      document.getElementById('historyDropdown').classList.remove('show');
    }
  });
  document.getElementById('searchInput').addEventListener('focus', ()=>{
    renderHistoryDropdown();
    if(getHistory().length>0) document.getElementById('historyDropdown').classList.add('show');
  });
  document.addEventListener('click', (e)=>{
    if(!e.target.closest('.search-wrap')){
      document.getElementById('historyDropdown').classList.remove('show');
    }
  });
  document.getElementById('historyDropdown').addEventListener('click', (e)=>{
    const item = e.target.closest('.history-item');
    if(item){
      const lat = parseFloat(item.dataset.lat);
      const lon = parseFloat(item.dataset.lon);
      const name = item.dataset.name;
      document.getElementById('searchInput').value = name;
      document.getElementById('historyDropdown').classList.remove('show');
      loadWeather(lat, lon, name);
    }
  });

  document.getElementById('geoBtn').addEventListener('click', ()=>{
    if(!navigator.geolocation){
      showError('Geolocation is not supported by your browser.');
      return;
    }
    showSkeletons();
    navigator.geolocation.getCurrentPosition(async (pos)=>{
      const { latitude, longitude } = pos.coords;
      const name = await reverseGeocode(latitude, longitude);
      loadWeather(latitude, longitude, name);
    }, ()=>{
      showError('Location access denied or unavailable. Try searching for a city instead.');
    }, { timeout: 8000 });
  });

  document.getElementById('unitToggle').addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    unit = btn.dataset.unit;
    document.querySelectorAll('#unitToggle button').forEach(b=>b.classList.toggle('active', b===btn));
    refreshAllDisplays();
  });

  renderHistoryDropdown();
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(async (pos)=>{
      const { latitude, longitude } = pos.coords;
      const name = await reverseGeocode(latitude, longitude);
      loadWeather(latitude, longitude, name);
    }, ()=>{
      loadWeather(51.5074, -0.1278, 'London, England');
    }, { timeout: 6000 });
  } else {
    loadWeather(51.5074, -0.1278, 'London, England');
  }
}

document.addEventListener('DOMContentLoaded', initApp);
