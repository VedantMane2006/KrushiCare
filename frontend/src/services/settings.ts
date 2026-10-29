// Per-device preferences in localStorage. Every access is guarded: private mode can throw.
import type { Crop, Lang, SoilCard } from './types';

const KEY = 'agrisense.settings.v1';

export interface Settings {
  lang: Lang;
  crop: Crop;
  soilCard: SoilCard | null;
  langChosen: boolean;
}

const DEFAULTS: Settings = { lang: 'en', crop: 'tomato', soilCard: null, langChosen: false };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
