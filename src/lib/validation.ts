import type {
  AvailabilityStatus,
  BloodGroup,
  ContactMethod,
  DonationComponentType,
  DonorDonationPreference,
  DonorGender,
  NightCallPreference,
  ReportReason,
} from '../types';

export const BLOOD_GROUPS: readonly BloodGroup[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
] as const;

export const CONTACT_METHODS: readonly ContactMethod[] = [
  'call',
  'sms',
  'whatsapp',
  'imo',
] as const;

export const AVAILABILITY_OPTIONS: readonly AvailabilityStatus[] = [
  'available',
  'temporarily_unavailable',
  'not_specified',
] as const;

export const REPORT_REASONS: readonly ReportReason[] = [
  'incorrect_phone',
  'abusive_contact',
  'fake_profile',
  'spam',
  'misleading_availability',
  'other',
] as const;

export const DONOR_GENDERS: readonly DonorGender[] = [
  'male',
  'female',
  'other',
  'not_specified',
] as const;

export const DONATION_PREFERENCES: readonly DonorDonationPreference[] = [
  'whole_blood',
  'platelet',
  'both',
] as const;

export const NIGHT_CALL_PREFERENCES: readonly NightCallPreference[] = [
  'anytime',
  'daytime_only',
  'message_first',
] as const;

export const DONATION_COMPONENT_TYPES: readonly DonationComponentType[] = [
  'whole_blood',
  'platelet',
  'plasma',
] as const;

// Exact volumetric & pattern constants synchronized with firebase-blueprint.json & firestore.rules
export const SCHEMA_LIMITS = {
  ID_MAX: 128,
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  SLUG_REGEX: /^[a-z0-9_-]+$/,
  NAME_MIN: 2,
  NAME_MAX: 80,
  EMAIL_MIN: 5,
  EMAIL_MAX: 160,
  HOSPITAL_MIN: 3,
  HOSPITAL_MAX: 120,
  OCCUPATION_MAX: 80,
  PREFERRED_AREA_MAX: 140,
  DONOR_NOTE_MAX: 240,
  BOOKING_NOTE_MAX: 240,
  PLEDGE_MSG_MAX: 240,
  RECIPIENT_SUMMARY_MAX: 240,
  NOTE_MAX: 400,
  REPORT_DESC_MAX: 500,
  AUDIT_REASON_MIN: 3,
  AUDIT_REASON_MAX: 400,
  BD_PHONE_E164_REGEX: /^\+8801[3-9][0-9]{8}$/,
  ISO_DATE_REGEX: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  USERNAME_REGEX: /^[a-zA-Z0-9_]{3,30}$/,
  USERNAME_LOWER_REGEX: /^[a-z0-9_]{3,30}$/,
} as const;

const BENGALI_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (ch) => BENGALI_DIGITS[ch] ?? ch);
}

/**
 * Normalizes Bangladesh mobile numbers (including Bengali digits, spaces, hyphens,
 * 01XXXXXXXXX, 8801XXXXXXXXX, or +8801XXXXXXXXX) into strict E.164 `+8801[3-9]XXXXXXXX`.
 */
export function normalizeBdPhone(raw: string): string | null {
  const ascii = toAsciiDigits(raw).trim();
  const stripped = ascii.replace(/[\s\-()]/g, '');

  let candidate = stripped;
  if (/^01[3-9][0-9]{8}$/.test(stripped)) {
    candidate = `+88${stripped}`;
  } else if (/^8801[3-9][0-9]{8}$/.test(stripped)) {
    candidate = `+${stripped}`;
  } else if (/^008801[3-9][0-9]{8}$/.test(stripped)) {
    candidate = `+${stripped.slice(2)}`;
  }

  return SCHEMA_LIMITS.BD_PHONE_E164_REGEX.test(candidate) ? candidate : null;
}

export function codePointLength(str: string): number {
  return Array.from(str).length;
}

export function sanitizeText(raw: string, maxLength: number): string {
  const normalized = raw.replace(/\s+/g, ' ').trim();
  return Array.from(normalized).slice(0, maxLength).join('');
}

export function isValidIsoDate(dateStr: string): boolean {
  if (!dateStr) return true;
  if (!SCHEMA_LIMITS.ISO_DATE_REGEX.test(dateStr)) return false;
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

export function daysSinceDate(dateStr: string): number | null {
  if (!dateStr || !SCHEMA_LIMITS.ISO_DATE_REGEX.test(dateStr)) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return days >= 0 ? days : null;
}

/**
 * Builds official supported contact deep links per Architecture.md Section 7.
 * Never invents an unsupported URI scheme for IMO (returns null so safe copy-number fallback opens).
 */
export function buildContactDeepLink(
  e164Phone: string,
  method: ContactMethod
): string | null {
  if (!SCHEMA_LIMITS.BD_PHONE_E164_REGEX.test(e164Phone)) {
    return null;
  }

  switch (method) {
    case 'call':
      return `tel:${e164Phone}`;
    case 'sms':
      return `sms:${e164Phone}`;
    case 'whatsapp': {
      const digitsOnly = e164Phone.replace(/^\+/, '');
      return `https://wa.me/${digitsOnly}`;
    }
    case 'imo':
      // Official public phone-based web/Android URI scheme is not standardized for IMO;
      // return null to invoke the safe number-copy fallback dialog (TC-016).
      return null;
    default:
      return null;
  }
}

export function generateSafeId(prefix: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 20)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${randomPart}`.slice(0, SCHEMA_LIMITS.ID_MAX);
}

export function isValidUsername(raw: string): boolean {
  if (!raw) return false;
  return SCHEMA_LIMITS.USERNAME_REGEX.test(raw.trim());
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function getUsernameValidationError(
  raw: string,
  lang: 'bn' | 'en' = 'bn'
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return lang === 'bn'
      ? 'ইউজারনেম খালি রাখা যাবে না।'
      : 'Username cannot be empty.';
  }
  if (trimmed.length < SCHEMA_LIMITS.USERNAME_MIN) {
    return lang === 'bn'
      ? `ইউজারনেম কমপক্ষে ৩ অক্ষরের হতে হবে।`
      : `Username must be at least ${SCHEMA_LIMITS.USERNAME_MIN} characters.`;
  }
  if (trimmed.length > SCHEMA_LIMITS.USERNAME_MAX) {
    return lang === 'bn'
      ? `ইউজারনেম সর্বোচ্চ ৩০ অক্ষরের হতে পারে।`
      : `Username cannot exceed ${SCHEMA_LIMITS.USERNAME_MAX} characters.`;
  }
  if (!SCHEMA_LIMITS.USERNAME_REGEX.test(trimmed)) {
    return lang === 'bn'
      ? 'ইউজারনেমে শুধুমাত্র ইংরেজি অক্ষর (A-Z, a-z), সংখ্যা (0-9) এবং আন্ডারস্কোর (_) ব্যবহার করা যাবে।'
      : 'Username can only contain English letters, numbers, and underscores (_).';
  }
  return null;
}

