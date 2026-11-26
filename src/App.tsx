import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type Vec = {
  x: number;
  y: number;
};

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Bumper = Vec & {
  r: number;
};

type Gate = Rect & {
  axis: "x" | "y";
  travel: number;
  speed: number;
  phase: number;
};

type Spinner = Bumper & {
  blades: number;
  speed: number;
};

type Slope = Rect & {
  force: Vec;
  label: string;
};

type Hole = {
  name: string;
  subtitle: string;
  par: number;
  difficulty: number;
  tee: Vec;
  cup: Vec;
  fairway: string;
  water: Rect[];
  sand: Rect[];
  walls: Rect[];
  bumpers: Bumper[];
  gates: Gate[];
  spinners: Spinner[];
  slopes: Slope[];
  startAngle: number;
};

type SoundKind = "bouton" | "putt" | "rebond" | "splash" | "trou" | "niveau";

type SoundEngine = {
  context: AudioContext;
  play: (kind: SoundKind, intensity?: number) => void;
  stop: () => void;
};

const WIDTH = 900;
const HEIGHT = 540;
const BALL_RADIUS = 9;
const CUP_RADIUS = 17;
const MAX_POWER = 100;

const courses: Hole[] = [
  {
    name: "Virage d'Ouverture",
    subtitle: "Un premier green large pour régler le toucher.",
    par: 2,
    difficulty: 1,
    tee: { x: 94, y: 442 },
    cup: { x: 790, y: 102 },
    fairway: "M96 442 C215 426 252 346 347 322 C472 290 525 207 641 165 C696 145 742 125 790 102",
    water: [{ x: 462, y: 346, w: 210, h: 44 }],
    sand: [{ x: 308, y: 214, w: 142, h: 72 }],
    walls: [
      { x: 390, y: 92, w: 24, h: 172 },
      { x: 600, y: 226, w: 190, h: 22 },
    ],
    bumpers: [{ x: 552, y: 142, r: 25 }],
    gates: [],
    spinners: [],
    slopes: [{ x: 214, y: 338, w: 128, h: 70, force: { x: 16, y: -12 }, label: "pente douce" }],
    startAngle: 332,
  },
  {
    name: "Canal Croisé",
    subtitle: "Le canal coupe le green. Une trajectoire propre évite la pénalité.",
    par: 3,
    difficulty: 2,
    tee: { x: 95, y: 104 },
    cup: { x: 800, y: 434 },
    fairway: "M96 104 C250 84 307 176 342 254 C383 346 522 354 611 370 C699 386 744 420 800 434",
    water: [
      { x: 372, y: 0, w: 86, h: 206 },
      { x: 372, y: 332, w: 86, h: 208 },
    ],
    sand: [
      { x: 546, y: 126, w: 164, h: 70 },
      { x: 186, y: 312, w: 142, h: 78 },
    ],
    walls: [
      { x: 485, y: 242, w: 218, h: 22 },
      { x: 650, y: 264, w: 24, h: 102 },
    ],
    bumpers: [
      { x: 286, y: 188, r: 22 },
      { x: 738, y: 332, r: 20 },
    ],
    gates: [],
    spinners: [],
    slopes: [{ x: 472, y: 356, w: 116, h: 66, force: { x: 24, y: 8 }, label: "dévers" }],
    startAngle: 26,
  },
  {
    name: "Crête Flipper",
    subtitle: "Les pare-chocs relancent vite. Dosez avant le dernier couloir.",
    par: 3,
    difficulty: 2,
    tee: { x: 112, y: 464 },
    cup: { x: 798, y: 88 },
    fairway: "M112 464 C228 420 223 287 340 262 C478 231 517 125 634 106 C700 95 747 91 798 88",
    water: [{ x: 95, y: 158, w: 176, h: 58 }],
    sand: [{ x: 596, y: 302, w: 162, h: 82 }],
    walls: [
      { x: 308, y: 342, w: 246, h: 22 },
      { x: 470, y: 168, w: 24, h: 140 },
      { x: 650, y: 130, w: 22, h: 126 },
    ],
    bumpers: [
      { x: 372, y: 184, r: 26 },
      { x: 564, y: 94, r: 24 },
      { x: 706, y: 214, r: 21 },
    ],
    gates: [],
    spinners: [],
    slopes: [
      { x: 238, y: 256, w: 108, h: 64, force: { x: 30, y: -16 }, label: "accélérateur" },
      { x: 510, y: 106, w: 94, h: 58, force: { x: -18, y: 12 }, label: "retour" },
    ],
    startAngle: 328,
  },
  {
    name: "Moulin du Practice",
    subtitle: "Attendez l'ouverture ou jouez le rebond sur les pales.",
    par: 3,
    difficulty: 3,
    tee: { x: 88, y: 278 },
    cup: { x: 810, y: 278 },
    fairway: "M88 278 C218 210 318 210 398 278 C480 348 574 346 654 278 C708 232 762 246 810 278",
    water: [
      { x: 250, y: 390, w: 198, h: 80 },
      { x: 548, y: 70, w: 178, h: 74 },
    ],
    sand: [{ x: 378, y: 172, w: 132, h: 66 }],
    walls: [
      { x: 318, y: 250, w: 126, h: 20 },
      { x: 318, y: 306, w: 126, h: 20 },
      { x: 626, y: 228, w: 22, h: 102 },
    ],
    bumpers: [{ x: 214, y: 220, r: 22 }],
    gates: [],
    spinners: [{ x: 512, y: 278, r: 35, blades: 4, speed: 96 }],
    slopes: [{ x: 684, y: 290, w: 94, h: 54, force: { x: 20, y: -20 }, label: "rampe" }],
    startAngle: 0,
  },
  {
    name: "Portes Mobiles",
    subtitle: "Deux portails coulissent. Le timing devient aussi important que l'angle.",
    par: 4,
    difficulty: 3,
    tee: { x: 92, y: 452 },
    cup: { x: 802, y: 90 },
    fairway: "M92 452 C210 430 240 338 334 322 C434 304 470 236 552 194 C642 148 714 118 802 90",
    water: [{ x: 438, y: 360, w: 216, h: 58 }],
    sand: [
      { x: 190, y: 214, w: 138, h: 78 },
      { x: 600, y: 234, w: 144, h: 68 },
    ],
    walls: [
      { x: 374, y: 94, w: 24, h: 154 },
      { x: 472, y: 258, w: 190, h: 20 },
    ],
    bumpers: [{ x: 726, y: 160, r: 22 }],
    gates: [
      { x: 420, y: 286, w: 28, h: 104, axis: "y", travel: 78, speed: 1.1, phase: 0 },
      { x: 588, y: 126, w: 128, h: 24, axis: "x", travel: 72, speed: 0.9, phase: Math.PI / 2 },
    ],
    spinners: [],
    slopes: [{ x: 536, y: 156, w: 92, h: 60, force: { x: 18, y: -28 }, label: "montée" }],
    startAngle: 330,
  },
  {
    name: "Île en Crochet",
    subtitle: "La sécurité coûte souvent un coup. Le raccourci demande un toucher fin.",
    par: 4,
    difficulty: 4,
    tee: { x: 82, y: 278 },
    cup: { x: 812, y: 270 },
    fairway: "M82 278 C222 176 342 194 411 270 C472 338 569 382 672 314 C722 281 763 270 812 270",
    water: [
      { x: 236, y: 0, w: 194, h: 176 },
      { x: 240, y: 368, w: 224, h: 172 },
      { x: 548, y: 0, w: 192, h: 168 },
      { x: 548, y: 384, w: 190, h: 156 },
    ],
    sand: [
      { x: 468, y: 184, w: 116, h: 66 },
      { x: 648, y: 286, w: 96, h: 58 },
    ],
    walls: [
      { x: 330, y: 224, w: 24, h: 122 },
      { x: 590, y: 220, w: 24, h: 118 },
      { x: 702, y: 176, w: 26, h: 78 },
    ],
    bumpers: [
      { x: 214, y: 292, r: 23 },
      { x: 508, y: 332, r: 25 },
    ],
    gates: [],
    spinners: [{ x: 410, y: 270, r: 31, blades: 3, speed: -112 }],
    slopes: [
      { x: 360, y: 174, w: 96, h: 58, force: { x: 18, y: 24 }, label: "dévers" },
      { x: 584, y: 310, w: 82, h: 54, force: { x: -16, y: -22 }, label: "cassure" },
    ],
    startAngle: 0,
  },
  {
    name: "Labyrinthe Néon",
    subtitle: "Des rails serrés, des bosses et un passage qui respire.",
    par: 5,
    difficulty: 5,
    tee: { x: 82, y: 464 },
    cup: { x: 812, y: 84 },
    fairway: "M82 464 C178 418 214 360 314 360 C438 360 436 232 552 230 C676 228 710 124 812 84",
    water: [
      { x: 112, y: 92, w: 196, h: 72 },
      { x: 668, y: 346, w: 160, h: 70 },
    ],
    sand: [
      { x: 340, y: 268, w: 112, h: 72 },
      { x: 534, y: 114, w: 116, h: 64 },
    ],
    walls: [
      { x: 246, y: 280, w: 22, h: 166 },
      { x: 374, y: 386, w: 192, h: 22 },
      { x: 480, y: 178, w: 22, h: 150 },
      { x: 616, y: 230, w: 22, h: 132 },
      { x: 708, y: 96, w: 22, h: 142 },
    ],
    bumpers: [
      { x: 326, y: 420, r: 20 },
      { x: 552, y: 254, r: 24 },
      { x: 754, y: 198, r: 21 },
    ],
    gates: [{ x: 606, y: 86, w: 116, h: 22, axis: "y", travel: 76, speed: 1.35, phase: 0.4 }],
    spinners: [{ x: 414, y: 220, r: 29, blades: 4, speed: 130 }],
    slopes: [
      { x: 154, y: 364, w: 106, h: 60, force: { x: 28, y: -8 }, label: "boost" },
      { x: 658, y: 130, w: 82, h: 54, force: { x: -24, y: 18 }, label: "frein" },
    ],
    startAngle: 328,
  },
  {
    name: "Final des Lucioles",
    subtitle: "Le dernier niveau combine eau, mouvement, pales et pentes contraires.",
    par: 5,
    difficulty: 5,
    tee: { x: 82, y: 92 },
    cup: { x: 808, y: 446 },
    fairway: "M82 92 C228 116 244 226 356 246 C468 266 464 382 586 396 C684 408 736 430 808 446",
    water: [
      { x: 240, y: 0, w: 110, h: 186 },
      { x: 366, y: 340, w: 146, h: 86 },
      { x: 646, y: 104, w: 150, h: 78 },
    ],
    sand: [
      { x: 126, y: 274, w: 140, h: 74 },
      { x: 552, y: 244, w: 126, h: 70 },
    ],
    walls: [
      { x: 354, y: 142, w: 24, h: 142 },
      { x: 494, y: 226, w: 178, h: 22 },
      { x: 730, y: 334, w: 22, h: 104 },
    ],
    bumpers: [
      { x: 204, y: 142, r: 22 },
      { x: 462, y: 296, r: 24 },
      { x: 710, y: 252, r: 22 },
    ],
    gates: [
      { x: 284, y: 202, w: 120, h: 22, axis: "x", travel: 78, speed: 1.45, phase: 0 },
      { x: 600, y: 328, w: 26, h: 112, axis: "y", travel: 68, speed: 1.2, phase: Math.PI / 2 },
    ],
    spinners: [
      { x: 394, y: 94, r: 29, blades: 3, speed: -138 },
      { x: 632, y: 400, r: 32, blades: 4, speed: 118 },
    ],
    slopes: [
      { x: 312, y: 274, w: 100, h: 58, force: { x: 24, y: 22 }, label: "dévers" },
      { x: 690, y: 382, w: 88, h: 54, force: { x: -28, y: -14 }, label: "contre-pente" },
    ],
    startAngle: 18,
  },
];

const zeroVelocity: Vec = { x: 0, y: 0 };
const confetti = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  dx: Math.cos(index * 1.7) * (42 + (index % 5) * 12),
  dy: Math.sin(index * 2.1) * (34 + (index % 4) * 13) - 42,
  delay: index * 0.035,
}));

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function speedOf(velocity: Vec) {
  return Math.hypot(velocity.x, velocity.y);
}

function unitFromAngle(degrees: number): Vec {
  const radians = (degrees * Math.PI) / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function rectContainsPoint(rect: Rect, point: Vec) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function ballTouchesRect(position: Vec, rect: Rect, radius = BALL_RADIUS) {
  const closestX = clamp(position.x, rect.x, rect.x + rect.w);
  const closestY = clamp(position.y, rect.y, rect.y + rect.h);
  return Math.hypot(position.x - closestX, position.y - closestY) <= radius;
}

function collisionWithRect(position: Vec, rect: Rect, radius = BALL_RADIUS) {
  const closestX = clamp(position.x, rect.x, rect.x + rect.w);
  const closestY = clamp(position.y, rect.y, rect.y + rect.h);
  const dx = position.x - closestX;
  const dy = position.y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq > radius * radius) {
    return null;
  }

  if (distSq > 0.0001) {
    const dist = Math.sqrt(distSq);
    return { nx: dx / dist, ny: dy / dist, penetration: radius - dist };
  }

  const left = Math.abs(position.x - rect.x);
  const right = Math.abs(rect.x + rect.w - position.x);
  const top = Math.abs(position.y - rect.y);
  const bottom = Math.abs(rect.y + rect.h - position.y);
  const minimum = Math.min(left, right, top, bottom);

  if (minimum === left) return { nx: -1, ny: 0, penetration: radius + left };
  if (minimum === right) return { nx: 1, ny: 0, penetration: radius + right };
  if (minimum === top) return { nx: 0, ny: -1, penetration: radius + top };
  return { nx: 0, ny: 1, penetration: radius + bottom };
}

function reflectVelocity(velocity: Vec, nx: number, ny: number, restitution: number) {
  const dot = velocity.x * nx + velocity.y * ny;
  if (dot >= 0) {
    return velocity;
  }

  return {
    x: velocity.x - (1 + restitution) * dot * nx,
    y: velocity.y - (1 + restitution) * dot * ny,
  };
}

function gateAtTime(gate: Gate, seconds: number): Rect {
  const offset = Math.sin(seconds * gate.speed + gate.phase) * gate.travel;
  return {
    x: gate.axis === "x" ? gate.x + offset : gate.x,
    y: gate.axis === "y" ? gate.y + offset : gate.y,
    w: gate.w,
    h: gate.h,
  };
}

function difficultyLabel(value: number) {
  if (value <= 1) return "Débutant";
  if (value === 2) return "Technique";
  if (value === 3) return "Avancé";
  if (value === 4) return "Expert";
  return "Maître";
}

function formatToPar(value: number) {
  if (value === 0) {
    return "E";
  }
  return value > 0 ? `+${value}` : `${value}`;
}

function scoreName(strokes: number, par: number) {
  const relative = strokes - par;
  if (strokes === 1) return "Trou en un";
  if (relative <= -2) return "Aigle";
  if (relative === -1) return "Birdie";
  if (relative === 0) return "Par";
  if (relative === 1) return "Bogey";
  return `+${relative}`;
}

function createNoiseBuffer(context: AudioContext, duration: number) {
  const sampleCount = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
  }
  return buffer;
}

function createSoundEngine(): SoundEngine | null {
  const ContextCtor = window.AudioContext;
  if (!ContextCtor) {
    return null;
  }

  const context = new ContextCtor();
  const master = context.createGain();
  master.gain.value = 0.28;
  master.connect(context.destination);

  const ambientGain = context.createGain();
  ambientGain.gain.value = 0.055;
  ambientGain.connect(master);

  const bass = context.createOscillator();
  bass.type = "sine";
  bass.frequency.value = 86;
  const pad = context.createOscillator();
  pad.type = "triangle";
  pad.frequency.value = 172;

  const lfo = context.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoGain = context.createGain();
  lfoGain.gain.value = 0.028;
  lfo.connect(lfoGain);
  lfoGain.connect(ambientGain.gain);

  bass.connect(ambientGain);
  pad.connect(ambientGain);
  bass.start();
  pad.start();
  lfo.start();

  const playTone = (frequency: number, duration: number, type: OscillatorType, volume: number, slideTo?: number) => {
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  };

  const playNoise = (duration: number, volume: number) => {
    const now = context.currentTime;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 720;
    filter.Q.value = 0.8;
    source.buffer = createNoiseBuffer(context, duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  };

  return {
    context,
    play: (kind: SoundKind, intensity = 1) => {
      if (context.state === "suspended") {
        void context.resume();
      }
      if (kind === "putt") playTone(170 + intensity * 90, 0.15, "triangle", 0.13, 92);
      if (kind === "rebond") playTone(300 + intensity * 80, 0.08, "square", 0.075, 210);
      if (kind === "splash") playNoise(0.36, 0.16);
      if (kind === "trou") {
        playTone(520, 0.16, "sine", 0.12, 760);
        setTimeout(() => playTone(880, 0.22, "triangle", 0.1, 1180), 120);
      }
      if (kind === "niveau") playTone(420, 0.12, "sine", 0.09, 640);
      if (kind === "bouton") playTone(240, 0.07, "triangle", 0.06, 300);
    },
    stop: () => {
      bass.stop();
      pad.stop();
      lfo.stop();
      void context.close();
    },
  };
}

export default function App() {
  const [holeIndex, setHoleIndex] = useState(0);
  const [scores, setScores] = useState(() => courses.map(() => 0));
  const [ball, setBall] = useState<Vec>(courses[0].tee);
  const [angle, setAngle] = useState(courses[0].startAngle);
  const [power, setPower] = useState(48);
  const [moving, setMoving] = useState(false);
  const [sunk, setSunk] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("Tirez depuis la balle pour viser, relâchez pour putter.");
  const [trail, setTrail] = useState<Vec[]>([]);
  const [animationTime, setAnimationTime] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [celebrationKey, setCelebrationKey] = useState(0);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const ballRef = useRef<Vec>(courses[0].tee);
  const velocityRef = useRef<Vec>(zeroVelocity);
  const previousShotRef = useRef<Vec>(courses[0].tee);
  const movingRef = useRef(false);
  const sunkRef = useRef(false);
  const audioRef = useRef<SoundEngine | null>(null);
  const lastBounceRef = useRef(0);
  const trailCounterRef = useRef(0);

  const hole = courses[holeIndex];
  const currentStrokes = scores[holeIndex];
  const totalStrokes = scores.reduce((sum, holeScore) => sum + holeScore, 0);
  const totalPar = courses.reduce((sum, courseHole) => sum + courseHole.par, 0);
  const playedPar = courses.reduce((sum, courseHole, index) => sum + (scores[index] > 0 ? courseHole.par : 0), 0);
  const totalRelative = playedPar === 0 ? 0 : totalStrokes - playedPar;
  const aimVector = useMemo(() => unitFromAngle(angle), [angle]);
  const courseComplete = sunk && holeIndex === courses.length - 1;
  const progress = ((holeIndex + (sunk ? 1 : 0)) / courses.length) * 100;

  const playSfx = useCallback((kind: SoundKind, intensity?: number) => {
    audioRef.current?.play(kind, intensity);
  }, []);

  const setMovingFlag = useCallback((value: boolean) => {
    if (movingRef.current !== value) {
      movingRef.current = value;
      setMoving(value);
    }
  }, []);

  const placeBallForHole = useCallback(
    (index: number, note?: string) => {
      const nextHole = courses[index];
      const tee = nextHole.tee;
      ballRef.current = { ...tee };
      previousShotRef.current = { ...tee };
      velocityRef.current = zeroVelocity;
      sunkRef.current = false;
      trailCounterRef.current = 0;
      setBall({ ...tee });
      setTrail([]);
      setSunk(false);
      setDragging(false);
      setMovingFlag(false);
      setAngle(nextHole.startAngle);
      setPower(48);
      setMessage(note ?? "Tirez depuis la balle pour viser, relâchez pour putter.");
    },
    [setMovingFlag],
  );

  useEffect(() => {
    placeBallForHole(holeIndex, `Niveau ${holeIndex + 1}: ${courses[holeIndex].name}. ${courses[holeIndex].subtitle}`);
    playSfx("niveau", 0.8);
  }, [holeIndex, placeBallForHole, playSfx]);

  useEffect(() => {
    sunkRef.current = sunk;
  }, [sunk]);

  useEffect(() => {
    const handleFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => audioRef.current?.stop();
  }, []);

  useEffect(() => {
    let frame = 0;
    let lastTime = performance.now();

    const step = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.034);
      lastTime = time;
      setAnimationTime(time / 1000);

      if (!sunkRef.current) {
        let position = ballRef.current;
        let velocity = velocityRef.current;
        let currentSpeed = speedOf(velocity);

        if (currentSpeed > 0.1) {
          position = {
            x: position.x + velocity.x * dt,
            y: position.y + velocity.y * dt,
          };

          if (position.x < BALL_RADIUS) {
            position.x = BALL_RADIUS;
            velocity = { ...velocity, x: Math.abs(velocity.x) * 0.76 };
            if (time - lastBounceRef.current > 90) {
              lastBounceRef.current = time;
              playSfx("rebond", currentSpeed / 900);
            }
          }
          if (position.x > WIDTH - BALL_RADIUS) {
            position.x = WIDTH - BALL_RADIUS;
            velocity = { ...velocity, x: -Math.abs(velocity.x) * 0.76 };
            if (time - lastBounceRef.current > 90) {
              lastBounceRef.current = time;
              playSfx("rebond", currentSpeed / 900);
            }
          }
          if (position.y < BALL_RADIUS) {
            position.y = BALL_RADIUS;
            velocity = { ...velocity, y: Math.abs(velocity.y) * 0.76 };
            if (time - lastBounceRef.current > 90) {
              lastBounceRef.current = time;
              playSfx("rebond", currentSpeed / 900);
            }
          }
          if (position.y > HEIGHT - BALL_RADIUS) {
            position.y = HEIGHT - BALL_RADIUS;
            velocity = { ...velocity, y: -Math.abs(velocity.y) * 0.76 };
            if (time - lastBounceRef.current > 90) {
              lastBounceRef.current = time;
              playSfx("rebond", currentSpeed / 900);
            }
          }

          const solidRects = [...hole.walls, ...hole.gates.map((gate) => gateAtTime(gate, time / 1000))];
          for (const wall of solidRects) {
            const collision = collisionWithRect(position, wall);
            if (collision) {
              position = {
                x: position.x + collision.nx * (collision.penetration + 0.3),
                y: position.y + collision.ny * (collision.penetration + 0.3),
              };
              velocity = reflectVelocity(velocity, collision.nx, collision.ny, 0.72);
              if (time - lastBounceRef.current > 90) {
                lastBounceRef.current = time;
                playSfx("rebond", currentSpeed / 900);
              }
            }
          }

          const roundObstacles: Bumper[] = [...hole.bumpers, ...hole.spinners];
          for (const bumper of roundObstacles) {
            const dx = position.x - bumper.x;
            const dy = position.y - bumper.y;
            const dist = Math.hypot(dx, dy);
            const minimum = BALL_RADIUS + bumper.r;
            if (dist < minimum) {
              const nx = dist > 0.0001 ? dx / dist : 1;
              const ny = dist > 0.0001 ? dy / dist : 0;
              position = {
                x: position.x + nx * (minimum - dist + 0.4),
                y: position.y + ny * (minimum - dist + 0.4),
              };
              velocity = reflectVelocity(velocity, nx, ny, 0.88);
              if (time - lastBounceRef.current > 70) {
                lastBounceRef.current = time;
                playSfx("rebond", currentSpeed / 820);
              }
            }
          }

          if (hole.water.some((water) => ballTouchesRect(position, water))) {
            const drop = previousShotRef.current;
            ballRef.current = { ...drop };
            velocityRef.current = zeroVelocity;
            setBall({ ...drop });
            setTrail([]);
            setScores((previous) => previous.map((score, index) => (index === holeIndex ? score + 1 : score)));
            setMessage("Plouf. Pénalité d'un coup et retour au dernier point joué.");
            setMovingFlag(false);
            playSfx("splash", 1);
            frame = requestAnimationFrame(step);
            return;
          }

          for (const slope of hole.slopes) {
            if (rectContainsPoint(slope, position)) {
              velocity = { x: velocity.x + slope.force.x * dt, y: velocity.y + slope.force.y * dt };
            }
          }

          const inSand = hole.sand.some((sand) => rectContainsPoint(sand, position));
          const friction = inSand ? 0.89 : 0.986;
          const frictionStep = Math.pow(friction, dt * 60);
          velocity = { x: velocity.x * frictionStep, y: velocity.y * frictionStep };
          currentSpeed = speedOf(velocity);

          if (distance(position, hole.cup) <= CUP_RADIUS - 2) {
            if (currentSpeed < 150) {
              position = { ...hole.cup };
              velocity = zeroVelocity;
              ballRef.current = position;
              velocityRef.current = velocity;
              setBall(position);
              setTrail([]);
              setSunk(true);
              setCelebrationKey((value) => value + 1);
              sunkRef.current = true;
              setMovingFlag(false);
              setMessage(
                holeIndex === courses.length - 1
                  ? "Dernier trou rentré. Parcours terminé."
                  : "Dans le trou. Passez au niveau suivant quand vous êtes prêt.",
              );
              playSfx("trou", 1);
              frame = requestAnimationFrame(step);
              return;
            }
            velocity = { x: velocity.x * 0.78, y: velocity.y * 0.78 };
          }

          if (currentSpeed < 8) {
            velocity = zeroVelocity;
            setMovingFlag(false);
            setMessage("Balle arrêtée. Ajustez l'angle et la puissance.");
          } else {
            setMovingFlag(true);
          }

          trailCounterRef.current += 1;
          if (trailCounterRef.current % 3 === 0) {
            setTrail((previous) => [...previous.slice(-10), { ...position }]);
          }
          ballRef.current = position;
          velocityRef.current = velocity;
          setBall({ ...position });
        }
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [hole, holeIndex, playSfx, setMovingFlag]);

  const addStroke = useCallback(
    (amount: number) => {
      setScores((previous) => previous.map((score, index) => (index === holeIndex ? score + amount : score)));
    },
    [holeIndex],
  );

  const shoot = useCallback(() => {
    if (movingRef.current || sunkRef.current) {
      return;
    }

    const direction = unitFromAngle(angle);
    const shotSpeed = 205 + power * 6.2;
    previousShotRef.current = { ...ballRef.current };
    velocityRef.current = { x: direction.x * shotSpeed, y: direction.y * shotSpeed };
    trailCounterRef.current = 0;
    setTrail([]);
    addStroke(1);
    setMovingFlag(true);
    setMessage("La balle roule.");
    playSfx("putt", power / MAX_POWER);
  }, [addStroke, angle, playSfx, power, setMovingFlag]);

  const getSvgPoint = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) {
      return null;
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }, []);

  const updateAimFromPoint = useCallback((point: Vec) => {
    const dx = point.x - ballRef.current.x;
    const dy = point.y - ballRef.current.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) {
      return;
    }
    const nextAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    setAngle(Math.round((nextAngle + 360) % 360));
    setPower(clamp(Math.round(dist / 2.1), 8, MAX_POWER));
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (moving || sunk) {
      return;
    }
    const point = getSvgPoint(event);
    if (!point || distance(point, ballRef.current) > 160) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateAimFromPoint(point);
    setMessage("Ligne de visée active. Relâchez pour jouer.");
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragging || moving || sunk) {
      return;
    }
    const point = getSvgPoint(event);
    if (point) {
      updateAimFromPoint(point);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragging) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    if (!movingRef.current && !sunkRef.current) {
      shoot();
    }
  };

  const takeDrop = () => {
    if (sunk || moving) {
      return;
    }
    const tee = hole.tee;
    ballRef.current = { ...tee };
    previousShotRef.current = { ...tee };
    velocityRef.current = zeroVelocity;
    setBall({ ...tee });
    setTrail([]);
    addStroke(1);
    setMessage("Drop joué. Un coup ajouté et la balle revient au départ.");
    playSfx("bouton", 1);
  };

  const goToNextHole = () => {
    if (!sunk || courseComplete) {
      return;
    }
    playSfx("bouton", 1);
    setHoleIndex((index) => Math.min(index + 1, courses.length - 1));
  };

  const restartCourse = () => {
    setScores(courses.map(() => 0));
    setHoleIndex(0);
    placeBallForHole(0, "Nouvelle carte de score. Tirez depuis la balle pour commencer.");
    playSfx("bouton", 1);
  };

  const toggleAudio = async () => {
    if (audioRef.current) {
      audioRef.current.stop();
      audioRef.current = null;
      setAudioEnabled(false);
      return;
    }

    const engine = createSoundEngine();
    if (!engine) {
      setMessage("Audio indisponible sur ce navigateur.");
      return;
    }
    audioRef.current = engine;
    if (engine.context.state === "suspended") {
      await engine.context.resume();
    }
    setAudioEnabled(true);
    engine.play("niveau", 1);
  };

  const toggleFullscreen = async () => {
    playSfx("bouton", 1);
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      return;
    }
    await document.exitFullscreen();
  };

  const aimEnd = {
    x: ball.x + aimVector.x * (64 + power * 1.3),
    y: ball.y + aimVector.y * (64 + power * 1.3),
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#030908] px-4 py-5 text-stone-50 sm:px-6 lg:px-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_16%,rgba(190,242,100,0.16),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(45,212,191,0.14),transparent_28%),linear-gradient(135deg,#03110c,#071915_58%,#020503)]" />
      <div className="firefly-field fixed inset-0 -z-10 opacity-70" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 lg:min-h-[calc(100vh-2.5rem)] lg:flex-row">
        <section className="course-shell level-enter relative flex flex-1 flex-col overflow-hidden rounded-[2rem] border border-emerald-200/15 bg-emerald-950/60 shadow-2xl shadow-black/40">
          <div className="absolute inset-x-0 top-0 h-1 bg-emerald-950">
            <div className="h-full bg-gradient-to-r from-lime-300 via-emerald-300 to-cyan-300 transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>

          <header className="relative z-10 flex flex-col gap-3 border-b border-emerald-200/10 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.36em] text-lime-300/80">Putt de Poche</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-5xl">{hole.name}</h1>
              <p className="mt-1 max-w-2xl text-sm text-emerald-50/65">{hole.subtitle}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-2xl bg-white/8 px-4 py-2 shadow-inner shadow-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/55">Niveau</p>
                <p className="text-xl font-black">{holeIndex + 1}/{courses.length}</p>
              </div>
              <div className="rounded-2xl bg-white/8 px-4 py-2 shadow-inner shadow-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/55">Par</p>
                <p className="text-xl font-black">{hole.par}</p>
              </div>
              <div className="rounded-2xl bg-white/8 px-4 py-2 shadow-inner shadow-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/55">Coups</p>
                <p className="text-xl font-black">{currentStrokes}</p>
              </div>
            </div>
          </header>

          <div className="relative flex-1 bg-[radial-gradient(circle_at_50%_45%,rgba(132,204,22,0.24),transparent_34%),linear-gradient(135deg,#103d20,#092416_70%)] p-2 sm:p-4">
            <svg
              ref={svgRef}
              className="h-full min-h-[390px] w-full select-none touch-none rounded-[1.45rem] border border-lime-200/20 bg-[#1a602d] shadow-inner shadow-black/50"
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-label="Mini-Golf interactif"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => setDragging(false)}
            >
              <defs>
                <pattern id="grain" width="42" height="42" patternUnits="userSpaceOnUse">
                  <path d="M0 24 C12 18 25 18 42 24" stroke="#2f7f3f" strokeWidth="2" fill="none" opacity="0.38" />
                  <path d="M0 8 C14 2 28 2 42 8" stroke="#85d365" strokeWidth="1.4" fill="none" opacity="0.28" />
                </pattern>
                <linearGradient id="greenGlow" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#b4f56b" stopOpacity="0.9" />
                  <stop offset="54%" stopColor="#62c85b" stopOpacity="0.84" />
                  <stop offset="100%" stopColor="#1c7e42" stopOpacity="0.86" />
                </linearGradient>
                <radialGradient id="ballGradient" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="58%" stopColor="#e8eef1" />
                  <stop offset="100%" stopColor="#9ba7af" />
                </radialGradient>
                <radialGradient id="cupGlow" cx="50%" cy="50%" r="65%">
                  <stop offset="0%" stopColor="#000000" />
                  <stop offset="70%" stopColor="#06100b" />
                  <stop offset="100%" stopColor="#a3e635" stopOpacity="0.45" />
                </radialGradient>
                <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#010503" floodOpacity="0.5" />
                </filter>
                <filter id="neon" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <rect width={WIDTH} height={HEIGHT} fill="#16572a" />
              <rect width={WIDTH} height={HEIGHT} fill="url(#grain)" opacity="0.82" />
              <path d={hole.fairway} fill="none" stroke="#082916" strokeWidth="154" strokeLinecap="round" opacity="0.32" />
              <path d={hole.fairway} fill="none" stroke="#4eaa49" strokeWidth="128" strokeLinecap="round" opacity="0.48" />
              <path d={hole.fairway} fill="none" stroke="url(#greenGlow)" strokeWidth="86" strokeLinecap="round" opacity="0.9" />
              <path d={hole.fairway} fill="none" stroke="#e8ff9d" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 17" opacity="0.45" />

              {hole.slopes.map((slope, index) => {
                const centerX = slope.x + slope.w / 2;
                const centerY = slope.y + slope.h / 2;
                const forceAngle = (Math.atan2(slope.force.y, slope.force.x) * 180) / Math.PI;
                return (
                  <g key={`slope-${index}`} className="slope-pulse" transform={`rotate(${forceAngle} ${centerX} ${centerY})`}>
                    <rect x={slope.x} y={slope.y} width={slope.w} height={slope.h} rx="22" fill="#d9f99d" opacity="0.2" />
                    <path
                      d={`M${slope.x + 24} ${centerY} L${slope.x + slope.w - 28} ${centerY} M${slope.x + slope.w - 46} ${centerY - 16} L${slope.x + slope.w - 28} ${centerY} L${slope.x + slope.w - 46} ${centerY + 16}`}
                      fill="none"
                      stroke="#ecfccb"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.65"
                    />
                  </g>
                );
              })}

              {hole.water.map((water, index) => (
                <g key={`water-${index}`} filter="url(#softShadow)">
                  <rect x={water.x} y={water.y} width={water.w} height={water.h} rx="24" fill="#075985" />
                  <rect x={water.x + 4} y={water.y + 4} width={water.w - 8} height={water.h - 8} rx="20" fill="#0ea5e9" opacity="0.62" />
                  {[0, 1, 2].map((wave) => (
                    <path
                      key={`wave-${wave}`}
                      className="water-wave"
                      d={`M${water.x + 12} ${water.y + 18 + wave * 18} C${water.x + 48} ${water.y + 2 + wave * 18} ${
                        water.x + 76
                      } ${water.y + 34 + wave * 18} ${water.x + water.w - 12} ${water.y + 18 + wave * 18}`}
                      fill="none"
                      stroke="#a5f3fc"
                      strokeWidth="4"
                      opacity="0.45"
                    />
                  ))}
                </g>
              ))}

              {hole.sand.map((sand, index) => (
                <g key={`sand-${index}`} filter="url(#softShadow)">
                  <rect x={sand.x} y={sand.y} width={sand.w} height={sand.h} rx="30" fill="#caa865" />
                  <rect x={sand.x + 7} y={sand.y + 7} width={sand.w - 14} height={sand.h - 14} rx="24" fill="#f4dc91" opacity="0.68" />
                  <path
                    d={`M${sand.x + 18} ${sand.y + sand.h - 22} C${sand.x + 54} ${sand.y + 8} ${sand.x + sand.w - 44} ${
                      sand.y + sand.h - 2
                    } ${sand.x + sand.w - 14} ${sand.y + 18}`}
                    fill="none"
                    stroke="#fff4bf"
                    strokeWidth="4"
                    opacity="0.48"
                  />
                </g>
              ))}

              {hole.walls.map((wall, index) => (
                <g key={`wall-${index}`} filter="url(#softShadow)">
                  <rect x={wall.x} y={wall.y} width={wall.w} height={wall.h} rx="8" fill="#3b2b22" />
                  <rect x={wall.x + 3} y={wall.y + 3} width={wall.w - 6} height={wall.h - 6} rx="6" fill="#6b4a35" />
                  <line x1={wall.x + 8} y1={wall.y + 8} x2={wall.x + wall.w - 8} y2={wall.y + wall.h - 8} stroke="#d6a766" strokeWidth="2" opacity="0.45" />
                </g>
              ))}

              {hole.gates.map((gate, index) => {
                const liveGate = gateAtTime(gate, animationTime);
                return (
                  <g key={`gate-${index}`} filter="url(#neon)">
                    <rect x={gate.x - 8} y={gate.y - 8} width={gate.w + 16} height={gate.h + 16} rx="14" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="6 8" opacity="0.28" />
                    <rect className="gate-light" x={liveGate.x} y={liveGate.y} width={liveGate.w} height={liveGate.h} rx="10" fill="#132e2b" stroke="#67e8f9" strokeWidth="4" />
                    <line x1={liveGate.x + 8} y1={liveGate.y + liveGate.h / 2} x2={liveGate.x + liveGate.w - 8} y2={liveGate.y + liveGate.h / 2} stroke="#d9f99d" strokeWidth="3" opacity="0.75" />
                  </g>
                );
              })}

              {hole.bumpers.map((bumper, index) => (
                <g key={`bumper-${index}`} filter="url(#softShadow)" className="bumper-breathe">
                  <circle cx={bumper.x} cy={bumper.y} r={bumper.r + 7} fill="#1e1b4b" opacity="0.45" />
                  <circle cx={bumper.x} cy={bumper.y} r={bumper.r} fill="#6d4ed4" stroke="#d6c8ff" strokeWidth="5" />
                  <circle cx={bumper.x - bumper.r * 0.22} cy={bumper.y - bumper.r * 0.22} r={bumper.r * 0.28} fill="#f0e7ff" opacity="0.72" />
                </g>
              ))}

              {hole.spinners.map((spinner, index) => {
                const rotation = animationTime * spinner.speed;
                return (
                  <g key={`spinner-${index}`} transform={`rotate(${rotation} ${spinner.x} ${spinner.y})`} filter="url(#softShadow)">
                    {Array.from({ length: spinner.blades }, (_, blade) => {
                      const bladeAngle = (360 / spinner.blades) * blade;
                      return (
                        <rect
                          key={`blade-${blade}`}
                          x={spinner.x - 7}
                          y={spinner.y - spinner.r - 38}
                          width="14"
                          height={spinner.r + 42}
                          rx="7"
                          fill="#fef3c7"
                          stroke="#b45309"
                          strokeWidth="3"
                          transform={`rotate(${bladeAngle} ${spinner.x} ${spinner.y})`}
                          opacity="0.88"
                        />
                      );
                    })}
                    <circle cx={spinner.x} cy={spinner.y} r={spinner.r} fill="#7c2d12" stroke="#fed7aa" strokeWidth="5" />
                    <circle cx={spinner.x} cy={spinner.y} r="8" fill="#fff7ed" />
                  </g>
                );
              })}

              <circle cx={hole.tee.x} cy={hole.tee.y} r="22" fill="none" stroke="#f7fee7" strokeWidth="3" strokeDasharray="6 7" className="tee-ring" />

              <g filter="url(#softShadow)">
                <circle className={sunk ? "cup-made" : "cup-pulse"} cx={hole.cup.x} cy={hole.cup.y} r={CUP_RADIUS + 11} fill="#a3e635" opacity="0.24" />
                <circle cx={hole.cup.x} cy={hole.cup.y} r={CUP_RADIUS} fill="url(#cupGlow)" />
                <circle cx={hole.cup.x} cy={hole.cup.y} r={CUP_RADIUS - 8} fill="#000000" />
                <line x1={hole.cup.x + 8} y1={hole.cup.y - 4} x2={hole.cup.x + 8} y2={hole.cup.y - 68} stroke="#fff7d6" strokeWidth="4" />
                <path d={`M${hole.cup.x + 10} ${hole.cup.y - 68} L${hole.cup.x + 58} ${hole.cup.y - 54} L${hole.cup.x + 10} ${hole.cup.y - 42} Z`} fill="#ef4444" />
              </g>

              {trail.map((point, index) => (
                <circle key={`trail-${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={3 + index * 0.28} fill="#ecfccb" opacity={(index + 1) / 18} />
              ))}

              {!moving && !sunk && (
                <g opacity={dragging ? 1 : 0.88}>
                  <line
                    className="aim-line"
                    x1={ball.x}
                    y1={ball.y}
                    x2={aimEnd.x}
                    y2={aimEnd.y}
                    stroke="#f4ff9e"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray="12 10"
                  />
                  <circle className="aim-dot" cx={aimEnd.x} cy={aimEnd.y} r={8 + power * 0.055} fill="#f4ff9e" opacity="0.94" />
                </g>
              )}

              {sunk && (
                <g key={`confetti-${celebrationKey}`}>
                  {confetti.map((piece) => (
                    <circle
                      key={piece.id}
                      className="confetti-dot"
                      cx={hole.cup.x}
                      cy={hole.cup.y}
                      r="4"
                      fill={piece.id % 3 === 0 ? "#bef264" : piece.id % 3 === 1 ? "#67e8f9" : "#fca5a5"}
                      style={{
                        transformOrigin: `${hole.cup.x}px ${hole.cup.y}px`,
                        transform: `translate(${piece.dx}px, ${piece.dy}px)`,
                        animationDelay: `${piece.delay}s`,
                      }}
                    />
                  ))}
                </g>
              )}

              <g filter="url(#softShadow)" className={moving ? "ball-roll" : ""}>
                <circle className="ball-glow" cx={ball.x} cy={ball.y} r={BALL_RADIUS + 9} fill="#ecfccb" opacity="0.18" />
                <circle cx={ball.x} cy={ball.y} r={BALL_RADIUS} fill="url(#ballGradient)" stroke="#ffffff" strokeWidth="2" />
                <circle cx={ball.x - 3} cy={ball.y - 3} r="2.4" fill="#ffffff" />
              </g>
            </svg>

            <div className="pointer-events-none absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-50/75">
              <span>{moving ? "Balle en mouvement" : sunk ? "Trou validé" : dragging ? "Relâchez pour putter" : "Prêt"}</span>
              <span>Eau +1, sable ralentit, rails et moulins rebondissent</span>
            </div>
          </div>
        </section>

        <aside className="w-full space-y-4 lg:w-[365px]">
          <section className="panel-pop rounded-[1.75rem] border border-lime-200/10 bg-white/[0.075] p-5 shadow-xl shadow-black/25 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-lime-300/75">Commandes</p>
                <h2 className="mt-1 text-2xl font-black">Visée et puissance</h2>
              </div>
              <div className="rounded-full bg-lime-300 px-3 py-1 text-sm font-black text-emerald-950">{power}%</div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/18 p-3 text-sm text-emerald-50/75">
              <p className="font-bold text-white">{difficultyLabel(hole.difficulty)}</p>
              <p className="mt-1">Difficulté {hole.difficulty}/5 avec obstacles progressifs et trajectoires de plus en plus serrées.</p>
            </div>

            <div className="mt-5 space-y-5">
              <label className="block">
                <span className="flex items-center justify-between text-sm text-emerald-50/75">
                  <span>Angle de visée</span>
                  <span>{angle}°</span>
                </span>
                <input
                  className="mt-2 w-full accent-lime-300"
                  type="range"
                  min="0"
                  max="359"
                  value={angle}
                  disabled={moving || sunk}
                  onChange={(event) => setAngle(Number(event.target.value))}
                />
              </label>

              <label className="block">
                <span className="flex items-center justify-between text-sm text-emerald-50/75">
                  <span>Puissance</span>
                  <span>{power}%</span>
                </span>
                <input
                  className="mt-2 w-full accent-lime-300"
                  type="range"
                  min="8"
                  max={MAX_POWER}
                  value={power}
                  disabled={moving || sunk}
                  onChange={(event) => setPower(Number(event.target.value))}
                />
              </label>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                className="rounded-2xl bg-lime-300 px-4 py-3 text-sm font-black text-emerald-950 transition hover:-translate-y-0.5 hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/35 disabled:hover:translate-y-0"
                type="button"
                disabled={moving || sunk}
                onClick={shoot}
              >
                Putter
              </button>
              <button
                className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/35 disabled:hover:translate-y-0"
                type="button"
                disabled={moving || sunk}
                onClick={takeDrop}
              >
                Replacer +1
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-50 transition hover:bg-cyan-300/18"
                type="button"
                onClick={toggleAudio}
              >
                {audioEnabled ? "Audio activé" : "Activer audio"}
              </button>
              <button
                className="rounded-2xl border border-lime-200/20 bg-lime-300/10 px-4 py-3 text-sm font-bold text-lime-50 transition hover:bg-lime-300/18"
                type="button"
                onClick={toggleFullscreen}
              >
                {fullscreen ? "Quitter plein écran" : "Plein écran"}
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-black/18 px-3 py-3">
              <div className={`sound-bars ${audioEnabled ? "is-on" : ""}`} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p className="min-h-10 text-sm leading-5 text-emerald-50/75">{message}</p>
            </div>

            {sunk && !courseComplete && (
              <button
                className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-emerald-950 transition hover:-translate-y-0.5 hover:bg-lime-100"
                type="button"
                onClick={goToNextHole}
              >
                Niveau suivant
              </button>
            )}

            {courseComplete && (
              <button
                className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-emerald-950 transition hover:-translate-y-0.5 hover:bg-lime-100"
                type="button"
                onClick={restartCourse}
              >
                Rejouer le parcours
              </button>
            )}
          </section>

          <section className="panel-pop rounded-[1.75rem] border border-lime-200/10 bg-white/[0.075] p-5 shadow-xl shadow-black/25 backdrop-blur-xl">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-lime-300/75">Carte de score</p>
                <h2 className="mt-1 text-2xl font-black">{totalStrokes} coups</h2>
              </div>
              <div className="text-right">
                <p className="text-sm text-emerald-50/55">Score au par</p>
                <p className="text-2xl font-black">{formatToPar(totalRelative)}</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/8 text-xs uppercase tracking-[0.18em] text-emerald-50/55">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Niv.</th>
                    <th className="px-3 py-3 font-semibold">Par</th>
                    <th className="px-3 py-3 font-semibold">Coups</th>
                    <th className="px-3 py-3 font-semibold">Résultat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {courses.map((courseHole, index) => {
                    const score = scores[index];
                    const active = index === holeIndex;
                    const complete = score > 0 && (index < holeIndex || (active && sunk));
                    return (
                      <tr key={courseHole.name} className={active ? "bg-lime-300/10" : undefined}>
                        <td className="px-3 py-3 font-bold text-white">{index + 1}</td>
                        <td className="px-3 py-3 text-emerald-50/70">{courseHole.par}</td>
                        <td className="px-3 py-3 text-emerald-50/90">{score || (active ? currentStrokes : "-")}</td>
                        <td className="px-3 py-3 text-emerald-50/70">
                          {complete ? scoreName(score, courseHole.par) : active ? "En cours" : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-emerald-50/70">
              <span>Par total {totalPar}</span>
              <button className="font-bold text-lime-200 transition hover:text-white" type="button" onClick={restartCourse}>
                Recommencer
              </button>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-lime-200/10 bg-gradient-to-br from-lime-300/15 to-cyan-300/10 p-5 text-sm text-emerald-50/75 shadow-xl shadow-black/20 backdrop-blur-xl">
            <p className="font-black uppercase tracking-[0.24em] text-lime-200">Créateur</p>
            <p className="mt-2 text-base text-white">Hylst - Geoffroy avec l'aide d'une IA</p>
            <p className="mt-2">Conseil: sur les niveaux difficiles, attendez le bon rythme des portes mobiles avant de jouer.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}