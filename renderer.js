const UserManager = {
  key: 'pomodoro_users',
  get() { try { return JSON.parse(localStorage.getItem(this.key)) || { users: {}, current: null } } catch (e) { return { users: {}, current: null } } },
  save(d) { localStorage.setItem(this.key, JSON.stringify(d)) },
  login(user, pass) {
    const d = this.get();
    if (d.users[user] && d.users[user].password === pass) { d.current = user; this.save(d); return true; }
    return false;
  },
  register(user, pass) {
    const d = this.get();
    if (d.users[user]) return false;
    d.users[user] = { password: pass, created: new Date().toISOString() };
    d.current = user; this.save(d); return true;
  },
  logout() { const d = this.get(); d.current = null; this.save(d); },
  current() { return this.get().current; },
  exists() { const d = this.get(); return Object.keys(d.users).length > 0; },
};

const StatsManager = {
  key(u) { return `pomodoro_data_${u}` },
  get(u) { try { return JSON.parse(localStorage.getItem(this.key(u))) || { sessions: [] } } catch (e) { return { sessions: [] } } },
  save(u, d) { localStorage.setItem(this.key(u), JSON.stringify(d)) },
  record(u, seconds) {
    const d = this.get(u); const today = new Date().toDateString();
    const existing = d.sessions.find(s => s.date === today);
    if (existing) { existing.totalSeconds += seconds; existing.count++; }
    else { d.sessions.push({ date: today, totalSeconds: seconds, count: 1 }); }
    this.save(u, d);
  },
  getDay(u, dateStr) {
    const d = this.get(u); const s = d.sessions.find(s => s.date === dateStr);
    return s || { totalSeconds: 0, count: 0 };
  },
  getWeek(u) {
    const days = []; const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(now); dt.setDate(dt.getDate() - i);
      const ds = dt.toDateString(); const s = this.getDay(u, ds);
      days.push({ date: ds, dayName: ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][dt.getDay()], totalSeconds: s.totalSeconds, count: s.count, isToday: i === 0 });
    }
    return days;
  },
  getMonth(u) {
    const d = this.get(u); const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    return d.sessions.filter(s => s.date.startsWith(ym));
  },
  getStreak(u) {
    const d = this.get(u); let streak = 0; const now = new Date();
    for (let i = 0; i < 365; i++) {
      const dt = new Date(now); dt.setDate(dt.getDate() - i);
      const s = d.sessions.find(s => s.date === dt.toDateString());
      if (s && s.totalSeconds > 0) streak++; else if (i > 0) break;
    }
    return streak;
  }
};

const SoundEngine = {
  ctx: null, masterGain: null, currentNodes: [], activeType: 'none',
  initialized: false, volume: 0.4,
  chirpTimer: null, cricketsTimer: null, fireTimer: null,
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {}
  },
  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); },
  setVolume(val) { this.volume = val; if (this.masterGain) this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1); },
  noiseBuffer(dur = 2) {
    const sr = this.ctx.sampleRate, len = sr * dur;
    const buf = this.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return buf;
  },
  stop() {
    if (this.chirpTimer) { clearInterval(this.chirpTimer); this.chirpTimer = null; }
    if (this.cricketsTimer) { clearInterval(this.cricketsTimer); this.cricketsTimer = null; }
    if (this.fireTimer) { clearInterval(this.fireTimer); this.fireTimer = null; }
    this.currentNodes.forEach(n => { try { n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
    this.currentNodes = [];
  },
  startRain() {
    this.stop(); this.activeType = 'rain'; const ctx = this.ctx;
    const l = (f, q, gv) => { const s = ctx.createBufferSource(); s.buffer = this.noiseBuffer(4); s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = gv; s.connect(fl); fl.connect(g); g.connect(this.masterGain); s.start(); return [s, fl, g]; };
    const l1 = l(800, 0.5, 0.6), l2 = l(2500, 0.3, 0.35), l3 = l(1200, 1, 0.25);
    const mod = ctx.createOscillator(); mod.frequency.value = 0.15; mod.type = 'sine'; const mg = ctx.createGain(); mg.gain.value = 0.15; mod.connect(mg); mg.connect(l1[2].gain); mod.start();
    this.currentNodes = [...l1, ...l2, ...l3, mod, mg];
  },
  startOcean() {
    this.stop(); this.activeType = 'ocean'; const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuffer(4); s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 0.8; const g = ctx.createGain(); g.gain.value = 0.6; s.connect(f); f.connect(g); g.connect(this.masterGain); s.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08; lfo.type = 'sine'; const lg = ctx.createGain(); lg.gain.value = 0.3; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    this.currentNodes = [s, f, g, lfo, lg];
  },
  startForest() {
    this.stop(); this.activeType = 'forest'; const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuffer(4); s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.3; const g = ctx.createGain(); g.gain.value = 0.25; s.connect(f); f.connect(g); g.connect(this.masterGain); s.start();
    const mod = ctx.createOscillator(); mod.frequency.value = 0.2; mod.type = 'sine'; const mg = ctx.createGain(); mg.gain.value = 0.15; mod.connect(mg); mg.connect(f.frequency); mod.start();
    this.currentNodes = [s, f, g, mod, mg];
    this.chirpTimer = setInterval(() => {
      if (this.activeType !== 'forest') return; const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(2000 + Math.random() * 1500, t); o.frequency.exponentialRampToValueAtTime(3000 + Math.random() * 1000, t + 0.08); const gg = ctx.createGain(); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.12, t + 0.02); gg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(gg); gg.connect(this.masterGain); o.start(t); o.stop(t + 0.3); this.currentNodes.push(o, gg);
    }, 4000 + Math.random() * 6000);
  },
  startWind() {
    this.stop(); this.activeType = 'wind'; const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuffer(4); s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 0.4; const g = ctx.createGain(); g.gain.value = 0.4; s.connect(f); f.connect(g); g.connect(this.masterGain); s.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.3; lfo.type = 'sine'; const lg = ctx.createGain(); lg.gain.value = 0.4; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.05; lfo2.type = 'sine'; const lg2 = ctx.createGain(); lg2.gain.value = 200; lfo2.connect(lg2); lg2.connect(f.frequency); lfo2.start();
    this.currentNodes = [s, f, g, lfo, lg, lfo2, lg2];
  },
  startFire() {
    this.stop(); this.activeType = 'fire'; const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuffer(4); s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 0.6; const g = ctx.createGain(); g.gain.value = 0.5; s.connect(f); f.connect(g); g.connect(this.masterGain); s.start();
    const mod = ctx.createOscillator(); mod.frequency.value = 0.5; mod.type = 'sawtooth'; const mg = ctx.createGain(); mg.gain.value = 0.3; mod.connect(mg); mg.connect(g.gain); mod.start();
    this.currentNodes = [s, f, g, mod, mg];
    this.fireTimer = setInterval(() => {
      if (this.activeType !== 'fire') return; const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60 + Math.random() * 40; const gg = ctx.createGain(); const dur = 0.04 + Math.random() * 0.08; gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.08, t + 0.01); gg.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(gg); gg.connect(this.masterGain); o.start(t); o.stop(t + dur); this.currentNodes.push(o, gg);
    }, 100 + Math.random() * 300);
  },
  startCrickets() {
    this.stop(); this.activeType = 'crickets'; const ctx = this.ctx;
    this.cricketsTimer = setInterval(() => {
      if (this.activeType !== 'crickets') return; const t = ctx.currentTime; const freq = 4000 + Math.random() * 2000;
      for (let i = 0; i < 3 + Math.random() * 4; i++) { const o = ctx.createOscillator(); o.type = 'sine'; const off = i * (0.03 + Math.random() * 0.02); o.frequency.setValueAtTime(freq, t + off); o.frequency.setValueAtTime(freq + 100, t + off + 0.02); const gg = ctx.createGain(); gg.gain.setValueAtTime(0, t + off); gg.gain.linearRampToValueAtTime(0.06, t + off + 0.005); gg.gain.exponentialRampToValueAtTime(0.001, t + off + 0.1); o.connect(gg); gg.connect(this.masterGain); o.start(t + off); o.stop(t + off + 0.12); this.currentNodes.push(o, gg); }
    }, 600 + Math.random() * 1200);
  },
  startStream() {
    this.stop(); this.activeType = 'stream'; const ctx = this.ctx;
    const l = (f, q, gv) => { const s = ctx.createBufferSource(); s.buffer = this.noiseBuffer(4); s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = gv; s.connect(fl); fl.connect(g); g.connect(this.masterGain); s.start(); return [s, fl, g]; };
    const l1 = l(600, 0.5, 0.5), l2 = l(1500, 0.3, 0.2), l3 = l(3000, 0.2, 0.1);
    const mod = ctx.createOscillator(); mod.frequency.value = 0.2; mod.type = 'sine'; const mg = ctx.createGain(); mg.gain.value = 0.3; mod.connect(mg); mg.connect(l1[2].gain); mod.start();
    const mod2 = ctx.createOscillator(); mod2.frequency.value = 0.08; mod2.type = 'sine'; const mg2 = ctx.createGain(); mg2.gain.value = 200; mod2.connect(mg2); mg2.connect(l1[1].frequency); mod2.start();
    this.currentNodes = [...l1, ...l2, ...l3, mod, mg, mod2, mg2];
  },
  play(type) {
    this.init(); this.resume(); this.stop();
    if (type === 'none') { this.activeType = 'none'; return; }
    const m = { rain: 'startRain', ocean: 'startOcean', forest: 'startForest', wind: 'startWind', fire: 'startFire', crickets: 'startCrickets', stream: 'startStream' };
    if (m[type]) this[m[type]]();
  },
  playNotification() {
    if (!this.ctx) return; this.resume(); const t = this.ctx.currentTime;
    [523, 659, 784].forEach((f, i) => { const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t + i * 0.2); g.gain.linearRampToValueAtTime(0.15, t + i * 0.2 + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.3); o.connect(g); g.connect(this.masterGain || this.ctx.destination); o.start(t + i * 0.2); o.stop(t + i * 0.2 + 0.3); });
  }
};

const state = {
  mode: 'idle', studyMinutes: 25, breakMinutes: 5, totalSessions: 4,
  currentSession: 1, timeRemaining: 0, totalTime: 0,
  isRunning: false, timerInterval: null, soundType: 'none',
};

const els = {};
const $ = id => document.getElementById(id);
['timer-minutes','timer-seconds','timer-display','status-badge','status-icon','status-text',
'session-label','session-count','stats-count','btn-primary','btn-secondary','btn-exit',
'volume-slider','settings-toggle','settings-panel','study-duration','break-duration',
'session-count-setting','bg-image-btn','bg-remove-btn',
'password-overlay','password-input','password-submit','password-cancel','password-error',
'bg-layer','confetti-canvas','tb-minimize','tb-close','titlebar','titlebar-text','sound-viz','vol-pct',
'login-overlay','login-username','login-password','login-btn','register-btn','login-error','register-error',
'stats-overlay','stats-close','btn-stats','btn-user','user-btn-name','settings-logout',
'week-chart','st-today-min','st-today-session','st-streak','st-month-min','st-month-session','st-avg']
.forEach(id => els[id.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())] = $(id));
els.soundBtns = document.querySelectorAll('.sound-btn');
els.adjBtns = document.querySelectorAll('.adj-btn');
els.vizBars = document.querySelectorAll('.viz-bar');

function fmt(sec) { return { m: String(Math.floor(sec / 60)).padStart(2, '0'), s: String(sec % 60).padStart(2, '0') }; }

function updateDisplay() {
  const { m, s } = fmt(state.timeRemaining);
  if (els.timerMinutes.textContent !== m) els.timerMinutes.textContent = m;
  if (els.timerSeconds.textContent !== s) els.timerSeconds.textContent = s;
}

function updateStatsDisplay() {
  const user = UserManager.current(); if (!user) return;
  try {
    const d = JSON.parse(localStorage.getItem('pomodoro_stats') || '{}');
    els.statsCount.textContent = d[new Date().toDateString()] || 0;
  } catch (e) {}
}

function incrementStats() {
  try {
    const d = JSON.parse(localStorage.getItem('pomodoro_stats') || '{}');
    const k = new Date().toDateString(); d[k] = (d[k] || 0) + 1;
    localStorage.setItem('pomodoro_stats', JSON.stringify(d));
    updateStatsDisplay();
  } catch (e) {}
}

function renderWeekChart() {
  const user = UserManager.current(); if (!user) return;
  const week = StatsManager.getWeek(user);
  const maxSec = Math.max(...week.map(d => d.totalSeconds), 1);
  els.weekChart.innerHTML = '';
  week.forEach(d => {
    const pct = (d.totalSeconds / maxSec) * 100;
    const col = document.createElement('div'); col.className = 'chart-col';
    col.innerHTML = `
      <span class="chart-val">${Math.round(d.totalSeconds / 60)}</span>
      <div class="chart-bar-wrap"><div class="chart-bar${d.isToday ? ' today' : ''}" style="height:${Math.max(pct, 1)}%"></div></div>
      <span class="chart-label">${d.dayName}</span>
    `;
    els.weekChart.appendChild(col);
  });
}

function showStats() {
  const user = UserManager.current(); if (!user) return;
  const today = StatsManager.getDay(user, new Date().toDateString());
  const week = StatsManager.getWeek(user);
  const month = StatsManager.getMonth(user);
  const streak = StatsManager.getStreak(user);
  const monthTotalSec = month.reduce((a, s) => a + s.totalSeconds, 0);
  const monthCount = month.reduce((a, s) => a + s.count, 0);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const avgDaily = daysInMonth > 0 ? Math.round(monthTotalSec / 60 / daysInMonth) : 0;

  els.stTodayMin.textContent = Math.round(today.totalSeconds / 60);
  els.stTodaySession.textContent = today.count;
  els.stStreak.textContent = streak;
  els.stMonthMin.textContent = Math.round(monthTotalSec / 60);
  els.stMonthSession.textContent = monthCount;
  els.stAvg.textContent = avgDaily;
  renderWeekChart();
  els.statsOverlay.classList.remove('hidden');
}

function updateUI() {
  const { mode, currentSession: cs, totalSessions: ts } = state;
  if (mode === 'study') {
    els.statusBadge.className = 'study';
    els.statusIcon.textContent = '\u{1F4D6}'; els.statusText.textContent = 'Ders';
    els.sessionLabel.textContent = 'Ders Süresi'; els.sessionCount.textContent = `${cs}. Oturum / ${ts}`;
    els.timerDisplay.className = 'study-time';
    els.btnPrimary.textContent = state.isRunning ? 'Durdur' : 'Devam'; els.btnPrimary.className = 'btn-main running';
  } else if (mode === 'break') {
    els.statusBadge.className = 'break';
    els.statusIcon.textContent = '\u{1F334}'; els.statusText.textContent = 'Mola';
    els.sessionLabel.textContent = 'Mola Süresi'; els.sessionCount.textContent = `${cs}. Oturum aras\u0131`;
    els.timerDisplay.className = 'break-time';
    els.btnPrimary.textContent = state.isRunning ? 'Durdur' : 'Devam'; els.btnPrimary.className = 'btn-main break-mode';
  } else {
    els.statusBadge.className = '';
    els.statusIcon.textContent = '\u26B9'; els.statusText.textContent = 'Haz\u0131r';
    els.sessionLabel.textContent = 'Ders S\u00FCresi'; els.sessionCount.textContent = `${cs}. Oturum / ${ts}`;
    els.timerDisplay.className = ''; els.btnPrimary.textContent = 'Ba\u015Flat'; els.btnPrimary.className = 'btn-main';
  }
  els.btnSecondary.disabled = !state.isRunning && state.mode === 'idle';
}

function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  if (state.mode === 'idle') {
    state.mode = 'study'; state.currentSession = 1;
    state.totalTime = state.studyMinutes * 60; state.timeRemaining = state.totalTime;
    window.electronAPI.setMode('study');
    if (state.soundType !== 'none') SoundEngine.play(state.soundType);
  }
  state.isRunning = true; updateUI();
  state.timerInterval = setInterval(() => {
    state.timeRemaining--; updateDisplay();
    if (state.timeRemaining <= 0) {
      clearInterval(state.timerInterval); state.timerInterval = null;
      state.isRunning = false; handleTimerEnd();
    }
  }, 1000);
}

function pauseTimer() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
  state.isRunning = false; updateUI();
}

function startConfetti() {
  const c = els.confettiCanvas; if (!c) return;
  const ctx = c.getContext('2d'); c.width = window.innerWidth; c.height = window.innerHeight;
  c.classList.remove('hidden');
  const colors = ['#ff7675','#74b9ff','#a29bfe','#55efc4','#ffeaa7','#fd79a8','#fab1a0','#81ecec'];
  const p = []; for (let i = 0; i < 180; i++) p.push({ x: Math.random() * c.width, y: Math.random() * -c.height, w: 4 + Math.random() * 6, h: 7 + Math.random() * 7, c: colors[Math.random() * colors.length | 0], vx: (Math.random() - 0.5) * 3, vy: 1.5 + Math.random() * 3, r: Math.random() * 360, rs: (Math.random() - 0.5) * 12 });
  let f = 0;
  function anim() {
    ctx.clearRect(0, 0, c.width, c.height);
    p.forEach(p => { p.x += p.vx; p.y += p.vy; p.r += p.rs; p.vy += 0.04; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r * Math.PI / 180); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, Math.min(1, 1 - f / 350)); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); });
    if (++f < 350) requestAnimationFrame(anim); else { c.classList.add('hidden'); ctx.clearRect(0, 0, c.width, c.height); }
  }
  anim();
}

function handleTimerEnd() {
  SoundEngine.playNotification();
  const user = UserManager.current();
  if (state.mode === 'study') {
    incrementStats();
    if (user) StatsManager.record(user, state.studyMinutes * 60);
    window.electronAPI.showNotification('Ders Bitti!', 'Mola zaman\u0131!');
    state.mode = 'break'; state.totalTime = state.breakMinutes * 60; state.timeRemaining = state.totalTime;
    window.electronAPI.setMode('break'); window.electronAPI.exitFullscreen();
    if (state.soundType !== 'none') SoundEngine.play(state.soundType);
    updateUI(); updateDisplay(); startTimer();
  } else if (state.mode === 'break') {
    if (state.currentSession < state.totalSessions) {
      state.currentSession++;
      window.electronAPI.showNotification('Mola Bitti!', `${state.currentSession}. oturum başlıyor!`);
      state.mode = 'study'; state.totalTime = state.studyMinutes * 60; state.timeRemaining = state.totalTime;
      window.electronAPI.setMode('study'); window.electronAPI.focusWindow();
      if (state.soundType !== 'none') SoundEngine.play(state.soundType);
      updateUI(); updateDisplay(); startTimer();
    } else {
      SoundEngine.stop(); startConfetti();
      window.electronAPI.showNotification('Tebrikler!', 'T\u00FCm oturumlar tamamland\u0131!');
      state.mode = 'idle'; state.currentSession = 1;
      state.totalTime = state.studyMinutes * 60; state.timeRemaining = state.totalTime;
      window.electronAPI.setMode('idle'); updateUI(); updateDisplay();
    }
  }
}

function resetTimer() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
  state.isRunning = false;
  if (state.mode === 'study') { state.totalTime = state.studyMinutes * 60; state.timeRemaining = state.totalTime; }
  else if (state.mode === 'break') { state.totalTime = state.breakMinutes * 60; state.timeRemaining = state.totalTime; }
  else { state.totalTime = state.studyMinutes * 60; state.timeRemaining = state.totalTime; }
  updateUI(); updateDisplay();
}

function toggleTimer() {
  SoundEngine.init(); SoundEngine.resume();
  if (state.mode !== 'idle' && state.isRunning) pauseTimer(); else startTimer();
}

function setSound(type) {
  state.soundType = type;
  els.soundBtns.forEach(b => b.classList.toggle('active', b.dataset.sound === type));
  if (state.mode === 'study' || state.mode === 'break') SoundEngine.play(type);
  updateVisualizer(type !== 'none');
}

let vizInterval = null;
function updateVisualizer(active) {
  if (vizInterval) { clearInterval(vizInterval); vizInterval = null; }
  els.vizBars.forEach(b => { b.style.height = '3px'; b.classList.toggle('active', false); });
  if (active) {
    els.vizBars.forEach(b => b.classList.add('active'));
    vizInterval = setInterval(() => { els.vizBars.forEach((b, i) => { b.style.height = (3 + Math.random() * 14) + 'px'; }); }, 200);
  }
}

function showPassword() {
  els.passwordOverlay.classList.remove('hidden');
  els.passwordInput.value = ''; els.passwordError.classList.add('hidden');
  setTimeout(() => els.passwordInput.focus(), 100);
}

function loadSettings() {
  const user = UserManager.current(); if (!user) return;
  try {
    const s = JSON.parse(localStorage.getItem(`pomodoro_settings_${user}`) || '{}');
    if (s.studyMinutes) { state.studyMinutes = s.studyMinutes; els.studyDuration.textContent = s.studyMinutes; }
    if (s.breakMinutes) { state.breakMinutes = s.breakMinutes; els.breakDuration.textContent = s.breakMinutes; }
    if (s.totalSessions) { state.totalSessions = s.totalSessions; els.sessionCountSetting.textContent = s.totalSessions; }
    if (s.soundType) setSound(s.soundType);
    if (s.volume !== undefined) { els.volumeSlider.value = s.volume; SoundEngine.setVolume(s.volume / 100); els.volPct.textContent = s.volume + '%'; }
    if (s.bgImage) els.bgLayer.style.backgroundImage = `url(${s.bgImage})`;
  } catch (e) {}
  state.totalTime = state.studyMinutes * 60; state.timeRemaining = state.totalTime;
  updateDisplay(); updateUI(); updateStatsDisplay();
}

function saveSettings() {
  const user = UserManager.current(); if (!user) return;
  localStorage.setItem(`pomodoro_settings_${user}`, JSON.stringify({
    studyMinutes: state.studyMinutes, breakMinutes: state.breakMinutes,
    totalSessions: state.totalSessions, soundType: state.soundType,
    volume: parseInt(els.volumeSlider.value),
    bgImage: els.bgLayer.style.backgroundImage.replace(/^url\(['"](.+)['"]\)$/, '$1') || '',
  }));
}

function showApp() {
  els.loginOverlay.style.display = 'none';
  const user = UserManager.current();
  els.userBtnName.textContent = user;
  els.titlebarText.textContent = `Pomodoro Focus - ${user}`;
  loadSettings();
}

function initLogin() {
  const current = UserManager.current();
  if (current) { showApp(); return; }
  if (UserManager.exists()) {
    els.loginSubtitle.textContent = 'Hesabına giriş yap';
    els.loginBtn.textContent = 'Giriş Yap';
    els.registerBtn.style.display = 'block';
    els.registerBtn.textContent = 'Hesap Oluştur';
  } else {
    els.loginSubtitle.textContent = 'Hoş geldin! Hesap oluştur';
    els.loginBtn.textContent = 'Hesap Oluştur';
    els.registerBtn.style.display = 'none';
  }
  els.loginOverlay.style.display = 'flex';
}

els.tbMinimize.addEventListener('click', () => window.electronAPI.minimizeWindow());
els.tbClose.addEventListener('click', () => window.electronAPI.closeWindow());

els.btnPrimary.addEventListener('click', () => {
  if (state.mode === 'idle' && !state.isRunning) { state.totalTime = state.studyMinutes * 60; state.timeRemaining = state.totalTime; updateDisplay(); }
  toggleTimer();
});

els.btnSecondary.addEventListener('click', resetTimer);
els.btnExit.addEventListener('click', () => { if (state.mode === 'study') showPassword(); else window.electronAPI.forceQuit(); });

els.soundBtns.forEach(b => b.addEventListener('click', () => setSound(b.dataset.sound)));
els.volumeSlider.addEventListener('input', (e) => { const v = parseInt(e.target.value); SoundEngine.setVolume(v / 100); els.volPct.textContent = v + '%'; saveSettings(); });
els.settingsToggle.addEventListener('click', () => els.settingsPanel.classList.toggle('open'));

els.adjBtns.forEach(b => b.addEventListener('click', () => {
  const t = b.dataset.target, d = parseInt(b.dataset.dir);
  if (t === 'study') { state.studyMinutes = Math.max(1, Math.min(120, state.studyMinutes + d)); els.studyDuration.textContent = state.studyMinutes; if (state.mode === 'idle') { state.totalTime = state.studyMinutes * 60; state.timeRemaining = state.totalTime; updateDisplay(); } }
  else if (t === 'break') { state.breakMinutes = Math.max(1, Math.min(60, state.breakMinutes + d)); els.breakDuration.textContent = state.breakMinutes; }
  else if (t === 'sessions') { state.totalSessions = Math.max(1, Math.min(20, state.totalSessions + d)); els.sessionCountSetting.textContent = state.totalSessions; }
  saveSettings();
}));

els.bgImageBtn.addEventListener('click', async () => {
  if (window.electronAPI) { const fp = await window.electronAPI.selectImage(); if (fp) { els.bgLayer.style.backgroundImage = `url(file:///${fp.replace(/\\/g, '/')})`; saveSettings(); } }
});
els.bgRemoveBtn.addEventListener('click', () => { els.bgLayer.style.backgroundImage = ''; saveSettings(); });

els.btnStats.addEventListener('click', showStats);
els.statsClose.addEventListener('click', () => els.statsOverlay.classList.add('hidden'));
els.statsOverlay.addEventListener('click', (e) => { if (e.target === els.statsOverlay) els.statsOverlay.classList.add('hidden'); });

els.settingsLogout.addEventListener('click', () => {
  UserManager.logout();
  els.settingsPanel.classList.remove('open');
  location.reload();
});

els.settingsChangepass = $('settings-changepass');
els.settingsPassword = $('settings-password');
els.settingsChangepass.addEventListener('click', () => {
  const newPass = els.settingsPassword.value.trim();
  if (!newPass || newPass.length < 3) return;
  const user = UserManager.current(); if (!user) return;
  const d = UserManager.get();
  d.users[user].password = newPass;
  UserManager.save(d);
  els.settingsPassword.value = '';
  els.settingsPassword.placeholder = 'Parola değiştirildi!';
  setTimeout(() => { els.settingsPassword.placeholder = 'Yeni parola'; }, 2000);
});

// Login handlers
els.loginBtn.addEventListener('click', () => {
  const user = els.loginUsername.value.trim();
  const pass = els.loginPassword.value.trim();
  if (!user || !pass) return;
  els.loginError.classList.add('hidden');
  els.registerError.classList.add('hidden');

  if (UserManager.exists()) {
    if (UserManager.login(user, pass)) { showApp(); }
    else { els.loginError.classList.remove('hidden'); }
  } else {
    if (UserManager.register(user, pass)) { showApp(); }
    else { els.registerError.classList.remove('hidden'); }
  }
});

els.registerBtn.addEventListener('click', () => {
  const user = els.loginUsername.value.trim();
  const pass = els.loginPassword.value.trim();
  if (!user || !pass) return;
  els.loginError.classList.add('hidden');
  els.registerError.classList.add('hidden');
  if (UserManager.register(user, pass)) { showApp(); }
  else { els.registerError.classList.remove('hidden'); }
});

els.loginUsername.addEventListener('keydown', (e) => { if (e.key === 'Enter') els.loginPassword.focus(); });
els.loginPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') els.loginBtn.click(); });

function getUserPassword() {
  const user = UserManager.current(); if (!user) return '';
  const d = UserManager.get();
  return d.users[user]?.password || '';
}

window.electronAPI.onCloseRequested(() => {
  if (state.mode === 'study') showPassword(); else window.electronAPI.allowClose();
});

els.passwordSubmit.addEventListener('click', () => {
  const p = els.passwordInput.value.trim();
  if (!p) return;
  if (p === getUserPassword()) { els.passwordOverlay.classList.add('hidden'); window.electronAPI.allowClose(); }
  else { els.passwordError.classList.remove('hidden'); els.passwordInput.value = ''; els.passwordInput.focus(); }
});
els.passwordCancel.addEventListener('click', () => { els.passwordOverlay.classList.add('hidden'); els.passwordError.classList.add('hidden'); });
els.passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') els.passwordSubmit.click(); else if (e.key === 'Escape') els.passwordCancel.click(); });

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'F4') e.preventDefault();
  if (e.key === 'Escape') e.preventDefault();
  if (e.key === ' ' && state.mode !== 'idle') { e.preventDefault(); toggleTimer(); }
  if (e.key === ' ' && !state.isRunning && state.mode === 'idle') { e.preventDefault(); toggleTimer(); }
});

// Start
initLogin();