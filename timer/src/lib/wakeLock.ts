/**
 * Keeps the screen awake while a timer or stopwatch is running.
 *
 * Uses the Screen Wake Lock API where available (secure contexts such as
 * HTTPS or localhost). Mobile browsers only expose that API on secure origins,
 * so plain-HTTP LAN testing falls back to a tiny silent looping video, which
 * is the same trick libraries like NoSleep.js use.
 */

type Sentinel = {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

const wakeLockApi = (
  navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
  }
).wakeLock;

let sentinel: Sentinel | null = null;
let video: HTMLVideoElement | null = null;
let desired = false;

function videoIsPlaying() {
  return video !== null && !video.paused;
}

function ensureVideo() {
  if (video) return video;

  const el = document.createElement("video");
  el.muted = true;
  el.defaultMuted = true;
  el.loop = true;
  el.playsInline = true;
  el.preload = "auto";
  el.setAttribute("playsinline", "");
  el.setAttribute("muted", "");
  el.setAttribute("aria-hidden", "true");
  el.tabIndex = -1;
  el.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";

  (
    [
      ["/media/nosleep.webm", "video/webm"],
      ["/media/nosleep.mp4", "video/mp4"],
    ] as const
  ).forEach(([src, type]) => {
    const source = document.createElement("source");
    source.src = src;
    source.type = type;
    el.appendChild(source);
  });

  document.body.appendChild(el);
  video = el;
  return el;
}

async function enable() {
  if (sentinel || videoIsPlaying()) return;

  if (wakeLockApi) {
    try {
      sentinel = await wakeLockApi.request("screen");
      sentinel.addEventListener("release", () => {
        sentinel = null;
      });
      return;
    } catch {
      // Fall through to the video fallback.
    }
  }

  try {
    await ensureVideo().play();
  } catch {
    // Autoplay can be blocked until the next user gesture.
  }
}

function disable() {
  if (sentinel) {
    const lock = sentinel;
    sentinel = null;
    void lock.release().catch(() => {});
  }
  if (video && !video.paused) video.pause();
}

function update() {
  if (desired && document.visibilityState === "visible") void enable();
  else disable();
}

export function setWakeLock(on: boolean) {
  if (desired === on) return;
  desired = on;
  update();
}

document.addEventListener("visibilitychange", update);

// If autoplay was blocked on first load, retry from the next user gesture.
document.addEventListener("pointerdown", () => {
  if (desired) void enable();
}, { passive: true });
