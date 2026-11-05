/**
 * Keeps the screen awake while a timer or stopwatch is running.
 *
 * Uses the Screen Wake Lock API where available (secure contexts such as
 * HTTPS or localhost). Mobile browsers only expose that API on secure origins,
 * so plain-HTTP LAN testing falls back to a tiny silent looping video, which
 * is the same trick libraries like NoSleep.js use.
 *
 * The fallback video matters in focus mode: the video must live inside the
 * fullscreen element and stay on-screen (even if nearly invisible), otherwise
 * browsers can suspend it or stop treating it as active playback and let the
 * display sleep again.
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
let watchdog = 0;

function videoIsPlaying() {
  return video !== null && !video.paused;
}

/**
 * The video has to stay rendered while the app is in fullscreen, so mount it
 * inside the fullscreen element (falling back to the app shell).
 */
function mountPoint(): HTMLElement {
  const fullscreen = document.fullscreenElement;
  if (fullscreen instanceof HTMLElement) return fullscreen;
  return document.getElementById("app-shell") ?? document.body;
}

function mountVideo() {
  if (!video) return;
  const parent = mountPoint();
  if (video.parentElement !== parent) parent.appendChild(video);
}

function ensureVideo() {
  if (video) return video;

  const el = document.createElement("video");
  el.id = "wake-video";
  el.autoplay = true;
  el.loop = true;
  el.playsInline = true;
  el.preload = "auto";
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "");
  el.setAttribute("aria-hidden", "true");
  el.tabIndex = -1;
  el.setAttribute("disablepictureinpicture", "");
  el.disablePictureInPicture = true;
  el.controls = false;
  // Chrome only holds a display wake lock for videos that are actually on
  // screen and cover at least ~20% of the viewport (since Chrome 113), so this
  // clip is stretched across the lower third of the screen. It is effectively
  // invisible (opacity 0.01) and cannot receive touches. A tiny 1x1 or
  // off-screen video no longer prevents the display from sleeping.
  el.style.cssText =
    "position:fixed;left:0;bottom:0;width:100vw;height:32vh;opacity:0.01;pointer-events:none;z-index:1;object-fit:cover;background:transparent;";

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

  mountPoint().appendChild(el);
  video = el;
  return el;
}

/**
 * The bundled clip has a silent audio track. Playing it unmuted is what the
 * NoSleep trick relies on, and autoplay is allowed because there is nothing to
 * hear. If a browser still blocks it (for example a restored timer that starts
 * without a tap), retry muted so at least the video keeps looping.
 */
async function playVideo(force: boolean) {
  const el = ensureVideo();
  mountVideo();

  if (!force && videoIsPlaying()) return;

  el.muted = false;
  el.volume = 1;
  try {
    await el.play();
    return;
  } catch {
    // Fall through to muted playback.
  }

  el.muted = true;
  try {
    await el.play();
  } catch {
    // Still blocked — the next pointer tap retries.
  }
}

async function enable(force = false) {
  if (!desired) return;

  if (!sentinel && wakeLockApi) {
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

  if (!sentinel) await playVideo(force);
}

function disable() {
  if (sentinel) {
    const lock = sentinel;
    sentinel = null;
    void lock.release().catch(() => {});
  }
  if (video && !video.paused) video.pause();
}

function startWatchdog() {
  if (watchdog) return;
  // Some browsers pause background video on their own. Nudge it back to
  // playing while the timer is running and the page is visible.
  watchdog = window.setInterval(() => {
    if (!desired || document.visibilityState !== "visible") return;
    mountVideo();
    if (!sentinel && (!video || video.paused)) void enable(true);
  }, 4000);
}

function stopWatchdog() {
  if (!watchdog) return;
  window.clearInterval(watchdog);
  watchdog = 0;
}

function update() {
  if (desired && document.visibilityState === "visible") {
    startWatchdog();
    void enable();
  } else {
    stopWatchdog();
    disable();
  }
}

export function setWakeLock(on: boolean) {
  if (desired === on) return;
  desired = on;
  update();
}

document.addEventListener("visibilitychange", update);

// Fullscreen changes can detach the video from the rendered tree; remount it.
document.addEventListener("fullscreenchange", () => {
  if (!desired) return;
  mountVideo();
  void enable(true);
});

// Autoplay may be blocked until a user gesture. Retry from every tap.
document.addEventListener(
  "pointerdown",
  () => {
    if (desired) void enable(true);
  },
  { passive: true }
);
