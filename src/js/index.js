// ─── Scroll reveal ───
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ─── Interactive Demo ───
const words = [
  'Namo', 'tassa', 'bhagavato', 'arahato', 'sammā', 'sambuddhassa'
];
const wordEls = document.querySelectorAll('#demo-line .word');
const bar = document.getElementById('demo-progress-bar');
const label = document.getElementById('demo-word-label');
const playBtn = document.getElementById('demo-play-btn');

let current = 4;
let playing = false;
let timer = null;

function updateDemo(idx) {
  wordEls.forEach((el, i) => {
    el.classList.remove('active', 'dim');
    if (i < idx) el.classList.add('dim');
  });
  wordEls[idx].classList.add('active');
  label.textContent = words[idx];
  bar.style.width = ((idx + 1) / words.length * 100) + '%';
  current = idx;
}

function step() {
  if (!playing) return;
  const next = (current + 1) % words.length;
  updateDemo(next);
  if (next === 0) { playing = false; playBtn.textContent = '▶'; return; }
  timer = setTimeout(step, 900);
}

playBtn.addEventListener('click', () => {
  if (playing) {
    playing = false;
    clearTimeout(timer);
    playBtn.textContent = '▶';
    return;
  }
  playing = true;
  playBtn.textContent = '⏸';
  if (current === words.length - 1) updateDemo(0);
  timer = setTimeout(step, 900);
});

wordEls.forEach((el, i) => {
  el.addEventListener('click', () => {
    if (playing) { clearTimeout(timer); playing = false; playBtn.textContent = '▶'; }
    updateDemo(i);
  });
});

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
});
