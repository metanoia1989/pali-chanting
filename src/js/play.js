import { createApp, ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

// ─── Pali lexicon regex (mirrors generate_csv.py) ───
const PALI_RE = /[a-zA-ZāĀīĪūŪṃṀṁṅṄñÑṭṬḍḌṇṆḷḶ'’]+/g;
function cleanWord(w) { return (w.match(PALI_RE) || []).join(''); }

// ─── Track definitions ───
const tracks = [
  {
    id: '01',
    name: 'Homage Tisarana · 礼敬佛陀 三皈依',
    audio: '01.Homage Tisarana 礼敬佛陀 三皈依.mp3',
    json: '01.Homage Tisarana 礼敬佛陀 三皈依.json',
    hasJson: true
  },
  {
    id: '02',
    name: 'Main Puja · 佛随念 礼敬七佛',
    audio: '02.Main Puja 佛随念 礼敬七佛.mp3',
    json: '02.Main Puja 佛随念 礼敬七佛.json',
    hasJson: true
  },
  {
    id: '03',
    name: 'Inviting the Devas · 邀请诸天',
    audio: '03.inviting the Devas 邀请诸天.mp3',
    json: '03.inviting the Devas 邀请诸天.json',
    hasJson: true
  },
  {
    id: '04',
    name: 'Maha Maṅgala Sutta · 大吉祥经',
    audio: '04.Maha Maṅgala Suttaṁ 大吉祥经.mp3',
    json: '04.Maha Maṅgala Suttaṁ 大吉祥经.json',
    hasJson: true
  },
  {
    id: '05',
    name: 'Karaṇīya Metta Sutta · 应行慈爱经',
    audio: '05.Karaniya metta Sutta 应行慈爱经.mp3',
    json: '05.Karaniya metta Sutta 应行慈爱经.json',
    hasJson: true
  },
  {
    id: '06',
    name: 'Kammā Vācanā · 请求宽恕',
    audio: '06.Kammā Vācanā  请求宽恕.mp3',
    json: '06.Kammā Vācanā  请求宽恕.json',
    hasJson: true
  },
];

// ─── Parse original Pali text into paragraph/line/token structure ───
function parsePaliText(text) {
  const paragraphs = [];
  const rawParas = text.split(/\n\n+/);
  for (const rawP of rawParas) {
    const lines = [];
    const rawLines = rawP.trim().split('\n');
    for (const rawL of rawLines) {
      let l = rawL.trim();
      if (!l || l.startsWith('//')) continue;
      l = l.replace(/^\d+\.[\s\t]*/, '').replace(/^\d+[\s\t]/, '').replace(/\/\/.*$/, '').trim();
      if (!l) continue;
      const tokens = l.split(/\s+/).map(d => ({ display: d, parts: [] }));
      lines.push({ tokens });
    }
    if (lines.length) paragraphs.push({ lines });
  }
  return paragraphs;
}

// ─── Align tokens with JSON words by position ───
function alignWithJson(paragraphs, jsonWords) {
  let ji = 0;
  for (const p of paragraphs) {
    for (const line of p.lines) {
      for (const token of line.tokens) {
        const rawParts = token.display.split(/[-–—]/);
        const parts = [];
        for (let i = 0; i < rawParts.length; i++) {
          const segment = rawParts[i];
          if (i > 0) parts.push({ text: '-' });
          const cleaned = cleanWord(segment);
          if (cleaned) {
            const jw = jsonWords[ji];
            if (jw) {
              parts.push({
                text: segment,
                start: parseFloat(jw.start_time),
                end: parseFloat(jw.end_time),
              });
              ji++;
            } else {
              parts.push({ text: segment });
            }
          } else {
            parts.push({ text: segment });
          }
        }
        token.parts = parts;
      }
    }
  }
}

// ─── Flat list of all timed parts for efficient scanning ───
function flattenParts(paragraphs) {
  const all = [];
  for (const p of paragraphs) {
    for (const line of p.lines) {
      for (const token of line.tokens) {
        for (const part of token.parts) {
          if (part.start !== undefined) all.push(part);
        }
      }
    }
  }
  return all;
}

// ─── Parse translation text ───
function parseTransText(text) {
  const paragraphs = [];
  const rawParas = text.trim().split(/\n\n+/);
  for (const rawP of rawParas) {
    const lines = [];
    const rawLines = rawP.trim().split('\n');
    for (const rawL of rawLines) {
      const l = rawL.trim();
      if (!l || l.startsWith('//')) continue;
      if (/^\d+\.?\s*$/.test(l)) continue;
      lines.push(l);
    }
    if (lines.length) paragraphs.push({ lines });
  }
  return paragraphs;
}

// ─── Check if a full Pali line is finished playing ───
function isLineFinished(line, t) {
  let maxEnd = 0;
  for (const token of line.tokens) {
    for (const part of token.parts) {
      if (part.end !== undefined && part.end > maxEnd) maxEnd = part.end;
    }
  }
  return maxEnd > 0 && t >= maxEnd;
}

// ─── App ───
createApp({
  setup() {
    const current = ref(null);
    const playing = ref(false);
    const audioReady = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const paragraphs = ref([]);
    const flatParts = ref([]);
    const progressBar = ref(null);
    const textAreaEl = ref(null);
    const sidebarOpen = ref(false);
    const showEn = ref(true);
    const showCn = ref(true);

    let audio = null;
    let rafId = null;

    const progressPct = computed(() => {
      if (!duration.value) return 0;
      return (currentTime.value / duration.value) * 100;
    });

    function partClass(part) {
      if (part.start === undefined) return '';
      if (part.end <= currentTime.value) return 'dim';
      if (part.start <= currentTime.value && part.end > currentTime.value) return 'active';
      return '';
    }

    function fmtTime(t) {
      if (!t || isNaN(t)) return '00:00';
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function initAudio(src) {
      if (audio) {
        audio.pause();
        audio.src = '';
        cancelAnimationFrame(rafId);
        playing.value = false;
        audioReady.value = false;
      }
      audio = new Audio(src);
      audio.preload = 'auto';

      audio.addEventListener('loadedmetadata', () => {
        duration.value = audio.duration || 0;
        audioReady.value = true;
      });
      audio.addEventListener('play', () => { playing.value = true; startSync(); });
      audio.addEventListener('pause', () => { playing.value = false; stopSync(); });
      audio.addEventListener('ended', () => {
        playing.value = false;
        currentTime.value = duration.value;
        stopSync();
      });
      audio.addEventListener('timeupdate', () => {
        currentTime.value = audio.currentTime;
      });
    }

    function startSync() {
      stopSync();
      function tick() {
        if (audio && !audio.paused) currentTime.value = audio.currentTime;
        rafId = requestAnimationFrame(tick);
      }
      rafId = requestAnimationFrame(tick);
    }

    function stopSync() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    function toggleSidebar() {
      sidebarOpen.value = !sidebarOpen.value;
    }

    function toggleTrans(lang) {
      if (lang === 'en') showEn.value = !showEn.value;
      if (lang === 'cn') showCn.value = !showCn.value;
    }

    function randomTrack() {
      const available = tracks.filter(t => t.hasJson);
      if (!available.length) return;
      const pick = available[Math.floor(Math.random() * available.length)];
      selectTrack(pick);
    }

    async function selectTrack(track) {
      if (current.value && current.value.id === track.id) return;
      sidebarOpen.value = false;
      current.value = track;
      paragraphs.value = [];
      flatParts.value = [];

      // 1. Fetch original Pali text
      let rawText = '';
      try {
        const txtName = track.audio.replace('.mp3', '.txt');
        const resp = await fetch('./assets/pali/' + txtName);
        if (resp.ok) rawText = await resp.text();
      } catch (e) {}

      // 2. Parse into paragraphs/lines/tokens
      const parsed = parsePaliText(rawText || '');

      // 3. If JSON exists, fetch and align
      if (track.hasJson) {
        try {
          const resp = await fetch('./assets/json/' + track.json);
          if (resp.ok) {
            const data = await resp.json();
            alignWithJson(parsed, data);
          }
        } catch (e) { console.warn('JSON load failed:', e); }
      }

      // 4. Fetch and attach translations
      const txtName = track.audio.replace('.mp3', '.txt');
      let transEn = null, transCn = null;
      try {
        const [rEn, rCn] = await Promise.all([
          fetch('./assets/trans/en/' + txtName),
          fetch('./assets/trans/cn/' + txtName),
        ]);
        if (rEn.ok) transEn = parseTransText(await rEn.text());
        if (rCn.ok) transCn = parseTransText(await rCn.text());
      } catch (e) {}
      // Attach translations line-by-line matching paragraph structure
      if (transEn || transCn) {
        for (let pi = 0; pi < parsed.length; pi++) {
          const lEn = transEn?.[pi]?.lines;
          const lCn = transCn?.[pi]?.lines;
          for (let li = 0; li < parsed[pi].lines.length; li++) {
            const line = parsed[pi].lines[li];
            if (lEn?.[li]) line.trans = line.trans || {};
            if (lEn?.[li]) line.trans.en = lEn[li];
            if (lCn?.[li]) line.trans.cn = lCn[li];
          }
        }
      }

      paragraphs.value = parsed;
      flatParts.value = flattenParts(parsed);

      initAudio('./assets/audio/' + track.audio);
    }

    function togglePlay() {
      if (!audio || !audioReady.value) return;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    }

    function seek(e) {
      if (!audio || !duration.value) return;
      const rect = progressBar.value.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = pct * duration.value;
    }

    function seekTo(time) {
      if (!time || !audio) return;
      audio.currentTime = time;
      if (audio.paused) audio.play().catch(() => {});
    }

    // ─── Scroll active part into view ───
    let lastScrollIdx = -1;
    function scrollActive() {
      const idx = flatParts.value.findIndex(p => p.start <= currentTime.value && p.end > currentTime.value);
      if (idx < 0 || idx === lastScrollIdx) return;
      lastScrollIdx = idx;

      nextTick(() => {
        const container = textAreaEl.value;
        if (!container) return;
        const p = flatParts.value[idx];
        if (!p) return;
        const el = container.querySelector(`[data-start="${p.start}"]`);
        if (!el) return;

        const cr = container.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        const offset = er.top - cr.top - cr.height / 2 + er.height / 2;

        if (Math.abs(offset) > er.height * 0.5) {
          container.scrollTo({
            top: container.scrollTop + offset,
            behavior: 'smooth',
          });
        }
      });
    }

    // ─── Poll for auto-scroll on word change ───
    onMounted(() => {
      setInterval(() => {
        if (!current.value?.hasJson || !flatParts.value.length) return;
        scrollActive();
      }, 200);
    });

    // ─── Keyboard ───
    function onKey(e) {
      if (e.code === 'Space' && current.value) { e.preventDefault(); togglePlay(); }
    }
    document.addEventListener('keydown', onKey);
    onUnmounted(() => {
      document.removeEventListener('keydown', onKey);
      if (audio) { audio.pause(); audio.src = ''; }
      stopSync();
    });

    return {
      tracks, current, playing, audioReady,
      currentTime, duration, paragraphs, flatParts,
      progressPct, progressBar, textAreaEl, sidebarOpen,
      showEn, showCn,
      selectTrack, togglePlay, seek, seekTo, toggleSidebar, randomTrack, toggleTrans,
      partClass, fmtTime, isLineFinished,
    };
  }
}).mount('#app');
