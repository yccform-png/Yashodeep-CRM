import { useState, useEffect, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Detect if already running in standalone mode (PWA already installed)
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    setIsInstalled(standalone);
  }, []);

  // Capture browser install prompt before it fires
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => setIsInstalled(true);

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setInstallPrompt(null);
  }, [installPrompt]);

  // Service Worker update detection (provided by vite-plugin-pwa)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.info('[PWA] Service Worker registered:', r);
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker registration error:', error);
    },
  });

  return {
    /** True when the app can be installed (prompt captured, not yet installed) */
    canInstall: !!installPrompt && !isInstalled,
    /** True when the app is currently running as an installed PWA */
    isInstalled,
    /** True when running in standalone/fullscreen mode (no browser chrome) */
    isStandalone,
    /** Trigger the native install sheet */
    triggerInstall,
    /** True when a new Service Worker version is waiting to activate */
    hasUpdate: needRefresh,
    /** Reload the page and activate the new Service Worker */
    applyUpdate: () => updateServiceWorker(true),
  };
}
