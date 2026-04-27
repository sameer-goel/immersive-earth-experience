// app.jsx — Main React app for the immersive earth experience.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "earthStyle": "photoreal",
  "rotationSpeed": 0.4,
  "autoRotate": true,
  "atmosphereIntensity": 1.0,
  "exposure": 1.0,
  "twilight": 0.18,
  "starDensity": 280,
  "parallaxStrength": 0.6,
  "scrollSnap": true,
  "showMarkers": true,
  "ambientAudio": false,
  "cameraLon": -90,
  "cameraLat": 18,
  "cameraZoom": 1.0,
  "cameraMode": "scroll-driven",
  "vignette": 0.55
}/*EDITMODE-END*/;

const STYLE_OPTIONS = [
  { key: 'photoreal',  label: 'Photoreal',   swatch: 'swatch-photoreal' },
  { key: 'nightside',  label: 'City Lights', swatch: 'swatch-night' },
  { key: 'wireframe',  label: 'Wireframe',   swatch: 'swatch-wire' },
  { key: 'topo',       label: 'Topographic', swatch: 'swatch-topo' },
  { key: 'painterly',  label: 'Painterly',   swatch: 'swatch-painterly' },
  { key: 'monochrome', label: 'Editorial',   swatch: 'swatch-monochrome' },
];

// 3 chapters
const CHAPTERS = [
  {
    n: '',
    title: null, // hero handled separately
    // Earth pushed below center: look-at point ABOVE earth ⇒ earth renders in lower portion of frame
    target: { lon: -90, lat: 12, zoom: 1.4, dayNight: 0.85, lookOffset: 1.0 },
  },
  {
    n: 'Chapter I',
    target: { lon: -50, lat: 8, zoom: 1.3, dayNight: 0.55, lookOffset: 0 },
  },
  {
    n: 'Chapter II',
    target: { lon: 80, lat: -2, zoom: 1.7, dayNight: 0.05, lookOffset: 0 }, // night side / city lights
  },
];

// Hotspot data — appears on chapter 3
const MARKERS = [
  { key: 'tokyo',    lat: 35.68,  lon: 139.69,  label: 'Tokyo',     coord: '35.68° N · 139.69° E' },
  { key: 'mumbai',   lat: 19.07,  lon: 72.87,   label: 'Mumbai',    coord: '19.07° N · 72.87° E' },
  { key: 'singapore',lat: 1.35,   lon: 103.81,  label: 'Singapore', coord: '1.35° N · 103.81° E' },
  { key: 'shanghai', lat: 31.23,  lon: 121.47,  label: 'Shanghai',  coord: '31.23° N · 121.47° E' },
];

// ─────────── Starfield (canvas-based, parallax) ───────────
function initStarfield(getDensity, getParallax) {
  const cv = document.getElementById('stars-canvas');
  const ctx = cv.getContext('2d');
  let stars = [];
  let cursor = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollY = 0;
  let currentDensity = -1;

  function resize() {
    cv.width = window.innerWidth * window.devicePixelRatio;
    cv.height = window.innerHeight * window.devicePixelRatio;
    cv.style.width = window.innerWidth + 'px';
    cv.style.height = window.innerHeight + 'px';
    currentDensity = -1;
    rebuild();
  }

  function rebuild() {
    const n = getDensity();
    if (n === currentDensity) return;
    currentDensity = n;
    stars = [];
    for (let i = 0; i < n; i++) {
      const depth = Math.random();
      stars.push({
        x: Math.random() * cv.width,
        y: Math.random() * cv.height,
        r: (0.4 + Math.random() * 1.6) * window.devicePixelRatio,
        depth, // 0 = far, 1 = near
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.3 + Math.random() * 1.4,
        baseAlpha: 0.3 + Math.random() * 0.7,
      });
    }
  }

  let lastT = performance.now();
  function frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    // smooth cursor
    cursor.x += (cursor.tx - cursor.x) * 0.06;
    cursor.y += (cursor.ty - cursor.y) * 0.06;

    ctx.clearRect(0, 0, cv.width, cv.height);
    const cx = cv.width / 2, cy = cv.height / 2;
    const par = getParallax();
    const offX = (cursor.x - cx) * par * 0.08;
    const offY = (cursor.y - cy) * par * 0.08;
    const scrollOff = scrollY * par * 0.18;

    for (let s of stars) {
      s.twinkle += dt * s.twinkleSpeed;
      const tw = 0.6 + 0.4 * Math.sin(s.twinkle);
      const dx = offX * (0.2 + s.depth * 1.2);
      const dy = offY * (0.2 + s.depth * 1.2) - scrollOff * (0.3 + s.depth * 1.4);
      const x = ((s.x + dx) % cv.width + cv.width) % cv.width;
      const y = ((s.y + dy) % cv.height + cv.height) % cv.height;
      const a = s.baseAlpha * tw;

      // soft glow
      const grad = ctx.createRadialGradient(x, y, 0, x, y, s.r * 4);
      grad.addColorStop(0, `rgba(255, 248, 240, ${a})`);
      grad.addColorStop(1, `rgba(255, 248, 240, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, s.r * 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, a * 1.4)})`;
      ctx.beginPath();
      ctx.arc(x, y, s.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  // Periodically check density (cheap)
  setInterval(rebuild, 400);

  window.addEventListener('mousemove', (e) => {
    cursor.tx = e.clientX * window.devicePixelRatio;
    cursor.ty = e.clientY * window.devicePixelRatio;
  });
  window.addEventListener('resize', resize);
  resize();
  rebuild();
  frame();

  return {
    setScroll: (y) => { scrollY = y; },
    rebuild,
  };
}

// ─────────── Audio: synthetic ambient pad via WebAudio ───────────
function makeAmbientAudio() {
  let ctx, gain, oscs = [], lfo, lfoGain, started = false;
  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);

    // soft pad: 3 detuned sines + slow LFO on filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 1.2;
    filter.connect(gain);

    const freqs = [110, 165, 220.5, 277];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = 0.18 / freqs.length;
      o.connect(og); og.connect(filter);
      o.start();
      oscs.push({ o, og });
    });

    lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    lfoGain = ctx.createGain();
    lfoGain.gain.value = 320;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
  }
  return {
    on() {
      ensure();
      ctx.resume();
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 1.2);
      started = true;
    },
    off() {
      if (!ctx) return;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    },
  };
}

// ─────────── Camera Pad (custom tweak control) ───────────
function CameraPad({ lon, lat, zoom, onChange }) {
  // Map lon: -180..180 → x 0..1; lat: -90..90 → y 1..0 (top is +lat)
  const padRef = React.useRef(null);
  const [drag, setDrag] = React.useState(false);
  const x = ((lon + 180) / 360) * 100;
  const y = (1 - (lat + 90) / 180) * 100;

  const update = (clientX, clientY) => {
    const r = padRef.current.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const py = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    const newLon = px * 360 - 180;
    const newLat = (1 - py) * 180 - 90;
    onChange({ lon: newLon, lat: newLat });
  };

  const onDown = (e) => {
    setDrag(true);
    update(e.clientX, e.clientY);
    e.preventDefault();
  };
  React.useEffect(() => {
    if (!drag) return;
    const onMove = (e) => update(e.clientX, e.clientY);
    const onUp = () => setDrag(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  });

  return (
    <div className="twk-row">
      <div className="twk-lbl"><span>Camera target</span><span className="twk-val">{lon.toFixed(0)}°, {lat.toFixed(0)}°</span></div>
      <div className="twk-cam-pad" ref={padRef} onMouseDown={onDown}>
        <div className={`puck ${drag ? 'dragging' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} />
      </div>
      <div className="twk-mini">Drag to point the camera. Lat/lon coords on Earth.</div>
    </div>
  );
}

// ─────────── Style swatch grid ───────────
function StyleGrid({ value, onChange }) {
  return (
    <div className="twk-row">
      <div className="twk-lbl"><span>Earth style</span><span className="twk-val">{STYLE_OPTIONS.find(s => s.key === value)?.label}</span></div>
      <div className="twk-style-grid">
        {STYLE_OPTIONS.map(s => (
          <button
            key={s.key}
            className={`twk-style-swatch ${s.swatch} ${value === s.key ? 'active' : ''}`}
            onClick={() => onChange(s.key)}
            aria-label={s.label}
            title={s.label}
          >
            <div className="swatch-label">{s.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────── App ───────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [activeChapter, setActiveChapter] = React.useState(0);
  const [audioOn, setAudioOn] = React.useState(false);
  const [hoveredMarker, setHoveredMarker] = React.useState(null);
  const sceneReadyRef = React.useRef(false);
  const audioRef = React.useRef(null);
  const starfieldRef = React.useRef(null);
  const contentRef = React.useRef(null);

  // Init scene + starfield once
  React.useEffect(() => {
    const wait = setInterval(() => {
      if (window.EarthScene && window.EarthScene.init) {
        clearInterval(wait);
        const root = document.getElementById('scene-root');
        window.EarthScene.init(root);
        // Apply initial chapter target so the hero composes correctly
        const h = CHAPTERS[0].target;
        window.EarthScene.setCamera({ lon: h.lon, lat: h.lat, zoom: h.zoom, lookOffset: h.lookOffset });
        window.EarthScene.setDayNight(h.dayNight);
        window.EarthScene.onStyleReady(() => {
          if (!sceneReadyRef.current) {
            sceneReadyRef.current = true;
            setTimeout(() => {
              document.getElementById('shroud')?.classList.add('hidden');
            }, 300);
          }
        });
        // Hard-timeout safety: dismiss the shroud no matter what after 6s
        setTimeout(() => {
          if (!sceneReadyRef.current) {
            sceneReadyRef.current = true;
            document.getElementById('shroud')?.classList.add('hidden');
          }
        }, 6000);
        window.EarthScene.onDragChange((c) => {
          setTweak({ cameraLon: c.lon, cameraLat: c.lat });
        });

        starfieldRef.current = initStarfield(
          () => window.__starfieldDensity ?? TWEAK_DEFAULTS.starDensity,
          () => window.__starfieldParallax ?? TWEAK_DEFAULTS.parallaxStrength,
        );
      }
    }, 50);
    audioRef.current = makeAmbientAudio();
    return () => clearInterval(wait);
  }, []);

  // Push tweak values into scene
  React.useEffect(() => {
    if (!window.EarthScene?.setStyle) return;
    window.EarthScene.setStyle(t.earthStyle);
  }, [t.earthStyle]);

  React.useEffect(() => {
    if (!window.EarthScene) return;
    window.EarthScene.setRotation(t.autoRotate ? t.rotationSpeed * 0.03 : 0);
  }, [t.rotationSpeed, t.autoRotate]);

  React.useEffect(() => {
    if (!window.EarthScene?.atmoUniforms) return;
    window.EarthScene.atmoUniforms.uIntensity.value = t.atmosphereIntensity;
    window.EarthScene.earthUniforms.uExposure.value = t.exposure;
    window.EarthScene.earthUniforms.uTwilightWidth.value = t.twilight;
  }, [t.atmosphereIntensity, t.exposure, t.twilight]);

  // Vignette overlay strength
  React.useEffect(() => {
    document.querySelector('.vignette').style.opacity = t.vignette;
  }, [t.vignette]);

  // Star density / parallax — push to globals read by starfield
  React.useEffect(() => {
    window.__starfieldDensity = t.starDensity;
    window.__starfieldParallax = t.parallaxStrength;
  }, [t.starDensity, t.parallaxStrength]);

  // Camera follows scroll OR follows tweaks (depending on mode)
  React.useEffect(() => {
    if (!window.EarthScene) return;
    if (t.cameraMode === 'manual') {
      window.EarthScene.setCamera({ lon: t.cameraLon, lat: t.cameraLat, zoom: t.cameraZoom });
    }
  }, [t.cameraLon, t.cameraLat, t.cameraZoom, t.cameraMode]);

  // Markers
  React.useEffect(() => {
    if (!window.EarthScene) return;
    if (t.showMarkers) {
      window.EarthScene.setMarkers(MARKERS, (m) => {
        setTweak({
          cameraLon: m.lon,
          cameraLat: m.lat,
          cameraZoom: 2.4,
          cameraMode: 'manual',
        });
      });
    } else {
      window.EarthScene.setMarkers([], null);
    }
  }, [t.showMarkers]);

  // Audio
  React.useEffect(() => {
    if (!audioRef.current) return;
    if (audioOn) audioRef.current.on();
    else audioRef.current.off();
  }, [audioOn]);

  // Scroll snap toggle
  React.useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.scrollSnapType = t.scrollSnap ? 'y mandatory' : 'none';
    }
  }, [t.scrollSnap]);

  // Drive camera by scroll progress
  const handleScroll = React.useCallback((e) => {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    const progress = max > 0 ? el.scrollTop / max : 0;
    starfieldRef.current?.setScroll(el.scrollTop);

    // Determine which chapter we're nearest
    const idx = Math.min(CHAPTERS.length - 1, Math.round(progress * (CHAPTERS.length - 1)));
    setActiveChapter(idx);

    // Smooth interpolation between chapter targets
    if (t.cameraMode === 'scroll-driven' && window.EarthScene) {
      const segment = progress * (CHAPTERS.length - 1);
      const i = Math.floor(segment);
      const f = segment - i;
      const a = CHAPTERS[i].target;
      const b = CHAPTERS[Math.min(i + 1, CHAPTERS.length - 1)].target;
      const lon = a.lon + (b.lon - a.lon) * f;
      const lat = a.lat + (b.lat - a.lat) * f;
      const zoom = a.zoom + (b.zoom - a.zoom) * f;
      const dn = a.dayNight + (b.dayNight - a.dayNight) * f;
      const lookOffset = (a.lookOffset || 0) + ((b.lookOffset || 0) - (a.lookOffset || 0)) * f;
      window.EarthScene.setCamera({ lon, lat, zoom, lookOffset });
      window.EarthScene.setDayNight(dn);
    }

    // Hero top-fade fades out as we leave hero
    const fade = document.getElementById('top-fade');
    if (fade) fade.style.opacity = Math.max(0, 1 - progress * 3.0);

    // Markers visible only in chapter 3
    const showOnEarth = t.showMarkers && progress > 0.66;
    window.EarthScene?.setMarkersVisible(showOnEarth);

    // Hide scroll cue after first scroll
    const cue = document.getElementById('scroll-cue');
    if (cue) cue.style.opacity = progress > 0.05 ? 0 : 1;
  }, [t.cameraMode, t.showMarkers]);

  const goToChapter = (i) => {
    if (!contentRef.current) return;
    contentRef.current.scrollTo({ top: i * window.innerHeight, behavior: 'smooth' });
  };

  return (
    <>
      {/* Top nav */}
      <div className="top-nav">
        <div className="brand"><em>Inner</em><span className="dot"></span><em>Artificial</em></div>
        <button
          className={`audio-toggle ${audioOn ? 'on' : ''}`}
          onClick={() => setAudioOn(v => !v)}
          aria-pressed={audioOn}
        >
          <span className="audio-bars"><span></span><span></span><span></span><span></span></span>
          <span>{audioOn ? 'Sound On' : 'Sound Off'}</span>
        </button>
      </div>

      {/* Right-side progress rail */}
      <div className="progress-rail">
        {CHAPTERS.map((c, i) => (
          <button
            key={i}
            className={activeChapter === i ? 'active' : ''}
            onClick={() => goToChapter(i)}
          >
            <span className="label">{i === 0 ? 'Overview' : c.n}</span>
            <span className="tick"></span>
          </button>
        ))}
      </div>

      {/* Scroll cue */}
      <div className="scroll-cue" id="scroll-cue" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Scrollable content */}
      <div id="content" ref={contentRef} onScroll={handleScroll}>
        <section className="chapter hero" data-screen-label="01 Hero">
          <h1>
            Experience the combined power of<br/>
            <em>Inner Intelligence</em> <span className="plus">+</span> <em>Artificial Intelligence</em>
          </h1>
          <div className="kicker">An immersive portfolio · Scroll to begin</div>
        </section>

        <section className="chapter chapter-2" data-screen-label="02 Origin">
          <div className="chapter-num">{CHAPTERS[1].n}</div>
          <h2>A planet, <em>seen whole.</em></h2>
          <p className="lede">
            Eight billion minds. One thin, lit shell of atmosphere.
            From this distance, the boundaries we draw between intuition
            and computation start to blur into the same soft glow.
          </p>
          <div className="stats">
            <div>
              <div className="stat-num"><em>510.1</em>M km²</div>
              <div className="stat-label">Surface area</div>
            </div>
            <div>
              <div className="stat-num"><em>23.4</em>°</div>
              <div className="stat-label">Axial tilt</div>
            </div>
            <div>
              <div className="stat-num"><em>1,674</em> km/h</div>
              <div className="stat-label">Equatorial spin</div>
            </div>
          </div>
        </section>

        <section className="chapter chapter-3" data-screen-label="03 Network">
          <div className="chapter-num">{CHAPTERS[2].n}</div>
          <h2>The night side <em>thinks back.</em></h2>
          <p className="lede">
            Where city lights bloom across the dark hemisphere, networks
            of human thought meet networks of artificial reasoning.
            Click a node to listen in.
          </p>
          <div className="hotspot-list">
            {MARKERS.map(m => (
              <div
                key={m.key}
                className={`hotspot ${hoveredMarker === m.key ? 'active' : ''}`}
                onMouseEnter={() => setHoveredMarker(m.key)}
                onMouseLeave={() => setHoveredMarker(null)}
                onClick={() => {
                  setTweak({
                    cameraLon: m.lon,
                    cameraLat: m.lat,
                    cameraZoom: 2.6,
                    cameraMode: 'manual',
                  });
                }}
              >
                <span className="dot"></span>
                <span>{m.label}</span>
                <span className="coord">{m.coord}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Visual style" />
        <StyleGrid value={t.earthStyle} onChange={(v) => setTweak('earthStyle', v)} />

        <TweakSection label="Camera" />
        <TweakRadio
          label="Mode"
          value={t.cameraMode}
          options={[
            { value: 'scroll-driven', label: 'Scroll' },
            { value: 'manual', label: 'Manual' },
          ]}
          onChange={(v) => setTweak('cameraMode', v)}
        />
        <CameraPad
          lon={t.cameraLon}
          lat={t.cameraLat}
          onChange={(c) => setTweak({ ...c, cameraMode: 'manual' })}
        />
        <TweakSlider label="Zoom" value={t.cameraZoom} min={0.6} max={3.5} step={0.05}
                     onChange={(v) => setTweak({ cameraZoom: v, cameraMode: 'manual' })} />
        <TweakToggle label="Auto-rotate" value={t.autoRotate}
                     onChange={(v) => setTweak('autoRotate', v)} />
        <TweakSlider label="Rotation speed" value={t.rotationSpeed} min={0} max={2} step={0.05}
                     onChange={(v) => setTweak('rotationSpeed', v)} />

        <TweakSection label="Atmosphere" />
        <TweakSlider label="Glow" value={t.atmosphereIntensity} min={0} max={2.5} step={0.05}
                     onChange={(v) => setTweak('atmosphereIntensity', v)} />
        <TweakSlider label="Exposure" value={t.exposure} min={0.4} max={1.6} step={0.02}
                     onChange={(v) => setTweak('exposure', v)} />
        <TweakSlider label="Twilight band" value={t.twilight} min={0.04} max={0.6} step={0.01}
                     onChange={(v) => setTweak('twilight', v)} />
        <TweakSlider label="Vignette" value={t.vignette} min={0} max={1} step={0.05}
                     onChange={(v) => setTweak('vignette', v)} />

        <TweakSection label="Cosmos" />
        <TweakSlider label="Star density" value={t.starDensity} min={50} max={800} step={10}
                     onChange={(v) => setTweak('starDensity', v)} />
        <TweakSlider label="Parallax" value={t.parallaxStrength} min={0} max={1.5} step={0.05}
                     onChange={(v) => setTweak('parallaxStrength', v)} />

        <TweakSection label="Experience" />
        <TweakToggle label="Scroll snap" value={t.scrollSnap}
                     onChange={(v) => setTweak('scrollSnap', v)} />
        <TweakToggle label="Show hotspots" value={t.showMarkers}
                     onChange={(v) => setTweak('showMarkers', v)} />
      </TweaksPanel>
    </>
  );
}

// We need starfield to be reactive to density/parallax — re-init when changed.
// Simpler: rebuild internal arrays on change via global hooks.
(function patchStarfield() {
  // expose hot getters that read from app's tweak state via window
  window.__starfieldDensity = TWEAK_DEFAULTS.starDensity;
  window.__starfieldParallax = TWEAK_DEFAULTS.parallaxStrength;
})();

ReactDOM.createRoot(document.getElementById('app-root')).render(<App />);
