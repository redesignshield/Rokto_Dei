import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import type { QueryConstraint } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase';
import { isValidLocationHierarchy } from '../data/bdLocations';
import { handleFirestoreError, isOfflineError, OperationType } from '../lib/firestoreError';
import {
  codePointLength,
  generateSafeId,
  getUsernameValidationError,
  isValidIsoDate,
  isValidUsername,
  normalizeBdPhone,
  normalizeUsername,
  sanitizeText,
  SCHEMA_LIMITS,
} from '../lib/validation';
import type {
  AbuseReport,
  AccountStatus,
  AdminRoleRecord,
  AdminRoleType,
  AppLanguage,
  AppView,
  AuditActionType,
  AuditLogRecord,
  AvailabilityStatus,
  BloodGroup,
  BloodRequest,
  BloodRequestStatus,
  BloodRequestUrgency,
  ContactAccessLogRecord,
  ContactMethod,
  DonationComponentType,
  DonationRecord,
  DonorDonationPreference,
  DonorGender,
  DonorProfile,
  NightCallPreference,
  NotificationType,
  ReportReason,
  ReportStatus,
  RequestPledge,
  UserProfile,
} from '../types';
import {
  getDemoDonorByUid,
  isDemoRecordId,
  DEMO_DONOR_PHONES,
} from '../data/removableDemoData';

// =========================================================================
// 1. User Account Profile Service (/users/{uid})
// =========================================================================
const inFlightUserProfilePromises = new Map<string, Promise<UserProfile>>();
const verifiedActiveProfileUids = new Set<string>();

export function clearVerifiedProfileCache(): void {
  verifiedActiveProfileUids.clear();
  inFlightUserProfilePromises.clear();
}

export function generateSeedUsername(seed: string): string {
  const cleaned = seed
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 18);
  if (cleaned.length >= 3) return cleaned;
  return `user_${Math.floor(1000 + Math.random() * 9000)}`;
}

async function ensureUserProfileInternal(params: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<UserProfile> {
  const path = `users/${params.uid}`;
  const ref = doc(db, 'users', params.uid);

  const rawEmail =
    params.email ||
    auth.currentUser?.email ||
    auth.currentUser?.providerData[0]?.email ||
    '';
  const cleanEmail = sanitizeText(rawEmail, SCHEMA_LIMITS.EMAIL_MAX);

  const cleanName = sanitizeText(
    params.displayName || (cleanEmail ? cleanEmail.split('@')[0] : 'ব্যবহারকারী'),
    SCHEMA_LIMITS.NAME_MAX
  );
  const finalName =
    codePointLength(cleanName) >= SCHEMA_LIMITS.NAME_MIN
      ? cleanName
      : 'ব্যবহারকারী';

  const defaultSeed = generateSeedUsername(cleanEmail ? cleanEmail.split('@')[0] : 'user');

  const fallbackProfile: UserProfile = {
    uid: params.uid,
    fullName: finalName,
    username: defaultSeed,
    usernameLower: normalizeUsername(defaultSeed),
    email: cleanEmail,
    accountStatus: 'active',
    preferredLanguage: 'bn',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (error) {
    if (isOfflineError(error)) {
      verifiedActiveProfileUids.add(params.uid);
      return fallbackProfile;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (existingSnap && existingSnap.exists()) {
    const existingProfile = existingSnap.data() as UserProfile;
    if (existingProfile.accountStatus === 'active') {
      verifiedActiveProfileUids.add(params.uid);
    }
    // Backward compatibility: If an existing user has no username handle yet, reserve one
    if (!existingProfile.username) {
      try {
        let candidate = defaultSeed;
        let lower = normalizeUsername(candidate);
        const uSnap = await getDoc(doc(db, 'usernames', lower));
        if (uSnap.exists() && uSnap.data()?.uid !== params.uid) {
          candidate = `${defaultSeed}_${Math.floor(100 + Math.random() * 900)}`;
          lower = normalizeUsername(candidate);
        }
        const batch = writeBatch(db);
        batch.set(doc(db, 'usernames', lower), {
          username: candidate,
          usernameLower: lower,
          uid: params.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.update(ref, {
          username: candidate,
          usernameLower: lower,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        existingProfile.username = candidate;
        existingProfile.usernameLower = lower;
      } catch (autoErr) {
        console.warn('Auto username assignment notice:', autoErr);
      }
    }
    return existingProfile;
  }

  try {
    let candidate = defaultSeed;
    let lower = normalizeUsername(candidate);
    try {
      const uSnap = await getDoc(doc(db, 'usernames', lower));
      if (uSnap.exists() && uSnap.data()?.uid !== params.uid) {
        candidate = `${defaultSeed}_${Math.floor(100 + Math.random() * 900)}`;
        lower = normalizeUsername(candidate);
      }
    } catch {
      // Offline fallback
    }

    const batch = writeBatch(db);
    batch.set(ref, {
      uid: params.uid,
      fullName: finalName,
      username: candidate,
      usernameLower: lower,
      email: cleanEmail,
      accountStatus: 'active',
      preferredLanguage: 'bn',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'usernames', lower), {
      username: candidate,
      usernameLower: lower,
      uid: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    verifiedActiveProfileUids.add(params.uid);
  } catch (createError) {
    if (isOfflineError(createError)) {
      verifiedActiveProfileUids.add(params.uid);
      return fallbackProfile;
    }
    try {
      const raceSnap = await getDoc(ref);
      if (raceSnap.exists()) {
        const racedProfile = raceSnap.data() as UserProfile;
        if (racedProfile.accountStatus === 'active') {
          verifiedActiveProfileUids.add(params.uid);
        }
        return racedProfile;
      }
    } catch {
      // Ignore secondary read error and surface original create failure below
    }
    handleFirestoreError(createError, OperationType.CREATE, path);
  }

  try {
    const createdSnap = await getDoc(ref);
    if (createdSnap.exists()) {
      const createdProfile = createdSnap.data() as UserProfile;
      if (createdProfile?.accountStatus === 'active') {
        verifiedActiveProfileUids.add(params.uid);
      }
      return createdProfile;
    }
    return fallbackProfile;
  } catch (error) {
    if (isOfflineError(error)) {
      verifiedActiveProfileUids.add(params.uid);
      return fallbackProfile;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function ensureUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<UserProfile> {
  const existingPromise = inFlightUserProfilePromises.get(params.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = ensureUserProfileInternal(params).finally(() => {
    if (inFlightUserProfilePromises.get(params.uid) === promise) {
      inFlightUserProfilePromises.delete(params.uid);
    }
  });

  inFlightUserProfilePromises.set(params.uid, promise);
  return promise;
}

async function ensureCallerActiveProfileReady(): Promise<void> {
  const caller = auth.currentUser;
  if (!caller || !caller.emailVerified) return;
  if (verifiedActiveProfileUids.has(caller.uid)) return;

  await ensureUserProfile({
    uid: caller.uid,
    email: caller.email || caller.providerData[0]?.email || '',
    displayName: caller.displayName || '',
  });
}

export async function updateUserProfileFields(params: {
  uid: string;
  fullName: string;
  preferredLanguage: AppLanguage;
  hasDonorProfile?: boolean;
}): Promise<void> {
  const path = `users/${params.uid}`;
  const cleanName = sanitizeText(params.fullName, SCHEMA_LIMITS.NAME_MAX);
  if (codePointLength(cleanName) < SCHEMA_LIMITS.NAME_MIN) {
    throw new Error('নাম কমপক্ষে ২ অক্ষরের হতে হবে।');
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', params.uid), {
    fullName: cleanName,
    preferredLanguage: params.preferredLanguage,
    updatedAt: serverTimestamp(),
  });

  if (params.hasDonorProfile) {
    batch.update(doc(db, 'donors', params.uid), {
      displayName: cleanName,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();

    if (auth.currentUser && auth.currentUser.uid === params.uid) {
      try {
        await updateProfile(auth.currentUser, { displayName: cleanName });
      } catch (authErr) {
        console.warn('Auth displayName update warning:', authErr);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function checkUsernameAvailability(
  username: string,
  currentUid?: string
): Promise<{ available: boolean; messageBn: string; messageEn: string }> {
  const trimmed = username.trim();
  const validationErrorBn = getUsernameValidationError(trimmed, 'bn');
  if (validationErrorBn) {
    return {
      available: false,
      messageBn: validationErrorBn,
      messageEn: getUsernameValidationError(trimmed, 'en') || validationErrorBn,
    };
  }

  const lower = normalizeUsername(trimmed);
  try {
    const snap = await getDoc(doc(db, 'usernames', lower));
    if (!snap.exists()) {
      return {
        available: true,
        messageBn: 'ইউজারনেমটি খালি আছে এবং নেওয়া যাবে।',
        messageEn: 'Username is available!',
      };
    }
    const data = snap.data();
    if (currentUid && data?.uid === currentUid) {
      return {
        available: true,
        messageBn: 'এটি আপনার বর্তমান ইউজারনেম।',
        messageEn: 'This is your current username.',
      };
    }
    return {
      available: false,
      messageBn: 'এই ইউজারনেমটি ইতিমধ্যে নেওয়া হয়েছে। অন্য একটি ইউনিক নাম দিন।',
      messageEn: 'This username is already taken. Please choose another unique name.',
    };
  } catch (err) {
    if (isOfflineError(err)) {
      return {
        available: true,
        messageBn: 'অফলাইন মোডে আছেন। সংযোগ পেলে সংরক্ষণ হবে।',
        messageEn: 'Offline mode active. Will save when online.',
      };
    }
    return {
      available: false,
      messageBn: 'ইউজারনেম যাচাই করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।',
      messageEn: 'Failed to verify username. Please try again.',
    };
  }
}

export async function changeUsername(params: {
  uid: string;
  newUsername: string;
  oldUsername?: string;
  hasDonorProfile?: boolean;
}): Promise<{ username: string; usernameLower: string }> {
  const cleanName = params.newUsername.trim();
  const validationErrorBn = getUsernameValidationError(cleanName, 'bn');
  if (validationErrorBn) {
    throw new Error(validationErrorBn);
  }

  const newLower = normalizeUsername(cleanName);
  const oldLower = params.oldUsername ? normalizeUsername(params.oldUsername) : null;

  // If exact same username including casing, no-op
  if (oldLower === newLower && cleanName === params.oldUsername?.trim()) {
    return { username: cleanName, usernameLower: newLower };
  }

  // If changing handle, check whether target handle is already claimed by someone else
  if (oldLower !== newLower) {
    try {
      const snap = await getDoc(doc(db, 'usernames', newLower));
      if (snap.exists() && snap.data()?.uid !== params.uid) {
        throw new Error('এই ইউজারনেমটি ইতিমধ্যে অন্য একজন ব্যবহার করছেন। অন্য একটি ইউনিক ইউজারনেম দিন।');
      }
    } catch (readErr) {
      if (!isOfflineError(readErr) && readErr instanceof Error && readErr.message.includes('ইতিমধ্যে অন্য একজন')) {
        throw readErr;
      }
    }
  }

  const batch = writeBatch(db);

  // Reserve new username document
  batch.set(doc(db, 'usernames', newLower), {
    username: cleanName,
    usernameLower: newLower,
    uid: params.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Release old username if different
  if (oldLower && oldLower !== newLower) {
    batch.delete(doc(db, 'usernames', oldLower));
  }

  // Update user profile document
  batch.update(doc(db, 'users', params.uid), {
    username: cleanName,
    usernameLower: newLower,
    updatedAt: serverTimestamp(),
  });

  // Update donor profile if active donor
  if (params.hasDonorProfile) {
    batch.update(doc(db, 'donors', params.uid), {
      username: cleanName,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return { username: cleanName, usernameLower: newLower };
  } catch (commitErr) {
    handleFirestoreError(commitErr, OperationType.UPDATE, `users/${params.uid}`);
    return { username: cleanName, usernameLower: newLower };
  }
}

export async function updateUserProfileAndIdentity(params: {
  uid: string;
  fullName: string;
  preferredLanguage?: AppLanguage;
  newUsername?: string;
  oldUsername?: string;
  hasDonorProfile?: boolean;
}): Promise<{ fullName: string; username?: string }> {
  const cleanName = sanitizeText(params.fullName, SCHEMA_LIMITS.NAME_MAX);
  if (codePointLength(cleanName) < SCHEMA_LIMITS.NAME_MIN) {
    throw new Error('নাম কমপক্ষে ২ অক্ষরের হতে হবে।');
  }

  let finalUsername: string | undefined = undefined;
  let newLower: string | null = null;
  const oldLower: string | null = params.oldUsername
    ? normalizeUsername(params.oldUsername)
    : null;

  if (params.newUsername !== undefined && params.newUsername.trim().length > 0) {
    const cleanUsername = params.newUsername.trim();
    const valErr = getUsernameValidationError(cleanUsername, 'bn');
    if (valErr) {
      throw new Error(valErr);
    }
    finalUsername = cleanUsername;
    newLower = normalizeUsername(cleanUsername);

    if (oldLower !== newLower) {
      try {
        const snap = await getDoc(doc(db, 'usernames', newLower));
        if (snap.exists() && snap.data()?.uid !== params.uid) {
          throw new Error(
            'এই ইউজারনেমটি ইতিমধ্যে অন্য একজন ব্যবহার করছেন। অন্য একটি ইউনিক ইউজারনেম দিন।'
          );
        }
      } catch (readErr) {
        if (
          !isOfflineError(readErr) &&
          readErr instanceof Error &&
          readErr.message.includes('ইতিমধ্যে অন্য একজন')
        ) {
          throw readErr;
        }
      }
    }
  }

  const batch = writeBatch(db);

  if (newLower && finalUsername) {
    batch.set(doc(db, 'usernames', newLower), {
      username: finalUsername,
      usernameLower: newLower,
      uid: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (oldLower && oldLower !== newLower) {
      batch.delete(doc(db, 'usernames', oldLower));
    }
  }

  const userUpdates: Record<string, unknown> = {
    fullName: cleanName,
    updatedAt: serverTimestamp(),
  };
  if (params.preferredLanguage) {
    userUpdates.preferredLanguage = params.preferredLanguage;
  }
  if (finalUsername && newLower) {
    userUpdates.username = finalUsername;
    userUpdates.usernameLower = newLower;
  }
  batch.update(doc(db, 'users', params.uid), userUpdates);

  if (params.hasDonorProfile) {
    const donorUpdates: Record<string, unknown> = {
      displayName: cleanName,
      updatedAt: serverTimestamp(),
    };
    if (finalUsername) {
      donorUpdates.username = finalUsername;
    }
    batch.update(doc(db, 'donors', params.uid), donorUpdates);
  }

  try {
    await batch.commit();

    if (auth.currentUser && auth.currentUser.uid === params.uid) {
      try {
        await updateProfile(auth.currentUser, { displayName: cleanName });
      } catch (authErr) {
        console.warn('Auth displayName update warning:', authErr);
      }
    }
    return { fullName: cleanName, username: finalUsername };
  } catch (commitErr) {
    handleFirestoreError(commitErr, OperationType.UPDATE, `users/${params.uid}`);
    return { fullName: cleanName, username: finalUsername };
  }
}

export async function deactivateOwnAccount(
  uid: string,
  hasDonorProfile: boolean
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), {
    accountStatus: 'deactivated',
    updatedAt: serverTimestamp(),
  });

  if (hasDonorProfile) {
    batch.update(doc(db, 'donors', uid), {
      isListed: false,
      accountStatus: 'deactivated',
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

// =========================================================================
// 2. Donor Profile & Availability Service (/donors/{uid} + /donorPrivate/{uid})
// =========================================================================
export async function getOwnDonorBundle(uid: string): Promise<{
  donor: DonorProfile | null;
  phoneNumber: string;
}> {
  let donor: DonorProfile | null = null;
  let phoneNumber = '';

  try {
    const donorSnap = await getDoc(doc(db, 'donors', uid));
    if (donorSnap.exists()) {
      donor = donorSnap.data() as DonorProfile;
    }
  } catch (error) {
    if (!isOfflineError(error)) {
      handleFirestoreError(error, OperationType.GET, `donors/${uid}`);
    }
  }

  try {
    const privSnap = await getDoc(doc(db, 'donorPrivate', uid));
    if (privSnap.exists()) {
      phoneNumber = (privSnap.data().phoneNumber as string) || '';
    }
  } catch (error) {
    if (!isOfflineError(error)) {
      handleFirestoreError(error, OperationType.GET, `donorPrivate/${uid}`);
    }
  }

  return { donor, phoneNumber };
}

export async function getDonorProfileByUid(uid: string): Promise<{
  donor: DonorProfile | null;
  phoneNumber?: string;
}> {
  if (!uid) return { donor: null };

  if (isDemoRecordId(uid)) {
    const demo = getDemoDonorByUid(uid);
    const phone = DEMO_DONOR_PHONES[uid] || '+8801700000000';
    return { donor: demo || null, phoneNumber: phone };
  }

  try {
    const snap = await getDoc(doc(db, 'donors', uid));
    if (snap.exists()) {
      return { donor: snap.data() as DonorProfile };
    }
  } catch (err) {
    const demo = getDemoDonorByUid(uid);
    if (demo) {
      return { donor: demo, phoneNumber: DEMO_DONOR_PHONES[uid] || '+8801700000000' };
    }
    handleFirestoreError(err, OperationType.GET, `donors/${uid}`);
  }

  const demo = getDemoDonorByUid(uid);
  return {
    donor: demo || null,
    phoneNumber: demo ? DEMO_DONOR_PHONES[uid] || '+8801700000000' : undefined,
  };
}

export interface SaveDonorInput {
  uid: string;
  displayName: string;
  rawPhone: string;
  bloodGroup: BloodGroup;
  divisionId: string;
  districtId: string;
  upazilaId: string;
  availability: AvailabilityStatus;
  contactMethods: ContactMethod[];
  hasConsented: boolean;
  isListed: boolean;
  lastDonationDate: string;
  // Extended organized donor profile attributes
  gender?: DonorGender;
  ageYears?: number;
  weightKg?: number;
  donationPreference?: DonorDonationPreference;
  nightCallPreference?: NightCallPreference;
  occupation?: string;
  preferredHospitalArea?: string;
  donorNote?: string;
  totalDonationsCount?: number;
  totalVolumeMl?: number;
  existingDonor: DonorProfile | null;
  existingPhone: string;
}

export async function saveDonorProfileBundle(
  input: SaveDonorInput
): Promise<void> {
  await ensureCallerActiveProfileReady();

  const cleanName = sanitizeText(input.displayName, SCHEMA_LIMITS.NAME_MAX);
  if (codePointLength(cleanName) < SCHEMA_LIMITS.NAME_MIN) {
    throw new Error('প্রদর্শনের নাম কমপক্ষে ২ অক্ষরের হতে হবে।');
  }

  if (
    !isValidLocationHierarchy(
      input.divisionId,
      input.districtId,
      input.upazilaId
    )
  ) {
    throw new Error('অনুগ্রহ করে সঠিক বিভাগ, জেলা ও উপজেলা নির্বাচন করুন।');
  }

  if (!isValidIsoDate(input.lastDonationDate)) {
    throw new Error('সর্বশেষ রক্তদানের তারিখ সঠিক নয়।');
  }

  const normalizedPhone = normalizeBdPhone(input.rawPhone);
  if (input.isListed) {
    if (!normalizedPhone) {
      throw new Error(
        'রক্তদাতা তালিকা চালু করতে সঠিক বাংলাদেশি মোবাইল নম্বর (যেমন 017XXXXXXXX) প্রদান করুন।'
      );
    }
    if (input.contactMethods.length === 0) {
      throw new Error(
        'অন্তত একটি যোগাযোগ মাধ্যম (Call/SMS/WhatsApp/IMO) নির্বাচন করুন।'
      );
    }
    if (!input.hasConsented) {
      throw new Error(
        'রক্তদাতা হিসেবে তালিকাভুক্ত হতে যোগাযোগের সম্মতি (Consent) প্রদান করা আবশ্যক।'
      );
    }
  } else if (input.rawPhone.trim() && !normalizedPhone) {
    throw new Error(
      'মোবাইল নম্বরের ফরম্যাট সঠিক নয় (সঠিক উদাহরণ: 01712345678)।'
    );
  }

  const safeGender: DonorGender = input.gender || 'not_specified';
  const safeAge = Math.max(
    0,
    Math.min(80, Math.round(Number(input.ageYears) || 0))
  );
  const safeWeight = Math.max(
    0,
    Math.min(200, Math.round(Number(input.weightKg) || 0))
  );
  const safeDonationPref: DonorDonationPreference =
    input.donationPreference || 'whole_blood';
  const safeNightCallPref: NightCallPreference =
    input.nightCallPreference || 'anytime';
  const cleanOccupation = sanitizeText(
    input.occupation || '',
    SCHEMA_LIMITS.OCCUPATION_MAX
  );
  const cleanPreferredArea = sanitizeText(
    input.preferredHospitalArea || '',
    SCHEMA_LIMITS.PREFERRED_AREA_MAX
  );
  const cleanDonorNote = sanitizeText(
    input.donorNote || '',
    SCHEMA_LIMITS.DONOR_NOTE_MAX
  );
  const safeDonationsCount = Math.max(
    0,
    Math.min(
      500,
      Math.round(
        Number(
          input.totalDonationsCount ??
            input.existingDonor?.totalDonationsCount ??
            0
        ) || 0
      )
    )
  );
  const safeTotalVolumeMl = Math.max(
    0,
    Math.min(
      250000,
      Math.round(
        Number(
          input.totalVolumeMl ?? input.existingDonor?.totalVolumeMl ?? 0
        ) || 0
      )
    )
  );

  const uniqueMethods = Array.from(new Set(input.contactMethods));
  const batch = writeBatch(db);
  const privRef = doc(db, 'donorPrivate', input.uid);
  const donorRef = doc(db, 'donors', input.uid);

  if (normalizedPhone) {
    if (input.existingPhone) {
      batch.update(privRef, {
        phoneNumber: normalizedPhone,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(privRef, {
        uid: input.uid,
        phoneNumber: normalizedPhone,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  if (!input.existingDonor) {
    batch.set(donorRef, {
      uid: input.uid,
      displayName: cleanName,
      bloodGroup: input.bloodGroup,
      divisionId: input.divisionId,
      districtId: input.districtId,
      upazilaId: input.upazilaId,
      availability: input.availability,
      lastAvailabilityUpdatedAt: serverTimestamp(),
      contactMethods: uniqueMethods,
      hasConsented: input.hasConsented,
      contactConsentAt: serverTimestamp(),
      isListed: input.isListed,
      accountStatus: 'active',
      emailVerified: true,
      lastDonationDate: input.lastDonationDate || '',
      gender: safeGender,
      ageYears: safeAge,
      weightKg: safeWeight,
      donationPreference: safeDonationPref,
      nightCallPreference: safeNightCallPref,
      occupation: cleanOccupation,
      preferredHospitalArea: cleanPreferredArea,
      donorNote: cleanDonorNote,
      totalDonationsCount: safeDonationsCount,
      totalVolumeMl: safeTotalVolumeMl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    const availabilityChanged =
      input.existingDonor.availability !== input.availability ||
      !input.existingDonor.lastAvailabilityUpdatedAt;
    const consentChanged =
      input.existingDonor.hasConsented !== input.hasConsented ||
      !input.existingDonor.contactConsentAt;

    const updatePayload: Record<string, unknown> = {
      displayName: cleanName,
      bloodGroup: input.bloodGroup,
      divisionId: input.divisionId,
      districtId: input.districtId,
      upazilaId: input.upazilaId,
      availability: input.availability,
      contactMethods: uniqueMethods,
      hasConsented: input.hasConsented,
      isListed: input.isListed,
      emailVerified: true,
      lastDonationDate: input.lastDonationDate || '',
      gender: safeGender,
      ageYears: safeAge,
      weightKg: safeWeight,
      donationPreference: safeDonationPref,
      nightCallPreference: safeNightCallPref,
      occupation: cleanOccupation,
      preferredHospitalArea: cleanPreferredArea,
      donorNote: cleanDonorNote,
      totalDonationsCount: safeDonationsCount,
      totalVolumeMl: safeTotalVolumeMl,
      updatedAt: serverTimestamp(),
    };

    if (availabilityChanged) {
      updatePayload.lastAvailabilityUpdatedAt = serverTimestamp();
    }
    if (consentChanged) {
      updatePayload.contactConsentAt = serverTimestamp();
    }

    batch.update(donorRef, updatePayload);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `donors/${input.uid}`);
  }
}

export async function updateDonorAvailabilityQuick(
  uid: string,
  availability: AvailabilityStatus
): Promise<void> {
  const path = `donors/${uid}`;
  try {
    await updateDoc(doc(db, 'donors', uid), {
      availability,
      lastAvailabilityUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// =========================================================================
// 2B. Donation History Log Service (/donationRecords/{recordId})
// =========================================================================
export async function listMyDonationRecords(
  donorUid: string
): Promise<DonationRecord[]> {
  let snap;
  try {
    snap = await getDocs(
      query(
        collection(db, 'donationRecords'),
        where('donorUid', '==', donorUid),
        limit(100)
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'donationRecords');
  }

  const records = snap.docs.map((d) => d.data() as DonationRecord);
  records.sort((a, b) => b.donationDate.localeCompare(a.donationDate));
  return records;
}

export interface AddDonationRecordInput {
  donorUid: string;
  donorName: string;
  bloodGroup: BloodGroup;
  donationDate: string;
  hospitalOrCenter: string;
  divisionId: string;
  districtId: string;
  upazilaId: string;
  volumeMl: number;
  units: number;
  donationType: DonationComponentType;
  recipientSummary: string;
  linkedRequestId?: string;
  markTemporarilyUnavailable?: boolean;
  existingDonor?: DonorProfile | null;
}

export async function addDonationRecord(
  input: AddDonationRecordInput
): Promise<string> {
  await ensureCallerActiveProfileReady();

  const cleanDonorName = sanitizeText(input.donorName, SCHEMA_LIMITS.NAME_MAX);
  if (codePointLength(cleanDonorName) < SCHEMA_LIMITS.NAME_MIN) {
    throw new Error('রক্তদাতার নাম কমপক্ষে ২ অক্ষরের হতে হবে।');
  }

  if (
    !input.donationDate ||
    !SCHEMA_LIMITS.ISO_DATE_REGEX.test(input.donationDate) ||
    !isValidIsoDate(input.donationDate)
  ) {
    throw new Error('রক্তদানের সঠিক তারিখ নির্বাচন করুন।');
  }

  const cleanHospital = sanitizeText(
    input.hospitalOrCenter,
    SCHEMA_LIMITS.HOSPITAL_MAX
  );
  if (codePointLength(cleanHospital) < 2) {
    throw new Error(
      'কোথায় বা কোন হাসপাতালে রক্ত দিয়েছেন তা কমপক্ষে ২ অক্ষরে লিখুন।'
    );
  }

  if (
    !isValidLocationHierarchy(
      input.divisionId,
      input.districtId,
      input.upazilaId
    )
  ) {
    throw new Error('সঠিক বিভাগ, জেলা ও উপজেলা নির্বাচন করুন।');
  }

  const safeVolumeMl = Math.round(Number(input.volumeMl) || 450);
  if (safeVolumeMl < 150 || safeVolumeMl > 1500) {
    throw new Error('রক্তের পরিমাণ ১৫০ ml থেকে ১৫০০ ml এর মধ্যে হতে হবে।');
  }

  const safeUnits = Math.round(Number(input.units) || 1);
  if (safeUnits < 1 || safeUnits > 4) {
    throw new Error('ব্যাগ সংখ্যা ১ থেকে ৪ এর মধ্যে হতে হবে।');
  }

  const cleanSummary = sanitizeText(
    input.recipientSummary || '',
    SCHEMA_LIMITS.RECIPIENT_SUMMARY_MAX
  );
  const cleanLinkedReq = sanitizeText(
    input.linkedRequestId || '',
    SCHEMA_LIMITS.ID_MAX
  );
  const safeLinkedReq = SCHEMA_LIMITS.ID_REGEX.test(cleanLinkedReq)
    ? cleanLinkedReq
    : '';

  const existingRecords = await listMyDonationRecords(input.donorUid);
  const recordId = generateSafeId('don');

  const nextCount = Math.min(500, existingRecords.length + 1);
  const prevTotalVolume = existingRecords.reduce(
    (acc, r) => acc + (Number(r.volumeMl) || 0),
    0
  );
  const nextTotalVolume = Math.min(250000, prevTotalVolume + safeVolumeMl);

  const allDates = [
    ...existingRecords.map((r) => r.donationDate),
    input.donationDate,
    input.existingDonor?.lastDonationDate || '',
  ].filter(Boolean);
  allDates.sort((a, b) => b.localeCompare(a));
  const latestDonationDate = allDates[0] || input.donationDate;

  const batch = writeBatch(db);
  batch.set(doc(db, 'donationRecords', recordId), {
    id: recordId,
    donorUid: input.donorUid,
    donorName: cleanDonorName,
    bloodGroup: input.bloodGroup,
    donationDate: input.donationDate,
    hospitalOrCenter: cleanHospital,
    divisionId: input.divisionId,
    districtId: input.districtId,
    upazilaId: input.upazilaId,
    volumeMl: safeVolumeMl,
    units: safeUnits,
    donationType: input.donationType,
    recipientSummary: cleanSummary,
    linkedRequestId: safeLinkedReq,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  let donorExists = Boolean(input.existingDonor);
  if (!donorExists) {
    try {
      const donorSnap = await getDoc(doc(db, 'donors', input.donorUid));
      donorExists = donorSnap.exists();
    } catch {
      donorExists = false;
    }
  }

  if (donorExists) {
    const donorSyncPayload: Record<string, unknown> = {
      lastDonationDate: latestDonationDate,
      totalDonationsCount: nextCount,
      totalVolumeMl: nextTotalVolume,
      updatedAt: serverTimestamp(),
    };
    if (input.markTemporarilyUnavailable) {
      donorSyncPayload.availability = 'temporarily_unavailable';
      donorSyncPayload.lastAvailabilityUpdatedAt = serverTimestamp();
    }
    batch.update(doc(db, 'donors', input.donorUid), donorSyncPayload);
  }

  try {
    await batch.commit();
    return recordId;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `donationRecords/${recordId}`
    );
  }
}

export async function deleteOwnDonationRecord(params: {
  recordId: string;
  donorUid: string;
  hasDonorDoc: boolean;
}): Promise<void> {
  await ensureCallerActiveProfileReady();

  try {
    await deleteDoc(doc(db, 'donationRecords', params.recordId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `donationRecords/${params.recordId}`
    );
  }

  if (params.hasDonorDoc) {
    const remaining = await listMyDonationRecords(params.donorUid);
    const nextCount = Math.min(500, remaining.length);
    const nextVolume = Math.min(
      250000,
      remaining.reduce((acc, r) => acc + (Number(r.volumeMl) || 0), 0)
    );
    const latestDate = remaining[0]?.donationDate || '';

    try {
      await updateDoc(doc(db, 'donors', params.donorUid), {
        lastDonationDate: latestDate,
        totalDonationsCount: nextCount,
        totalVolumeMl: nextVolume,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `donors/${params.donorUid}`
      );
    }
  }
}

// =========================================================================
// 3. Protected Donor Search & Separate Counts (/donors)
// =========================================================================
export interface DonorSearchFilters {
  bloodGroup: BloodGroup;
  divisionId?: string;
  districtId?: string;
  upazilaId?: string;
  onlyAvailable?: boolean;
}

export interface DonorSearchResult {
  donors: DonorProfile[];
  totalListedCount: number;
  availableCount: number;
}

export async function searchActiveDonors(
  filters: DonorSearchFilters
): Promise<DonorSearchResult> {
  const constraints: QueryConstraint[] = [
    where('isListed', '==', true),
    where('accountStatus', '==', 'active'),
    where('bloodGroup', '==', filters.bloodGroup),
    limit(200),
  ];

  let snap;
  try {
    snap = await getDocs(query(collection(db, 'donors'), ...constraints));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'donors');
  }

  const allMatchingGroup = snap.docs.map((d) => d.data() as DonorProfile);

  const locationMatched = allMatchingGroup.filter((donor) => {
    if (filters.divisionId && donor.divisionId !== filters.divisionId) {
      return false;
    }
    if (filters.districtId && donor.districtId !== filters.districtId) {
      return false;
    }
    if (filters.upazilaId && donor.upazilaId !== filters.upazilaId) {
      return false;
    }
    return true;
  });

  const totalListedCount = locationMatched.length;
  const availableCount = locationMatched.filter(
    (d) => d.availability === 'available'
  ).length;

  const finalDonors = filters.onlyAvailable
    ? locationMatched.filter((d) => d.availability === 'available')
    : locationMatched;

  const rank: Record<AvailabilityStatus, number> = {
    available: 0,
    not_specified: 1,
    temporarily_unavailable: 2,
  };

  finalDonors.sort((a, b) => rank[a.availability] - rank[b.availability]);

  return {
    donors: finalDonors,
    totalListedCount,
    availableCount,
  };
}

// =========================================================================
// 4. Server-Gated & Audit-Logged Contact Resolver
// =========================================================================
export interface ResolvedContactPayload {
  phoneNumber: string;
  quota?: {
    hourlyUsed: number;
    hourlyLimit: number;
    dailyUsed: number;
    dailyLimit: number;
  };
}

async function checkServerContactGate(params: {
  targetType: 'donor' | 'blood_request';
  targetId: string;
  requestedMethod: ContactMethod;
}): Promise<ResolvedContactPayload['quota']> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('অনুগ্রহ করে প্রথমে লগইন করুন।');
  }

  const idToken = await user.getIdToken(true);
  const apiBase = (
    (import.meta as { env?: Record<string, string | undefined> }).env
      ?.VITE_API_BASE_URL || ''
  ).replace(/\/$/, '');
  const response = await fetch(`${apiBase}/api/contact-gate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(params),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'সার্ভারের সাথে সংযোগ করা যায়নি। অনুগ্রহ করে ইন্টারনেট বা লাইভ ওয়েব ভার্সন ব্যবহার করে পুনরায় চেষ্টা করুন।'
    );
  }

  const body = (await response.json()) as {
    ok?: boolean;
    message?: string;
    quota?: ResolvedContactPayload['quota'];
  };

  if (!response.ok || !body.ok) {
    throw new Error(
      body.message ||
        'যোগাযোগের তথ্য আনলক করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।'
    );
  }

  return body.quota;
}

export async function resolveDonorContact(params: {
  donorUid: string;
  requestedMethod: ContactMethod;
}): Promise<ResolvedContactPayload> {
  const caller = auth.currentUser;
  if (!caller) {
    throw new Error('অনুগ্রহ করে প্রথমে লগইন করুন।');
  }
  if (!caller.emailVerified) {
    throw new Error('যোগাযোগের তথ্য দেখতে আপনার ইমেইল ভেরিফাই করুন।');
  }

  await ensureCallerActiveProfileReady();

  const quota = await checkServerContactGate({
    targetType: 'donor',
    targetId: params.donorUid,
    requestedMethod: params.requestedMethod,
  });

  if (caller.uid !== params.donorUid) {
    const logId = `${caller.uid}_${params.donorUid}`;
    const logPath = `contactAccessLogs/${logId}`;
    const logRef = doc(db, 'contactAccessLogs', logId);

    let existingLog;
    try {
      existingLog = await getDoc(logRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, logPath);
    }

    try {
      if (!existingLog.exists()) {
        try {
          await setDoc(logRef, {
            callerUid: caller.uid,
            donorUid: params.donorUid,
            requestedMethod: params.requestedMethod,
            accessCount: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (firstWriteErr) {
          const raceLog = await getDoc(logRef);
          if (raceLog.exists()) {
            const currentCount = (raceLog.data().accessCount as number) || 1;
            await updateDoc(logRef, {
              requestedMethod: params.requestedMethod,
              accessCount: currentCount + 1,
              updatedAt: serverTimestamp(),
            });
          } else {
            throw firstWriteErr;
          }
        }
      } else {
        const currentCount = (existingLog.data().accessCount as number) || 1;
        await updateDoc(logRef, {
          requestedMethod: params.requestedMethod,
          accessCount: currentCount + 1,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, logPath);
    }
  }

  const privPath = `donorPrivate/${params.donorUid}`;
  let privSnap;
  try {
    privSnap = await getDoc(doc(db, 'donorPrivate', params.donorUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privPath);
  }

  if (!privSnap.exists() || !privSnap.data().phoneNumber) {
    throw new Error('এই রক্তদাতার ফোন নম্বর পাওয়া যায়নি।');
  }

  return {
    phoneNumber: privSnap.data().phoneNumber as string,
    quota,
  };
}

// =========================================================================
// 5. Blood Requests, Donor Booking Lock & Pledges Service
// =========================================================================
export interface CreateBloodRequestInput {
  requesterName: string;
  rawPhone: string;
  bloodGroup: BloodGroup;
  units: number;
  divisionId: string;
  districtId: string;
  upazilaId: string;
  hospitalName: string;
  urgency: BloodRequestUrgency;
  requiredDate: string;
  patientNote: string;
  contactMethods: ContactMethod[];
  hasConsented: boolean;
}

export async function createBloodRequestBundle(
  input: CreateBloodRequestInput
): Promise<string> {
  const caller = auth.currentUser;
  if (!caller || !caller.emailVerified) {
    throw new Error(
      'রক্তের অনুরোধ পোস্ট করতে ভেরিফায়েড অ্যাকাউন্টে লগইন থাকতে হবে।'
    );
  }

  await ensureCallerActiveProfileReady();

  const cleanName = sanitizeText(input.requesterName, SCHEMA_LIMITS.NAME_MAX);
  if (codePointLength(cleanName) < SCHEMA_LIMITS.NAME_MIN) {
    throw new Error('যোগাযোগকারীর নাম কমপক্ষে ২ অক্ষরের হতে হবে।');
  }

  const cleanHospital = sanitizeText(
    input.hospitalName,
    SCHEMA_LIMITS.HOSPITAL_MAX
  );
  if (codePointLength(cleanHospital) < SCHEMA_LIMITS.HOSPITAL_MIN) {
    throw new Error('হাসপাতালের নাম কমপক্ষে ৩ অক্ষরের হতে হবে।');
  }

  const normalizedPhone = normalizeBdPhone(input.rawPhone);
  if (!normalizedPhone) {
    throw new Error(
      'সঠিক বাংলাদেশি মোবাইল নম্বর প্রদান করুন (যেমন 017XXXXXXXX)।'
    );
  }

  if (
    !isValidLocationHierarchy(
      input.divisionId,
      input.districtId,
      input.upazilaId
    )
  ) {
    throw new Error('সঠিক বিভাগ, জেলা ও উপজেলা নির্বাচন করুন।');
  }

  if (
    !input.requiredDate ||
    !SCHEMA_LIMITS.ISO_DATE_REGEX.test(input.requiredDate)
  ) {
    throw new Error('রক্ত প্রয়োজনের তারিখ নির্বাচন করুন।');
  }

  if (input.units < 1 || input.units > 10) {
    throw new Error('রক্তের ব্যাগ সংখ্যা ১ থেকে ১০ এর মধ্যে হতে হবে।');
  }

  if (input.contactMethods.length === 0) {
    throw new Error('অন্তত একটি যোগাযোগ মাধ্যম নির্বাচন করুন।');
  }

  if (!input.hasConsented) {
    throw new Error('যোগাযোগ নম্বর প্রকাশের সম্মতি প্রদান করুন।');
  }

  const requestId = generateSafeId('req');
  const cleanNote = sanitizeText(input.patientNote, SCHEMA_LIMITS.NOTE_MAX);
  const uniqueMethods = Array.from(new Set(input.contactMethods));

  const batch = writeBatch(db);
  batch.set(doc(db, 'bloodRequestPrivate', requestId), {
    requestId,
    createdBy: caller.uid,
    phoneNumber: normalizedPhone,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'bloodRequests', requestId), {
    id: requestId,
    createdBy: caller.uid,
    requesterName: cleanName,
    bloodGroup: input.bloodGroup,
    units: Math.round(input.units),
    divisionId: input.divisionId,
    districtId: input.districtId,
    upazilaId: input.upazilaId,
    hospitalName: cleanHospital,
    urgency: input.urgency,
    requiredDate: input.requiredDate,
    patientNote: cleanNote,
    contactMethods: uniqueMethods,
    hasConsented: true,
    status: 'open',
    bookedDonorUid: '',
    bookedDonorName: '',
    bookingNote: '',
    bookedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return requestId;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `bloodRequests/${requestId}`
    );
  }
}

export async function listOpenBloodRequests(filters?: {
  bloodGroup?: BloodGroup | '';
  divisionId?: string;
  districtId?: string;
  statusFilter?: 'active_all' | 'open_only' | 'booked_only';
}): Promise<BloodRequest[]> {
  let snap;
  try {
    snap = await getDocs(
      query(
        collection(db, 'bloodRequests'),
        where('status', 'in', ['open', 'booked']),
        limit(100)
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'bloodRequests');
  }

  const items = snap.docs.map((d) => d.data() as BloodRequest);
  const filtered = items.filter((req) => {
    if (filters?.bloodGroup && req.bloodGroup !== filters.bloodGroup) {
      return false;
    }
    if (filters?.divisionId && req.divisionId !== filters.divisionId) {
      return false;
    }
    if (filters?.districtId && req.districtId !== filters.districtId) {
      return false;
    }
    if (filters?.statusFilter === 'open_only' && req.status !== 'open') {
      return false;
    }
    if (filters?.statusFilter === 'booked_only' && req.status !== 'booked') {
      return false;
    }
    return true;
  });

  // Sort open requests ahead of booked requests, then emergency first
  const urgencyRank: Record<BloodRequestUrgency, number> = {
    emergency: 0,
    urgent: 1,
    scheduled: 2,
  };

  filtered.sort((a, b) => {
    const aStatus = a.status === 'open' ? 0 : 1;
    const bStatus = b.status === 'open' ? 0 : 1;
    if (aStatus !== bStatus) return aStatus - bStatus;
    return urgencyRank[a.urgency] - urgencyRank[b.urgency];
  });

  return filtered;
}

export async function listMyBloodRequests(
  uid: string
): Promise<BloodRequest[]> {
  let snap;
  try {
    snap = await getDocs(
      query(
        collection(db, 'bloodRequests'),
        where('createdBy', '==', uid),
        limit(60)
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'bloodRequests');
  }
  return snap.docs.map((d) => d.data() as BloodRequest);
}

/**
 * Books a confirmed donor on an open blood request and immediately locks out new
 * contact calls (`bloodRequestPrivate/{requestId}` requires `status == 'open'`).
 */
export async function bookBloodRequestDonor(params: {
  requestId: string;
  bookedDonorUid?: string;
  bookedDonorName: string;
  bookingNote?: string;
  acceptedPledgeId?: string;
  declineOtherPledgeIds?: string[];
}): Promise<void> {
  await ensureCallerActiveProfileReady();

  const cleanDonorName = sanitizeText(
    params.bookedDonorName,
    SCHEMA_LIMITS.NAME_MAX
  );
  if (codePointLength(cleanDonorName) < SCHEMA_LIMITS.NAME_MIN) {
    throw new Error('চূড়ান্ত হওয়া ডোনারের নাম কমপক্ষে ২ অক্ষরের হতে হবে।');
  }

  const cleanBookingNote = sanitizeText(
    params.bookingNote || '',
    SCHEMA_LIMITS.BOOKING_NOTE_MAX
  );
  const rawUid = sanitizeText(params.bookedDonorUid || '', SCHEMA_LIMITS.ID_MAX);
  const safeDonorUid =
    rawUid && SCHEMA_LIMITS.ID_REGEX.test(rawUid) ? rawUid : '';

  const batch = writeBatch(db);
  batch.update(doc(db, 'bloodRequests', params.requestId), {
    status: 'booked' as BloodRequestStatus,
    bookedDonorUid: safeDonorUid,
    bookedDonorName: cleanDonorName,
    bookingNote: cleanBookingNote,
    bookedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (params.acceptedPledgeId) {
    batch.update(doc(db, 'requestPledges', params.acceptedPledgeId), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
  }

    for (const otherId of params.declineOtherPledgeIds || []) {
    if (otherId && otherId !== params.acceptedPledgeId) {
      batch.update(doc(db, 'requestPledges', otherId), {
        status: 'declined',
        updatedAt: serverTimestamp(),
      });
    }
  }

  // Real-time notification delivered to the booked donor
  if (safeDonorUid) {
    const notifId = generateSafeId('notif');
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      targetUid: safeDonorUid,
      type: 'donor_booked',
      titleBn: 'অভিনন্দন! রক্তদানের জন্য আপনি চূড়ান্ত (বুকড) হয়েছেন 🎉',
      titleEn: 'Confirmed! You have been booked for blood donation 🎉',
      messageBn: `রোগীর স্বজন আপনাকে রক্তদানের জন্য চূড়ান্ত ডোনার নির্বাচন করেছেন। অপ্রয়োজনীয় কল থামাতে অনুরোধের যোগাযোগ লক করা হয়েছে। বার্তা: "${cleanBookingNote || 'হাসপাতালে নির্ধারিত সময়ে উপস্থিত থাকুন'}"।`,
      messageEn: `You have been confirmed as the blood donor. Contact calls are locked to avoid disturbances. Note: "${cleanBookingNote || 'Please arrive at the scheduled time.'}".`,
      targetView: 'blood_requests',
      targetId: params.requestId,
      targetDonorUid: safeDonorUid,
      urgency: 'urgent',
      read: false,
      metadata: {
        requestId: params.requestId,
        bookedDonorName: cleanDonorName,
        bookingNote: cleanBookingNote,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `bloodRequests/${params.requestId}`
    );
  }
}

/**
 * Re-opens a booked blood request back to 'open' if the confirmed donor could not
 * make it, restoring call/contact buttons immediately.
 */
export async function reopenBookedBloodRequest(
  requestId: string
): Promise<void> {
  await ensureCallerActiveProfileReady();

  const path = `bloodRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'bloodRequests', requestId), {
      status: 'open' as BloodRequestStatus,
      bookedDonorUid: '',
      bookedDonorName: '',
      bookingNote: '',
      bookedAt: null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function closeOwnBloodRequest(
  requestId: string,
  status: 'fulfilled' | 'cancelled'
): Promise<void> {
  await ensureCallerActiveProfileReady();

  const path = `bloodRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'bloodRequests', requestId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function resolveBloodRequestContact(params: {
  requestId: string;
  requestedMethod: ContactMethod;
}): Promise<ResolvedContactPayload> {
  await ensureCallerActiveProfileReady();

  const quota = await checkServerContactGate({
    targetType: 'blood_request',
    targetId: params.requestId,
    requestedMethod: params.requestedMethod,
  });

  const privPath = `bloodRequestPrivate/${params.requestId}`;
  let snap;
  try {
    snap = await getDoc(doc(db, 'bloodRequestPrivate', params.requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privPath);
  }

  if (!snap.exists() || !snap.data().phoneNumber) {
    throw new Error(
      'এই অনুরোধটির জন্য ডোনার বুকড থাকায় বা বন্ধ হওয়ায় যোগাযোগ নম্বর লক করা হয়েছে।'
    );
  }

  return {
    phoneNumber: snap.data().phoneNumber as string,
    quota,
  };
}

// =========================================================================
// 5B. Donor Request Pledges (/requestPledges/{requestId}_{donorUid})
// =========================================================================
export async function submitRequestPledge(params: {
  request: BloodRequest;
  donorName: string;
  donorBloodGroup: BloodGroup;
  units?: number;
  message: string;
}): Promise<string> {
  const caller = auth.currentUser;
  if (!caller || !caller.emailVerified) {
    throw new Error('রক্তদানের আগ্রহ জানাতে ভেরিফায়েড অ্যাকাউন্টে লগইন করুন।');
  }
  if (caller.uid === params.request.createdBy) {
    throw new Error(
      'পোস্টকারী হিসেবে আপনি নিজে বুক করতে পারবেন না। অন্য রক্তদাতারা আপনার অনুরোধে রক্ত দিতে বুক করতে পারবেন।'
    );
  }
  if (params.request.status !== 'open') {
    throw new Error('এই অনুরোধটিতে ইতোমধ্যে ডোনার বুকড বা সম্পন্ন হয়েছে।');
  }

  await ensureCallerActiveProfileReady();

  const cleanDonorName = sanitizeText(params.donorName, SCHEMA_LIMITS.NAME_MAX);
  if (codePointLength(cleanDonorName) < SCHEMA_LIMITS.NAME_MIN) {
    throw new Error('আপনার নাম কমপক্ষে ২ অক্ষরের হতে হবে।');
  }

  const cleanMessage = sanitizeText(
    params.message || '',
    SCHEMA_LIMITS.PLEDGE_MSG_MAX
  );

  const pledgeUnits = Math.max(1, Math.min(10, params.units || 1));
  const pledgeId = `${params.request.id}_${caller.uid}`;
  const pledgePath = `requestPledges/${pledgeId}`;
  const pledgeRef = doc(db, 'requestPledges', pledgeId);

  let existingSnap;
  try {
    existingSnap = await getDoc(pledgeRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, pledgePath);
  }

  try {
    if (!existingSnap.exists()) {
      await setDoc(pledgeRef, {
        id: pledgeId,
        requestId: params.request.id,
        requestCreatorUid: params.request.createdBy,
        hospitalName: sanitizeText(
          params.request.hospitalName,
          SCHEMA_LIMITS.HOSPITAL_MAX
        ),
        donorUid: caller.uid,
        donorName: cleanDonorName,
        donorBloodGroup: params.donorBloodGroup,
        units: pledgeUnits,
        message: cleanMessage,
        status: 'offered',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(pledgeRef, {
        donorName: cleanDonorName,
        donorBloodGroup: params.donorBloodGroup,
        units: pledgeUnits,
        message: cleanMessage,
        status: 'offered',
        updatedAt: serverTimestamp(),
      });
    }

    // Send real-time notification to the blood request creator
    try {
      const notifId = generateSafeId('notif');
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        targetUid: params.request.createdBy,
        type: 'pledge_received',
        titleBn: `নতুন রক্তদাতা ${pledgeUnits} ব্যাগ রক্ত দিতে আগ্রহী!`,
        titleEn: `Donor Offered ${pledgeUnits} Bag(s) of Blood!`,
        messageBn: `${cleanDonorName} (${params.donorBloodGroup}) আপনার "${params.request.hospitalName}"-এর অনুরোধে ${pledgeUnits} ব্যাগ রক্ত দিতে সম্মতি জানিয়েছেন। বার্তা: "${cleanMessage || 'আমি রক্ত দিতে প্রস্তুত'}"। ডোনারের প্রোফাইল দেখতে ক্লিক করুন।`,
        messageEn: `${cleanDonorName} (${params.donorBloodGroup}) offered to donate ${pledgeUnits} bag(s) for your request at ${params.request.hospitalName}. Click to view full donor details.`,
        targetView: 'blood_requests',
        targetId: params.request.id,
        targetDonorUid: caller.uid,
        urgency: 'urgent',
        read: false,
        metadata: {
          donorName: cleanDonorName,
          donorUid: caller.uid,
          bloodGroup: params.donorBloodGroup,
          hospitalName: params.request.hospitalName,
          requestId: params.request.id,
          units: pledgeUnits,
          totalUnits: params.request.units,
          pledgeMessage: cleanMessage,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (notifError) {
      console.warn('Real-time notification dispatch notice:', notifError);
    }

    return pledgeId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pledgePath);
  }
}

export async function withdrawRequestPledge(
  pledge: RequestPledge
): Promise<void> {
  await ensureCallerActiveProfileReady();

  const path = `requestPledges/${pledge.id}`;
  try {
    await updateDoc(doc(db, 'requestPledges', pledge.id), {
      donorName: pledge.donorName,
      donorBloodGroup: pledge.donorBloodGroup,
      message: pledge.message,
      status: 'withdrawn',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function listPledgesForMyRequests(
  creatorUid: string
): Promise<RequestPledge[]> {
  let snap;
  try {
    snap = await getDocs(
      query(
        collection(db, 'requestPledges'),
        where('requestCreatorUid', '==', creatorUid),
        limit(150)
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'requestPledges');
  }
  return snap.docs.map((d) => d.data() as RequestPledge);
}

export async function listMyDonorPledges(
  donorUid: string
): Promise<RequestPledge[]> {
  let snap;
  try {
    snap = await getDocs(
      query(
        collection(db, 'requestPledges'),
        where('donorUid', '==', donorUid),
        limit(100)
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'requestPledges');
  }
  return snap.docs.map((d) => d.data() as RequestPledge);
}

// =========================================================================
// 6. Reporting Service (/reports)
// =========================================================================
export async function submitAbuseReport(params: {
  targetType: 'donor' | 'blood_request';
  targetId: string;
  targetUid: string;
  reason: ReportReason;
  description: string;
}): Promise<void> {
  const caller = auth.currentUser;
  if (!caller || !caller.emailVerified) {
    throw new Error('রিপোর্ট জমা দিতে ভেরিফায়েড অ্যাকাউন্টে লগইন থাকতে হবে।');
  }
  if (caller.uid === params.targetUid) {
    throw new Error('নিজের প্রোফাইল বা অনুরোধের বিরুদ্ধে রিপোর্ট করা যাবে না।');
  }

  await ensureCallerActiveProfileReady();

  const reportId = generateSafeId('rep');
  const cleanDesc = sanitizeText(
    params.description,
    SCHEMA_LIMITS.REPORT_DESC_MAX
  );

  try {
    await setDoc(doc(db, 'reports', reportId), {
      id: reportId,
      reportedBy: caller.uid,
      targetType: params.targetType,
      targetId: params.targetId,
      targetUid: params.targetUid,
      reason: params.reason,
      description: cleanDesc,
      status: 'open',
      reviewedBy: '',
      resolutionNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `reports/${reportId}`);
  }
}

export async function listMyReports(uid: string): Promise<AbuseReport[]> {
  let snap;
  try {
    snap = await getDocs(
      query(
        collection(db, 'reports'),
        where('reportedBy', '==', uid),
        limit(50)
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'reports');
  }
  return snap.docs.map((d) => d.data() as AbuseReport);
}

// =========================================================================
// 7. Admin & Full Platform Observability Service
// =========================================================================
export async function getAdminRoleForUser(
  uid: string
): Promise<AdminRoleRecord | null> {
  try {
    const snap = await getDoc(doc(db, 'adminRoles', uid));
    return snap.exists() ? (snap.data() as AdminRoleRecord) : null;
  } catch {
    return null;
  }
}

export interface AdminDashboardBundle {
  users: UserProfile[];
  donors: DonorProfile[];
  donationRecords: DonationRecord[];
  requests: BloodRequest[];
  pledges: RequestPledge[];
  contactLogs: ContactAccessLogRecord[];
  reports: AbuseReport[];
  auditLogs: AuditLogRecord[];
  adminRoles: AdminRoleRecord[];
}

export async function adminFetchDashboardData(
  isSuperAdmin: boolean
): Promise<AdminDashboardBundle> {
  try {
    const [
      usersSnap,
      donorsSnap,
      donationsSnap,
      reqSnap,
      pledgesSnap,
      contactLogsSnap,
      repSnap,
      auditSnap,
      rolesSnap,
    ] = await Promise.all([
      getDocs(query(collection(db, 'users'), limit(200))).catch(() => ({
        docs: [],
      })),
      getDocs(query(collection(db, 'donors'), limit(200))).catch(() => ({
        docs: [],
      })),
      getDocs(query(collection(db, 'donationRecords'), limit(200))).catch(
        () => ({ docs: [] })
      ),
      getDocs(query(collection(db, 'bloodRequests'), limit(200))).catch(
        () => ({ docs: [] })
      ),
      getDocs(query(collection(db, 'requestPledges'), limit(200))).catch(
        () => ({ docs: [] })
      ),
      getDocs(query(collection(db, 'contactAccessLogs'), limit(200))).catch(
        () => ({ docs: [] })
      ),
      getDocs(query(collection(db, 'reports'), limit(200))).catch(() => ({
        docs: [],
      })),
      getDocs(query(collection(db, 'auditLogs'), limit(200))).catch(() => ({
        docs: [],
      })),
      isSuperAdmin
        ? getDocs(query(collection(db, 'adminRoles'), limit(100))).catch(
            () => ({ docs: [] })
          )
        : Promise.resolve({ docs: [] }),
    ]);

    return {
      users: usersSnap.docs.map((d) => d.data() as UserProfile),
      donors: donorsSnap.docs.map((d) => d.data() as DonorProfile),
      donationRecords: donationsSnap.docs.map(
        (d) => d.data() as DonationRecord
      ),
      requests: reqSnap.docs.map((d) => d.data() as BloodRequest),
      pledges: pledgesSnap.docs.map((d) => d.data() as RequestPledge),
      contactLogs: contactLogsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ContactAccessLogRecord, 'id'>),
      })),
      reports: repSnap.docs.map((d) => d.data() as AbuseReport),
      auditLogs: auditSnap.docs.map((d) => d.data() as AuditLogRecord),
      adminRoles: rolesSnap.docs.map((d) => d.data() as AdminRoleRecord),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'admin_dashboard');
  }
}

function appendAuditToBatch(
  batch: ReturnType<typeof writeBatch>,
  params: {
    action: AuditActionType;
    targetType: AuditLogRecord['targetType'];
    targetId: string;
    reason: string;
  }
) {
  const caller = auth.currentUser;
  if (!caller || !caller.email) {
    throw new Error('অ্যাডমিন সেশন পাওয়া যায়নি।');
  }
  const cleanReason = sanitizeText(
    params.reason,
    SCHEMA_LIMITS.AUDIT_REASON_MAX
  );
  if (codePointLength(cleanReason) < SCHEMA_LIMITS.AUDIT_REASON_MIN) {
    throw new Error('অডিট লগের জন্য কমপক্ষে ৩ অক্ষরের কারণ উল্লেখ করুন।');
  }

  const logId = generateSafeId('aud');
  batch.set(doc(db, 'auditLogs', logId), {
    id: logId,
    actorUid: caller.uid,
    actorEmail: sanitizeText(caller.email, SCHEMA_LIMITS.EMAIL_MAX),
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    reason: cleanReason,
    createdAt: serverTimestamp(),
  });
}

export async function adminSetUserAccountStatus(params: {
  targetUid: string;
  newStatus: AccountStatus;
  hasDonorDoc: boolean;
  reason: string;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', params.targetUid), {
    accountStatus: params.newStatus,
    updatedAt: serverTimestamp(),
  });

  if (params.hasDonorDoc) {
    batch.update(doc(db, 'donors', params.targetUid), {
      accountStatus: params.newStatus,
      isListed: false,
      updatedAt: serverTimestamp(),
    });
  }

  appendAuditToBatch(batch, {
    action: params.newStatus === 'active' ? 'restore_user' : 'suspend_user',
    targetType: 'user',
    targetId: params.targetUid,
    reason: params.reason,
  });

  // Real-time notification delivered to the user with the reason
  const notifId = generateSafeId('notif');
  const isSuspended = params.newStatus === 'suspended';
  batch.set(doc(db, 'notifications', notifId), {
    id: notifId,
    targetUid: params.targetUid,
    type: 'user_status_changed',
    titleBn: isSuspended
      ? 'আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে'
      : 'আপনার অ্যাকাউন্ট পুনরায় সচল করা হয়েছে',
    titleEn: isSuspended
      ? 'Your account has been temporarily suspended'
      : 'Your account has been restored to active status',
    messageBn: isSuspended
      ? `অ্যাডমিন মডারেশন দ্বারা আপনার অ্যাকাউন্ট স্থগিত রাখা হয়েছে। কারণ: "${params.reason}"। বিস্তারিত জানতে অ্যাডমিন সাপোর্টে যোগাযোগ করুন।`
      : `আপনার অ্যাকাউন্ট পুনরায় সক্রিয় করা হয়েছে। কারণ/নোট: "${params.reason}"। আপনি এখন রক্তদান বা অনুরোধের সকল সুবিধা ব্যবহার করতে পারবেন।`,
    messageEn: isSuspended
      ? `Your account was suspended by moderation. Reason: "${params.reason}".`
      : `Your account was restored to active. Note: "${params.reason}".`,
    targetView: 'profile',
    urgency: isSuspended ? 'emergency' : 'info',
    read: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `users/${params.targetUid}`
    );
  }
}

export async function adminSetDonorListing(params: {
  donorUid: string;
  isListed: boolean;
  currentAccountStatus: AccountStatus;
  reason: string;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'donors', params.donorUid), {
    isListed: params.isListed,
    accountStatus: params.currentAccountStatus,
    updatedAt: serverTimestamp(),
  });

  appendAuditToBatch(batch, {
    action: params.isListed ? 'relist_donor' : 'unlist_donor',
    targetType: 'donor',
    targetId: params.donorUid,
    reason: params.reason,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `donors/${params.donorUid}`
    );
  }
}

export async function adminReviewAbuseReport(params: {
  reportId: string;
  status: ReportStatus;
  resolutionNote: string;
}): Promise<void> {
  const caller = auth.currentUser;
  if (!caller) throw new Error('অ্যাডমিন সেশন পাওয়া যায়নি।');

  const cleanNote = sanitizeText(
    params.resolutionNote,
    SCHEMA_LIMITS.AUDIT_REASON_MAX
  );
  if (codePointLength(cleanNote) < SCHEMA_LIMITS.AUDIT_REASON_MIN) {
    throw new Error('মডারেশন নোট কমপক্ষে ৩ অক্ষরের হতে হবে।');
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'reports', params.reportId), {
    status: params.status,
    reviewedBy: caller.uid,
    resolutionNote: cleanNote,
    updatedAt: serverTimestamp(),
  });

  const actionMap: Record<ReportStatus, AuditActionType> = {
    open: 'review_report',
    reviewing: 'review_report',
    resolved: 'resolve_report',
    dismissed: 'dismiss_report',
  };

  appendAuditToBatch(batch, {
    action: actionMap[params.status],
    targetType: 'report',
    targetId: params.reportId,
    reason: cleanNote,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `reports/${params.reportId}`
    );
  }
}

export async function adminRemoveBloodRequest(params: {
  requestId: string;
  reason: string;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'bloodRequests', params.requestId), {
    status: 'removed' as BloodRequestStatus,
    updatedAt: serverTimestamp(),
  });

  appendAuditToBatch(batch, {
    action: 'remove_blood_request',
    targetType: 'blood_request',
    targetId: params.requestId,
    reason: params.reason,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `bloodRequests/${params.requestId}`
    );
  }
}

export async function adminReopenBloodRequest(params: {
  requestId: string;
  reason: string;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'bloodRequests', params.requestId), {
    status: 'open' as BloodRequestStatus,
    bookedDonorUid: '',
    bookedDonorName: '',
    bookingNote: '',
    bookedAt: null,
    updatedAt: serverTimestamp(),
  });

  appendAuditToBatch(batch, {
    action: 'reopen_blood_request',
    targetType: 'blood_request',
    targetId: params.requestId,
    reason: params.reason,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `bloodRequests/${params.requestId}`
    );
  }
}

export async function adminRemoveDonationRecord(params: {
  recordId: string;
  reason: string;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'donationRecords', params.recordId));

  appendAuditToBatch(batch, {
    action: 'remove_donation_record',
    targetType: 'donation_record',
    targetId: params.recordId,
    reason: params.reason,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `donationRecords/${params.recordId}`
    );
  }
}

export async function adminGrantModeratorRole(params: {
  targetUid: string;
  role: AdminRoleType;
  existsAlready: boolean;
  reason: string;
}): Promise<void> {
  const caller = auth.currentUser;
  if (!caller) throw new Error('অ্যাডমিন সেশন পাওয়া যায়নি।');

  const batch = writeBatch(db);
  const roleRef = doc(db, 'adminRoles', params.targetUid);

  if (params.existsAlready) {
    batch.update(roleRef, {
      role: params.role,
      grantedBy: caller.uid,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(roleRef, {
      uid: params.targetUid,
      role: params.role,
      grantedBy: caller.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  appendAuditToBatch(batch, {
    action: 'grant_moderator',
    targetType: 'admin_role',
    targetId: params.targetUid,
    reason: params.reason,
  });

  // Real-time notification delivered to the user who was granted moderator role
  const notifId = generateSafeId('notif');
  batch.set(doc(db, 'notifications', notifId), {
    id: notifId,
    targetUid: params.targetUid,
    type: 'moderator_granted',
    titleBn: 'অভিনন্দন! আপনাকে মডারেটর রোল প্রদান করা হয়েছে 🛡️',
    titleEn: 'Congratulations! You have been granted the Moderator role 🛡️',
    messageBn: `অ্যাডমিন আপনাকে রক্তদেই প্ল্যাটফর্মের মডারেটর ক্ষমতা প্রদান করেছেন। কারণ/বার্তা: "${params.reason}"। আপনি এখন কেন্দ্রীয় অ্যাডমিন ও পর্যবেক্ষণ প্যানেল পরিচালনা করতে পারবেন।`,
    messageEn: `An admin granted you Moderator privileges on Rokto Dei. Reason/Note: "${params.reason}". You can now access moderation tools.`,
    targetView: 'admin',
    urgency: 'info',
    read: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `adminRoles/${params.targetUid}`
    );
  }
}

export async function adminRevokeModeratorRole(params: {
  targetUid: string;
  reason: string;
}): Promise<void> {
  const caller = auth.currentUser;
  if (!caller) throw new Error('অ্যাডমিন সেশন পাওয়া যায়নি।');

  const batch = writeBatch(db);
  const roleRef = doc(db, 'adminRoles', params.targetUid);
  batch.delete(roleRef);

  appendAuditToBatch(batch, {
    action: 'revoke_moderator',
    targetType: 'admin_role',
    targetId: params.targetUid,
    reason: params.reason,
  });

  // Real-time notification delivered to the user with the reason
  const notifId = generateSafeId('notif');
  batch.set(doc(db, 'notifications', notifId), {
    id: notifId,
    targetUid: params.targetUid,
    type: 'moderator_revoked',
    titleBn: 'মডারেটর রোল প্রত্যাহার করা হয়েছে',
    titleEn: 'Moderator Role Revoked',
    messageBn: `আপনার মডারেটর রোল প্রত্যাহার করা হয়েছে। কারণ: "${params.reason}"। আপনার মূল ডোনার/ইউজার অ্যাকাউন্ট সম্পূর্ণ সচল রয়েছে।`,
    messageEn: `Your Moderator role has been revoked. Reason: "${params.reason}". Your user account remains active.`,
    targetView: 'profile',
    urgency: 'urgent',
    read: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `adminRoles/${params.targetUid}`
    );
  }
}

export interface SendNotificationInput {
  targetUid: string;
  type: NotificationType;
  titleBn: string;
  titleEn: string;
  messageBn: string;
  messageEn: string;
  targetView: AppView;
  targetId?: string;
  targetDonorUid?: string;
  urgency?: 'emergency' | 'urgent' | 'info';
  metadata?: Record<string, any>;
}

export async function sendRealtimeNotification(
  input: SendNotificationInput
): Promise<string> {
  const caller = auth.currentUser;
  if (!caller || !caller.emailVerified) {
    return '';
  }

  const notifId = generateSafeId('notif');
  const notifPath = `notifications/${notifId}`;
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      id: notifId,
      targetUid: input.targetUid,
      type: input.type,
      titleBn: sanitizeText(input.titleBn, 140),
      titleEn: sanitizeText(input.titleEn, 140),
      messageBn: sanitizeText(input.messageBn, 600),
      messageEn: sanitizeText(input.messageEn, 600),
      targetView: input.targetView,
      targetId: input.targetId || '',
      targetDonorUid: input.targetDonorUid || '',
      urgency: input.urgency || 'info',
      read: false,
      metadata: input.metadata || {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return notifId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, notifPath);
    return '';
  }
}
