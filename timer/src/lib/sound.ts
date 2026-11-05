/**
 * Tiny synthesized sound palette.
 *
 * Everything is generated with the Web Audio API so there are no audio files
 * to download, cache or decode. The cues are intentionally soft and short:
 * they should read as feedback texture, not as notification jingles.
 */

export type SoundCue =
  | "start"
  | "pause"
  | "reset"
  | "set"
  | "preset"
  | "apply"
  | "mode"
  | "focus-in"
  | "focus-out"
  | "tick"
  | "type"
  | "complete";

export type TickVariant =
  | "glass"
  | "soft"
  | "blip"
  | "morse"
  | "watch"
  | "wood"
  | "switch"
  | "bubble"
  | "drop"
  | "confirm";

export const TICK_VARIANTS: { id: TickVariant; name: string; description: string }[] = [
  { id: "glass", name: "Glass Tick", description: "Bright, tiny and clean — the current default." },
  { id: "soft", name: "Soft Tap", description: "Rounder and lower, with less digital edge." },
  { id: "blip", name: "Digital Blip", description: "A quick electronic blip with a short tail." },
  { id: "morse", name: "Morse Click", description: "Sharp, radio-style transient." },
  { id: "watch", name: "Watch Tick", description: "Precise mechanical tick." },
  { id: "wood", name: "Woodblock", description: "Warm wooden knock with a small snap." },
  { id: "switch", name: "Mechanical Switch", description: "Two-stage click, like a real button." },
  { id: "bubble", name: "Bubble Pop", description: "Fast upward pitch pop." },
  { id: "drop", name: "Water Drop", description: "Soft descending plink." },
  { id: "confirm", name: "UI Confirm", description: "Two quick ticks in succession." },
];

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let tickVariant: TickVariant = "glass";

export function setSoundEnabled(next: boolean) {
  enabled = next;
  if (!ctx || !master) return;

  // Duck the master gain so muting silences anything already ringing out.
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(next ? 0.5 : 0.0001, now, 0.02);
}

/** Lazily build the audio graph on the first cue (always inside a gesture). */
function getContext(): AudioContext | null {
  if (!enabled) return null;

  if (!ctx) {
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return null;

    ctx = new Ctor();

    // Gentle top-end roll-off keeps the synthesized tones from feeling sharp.
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 11000;
    filter.Q.value = 0.5;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(filter).connect(compressor).connect(ctx.destination);
  }

  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type ToneOptions = {
  freq: number;
  at?: number;
  duration?: number;
  gain?: number;
  type?: OscillatorType;
  slideTo?: number;
  attack?: number;
  detune?: number;
  pan?: number;
};

/** A single enveloped oscillator. */
function tone(c: AudioContext, options: ToneOptions) {
  if (!master) return;

  const t0 = c.currentTime + (options.at ?? 0);
  const duration = options.duration ?? 0.2;
  const peak = options.gain ?? 0.1;
  const attack = options.attack ?? 0.012;

  const osc = c.createOscillator();
  osc.type = options.type ?? "sine";
  osc.frequency.setValueAtTime(options.freq, t0);
  if (options.slideTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.slideTo), t0 + duration);
  }
  if (options.detune) osc.detune.value = options.detune;

  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  let output: AudioNode = env;
  if (typeof c.createStereoPanner === "function") {
    const panner = c.createStereoPanner();
    panner.pan.value = options.pan ?? 0;
    env.connect(panner);
    output = panner;
  }

  osc.connect(env);
  output.connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** A small, high, quiet click. */
function click(c: AudioContext, at: number, freq: number, gain: number, duration = 0.03) {
  tone(c, { freq, at, duration, gain, type: "triangle", attack: 0.004 });
}

/** Short bandpass noise burst for mechanical ticks. */
function noiseBurst(
  c: AudioContext,
  at: number,
  duration: number,
  gain: number,
  freq: number,
  q = 1,
) {
  if (!master) return;

  const t0 = c.currentTime + at;
  const frames = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;

  const source = c.createBufferSource();
  source.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;

  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.0015);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  source.connect(filter).connect(env).connect(master);
  source.start(t0);
  source.stop(t0 + duration + 0.01);
}

/**
 * A modern synth pluck: bright transient, rounded triangle body and a quiet
 * sub octave so taps feel tactile instead of tiny.
 */
function pluck(c: AudioContext, freq: number, at: number, duration: number, gain: number, pan = 0) {
  tone(c, { freq, at, duration, gain, type: "triangle", attack: 0.002, pan });
  tone(c, {
    freq: freq * 2,
    at: at + 0.002,
    duration: duration * 0.45,
    gain: gain * 0.16,
    type: "sine",
    attack: 0.001,
    pan: pan === 0 ? 0.18 : -pan,
  });
  tone(c, {
    freq: freq / 2,
    at,
    duration: duration * 0.85,
    gain: gain * 0.2,
    type: "sine",
    attack: 0.003,
    pan: pan * 0.5,
  });
}

const tickCues: Record<TickVariant, (c: AudioContext) => void> = {
  glass(c) {
    click(c, 0, 2200, 0.03, 0.012);
  },
  soft(c) {
    tone(c, { freq: 1500, duration: 0.05, gain: 0.035, type: "sine", attack: 0.006 });
  },
  blip(c) {
    click(c, 0, 2800, 0.022, 0.016);
    tone(c, { freq: 1900, duration: 0.02, gain: 0.012, type: "triangle", attack: 0.002 });
  },
  morse(c) {
    noiseBurst(c, 0, 0.012, 0.03, 4200, 0.8);
    click(c, 0, 3000, 0.018, 0.01);
  },
  watch(c) {
    noiseBurst(c, 0, 0.009, 0.032, 3200, 1.1);
    tone(c, { freq: 2600, duration: 0.014, gain: 0.02, type: "triangle", attack: 0.001 });
  },
  wood(c) {
    tone(c, { freq: 900, duration: 0.05, gain: 0.04, type: "triangle", slideTo: 720 });
    noiseBurst(c, 0, 0.014, 0.02, 1400, 1.2);
  },
  switch(c) {
    click(c, 0, 1800, 0.026, 0.012);
    click(c, 0.018, 2400, 0.02, 0.01);
  },
  bubble(c) {
    tone(c, { freq: 700, duration: 0.05, gain: 0.045, slideTo: 1500, attack: 0.004 });
  },
  drop(c) {
    tone(c, { freq: 1400, duration: 0.06, gain: 0.038, slideTo: 820, attack: 0.003 });
  },
  confirm(c) {
    click(c, 0, 2200, 0.024, 0.012);
    click(c, 0.055, 2900, 0.02, 0.012);
  },
};

function scheduleTick(c: AudioContext) {
  tickCues[tickVariant](c);
}

export function isTickVariant(value: unknown): value is TickVariant {
  return typeof value === "string" && value in tickCues;
}

export function setTickVariant(next: string | undefined) {
  if (isTickVariant(next)) tickVariant = next;
}

export function getTickVariant(): TickVariant {
  return tickVariant;
}

/** Play a specific tick without changing the saved selection. */
export function previewTick(variant: TickVariant = tickVariant) {
  const c = getContext();
  if (!c) return;
  try {
    tickCues[variant](c);
  } catch {
    // Audio is a nicety — never let it break the UI.
  }
}

/** Play the currently selected tick. */
export function playTick() {
  previewTick(tickVariant);
}

const cues: Record<SoundCue, (c: AudioContext) => void> = {
  start: scheduleTick,
  pause: scheduleTick,
  reset: scheduleTick,
  set: scheduleTick,
  preset: scheduleTick,
  apply: scheduleTick,
  mode: scheduleTick,
  "focus-in": scheduleTick,
  "focus-out": scheduleTick,
  tick: scheduleTick,
  type: scheduleTick,
  complete(c) {
    const notes = [
      { freq: 659.25, at: 0, duration: 0.5, gain: 0.075 },
      { freq: 987.77, at: 0.11, duration: 0.65, gain: 0.07 },
      { freq: 1318.51, at: 0.23, duration: 1, gain: 0.065 },
    ];
    notes.forEach((note) => pluck(c, note.freq, note.at, note.duration, note.gain));
    tone(c, { freq: 164.81, at: 0, duration: 0.5, gain: 0.05, slideTo: 123.47 });
    // Modern delay-style echoes instead of a heavy bell tail.
    pluck(c, 987.77, 0.95, 1.1, 0.03);
    pluck(c, 1318.51, 1.12, 1.4, 0.025);
  },
};

/**
 * Prime the audio context inside a user gesture. This lets a timer that was
 * restored from storage still chime when it finishes later.
 */
export function unlockSound() {
  getContext();
}

export function playSound(cue: SoundCue) {
  const c = getContext();
  if (!c || !master) return;
  try {
    cues[cue](c);
  } catch {
    // Audio is a nicety — never let it break the timer.
  }
}
