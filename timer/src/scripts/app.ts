import { formatHMS, formatHMSC, splitMs, clampDuration } from "../lib/time";
import { load, save } from "../lib/persist";
import { setWakeLock } from "../lib/wakeLock";
import { playSound, setSoundEnabled, setTickVariant, unlockSound } from "../lib/sound";

type Mode = "timer" | "clock" | "stopwatch";
type Persisted = {
  mode?: Mode;
  font?: string;
  hour12?: boolean;
  sound?: boolean;
  tick?: string;
  timer?: { durationSec: number; remainingMs?: number; running?: boolean; endAt?: number };
  stopwatch?: { elapsedMs: number; running: boolean; startAt?: number };
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * Update a hero display and expose its character count to CSS.
 * The mobile layout uses --chars to scale each display so it always fits
 * the viewport, no matter whether the string is "25:00" or "1:00:00.00".
 */
function setDisplay(el: HTMLElement, text: string) {
  if (el.textContent !== text) el.textContent = text;
  const chars = String(text.length);
  if (el.dataset.chars !== chars) {
    el.dataset.chars = chars;
    el.style.setProperty("--chars", chars);
  }
}

const appShell = $<HTMLElement>("app-shell");
const status = $<HTMLElement>("status");

const modeTrigger = $<HTMLButtonElement>("mode-trigger");
const modePanel = $<HTMLDivElement>("mode-panel");
const modeTriggerLabel = $<HTMLSpanElement>("mode-trigger-label");
const modeItems = Array.from(document.querySelectorAll<HTMLElement>(".mode-item"));
const viewSections = Array.from(document.querySelectorAll<HTMLElement>(".view-section"));

const timerDisplay = $<HTMLElement>("timer-display");
const timerEyebrow = $<HTMLElement>("timer-eyebrow");
const timerStart = $<HTMLButtonElement>("timer-start");
const timerStartLabel = $<HTMLSpanElement>("timer-start-label");
const timerReset = $<HTMLButtonElement>("timer-reset");
const timerSet = $<HTMLButtonElement>("timer-set");

const durationDialog = $<HTMLDialogElement>("duration-dialog");
const durationClose = $<HTMLButtonElement>("duration-close");
const durH = $<HTMLInputElement>("dur-h");
const durM = $<HTMLInputElement>("dur-m");
const durS = $<HTMLInputElement>("dur-s");
const durationApply = $<HTMLButtonElement>("duration-apply");
const durationSet = $<HTMLButtonElement>("duration-set");
const presetChips = Array.from(document.querySelectorAll<HTMLElement>(".preset-chip"));

const clockDisplay = $<HTMLElement>("clock-display");
const clockSeconds = $<HTMLElement>("clock-seconds");
const clockEyebrow = $<HTMLElement>("clock-eyebrow");
const clockDate = $<HTMLElement>("clock-date");
const clockFormatBtns = Array.from(document.querySelectorAll<HTMLElement>("[data-clock-format]"));

const swDisplay = $<HTMLElement>("stopwatch-display");
const swStart = $<HTMLButtonElement>("sw-start");
const swStartLabel = $<HTMLSpanElement>("sw-start-label");
const swReset = $<HTMLButtonElement>("sw-reset");

const fontChips = Array.from(document.querySelectorAll<HTMLElement>("[data-font]"));
const soundToggle = $<HTMLButtonElement>("sound-toggle");
const focusToggle = $<HTMLButtonElement>("focus-toggle");
const focusHint = $<HTMLElement>("focus-hint");
const focusControls = $<HTMLElement>("focus-controls");
const focusRun = $<HTMLButtonElement>("focus-run");
const focusRunLabel = $<HTMLSpanElement>("focus-run-label");

const persisted = load<Persisted>();

/* ------------------------------------------------------------------ mode */

let mode: Mode = persisted.mode ?? "timer";

function setMode(next: Mode, options: { focusTrigger?: boolean; playCue?: boolean } = {}) {
  const changed = mode !== next;
  mode = next;

  modeItems.forEach((item) => {
    const active = item.dataset.mode === next;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-selected", active ? "true" : "false");
  });

  viewSections.forEach((section) => {
    section.classList.toggle("is-visible", section.dataset.view === next);
  });

  modeTriggerLabel.textContent = next === "timer" ? "Timer" : next === "clock" ? "Clock" : "Stopwatch";
  closeMenu();
  save({ mode: next });

  if (location.hash !== `#${next}`) {
    history.replaceState(null, "", `#${next}`);
  }

  updateDocumentTitle();
  if (next === "timer") renderTimer();
  else if (next === "clock") renderClock();
  else renderStopwatch();
  updateWakeLock();
  syncFocusRun();
  if (changed && options.playCue !== false) playSound("mode");
  if (options.focusTrigger) modeTrigger.focus();
}

function openMenu() {
  modePanel.classList.add("is-open");
  modeTrigger.classList.add("is-open");
  modeTrigger.setAttribute("aria-expanded", "true");
}

function closeMenu(options: { restoreFocus?: boolean } = {}) {
  const wasOpen = modePanel.classList.contains("is-open");
  modePanel.classList.remove("is-open");
  modeTrigger.classList.remove("is-open");
  modeTrigger.setAttribute("aria-expanded", "false");
  if (wasOpen && options.restoreFocus) modeTrigger.focus();
}

modeTrigger.addEventListener("click", (event) => {
  event.stopPropagation();
  if (modePanel.classList.contains("is-open")) closeMenu();
  else openMenu();
});

document.addEventListener("click", () => closeMenu());
modePanel.addEventListener("click", (event) => event.stopPropagation());

modeItems.forEach((item) => {
  item.addEventListener("click", () => {
    const next = item.dataset.mode as Mode | undefined;
    if (next) setMode(next, { focusTrigger: true });
  });
});

modeTrigger.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openMenu();
    (modeItems.find((i) => i.classList.contains("is-active")) ?? modeItems[0])?.focus();
  }
});

modePanel.addEventListener("keydown", (event) => {
  const index = modeItems.indexOf(document.activeElement as HTMLElement);
  if (index === -1) return;

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    modeItems[(index + delta + modeItems.length) % modeItems.length]?.focus();
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    modeItems[event.key === "Home" ? 0 : modeItems.length - 1]?.focus();
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeMenu({ restoreFocus: true });
  } else if (event.key === "Tab") {
    closeMenu();
  }
});

/* ----------------------------------------------------------------- timer */

const MAX_DURATION_SEC = 99 * 3600 + 59 * 60 + 59;

let timerDurationSec = clampDuration(persisted.timer?.durationSec ?? 25 * 60);
if (timerDurationSec === 0) timerDurationSec = 25 * 60;

let timerRemainingMs = Math.max(0, persisted.timer?.remainingMs ?? timerDurationSec * 1000);
let timerRunning = false;
let timerEndAt = 0;

if (persisted.timer?.running && persisted.timer.endAt) {
  timerRemainingMs = Math.max(0, persisted.timer.endAt - Date.now());
  if (timerRemainingMs > 0) {
    timerRunning = true;
    timerEndAt = persisted.timer.endAt;
  }
}

let timerFinished = !timerRunning && timerRemainingMs <= 0 && persisted.timer !== undefined;

function renderTimer() {
  if (timerRunning) {
    timerRemainingMs = Math.max(0, timerEndAt - Date.now());
    if (timerRemainingMs === 0) {
      timerRunning = false;
      timerFinished = true;
      timerEndAt = 0;
      save({ timer: { durationSec: timerDurationSec, remainingMs: 0, running: false, endAt: 0 } });
      announce("Timer finished");
      playSound("complete");
    }
  }

  setDisplay(timerDisplay, formatHMS(timerRemainingMs, false));

  if (timerFinished) {
    timerEyebrow.textContent = "TIME'S UP";
    timerStartLabel.textContent = "Restart";
    timerStart.classList.remove("is-paused");
  } else if (timerRunning) {
    timerEyebrow.textContent = "TIMER";
    timerStartLabel.textContent = "Pause";
    timerStart.classList.add("is-paused");
  } else {
    timerEyebrow.textContent = "TIMER";
    timerStartLabel.textContent = timerRemainingMs < timerDurationSec * 1000 ? "Resume" : "Start";
    timerStart.classList.remove("is-paused");
  }

  updateDocumentTitle();
  updateWakeLock();
  syncFocusRun();
}

function startTimer() {
  if (timerRemainingMs <= 0) {
    timerRemainingMs = timerDurationSec * 1000;
    timerFinished = false;
  }
  timerEndAt = Date.now() + timerRemainingMs;
  timerRunning = true;
  save({ timer: { durationSec: timerDurationSec, remainingMs: timerRemainingMs, running: true, endAt: timerEndAt } });
  announce("Timer started");
}

function pauseTimer() {
  timerRemainingMs = Math.max(0, timerEndAt - Date.now());
  timerRunning = false;
  timerEndAt = 0;
  save({ timer: { durationSec: timerDurationSec, remainingMs: timerRemainingMs, running: false, endAt: 0 } });
  announce("Timer paused");
}

function resetTimer() {
  timerRunning = false;
  timerFinished = false;
  timerEndAt = 0;
  timerRemainingMs = timerDurationSec * 1000;
  save({ timer: { durationSec: timerDurationSec, remainingMs: timerRemainingMs, running: false, endAt: 0 } });
  announce("Timer reset");
}

timerStart.addEventListener("click", () => {
  const wasRunning = timerRunning;
  if (wasRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
  playSound(wasRunning ? "pause" : "start");
  renderTimer();
});

timerReset.addEventListener("click", () => {
  resetTimer();
  playSound("reset");
  renderTimer();
});

function writeDurationIntoDialog(totalSeconds: number) {
  const { hours, minutes, seconds } = splitMs(totalSeconds * 1000);
  durH.value = String(hours);
  durM.value = String(minutes);
  durS.value = String(seconds);
}

timerSet.addEventListener("click", () => {
  writeDurationIntoDialog(timerDurationSec);
  if (!durationDialog.open) durationDialog.showModal();
});

durationClose.addEventListener("click", () => durationDialog.close());

durationDialog.addEventListener("click", (event) => {
  if (event.target === durationDialog) durationDialog.close();
});

presetChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    writeDurationIntoDialog(clampDuration(Number(chip.dataset.preset ?? 0)));
    playSound("preset");
    // Presets are one-tap choices — don't focus the inputs, otherwise mobile
    // browsers open the numeric keypad.
    (document.activeElement as HTMLElement | null)?.blur();
  });
});

durationApply.addEventListener("click", () => applyDuration(true));
durationSet.addEventListener("click", () => applyDuration(false));

function applyDuration(startImmediately: boolean) {
  const hours = Math.min(99, Math.max(0, Math.floor(Number(durH.value || 0))));
  const minutes = Math.min(59, Math.max(0, Math.floor(Number(durM.value || 0))));
  const seconds = Math.min(59, Math.max(0, Math.floor(Number(durS.value || 0))));
  const total = clampDuration(hours * 3600 + minutes * 60 + seconds);

  timerDurationSec = Math.max(1, total);
  resetTimer();
  if (startImmediately) startTimer();
  renderTimer();
  durationDialog.close();
  playSound("apply");
  announce(`Timer set to ${formatHMS(timerDurationSec * 1000, false)}`);
}

[durH, durM, durS].forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      durationApply.click();
    }
  });
});

/* ----------------------------------------------------------------- clock */

let hour12 = persisted.hour12 ?? true;

function renderClock() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12,
  }).formatToParts(now);

  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";

  setDisplay(clockDisplay, `${pick("hour")}:${pick("minute")}`);
  clockSeconds.textContent = `:${pick("second")}`;
  clockEyebrow.textContent = hour12 ? `CLOCK · ${pick("dayPeriod")}` : "CLOCK";
  clockDate.textContent = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function syncClockFormatButtons() {
  clockFormatBtns.forEach((button) => {
    const isActive = (button.dataset.clockFormat === "12") === hour12;
    button.classList.toggle("is-selected", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

clockFormatBtns.forEach((button) => {
  button.addEventListener("click", () => {
    hour12 = button.dataset.clockFormat === "12";
    save({ hour12 });
    syncClockFormatButtons();
    renderClock();
    playSound("tick");
    announce(hour12 ? "12-hour clock" : "24-hour clock");
  });
});

/* ------------------------------------------------------------- stopwatch */

let swElapsedMs = Math.max(0, persisted.stopwatch?.elapsedMs ?? 0);
let swRunning = false;
let swStartAt = 0;

if (persisted.stopwatch?.running && persisted.stopwatch.startAt) {
  swElapsedMs = Math.max(0, Date.now() - persisted.stopwatch.startAt);
  swRunning = true;
  swStartAt = persisted.stopwatch.startAt;
}

function renderStopwatch() {
  if (swRunning) swElapsedMs = Math.max(0, Date.now() - swStartAt);
  setDisplay(swDisplay, formatHMSC(swElapsedMs, swElapsedMs >= 3600 * 1000));
  if (swRunning) {
    swStartLabel.textContent = "Pause";
    swStart.classList.add("is-paused");
  } else {
    swStartLabel.textContent = swElapsedMs > 0 ? "Resume" : "Start";
    swStart.classList.remove("is-paused");
  }
  updateWakeLock();
  syncFocusRun();
}

swStart.addEventListener("click", () => {
  const wasRunning = swRunning;
  if (wasRunning) {
    swElapsedMs = Math.max(0, Date.now() - swStartAt);
    swRunning = false;
    save({ stopwatch: { elapsedMs: swElapsedMs, running: false, startAt: swStartAt } });
    announce("Stopwatch paused");
  } else {
    swStartAt = Date.now() - swElapsedMs;
    swRunning = true;
    save({ stopwatch: { elapsedMs: swElapsedMs, running: true, startAt: swStartAt } });
    announce("Stopwatch started");
  }
  playSound(wasRunning ? "pause" : "start");
  renderStopwatch();
});

swReset.addEventListener("click", () => {
  swRunning = false;
  swElapsedMs = 0;
  swStartAt = 0;
  save({ stopwatch: { elapsedMs: 0, running: false, startAt: 0 } });
  playSound("reset");
  renderStopwatch();
  announce("Stopwatch reset");
});

/* ----------------------------------------------------------- type + title */

function updateWakeLock() {
  const active =
    (mode === "timer" && timerRunning) ||
    (mode === "stopwatch" && swRunning);
  setWakeLock(active);
}

const FONTS = ["jetbrains", "dm-mono", "ibm-plex", "space-mono", "manrope", "sf-pro"];

function applyFont(font: string) {
  const chosen = FONTS.includes(font) ? font : "jetbrains";
  [timerDisplay, clockDisplay, swDisplay].forEach((el) => {
    FONTS.forEach((f) => el.classList.remove(`font-${f}`));
    el.classList.add(`font-${chosen}`);
  });
  fontChips.forEach((chip) => {
    const selected = chip.dataset.font === chosen;
    chip.classList.toggle("is-selected", selected);
    chip.setAttribute("aria-checked", selected ? "true" : "false");
  });
  save({ font: chosen });
}

fontChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const font = chip.dataset.font;
    if (!font) return;
    const changed = !chip.classList.contains("is-selected");
    applyFont(font);
    if (changed) playSound("type");
  });
});

function updateDocumentTitle() {
  if (timerFinished) {
    document.title = "Time's up — Studytimer4you";
  } else if (mode === "timer" && timerRunning) {
    document.title = `${formatHMS(timerRemainingMs, false)} — Studytimer4you`;
  } else {
    document.title = "Studytimer4you";
  }
}

/* ------------------------------------------------------------- focus mode */

let lastFocusRunState = "";

/**
 * Focus mode hides the regular controls, so show a single tap target that
 * pauses/resumes the timer or stopwatch without leaving focus mode.
 */
function syncFocusRun() {
  if (mode === "clock") {
    focusControls.hidden = true;
    return;
  }
  focusControls.hidden = false;

  let label: string;
  if (mode === "timer") {
    if (timerRunning) label = "Pause";
    else if (timerFinished) label = "Restart";
    else if (timerRemainingMs < timerDurationSec * 1000) label = "Resume";
    else label = "Start";
  } else {
    label = swRunning ? "Pause" : swElapsedMs > 0 ? "Resume" : "Start";
  }

  const running = mode === "timer" ? timerRunning : swRunning;
  const state = `${mode}:${running}:${label}`;
  if (state === lastFocusRunState) return;
  lastFocusRunState = state;

  focusRunLabel.textContent = label;
  focusRun.classList.toggle("is-running", running);
  focusRun.setAttribute("aria-label", `${label} ${mode}`);
}

async function enterFocus() {
  lastStageTap = 0;
  playSound("focus-in");
  appShell.classList.add("focus-mode");
  focusToggle.setAttribute("aria-pressed", "true");
  syncFocusRun();
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const exitHint = coarse ? "Double-tap to exit" : "Esc to exit";
  const pauseHint = coarse ? "Tap Pause to stop" : "Space to pause";
  focusHint.textContent = mode === "clock" ? exitHint : `${exitHint} · ${pauseHint}`;
  showFocusHint();
  if (!document.fullscreenElement) {
    try {
      await appShell.requestFullscreen();
    } catch {
      // fullscreen can be blocked or unsupported (iOS) — CSS mode still applies
    }
  }
  announce("Focus mode. Press Escape to exit.");
}

async function exitFocus() {
  lastStageTap = 0;
  playSound("focus-out");
  appShell.classList.remove("focus-mode");
  focusToggle.setAttribute("aria-pressed", "false");
  focusHint.classList.remove("is-visible");
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      // ignore
    }
  }
}

let focusHintTimer = 0;
const STAGE_DOUBLE_TAP_MS = 420;
let lastStageTap = 0;

function showFocusHint() {
  focusHint.classList.add("is-visible");
  window.clearTimeout(focusHintTimer);
  focusHintTimer = window.setTimeout(() => focusHint.classList.remove("is-visible"), 2600);
}

document.addEventListener("pointermove", () => {
  if (appShell.classList.contains("focus-mode")) showFocusHint();
});

// Touch devices have no Escape key — a double tap on the stage leaves focus mode.
document.querySelector<HTMLElement>(".stage")?.addEventListener("click", (event) => {
  if (!appShell.classList.contains("focus-mode")) return;
  event.preventDefault();
  const now = performance.now();
  if (now - lastStageTap <= STAGE_DOUBLE_TAP_MS) {
    lastStageTap = 0;
    void exitFocus();
  } else {
    lastStageTap = now;
    showFocusHint();
  }
});

focusToggle.addEventListener("click", () => {
  if (appShell.classList.contains("focus-mode")) exitFocus();
  else enterFocus();
});

focusRun.addEventListener("click", (event) => {
  // Keep the tap away from the stage double-tap-to-exit handler.
  event.stopPropagation();
  lastStageTap = 0;
  if (mode === "timer") timerStart.click();
  else if (mode === "stopwatch") swStart.click();
  syncFocusRun();
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && appShell.classList.contains("focus-mode")) {
    appShell.classList.remove("focus-mode");
    focusToggle.setAttribute("aria-pressed", "false");
  }
});

/* ------------------------------------------------------------------ sound */

let soundEnabled = persisted.sound ?? true;

function syncSoundToggle() {
  setSoundEnabled(soundEnabled);
  soundToggle.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
  soundToggle.setAttribute("aria-label", soundEnabled ? "Mute sounds" : "Enable sounds");
}

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  save({ sound: soundEnabled });
  syncSoundToggle();
  if (soundEnabled) playSound("apply");
});

// Browsers only unlock audio inside a gesture. Do it on the first interaction
// so a timer restored from storage can still chime when it finishes later.
document.addEventListener("pointerdown", () => unlockSound(), { once: true, passive: true });

/* --------------------------------------------------------------- keyboard */

document.addEventListener("keydown", (event) => {
  const target = document.activeElement as HTMLElement | null;
  const typing =
    target?.tagName === "INPUT" ||
    target?.tagName === "TEXTAREA" ||
    target?.isContentEditable === true;

  if (event.key === "Escape") {
    if (durationDialog.open) {
      durationDialog.close();
      return;
    }
    if (modePanel.classList.contains("is-open")) {
      closeMenu({ restoreFocus: true });
      return;
    }
    if (appShell.classList.contains("focus-mode")) {
      exitFocus();
      return;
    }
  }

  if (typing || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;

  // Never run global shortcuts behind a modal or an open menu.
  if (durationDialog.open || modePanel.classList.contains("is-open")) return;

  if (event.code === "Space") {
    event.preventDefault();
    if (mode === "timer") timerStart.click();
    else if (mode === "stopwatch") swStart.click();
    return;
  }

  if (event.key === "r" || event.key === "R") {
    if (mode === "timer") timerReset.click();
    else if (mode === "stopwatch") swReset.click();
    return;
  }

  if (event.key === "f" || event.key === "F") {
    focusToggle.click();
    return;
  }

  if (event.key === "1") setMode("timer");
  else if (event.key === "2") setMode("clock");
  else if (event.key === "3") setMode("stopwatch");
});

/* ----------------------------------------------------------------- announce */

function announce(message: string) {
  status.textContent = "";
  window.setTimeout(() => {
    status.textContent = message;
  }, 30);
}

/* -------------------------------------------------------------------- boot */

function boot() {
  applyFont(persisted.font ?? "jetbrains");
  syncClockFormatButtons();
  setTickVariant(persisted.tick ?? "glass");
  syncSoundToggle();

  const hash = location.hash.replace("#", "");
  const initialMode: Mode =
    hash === "timer" || hash === "clock" || hash === "stopwatch" ? (hash as Mode) : (persisted.mode ?? "timer");

  setMode(initialMode, { playCue: false });
  renderTimer();
  renderClock();
  renderStopwatch();

  window.setInterval(() => {
    renderTimer();
  }, 200);

  window.setInterval(() => {
    if (mode === "clock") renderClock();
  }, 500);

  window.setInterval(() => {
    if (mode === "stopwatch" && swRunning) renderStopwatch();
  }, 50);
}

boot();
