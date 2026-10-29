import { useEffect, useState } from 'react';

// Chrome/Edge (Android and laptop) fire beforeinstallprompt once the PWA is installable.
// It can fire before React mounts, so it is caught at import time (main.tsx imports App, which imports this).
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep it for our button instead of the browser's mini-infobar
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad Safari: no install prompt exists, the user adds it from the Share menu. */
function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export type InstallState = 'installed' | 'prompt' | 'ios' | 'unavailable';

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  const state: InstallState = isStandalone() ? 'installed' : deferred ? 'prompt' : isIosSafari() ? 'ios' : 'unavailable';

  async function install() {
    if (!deferred) return;
    const e = deferred;
    await e.prompt();
    await e.userChoice;
    deferred = null; // a prompt can be used only once
    notify();
  }

  return { state, install };
}
