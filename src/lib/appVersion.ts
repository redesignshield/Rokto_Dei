export const CURRENT_APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
    ? __APP_VERSION__
    : '1.0.0';

export const CURRENT_BUILD_TIME: string =
  typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : '';

export const DEFAULT_GITHUB_REPO: string = (
  typeof __GITHUB_REPO__ !== 'undefined' && __GITHUB_REPO__
    ? __GITHUB_REPO__
    : (import.meta as { env?: Record<string, string | undefined> }).env
        ?.VITE_GITHUB_REPO || ''
).trim();

const SEMVER_REGEX = /^[vV]?(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/;
const GITHUB_REPO_REGEX = /^[a-zA-Z0-9_.-]{1,64}\/[a-zA-Z0-9_.-]{1,100}$/;
const SHA256_REGEX = /^[a-fA-F0-9]{64}$/;

export function normalizeSemVer(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const match = raw.trim().match(SEMVER_REGEX);
  if (!match) return null;
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

export function parseSemVer(
  raw: string | null | undefined
): [number, number, number] | null {
  const normalized = normalizeSemVer(raw);
  if (!normalized) return null;
  const parts = normalized.split('.').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  return [parts[0], parts[1], parts[2]];
}

/**
 * Strict SemVer comparison (Anti-Downgrade Guard):
 * Returns 1 if a > b, -1 if a < b, 0 if equal or unparseable.
 */
export function compareSemVer(a: string, b: string): number {
  const pa = parseSemVer(a);
  const pb = parseSemVer(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

export function isValidGithubRepoSlug(repo: string | null | undefined): boolean {
  if (!repo || typeof repo !== 'string') return false;
  return GITHUB_REPO_REGEX.test(repo.trim());
}

export function isValidSha256Hex(hash: string | null | undefined): boolean {
  if (!hash || typeof hash !== 'string') return false;
  return SHA256_REGEX.test(hash.trim());
}

/**
 * Security Allowlist: Release and APK download URLs MUST point exclusively to
 * HTTPS github.com/<owner>/<repo>/... (with optional exact repository pinning).
 */
export function isTrustedGitHubUrl(
  rawUrl: string | null | undefined,
  expectedRepo?: string
): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 300) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname.toLowerCase() !== 'github.com') return false;
    if (parsed.username || parsed.password) return false;
    if (expectedRepo && isValidGithubRepoSlug(expectedRepo)) {
      const prefix = `/${expectedRepo.trim().toLowerCase()}/`;
      if (
        !parsed.pathname.toLowerCase().startsWith(prefix) &&
        parsed.pathname.toLowerCase() !== `/${expectedRepo.trim().toLowerCase()}`
      ) {
        return false;
      }
    }
    return /^\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\/.*)?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function sanitizePlainReleaseText(
  raw: string | null | undefined,
  maxLen = 800
): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLen);
}

export function extractSha256FromText(text: string): string {
  if (!text) return '';
  const match = text.match(
    /(?:sha-?256|checksum|digest)\s*[:=\s`]+([a-fA-F0-9]{64})/i
  );
  return match && isValidSha256Hex(match[1]) ? match[1].toLowerCase() : '';
}

export interface GithubLatestReleaseInfo {
  version: string;
  releaseUrl: string;
  apkDownloadUrl: string;
  sha256Checksum: string;
  releaseNotes: string;
  publishedAt: string;
}

export async function fetchLatestGithubRelease(
  repoSlug: string
): Promise<GithubLatestReleaseInfo | null> {
  const cleanRepo = repoSlug.trim();
  if (!isValidGithubRepoSlug(cleanRepo)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(
      `https://api.github.com/repos/${cleanRepo}/releases/latest`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
        },
        signal: controller.signal,
      }
    );
    if (!res.ok) return null;

    const payload = (await res.json()) as {
      tag_name?: string;
      draft?: boolean;
      prerelease?: boolean;
      html_url?: string;
      body?: string;
      published_at?: string;
      assets?: Array<{
        name?: string;
        browser_download_url?: string;
      }>;
    };

    if (payload.draft || payload.prerelease) return null;

    const version = normalizeSemVer(payload.tag_name);
    if (!version) return null;

    const releaseUrl = isTrustedGitHubUrl(payload.html_url, cleanRepo)
      ? payload.html_url!.trim()
      : `https://github.com/${cleanRepo}/releases/latest`;

    const apkAsset = (payload.assets || []).find(
      (a) =>
        typeof a.name === 'string' &&
        a.name.toLowerCase().endsWith('.apk') &&
        isTrustedGitHubUrl(a.browser_download_url, cleanRepo)
    );

    const releaseNotes = sanitizePlainReleaseText(payload.body, 800);
    const sha256Checksum = extractSha256FromText(payload.body || '');

    return {
      version,
      releaseUrl,
      apkDownloadUrl: apkAsset?.browser_download_url?.trim() || '',
      sha256Checksum,
      releaseNotes,
      publishedAt: payload.published_at || '',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface WebVersionManifest {
  version: string;
  buildTime?: string;
  githubRepo?: string;
}

export async function fetchLiveWebVersionManifest(): Promise<WebVersionManifest | null> {
  if (typeof window === 'undefined') return null;
  // Standalone Capacitor native shells bundle assets locally; skip self version.json check
  const cap = (
    window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean };
    }
  ).Capacitor;
  if (cap?.isNativePlatform?.()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;

    const data = (await res.json()) as {
      version?: unknown;
      buildTime?: unknown;
      githubRepo?: unknown;
    };
    const version = normalizeSemVer(
      typeof data.version === 'string' ? data.version : ''
    );
    if (!version) return null;

    return {
      version,
      buildTime: typeof data.buildTime === 'string' ? data.buildTime : '',
      githubRepo:
        typeof data.githubRepo === 'string' &&
        isValidGithubRepoSlug(data.githubRepo)
          ? data.githubRepo.trim()
          : '',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
