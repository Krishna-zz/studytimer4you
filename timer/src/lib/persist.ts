const KEY = "studytimer4you:v1";

type State = {
  mode?: "timer" | "clock" | "stopwatch";
  font?: string;
  hour12?: boolean;
  timer?: { durationSec: number; remainingMs?: number; running?: boolean; endAt?: number };
  stopwatch?: { elapsedMs: number; running: boolean; startAt?: number };
};

function getStorage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function load<T = State>(): T {
  const s = getStorage();
  if (!s) return {} as T;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return {} as T;
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

export function save(partial: Partial<State>) {
  const s = getStorage();
  if (!s) return;
  try {
    const cur = load();
    s.setItem(KEY, JSON.stringify({ ...cur, ...partial }));
  } catch {
    // ignore
  }
}
