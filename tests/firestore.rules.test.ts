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
  DEMO_BLOOD_REQUESTS,
  DEMO_CONTACT_LOGS,
  DEMO_DONATION_RECORDS,
  DEMO_DONOR_PHONES,
  DEMO_DONORS,
  DEMO_REQUEST_PHONES,
  DEMO_REQUEST_PLEDGES,
  filterAndMergeBloodRequests,
  filterAndMergeDonors,
  isDemoRecordId,
} from '../src/data/removableDemoData';
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

  it('validates removable demo donors, booked blood requests, donation history records, pledges, and contact logs', () => {
    expect(DEMO_DONORS.length).toBeGreaterThanOrEqual(20);
    expect(DEMO_BLOOD_REQUESTS.length).toBeGreaterThanOrEqual(8);
    expect(DEMO_DONATION_RECORDS.length).toBeGreaterThanOrEqual(4);
    expect(DEMO_REQUEST_PLEDGES.length).toBeGreaterThanOrEqual(2);
    expect(DEMO_CONTACT_LOGS.length).toBeGreaterThanOrEqual(2);

    // Every one of the 8 blood groups is covered by demo donors
    for (const bg of BLOOD_GROUPS) {
      expect(DEMO_DONORS.some((d) => d.bloodGroup === bg)).toBe(true);
    }

    for (const donor of DEMO_DONORS) {
      expect(isDemoRecordId(donor.uid)).toBe(true);
      expect(donor.totalDonationsCount).toBeGreaterThanOrEqual(1);
      expect(
        isValidLocationHierarchy(
          donor.divisionId,
          donor.districtId,
          donor.upazilaId
        )
      ).toBe(true);
      const phone = DEMO_DONOR_PHONES[donor.uid];
      expect(phone).toBeDefined();
      expect(normalizeBdPhone(phone)).toBe(phone);
    }

    for (const req of DEMO_BLOOD_REQUESTS) {
      expect(isDemoRecordId(req.id)).toBe(true);
      expect(
        isValidLocationHierarchy(req.divisionId, req.districtId, req.upazilaId)
      ).toBe(true);
      const phone = DEMO_REQUEST_PHONES[req.id];
      expect(phone).toBeDefined();
      expect(normalizeBdPhone(phone)).toBe(phone);
    }

    // Verify booked request filter separation ('open_only' vs 'booked_only' vs 'active_all')
    const bookedOnly = filterAndMergeBloodRequests({
      realRequests: [],
      statusFilter: 'booked_only',
      includeDemo: true,
    });
    expect(bookedOnly.length).toBeGreaterThanOrEqual(2);
    expect(bookedOnly.every((r) => r.status === 'booked')).toBe(true);
    expect(bookedOnly.every((r) => Boolean(r.bookedDonorName))).toBe(true);

    const openOnly = filterAndMergeBloodRequests({
      realRequests: [],
      statusFilter: 'open_only',
      includeDemo: true,
    });
    expect(openOnly.every((r) => r.status === 'open')).toBe(true);

    for (const rec of DEMO_DONATION_RECORDS) {
      expect(isDemoRecordId(rec.id)).toBe(true);
      expect(rec.volumeMl).toBeGreaterThanOrEqual(150);
      expect(
        isValidLocationHierarchy(rec.divisionId, rec.districtId, rec.upazilaId)
      ).toBe(true);
    }

    // Verify honest separate counts (totalListedCount vs availableCount) and toggle-off behavior
    const oPosAll = filterAndMergeDonors({
      realDonors: [],
      bloodGroup: 'O+',
      includeDemo: true,
    });
    expect(oPosAll.totalListedCount).toBe(7);
    expect(oPosAll.availableCount).toBe(5);

    const toggledOff = filterAndMergeDonors({
      realDonors: [],
      bloodGroup: 'O+',
      includeDemo: false,
    });
    expect(toggledOff.totalListedCount).toBe(0);
    expect(toggledOff.donors).toHaveLength(0);
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
});
