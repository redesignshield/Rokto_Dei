import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DISTRICTS,
  DIVISIONS,
  formatLocationLabel,
  isValidLocationHierarchy,
} from '../src/data/bdLocations';
import {
  BLOOD_GROUPS,
  buildContactDeepLink,
  codePointLength,
  getUsernameValidationError,
  isValidUsername,
  normalizeUsername,
  normalizeBdPhone,
  sanitizeText,
  SCHEMA_LIMITS,
} from '../src/lib/validation';
import {
  compareSemVer,
  isTrustedGitHubUrl,
  isValidSha256Hex,
} from '../src/lib/appVersion';

const rulesPath = path.resolve(__dirname, '../firestore.rules');
const blueprintPath = path.resolve(__dirname, '../firebase-blueprint.json');
const roktoServicePath = path.resolve(
  __dirname,
  '../src/services/roktoService.ts'
);
const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));
const roktoServiceContent = fs.readFileSync(roktoServicePath, 'utf-8');

describe('Rokto Dei — Validation, Locations, Deep Links, Booking Lock & Security Rules Invariants', () => {
  it('normalizes valid Bangladesh mobile numbers (including Bengali digits) to E.164 +8801XXXXXXXXX', () => {
    expect(normalizeBdPhone('01712345678')).toBe('+8801712345678');
    expect(normalizeBdPhone('+8801812-345678')).toBe('+8801812345678');
    expect(normalizeBdPhone('8801912 345 678')).toBe('+8801912345678');
    expect(normalizeBdPhone('০১৭১২৩৪৫৬৭৮')).toBe('+8801712345678');
  });

  it('rejects invalid or non-BD mobile phone payloads (Dirty Dozen #07)', () => {
    expect(normalizeBdPhone('01112345678')).toBeNull();
    expect(normalizeBdPhone('01712345')).toBeNull();
    expect(normalizeBdPhone('+14155552671')).toBeNull();
    expect(normalizeBdPhone('x'.repeat(5000))).toBeNull();
  });

  it('counts and slices Unicode code points accurately to match Firestore CEL string.size()', () => {
    // A single astral emoji has UTF-16 .length === 2, but CEL .size() === 1
    expect('🩸'.length).toBe(2);
    expect(codePointLength('🩸')).toBe(1);
    expect(codePointLength('ব্যবহারকারী')).toBe(11);
    const sanitized = sanitizeText('  রক্তদাতা   নাম  ', 80);
    expect(sanitized).toBe('রক্তদাতা নাম');
  });

  it('deduplicates concurrent ensureUserProfile calls to prevent setDoc create/update race conditions on login', () => {
    expect(roktoServiceContent).toContain('inFlightUserProfilePromises');
    expect(roktoServiceContent).toContain('ensureUserProfileInternal');
  });

  it('generates official contact URIs and safe null fallback for IMO (TC-013, TC-015, TC-016)', () => {
    const phone = '+8801712345678';
    expect(buildContactDeepLink(phone, 'call')).toBe('tel:+8801712345678');
    expect(buildContactDeepLink(phone, 'sms')).toBe('sms:+8801712345678');
    expect(buildContactDeepLink(phone, 'whatsapp')).toBe(
      'https://wa.me/8801712345678'
    );
    expect(buildContactDeepLink(phone, 'imo')).toBeNull();
  });

  it('contains all 8 divisions and 64 districts of Bangladesh with valid hierarchy checks', () => {
    expect(DIVISIONS).toHaveLength(8);
    expect(DISTRICTS).toHaveLength(64);
    expect(isValidLocationHierarchy('dhaka', 'dhaka', 'dhanmondi')).toBe(true);
    expect(isValidLocationHierarchy('sylhet', 'dhaka', 'dhanmondi')).toBe(false);
    expect(formatLocationLabel('dhaka', 'dhaka', 'dhanmondi', 'bn')).toContain(
      'ধানমন্ডি'
    );
  });

  it('defines all 13 Firestore collections in both firebase-blueprint.json and firestore.rules including unique usernames registry', () => {
    const expectedPaths = [
      '/users/{uid}',
      '/donors/{uid}',
      '/donorPrivate/{uid}',
      '/donationRecords/{recordId}',
      '/contactAccessLogs/{logId}',
      '/bloodRequests/{requestId}',
      '/bloodRequestPrivate/{requestId}',
      '/requestPledges/{pledgeId}',
      '/reports/{reportId}',
      '/adminRoles/{uid}',
      '/auditLogs/{logId}',
      '/notifications/{notificationId}',
      '/usernames/{usernameLower}',
      '/appConfig/{configId}',
    ];

    for (const colPath of expectedPaths) {
      expect(blueprint.firestore[colPath]).toBeDefined();
      expect(rulesContent).toContain(`match ${colPath}`);
    }
  });

  it('enforces Dirty Dozen invariants and Donor Booking Anti-Disturb Call Lock in firestore.rules', () => {
    // 1. Global default-deny safety net
    expect(rulesContent).toContain(
      'match /{document=**} {\n      allow read, write: if false;\n    }'
    );

    // 2. Email spoofing guard on super admin & writes
    expect(rulesContent).toContain('request.auth.token.email_verified == true');

    // 3. Unconditional list block on private phone collections (Dirty Dozen #03)
    const donorPrivBlock =
      rulesContent.split('match /donorPrivate/{uid}')[1]?.split('match /')[0] ||
      '';
    expect(donorPrivBlock).toContain('allow list: if false;');

    const reqPrivBlock =
      rulesContent
        .split('match /bloodRequestPrivate/{requestId}')[1]
        ?.split('match /')[0] || '';
    expect(reqPrivBlock).toContain('allow list: if false;');

    // 4. Hard Call Lock when a request is booked: bloodRequests allows ['open', 'booked'] visibility,
    //    while bloodRequestPrivate strictly requires status == 'open' via isBloodRequestContactable!
    expect(rulesContent).toContain("existing().status in ['open', 'booked']");
    const contactableHelper =
      rulesContent
        .split('function isBloodRequestContactable(requestId)')[1]
        ?.split('}')[0] || '';
    expect(contactableHelper).toContain(".data.status == 'open'");
    expect(contactableHelper).not.toContain("'booked'");

    // 5. Atomic phone existence guarantee when listing donor or creating blood request (Dirty Dozen #06)
    expect(rulesContent).toContain(
      'existsAfter(/databases/$(database)/documents/donorPrivate/$(uid))'
    );
    expect(rulesContent).toContain(
      'existsAfter(/databases/$(database)/documents/bloodRequestPrivate/$(requestId))'
    );

    // 6. Cost-Optimization Clause: Zero get() or exists() inside any `allow list:` statement across all 11 collections
    const listBlocks = rulesContent.match(/allow list:[^;]+;/g) || [];
    expect(listBlocks.length).toBeGreaterThanOrEqual(11);
    for (const block of listBlocks) {
      expect(block).not.toContain('get(');
      expect(block).not.toContain('exists(');
    }

    // 7. Synchronized E.164 regex between client validation and rules
    expect(SCHEMA_LIMITS.BD_PHONE_E164_REGEX.source).toBe(
      '^\\+8801[3-9][0-9]{8}$'
    );
    expect(rulesContent).toContain('^\\\\+8801[3-9][0-9]{8}$');
  });

  it('covers all 8 standard blood groups in validation schema', () => {
    expect(BLOOD_GROUPS).toEqual([
      'A+',
      'A-',
      'B+',
      'B-',
      'AB+',
      'AB-',
      'O+',
      'O-',
    ]);
  });

  it('validates unique username formatting, lowercase normalization, and security rules registration constraints', () => {
    // 1. Validation helpers
    expect(isValidUsername('akram_99')).toBe(true);
    expect(isValidUsername('User123')).toBe(true);
    expect(isValidUsername('ab')).toBe(false); // under 3 chars
    expect(isValidUsername('a'.repeat(31))).toBe(false); // over 30 chars
    expect(isValidUsername('akram@blood')).toBe(false); // invalid special char
    expect(isValidUsername('akram 99')).toBe(false); // spaces forbidden

    // 2. Normalization
    expect(normalizeUsername(' Akram_99 ')).toBe('akram_99');

    // 3. Error messages
    expect(getUsernameValidationError('', 'bn')).toContain('খালি রাখা যাবে না');
    expect(getUsernameValidationError('ab', 'bn')).toContain('কমপক্ষে ৩');
    expect(getUsernameValidationError('user@name', 'bn')).toContain('শুধুমাত্র ইংরেজি অক্ষর');
    expect(getUsernameValidationError('valid_user', 'bn')).toBeNull();

    // 4. Firestore rules enforcement: usernames registry rule
    expect(rulesContent).toContain('match /usernames/{usernameLower}');
    expect(rulesContent).toContain('isValidUsernameReservation(incoming(), usernameLower)');
    expect(rulesContent).toContain('incoming().uid == request.auth.uid');
    expect(rulesContent).toContain('data.usernameLower == usernameLower');
  });

  it('enforces SemVer anti-downgrade guard, GitHub URL pinning, and /appConfig/release security rules', () => {
    // 1. SemVer anti-downgrade comparison
    expect(compareSemVer('1.1.0', '1.0.0')).toBe(1);
    expect(compareSemVer('1.0.10', '1.0.2')).toBe(1);
    expect(compareSemVer('v1.0.0', '1.0.0')).toBe(0);
    expect(compareSemVer('0.9.9', '1.0.0')).toBe(-1);
    expect(compareSemVer('invalid', '1.0.0')).toBe(0);

    // 2. Strict GitHub URL allowlist & optional repo pinning
    expect(
      isTrustedGitHubUrl(
        'https://github.com/roktodei/app/releases/download/v1.1.0/RoktoDei-v1.1.0.apk',
        'roktodei/app'
      )
    ).toBe(true);
    expect(
      isTrustedGitHubUrl(
        'http://github.com/roktodei/app/releases/latest',
        'roktodei/app'
      )
    ).toBe(false);
    expect(
      isTrustedGitHubUrl('https://evil.example.com/app.apk', 'roktodei/app')
    ).toBe(false);
    expect(
      isTrustedGitHubUrl(
        'https://user:pass@github.com/roktodei/app/releases/latest'
      )
    ).toBe(false);
    expect(
      isTrustedGitHubUrl(
        'https://github.com/other/repo/releases/latest',
        'roktodei/app'
      )
    ).toBe(false);

    // 3. SHA-256 checksum validation
    expect(isValidSha256Hex('a'.repeat(64))).toBe(true);
    expect(isValidSha256Hex('g'.repeat(64))).toBe(false);
    expect(isValidSha256Hex('abc123')).toBe(false);

    // 4. Firestore rules enforcement for /appConfig/release
    const appConfigBlock =
      rulesContent.split('match /appConfig/{configId}')[1]?.split('match /')[0] ||
      '';
    expect(appConfigBlock).toContain("allow get: if configId == 'release';");
    expect(appConfigBlock).toContain('allow list: if false;');
    expect(appConfigBlock).toContain('isBootstrappedAdmin()');
    expect(appConfigBlock).toContain('allow delete: if false;');
    expect(rulesContent).toContain("'publish_app_release'");
    expect(rulesContent).toContain('isTrustedReleaseUrl(');
  });
});
