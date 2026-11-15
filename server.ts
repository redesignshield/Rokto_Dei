import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createServer as createViteServer, type ViteDevServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FirebaseClientConfig {
  projectId: string;
  apiKey?: string;
}

const configPath = path.join(__dirname, 'firebase-applet-config.json');
const firebaseConfig: FirebaseClientConfig = JSON.parse(
  fs.readFileSync(configPath, 'utf-8')
);
const pkgPath = path.join(__dirname, 'package.json');
const serverPackageVersion = (() => {
  try {
    const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      version?: string;
    };
    return parsed.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
})();

const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  )
);

const HOURLY_UNIQUE_TARGET_LIMIT = 15;
const DAILY_UNIQUE_TARGET_LIMIT = 35;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface LookupRecord {
  targetKey: string;
  timestamp: number;
}

// Sliding-window rate-limit store keyed by verified Firebase UID (metadata only, never phone numbers)
const userContactLookups = new Map<string, LookupRecord[]>();

interface GeocodeCacheEntry {
  formattedAddress: string;
  areaLabel: string;
  source: 'osm_nominatim' | 'bigdatacloud' | 'fallback';
  expiresAt: number;
}

// Transient in-memory deduplication cache (5 min TTL) to prevent GPS jitter from burning quota
const reverseGeocodeCache = new Map<string, GeocodeCacheEntry>();
const GEOCODE_CACHE_TTL_MS = 5 * 60 * 1000;

function formatCoordFallback(lat: number, lng: number, lang: 'bn' | 'en'): {
  formattedAddress: string;
  areaLabel: string;
} {
  const latStr = lat.toFixed(4);
  const lngStr = lng.toFixed(4);
  if (lang === 'bn') {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const toBn = (s: string) => s.replace(/[0-9]/g, (d) => bnDigits[Number(d)]);
    return {
      formattedAddress: `অবস্থান (${toBn(latStr)}, ${toBn(lngStr)})`,
      areaLabel: 'বর্তমান জিপিএস অবস্থান',
    };
  }
  return {
    formattedAddress: `Location (${latStr}, ${lngStr})`,
    areaLabel: 'Current GPS Location',
  };
}

function pruneAndEvaluateQuota(uid: string, targetKey?: string): {
  allowed: boolean;
  hourlyUsed: number;
  dailyUsed: number;
} {
  const now = Date.now();
  const existing = (userContactLookups.get(uid) || []).filter(
    (entry) => now - entry.timestamp < DAY_MS
  );

  const hourlySet = new Set<string>();
  const dailySet = new Set<string>();

  for (const entry of existing) {
    dailySet.add(entry.targetKey);
    if (now - entry.timestamp < HOUR_MS) {
      hourlySet.add(entry.targetKey);
    }
  }

  if (!targetKey) {
    userContactLookups.set(uid, existing);
    return {
      allowed:
        hourlySet.size < HOURLY_UNIQUE_TARGET_LIMIT &&
        dailySet.size < DAILY_UNIQUE_TARGET_LIMIT,
      hourlyUsed: hourlySet.size,
      dailyUsed: dailySet.size,
    };
  }

  // Repeat contact actions on an already-unlocked target within the window do not consume extra unique quota
  const alreadyUnlockedToday = dailySet.has(targetKey);
  const alreadyUnlockedThisHour = hourlySet.has(targetKey);

  if (
    (!alreadyUnlockedThisHour && hourlySet.size >= HOURLY_UNIQUE_TARGET_LIMIT) ||
    (!alreadyUnlockedToday && dailySet.size >= DAILY_UNIQUE_TARGET_LIMIT)
  ) {
    userContactLookups.set(uid, existing);
    return {
      allowed: false,
      hourlyUsed: hourlySet.size,
      dailyUsed: dailySet.size,
    };
  }

  existing.push({ targetKey, timestamp: now });
  userContactLookups.set(uid, existing);

  hourlySet.add(targetKey);
  dailySet.add(targetKey);

  return {
    allowed: true,
    hourlyUsed: hourlySet.size,
    dailyUsed: dailySet.size,
  };
}

async function verifyFirebaseBearerToken(req: Request): Promise<{
  uid: string;
  emailVerified: boolean;
}> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHENTICATED');
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    throw new Error('UNAUTHENTICATED');
  }

  try {
    const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
      issuer: FIREBASE_ISSUER,
      audience: FIREBASE_PROJECT_ID,
    });

    const uid = typeof payload.sub === 'string' ? payload.sub : '';
    if (!uid) {
      throw new Error('UNAUTHENTICATED');
    }

    return {
      uid,
      emailVerified: payload.email_verified === true,
    };
  } catch {
    throw new Error('UNAUTHENTICATED');
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'geolocation=(self)');

    // Allow Capacitor / standalone APK WebView origins to access /api/* when configured
    const origin = req.headers.origin;
    const extraOrigins = (process.env.ALLOWED_CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const allowedApkOrigins = new Set([
      'capacitor://localhost',
      'https://localhost',
      'http://localhost',
      ...extraOrigins,
    ]);
    if (origin && allowedApkOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }
    }
    next();
  });

  app.use(express.json({ limit: '16kb' }));

  // Digital Asset Links for Android TWA APK domain verification (hides Chrome URL bar inside APK)
  app.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
    const pkg = process.env.ANDROID_PACKAGE_NAME || 'com.roktodei.app';
    const shaList = (process.env.ASSETLINKS_SHA256 || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (shaList.length > 0) {
      res.json([
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: pkg,
            sha256_cert_fingerprints: shaList,
          },
        },
      ]);
      return;
    }

    const staticAssetlinks = path.join(
      __dirname,
      'public',
      '.well-known',
      'assetlinks.json'
    );
    if (fs.existsSync(staticAssetlinks)) {
      res.type('application/json').sendFile(staticAssetlinks);
      return;
    }

    res.json([]);
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', version: serverPackageVersion });
  });

  app.get('/version.json', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const distVersionPath = path.join(__dirname, 'dist', 'version.json');
    if (process.env.NODE_ENV === 'production' && fs.existsSync(distVersionPath)) {
      res.type('application/json').sendFile(distVersionPath);
      return;
    }
    res.json({
      version: serverPackageVersion,
      buildTime: new Date().toISOString(),
      githubRepo: (process.env.VITE_GITHUB_REPO || '').trim(),
    });
  });

  // Server-side Free Reverse Geocoding proxy (OpenStreetMap Nominatim + BigDataCloud fallback — zero API key/quota)
  app.get('/api/reverse-geocode', async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const lang = req.query.lang === 'en' ? 'en' : 'bn';

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      res.status(400).json({
        code: 'INVALID_ARGUMENT',
        message: 'সঠিক অক্ষাংশ ও দ্রাঘিমাংশ প্রদান করুন।',
      });
      return;
    }

    const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)},${lang}`;
    const cached = reverseGeocodeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({
        formattedAddress: cached.formattedAddress,
        areaLabel: cached.areaLabel,
        source: cached.source,
      });
      return;
    }

    try {
      // 1. Primary: OpenStreetMap Nominatim (Free, detailed Bangladesh street/thana/district labels)
      const osmUrl = new URL('https://nominatim.openstreetmap.org/reverse');
      osmUrl.searchParams.set('format', 'jsonv2');
      osmUrl.searchParams.set('lat', String(lat));
      osmUrl.searchParams.set('lon', String(lng));
      osmUrl.searchParams.set('zoom', '16');
      osmUrl.searchParams.set('addressdetails', '1');
      osmUrl.searchParams.set('accept-language', lang === 'bn' ? 'bn,en' : 'en');

      const osmRes = await fetch(osmUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': `RoktoDei/${serverPackageVersion} (Bangladesh Blood Donor App)`,
        },
        signal: AbortSignal.timeout(4500),
      });

      if (osmRes.ok) {
        const osmData = (await osmRes.json()) as {
          display_name?: string;
          address?: {
            road?: string;
            neighbourhood?: string;
            suburb?: string;
            city_district?: string;
            town?: string;
            village?: string;
            city?: string;
            county?: string;
            state_district?: string;
            state?: string;
            country?: string;
          };
        };

        const addr = osmData.address || {};
        const localPart =
          addr.neighbourhood ||
          addr.suburb ||
          addr.road ||
          addr.village ||
          addr.town ||
          addr.city_district ||
          '';
        const cityPart =
          addr.city ||
          addr.county ||
          (addr.state_district || '').replace(/\s*District$/i, '') ||
          addr.state ||
          '';

        const conciseParts = Array.from(
          new Set([localPart, cityPart].map((s) => s.trim()).filter(Boolean))
        );
        const areaLabel = conciseParts.join(', ');
        const formattedAddress =
          (conciseParts.length > 0
            ? `${conciseParts.join(', ')}${addr.country ? `, ${addr.country}` : ''}`
            : osmData.display_name?.trim()) || '';

        if (formattedAddress) {
          if (reverseGeocodeCache.size >= 200) {
            reverseGeocodeCache.clear();
          }
          reverseGeocodeCache.set(cacheKey, {
            formattedAddress,
            areaLabel: areaLabel || formattedAddress,
            source: 'osm_nominatim',
            expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS,
          });
          res.json({
            formattedAddress,
            areaLabel: areaLabel || formattedAddress,
            source: 'osm_nominatim',
          });
          return;
        }
      }

      // 2. Fallback: BigDataCloud Free Reverse Geocoding API (no API key required)
      const bdcUrl = new URL(
        'https://api.bigdatacloud.net/data/reverse-geocode-client'
      );
      bdcUrl.searchParams.set('latitude', String(lat));
      bdcUrl.searchParams.set('longitude', String(lng));
      bdcUrl.searchParams.set('localityLanguage', lang);

      const bdcRes = await fetch(bdcUrl.toString(), {
        signal: AbortSignal.timeout(4500),
      });

      if (bdcRes.ok) {
        const bdcData = (await bdcRes.json()) as {
          locality?: string;
          city?: string;
          principalSubdivision?: string;
          countryName?: string;
        };
        const parts = Array.from(
          new Set(
            [
              bdcData.locality,
              bdcData.city,
              bdcData.principalSubdivision,
              bdcData.countryName,
            ]
              .map((s) => (s || '').trim())
              .filter(Boolean)
          )
        );
        if (parts.length > 0) {
          const areaLabel = parts.slice(0, 2).join(', ');
          const formattedAddress = parts.join(', ');
          if (reverseGeocodeCache.size >= 200) {
            reverseGeocodeCache.clear();
          }
          reverseGeocodeCache.set(cacheKey, {
            formattedAddress,
            areaLabel,
            source: 'bigdatacloud',
            expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS,
          });
          res.json({
            formattedAddress,
            areaLabel,
            source: 'bigdatacloud',
          });
          return;
        }
      }
    } catch {
      // Fall through cleanly to coordinate fallback below
    }

    const fb = formatCoordFallback(lat, lng, lang);
    res.json({ ...fb, source: 'fallback' });
  });

  app.get('/api/rate-limit-status', async (req: Request, res: Response) => {
    try {
      const caller = await verifyFirebaseBearerToken(req);
      if (!caller.emailVerified) {
        res.status(403).json({
          code: 'EMAIL_NOT_VERIFIED',
          message: 'ইমেইল যাচাই সম্পন্ন না করে যোগাযোগের তথ্য দেখা যাবে না।',
        });
        return;
      }

      const status = pruneAndEvaluateQuota(caller.uid);
      res.json({
        ok: true,
        quota: {
          hourlyUsed: status.hourlyUsed,
          hourlyLimit: HOURLY_UNIQUE_TARGET_LIMIT,
          dailyUsed: status.dailyUsed,
          dailyLimit: DAILY_UNIQUE_TARGET_LIMIT,
        },
      });
    } catch {
      res.status(401).json({
        code: 'UNAUTHENTICATED',
        message: 'অনুগ্রহ করে পুনরায় লগইন করুন।',
      });
    }
  });

  // Server-authoritative Contact Gate: verifies signed Firebase JWT, email_verified claim, and anti-scraping rate limits
  app.post('/api/contact-gate', async (req: Request, res: Response) => {
    try {
      const caller = await verifyFirebaseBearerToken(req);
      if (!caller.emailVerified) {
        res.status(403).json({
          code: 'EMAIL_NOT_VERIFIED',
          message: 'ডোনারের যোগাযোগ তথ্য দেখতে আগে আপনার ইমেইল ভেরিফাই করুন।',
        });
        return;
      }

      const { targetType, targetId, requestedMethod } = req.body as {
        targetType?: unknown;
        targetId?: unknown;
        requestedMethod?: unknown;
      };

      const validTargetTypes = ['donor', 'blood_request'];
      const validMethods = ['call', 'sms', 'whatsapp', 'imo'];
      const idPattern = /^[a-zA-Z0-9_-]{1,128}$/;

      if (
        typeof targetType !== 'string' ||
        !validTargetTypes.includes(targetType) ||
        typeof targetId !== 'string' ||
        !idPattern.test(targetId) ||
        typeof requestedMethod !== 'string' ||
        !validMethods.includes(requestedMethod)
      ) {
        res.status(400).json({
          code: 'INVALID_ARGUMENT',
          message: 'অনুরোধের তথ্য সঠিক নয়।',
        });
        return;
      }

      const targetKey = `${targetType}:${targetId}`;
      const quotaResult = pruneAndEvaluateQuota(caller.uid, targetKey);

      if (!quotaResult.allowed) {
        res.status(429).json({
          code: 'RESOURCE_EXHAUSTED',
          message:
            'নিরাপত্তার স্বার্থে আপনার ঘণ্টা বা দৈনিক যোগাযোগ নম্বর দেখার সীমা পূর্ণ হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
          quota: {
            hourlyUsed: quotaResult.hourlyUsed,
            hourlyLimit: HOURLY_UNIQUE_TARGET_LIMIT,
            dailyUsed: quotaResult.dailyUsed,
            dailyLimit: DAILY_UNIQUE_TARGET_LIMIT,
          },
        });
        return;
      }

      res.json({
        ok: true,
        quota: {
          hourlyUsed: quotaResult.hourlyUsed,
          hourlyLimit: HOURLY_UNIQUE_TARGET_LIMIT,
          dailyUsed: quotaResult.dailyUsed,
          dailyLimit: DAILY_UNIQUE_TARGET_LIMIT,
        },
      });
    } catch {
      res.status(401).json({
        code: 'UNAUTHENTICATED',
        message: 'লগইন সেশন যাচাই করা যায়নি। অনুগ্রহ করে পুনরায় লগইন করুন।',
      });
    }
  });

  const httpServer = http.createServer(app);
  let viteInstance: ViteDevServer | null = null;

  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    }).then((vite) => {
      viteInstance = vite;
      return vite;
    });

    app.use(async (req: Request, res: Response, next: NextFunction) => {
      try {
        const vite = viteInstance || (await vitePromise);
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        setHeaders(res, filePath) {
          if (filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json');
          } else if (
            filePath.endsWith('sw.js') ||
            filePath.endsWith('version.json')
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Rokto Dei server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    httpServer.close(() => {
      if (viteInstance) {
        viteInstance.close().finally(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

startServer();
