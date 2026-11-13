import { Timestamp } from 'firebase/firestore';
import type {
  AbuseReport,
  AvailabilityStatus,
  BloodGroup,
  BloodRequest,
  BloodRequestStatus,
  ContactAccessLogRecord,
  ContactMethod,
  DonationRecord,
  DonorDonationPreference,
  DonorGender,
  DonorProfile,
  NightCallPreference,
  RequestPledge,
} from '../types';

/**
 * TEMPORARY / REMOVABLE DEMO DATA MODULE
 * ---------------------------------------------------------------------------
 * Isolated in a single client-side file for UI preview & QA testing.
 * - Zero fake documents are ever written to the live Cloud Firestore database.
 * - Can be toggled off anytime with 1 click in the UI (`demoMode = false`).
 * - Can be permanently removed later by deleting this file and removing the
 *   `demoMode` references.
 */

export const DEMO_STORAGE_KEY = 'roktodei_demo_preview';

export function isDemoRecordId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith('demo_'));
}

function hoursAgoTimestamp(hours: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - hours * 60 * 60 * 1000);
}

export function daysOffsetIso(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface DemoDonorSeed {
  uid: string;
  displayName: string;
  phoneNumber: string;
  bloodGroup: BloodGroup;
  divisionId: string;
  districtId: string;
  upazilaId: string;
  availability: AvailabilityStatus;
  updatedHoursAgo: number;
  contactMethods: ContactMethod[];
  lastDonationDaysAgo: number | null;
  totalDonationsCount?: number;
  gender?: DonorGender;
  ageYears?: number;
  weightKg?: number;
  donationPreference?: DonorDonationPreference;
  nightCallPreference?: NightCallPreference;
  occupation?: string;
  preferredHospitalArea?: string;
}

const DEMO_DONOR_SEEDS: readonly DemoDonorSeed[] = [
  // O+ (7 donors across Dhanmondi, Mirpur, Uttara, Gazipur, Chattogram, Rajshahi)
  {
    uid: 'demo_donor_01',
    displayName: 'তানভীর আহমেদ (ডেমো)',
    phoneNumber: '+8801700000101',
    bloodGroup: 'O+',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'dhanmondi',
    availability: 'available',
    updatedHoursAgo: 3,
    contactMethods: ['call', 'whatsapp', 'sms'],
    lastDonationDaysAgo: 132,
    totalDonationsCount: 9,
    gender: 'male',
    ageYears: 29,
    weightKg: 72,
    donationPreference: 'both',
    nightCallPreference: 'anytime',
    occupation: 'সফটওয়্যার প্রকৌশলী',
    preferredHospitalArea: 'DMCH, BSMMU ও ধানমন্ডি এলাকা',
  },
  {
    uid: 'demo_donor_02',
    displayName: 'নুসরাত জাহান (ডেমো)',
    phoneNumber: '+8801800000102',
    bloodGroup: 'O+',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'dhanmondi',
    availability: 'not_specified',
    updatedHoursAgo: 26,
    contactMethods: ['call', 'sms'],
    lastDonationDaysAgo: 155,
    totalDonationsCount: 3,
    gender: 'female',
    ageYears: 25,
    weightKg: 56,
    donationPreference: 'whole_blood',
    nightCallPreference: 'daytime_only',
    occupation: 'শিক্ষার্থী, ঢাকা বিশ্ববিদ্যালয়',
    preferredHospitalArea: 'স্কয়ার, ল্যাবএইড ও শাহবাগ',
  },
  {
    uid: 'demo_donor_03',
    displayName: 'মাহমুদুল হাসান রাফি (ডেমো)',
    phoneNumber: '+8801900000103',
    bloodGroup: 'O+',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'mirpur',
    availability: 'available',
    updatedHoursAgo: 6,
    contactMethods: ['call', 'whatsapp', 'imo'],
    lastDonationDaysAgo: 118,
    totalDonationsCount: 12,
    gender: 'male',
    ageYears: 32,
    weightKg: 76,
    donationPreference: 'both',
    nightCallPreference: 'anytime',
    occupation: 'ব্যাংক কর্মকর্তা',
    preferredHospitalArea: 'মিরপুর হার্ট ফাউন্ডেশন, সোহরাওয়ার্দী ও NICVD',
  },
  {
    uid: 'demo_donor_04',
    displayName: 'সাদিয়া ইসলাম (ডেমো)',
    phoneNumber: '+8801600000104',
    bloodGroup: 'O+',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'uttara',
    availability: 'temporarily_unavailable',
    updatedHoursAgo: 48,
    contactMethods: ['sms', 'whatsapp'],
    lastDonationDaysAgo: 22,
    totalDonationsCount: 4,
    gender: 'female',
    ageYears: 27,
    weightKg: 58,
    donationPreference: 'whole_blood',
    nightCallPreference: 'message_first',
    occupation: 'শিক্ষক',
    preferredHospitalArea: 'উত্তরা ক্রিসেন্ট ও কুর্মিটোলা হাসপাতাল',
  },
  {
    uid: 'demo_donor_05',
    displayName: 'কামরুল ইসলাম (ডেমো)',
    phoneNumber: '+8801700000105',
    bloodGroup: 'O+',
    divisionId: 'dhaka',
    districtId: 'gazipur',
    upazilaId: 'tongi',
    availability: 'available',
    updatedHoursAgo: 11,
    contactMethods: ['call', 'imo'],
    lastDonationDaysAgo: 140,
    totalDonationsCount: 6,
    gender: 'male',
    ageYears: 30,
    weightKg: 68,
    donationPreference: 'whole_blood',
    nightCallPreference: 'anytime',
    occupation: 'শিল্প কারখানা কর্মকর্তা',
    preferredHospitalArea: 'টঙ্গী শহীদ আহসান উল্লাহ মাস্টার হাসপাতাল',
  },
  {
    uid: 'demo_donor_06',
    displayName: 'আরিফুল হক চৌধুরী (ডেমো)',
    phoneNumber: '+8801800000106',
    bloodGroup: 'O+',
    divisionId: 'chattogram',
    districtId: 'chattogram',
    upazilaId: 'panchlaish',
    availability: 'available',
    updatedHoursAgo: 9,
    contactMethods: ['call', 'whatsapp'],
    lastDonationDaysAgo: 164,
    totalDonationsCount: 8,
    gender: 'male',
    ageYears: 31,
    weightKg: 74,
    donationPreference: 'both',
    nightCallPreference: 'anytime',
    occupation: 'চিকিৎসা প্রতিনিধি',
    preferredHospitalArea: 'চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল (CMCH)',
  },
  {
    uid: 'demo_donor_07',
    displayName: 'শাহরিয়ার কবির (ডেমো)',
    phoneNumber: '+8801500000107',
    bloodGroup: 'O+',
    divisionId: 'rajshahi',
    districtId: 'rajshahi',
    upazilaId: 'boalia',
    availability: 'available',
    updatedHoursAgo: 18,
    contactMethods: ['call', 'sms', 'whatsapp'],
    lastDonationDaysAgo: 105,
    totalDonationsCount: 5,
    gender: 'male',
    ageYears: 26,
    weightKg: 66,
    donationPreference: 'whole_blood',
    nightCallPreference: 'daytime_only',
    occupation: 'শিক্ষার্থী, রাজশাহী বিশ্ববিদ্যালয়',
    preferredHospitalArea: 'রাজশাহী মেডিকেল কলেজ হাসপাতাল (RMCH)',
  },

  // A+ (4 donors)
  {
    uid: 'demo_donor_08',
    displayName: 'রাকিবুল ইসলাম (ডেমো)',
    phoneNumber: '+8801700000108',
    bloodGroup: 'A+',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'shahbagh',
    availability: 'available',
    updatedHoursAgo: 4,
    contactMethods: ['call', 'whatsapp'],
    lastDonationDaysAgo: 125,
    totalDonationsCount: 11,
    gender: 'male',
    ageYears: 33,
    weightKg: 75,
    donationPreference: 'both',
    nightCallPreference: 'anytime',
    occupation: 'ফার্মাসিস্ট',
    preferredHospitalArea: 'DMCH, BSMMU ও বারডেম হাসপাতাল',
  },
  {
    uid: 'demo_donor_09',
    displayName: 'ফারজানা আক্তার (ডেমো)',
    phoneNumber: '+8801800000109',
    bloodGroup: 'A+',
    divisionId: 'dhaka',
    districtId: 'narayanganj',
    upazilaId: 'narayanganj_sadar',
    availability: 'available',
    updatedHoursAgo: 14,
    contactMethods: ['call', 'sms'],
    lastDonationDaysAgo: 148,
    totalDonationsCount: 4,
    gender: 'female',
    ageYears: 28,
    weightKg: 59,
    donationPreference: 'whole_blood',
    nightCallPreference: 'daytime_only',
    preferredHospitalArea: 'নারায়ণগঞ্জ ৩০০ শয্যা হাসপাতাল',
  },
  {
    uid: 'demo_donor_10',
    displayName: 'সৌম্যজিৎ দাস (ডেমো)',
    phoneNumber: '+8801900000110',
    bloodGroup: 'A+',
    divisionId: 'sylhet',
    districtId: 'sylhet',
    upazilaId: 'sylhet_sadar',
    availability: 'not_specified',
    updatedHoursAgo: 32,
    contactMethods: ['whatsapp', 'imo'],
    lastDonationDaysAgo: null,
    totalDonationsCount: 1,
    gender: 'male',
    ageYears: 22,
    weightKg: 62,
    donationPreference: 'whole_blood',
    nightCallPreference: 'message_first',
    preferredHospitalArea: 'সিলেট ওসমানী মেডিকেল কলেজ হাসপাতাল',
  },
  {
    uid: 'demo_donor_11',
    displayName: 'মেহেদী হাসান (ডেমো)',
    phoneNumber: '+8801700000111',
    bloodGroup: 'A+',
    divisionId: 'khulna',
    districtId: 'khulna',
    upazilaId: 'khulna_sadar',
    availability: 'available',
    updatedHoursAgo: 20,
    contactMethods: ['call', 'sms', 'whatsapp'],
    lastDonationDaysAgo: 112,
    totalDonationsCount: 7,
    gender: 'male',
    ageYears: 29,
    weightKg: 70,
    donationPreference: 'whole_blood',
    nightCallPreference: 'anytime',
    preferredHospitalArea: 'খুলনা মেডিকেল কলেজ হাসপাতাল',
  },

  // B+ (4 donors)
  {
    uid: 'demo_donor_12',
    displayName: 'নাফিস ইকবাল (ডেমো)',
    phoneNumber: '+8801700000112',
    bloodGroup: 'B+',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'mohammadpur',
    availability: 'available',
    updatedHoursAgo: 5,
    contactMethods: ['call', 'whatsapp', 'imo'],
    lastDonationDaysAgo: 136,
    totalDonationsCount: 10,
    gender: 'male',
    ageYears: 31,
    weightKg: 73,
    donationPreference: 'both',
    nightCallPreference: 'anytime',
    preferredHospitalArea: 'NICVD, সোহরাওয়ার্দী ও পঙ্গু হাসপাতাল',
  },
  {
    uid: 'demo_donor_13',
    displayName: 'তাসনিম তাবাসসুম (ডেমো)',
    phoneNumber: '+8801800000113',
    bloodGroup: 'B+',
    divisionId: 'chattogram',
    districtId: 'cumilla',
    upazilaId: 'cumilla_sadar',
    availability: 'available',
    updatedHoursAgo: 15,
    contactMethods: ['call', 'sms'],
    lastDonationDaysAgo: 170,
    totalDonationsCount: 3,
    gender: 'female',
    ageYears: 24,
    weightKg: 55,
    donationPreference: 'whole_blood',
    nightCallPreference: 'daytime_only',
    preferredHospitalArea: 'কুমিল্লা মেডিকেল কলেজ হাসপাতাল',
  },
  {
    uid: 'demo_donor_14',
    displayName: 'জাহিদুল আলম (ডেমো)',
    phoneNumber: '+8801600000114',
    bloodGroup: 'B+',
    divisionId: 'barishal',
    districtId: 'barishal',
    upazilaId: 'barishal_sadar',
    availability: 'temporarily_unavailable',
    updatedHoursAgo: 60,
    contactMethods: ['call', 'whatsapp'],
    lastDonationDaysAgo: 35,
    totalDonationsCount: 6,
    gender: 'male',
    ageYears: 28,
    weightKg: 69,
    donationPreference: 'whole_blood',
    nightCallPreference: 'message_first',
    preferredHospitalArea: 'শের-ই-বাংলা মেডিকেল কলেজ হাসপাতাল',
  },
  {
    uid: 'demo_donor_15',
    displayName: 'আশরাফুল আলম (ডেমো)',
    phoneNumber: '+8801700000115',
    bloodGroup: 'B+',
    divisionId: 'rangpur',
    districtId: 'rangpur',
    upazilaId: 'rangpur_sadar',
    availability: 'available',
    updatedHoursAgo: 8,
    contactMethods: ['call', 'sms', 'imo'],
    lastDonationDaysAgo: 121,
    totalDonationsCount: 5,
    gender: 'male',
    ageYears: 27,
    weightKg: 67,
    donationPreference: 'whole_blood',
    nightCallPreference: 'anytime',
    preferredHospitalArea: 'রংপুর মেডিকেল কলেজ হাসপাতাল',
  },

  // AB+ (3 donors)
  {
    uid: 'demo_donor_16',
    displayName: 'ইমরান হোসেন (ডেমো)',
    phoneNumber: '+8801700000116',
    bloodGroup: 'AB+',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'badda',
    availability: 'available',
    updatedHoursAgo: 7,
    contactMethods: ['call', 'whatsapp'],
    lastDonationDaysAgo: 144,
    totalDonationsCount: 8,
    gender: 'male',
    ageYears: 30,
    weightKg: 71,
    donationPreference: 'both',
    nightCallPreference: 'anytime',
    preferredHospitalArea: 'ইউনাইটেড, এভারকেয়ার ও মুগদা মেডিকেল',
  },
  {
    uid: 'demo_donor_17',
    displayName: 'শারমিন সুলতানা (ডেমো)',
    phoneNumber: '+8801800000117',
    bloodGroup: 'AB+',
    divisionId: 'mymensingh',
    districtId: 'mymensingh',
    upazilaId: 'mymensingh_sadar',
    availability: 'available',
    updatedHoursAgo: 21,
    contactMethods: ['call', 'sms'],
    lastDonationDaysAgo: 129,
    totalDonationsCount: 4,
    gender: 'female',
    ageYears: 26,
    weightKg: 57,
    donationPreference: 'whole_blood',
    nightCallPreference: 'daytime_only',
    preferredHospitalArea: 'ময়মনসিংহ মেডিকেল কলেজ হাসপাতাল',
  },
  {
    uid: 'demo_donor_18',
    displayName: 'রফিকুল বারী (ডেমো)',
    phoneNumber: '+8801900000118',
    bloodGroup: 'AB+',
    divisionId: 'rajshahi',
    districtId: 'bogura',
    upazilaId: 'bogura_sadar',
    availability: 'not_specified',
    updatedHoursAgo: 40,
    contactMethods: ['call', 'whatsapp'],
    lastDonationDaysAgo: 180,
    totalDonationsCount: 5,
    gender: 'male',
    ageYears: 34,
    weightKg: 74,
    donationPreference: 'whole_blood',
    nightCallPreference: 'anytime',
    preferredHospitalArea: 'শহীদ জিয়াউর রহমান মেডিকেল কলেজ হাসপাতাল',
  },

  // O- (2 donors)
  {
    uid: 'demo_donor_19',
    displayName: 'হাসিবুর রহমান (ডেমো)',
    phoneNumber: '+8801700000119',
    bloodGroup: 'O-',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'dhanmondi',
    availability: 'available',
    updatedHoursAgo: 2,
    contactMethods: ['call', 'sms', 'whatsapp'],
    lastDonationDaysAgo: 150,
    totalDonationsCount: 14,
    gender: 'male',
    ageYears: 35,
    weightKg: 78,
    donationPreference: 'both',
    nightCallPreference: 'anytime',
    occupation: 'স্থপতি',
    preferredHospitalArea: 'ঢাকা শহরের যেকোনো জরুরি হাসপাতাল',
  },
  {
    uid: 'demo_donor_20',
    displayName: 'সাইফুল ইসলাম (ডেমো)',
    phoneNumber: '+8801800000120',
    bloodGroup: 'O-',
    divisionId: 'chattogram',
    districtId: 'chattogram',
    upazilaId: 'agrabad',
    availability: 'available',
    updatedHoursAgo: 12,
    contactMethods: ['call', 'whatsapp', 'imo'],
    lastDonationDaysAgo: 138,
    totalDonationsCount: 7,
    gender: 'male',
    ageYears: 29,
    weightKg: 70,
    donationPreference: 'whole_blood',
    nightCallPreference: 'anytime',
    preferredHospitalArea: 'আগ্রাবাদ মা ও শিশু হাসপাতাল এবং CMCH',
  },

  // A- (2 donors)
  {
    uid: 'demo_donor_21',
    displayName: 'মালিহা রহমান (ডেমো)',
    phoneNumber: '+8801700000121',
    bloodGroup: 'A-',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'uttara',
    availability: 'available',
    updatedHoursAgo: 10,
    contactMethods: ['call', 'whatsapp'],
    lastDonationDaysAgo: 160,
    totalDonationsCount: 5,
    gender: 'female',
    ageYears: 28,
    weightKg: 58,
    donationPreference: 'whole_blood',
    nightCallPreference: 'daytime_only',
    preferredHospitalArea: 'উত্তরা ও বনানী এলাকা',
  },
  {
    uid: 'demo_donor_22',
    displayName: 'জুবায়ের হোসেন (ডেমো)',
    phoneNumber: '+8801900000122',
    bloodGroup: 'A-',
    divisionId: 'khulna',
    districtId: 'jashore',
    upazilaId: 'jashore_sadar',
    availability: 'not_specified',
    updatedHoursAgo: 29,
    contactMethods: ['call', 'sms'],
    lastDonationDaysAgo: 142,
    totalDonationsCount: 3,
    gender: 'male',
    ageYears: 25,
    weightKg: 65,
    donationPreference: 'whole_blood',
    nightCallPreference: 'message_first',
    preferredHospitalArea: 'যশোর ২৫০ শয্যা জেনারেল হাসপাতাল',
  },

  // B- (1 donor)
  {
    uid: 'demo_donor_23',
    displayName: 'নাজমুল হুদা (ডেমো)',
    phoneNumber: '+8801700000123',
    bloodGroup: 'B-',
    divisionId: 'dhaka',
    districtId: 'gazipur',
    upazilaId: 'gazipur_sadar',
    availability: 'available',
    updatedHoursAgo: 9,
    contactMethods: ['call', 'sms', 'whatsapp'],
    lastDonationDaysAgo: 126,
    totalDonationsCount: 6,
    gender: 'male',
    ageYears: 30,
    weightKg: 71,
    donationPreference: 'whole_blood',
    nightCallPreference: 'anytime',
    preferredHospitalArea: 'শহীদ তাজউদ্দীন আহমদ মেডিকেল কলেজ হাসপাতাল',
  },

  // AB- (1 donor)
  {
    uid: 'demo_donor_24',
    displayName: 'রেজাউল করিম (ডেমো)',
    phoneNumber: '+8801800000124',
    bloodGroup: 'AB-',
    divisionId: 'sylhet',
    districtId: 'moulvibazar',
    upazilaId: 'sreemangal',
    availability: 'available',
    updatedHoursAgo: 16,
    contactMethods: ['call', 'whatsapp', 'imo'],
    lastDonationDaysAgo: 152,
    totalDonationsCount: 4,
    gender: 'male',
    ageYears: 31,
    weightKg: 68,
    donationPreference: 'whole_blood',
    nightCallPreference: 'anytime',
    preferredHospitalArea: 'মৌলভীবাজার সদর ও শ্রীমঙ্গল উপজেলা স্বাস্থ্য কমপ্লেক্স',
  },
] as const;

export const DEMO_DONORS: DonorProfile[] = DEMO_DONOR_SEEDS.map((seed) => {
  const ts = hoursAgoTimestamp(seed.updatedHoursAgo);
  const count = seed.totalDonationsCount ?? 2;
  return {
    uid: seed.uid,
    displayName: seed.displayName,
    bloodGroup: seed.bloodGroup,
    divisionId: seed.divisionId,
    districtId: seed.districtId,
    upazilaId: seed.upazilaId,
    availability: seed.availability,
    lastAvailabilityUpdatedAt: ts,
    contactMethods: [...seed.contactMethods],
    hasConsented: true,
    contactConsentAt: ts,
    isListed: true,
    accountStatus: 'active',
    emailVerified: true,
    lastDonationDate:
      seed.lastDonationDaysAgo !== null
        ? daysOffsetIso(-seed.lastDonationDaysAgo)
        : '',
    gender: seed.gender ?? 'not_specified',
    ageYears: seed.ageYears ?? 28,
    weightKg: seed.weightKg ?? 65,
    donationPreference: seed.donationPreference ?? 'whole_blood',
    nightCallPreference: seed.nightCallPreference ?? 'anytime',
    occupation: seed.occupation ?? '',
    preferredHospitalArea: seed.preferredHospitalArea ?? '',
    donorNote: '',
    totalDonationsCount: count,
    totalVolumeMl: count * 450,
    createdAt: ts,
    updatedAt: ts,
  };
});

export const DEMO_DONOR_PHONES: Record<string, string> = Object.fromEntries(
  DEMO_DONOR_SEEDS.map((seed) => [seed.uid, seed.phoneNumber])
);

export function getDemoDonorByUid(uid: string): DonorProfile | undefined {
  return DEMO_DONORS.find((d) => d.uid === uid);
}

interface DemoBloodRequestSeed {
  id: string;
  createdBy: string;
  requesterName: string;
  phoneNumber: string;
  bloodGroup: BloodGroup;
  units: number;
  divisionId: string;
  districtId: string;
  upazilaId: string;
  hospitalName: string;
  urgency: BloodRequest['urgency'];
  requiredOffsetDays: number;
  patientNote: string;
  contactMethods: ContactMethod[];
  status: BloodRequestStatus;
  bookedDonorUid?: string;
  bookedDonorName?: string;
  bookingNote?: string;
  createdHoursAgo: number;
}

const DEMO_REQUEST_SEEDS: readonly DemoBloodRequestSeed[] = [
  {
    id: 'demo_req_01',
    createdBy: 'demo_requester_01',
    requesterName: 'আব্দুল্লাহ আল মামুন (ডেমো)',
    phoneNumber: '+8801700000201',
    bloodGroup: 'O+',
    units: 2,
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'shahbagh',
    hospitalName: 'ঢাকা মেডিকেল কলেজ হাসপাতাল (DMCH)',
    urgency: 'emergency',
    requiredOffsetDays: 0,
    patientNote:
      'জরুরি অস্ত্রোপচারের জন্য আজ সন্ধ্যার মধ্যে ২ ব্যাগ O+ রক্ত প্রয়োজন। জরুরি বিভাগ, ৩য় তলা।',
    contactMethods: ['call', 'whatsapp', 'sms'],
    status: 'open',
    createdHoursAgo: 1,
  },
  {
    id: 'demo_req_02',
    createdBy: 'demo_requester_02',
    requesterName: 'সাবরিনা সুলতানা (ডেমো)',
    phoneNumber: '+8801800000202',
    bloodGroup: 'O-',
    units: 1,
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'shahbagh',
    hospitalName: 'বাংলাদেশ মেডিকেল বিশ্ববিদ্যালয় (সাবেক BSMMU)',
    urgency: 'emergency',
    requiredOffsetDays: 0,
    patientNote:
      'কেবিন ব্লক ৫ম তলা, রক্তের ক্রসম্যাচিংয়ের জন্য ডোনারকে সরাসরি ল্যাবে উপস্থিত থাকতে হবে।',
    contactMethods: ['call', 'whatsapp'],
    status: 'booked',
    bookedDonorUid: 'demo_donor_19',
    bookedDonorName: 'হাসিবুর রহমান (ডেমো)',
    bookingNote:
      'ডোনারের সাথে ফোনে চূড়ান্ত কথা হয়েছে, তিনি বিকেল ৪টায় ল্যাবে উপস্থিত থাকবেন—অনুগ্রহ করে নতুন কেউ কল দেবেন না।',
    createdHoursAgo: 2,
  },
  {
    id: 'demo_req_03',
    createdBy: 'demo_requester_03',
    requesterName: 'মঈনুল ইসলাম (ডেমো)',
    phoneNumber: '+8801900000203',
    bloodGroup: 'B+',
    units: 2,
    divisionId: 'chattogram',
    districtId: 'chattogram',
    upazilaId: 'panchlaish',
    hospitalName: 'চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল (CMCH)',
    urgency: 'urgent',
    requiredOffsetDays: 1,
    patientNote:
      'থ্যালাসেমিয়া রোগীর নিয়মিত ট্রান্সফিউশনের জন্য আগামীকাল সকাল ১০টার মধ্যে প্রয়োজন।',
    contactMethods: ['call', 'sms', 'imo'],
    status: 'open',
    createdHoursAgo: 5,
  },
  {
    id: 'demo_req_04',
    createdBy: 'demo_requester_04',
    requesterName: 'রাশেদুল করিম (ডেমো)',
    phoneNumber: '+8801700000204',
    bloodGroup: 'A+',
    units: 3,
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'mohammadpur',
    hospitalName: 'জাতীয় হৃদরোগ ইনস্টিটিউট ও হাসপাতাল (NICVD)',
    urgency: 'urgent',
    requiredOffsetDays: 1,
    patientNote: 'বাইপাস সার্জারির জন্য আগামীকাল সকালে ফ্রেশ ডোনার প্রয়োজন।',
    contactMethods: ['call', 'whatsapp'],
    status: 'booked',
    bookedDonorUid: 'demo_donor_08',
    bookedDonorName: 'রাকিবুল ইসলাম (ডেমো) ও তার সহকর্মী',
    bookingNote: '৩ ব্যাগের জন্য ডোনার চূড়ান্ত হয়েছে, কল বিরতি চালু করা হয়েছে।',
    createdHoursAgo: 7,
  },
  {
    id: 'demo_req_05',
    createdBy: 'demo_requester_05',
    requesterName: 'তৌহিদুর রহমান (ডেমো)',
    phoneNumber: '+8801600000205',
    bloodGroup: 'AB+',
    units: 1,
    divisionId: 'sylhet',
    districtId: 'sylhet',
    upazilaId: 'sylhet_sadar',
    hospitalName: 'সিলেট এম এ জি ওসমানী মেডিকেল কলেজ হাসপাতাল',
    urgency: 'urgent',
    requiredOffsetDays: 1,
    patientNote:
      'গাইনি ওয়ার্ড, সিজারিয়ান অপারেশনের প্রস্তুতির জন্য ১ ব্যাগ রক্ত প্রয়োজন।',
    contactMethods: ['call', 'sms', 'whatsapp'],
    status: 'open',
    createdHoursAgo: 9,
  },
  {
    id: 'demo_req_06',
    createdBy: 'demo_requester_06',
    requesterName: 'শামীম রেজা (ডেমো)',
    phoneNumber: '+8801700000206',
    bloodGroup: 'A-',
    units: 1,
    divisionId: 'rajshahi',
    districtId: 'rajshahi',
    upazilaId: 'boalia',
    hospitalName: 'রাজশাহী মেডিকেল কলেজ হাসপাতাল (RMCH)',
    urgency: 'scheduled',
    requiredOffsetDays: 3,
    patientNote:
      'নির্ধারিত অর্থোপেডিক সার্জারির জন্য A- ডোনারের সাথে অগ্রিম কথা বলে রাখতে চাই।',
    contactMethods: ['call', 'whatsapp'],
    status: 'open',
    createdHoursAgo: 14,
  },
  {
    id: 'demo_req_07',
    createdBy: 'demo_requester_07',
    requesterName: 'হাবিবুর রহমান (ডেমো)',
    phoneNumber: '+8801800000207',
    bloodGroup: 'B-',
    units: 1,
    divisionId: 'khulna',
    districtId: 'khulna',
    upazilaId: 'khulna_sadar',
    hospitalName: 'খুলনা মেডিকেল কলেজ হাসপাতাল',
    urgency: 'urgent',
    requiredOffsetDays: 1,
    patientNote: 'ডায়ালাইসিস ইউনিটে ভর্তি রোগীর জন্য ১ ব্যাগ B- রক্ত প্রয়োজন।',
    contactMethods: ['call', 'sms', 'imo'],
    status: 'open',
    createdHoursAgo: 18,
  },
  {
    id: 'demo_req_08',
    createdBy: 'demo_requester_08',
    requesterName: 'নাহিদ হাসান (ডেমো)',
    phoneNumber: '+8801900000208',
    bloodGroup: 'AB-',
    units: 1,
    divisionId: 'mymensingh',
    districtId: 'mymensingh',
    upazilaId: 'mymensingh_sadar',
    hospitalName: 'ময়মনসিংহ মেডিকেল কলেজ হাসপাতাল',
    urgency: 'scheduled',
    requiredOffsetDays: 4,
    patientNote:
      'আগামী সপ্তাহের নির্ধারিত অস্ত্রোপচারের জন্য AB- রক্তদাতা প্রয়োজন।',
    contactMethods: ['call', 'whatsapp'],
    status: 'open',
    createdHoursAgo: 22,
  },
] as const;

export const DEMO_BLOOD_REQUESTS: BloodRequest[] = DEMO_REQUEST_SEEDS.map(
  (seed) => {
    const ts = hoursAgoTimestamp(seed.createdHoursAgo);
    return {
      id: seed.id,
      createdBy: seed.createdBy,
      requesterName: seed.requesterName,
      bloodGroup: seed.bloodGroup,
      units: seed.units,
      divisionId: seed.divisionId,
      districtId: seed.districtId,
      upazilaId: seed.upazilaId,
      hospitalName: seed.hospitalName,
      urgency: seed.urgency,
      requiredDate: daysOffsetIso(seed.requiredOffsetDays),
      patientNote: seed.patientNote,
      contactMethods: [...seed.contactMethods],
      hasConsented: true,
      status: seed.status,
      bookedDonorUid: seed.bookedDonorUid || '',
      bookedDonorName: seed.bookedDonorName || '',
      bookingNote: seed.bookingNote || '',
      bookedAt: seed.status === 'booked' ? ts : null,
      createdAt: ts,
      updatedAt: ts,
    };
  }
);

export const DEMO_REQUEST_PHONES: Record<string, string> = Object.fromEntries(
  DEMO_REQUEST_SEEDS.map((seed) => [seed.id, seed.phoneNumber])
);

export const DEMO_DONATION_RECORDS: DonationRecord[] = [
  {
    id: 'demo_don_01',
    donorUid: 'demo_donor_01',
    donorName: 'তানভীর আহমেদ (ডেমো)',
    bloodGroup: 'O+',
    donationDate: daysOffsetIso(-132),
    hospitalOrCenter: 'ঢাকা মেডিকেল কলেজ হাসপাতাল ব্লাড ব্যাংক',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'shahbagh',
    volumeMl: 450,
    units: 1,
    donationType: 'whole_blood',
    recipientSummary: 'জরুরি সার্জারি রোগীর জন্য ১ ব্যাগ হোল ব্লাড প্রদান',
    linkedRequestId: '',
    createdAt: hoursAgoTimestamp(72),
    updatedAt: hoursAgoTimestamp(72),
  },
  {
    id: 'demo_don_02',
    donorUid: 'demo_donor_04',
    donorName: 'সাদিয়া ইসলাম (ডেমো)',
    bloodGroup: 'O+',
    donationDate: daysOffsetIso(-22),
    hospitalOrCenter: 'কুর্মিটোলা জেনারেল হাসপাতাল',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'uttara',
    volumeMl: 450,
    units: 1,
    donationType: 'whole_blood',
    recipientSummary: 'প্রসূতি মায়ের সিজারিয়ান অপারেশনে রক্তদান',
    linkedRequestId: '',
    createdAt: hoursAgoTimestamp(48),
    updatedAt: hoursAgoTimestamp(48),
  },
  {
    id: 'demo_don_03',
    donorUid: 'demo_donor_03',
    donorName: 'মাহমুদুল হাসান রাফি (ডেমো)',
    bloodGroup: 'O+',
    donationDate: daysOffsetIso(-118),
    hospitalOrCenter: 'ন্যাশনাল হার্ট ফাউন্ডেশন হাসপাতাল, মিরপুর',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'mirpur',
    volumeMl: 350,
    units: 1,
    donationType: 'platelet',
    recipientSummary: 'ডেঙ্গু আক্রান্ত রোগীর জন্য অ্যাফেরেসিস প্লাটিলেট দান',
    linkedRequestId: '',
    createdAt: hoursAgoTimestamp(96),
    updatedAt: hoursAgoTimestamp(96),
  },
  {
    id: 'demo_don_04',
    donorUid: 'demo_donor_19',
    donorName: 'হাসিবুর রহমান (ডেমো)',
    bloodGroup: 'O-',
    donationDate: daysOffsetIso(-150),
    hospitalOrCenter: 'স্কয়ার হাসপাতাল ব্লাড ট্রান্সফিউশন সেন্টার',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'dhanmondi',
    volumeMl: 450,
    units: 1,
    donationType: 'whole_blood',
    recipientSummary: 'নবজাতক আইসিইউ (NICU) জরুরি চাহিদায় রক্তদান',
    linkedRequestId: '',
    createdAt: hoursAgoTimestamp(120),
    updatedAt: hoursAgoTimestamp(120),
  },
];

export const DEMO_REQUEST_PLEDGES: RequestPledge[] = [
  {
    id: 'demo_pledge_01',
    requestId: 'demo_req_02',
    requestCreatorUid: 'demo_requester_02',
    hospitalName: 'বাংলাদেশ মেডিকেল বিশ্ববিদ্যালয় (সাবেক BSMMU)',
    donorUid: 'demo_donor_19',
    donorName: 'হাসিবুর রহমান (ডেমো)',
    donorBloodGroup: 'O-',
    message: 'আমি ধানমন্ডিতে আছি, বিকেল ৪টার মধ্যে সরাসরি ল্যাবে আসতে পারব।',
    status: 'accepted',
    createdAt: hoursAgoTimestamp(2),
    updatedAt: hoursAgoTimestamp(1.5),
  },
  {
    id: 'demo_pledge_02',
    requestId: 'demo_req_01',
    requestCreatorUid: 'demo_requester_01',
    hospitalName: 'ঢাকা মেডিকেল কলেজ হাসপাতাল (DMCH)',
    donorUid: 'demo_donor_01',
    donorName: 'তানভীর আহমেদ (ডেমো)',
    donorBloodGroup: 'O+',
    message: 'আমার শেষ রক্তদান ১৩২ দিন আগে। প্রয়োজনে সন্ধ্যার আগে আসতে পারব।',
    status: 'offered',
    createdAt: hoursAgoTimestamp(0.8),
    updatedAt: hoursAgoTimestamp(0.8),
  },
];

export const DEMO_CONTACT_LOGS: ContactAccessLogRecord[] = [
  {
    id: 'demo_log_01',
    callerUid: 'demo_requester_02',
    donorUid: 'demo_donor_19',
    requestedMethod: 'call',
    accessCount: 2,
    createdAt: hoursAgoTimestamp(2.2),
    updatedAt: hoursAgoTimestamp(2),
  },
  {
    id: 'demo_log_02',
    callerUid: 'demo_requester_01',
    donorUid: 'demo_donor_01',
    requestedMethod: 'whatsapp',
    accessCount: 1,
    createdAt: hoursAgoTimestamp(1),
    updatedAt: hoursAgoTimestamp(1),
  },
];

export const DEMO_ABUSE_REPORTS: AbuseReport[] = [
  {
    id: 'demo_report_01',
    reportedBy: 'demo_reporter_01',
    targetType: 'donor',
    targetId: 'demo_donor_04',
    targetUid: 'demo_donor_04',
    reason: 'misleading_availability',
    description:
      'ডেমো মডারেশন উদাহরণ: ডোনার সম্প্রতি রক্তদান করেছেন কিন্তু স্ট্যাটাস পরীক্ষা করার জন্য রিপোর্ট নমুনা।',
    status: 'open',
    reviewedBy: '',
    resolutionNote: '',
    createdAt: hoursAgoTimestamp(4),
    updatedAt: hoursAgoTimestamp(4),
  },
  {
    id: 'demo_report_02',
    reportedBy: 'demo_reporter_02',
    targetType: 'blood_request',
    targetId: 'demo_req_03',
    targetUid: 'demo_requester_03',
    reason: 'incorrect_phone',
    description:
      'ডেমো মডারেশন উদাহরণ: নম্বরে কল ঢুকছে না বলে ব্যবহারকারী জানিয়েছেন।',
    status: 'reviewing',
    reviewedBy: '',
    resolutionNote: '',
    createdAt: hoursAgoTimestamp(12),
    updatedAt: hoursAgoTimestamp(8),
  },
];

export function filterAndMergeDonors(params: {
  realDonors: DonorProfile[];
  bloodGroup: BloodGroup;
  divisionId?: string;
  districtId?: string;
  upazilaId?: string;
  onlyAvailable?: boolean;
  includeDemo: boolean;
}): {
  donors: DonorProfile[];
  totalListedCount: number;
  availableCount: number;
} {
  const realIds = new Set(params.realDonors.map((d) => d.uid));

  const matchingDemo = params.includeDemo
    ? DEMO_DONORS.filter((donor) => {
        if (realIds.has(donor.uid)) return false;
        if (donor.bloodGroup !== params.bloodGroup) return false;
        if (params.divisionId && donor.divisionId !== params.divisionId) {
          return false;
        }
        if (params.districtId && donor.districtId !== params.districtId) {
          return false;
        }
        if (params.upazilaId && donor.upazilaId !== params.upazilaId) {
          return false;
        }
        return true;
      })
    : [];

  const combinedLocationMatched = [...params.realDonors, ...matchingDemo];

  const totalListedCount = combinedLocationMatched.length;
  const availableCount = combinedLocationMatched.filter(
    (d) => d.availability === 'available'
  ).length;

  const filtered = params.onlyAvailable
    ? combinedLocationMatched.filter((d) => d.availability === 'available')
    : combinedLocationMatched;

  const rank: Record<AvailabilityStatus, number> = {
    available: 0,
    not_specified: 1,
    temporarily_unavailable: 2,
  };

  filtered.sort((a, b) => {
    const aDemo = isDemoRecordId(a.uid) ? 1 : 0;
    const bDemo = isDemoRecordId(b.uid) ? 1 : 0;
    if (aDemo !== bDemo) return aDemo - bDemo;
    return rank[a.availability] - rank[b.availability];
  });

  return {
    donors: filtered,
    totalListedCount,
    availableCount,
  };
}

export function filterAndMergeBloodRequests(params: {
  realRequests: BloodRequest[];
  bloodGroup?: BloodGroup | '';
  divisionId?: string;
  statusFilter?: 'active_all' | 'open_only' | 'booked_only';
  includeDemo: boolean;
}): BloodRequest[] {
  const realIds = new Set(params.realRequests.map((r) => r.id));

  const matchingDemo = params.includeDemo
    ? DEMO_BLOOD_REQUESTS.filter((req) => {
        if (realIds.has(req.id)) return false;
        if (params.bloodGroup && req.bloodGroup !== params.bloodGroup) {
          return false;
        }
        if (params.divisionId && req.divisionId !== params.divisionId) {
          return false;
        }
        if (params.statusFilter === 'open_only') {
          return req.status === 'open';
        }
        if (params.statusFilter === 'booked_only') {
          return req.status === 'booked';
        }
        return req.status === 'open' || req.status === 'booked';
      })
    : [];

  const combined = [...params.realRequests, ...matchingDemo];
  const urgencyRank: Record<BloodRequest['urgency'], number> = {
    emergency: 0,
    urgent: 1,
    scheduled: 2,
  };

  combined.sort((a, b) => {
    const aDemo = isDemoRecordId(a.id) ? 1 : 0;
    const bDemo = isDemoRecordId(b.id) ? 1 : 0;
    if (aDemo !== bDemo) return aDemo - bDemo;
    const aStatus = a.status === 'open' ? 0 : 1;
    const bStatus = b.status === 'open' ? 0 : 1;
    if (aStatus !== bStatus) return aStatus - bStatus;
    return urgencyRank[a.urgency] - urgencyRank[b.urgency];
  });

  return combined;
}

/**
 * Returns a set of 4 realistic test donation history records tailored to the active user.
 * Demonstrates: DMCH (95 days ago - eligible), Square Hospital (220 days ago), NICVD (340 days ago), CMCH (480 days ago).
 */
export function getUserDemoDonationRecords(
  uid: string,
  donorName: string,
  bloodGroup: BloodGroup = 'O+'
): DonationRecord[] {
  return [
    {
      id: `demo_user_don_${uid}_01`,
      donorUid: uid,
      donorName: donorName || 'রক্তদাতা (আপনি)',
      bloodGroup,
      donationDate: daysOffsetIso(-95),
      hospitalOrCenter: 'ঢাকা মেডিকেল কলেজ হাসপাতাল (DMCH) ব্লাড ব্যাংক',
      divisionId: 'dhaka',
      districtId: 'dhaka',
      upazilaId: 'shahbagh',
      volumeMl: 450,
      units: 1,
      donationType: 'whole_blood',
      recipientSummary: 'জরুরি সার্জারি ও থ্যালাসেমিয়া রোগীর জন্য ১ ব্যাগ রক্তদান',
      linkedRequestId: 'demo_req_01',
      createdAt: hoursAgoTimestamp(95 * 24),
      updatedAt: hoursAgoTimestamp(95 * 24),
    },
    {
      id: `demo_user_don_${uid}_02`,
      donorUid: uid,
      donorName: donorName || 'রক্তদাতা (আপনি)',
      bloodGroup,
      donationDate: daysOffsetIso(-220),
      hospitalOrCenter: 'স্কয়ার হাসপাতাল, পান্থপথ',
      divisionId: 'dhaka',
      districtId: 'dhaka',
      upazilaId: 'dhanmondi',
      volumeMl: 450,
      units: 1,
      donationType: 'whole_blood',
      recipientSummary: 'বাইপাস কার্ডিয়াক সার্জারির রোগীর জন্য রক্তদান',
      linkedRequestId: '',
      createdAt: hoursAgoTimestamp(220 * 24),
      updatedAt: hoursAgoTimestamp(220 * 24),
    },
    {
      id: `demo_user_don_${uid}_03`,
      donorUid: uid,
      donorName: donorName || 'রক্তদাতা (আপনি)',
      bloodGroup,
      donationDate: daysOffsetIso(-340),
      hospitalOrCenter: 'জাতীয় হৃদরোগ ইনস্টিটিউট ও হাসপাতাল (NICVD)',
      divisionId: 'dhaka',
      districtId: 'dhaka',
      upazilaId: 'sher-e-bangla-nagar',
      volumeMl: 450,
      units: 1,
      donationType: 'whole_blood',
      recipientSummary: 'সড়ক দুর্ঘটনায় আহত রোগীর জন্য জরুরি রক্তদান',
      linkedRequestId: '',
      createdAt: hoursAgoTimestamp(340 * 24),
      updatedAt: hoursAgoTimestamp(340 * 24),
    },
    {
      id: `demo_user_don_${uid}_04`,
      donorUid: uid,
      donorName: donorName || 'রক্তদাতা (আপনি)',
      bloodGroup,
      donationDate: daysOffsetIso(-480),
      hospitalOrCenter: 'চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল (CMCH)',
      divisionId: 'chattogram',
      districtId: 'chattogram',
      upazilaId: 'panchlaish',
      volumeMl: 450,
      units: 1,
      donationType: 'whole_blood',
      recipientSummary: 'প্রসূতি মায়ের জরুরি সিজারিয়ান অপারেশনে রক্তদান',
      linkedRequestId: '',
      createdAt: hoursAgoTimestamp(480 * 24),
      updatedAt: hoursAgoTimestamp(480 * 24),
    },
  ];
}

/**
 * Returns a sample booked blood request created by the user for testing reopening/fulfilled controls.
 */
export function getUserDemoBloodRequest(
  uid: string,
  requesterName: string,
  _phoneNumber: string = '+8801700000000'
): BloodRequest {
  return {
    id: `demo_user_req_${uid}`,
    createdBy: uid,
    requesterName: requesterName || 'আমার রক্তের আবেদন (ডেমো)',
    bloodGroup: 'O+',
    units: 2,
    hospitalName: 'ঢাকা মেডিকেল কলেজ হাসপাতাল (DMCH)',
    divisionId: 'dhaka',
    districtId: 'dhaka',
    upazilaId: 'shahbagh',
    urgency: 'urgent',
    requiredDate: daysOffsetIso(0),
    patientNote:
      'পোস্ট-অপারেটিভ রিকভারির জন্য আজ সন্ধ্যার মধ্যে ২ ব্যাগ O+ রক্ত প্রয়োজন। জরুরি বিভাগ, ৩য় তলা।',
    contactMethods: ['call', 'whatsapp', 'sms'],
    hasConsented: true,
    status: 'booked',
    bookedDonorUid: 'demo_donor_01',
    bookedDonorName: 'তানভীর আহমেদ (ডেমো)',
    bookedAt: hoursAgoTimestamp(2),
    bookingNote:
      'ডোনারের সাথে ফোনে চূড়ান্ত কথা হয়েছে, তিনি হাসপাতালে পৌঁছাচ্ছেন। নতুন কাউকে কল দিতে নিষেধ করা হয়েছে।',
    createdAt: hoursAgoTimestamp(6),
    updatedAt: hoursAgoTimestamp(2),
  };
}

export function getUserDemoIncomingPledge(
  uid: string,
  requestId: string
): RequestPledge {
  return {
    id: `demo_pledge_inc_${uid}`,
    requestId,
    requestCreatorUid: uid,
    hospitalName: 'ঢাকা মেডিকেল কলেজ হাসপাতাল (DMCH)',
    donorUid: 'demo_donor_01',
    donorName: 'তানভীর আহমেদ (ডেমো)',
    donorBloodGroup: 'O+',
    message: 'আমি হাসপাতালে রওনা দিয়েছি, রক্ত দিতে প্রস্তুত।',
    status: 'accepted',
    createdAt: hoursAgoTimestamp(3),
    updatedAt: hoursAgoTimestamp(2),
  };
}

export function getUserDemoOutgoingPledge(
  uid: string,
  donorName: string,
  _phoneNumber: string = '+8801700000000'
): RequestPledge {
  return {
    id: `demo_pledge_out_${uid}`,
    requestId: 'demo_req_02',
    requestCreatorUid: 'demo_requester_02',
    hospitalName: 'বাংলাদেশ মেডিকেল বিশ্ববিদ্যালয় (সাবেক BSMMU)',
    donorUid: uid,
    donorName: donorName || 'আমি (রক্তদাতা)',
    donorBloodGroup: 'O+',
    message: 'আমি বিকেলে BSMMU তে এসে রক্ত দিতে পারব।',
    status: 'offered',
    createdAt: hoursAgoTimestamp(4),
    updatedAt: hoursAgoTimestamp(4),
  };
}

