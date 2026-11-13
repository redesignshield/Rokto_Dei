import { useEffect, useState } from 'react';

const APK_MODE_SESSION_KEY = 'roktodei_apk_mode';

/**
 * Detects whether the app is running inside an installed Android APK / TWA /
 * Capacitor shell or standalone PWA window, as opposed to a standard web browser.
 */
export function isApkOrInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const params = new URLSearchParams(window.location.search);
    const apkParam = params.get('apk') || params.get('mode');
    if (apkParam === '1' || apkParam === 'apk') {
      window.sessionStorage.setItem(APK_MODE_SESSION_KEY, '1');
      return true;
    }
    if (apkParam === '0' || apkParam === 'web') {
      window.sessionStorage.removeItem(APK_MODE_SESSION_KEY);
      return false;
    }
    if (window.sessionStorage.getItem(APK_MODE_SESSION_KEY) === '1') {
      return true;
    }
  } catch {
    // Ignore storage/URL read restrictions
  }

  // 1. Capacitor native Android/iOS shell
  const cap = (
    window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean };
    }
  ).Capacitor;
  if (cap?.isNativePlatform?.()) {
    return true;
  }

  // 2. Android Trusted Web Activity (TWA) referrer
  if (
    typeof document !== 'undefined' &&
    document.referrer.startsWith('android-app://')
  ) {
    return true;
  }

  // 3. Installed PWA / TWA standalone display mode
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true;
  if (isStandalone) {
    return true;
  }

  // 4. Android embedded WebView user-agent marker (`; wv)`)
  if (/; wv\)/i.test(window.navigator.userAgent)) {
    return true;
  }

  return false;
}

export function useIsApkAppShell(): boolean {
  const [isAppShell, setIsAppShell] = useState<boolean>(() =>
    isApkOrInstalledApp()
  );

  useEffect(() => {
    setIsAppShell(isApkOrInstalledApp());

    const mql = window.matchMedia?.('(display-mode: standalone)');
    if (!mql) return;

    const handleChange = () => {
      setIsAppShell(isApkOrInstalledApp());
    };

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    return undefined;
  }, []);

  return isAppShell;
}
