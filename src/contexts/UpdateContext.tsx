import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CURRENT_APP_VERSION,
  CURRENT_BUILD_TIME,
  DEFAULT_GITHUB_REPO,
  compareSemVer,
  fetchLatestGithubRelease,
  fetchLiveWebVersionManifest,
  isTrustedGitHubUrl,
  isValidGithubRepoSlug,
  sanitizePlainReleaseText,
  type GithubLatestReleaseInfo,
  type WebVersionManifest,
} from '../lib/appVersion';
import { isNativeCapacitorShell } from '../lib/platform';
import {
  getAppReleaseConfig,
  subscribeAppReleaseConfig,
} from '../services/roktoService';
import type { AppReleaseConfig } from '../types';
import { useNotifications } from './NotificationContext';

export type UpdateSource = 'sw' | 'web' | 'firestore' | 'github';
export type UpdateCheckStatus =
  | 'idle'
  | 'checking'
  | 'up_to_date'
  | 'update_found'
  | 'error';

export interface AvailableAppUpdate {
  version: string;
  updateKey: string;
  source: UpdateSource;
  swReady: boolean;
  isCritical: boolean;
  isForcedByMinVersion: boolean;
  notesBn: string;
  notesEn: string;
  releaseUrl: string;
  apkDownloadUrl: string;
  sha256Checksum: string;
  githubRepo: string;
  buildTime?: string;
}

interface UpdateContextValue {
  currentVersion: string;
  buildTime: string;
  releaseConfig: AppReleaseConfig | null;
  availableUpdate: AvailableAppUpdate | null;
  isUpdateModalOpen: boolean;
  isChecking: boolean;
  isApplyingUpdate: boolean;
  checkStatus: UpdateCheckStatus;
  openUpdateModal: () => void;
  dismissUpdateModal: () => void;
  checkForUpdatesNow: (force?: boolean) => Promise<void>;
  applyWebUpdate: () => Promise<void>;
}

const UpdateContext = createContext<UpdateContextValue | null>(null);

const KEY_LAST_GH_CHECK = 'roktodei_last_gh_release_check';
const KEY_LAST_WEB_CHECK = 'roktodei_last_web_manifest_check';
const KEY_NOTIFIED_PREFIX = 'roktodei_notified_update_';
const KEY_DISMISSED_PREFIX = 'roktodei_dismissed_update_';

const GH_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 min rate-limit protection
const WEB_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min throttle on tab focus

function readNumberStorage(key: string): number {
  try {
    const val = Number(localStorage.getItem(key) || '0');
    return Number.isFinite(val) ? val : 0;
  } catch {
    return 0;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage quota errors
  }
}

function readStringStorage(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const { addNotification } = useNotifications();

  const [swNeedRefresh, setSwNeedRefresh] = useState(false);
  const [releaseConfig, setReleaseConfig] = useState<AppReleaseConfig | null>(
    null
  );
  const [githubRelease, setGithubRelease] =
    useState<GithubLatestReleaseInfo | null>(null);
  const [webManifest, setWebManifest] = useState<WebVersionManifest | null>(
    null
  );

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [checkStatus, setCheckStatus] = useState<UpdateCheckStatus>('idle');

  const updateSwFnRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(
    null
  );
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const autoOpenedKeyRef = useRef<string | null>(null);

  // 1. Register VitePWA Service Worker dynamically in browser/PWA environments only
  useEffect(() => {
    if (typeof window === 'undefined' || isNativeCapacitorShell()) return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return;
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            setSwNeedRefresh(true);
          },
          onRegisteredSW(_swUrl, registration) {
            if (registration) {
              swRegistrationRef.current = registration;
            }
          },
          onRegisterError(err) {
            console.warn('Service worker registration notice:', err);
          },
        });
        updateSwFnRef.current = updateSW;
      })
      .catch(() => {
        // Ignore in dev/environments without generated SW virtual module
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Real-time Firestore /appConfig/release listener (works in Web, PWA, AND APK!)
  useEffect(() => {
    const unsubscribe = subscribeAppReleaseConfig(
      (cfg) => {
        setReleaseConfig(cfg);
      },
      (err) => {
        console.warn('Release config subscription notice:', err.message);
      }
    );
    return () => unsubscribe();
  }, []);

  const runGithubCheck = useCallback(
    async (repoCandidate: string, force = false): Promise<GithubLatestReleaseInfo | null> => {
      const cleanRepo = repoCandidate.trim();
      if (!isValidGithubRepoSlug(cleanRepo)) return null;

      if (!force) {
        const last = readNumberStorage(KEY_LAST_GH_CHECK);
        if (Date.now() - last < GH_CHECK_INTERVAL_MS) {
          return null;
        }
      }

      writeStorage(KEY_LAST_GH_CHECK, String(Date.now()));
      const info = await fetchLatestGithubRelease(cleanRepo);
      if (info) {
        setGithubRelease(info);
      }
      return info;
    },
    []
  );

  const runWebManifestCheck = useCallback(
    async (force = false): Promise<WebVersionManifest | null> => {
      if (isNativeCapacitorShell()) return null;
      if (!force) {
        const last = readNumberStorage(KEY_LAST_WEB_CHECK);
        if (Date.now() - last < WEB_CHECK_INTERVAL_MS) {
          return null;
        }
      }
      writeStorage(KEY_LAST_WEB_CHECK, String(Date.now()));
      const manifest = await fetchLiveWebVersionManifest();
      if (manifest) {
        setWebManifest(manifest);
      }
      return manifest;
    },
    []
  );

  // 3. Initial background checks + tab visibility refresh
  useEffect(() => {
    void runWebManifestCheck(true);

    const repo = (releaseConfig?.githubRepo || DEFAULT_GITHUB_REPO || '').trim();
    if (repo) {
      void runGithubCheck(repo, false);
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void runWebManifestCheck(false);
        if (swRegistrationRef.current) {
          void swRegistrationRef.current.update().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [releaseConfig?.githubRepo, runGithubCheck, runWebManifestCheck]);

  // 4. Consolidate highest verified SemVer candidate (> CURRENT_APP_VERSION)
  const availableUpdate = useMemo<AvailableAppUpdate | null>(() => {
    const repoHint = (
      releaseConfig?.githubRepo ||
      webManifest?.githubRepo ||
      DEFAULT_GITHUB_REPO ||
      ''
    ).trim();

    const isForcedByMinVersion = Boolean(
      releaseConfig?.minSupportedVersion &&
        compareSemVer(releaseConfig.minSupportedVersion, CURRENT_APP_VERSION) > 0
    );
    const isCritical = Boolean(
      releaseConfig?.isCriticalUpdate || isForcedByMinVersion
    );

    const fsNewer =
      releaseConfig &&
      compareSemVer(releaseConfig.version, CURRENT_APP_VERSION) > 0
        ? releaseConfig
        : null;

    const ghNewer =
      githubRelease &&
      compareSemVer(githubRelease.version, CURRENT_APP_VERSION) > 0
        ? githubRelease
        : null;

    const webNewer =
      webManifest &&
      compareSemVer(webManifest.version, CURRENT_APP_VERSION) > 0
        ? webManifest
        : null;

    // Pick highest SemVer among remote feeds
    let bestVersion = '';
    let source: UpdateSource = 'web';

    if (fsNewer) {
      bestVersion = fsNewer.version;
      source = 'firestore';
    }
    if (ghNewer && (!bestVersion || compareSemVer(ghNewer.version, bestVersion) > 0)) {
      bestVersion = ghNewer.version;
      source = 'github';
    }
    if (
      webNewer &&
      (!bestVersion || compareSemVer(webNewer.version, bestVersion) > 0)
    ) {
      bestVersion = webNewer.version;
      source = 'web';
    }

    // If no higher SemVer yet, check if Workbox SW has an updated web bundle ready
    if (!bestVersion && !swNeedRefresh) {
      return null;
    }

    const effectiveVersion = bestVersion || webManifest?.version || CURRENT_APP_VERSION;
    const effectiveSource: UpdateSource = bestVersion ? source : 'sw';

    const releaseUrl =
      (fsNewer && isTrustedGitHubUrl(fsNewer.releaseUrl) ? fsNewer.releaseUrl : '') ||
      (ghNewer && isTrustedGitHubUrl(ghNewer.releaseUrl) ? ghNewer.releaseUrl : '') ||
      (releaseConfig && isTrustedGitHubUrl(releaseConfig.releaseUrl)
        ? releaseConfig.releaseUrl
        : '') ||
      (isValidGithubRepoSlug(repoHint)
        ? `https://github.com/${repoHint}/releases/latest`
        : '');

    const apkDownloadUrl =
      (fsNewer && isTrustedGitHubUrl(fsNewer.apkDownloadUrl)
        ? fsNewer.apkDownloadUrl
        : '') ||
      (ghNewer && isTrustedGitHubUrl(ghNewer.apkDownloadUrl)
        ? ghNewer.apkDownloadUrl
        : '') ||
      (releaseConfig && isTrustedGitHubUrl(releaseConfig.apkDownloadUrl)
        ? releaseConfig.apkDownloadUrl
        : '');

    const sha256Checksum =
      fsNewer?.sha256Checksum ||
      ghNewer?.sha256Checksum ||
      releaseConfig?.sha256Checksum ||
      '';

    const notesBn = sanitizePlainReleaseText(
      fsNewer?.releaseNotesBn || releaseConfig?.releaseNotesBn || '',
      800
    );
    const notesEn = sanitizePlainReleaseText(
      fsNewer?.releaseNotesEn ||
        ghNewer?.releaseNotes ||
        releaseConfig?.releaseNotesEn ||
        '',
      800
    );

    const updateKey =
      effectiveSource === 'sw'
        ? `sw_${webManifest?.buildTime || Date.now().toString().slice(0, 8)}`
        : `v_${effectiveVersion}`;

    return {
      version: effectiveVersion,
      updateKey,
      source: effectiveSource,
      swReady: swNeedRefresh,
      isCritical,
      isForcedByMinVersion,
      notesBn:
        notesBn ||
        `রক্তদেই অ্যাপের নতুন ভার্সন (v${effectiveVersion}) প্রকাশিত হয়েছে। নিরাপত্তা ও পারফরম্যান্স উন্নতির জন্য আপডেট করুন।`,
      notesEn:
        notesEn ||
        `A new version of Rokto Dei (v${effectiveVersion}) is available with security and performance improvements.`,
      releaseUrl,
      apkDownloadUrl,
      sha256Checksum,
      githubRepo: repoHint,
      buildTime: webManifest?.buildTime,
    };
  }, [githubRelease, releaseConfig, swNeedRefresh, webManifest]);

  // 5. Push a single Notification Bell alert + open Update Popup Modal safely
  useEffect(() => {
    if (!availableUpdate) return;

    const notifFlagKey = `${KEY_NOTIFIED_PREFIX}${availableUpdate.updateKey}`;
    if (readStringStorage(notifFlagKey) !== '1') {
      writeStorage(notifFlagKey, '1');
      addNotification({
        id: `notif_app_update_${availableUpdate.updateKey}`,
        type: 'system_update',
        titleBn: availableUpdate.isCritical
          ? `জরুরি নিরাপত্তা আপডেট (v${availableUpdate.version})`
          : `অ্যাপের নতুন ভার্সন উপলব্ধ (v${availableUpdate.version})`,
        titleEn: availableUpdate.isCritical
          ? `Critical Security Update (v${availableUpdate.version})`
          : `New App Version Available (v${availableUpdate.version})`,
        messageBn: availableUpdate.notesBn,
        messageEn: availableUpdate.notesEn,
        targetView: 'find_donors',
        urgency: availableUpdate.isCritical ? 'urgent' : 'info',
        metadata: {
          isAppUpdate: true,
          version: availableUpdate.version,
        },
      });
    }

    const dismissFlagKey = `${KEY_DISMISSED_PREFIX}${availableUpdate.updateKey}`;
    const wasDismissed = readStringStorage(dismissFlagKey) === '1';

    if (
      (availableUpdate.isCritical || !wasDismissed) &&
      autoOpenedKeyRef.current !== availableUpdate.updateKey
    ) {
      autoOpenedKeyRef.current = availableUpdate.updateKey;
      const timer = setTimeout(() => {
        setIsUpdateModalOpen(true);
      }, 1100);
      return () => clearTimeout(timer);
    }
  }, [addNotification, availableUpdate]);

  const openUpdateModal = useCallback(() => {
    setIsUpdateModalOpen(true);
  }, []);

  const dismissUpdateModal = useCallback(() => {
    setIsUpdateModalOpen(false);
    if (availableUpdate && !availableUpdate.isCritical) {
      writeStorage(`${KEY_DISMISSED_PREFIX}${availableUpdate.updateKey}`, '1');
    }
  }, [availableUpdate]);

  const applyWebUpdate = useCallback(async () => {
    setIsApplyingUpdate(true);
    try {
      if (updateSwFnRef.current) {
        await updateSwFnRef.current(true);
      }
      // Clear CacheStorage runtime caches if needed & hard reload with cache buster
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('_upd', String(Date.now()));
        window.location.replace(url.toString());
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } finally {
      setIsApplyingUpdate(false);
    }
  }, []);

  const checkForUpdatesNow = useCallback(
    async (force = true) => {
      setIsChecking(true);
      setCheckStatus('checking');
      try {
        const [manifest, fsCfg] = await Promise.all([
          runWebManifestCheck(force),
          getAppReleaseConfig().catch(() => null),
        ]);

        if (fsCfg) {
          setReleaseConfig(fsCfg);
        }

        const repo = (
          fsCfg?.githubRepo ||
          releaseConfig?.githubRepo ||
          manifest?.githubRepo ||
          DEFAULT_GITHUB_REPO ||
          ''
        ).trim();

        const ghInfo = repo ? await runGithubCheck(repo, force) : null;

        if (swRegistrationRef.current) {
          await swRegistrationRef.current.update().catch(() => {});
        }

        const hasNewerVersion =
          Boolean(
            fsCfg && compareSemVer(fsCfg.version, CURRENT_APP_VERSION) > 0
          ) ||
          Boolean(
            ghInfo && compareSemVer(ghInfo.version, CURRENT_APP_VERSION) > 0
          ) ||
          Boolean(
            manifest &&
              compareSemVer(manifest.version, CURRENT_APP_VERSION) > 0
          ) ||
          swNeedRefresh;

        if (hasNewerVersion) {
          setCheckStatus('update_found');
          setIsUpdateModalOpen(true);
        } else {
          setCheckStatus('up_to_date');
        }
      } catch {
        setCheckStatus('error');
      } finally {
        setIsChecking(false);
      }
    },
    [releaseConfig?.githubRepo, runGithubCheck, runWebManifestCheck, swNeedRefresh]
  );

  return (
    <UpdateContext.Provider
      value={{
        currentVersion: CURRENT_APP_VERSION,
        buildTime: CURRENT_BUILD_TIME,
        releaseConfig,
        availableUpdate,
        isUpdateModalOpen,
        isChecking,
        isApplyingUpdate,
        checkStatus,
        openUpdateModal,
        dismissUpdateModal,
        checkForUpdatesNow,
        applyWebUpdate,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
}

export function useAppUpdate() {
  const ctx = useContext(UpdateContext);
  if (!ctx) {
    throw new Error('useAppUpdate must be used within an UpdateProvider');
  }
  return ctx;
}
