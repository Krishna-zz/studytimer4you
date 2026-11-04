export function pad(n: number, len = 2) {
  return String(Math.max(0, Math.floor(n))).padStart(len, "0");
}

export function splitMs(ms: number) {
  let total = Math.max(0, Math.floor(ms));
  const hours = Math.floor(total / (1000 * 60 * 60));
  total -= hours * 1000 * 60 * 60;
  const minutes = Math.floor(total / (1000 * 60));
  total -= minutes * 1000 * 60;
  const seconds = Math.floor(total / 1000);
  const cs = Math.floor((total % 1000) / 10);
  return { hours, minutes, seconds, cs };
}

export function formatHMS(ms: number, showHours: boolean) {
  const { hours, minutes, seconds } = splitMs(ms);
  if (showHours || hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function formatHMSC(ms: number, showHours: boolean) {
  const { hours, minutes, seconds, cs } = splitMs(ms);
  if (showHours || hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}.${pad(cs)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}.${pad(cs)}`;
}

export function clampDuration(s: number) {
  const max = 99 * 3600 + 59 * 60 + 59; // 99:59:59
  return Math.max(0, Math.min(max, Math.floor(s)));
}
