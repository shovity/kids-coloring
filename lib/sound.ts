import { asset } from "./manifest";

export type Sfx =
  | "click"
  | "click2"
  | "choose_tap"
  | "color"
  | "colors"
  | "fill"
  | "swoosh"
  | "appear"
  | "badge"
  | "end"
  | "push"
  | "menu-to-gallery"
  | "menu-to-menu"
  | "gallery-scroll-short";

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let music: HTMLAudioElement | null = null;
let musicWanted = false;

const MUTE_KEY = "bimi-muted";
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

function load(name: string): Promise<AudioBuffer | null> {
  let p = buffers.get(name);
  if (!p) {
    const ac = audio();
    p = ac
      ? fetch(asset(`audio/${name}.mp3`))
          .then((r) => r.arrayBuffer())
          .then((b) => ac.decodeAudioData(b))
          .catch(() => null)
      : Promise.resolve(null);
    buffers.set(name, p);
  }
  return p;
}

export function preload(names: Sfx[]): void {
  names.forEach((n) => void load(n));
}

export function play(name: Sfx, volume = 0.8): void {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  void load(name).then((buf) => {
    if (!buf) return;
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    gain.gain.value = volume;
    src.buffer = buf;
    src.connect(gain).connect(ac.destination);
    src.start();
  });
}

/** iOS chỉ cho phát âm thanh sau thao tác chạm đầu tiên. */
export function unlockAudio(): void {
  const ac = audio();
  if (ac && ac.state === "suspended") void ac.resume();
  if (musicWanted) startMusic();
}

export function startMusic(): void {
  musicWanted = true;
  if (muted || typeof window === "undefined") return;
  if (!music) {
    music = new Audio(asset("audio/menu-melody.mp3"));
    music.loop = true;
    music.volume = 0.35;
  }
  void music.play().catch(() => {});
}

export function stopMusic(): void {
  musicWanted = false;
  music?.pause();
}

export const isMuted = () => muted;

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {}
  if (value) music?.pause();
  else if (musicWanted) startMusic();
}
