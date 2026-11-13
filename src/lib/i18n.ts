import type { Timestamp } from 'firebase/firestore';
import type {
  AppLanguage,
  AvailabilityStatus,
  BloodRequestStatus,
  BloodRequestUrgency,
  ContactMethod,
  DonationComponentType,
  DonorDonationPreference,
  DonorGender,
  NightCallPreference,
  PledgeStatus,
  ReportReason,
  ReportStatus,
} from '../types';

export function availabilityLabel(
  status: AvailabilityStatus,
  lang: AppLanguage
): string {
  const labels: Record<AvailabilityStatus, { bn: string; en: string }> = {
    available: {
      bn: 'রক্তদানে প্রস্তুত',
      en: 'Available',
    },
    temporarily_unavailable: {
      bn: 'সাময়িকভাবে অনুপস্থিত',
      en: 'Temporarily Unavailable',
    },
    not_specified: {
      bn: 'উল্লেখ করা হয়নি',
      en: 'Not Specified',
    },
  };
  return labels[status][lang];
}

export function contactMethodLabel(
  method: ContactMethod,
  lang: AppLanguage
): string {
  const labels: Record<ContactMethod, { bn: string; en: string }> = {
    call: { bn: 'সরাসরি কল', en: 'Direct Call' },
    sms: { bn: 'SMS', en: 'SMS' },
    whatsapp: { bn: 'WhatsApp', en: 'WhatsApp' },
    imo: { bn: 'IMO', en: 'IMO' },
  };
  return labels[method][lang];
}

export function genderLabel(gender: DonorGender, lang: AppLanguage): string {
  const labels: Record<DonorGender, { bn: string; en: string }> = {
    male: { bn: 'পুরুষ', en: 'Male' },
    female: { bn: 'নারী', en: 'Female' },
    other: { bn: 'অন্যান্য', en: 'Other' },
    not_specified: { bn: 'উল্লেখ নেই', en: 'Prefer not to say' },
  };
  return labels[gender][lang];
}

export function donationPreferenceLabel(
  pref: DonorDonationPreference,
  lang: AppLanguage
): string {
  const labels: Record<DonorDonationPreference, { bn: string; en: string }> = {
    whole_blood: { bn: 'হোল ব্লাড (Whole Blood)', en: 'Whole Blood' },
    platelet: { bn: 'প্লাটিলেট (Platelet)', en: 'Platelet' },
    both: { bn: 'হোল ব্লাড ও প্লাটিলেট উভয়ই', en: 'Whole Blood & Platelet' },
  };
  return labels[pref][lang];
}

export function donationComponentLabel(
  comp: DonationComponentType,
  lang: AppLanguage
): string {
  const labels: Record<DonationComponentType, { bn: string; en: string }> = {
    whole_blood: { bn: 'হোল ব্লাড', en: 'Whole Blood' },
    platelet: { bn: 'প্লাটিলেট', en: 'Platelet' },
    plasma: { bn: 'প্লাজমা', en: 'Plasma' },
  };
  return labels[comp][lang];
}

export function nightCallPreferenceLabel(
  pref: NightCallPreference,
  lang: AppLanguage
): string {
  const labels: Record<NightCallPreference, { bn: string; en: string }> = {
    anytime: {
      bn: 'জরুরি প্রয়োজনে যেকোনো সময় কল করা যাবে',
      en: 'Emergency calls anytime (24/7)',
    },
    daytime_only: {
      bn: 'শুধু সকাল ৮টা – রাত ১০টার মধ্যে কল করুন',
      en: 'Daytime calls only (8 AM – 10 PM)',
    },
    message_first: {
      bn: 'কল দেওয়ার আগে SMS / WhatsApp মেসেজ দিন',
      en: 'Send SMS / WhatsApp before calling',
    },
  };
  return labels[pref][lang];
}

export function urgencyLabel(
  urgency: BloodRequestUrgency,
  lang: AppLanguage
): string {
  const labels: Record<BloodRequestUrgency, { bn: string; en: string }> = {
    emergency: { bn: 'অতি জরুরি (আজই প্রয়োজন)', en: 'Emergency (Today)' },
    urgent: { bn: 'জরুরি (২৪–৪৮ ঘণ্টা)', en: 'Urgent (24–48h)' },
    scheduled: { bn: 'নির্ধারিত তারিখ', en: 'Scheduled' },
  };
  return labels[urgency][lang];
}

export function requestStatusLabel(
  status: BloodRequestStatus,
  lang: AppLanguage
): string {
  const labels: Record<BloodRequestStatus, { bn: string; en: string }> = {
    open: { bn: 'চলমান (কল সচল)', en: 'Open' },
    booked: {
      bn: 'ডোনার বুকড (নতুন কল বন্ধ)',
      en: 'Donor Booked (Calls Paused)',
    },
    fulfilled: { bn: 'রক্ত সংগৃহীত হয়েছে', en: 'Fulfilled' },
    cancelled: { bn: 'বাতিল করা হয়েছে', en: 'Cancelled' },
    expired: { bn: 'মেয়াদোত্তীর্ণ', en: 'Expired' },
    removed: { bn: 'অপসারিত (মডারেশন)', en: 'Removed' },
  };
  return labels[status][lang];
}

export function pledgeStatusLabel(
  status: PledgeStatus,
  lang: AppLanguage
): string {
  const labels: Record<PledgeStatus, { bn: string; en: string }> = {
    offered: { bn: 'আগ্রহ প্রকাশ করেছেন', en: 'Offered' },
    accepted: { bn: 'চূড়ান্ত / বুকড', en: 'Accepted & Booked' },
    declined: { bn: 'অন্য ডোনার চূড়ান্ত', en: 'Declined' },
    withdrawn: { bn: 'প্রত্যাহারকৃত', en: 'Withdrawn' },
  };
  return labels[status][lang];
}

export function reportReasonLabel(
  reason: ReportReason,
  lang: AppLanguage
): string {
  const labels: Record<ReportReason, { bn: string; en: string }> = {
    incorrect_phone: { bn: 'ভুল বা অচল ফোন নম্বর', en: 'Incorrect phone number' },
    abusive_contact: { bn: 'অশোভন আচরণ বা হয়রানি', en: 'Abusive behavior' },
    fake_profile: { bn: 'ভুয়া প্রোফাইল বা তথ্য', en: 'Fake profile' },
    spam: { bn: 'স্প্যাম বা বাণিজ্যিক প্রচারণা', en: 'Spam' },
    misleading_availability: {
      bn: 'ভ্রান্ত প্রাপ্যতা (Availability) তথ্য',
      en: 'Misleading availability',
    },
    other: { bn: 'অন্যান্য', en: 'Other' },
  };
  return labels[reason][lang];
}

export function reportStatusLabel(
  status: ReportStatus,
  lang: AppLanguage
): string {
  const labels: Record<ReportStatus, { bn: string; en: string }> = {
    open: { bn: 'অপেক্ষমাণ', en: 'Open' },
    reviewing: { bn: 'পর্যালোচনাধীন', en: 'Reviewing' },
    resolved: { bn: 'সমাধানকৃত', en: 'Resolved' },
    dismissed: { bn: 'খারিজকৃত', en: 'Dismissed' },
  };
  return labels[status][lang];
}

export function formatTimestamp(
  ts: Timestamp | null | undefined,
  lang: AppLanguage
): string {
  if (!ts || typeof ts.toDate !== 'function') {
    return lang === 'bn' ? 'সদ্য আপডেটকৃত' : 'Just updated';
  }
  const date = ts.toDate();
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
