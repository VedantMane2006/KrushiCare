// Location for weather/soil. Asked once; if denied or slow (10 s) we continue without it.
export interface Coords { lat: number; lon: number }

let cached: { at: number; coords: Coords } | null = null;
const MAX_AGE_MS = 30 * 60 * 1000;

export function getLocation(timeoutMs = 10_000): Promise<Coords | null> {
  if (cached && Date.now() - cached.at < MAX_AGE_MS) return Promise.resolve(cached.coords);
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        cached = { at: Date.now(), coords };
        resolve(coords);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: MAX_AGE_MS },
    );
  });
}
