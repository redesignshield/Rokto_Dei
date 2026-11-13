import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Droplets,
  Edit2,
  Heart,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  User,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { DigitalDonorCardModal } from './DigitalDonorCardModal';
import { getDonorTier } from '../lib/donorBadge';
import { useAuth } from '../contexts/AuthContext';
import {
  DIVISIONS,
  formatLocationLabel,
  getDistrictsByDivision,
  getUpazilasByDistrict,
} from '../data/bdLocations';
import {
  DEMO_DONATION_RECORDS,
  getUserDemoDonationRecords,
  getUserDemoBloodRequest,
  getUserDemoIncomingPledge,
  getUserDemoOutgoingPledge,
  daysOffsetIso,
  isDemoRecordId,
} from '../data/removableDemoData';
import { DemoPreviewBanner } from './DemoPreviewBanner';
import {
  availabilityLabel,
  contactMethodLabel,
  donationComponentLabel,
  donationPreferenceLabel,
  formatTimestamp,
  genderLabel,
  nightCallPreferenceLabel,
  pledgeStatusLabel,
  reportReasonLabel,
  reportStatusLabel,
  requestStatusLabel,
} from '../lib/i18n';
import {
  AVAILABILITY_OPTIONS,
  BLOOD_GROUPS,
  codePointLength,
  CONTACT_METHODS,
  daysSinceDate,
  DONATION_COMPONENT_TYPES,
  DONATION_PREFERENCES,
  DONOR_GENDERS,
  getUsernameValidationError,
  isValidUsername,
  NIGHT_CALL_PREFERENCES,
  normalizeUsername,
  sanitizeText,
  SCHEMA_LIMITS,
} from '../lib/validation';
import {
  addDonationRecord,
  bookBloodRequestDonor,
  changeUsername,
  checkUsernameAvailability,
  closeOwnBloodRequest,
  deactivateOwnAccount,
  deleteOwnDonationRecord,
  listMyBloodRequests,
  listMyDonationRecords,
  listMyDonorPledges,
  listMyReports,
  listPledgesForMyRequests,
  reopenBookedBloodRequest,
  saveDonorProfileBundle,
  updateDonorAvailabilityQuick,
  updateUserProfileAndIdentity,
  updateUserProfileFields,
  withdrawRequestPledge,
} from '../services/roktoService';
import type {
  AbuseReport,
  AppLanguage,
  AppView,
  AvailabilityStatus,
  BloodGroup,
  BloodRequest,
  ContactMethod,
  DonationComponentType,
  DonationRecord,
  DonorDonationPreference,
  DonorGender,
  DonorProfile,
  NightCallPreference,
  RequestPledge,
} from '../types';

interface ProfileViewProps {
  onNavigate: (view: AppView) => void;
}

type ProfileTab = 'donor' | 'history' | 'commitments' | 'account';

export function ProfileView({ onNavigate }: ProfileViewProps) {
  const {
    firebaseUser,
    userProfile,
    ownDonor,
    ownDonorPhone,
    adminRole,
    isEmailVerified,
    lang,
    setLang,
    demoMode,
    logout,
    refreshOwnProfileAndDonor,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>('donor');
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [showOwnBadgeModal, setShowOwnBadgeModal] = useState(false);

  // Logout confirmation modal & 10s countdown
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(10);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (showLogoutModal) {
      setLogoutCountdown(10);
      timer = setInterval(() => {
        setLogoutCountdown((prev) => {
          if (prev <= 1) {
            if (timer) clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setLogoutCountdown(10);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showLogoutModal]);

  const handleOpenLogoutModal = () => {
    setShowLogoutModal(true);
  };

  const handleCancelLogout = () => {
    setShowLogoutModal(false);
    setLogoutCountdown(10);
  };

  const handleConfirmLogout = async () => {
    if (logoutCountdown > 0) return;
    setLoggingOut(true);
    try {
      await logout();
      setShowLogoutModal(false);
      onNavigate('find_donors');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  // Account fields
  const [fullName, setFullName] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<AppLanguage>('bn');

  // Unified Senior Profile & Identity Modal State
  const [showEditIdentityModal, setShowEditIdentityModal] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');
  const [editUsernameInput, setEditUsernameInput] = useState('');
  const [editLangInput, setEditLangInput] = useState<AppLanguage>('bn');
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [identityUsernameStatus, setIdentityUsernameStatus] = useState<{
    checking: boolean;
    status: 'idle' | 'available' | 'taken' | 'invalid';
    message: string;
  }>({
    checking: false,
    status: 'idle',
    message: '',
  });

  // Donor Profile View / Edit Mode Toggle (Safe Categorized View by default)
  const [isEditingDonorProfile, setIsEditingDonorProfile] = useState(false);

  // Organized Donor Profile fields
  const [displayName, setDisplayName] = useState('');
  const [rawPhone, setRawPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [divisionId, setDivisionId] = useState('dhaka');
  const [districtId, setDistrictId] = useState('dhaka');
  const [upazilaId, setUpazilaId] = useState('dhanmondi');
  const [availability, setAvailability] =
    useState<AvailabilityStatus>('not_specified');
  const [contactMethods, setContactMethods] = useState<ContactMethod[]>([
    'call',
  ]);
  const [hasConsented, setHasConsented] = useState(false);
  const [isListed, setIsListed] = useState(true);
  const [lastDonationDate, setLastDonationDate] = useState('');
  const [gender, setGender] = useState<DonorGender>('not_specified');
  const [ageYears, setAgeYears] = useState<number>(0);
  const [weightKg, setWeightKg] = useState<number>(0);
  const [donationPreference, setDonationPreference] =
    useState<DonorDonationPreference>('whole_blood');
  const [nightCallPreference, setNightCallPreference] =
    useState<NightCallPreference>('anytime');
  const [occupation, setOccupation] = useState('');
  const [preferredHospitalArea, setPreferredHospitalArea] = useState('');
  const [donorNote, setDonorNote] = useState('');
  const [manualDonationsCount, setManualDonationsCount] = useState<number>(0);

  // Donation History state
  const [donationRecords, setDonationRecords] = useState<DonationRecord[]>([]);
  const [demoDeletedIds, setDemoDeletedIds] = useState<Set<string>>(new Set());
  const [demoProfileLoaded, setDemoProfileLoaded] = useState<boolean>(() => demoMode);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showAddDonationModal, setShowAddDonationModal] = useState(false);
  const [recDate, setRecDate] = useState(new Date().toISOString().slice(0, 10));
  const [recHospital, setRecHospital] = useState('');
  const [recDivisionId, setRecDivisionId] = useState('dhaka');
  const [recDistrictId, setRecDistrictId] = useState('dhaka');
  const [recUpazilaId, setRecUpazilaId] = useState('dhanmondi');
  const [recVolumeMl, setRecVolumeMl] = useState<number>(450);
  const [recUnits, setRecUnits] = useState<number>(1);
  const [recType, setRecType] =
    useState<DonationComponentType>('whole_blood');
  const [recSummary, setRecSummary] = useState('');
  const [recLinkedReqId, setRecLinkedReqId] = useState('');
  const [recMarkUnavailable, setRecMarkUnavailable] = useState(true);
  const [confirmDeleteRecordId, setConfirmDeleteRecordId] = useState<
    string | null
  >(null);

  // Requests & Bookings state
  const [myRequests, setMyRequests] = useState<BloodRequest[]>([]);
  const [incomingPledges, setIncomingPledges] = useState<RequestPledge[]>([]);
  const [myPledges, setMyPledges] = useState<RequestPledge[]>([]);
  const [loadingCommitments, setLoadingCommitments] = useState(false);
  const [bookingModalReq, setBookingModalReq] = useState<BloodRequest | null>(
    null
  );
  const [bookDonorNameInput, setBookDonorNameInput] = useState('');
  const [bookNoteInput, setBookNoteInput] = useState('');
  const [bookDonorUidInput, setBookDonorUidInput] = useState('');
  const [bookAcceptedPledgeId, setBookAcceptedPledgeId] = useState('');

  // Reports & UI states
  const [myReports, setMyReports] = useState<AbuseReport[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    setAvatarBroken(false);
  }, [firebaseUser?.photoURL]);

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.fullName);
      setPreferredLanguage(userProfile.preferredLanguage);
    } else if (firebaseUser) {
      setFullName(firebaseUser.displayName || '');
    }

    if (ownDonor) {
      setDisplayName(ownDonor.displayName);
      setBloodGroup(ownDonor.bloodGroup);
      setDivisionId(ownDonor.divisionId);
      setDistrictId(ownDonor.districtId);
      setUpazilaId(ownDonor.upazilaId);
      setAvailability(ownDonor.availability);
      setContactMethods(ownDonor.contactMethods);
      setHasConsented(ownDonor.hasConsented);
      setIsListed(ownDonor.isListed);
      setLastDonationDate(ownDonor.lastDonationDate || '');
      setGender(ownDonor.gender || 'not_specified');
      setAgeYears(ownDonor.ageYears || 0);
      setWeightKg(ownDonor.weightKg || 0);
      setDonationPreference(ownDonor.donationPreference || 'whole_blood');
      setNightCallPreference(ownDonor.nightCallPreference || 'anytime');
      setOccupation(ownDonor.occupation || '');
      setPreferredHospitalArea(ownDonor.preferredHospitalArea || '');
      setDonorNote(ownDonor.donorNote || '');
      setManualDonationsCount(ownDonor.totalDonationsCount || 0);

      setRecDivisionId(ownDonor.divisionId);
      setRecDistrictId(ownDonor.districtId);
      setRecUpazilaId(ownDonor.upazilaId);
    } else {
      if (userProfile?.fullName) {
        setDisplayName(userProfile.fullName);
      } else if (firebaseUser?.displayName) {
        setDisplayName(firebaseUser.displayName);
      }
      if (demoMode && demoProfileLoaded) {
        setBloodGroup('O+');
        setDivisionId('dhaka');
        setDistrictId('dhaka');
        setUpazilaId('dhanmondi');
        setAgeYears(28);
        setWeightKg(72);
        setGender('male');
        setOccupation('সফটওয়্যার প্রকৌশলী');
        setPreferredHospitalArea('DMCH, BSMMU, স্কয়ার ও ধানমন্ডি এলাকা');
        setRawPhone('+8801700000000');
        setDonorNote('জরুরি প্রয়োজনে যেকোনো সময় রক্ত দিতে প্রস্তুত।');
        setManualDonationsCount(4);
        setLastDonationDate(daysOffsetIso(-95));
        setAvailability('available');
        setContactMethods(['call', 'whatsapp', 'sms']);
        setDonationPreference('both');
        setNightCallPreference('anytime');
      }
    }

    if (ownDonorPhone) {
      setRawPhone(ownDonorPhone);
    }
  }, [userProfile, ownDonor, ownDonorPhone, firebaseUser, demoMode, demoProfileLoaded]);

  const loadDonationHistory = useCallback(async () => {
    if (!firebaseUser || !isEmailVerified) return;
    setLoadingHistory(true);
    try {
      const records = await listMyDonationRecords(firebaseUser.uid);
      setDonationRecords(records);
    } catch {
      setDonationRecords([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [firebaseUser, isEmailVerified]);

  const loadCommitments = useCallback(async () => {
    if (!firebaseUser || !isEmailVerified) return;
    setLoadingCommitments(true);
    try {
      const [reqs, inPledges, outPledges] = await Promise.all([
        listMyBloodRequests(firebaseUser.uid),
        listPledgesForMyRequests(firebaseUser.uid),
        listMyDonorPledges(firebaseUser.uid),
      ]);
      setMyRequests(reqs);
      setIncomingPledges(inPledges);
      setMyPledges(outPledges);
    } catch {
      setMyRequests([]);
      setIncomingPledges([]);
      setMyPledges([]);
    } finally {
      setLoadingCommitments(false);
    }
  }, [firebaseUser, isEmailVerified]);

  useEffect(() => {
    if (firebaseUser && isEmailVerified) {
      loadDonationHistory();
    }
  }, [firebaseUser, isEmailVerified, loadDonationHistory]);

  useEffect(() => {
    if (!firebaseUser || !isEmailVerified) return;
    if (activeTab === 'commitments') {
      loadCommitments();
    } else if (activeTab === 'account') {
      listMyReports(firebaseUser.uid)
        .then(setMyReports)
        .catch(() => setMyReports([]));
    }
  }, [firebaseUser, isEmailVerified, activeTab, loadCommitments]);

  if (!firebaseUser) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-sm text-neutral-600">
          {lang === 'bn' ? 'প্রোফাইল দেখতে লগইন করুন।' : 'Please sign in first.'}
        </p>
      </div>
    );
  }

  const districts = getDistrictsByDivision(divisionId);
  const upazilas = getUpazilasByDistrict(districtId);
  const recDistricts = getDistrictsByDivision(recDivisionId);
  const recUpazilas = getUpazilasByDistrict(recDistrictId);

  // User tailored demo records (active when in demoMode and user has no real records yet)
  const userDemoDonations = useMemo(() => {
    if (!firebaseUser) return [];
    return getUserDemoDonationRecords(
      firebaseUser.uid,
      displayName || userProfile?.fullName || firebaseUser.displayName || 'রক্তদাতা',
      bloodGroup || 'O+'
    ).filter((r) => !demoDeletedIds.has(r.id));
  }, [firebaseUser, displayName, userProfile?.fullName, bloodGroup, demoDeletedIds]);

  const activeDonationRecords = useMemo(() => {
    if (donationRecords.length > 0) return donationRecords;
    if (demoProfileLoaded && demoMode) return userDemoDonations;
    return [];
  }, [donationRecords, demoProfileLoaded, demoMode, userDemoDonations]);

  const userDemoRequests = useMemo(() => {
    if (!firebaseUser) return [];
    return [
      getUserDemoBloodRequest(
        firebaseUser.uid,
        displayName || userProfile?.fullName || firebaseUser.displayName || 'আমার রক্তের আবেদন',
        rawPhone || '+8801700000000'
      ),
    ];
  }, [firebaseUser, displayName, userProfile?.fullName, rawPhone]);

  const activeMyRequests = useMemo(() => {
    if (myRequests.length > 0) return myRequests;
    if (demoProfileLoaded && demoMode) return userDemoRequests;
    return [];
  }, [myRequests, demoProfileLoaded, demoMode, userDemoRequests]);

  const userDemoIncomingPledges = useMemo(() => {
    if (!firebaseUser || activeMyRequests.length === 0) return [];
    return [
      getUserDemoIncomingPledge(firebaseUser.uid, activeMyRequests[0].id),
    ];
  }, [firebaseUser, activeMyRequests]);

  const activeIncomingPledges = useMemo(() => {
    if (incomingPledges.length > 0) return incomingPledges;
    if (demoProfileLoaded && demoMode) return userDemoIncomingPledges;
    return [];
  }, [incomingPledges, demoProfileLoaded, demoMode, userDemoIncomingPledges]);

  const userDemoOutgoingPledges = useMemo(() => {
    if (!firebaseUser) return [];
    return [
      getUserDemoOutgoingPledge(
        firebaseUser.uid,
        displayName || userProfile?.fullName || firebaseUser.displayName || 'আমি (ডোনার)',
        rawPhone || '+8801700000000'
      ),
    ];
  }, [firebaseUser, displayName, userProfile?.fullName, rawPhone]);

  const activeMyPledges = useMemo(() => {
    if (myPledges.length > 0) return myPledges;
    if (demoProfileLoaded && demoMode) return userDemoOutgoingPledges;
    return [];
  }, [myPledges, demoProfileLoaded, demoMode, userDemoOutgoingPledges]);

  const handleLoadDemoProfileData = () => {
    setDemoProfileLoaded(true);
    setDemoDeletedIds(new Set());
    if (!ownDonor) {
      setDisplayName(firebaseUser.displayName || 'আকরাম হোসেন (টেস্ট ডোনার)');
      setBloodGroup('O+');
      setDivisionId('dhaka');
      setDistrictId('dhaka');
      setUpazilaId('dhanmondi');
      setAgeYears(28);
      setWeightKg(72);
      setGender('male');
      setOccupation('সফটওয়্যার প্রকৌশলী');
      setPreferredHospitalArea('DMCH, BSMMU, স্কয়ার ও ধানমন্ডি এলাকা');
      setRawPhone('+8801700000000');
      setDonorNote('জরুরি প্রয়োজনে যেকোনো সময় রক্ত দিতে প্রস্তুত।');
      setManualDonationsCount(4);
      setLastDonationDate(daysOffsetIso(-95));
      setAvailability('available');
      setContactMethods(['call', 'whatsapp', 'sms']);
      setDonationPreference('both');
      setNightCallPreference('anytime');
    }
    setSuccess(
      lang === 'bn'
        ? 'টেস্টের জন্য নমুনা প্রোফাইল ও ৪টি রক্তদান ইতিহাস লোড করা হয়েছে।'
        : 'Sample test profile and 4 donation records loaded.'
    );
  };

  const handleClearDemoProfileData = () => {
    setDemoProfileLoaded(false);
    setDemoDeletedIds(new Set());
    if (!ownDonor) {
      setDisplayName(userProfile?.fullName || firebaseUser.displayName || '');
      setBloodGroup('O+');
      setDivisionId('dhaka');
      setDistrictId('dhaka');
      setUpazilaId('dhanmondi');
      setAgeYears(0);
      setWeightKg(0);
      setGender('not_specified');
      setOccupation('');
      setPreferredHospitalArea('');
      setRawPhone(ownDonorPhone || '');
      setDonorNote('');
      setManualDonationsCount(0);
      setLastDonationDate('');
      setAvailability('available');
      setContactMethods(['call']);
      setDonationPreference('whole_blood');
      setNightCallPreference('anytime');
    }
    setSuccess(
      lang === 'bn'
        ? 'ডেমো টেস্ট ডাটা রিসেট করা হয়েছে।'
        : 'Demo test data cleared.'
    );
  };

  // Derived Donor Impact Metrics
  const loggedDonationsCount = activeDonationRecords.length;
  const effectiveTotalDonations = Math.max(
    loggedDonationsCount,
    ownDonor?.totalDonationsCount ?? manualDonationsCount
  );
  const loggedVolumeMl = activeDonationRecords.reduce(
    (sum, r) => sum + (Number(r.volumeMl) || 0),
    0
  );
  const effectiveTotalVolumeMl =
    loggedVolumeMl > 0
      ? loggedVolumeMl
      : ownDonor?.totalVolumeMl || effectiveTotalDonations * 450;
  const effectiveLatestDate =
    activeDonationRecords[0]?.donationDate ||
    ownDonor?.lastDonationDate ||
    lastDonationDate ||
    '';
  const daysSinceLast = daysSinceDate(effectiveLatestDate);
  const restWindowDaysLeft =
    daysSinceLast !== null && daysSinceLast < 90 ? 90 - daysSinceLast : 0;

  const toggleMethod = (method: ContactMethod) => {
    setContactMethods((prev) =>
      prev.includes(method)
        ? prev.filter((m) => m !== method)
        : [...prev, method]
    );
  };

  const handleQuickAvailability = async (nextStatus: AvailabilityStatus) => {
    if (!ownDonor) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await updateDonorAvailabilityQuick(firebaseUser.uid, nextStatus);
      setAvailability(nextStatus);
      await refreshOwnProfileAndDonor();
      setSuccess(
        lang === 'bn'
          ? 'আপনার রক্তদানের প্রাপ্যতা (Availability) আপডেট হয়েছে।'
          : 'Availability status updated.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'আপডেট ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const currentUsername = useMemo(() => {
    if (userProfile?.username) return userProfile.username;
    if (ownDonor?.username) return ownDonor.username;
    if (firebaseUser?.email) {
      const emailPrefix = firebaseUser.email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '');
      return emailPrefix.length >= 3
        ? emailPrefix
        : `user_${firebaseUser.uid.slice(0, 5)}`;
    }
    return `user_${firebaseUser?.uid.slice(0, 5) || '123'}`;
  }, [userProfile?.username, ownDonor?.username, firebaseUser?.email, firebaseUser?.uid]);

  const handleOpenEditIdentityModal = () => {
    setEditNameInput(userProfile?.fullName || displayName || firebaseUser?.displayName || '');
    setEditUsernameInput(currentUsername || '');
    setEditLangInput(preferredLanguage || 'bn');
    setIdentityUsernameStatus({
      checking: false,
      status: 'available',
      message:
        lang === 'bn'
          ? 'এটি আপনার বর্তমান ইউজারনেম।'
          : 'This is your current username.',
    });
    setShowEditIdentityModal(true);
  };

  // Real-time debounced availability check inside Unified Edit Identity Modal
  useEffect(() => {
    if (!showEditIdentityModal) return;
    const trimmed = editUsernameInput.trim();
    if (!trimmed) {
      setIdentityUsernameStatus({
        checking: false,
        status: 'idle',
        message: '',
      });
      return;
    }

    const valErr = getUsernameValidationError(trimmed, lang);
    if (valErr) {
      setIdentityUsernameStatus({
        checking: false,
        status: 'invalid',
        message: valErr,
      });
      return;
    }

    if (normalizeUsername(trimmed) === normalizeUsername(currentUsername)) {
      setIdentityUsernameStatus({
        checking: false,
        status: 'available',
        message:
          lang === 'bn'
            ? 'এটি আপনার বর্তমান ইউজারনেম।'
            : 'This is your current username.',
      });
      return;
    }

    let isMounted = true;
    setIdentityUsernameStatus((prev) => ({
      ...prev,
      checking: true,
      message:
        lang === 'bn'
          ? 'ইউজারনেমের প্রাপ্যতা যাচাই করা হচ্ছে...'
          : 'Checking availability...',
    }));

    const timer = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(trimmed, firebaseUser?.uid);
        if (!isMounted) return;
        setIdentityUsernameStatus({
          checking: false,
          status: res.available ? 'available' : 'taken',
          message: lang === 'bn' ? res.messageBn : res.messageEn,
        });
      } catch {
        if (!isMounted) return;
        setIdentityUsernameStatus({
          checking: false,
          status: 'idle',
          message: '',
        });
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [editUsernameInput, showEditIdentityModal, currentUsername, firebaseUser?.uid, lang]);

  const handleSaveUnifiedIdentity = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!firebaseUser) return;

    const cleanName = sanitizeText(editNameInput, SCHEMA_LIMITS.NAME_MAX);
    if (codePointLength(cleanName) < SCHEMA_LIMITS.NAME_MIN) {
      setError(
        lang === 'bn'
          ? 'নাম কমপক্ষে ২ অক্ষরের হতে হবে।'
          : 'Name must be at least 2 characters.'
      );
      return;
    }

    const cleanUsername = editUsernameInput.trim().toLowerCase();
    const valErr = getUsernameValidationError(cleanUsername, lang);
    if (valErr) {
      setError(valErr);
      return;
    }

    if (identityUsernameStatus.status === 'taken') {
      setError(identityUsernameStatus.message);
      return;
    }

    setError(null);
    setSuccess(null);
    setSavingIdentity(true);
    try {
      await updateUserProfileAndIdentity({
        uid: firebaseUser.uid,
        fullName: cleanName,
        newUsername: cleanUsername,
        oldUsername: currentUsername,
        preferredLanguage: editLangInput,
        hasDonorProfile: Boolean(ownDonor),
      });

      setDisplayName(cleanName);
      setFullName(cleanName);
      if (editLangInput !== preferredLanguage) {
        setPreferredLanguage(editLangInput);
        setLang(editLangInput);
      }
      await refreshOwnProfileAndDonor();
      setShowEditIdentityModal(false);
      setSuccess(
        lang === 'bn'
          ? 'আপনার প্রোফাইল পরিচিতি ও ইউজারনেম সফলভাবে সংরক্ষিত হয়েছে।'
          : 'Profile and username updated successfully.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'প্রোফাইল আপডেট করতে সমস্যা হয়েছে।'
      );
    } finally {
      setSavingIdentity(false);
    }
  };

  const handleCancelDonorEdit = () => {
    setIsEditingDonorProfile(false);
    if (ownDonor) {
      setDisplayName(ownDonor.displayName);
      setBloodGroup(ownDonor.bloodGroup);
      setDivisionId(ownDonor.divisionId);
      setDistrictId(ownDonor.districtId);
      setUpazilaId(ownDonor.upazilaId);
      setAvailability(ownDonor.availability);
      setContactMethods(ownDonor.contactMethods || ['call']);
      setHasConsented(ownDonor.hasConsented);
      setIsListed(ownDonor.isListed);
      setLastDonationDate(ownDonor.lastDonationDate || '');
      setGender(ownDonor.gender || 'not_specified');
      setAgeYears(ownDonor.ageYears || 0);
      setWeightKg(ownDonor.weightKg || 0);
      setDonationPreference(ownDonor.donationPreference || 'whole_blood');
      setNightCallPreference(ownDonor.nightCallPreference || 'anytime');
      setOccupation(ownDonor.occupation || '');
      setPreferredHospitalArea(ownDonor.preferredHospitalArea || '');
      setDonorNote(ownDonor.donorNote || '');
    }
    if (ownDonorPhone) {
      setRawPhone(ownDonorPhone);
    }
  };

  const handleSaveDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const syncedCount = Math.max(loggedDonationsCount, manualDonationsCount);
      const syncedVolume =
        loggedVolumeMl > 0
          ? loggedVolumeMl
          : Math.max(ownDonor?.totalVolumeMl || 0, syncedCount * 450);

      await saveDonorProfileBundle({
        uid: firebaseUser.uid,
        displayName,
        rawPhone,
        bloodGroup,
        divisionId,
        districtId,
        upazilaId,
        availability,
        contactMethods,
        hasConsented,
        isListed,
        lastDonationDate: effectiveLatestDate || lastDonationDate,
        gender,
        ageYears,
        weightKg,
        donationPreference,
        nightCallPreference,
        occupation,
        preferredHospitalArea,
        donorNote,
        totalDonationsCount: syncedCount,
        totalVolumeMl: syncedVolume,
        existingDonor: ownDonor,
        existingPhone: ownDonorPhone,
      });
      await refreshOwnProfileAndDonor();
      setIsEditingDonorProfile(false);
      setSuccess(
        lang === 'bn'
          ? 'আপনার রক্তদাতা প্রোফাইল সফলভাবে সংরক্ষিত হয়েছে।'
          : 'Donor profile saved successfully.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'সংরক্ষণ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await addDonationRecord({
        donorUid: firebaseUser.uid,
        donorName:
          ownDonor?.displayName ||
          userProfile?.fullName ||
          firebaseUser.displayName ||
          'রক্তদাতা',
        bloodGroup: ownDonor?.bloodGroup || bloodGroup,
        donationDate: recDate,
        hospitalOrCenter: recHospital,
        divisionId: recDivisionId,
        districtId: recDistrictId,
        upazilaId: recUpazilaId,
        volumeMl: recVolumeMl,
        units: recUnits,
        donationType: recType,
        recipientSummary: recSummary,
        linkedRequestId: recLinkedReqId,
        markTemporarilyUnavailable: recMarkUnavailable,
        existingDonor: ownDonor,
      });
      setShowAddDonationModal(false);
      setRecHospital('');
      setRecSummary('');
      setRecLinkedReqId('');
      await Promise.all([loadDonationHistory(), refreshOwnProfileAndDonor()]);
      setSuccess(
        lang === 'bn'
          ? 'রক্তদানের রেকর্ড যুক্ত হয়েছে এবং প্রোফাইলের মোট হিসাব স্বয়ংক্রিয়ভাবে আপডেট হয়েছে।'
          : 'Donation record saved and profile totals updated.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'রেকর্ড যোগ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDonation = async (recordId: string) => {
    setError(null);
    setSuccess(null);
    if (isDemoRecordId(recordId)) {
      setDemoDeletedIds((prev) => new Set([...prev, recordId]));
      setConfirmDeleteRecordId(null);
      setSuccess(
        lang === 'bn'
          ? 'ডেমো রক্তদানের রেকর্ডটি তালিকা থেকে সরানো হয়েছে।'
          : 'Demo donation record removed.'
      );
      return;
    }
    setSaving(true);
    try {
      await deleteOwnDonationRecord({
        recordId,
        donorUid: firebaseUser.uid,
        hasDonorDoc: Boolean(ownDonor),
      });
      setConfirmDeleteRecordId(null);
      await Promise.all([loadDonationHistory(), refreshOwnProfileAndDonor()]);
      setSuccess(
        lang === 'bn'
          ? 'রক্তদানের রেকর্ড মুছে ফেলা হয়েছে।'
          : 'Donation record removed.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'মুছে ফেলা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const openBookModalForRequest = (
    req: BloodRequest,
    pledge?: RequestPledge
  ) => {
    setBookingModalReq(req);
    setBookDonorNameInput(pledge?.donorName || req.bookedDonorName || '');
    setBookDonorUidInput(pledge?.donorUid || req.bookedDonorUid || '');
    setBookAcceptedPledgeId(pledge?.id || '');
    setBookNoteInput(
      req.bookingNote ||
        (lang === 'bn'
          ? 'ডোনারের সাথে কথা চূড়ান্ত হয়েছে। অনুগ্রহ করে নতুন কেউ কল দেবেন না।'
          : 'Donor confirmed. New calls are paused.')
    );
  };

  const handleConfirmBookDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingModalReq) return;
    setError(null);
    setSuccess(null);
    if (isDemoRecordId(bookingModalReq.id)) {
      setBookingModalReq(null);
      setSuccess(
        lang === 'bn'
          ? 'ডোনার বুক করা হয়েছে এবং নতুন কল স্বয়ংক্রিয়ভাবে লক করা হয়েছে (টেস্ট সম্পন্ন)।'
          : 'Donor booked and new incoming calls locked (test complete).'
      );
      return;
    }
    setSaving(true);
    try {
      const otherOfferedIds = incomingPledges
        .filter(
          (p) =>
            p.requestId === bookingModalReq.id &&
            p.status === 'offered' &&
            p.id !== bookAcceptedPledgeId
        )
        .map((p) => p.id);

      await bookBloodRequestDonor({
        requestId: bookingModalReq.id,
        bookedDonorUid: bookDonorUidInput,
        bookedDonorName: bookDonorNameInput,
        bookingNote: bookNoteInput,
        acceptedPledgeId: bookAcceptedPledgeId || undefined,
        declineOtherPledgeIds: otherOfferedIds,
      });
      setBookingModalReq(null);
      await loadCommitments();
      setSuccess(
        lang === 'bn'
          ? 'ডোনার বুক করা হয়েছে এবং নতুন কল স্বয়ংক্রিয়ভাবে লক করা হয়েছে।'
          : 'Donor booked and new incoming calls locked.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'বুকিং সম্পন্ন করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleReopenRequest = async (requestId: string) => {
    setError(null);
    setSuccess(null);
    if (isDemoRecordId(requestId)) {
      setSuccess(
        lang === 'bn'
          ? 'অনুরোধটি পুনরায় ওপেন করা হয়েছে—এখন অন্য ডোনাররা কল করতে পারবেন (টেস্ট সম্পন্ন)।'
          : 'Request re-opened for donor calls (test complete).'
      );
      return;
    }
    setSaving(true);
    try {
      await reopenBookedBloodRequest(requestId);
      await loadCommitments();
      setSuccess(
        lang === 'bn'
          ? 'অনুরোধটি পুনরায় ওপেন করা হয়েছে—এখন অন্য ডোনাররা কল করতে পারবেন।'
          : 'Request re-opened for donor calls.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ওপেন করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseOwnReq = async (
    requestId: string,
    status: 'fulfilled' | 'cancelled'
  ) => {
    setError(null);
    setSuccess(null);
    if (isDemoRecordId(requestId)) {
      setSuccess(
        status === 'fulfilled'
          ? lang === 'bn'
            ? 'রক্ত সংগৃহীত হিসেবে অনুরোধটি সম্পন্ন করা হয়েছে (টেস্ট সম্পন্ন)।'
            : 'Request marked fulfilled (test complete).'
          : lang === 'bn'
          ? 'অনুরোধটি বাতিল করা হয়েছে (টেস্ট সম্পন্ন)।'
          : 'Request cancelled (test complete).'
      );
      return;
    }
    setSaving(true);
    try {
      await closeOwnBloodRequest(requestId, status);
      await loadCommitments();
      setSuccess(
        status === 'fulfilled'
          ? lang === 'bn'
            ? 'রক্ত সংগৃহীত হিসেবে অনুরোধটি সম্পন্ন করা হয়েছে।'
            : 'Request marked fulfilled.'
          : lang === 'bn'
          ? 'অনুরোধটি বাতিল করা হয়েছে।'
          : 'Request cancelled.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'আপডেট ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const handleWithdrawMyPledge = async (pledge: RequestPledge) => {
    setError(null);
    if (isDemoRecordId(pledge.id)) {
      setSuccess(
        lang === 'bn'
          ? 'প্রতিশ্রুতি সফলভাবে প্রত্যাহার করা হয়েছে (টেস্ট সম্পন্ন)।'
          : 'Pledge withdrawn (test complete).'
      );
      return;
    }
    setSaving(true);
    try {
      await withdrawRequestPledge(pledge);
      await loadCommitments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'প্রত্যাহার করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await updateUserProfileFields({
        uid: firebaseUser.uid,
        fullName,
        preferredLanguage,
        hasDonorProfile: Boolean(ownDonor),
      });
      setLang(preferredLanguage);
      await refreshOwnProfileAndDonor();
      setSuccess(
        lang === 'bn'
          ? 'অ্যাকাউন্ট তথ্য সংরক্ষিত হয়েছে।'
          : 'Account settings saved.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'সংরক্ষণ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setError(null);
    setSaving(true);
    try {
      await deactivateOwnAccount(firebaseUser.uid, Boolean(ownDonor));
      await logout();
      onNavigate('find_donors');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'অ্যাকাউন্ট নিষ্ক্রিয় করা যায়নি।'
      );
    } finally {
      setSaving(false);
      setConfirmDeactivate(false);
    }
  };

  const shownName =
    ownDonor?.displayName ||
    userProfile?.fullName ||
    firebaseUser.displayName ||
    (lang === 'bn' ? 'আমার প্রোফাইল' : 'My Profile');
  const avatarInitial = Array.from(shownName.trim())[0] || 'র';

  const handleOpenDigitalCard = () => {
    if (ownDonor) {
      setShowOwnBadgeModal(true);
      return;
    }
    setActiveTab('donor');
    setIsEditingDonorProfile(true);
    setError(
      lang === 'bn'
        ? 'অফিসিয়াল ডিজিটাল ডোনার কার্ড তৈরি করতে অনুগ্রহ করে নিচে আপনার রক্তের গ্রুপ ও রক্তদাতা তথ্য নিবন্ধন করুন।'
        : 'Please complete your donor registration with blood group and area to issue your official Digital Donor Card.'
    );
    setTimeout(() => {
      document
        .getElementById('donor-profile-form')
        ?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  return (
    <div className="pb-12 w-full max-w-full overflow-x-hidden">
      {/* Curved Crimson Header Wave */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#C80828] via-[#B80724] to-[#99061e] text-white pt-5 pb-14 sm:pt-6 sm:pb-20 shadow-inner">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-xs backdrop-blur-xs">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold tracking-tight text-white truncate">
                {ownDonor
                  ? lang === 'bn'
                    ? 'আমার ডোনার প্রোফাইল ও ডায়েরি'
                    : 'My Donor Profile & Diary'
                  : lang === 'bn'
                  ? 'আমার প্রোফাইল ও ড্যাশবোর্ড'
                  : 'My Profile & Dashboard'}
              </h1>
              <p className="text-xs text-white/80 hidden sm:block truncate">
                {lang === 'bn'
                  ? 'রক্তদেই প্ল্যাটফর্মে আপনার প্রোফাইল তথ্য, নিরাপত্তা ও রক্তদান পরিচালনা'
                  : 'Manage your profile info, security & blood donations'}
              </p>
            </div>
          </div>

          {/* EXACTLY ONE SINGLE LOGOUT BUTTON - In top header with 10-second countdown confirmation */}
          <button
            type="button"
            onClick={handleOpenLogoutModal}
            className="min-h-[38px] sm:min-h-[42px] px-3 sm:px-4 py-1.5 sm:py-2 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/25 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer transition-all shadow-xs backdrop-blur-xs shrink-0"
            title={lang === 'bn' ? 'অ্যাকাউন্ট থেকে লগআউট করুন' : 'Sign out of your account'}
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{lang === 'bn' ? 'লগআউট' : 'Logout'}</span>
          </button>
        </div>

        <svg
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute bottom-0 left-0 w-full h-8 sm:h-14 text-[#FAF8F9]"
        >
          <path
            fill="currentColor"
            d="M0,20 C420,95 1020,95 1440,20 L1440,90 L0,90 Z"
          />
        </svg>
      </div>

      {/* Structured Profile Identity Card */}
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 -mt-10 sm:-mt-14 relative z-10 space-y-5 sm:space-y-6">
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-neutral-200/90 shadow-md p-4 sm:p-8 space-y-5 sm:space-y-6">
          {/* Top Identity Row */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-5 pb-5 sm:pb-6 border-b border-neutral-100">
            <div className="flex items-center sm:items-start gap-3.5 sm:gap-4 text-left w-full sm:w-auto min-w-0">
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl bg-[#FDF2F4] border-2 sm:border-4 border-white shadow-md flex items-center justify-center overflow-hidden relative shrink-0">
                {firebaseUser.photoURL && !avatarBroken ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={shownName}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarBroken(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#C80828]">
                    {avatarInitial}
                  </span>
                )}
                {ownDonor && (
                  <span className="absolute bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 px-1.5 py-0.5 bg-[#C80828] text-white text-[10px] sm:text-[11px] font-extrabold font-mono rounded-md sm:rounded-lg border sm:border-2 border-white shadow-xs">
                    {ownDonor.bloodGroup}
                  </span>
                )}
              </div>

              <div className="space-y-1 sm:space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                  <h2 className="text-base sm:text-2xl font-extrabold text-[#1F242D] tracking-tight truncate">
                    {shownName}
                  </h2>

                  {adminRole === 'admin' ? (
                    <span className="px-2 py-0.5 bg-red-100 text-[#C80828] text-[11px] sm:text-xs font-bold rounded-lg border border-red-200 inline-flex items-center gap-1">
                      <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>{lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}</span>
                    </span>
                  ) : adminRole === 'moderator' ? (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] sm:text-xs font-bold rounded-lg border border-emerald-200 inline-flex items-center gap-1">
                      <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>{lang === 'bn' ? 'মডারেটর' : 'Moderator'}</span>
                    </span>
                  ) : ownDonor ? (
                    <span className="px-2 py-0.5 bg-rose-50 text-[#C80828] text-[11px] sm:text-xs font-bold rounded-lg border border-rose-200 inline-flex items-center gap-1">
                      <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>{lang === 'bn' ? 'রক্তদাতা' : 'Donor'}</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 text-[11px] sm:text-xs font-semibold rounded-lg inline-flex items-center gap-1 border border-neutral-200">
                      <User className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>{lang === 'bn' ? 'সদস্য' : 'Member'}</span>
                    </span>
                  )}
                </div>

                {/* Professional Identity Sub-bar: @username · Email · Verified */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-600">
                  <span className="font-mono font-bold text-xs sm:text-sm text-[#C80828] bg-[#FAF8F9] px-1.5 sm:px-2 py-0.5 rounded-md border border-neutral-200/80">
                    @{currentUsername}
                  </span>
                  <span className="text-neutral-300">·</span>
                  <span className="truncate max-w-[140px] sm:max-w-none text-neutral-600">
                    {firebaseUser.email || (lang === 'bn' ? 'ইমেইল নেই' : 'No email')}
                  </span>
                  <span className="text-neutral-300">·</span>
                  {isEmailVerified ? (
                    <span className="text-emerald-700 font-semibold inline-flex items-center gap-1 text-[11px] sm:text-xs">
                      <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" />
                      <span>{lang === 'bn' ? 'যাচাইকৃত' : 'Verified'}</span>
                    </span>
                  ) : (
                    <span className="text-amber-700 font-medium inline-flex items-center gap-1 text-[11px] sm:text-xs">
                      <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />
                      <span>{lang === 'bn' ? 'যাচাই বাকি' : 'Unverified'}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Cluster: Digital Donor Card, Edit Profile & Donor Controls */}
            <div className="w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full">
                {/* 1. Digital Donor Card Button: Full-width high-prestige banner on mobile, sleek button on desktop */}
                <button
                  type="button"
                  onClick={handleOpenDigitalCard}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-[#C80828] via-[#B80724] to-[#99061E] hover:from-[#a3051e] hover:to-[#800015] active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm ring-2 ring-[#C80828]/25"
                  title={
                    ownDonor
                      ? lang === 'bn'
                        ? 'আপনার ডিজিটাল ডোনার কার্ড ও স্বীকৃতি ব্যাজ দেখুন'
                        : 'View your digital donor card'
                      : lang === 'bn'
                      ? 'ডিজিটাল কার্ড পেতে রক্তদাতা হিসেবে নিবন্ধন করুন'
                      : 'Enroll as donor to issue digital card'
                  }
                >
                  <Award className="w-4 h-4 text-amber-300 shrink-0" />
                  <span className="whitespace-nowrap font-bold tracking-tight">
                    {ownDonor
                      ? lang === 'bn'
                        ? 'ডিজিটাল ডোনার কার্ড ও ব্যাজ'
                        : 'Digital Donor Card & Badge'
                      : lang === 'bn'
                      ? 'ডোনার কার্ড পেতে নিবন্ধন করুন'
                      : 'Enroll for Donor Card'}
                  </span>
                </button>

                {/* 2 & 3. Sub-row on mobile: 2 equal-width columns side by side */}
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleOpenEditIdentityModal}
                    className="w-full sm:w-auto min-h-[44px] px-3.5 sm:px-4 py-2 bg-white hover:bg-[#FDF2F4] text-neutral-800 hover:text-[#C80828] border border-neutral-200 hover:border-[#C80828] text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                    title={lang === 'bn' ? 'নাম ও ইউনিক ইউজারনেম পরিবর্তন করুন' : 'Edit name & username'}
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#C80828] shrink-0" />
                    <span className="truncate">{lang === 'bn' ? 'প্রোফাইল সম্পাদনা' : 'Edit Profile'}</span>
                  </button>

                  {ownDonor ? (
                    <div className="w-full sm:w-auto inline-flex items-center p-1 bg-[#FAF8F9] border border-neutral-200/90 rounded-xl gap-1 justify-center min-h-[44px]">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleQuickAvailability('available')}
                        className={`flex-1 sm:flex-initial min-h-[36px] px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          availability === 'available'
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'text-neutral-700 hover:text-emerald-700 hover:bg-white'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            availability === 'available'
                              ? 'bg-white animate-pulse'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <span className="whitespace-nowrap text-[11px] sm:text-xs">{lang === 'bn' ? 'প্রস্তুত' : 'Available'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          handleQuickAvailability('temporarily_unavailable')
                        }
                        className={`flex-1 sm:flex-initial min-h-[36px] px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          availability === 'temporarily_unavailable'
                            ? 'bg-[#C80828] text-white shadow-xs'
                            : 'text-neutral-700 hover:text-[#C80828] hover:bg-white'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            availability === 'temporarily_unavailable'
                              ? 'bg-white'
                              : 'bg-[#C80828]'
                          }`}
                        />
                        <span className="whitespace-nowrap text-[11px] sm:text-xs">{lang === 'bn' ? 'বিরতি' : 'Pause'}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('donor');
                        setIsEditingDonorProfile(true);
                        setTimeout(() => {
                          document
                            .getElementById('donor-profile-form')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }, 50);
                      }}
                      className="w-full sm:w-auto min-h-[44px] px-3.5 sm:px-4 py-2 bg-[#FDF2F4] hover:bg-[#FADCE2] text-[#C80828] border border-[#F7D4DC] text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-[#C80828] shrink-0" />
                      <span className="truncate">{lang === 'bn' ? '+ ডোনার নিবন্ধন' : '+ Register'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Structured 4-Box Information Matrix (2 columns on mobile, 4 on desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* Box 1: Email */}
            <div className="bg-[#FAF8F9] rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-neutral-200/80 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-neutral-500 truncate">
                  {lang === 'bn' ? 'ইমেইল' : 'Email'}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#1F242D] truncate" title={firebaseUser.email || ''}>
                {firebaseUser.email || (lang === 'bn' ? 'ইমেইল নেই' : 'No email')}
              </p>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 mt-0.5 sm:mt-1 truncate">
                {lang === 'bn' ? 'লগইনে ব্যবহৃত' : 'Login identity'}
              </span>
            </div>

            {/* Box 2: Phone */}
            <div className="bg-[#FAF8F9] rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-neutral-200/80 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-neutral-500 truncate">
                  {lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone'}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-mono font-bold text-[#1F242D] truncate">
                {ownDonorPhone || (lang === 'bn' ? 'যুক্ত করা হয়নি' : 'Not added')}
              </p>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 mt-0.5 sm:mt-1 truncate">
                {ownDonorPhone
                  ? lang === 'bn'
                    ? '🔒 সুরক্ষিত নম্বর'
                    : '🔒 Protected'
                  : lang === 'bn'
                  ? 'ডোনার ফর্মে দিন'
                  : 'Add in form'}
              </span>
            </div>

            {/* Box 3: Blood Group & Location */}
            <div className="bg-[#FAF8F9] rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-neutral-200/80 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-rose-100 text-[#C80828] flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-neutral-500 truncate">
                  {lang === 'bn' ? 'গ্রুপ ও এলাকা' : 'Group & Area'}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#1F242D] truncate">
                {ownDonor
                  ? `${ownDonor.bloodGroup} · ${formatLocationLabel(
                      ownDonor.divisionId,
                      ownDonor.districtId,
                      ownDonor.upazilaId,
                      lang
                    )}`
                  : lang === 'bn'
                  ? 'অনিবন্ধিত'
                  : 'Not enrolled'}
              </p>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 mt-0.5 sm:mt-1 truncate">
                {ownDonor
                  ? lang === 'bn'
                    ? 'সার্চের এলাকা'
                    : 'Search area'
                  : lang === 'bn'
                  ? 'গ্রুপ নির্ধারণ করুন'
                  : 'Set group'}
              </span>
            </div>

            {/* Box 4: Membership Status */}
            <div className="bg-[#FAF8F9] rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-neutral-200/80 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-neutral-500 truncate">
                  {lang === 'bn' ? 'অ্যাকাউন্ট' : 'Account'}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#1F242D] truncate">
                {ownDonor
                  ? lang === 'bn'
                    ? 'রক্তদাতা'
                    : 'Donor'
                  : lang === 'bn'
                  ? 'সাধারণ সদস্য'
                  : 'Member'}
              </p>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 mt-0.5 sm:mt-1 truncate">
                {isEmailVerified
                  ? lang === 'bn'
                    ? '✓ সক্রিয় ও সুরক্ষিত'
                    : '✓ Secured'
                  : lang === 'bn'
                  ? 'যাচাই বাকি'
                  : 'Unverified'}
              </span>
            </div>
          </div>

          {/* Conditional Contextual Ribbon */}
          {!ownDonor ? (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 via-[#FDF2F4] to-red-50 border border-rose-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C80828] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Heart className="w-5 h-5 fill-white" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">
                    {lang === 'bn'
                      ? 'আপনি এখনো রক্তদাতা হিসেবে তালিকাভুক্ত হননি'
                      : 'You are not enrolled as a donor yet'}
                  </h4>
                  <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
                    {lang === 'bn'
                      ? 'আপনার রক্তের গ্রুপ ও এলাকা যুক্ত করে রক্তদাতা হন। মুমূর্ষু রোগীর জীবন বাঁচাতে আপনার মাত্র এক ব্যাগ রক্তই যথেষ্ট।'
                      : 'Add your blood group and location to join our voluntary donor network.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('donor');
                  setIsEditingDonorProfile(true);
                  setTimeout(() => {
                    document
                      .getElementById('donor-profile-form')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                }}
                className="min-h-[40px] px-4 py-2 bg-[#C80828] hover:bg-[#A3051E] text-white text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer shadow-xs inline-flex items-center gap-2 shrink-0 transition-colors"
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  {lang === 'bn'
                    ? 'ডোনার তথ্য পূরণ করুন'
                    : 'Complete Donor Form'}
                </span>
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    availability === 'available'
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-amber-500'
                  }`}
                />
                <span className="text-neutral-700">
                  <span className="font-bold text-neutral-900">
                    {lang === 'bn' ? 'বর্তমান স্ট্যাটাস:' : 'Current Status:'}
                  </span>{' '}
                  <span
                    className={
                      availability === 'available'
                        ? 'text-emerald-700 font-semibold'
                        : 'text-amber-700 font-semibold'
                    }
                  >
                    {availabilityLabel(availability, lang)}
                  </span>
                  {' — '}
                  <span className="text-neutral-500">
                    {availability === 'available'
                      ? lang === 'bn'
                        ? 'রোগীর স্বজনরা আপনাকে সরাসরি সার্চে দেখতে পাবেন।'
                        : 'Visible in blood search.'
                      : lang === 'bn'
                      ? 'কল বিরতি থাকায় নতুন অনুরোধের তালিকায় আপনার নম্বর সাময়িক গোপন থাকবে।'
                      : 'Calls paused.'}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>

        {userProfile && userProfile.accountStatus !== 'active' && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-900 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-[#C80828] shrink-0 mt-0.5" />
            <span>
              {lang === 'bn'
                ? `আপনার অ্যাকাউন্টটির বর্তমান অবস্থা: ${userProfile.accountStatus}। নতুন তথ্য সম্পাদনা বা ডোনার লিস্টিং বন্ধ রয়েছে।`
                : `Your account is currently ${userProfile.accountStatus}.`}
            </span>
          </div>
        )}

        {!isEmailVerified ? (
          <div className="bg-white rounded-3xl border border-amber-200 p-8 text-center space-y-2">
            <h3 className="text-lg font-bold text-[#1F242D]">
              {lang === 'bn'
                ? 'প্রোফাইল ও রক্তদাতা সেটিংস চালু করতে আগে ইমেইল ভেরিফাই করুন'
                : 'Verify your email to configure your profile and donor listing'}
            </h3>
            <p className="text-sm text-neutral-600">
              {lang === 'bn'
                ? 'উপরের হলুদ ব্যানার থেকে ইমেইল যাচাই সম্পন্ন করুন।'
                : 'Use the banner at the top of the page to verify and refresh.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <DemoPreviewBanner />

            {demoMode && (
              <div className="bg-[#FAF8F9] rounded-2xl border border-neutral-200/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start sm:items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#C80828] shrink-0 mt-0.5 sm:mt-0" />
                  <div className="text-xs text-neutral-800 leading-relaxed">
                    <span className="font-bold text-[#1F242D]">
                      {lang === 'bn' ? 'প্রোফাইল টেস্ট ডেটা:' : 'Profile Test Data:'}
                    </span>{' '}
                    <span>
                      {demoProfileLoaded
                        ? lang === 'bn'
                          ? 'আপনার প্রোফাইলে ৪টি রক্তদান ইতিহাস, ওজনের তথ্য ও ১টি বুকড রিকোয়েস্ট টেস্টের জন্য সক্রিয় রয়েছে।'
                          : 'Sample donor profile and 4 donation logs are loaded for QA testing.'
                        : lang === 'bn'
                        ? 'নমুনা তথ্য লোড করে প্রোফাইলের ৪টি সামারি ও লগবই সরাসরি পরীক্ষা করতে পারেন।'
                        : 'Load sample data to test profile metrics and donation history.'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {demoProfileLoaded ? (
                    <button
                      type="button"
                      onClick={handleClearDemoProfileData}
                      className="min-h-[36px] px-3.5 py-1.5 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{lang === 'bn' ? 'টেস্ট ডেটা মুছুন' : 'Clear Test Data'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLoadDemoProfileData}
                      className="min-h-[36px] px-3.5 py-1.5 bg-[#C80828] hover:bg-[#A3051E] text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'টেস্ট ডেটা লোড করুন' : 'Load Test Data'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 4-Column Donor Impact & Readiness Summary Strip */}
            <div className="bg-white rounded-3xl border border-neutral-200/80 p-5 sm:p-6 grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
              <div className="space-y-1">
                <div className="text-xs text-neutral-500">
                  {lang === 'bn' ? 'মোট রক্তদান করেছেন' : 'Total Donations'}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-[#1F242D]">
                  {effectiveTotalDonations}{' '}
                  <span className="text-sm font-semibold text-neutral-600">
                    {lang === 'bn' ? 'বার' : 'times'}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500 tabular-nums">
                  {lang === 'bn'
                    ? `লগবইয়ে যুক্ত: ${loggedDonationsCount}টি রেকর্ড`
                    : `${loggedDonationsCount} detailed logs`}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-neutral-500">
                  {lang === 'bn' ? 'মোট রক্তের পরিমাণ' : 'Total Volume Given'}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-[#C80828]">
                  {effectiveTotalVolumeMl}{' '}
                  <span className="text-sm font-semibold">ml</span>
                </div>
                <div className="text-[11px] text-neutral-500 tabular-nums">
                  {lang === 'bn'
                    ? `প্রায় ${Math.max(
                        effectiveTotalDonations,
                        Math.round(effectiveTotalVolumeMl / 450)
                      )} ব্যাগ সমপরিমাণ`
                    : `Approx. ${Math.max(
                        effectiveTotalDonations,
                        Math.round(effectiveTotalVolumeMl / 450)
                      )} standard units`}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-neutral-500">
                  {lang === 'bn' ? 'সর্বশেষ রক্তদান' : 'Last Donation'}
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#1F242D]">
                  {effectiveLatestDate ||
                    (lang === 'bn' ? 'উল্লেখ নেই' : 'Not recorded')}
                </div>
                <div className="text-[11px] text-neutral-600 tabular-nums">
                  {daysSinceLast === null
                    ? lang === 'bn'
                      ? 'রক্তদানের ইতিহাসে তারিখ যোগ করুন'
                      : 'Add dates in Donation History'
                    : restWindowDaysLeft > 0
                    ? lang === 'bn'
                      ? `${daysSinceLast} দিন আগে · সাধারণ বিশ্রামকাল বাকি ~${restWindowDaysLeft} দিন`
                      : `${daysSinceLast}d ago · ~${restWindowDaysLeft}d rest remaining`
                    : lang === 'bn'
                    ? `${daysSinceLast} দিন আগে · ৯০+ দিন পূর্ণ হয়েছে`
                    : `${daysSinceLast}d ago · 90+ days elapsed`}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs text-neutral-500">
                  {lang === 'bn' ? 'বর্তমান প্রাপ্যতা ও কল নিয়ন্ত্রণ' : 'Current Status'}
                </div>
                <div className="text-sm font-bold text-[#1F242D]">
                  {ownDonor
                    ? availabilityLabel(availability, lang)
                    : lang === 'bn'
                    ? 'এখনো ডোনার তালিকাভুক্ত হননি'
                    : 'Not enrolled yet'}
                </div>
                {ownDonor ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {availability !== 'available' && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleQuickAvailability('available')}
                        className="min-h-[36px] px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold rounded-lg whitespace-nowrap cursor-pointer"
                      >
                        {lang === 'bn' ? 'প্রস্তুত করুন' : 'Mark Available'}
                      </button>
                    )}
                    {availability !== 'temporarily_unavailable' && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          handleQuickAvailability('temporarily_unavailable')
                        }
                        className="min-h-[36px] px-3 py-1 bg-[#FDF2F4] hover:bg-[#FADCE2] text-[#8F1D30] text-[11px] font-semibold rounded-lg whitespace-nowrap cursor-pointer"
                      >
                        {lang === 'bn' ? 'কল বিরতি / বিশ্রাম' : 'Pause Calls'}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-500">
                    {lang === 'bn'
                      ? 'নিচের ফর্ম পূরণ করে যুক্ত হোন'
                      : 'Complete donor form below'}
                  </p>
                )}
              </div>
            </div>

            {/* 4 Clean Segmented Navigation Tabs (Smooth mobile-friendly edge scroll) */}
            <div className="w-full overflow-x-auto pb-2 no-scrollbar">
              <div className="inline-flex p-1 bg-[#FDF2F4] border border-[#F7D4DC] rounded-2xl min-w-max sm:mx-auto">
                {(
                  [
                    [
                      'donor',
                      lang === 'bn' ? 'ডোনার প্রোফাইল' : 'Donor Profile',
                    ],
                    [
                      'history',
                      lang === 'bn'
                        ? `রক্তদানের ইতিহাস (${loggedDonationsCount})`
                        : `Donation History (${loggedDonationsCount})`,
                    ],
                    [
                      'commitments',
                      lang === 'bn'
                        ? 'অনুরোধ ও বুকিং'
                        : 'Requests & Bookings',
                    ],
                    [
                      'account',
                      lang === 'bn'
                        ? 'অ্যাকাউন্ট ও রিপোর্ট'
                        : 'Account & Safety',
                    ],
                  ] as const
                ).map(([tabKey, tabLabel]) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => {
                      setActiveTab(tabKey);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={`min-h-[40px] sm:min-h-[44px] px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      activeTab === tabKey
                        ? 'bg-[#C80828] text-white shadow-xs font-bold'
                        : 'text-[#8F1D30] hover:text-[#C80828]'
                    }`}
                  >
                    {tabLabel}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-900"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                role="status"
                className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900"
              >
                {success}
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 1: CATEGORIZED DONOR PROFILE (VIEW MODE & EDIT MODE)       */}
            {/* ============================================================== */}
            {activeTab === 'donor' && !isEditingDonorProfile && (
              <div
                id="donor-profile-overview"
                className="bg-white rounded-2xl sm:rounded-3xl border border-neutral-200/80 p-4 sm:p-8 space-y-5 sm:space-y-7 shadow-xs"
              >
                {/* Header & Quick Edit Trigger */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg sm:text-xl font-bold text-[#1F242D]">
                        {lang === 'bn'
                          ? 'রক্তদাতা ও ব্যক্তিগত তথ্যাবলী'
                          : 'Donor & Personal Information'}
                      </h3>
                      {ownDonor && (
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200">
                          {lang === 'bn' ? 'সংরক্ষিত' : 'Saved'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {lang === 'bn'
                        ? 'আপনার সকল ব্যক্তিগত ও রক্তদানের তথ্য ৪টি ক্যাটাগরিতে সুরক্ষিতভাবে সাজানো রয়েছে।'
                        : 'Your personal and donation details are categorized securely below.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEditingDonorProfile(true)}
                    className="min-h-[42px] px-5 py-2.5 bg-[#C80828] hover:bg-[#A3051E] active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs shrink-0"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>
                      {ownDonor
                        ? lang === 'bn'
                          ? 'তথ্য সম্পাদনা করুন'
                          : 'Edit Information'
                        : lang === 'bn'
                        ? 'রক্তদাতা ফর্ম পূরণ করুন'
                        : 'Fill Donor Form'}
                    </span>
                  </button>
                </div>

                {/* Digital Recognition Card & Tier Showcase */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#FDF2F4] via-[#FADCE2] to-[#F7D4DC] border border-[#F7D4DC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-white text-[#C80828] border border-[#F7D4DC] flex items-center justify-center text-2xl shadow-xs shrink-0">
                      {ownDonor
                        ? getDonorTier(ownDonor.totalDonationsCount || 0).icon
                        : '🩸'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm sm:text-base text-[#1F242D]">
                          {ownDonor
                            ? lang === 'bn'
                              ? `ডিজিটাল স্বীকৃতি কার্ড: ${getDonorTier(ownDonor.totalDonationsCount || 0).nameBn}`
                              : `Digital Donor Card: ${getDonorTier(ownDonor.totalDonationsCount || 0).nameEn}`
                            : lang === 'bn'
                            ? 'অফিসিয়াল ডিজিটাল ডোনার কার্ড'
                            : 'Official Digital Donor Card'}
                        </span>
                        <span className="text-[11px] font-semibold text-[#8F1D30] bg-white/80 px-2 py-0.5 rounded-md border border-[#F7D4DC]">
                          {ownDonor
                            ? lang === 'bn'
                              ? `${ownDonor.totalDonationsCount || 0} বার রক্তদান`
                              : `${ownDonor.totalDonationsCount || 0} Donations`
                            : lang === 'bn'
                            ? 'ডোনার নিবন্ধন প্রয়োজন'
                            : 'Registration Required'}
                        </span>
                      </div>
                      <p className="text-xs text-[#8F1D30]/80 mt-0.5">
                        {ownDonor
                          ? lang === 'bn'
                            ? 'শুধুমাত্র আপনার প্রোফাইলে সংরক্ষিত — চাইলে তথ্য কাস্টমাইজ ও শেয়ার করুন'
                            : 'Private to your profile — customize fields & share anytime'
                          : lang === 'bn'
                          ? 'প্রথমে আপনার রক্তের গ্রুপ ও এলাকা যুক্ত করলে অফিসিয়াল ডিজিটাল কার্ড তৈরি হবে'
                          : 'Add your blood group and area first to issue your verified digital card'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenDigitalCard}
                    className="min-h-[42px] px-4 py-2 bg-[#C80828] hover:bg-[#A3051E] active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs shrink-0"
                  >
                    <Award className="w-4 h-4" />
                    <span>
                      {ownDonor
                        ? lang === 'bn'
                          ? 'ডিজিটাল কার্ড দেখুন ও ডাউনলোড'
                          : 'View Digital Card'
                        : lang === 'bn'
                        ? 'এখনই নিবন্ধন করুন'
                        : 'Enroll Now'}
                    </span>
                  </button>
                </div>

                {/* 4 Categorized Sections */}
                <div className="space-y-6">
                  {/* Category 1: Personal & Identity */}
                  <div className="rounded-2xl border border-neutral-200/90 overflow-hidden bg-neutral-50/50">
                    <div className="px-5 py-3.5 bg-neutral-100/70 border-b border-neutral-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                          <User className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-[#1F242D]">
                          {lang === 'bn'
                            ? '০১. ব্যক্তিগত ও পরিচিতি তথ্য'
                            : '01. Personal & Identity Details'}
                        </h4>
                      </div>
                      <span className="text-[11px] font-medium text-neutral-500">
                        {lang === 'bn' ? 'সাধারণ তথ্য' : 'Basic info'}
                      </span>
                    </div>

                    <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
                        </span>
                        <p className="font-bold text-[#1F242D] mt-0.5 text-sm">
                          {displayName || shownName}
                        </p>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'ইউনিক ইউজারনেম' : 'Unique Username'}
                        </span>
                        <p className="font-mono font-bold text-[#C80828] mt-0.5 text-sm">
                          @{currentUsername}
                        </p>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'ইমেইল ঠিকানা' : 'Email Address'}
                        </span>
                        <p className="font-semibold text-neutral-800 mt-0.5 truncate" title={firebaseUser.email || ''}>
                          {firebaseUser.email}
                        </p>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'লিঙ্গ' : 'Gender'}
                        </span>
                        <p className="font-semibold text-neutral-800 mt-0.5">
                          {genderLabel(gender, lang)}
                        </p>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'বয়স' : 'Age'}
                        </span>
                        <p className="font-semibold text-neutral-800 mt-0.5">
                          {ageYears > 0 ? (lang === 'bn' ? `${ageYears} বছর` : `${ageYears} years`) : (lang === 'bn' ? 'দেওয়া হয়নি' : 'Not set')}
                        </p>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'ওজন' : 'Weight'}
                        </span>
                        <p className="font-semibold text-neutral-800 mt-0.5">
                          {weightKg > 0 ? `${weightKg} kg` : (lang === 'bn' ? 'দেওয়া হয়নি' : 'Not set')}
                        </p>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'পেশা / প্রতিষ্ঠান' : 'Occupation'}
                        </span>
                        <p className="font-semibold text-neutral-800 mt-0.5">
                          {occupation || (lang === 'bn' ? 'দেওয়া হয়নি' : 'Not specified')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Category 2: Blood Donation & Health Details */}
                  <div className="rounded-2xl border border-neutral-200/90 overflow-hidden bg-neutral-50/50">
                    <div className="px-5 py-3.5 bg-rose-50/70 border-b border-rose-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-rose-100 text-[#C80828] flex items-center justify-center">
                          <Droplets className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-[#1F242D]">
                          {lang === 'bn'
                            ? '০২. রক্তদান ও স্বাস্থ্যগত তথ্য'
                            : '02. Blood Donation & Health Details'}
                        </h4>
                      </div>
                      <span className="text-[11px] font-medium text-neutral-500">
                        {lang === 'bn' ? 'রক্তের গ্রুপ ও ইতিহাস' : 'Blood stats'}
                      </span>
                    </div>

                    <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'রক্তের গ্রুপ' : 'Blood Group'}
                        </span>
                        <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 bg-[#C80828] text-white font-mono font-extrabold rounded-lg text-sm shadow-xs">
                          <Droplets className="w-3.5 h-3.5 fill-white" />
                          <span>{bloodGroup}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'রক্তদানের ধরন' : 'Donation Preference'}
                        </span>
                        <p className="font-semibold text-neutral-800 mt-1">
                          {donationPreferenceLabel(donationPreference, lang)}
                        </p>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'সর্বশেষ রক্তদানের তারিখ' : 'Last Donation Date'}
                        </span>
                        <p className="font-semibold text-neutral-800 mt-1">
                          {effectiveLatestDate
                            ? `${effectiveLatestDate} ${daysSinceLast !== null ? `(${daysSinceLast} দিন আগে)` : ''}`
                            : (lang === 'bn' ? 'তথ্য নেই' : 'None')}
                        </p>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'মোট রক্তদান' : 'Lifetime Donations'}
                        </span>
                        <p className="font-mono font-bold text-[#1F242D] mt-0.5 text-sm">
                          {effectiveTotalDonations} {lang === 'bn' ? 'বার' : 'times'}
                        </p>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'মোট রক্তের পরিমাণ' : 'Total Volume'}
                        </span>
                        <p className="font-mono font-bold text-[#C80828] mt-0.5 text-sm">
                          {effectiveTotalVolumeMl} ml
                        </p>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'বর্তমান প্রাপ্যতা স্ট্যাটাস' : 'Availability Status'}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold mt-1 ${
                          availability === 'available'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${availability === 'available' ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`} />
                          <span>{availabilityLabel(availability, lang)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Category 3: Location & Hospital Area */}
                  <div className="rounded-2xl border border-neutral-200/90 overflow-hidden bg-neutral-50/50">
                    <div className="px-5 py-3.5 bg-neutral-100/70 border-b border-neutral-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-[#1F242D]">
                          {lang === 'bn'
                            ? '০৩. এলাকা ও হাসপাতাল অবস্থান'
                            : '03. Location & Reachable Hospitals'}
                        </h4>
                      </div>
                      <span className="text-[11px] font-medium text-neutral-500">
                        {lang === 'bn' ? 'ঠিকানা ও কাভারেজ' : 'Location info'}
                      </span>
                    </div>

                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'বর্তমান এলাকা (বিভাগ, জেলা, উপজেলা)' : 'Location'}
                        </span>
                        <p className="font-bold text-[#1F242D] mt-0.5 text-sm">
                          {formatLocationLabel(divisionId, districtId, upazilaId, lang)}
                        </p>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'পছন্দের হাসপাতাল বা নিকটস্থ এলাকা' : 'Preferred Hospital Area'}
                        </span>
                        <p className="font-semibold text-neutral-800 mt-0.5">
                          {preferredHospitalArea || (lang === 'bn' ? 'যেকোনো নিকটস্থ হাসপাতাল' : 'Any hospital')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Category 4: Contact & Privacy Controls */}
                  <div className="rounded-2xl border border-neutral-200/90 overflow-hidden bg-neutral-50/50">
                    <div className="px-5 py-3.5 bg-neutral-100/70 border-b border-neutral-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-[#1F242D]">
                          {lang === 'bn'
                            ? '০৪. যোগাযোগ ও গোপনীয়তা নিয়ন্ত্রণ'
                            : '04. Contact & Privacy Controls'}
                        </h4>
                      </div>
                      <span className="text-[11px] font-medium text-neutral-500">
                        {lang === 'bn' ? 'কল ও অনুমতি' : 'Privacy settings'}
                      </span>
                    </div>

                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono font-bold text-sm text-[#1F242D]">
                            {rawPhone || ownDonorPhone || (lang === 'bn' ? 'যুক্ত করা হয়নি' : 'Not added')}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-md border border-emerald-200">
                            {lang === 'bn' ? '🔒 সুরক্ষিত' : '🔒 Protected'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'অনুমোদিত যোগাযোগের মাধ্যমসমূহ' : 'Allowed Contact Channels'}
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {contactMethods.map((m) => (
                            <span key={m} className="px-2.5 py-0.5 bg-neutral-200 text-neutral-800 text-[11px] font-semibold rounded-md">
                              {contactMethodLabel(m, lang)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'রাতের জরুরি কলের নীতিমালা' : 'Night Call Preference'}
                        </span>
                        <p className="font-semibold text-neutral-800 mt-0.5">
                          {nightCallPreferenceLabel(nightCallPreference, lang)}
                        </p>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'পাবলিক সার্চ লিস্টিং স্ট্যাটাস' : 'Search Listing Status'}
                        </span>
                        <p className="font-semibold text-neutral-800 mt-0.5">
                          {isListed
                            ? (lang === 'bn' ? '🟢 সার্চ তালিকায় সক্রিয় রয়েছে' : '🟢 Visible in search')
                            : (lang === 'bn' ? '⏸️ সার্চ তালিকায় লুকানো রয়েছে' : '⏸️ Hidden from search')}
                        </p>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-neutral-500 block text-[11px] font-semibold">
                          {lang === 'bn' ? 'রক্তদাতার বিশেষ নোট' : 'Donor Note'}
                        </span>
                        <p className="text-neutral-700 mt-0.5 italic">
                          {donorNote || (lang === 'bn' ? 'কোনো বিশেষ নির্দেশনা দেওয়া নেই।' : 'No note provided.')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Trigger */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingDonorProfile(true);
                      setTimeout(() => {
                        document.getElementById('donor-profile-form')?.scrollIntoView({ behavior: 'smooth' });
                      }, 50);
                    }}
                    className="min-h-[44px] px-6 py-2.5 bg-neutral-100 hover:bg-[#FDF2F4] text-neutral-800 hover:text-[#C80828] border border-neutral-200 hover:border-[#F7D4DC] text-xs sm:text-sm font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                  >
                    <Edit2 className="w-4 h-4 text-[#C80828]" />
                    <span>{lang === 'bn' ? 'তথ্য পরিবর্তন / এডিট করুন' : 'Edit Information'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* EDIT MODE: OPEN FORM */}
            {activeTab === 'donor' && isEditingDonorProfile && (
              <form
                id="donor-profile-form"
                onSubmit={handleSaveDonor}
                className="bg-white rounded-2xl sm:rounded-3xl border-2 border-[#C80828]/25 p-4 sm:p-8 space-y-6 sm:space-y-8 shadow-md"
              >
                {/* Header & Quick Save / Cancel bar in Edit Mode */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-100 bg-[#FDF2F4] -m-4 sm:-m-8 p-4 sm:p-8 rounded-t-2xl sm:rounded-t-3xl mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-[#C80828] text-white text-xs font-bold rounded-lg shadow-xs">
                        {lang === 'bn' ? 'এডিট মোড' : 'Edit Mode'}
                      </span>
                      <h3 className="text-lg font-bold text-[#1F242D]">
                        {ownDonor
                          ? lang === 'bn'
                            ? 'রক্তদাতা ও ব্যক্তিগত তথ্য সম্পাদনা'
                            : 'Edit Donor & Personal Profile'
                          : lang === 'bn'
                          ? 'স্বেচ্ছায় রক্তদাতা হিসেবে নিবন্ধন করুন'
                          : 'Enroll as a Voluntary Blood Donor'}
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-600 mt-1">
                      {lang === 'bn'
                        ? 'তথ্য পরিবর্তন শেষে নিচে বা উপরে "সংরক্ষণ করুন" বাটনে চাপুন অথবা পূর্বাবস্থায় ফিরতে "বাতিল" করুন।'
                        : 'Update your details below and click Save, or Cancel to revert.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCancelDonorEdit}
                      disabled={saving}
                      className="min-h-[42px] px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 text-xs sm:text-sm font-semibold rounded-xl cursor-pointer transition-colors shadow-xs"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="min-h-[42px] px-5 py-2 bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-60 text-white text-xs sm:text-sm font-bold rounded-xl cursor-pointer transition-colors shadow-xs inline-flex items-center gap-1.5"
                    >
                      {saving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>
                        {saving
                          ? lang === 'bn'
                            ? 'সংরক্ষণ হচ্ছে...'
                            : 'Saving...'
                          : lang === 'bn'
                          ? 'সংরক্ষণ করুন'
                          : 'Save Changes'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Master Listing Switch in Edit Mode */}
                <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                  <div>
                    <h4 className="text-sm font-bold text-[#1F242D]">
                      {lang === 'bn' ? 'সার্চ তালিকায় সক্রিয় প্রদর্শন' : 'Active Public Listing'}
                    </h4>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {lang === 'bn'
                        ? 'এটি অন থাকলে রোগীর পরিবার সার্চে আপনার তথ্য দেখতে পারবেন।'
                        : 'When enabled, patients can discover your donor profile.'}
                    </p>
                  </div>

                  <label className="min-h-[40px] px-4 py-2 bg-white border border-neutral-200 rounded-xl inline-flex items-center gap-2 text-xs font-semibold text-[#1F242D] cursor-pointer select-none shrink-0 shadow-xs">
                    <input
                      type="checkbox"
                      checked={isListed}
                      onChange={(e) => setIsListed(e.target.checked)}
                      className="w-4 h-4 accent-[#C80828]"
                    />
                    <span>
                      {lang === 'bn'
                        ? 'সার্চে সক্রিয়'
                        : 'Active in Search'}
                    </span>
                  </label>
                </div>

                {/* Category 01 Form: Personal & Identity */}
                <div className="space-y-5 pt-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-[#1F242D]">
                      {lang === 'bn'
                        ? '০১. ব্যক্তিগত ও পরিচিতি তথ্য'
                        : '01. Personal & Identity Information'}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        {lang === 'bn' ? 'প্রদর্শনের নাম (Display Name)' : 'Display Name'}
                      </label>
                      <input
                        type="text"
                        required
                        minLength={2}
                        maxLength={80}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="আপনার পূর্ণ নাম"
                        className="w-full min-h-[46px] px-4 py-2.5 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        {lang === 'bn'
                          ? 'পেশা বা শিক্ষাপ্রতিষ্ঠান (ঐচ্ছিক)'
                          : 'Occupation / Institution (Optional)'}
                      </label>
                      <input
                        type="text"
                        maxLength={80}
                        value={occupation}
                        onChange={(e) => setOccupation(e.target.value)}
                        placeholder={
                          lang === 'bn'
                            ? 'যেমন: শিক্ষার্থী / শিক্ষক / সফটওয়্যার প্রকৌশলী'
                            : 'e.g. Student / Software Engineer'
                        }
                        className="w-full min-h-[46px] px-4 py-2.5 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        {lang === 'bn' ? 'লিঙ্গ' : 'Gender'}
                      </label>
                      <select
                        value={gender}
                        onChange={(e) =>
                          setGender(e.target.value as DonorGender)
                        }
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      >
                        {DONOR_GENDERS.map((g) => (
                          <option key={g} value={g}>
                            {genderLabel(g, lang)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        {lang === 'bn' ? 'বয়স (বছর)' : 'Age (Years)'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        value={ageYears || ''}
                        onChange={(e) =>
                          setAgeYears(Math.max(0, Number(e.target.value) || 0))
                        }
                        placeholder="যেমন: 26"
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono tabular-nums border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        {lang === 'bn' ? 'ওজন (কেজি)' : 'Weight (kg)'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        value={weightKg || ''}
                        onChange={(e) =>
                          setWeightKg(Math.max(0, Number(e.target.value) || 0))
                        }
                        placeholder="যেমন: 65"
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono tabular-nums border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      />
                    </div>
                  </div>
                </div>

                {/* Category 02 Form: Blood Donation & Health */}
                <div className="space-y-5 pt-6 border-t border-neutral-100">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                    <div className="w-7 h-7 rounded-lg bg-rose-100 text-[#C80828] flex items-center justify-center">
                      <Droplets className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-[#1F242D]">
                      {lang === 'bn'
                        ? '০২. রক্তদান ও স্বাস্থ্যগত তথ্য'
                        : '02. Blood Donation & Health Details'}
                    </h4>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-neutral-700">
                      {lang === 'bn'
                        ? 'রক্তের গ্রুপ নির্বাচন করুন *'
                        : 'Select Blood Group *'}
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                      {BLOOD_GROUPS.map((bg) => {
                        const active = bloodGroup === bg;
                        return (
                          <button
                            key={bg}
                            type="button"
                            onClick={() => setBloodGroup(bg)}
                            className={`min-h-[48px] rounded-2xl font-mono text-base font-bold transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#C80828] text-white shadow-xs'
                                : 'bg-[#FDF2F4] text-[#B00723] hover:bg-[#FADCE2]'
                            }`}
                          >
                            {bg}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        {lang === 'bn'
                          ? 'বর্তমান প্রাপ্যতা (Availability)'
                          : 'Availability'}
                      </label>
                      <select
                        value={availability}
                        onChange={(e) =>
                          setAvailability(e.target.value as AvailabilityStatus)
                        }
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      >
                        {AVAILABILITY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {availabilityLabel(opt, lang)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        {lang === 'bn'
                          ? 'সর্বশেষ রক্তদানের তারিখ'
                          : 'Last Donation Date'}
                      </label>
                      <input
                        type="date"
                        value={lastDonationDate}
                        onChange={(e) => setLastDonationDate(e.target.value)}
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        {lang === 'bn'
                          ? 'মোট কতবার রক্ত দিয়েছেন (পূর্বেরসহ)'
                          : 'Total Lifetime Donations'}
                      </label>
                      <input
                        type="number"
                        min={loggedDonationsCount}
                        max={500}
                        value={Math.max(
                          loggedDonationsCount,
                          manualDonationsCount
                        )}
                        onChange={(e) =>
                          setManualDonationsCount(
                            Math.max(
                              loggedDonationsCount,
                              Number(e.target.value) || 0
                            )
                          )
                        }
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono tabular-nums border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                      {lang === 'bn' ? 'রক্তদানের ধরন পছন্দ' : 'Donation Preference'}
                    </label>
                    <select
                      value={donationPreference}
                      onChange={(e) =>
                        setDonationPreference(
                          e.target.value as DonorDonationPreference
                        )
                      }
                      className="w-full min-h-[46px] px-3.5 py-2.5 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                    >
                      {DONATION_PREFERENCES.map((dp) => (
                        <option key={dp} value={dp}>
                          {donationPreferenceLabel(dp, lang)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Category 03 Form: Location & Reachable Hospitals */}
                <div className="space-y-5 pt-6 border-t border-neutral-100">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-[#1F242D]">
                      {lang === 'bn'
                        ? '০৩. এলাকা ও হাসপাতাল অবস্থান'
                        : '03. Location & Reachable Hospitals'}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        {lang === 'bn' ? 'বিভাগ *' : 'Division *'}
                      </label>
                      <select
                        value={divisionId}
                        onChange={(e) => {
                          const nextDiv = e.target.value;
                          setDivisionId(nextDiv);
                          const firstDist = getDistrictsByDivision(nextDiv)[0];
                          const nextDistId = firstDist?.id || '';
                          setDistrictId(nextDistId);
                          setUpazilaId(firstDist?.upazilas[0]?.id || '');
                        }}
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      >
                        {DIVISIONS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d[lang]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        {lang === 'bn' ? 'জেলা *' : 'District *'}
                      </label>
                      <select
                        value={districtId}
                        onChange={(e) => {
                          const nextDist = e.target.value;
                          setDistrictId(nextDist);
                          const firstUpz = getUpazilasByDistrict(nextDist)[0];
                          setUpazilaId(firstUpz?.id || '');
                        }}
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      >
                        {districts.map((dist) => (
                          <option key={dist.id} value={dist.id}>
                            {dist[lang]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        {lang === 'bn' ? 'উপজেলা / থানা *' : 'Upazila / Thana *'}
                      </label>
                      <select
                        value={upazilaId}
                        onChange={(e) => setUpazilaId(e.target.value)}
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      >
                        {upazilas.map((upz) => (
                          <option key={upz.id} value={upz.id}>
                            {upz[lang]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                      {lang === 'bn'
                        ? 'পছন্দের হাসপাতাল বা নিকটস্থ এলাকা (ঐচ্ছিক)'
                        : 'Preferred Hospital / Reachable Area'}
                    </label>
                    <input
                      type="text"
                      maxLength={140}
                      value={preferredHospitalArea}
                      onChange={(e) =>
                        setPreferredHospitalArea(e.target.value)
                      }
                      placeholder={
                        lang === 'bn'
                          ? 'যেমন: DMCH, BSMMU, ধানমন্ডি ও মিরপুর এলাকা'
                          : 'e.g. DMCH, Square Hospital, Dhanmondi'
                      }
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                      {lang === 'bn'
                        ? 'সংক্ষিপ্ত ডোনার নোট (ঐচ্ছিক)'
                        : 'Short Donor Note (Optional)'}
                    </label>
                    <input
                      type="text"
                      maxLength={240}
                      value={donorNote}
                      onChange={(e) => setDonorNote(e.target.value)}
                      placeholder={
                        lang === 'bn'
                          ? 'যেমন: অফিস সময়ের পর বিকেল ৫টার পরে হাসপাতালে আসতে সুবিধা হয়'
                          : 'e.g. Available on weekends or after 5 PM on weekdays'
                      }
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                    />
                  </div>
                </div>

                {/* Category 04 Form: Contact & Privacy Controls */}
                <div className="space-y-5 pt-6 border-t border-neutral-100">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-[#1F242D]">
                      {lang === 'bn'
                        ? '০৪. যোগাযোগ ও গোপনীয়তা নিয়ন্ত্রণ'
                        : '04. Contact & Privacy Controls'}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        {lang === 'bn'
                          ? 'মোবাইল নম্বর (পাবলিক সার্চে গোপন থাকবে) *'
                          : 'Mobile Number (Protected) *'}
                      </label>
                      <input
                        type="tel"
                        required={isListed}
                        value={rawPhone}
                        onChange={(e) => setRawPhone(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className="w-full min-h-[46px] px-4 py-2.5 text-sm font-mono border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      />
                      <p className="text-[11px] text-neutral-500 mt-1">
                        {lang === 'bn'
                          ? 'সুরক্ষিত: শুধুমাত্র লগইনকৃত ও ভেরিফাইড আবেদনকারীরাই সরাসরি কল/মেসেজ দিতে পারবেন।'
                          : 'Protected: Only verified seekers can request contact access.'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        {lang === 'bn'
                          ? 'রাতের জরুরি কলের নীতিমালা'
                          : 'Emergency / Night Call Preference'}
                      </label>
                      <select
                        value={nightCallPreference}
                        onChange={(e) =>
                          setNightCallPreference(
                            e.target.value as NightCallPreference
                          )
                        }
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      >
                        {NIGHT_CALL_PREFERENCES.map((np) => (
                          <option key={np} value={np}>
                            {nightCallPreferenceLabel(np, lang)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-2">
                      {lang === 'bn'
                        ? 'যোগাযোগের অনুমোদিত মাধ্যমসমূহ *'
                        : 'Allowed Contact Channels *'}
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {CONTACT_METHODS.map((method) => {
                        const checked = contactMethods.includes(method);
                        return (
                          <button
                            key={method}
                            type="button"
                            onClick={() => toggleMethod(method)}
                            className={`min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                              checked
                                ? 'bg-[#C80828] text-white shadow-xs'
                                : 'bg-[#FDF2F4] text-[#8F1D30] hover:bg-[#FADCE2]'
                            }`}
                          >
                            {contactMethodLabel(method, lang)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-start gap-3 text-xs text-neutral-700 leading-relaxed cursor-pointer p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                      <input
                        type="checkbox"
                        checked={hasConsented}
                        onChange={(e) => setHasConsented(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#C80828] shrink-0"
                      />
                      <span>
                        {lang === 'bn'
                          ? 'স্পষ্ট সম্মতি (Consent): আমি সম্মতি দিচ্ছি যে রক্তদেই-এ লগইনকৃত ও ইমেইল-যাচাইকৃত ব্যবহারকারীরা রক্তদান সংক্রান্ত যোগাযোগের জন্য আমার নির্বাচিত মাধ্যম ও ফোন নম্বর দেখতে পারবেন। আমি যেকোনো সময় লিস্টিং বা কল বিরতি চালু করতে পারব।'
                          : 'Explicit Consent: I consent to making my phone number accessible to signed-in, email-verified Rokto Dei users via my selected contact channels, and I can pause my listing anytime.'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Bottom Action Bar in Edit Mode */}
                <div className="pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={handleCancelDonorEdit}
                    disabled={saving}
                    className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs sm:text-sm font-semibold rounded-xl cursor-pointer transition-colors"
                  >
                    {lang === 'bn' ? 'বাতিল করুন' : 'Cancel'}
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto min-h-[46px] px-8 py-2.5 bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-60 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer shadow-xs inline-flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>
                      {saving
                        ? lang === 'bn'
                          ? 'তথ্য সংরক্ষিত হচ্ছে...'
                          : 'Saving...'
                        : lang === 'bn'
                        ? 'সকল তথ্য সংরক্ষণ করুন'
                        : 'Save All Changes'}
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* ============================================================== */}
            {/* TAB 2: DONATION HISTORY LOG (কবে, কোথায়, কতটুকু দিয়েছেন)         */}
            {/* ============================================================== */}
            {activeTab === 'history' && (
              <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-100">
                  <div>
                    <h3 className="text-lg font-bold text-[#1F242D]">
                      {lang === 'bn'
                        ? 'আমার রক্তদানের সম্পূর্ণ ইতিহাস (Donation Logbook)'
                        : 'My Blood Donation History Logbook'}
                    </h3>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {lang === 'bn'
                        ? 'কবে কবে রক্ত দিয়েছেন, কোন হাসপাতালে দিয়েছেন এবং কত ml / ব্যাগ দিয়েছেন—তার সকল রেকর্ড এখানে সংরক্ষিত থাকে।'
                        : 'Track every donation date, hospital/center, blood component, and volume in ml.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRecLinkedReqId('');
                      setShowAddDonationModal(true);
                    }}
                    className="min-h-[44px] px-4 py-2.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {lang === 'bn'
                        ? 'নতুন রক্তদানের তথ্য যোগ করুন'
                        : 'Log a Donation'}
                    </span>
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="py-10 text-center text-sm text-neutral-500">
                    {lang === 'bn'
                      ? 'রক্তদানের ইতিহাস লোড হচ্ছে...'
                      : 'Loading donation history...'}
                  </div>
                ) : activeDonationRecords.length === 0 ? (
                  <div className="py-8 text-center space-y-3">
                    <p className="text-sm font-semibold text-[#1F242D]">
                      {lang === 'bn'
                        ? 'আপনি এখনো কোনো রক্তদানের বিস্তারিত রেকর্ড যুক্ত করেননি।'
                        : 'You have not logged any individual donation records yet.'}
                    </p>
                    <p className="text-xs text-neutral-500 max-w-md mx-auto">
                      {lang === 'bn'
                        ? 'আপনার পূর্বের বা সদ্য সম্পন্ন রক্তদানের তারিখ, হাসপাতালের নাম এবং রক্তের পরিমাণ (যেমন ৪৫০ ml) যোগ করলে মোট সংখ্যা ও শেষ রক্তদানের তারিখ স্বয়ংক্রিয়ভাবে হিসাব হবে।'
                        : 'Add past or recent donations to automatically calculate total donations, ml volume, and rest days.'}
                    </p>
                    {demoMode && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleLoadDemoProfileData}
                          className="min-h-[36px] px-4 py-2 bg-[#FDF2F4] hover:bg-[#FADCE2] text-[#C80828] text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {lang === 'bn'
                              ? 'টেস্টের জন্য ৪টি নমুনা রক্তদান রেকর্ড লোড করুন'
                              : 'Load 4 Sample Donation Logs for Testing'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {activeDonationRecords.map((rec, idx) => (
                      <div
                        key={rec.id}
                        className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-xs font-mono tabular-nums font-bold text-[#C80828]">
                              #{activeDonationRecords.length - idx}
                            </span>
                            <h4 className="text-base font-bold text-[#1F242D]">
                              {rec.hospitalOrCenter}
                            </h4>
                            {isDemoRecordId(rec.id) && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-semibold">
                                {lang === 'bn' ? 'নমুনা টেস্ট রেকর্ড' : 'Demo Record'}
                              </span>
                            )}
                            <span className="text-xs font-mono tabular-nums font-semibold text-neutral-700">
                              · {rec.donationDate}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-600">
                            <span>
                              {formatLocationLabel(
                                rec.divisionId,
                                rec.districtId,
                                rec.upazilaId,
                                lang
                              )}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#1F242D]">
                              {donationComponentLabel(rec.donationType, lang)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums font-semibold text-[#C80828]">
                              {rec.volumeMl} ml ({rec.units}{' '}
                              {lang === 'bn' ? 'ব্যাগ' : 'Bag'})
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{rec.bloodGroup}</span>
                          </div>

                          {rec.recipientSummary && (
                            <p className="text-xs text-neutral-600 pt-0.5">
                              {rec.recipientSummary}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {confirmDeleteRecordId === rec.id ? (
                            <>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleDeleteDonation(rec.id)}
                                className="min-h-[40px] px-3 py-1.5 bg-[#C80828] text-white text-xs font-semibold rounded-xl cursor-pointer"
                              >
                                {lang === 'bn' ? 'নিশ্চিত মুছুন' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteRecordId(null)}
                                className="min-h-[40px] px-3 py-1.5 bg-neutral-100 text-neutral-700 text-xs font-semibold rounded-xl cursor-pointer"
                              >
                                {lang === 'bn' ? 'না' : 'Cancel'}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRecordId(rec.id)}
                              title={
                                lang === 'bn' ? 'রেকর্ড মুছুন' : 'Delete record'
                              }
                              aria-label={
                                lang === 'bn' ? 'রেকর্ড মুছুন' : 'Delete record'
                              }
                              className="min-h-[44px] min-w-[44px] rounded-xl bg-[#FDF2F4] hover:bg-[#FADCE2] text-[#8F1D30] flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 3: MY REQUESTS, BOOKINGS & DONOR COMMITMENTS               */}
            {/* ============================================================== */}
            {activeTab === 'commitments' && (
              <div className="space-y-6">
                {/* Part A: Requests Created by Me + Donor Booking Controls */}
                <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
                    <div>
                      <h3 className="text-lg font-bold text-[#1F242D]">
                        {lang === 'bn'
                          ? 'আমার পোস্টকৃত রক্তের অনুরোধ ও ডোনার বুকিং'
                          : 'My Blood Requests & Donor Bookings'}
                      </h3>
                      <p className="text-xs text-neutral-600 mt-0.5">
                        {lang === 'bn'
                          ? 'কোনো ডোনারের সাথে ফোনে কথা চূড়ান্ত হলে "ডোনার বুক করুন" বাটনে চাপুন—তাহলে অন্য কেউ আর কল দিয়ে বিরক্ত করতে পারবে না।'
                          : 'Book a confirmed donor to automatically lock phone access and stop extra calls.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('blood_requests')}
                      className="min-h-[42px] px-4 py-2 bg-[#FDF2F4] hover:bg-[#FADCE2] text-[#C80828] text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
                    >
                      {lang === 'bn'
                        ? 'সকল অনুরোধ পেজে যান'
                        : 'Go to Requests Feed'}
                    </button>
                  </div>

                  {loadingCommitments ? (
                    <p className="text-sm text-neutral-500 py-6 text-center">
                      {lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}
                    </p>
                  ) : activeMyRequests.length === 0 ? (
                    <p className="text-sm text-neutral-500 py-4">
                      {lang === 'bn'
                        ? 'আপনি এখনো কোনো রক্তের অনুরোধ পোস্ট করেননি।'
                        : 'You have not posted any blood requests.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {activeMyRequests.map((req) => {
                        const pledgesForReq = activeIncomingPledges.filter(
                          (p) =>
                            p.requestId === req.id && p.status !== 'withdrawn'
                        );
                        return (
                          <div key={req.id} className="py-5 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="text-base font-bold text-[#1F242D]">
                                  {req.hospitalName}{' '}
                                  <span className="font-mono text-[#C80828]">
                                    ({req.bloodGroup} · {req.units}{' '}
                                    {lang === 'bn' ? 'ব্যাগ' : 'Bag'})
                                  </span>
                                </div>
                                <div className="text-xs text-neutral-600 tabular-nums mt-0.5">
                                  {requestStatusLabel(req.status, lang)} ·{' '}
                                  {lang === 'bn' ? 'প্রয়োজন: ' : 'Date: '}
                                  {req.requiredDate}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {req.status === 'open' && (
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => openBookModalForRequest(req)}
                                    className="min-h-[40px] px-3.5 py-1.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>
                                      {lang === 'bn'
                                        ? 'ডোনার বুক করুন (কল বন্ধ)'
                                        : 'Book Donor & Pause Calls'}
                                    </span>
                                  </button>
                                )}

                                {req.status === 'booked' && (
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => handleReopenRequest(req.id)}
                                    className="min-h-[40px] px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Unlock className="w-3.5 h-3.5" />
                                    <span>
                                      {lang === 'bn'
                                        ? 'বুকিং খুলে কল চালু করুন'
                                        : 'Re-open Calls'}
                                    </span>
                                  </button>
                                )}

                                {(req.status === 'open' ||
                                  req.status === 'booked') && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() =>
                                        handleCloseOwnReq(req.id, 'fulfilled')
                                      }
                                      className="min-h-[40px] px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-semibold rounded-xl inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>
                                        {lang === 'bn'
                                          ? 'রক্ত মিলেছে'
                                          : 'Fulfilled'}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() =>
                                        handleCloseOwnReq(req.id, 'cancelled')
                                      }
                                      className="min-h-[40px] px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      <span>
                                        {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                                      </span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {req.status === 'booked' && req.bookedDonorName && (
                              <div className="p-3.5 rounded-2xl bg-[#FDF2F4] border border-[#F7D4DC] text-xs text-[#1F242D] space-y-0.5">
                                <div className="font-bold text-[#C80828]">
                                  {lang === 'bn'
                                    ? `চূড়ান্ত বুকড ডোনার: ${req.bookedDonorName}`
                                    : `Confirmed Donor: ${req.bookedDonorName}`}
                                </div>
                                {req.bookingNote && (
                                  <div className="text-neutral-700">
                                    {req.bookingNote}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Interested Donor Pledges on this Request */}
                            {pledgesForReq.length > 0 && (
                              <div className="pt-2 space-y-2">
                                <div className="text-xs font-semibold text-neutral-600">
                                  {lang === 'bn'
                                    ? `সাড়া দেওয়া রক্তদাতাগণ (${pledgesForReq.length}):`
                                    : `Interested Donors (${pledgesForReq.length}):`}
                                </div>
                                <div className="space-y-2">
                                  {pledgesForReq.map((pl) => (
                                    <div
                                      key={pl.id}
                                      className="p-3 rounded-xl bg-[#FAF8F9] border border-neutral-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                    >
                                      <div>
                                        <span className="font-bold text-[#1F242D]">
                                          {pl.donorName}
                                        </span>{' '}
                                        <span className="font-mono font-bold text-[#C80828]">
                                          ({pl.donorBloodGroup})
                                        </span>{' '}
                                        ·{' '}
                                        <span className="text-neutral-600">
                                          {pledgeStatusLabel(pl.status, lang)}
                                        </span>
                                        {pl.message && (
                                          <p className="text-neutral-600 mt-0.5">
                                            {pl.message}
                                          </p>
                                        )}
                                      </div>

                                      {req.status === 'open' &&
                                        pl.status === 'offered' && (
                                          <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() =>
                                              openBookModalForRequest(req, pl)
                                            }
                                            className="min-h-[38px] px-3 py-1.5 bg-[#C80828] text-white font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                                          >
                                            {lang === 'bn'
                                              ? 'এই ডোনারকে বুক করুন'
                                              : 'Accept & Book'}
                                          </button>
                                        )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Part B: Requests Where I Offered to Donate */}
                <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-[#1F242D]">
                      {lang === 'bn'
                        ? 'আমি যেসব অনুরোধে রক্ত দিতে আগ্রহ জানিয়েছি'
                        : 'Requests Where I Offered to Donate'}
                    </h3>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {lang === 'bn'
                        ? 'রক্তদান সম্পন্ন হলে ১ ক্লিকেই আপনার রক্তদানের ইতিহাসে (Logbook) যুক্ত করতে পারবেন।'
                        : 'Once you complete a donation, add it directly to your Donation History logbook.'}
                    </p>
                  </div>

                  {activeMyPledges.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      {lang === 'bn'
                        ? 'আপনি এখনো কোনো রক্তের অনুরোধে অনলাইন সাড়া পাঠাননি।'
                        : 'You have not sent any donation offers yet.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {activeMyPledges.map((pl) => (
                        <div
                          key={pl.id}
                          className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <div className="text-sm font-bold text-[#1F242D]">
                              {pl.hospitalName}{' '}
                              <span className="font-mono text-[#C80828]">
                                ({pl.donorBloodGroup})
                              </span>
                            </div>
                            <div className="text-xs text-neutral-600">
                              {pledgeStatusLabel(pl.status, lang)} ·{' '}
                              {formatTimestamp(pl.updatedAt, lang)}
                            </div>
                            {pl.message && (
                              <p className="text-xs text-neutral-500">
                                {pl.message}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {pl.status !== 'withdrawn' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRecHospital(pl.hospitalName);
                                  setRecLinkedReqId(pl.requestId);
                                  setActiveTab('history');
                                  setShowAddDonationModal(true);
                                }}
                                className="min-h-[40px] px-3.5 py-1.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-xs font-semibold rounded-xl cursor-pointer"
                              >
                                {lang === 'bn'
                                  ? 'রক্তদানের ইতিহাসে যোগ করুন'
                                  : 'Log Completed Donation'}
                              </button>
                            )}

                            {pl.status === 'offered' && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleWithdrawMyPledge(pl)}
                                className="min-h-[40px] px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl cursor-pointer"
                              >
                                {lang === 'bn' ? 'প্রত্যাহার' : 'Withdraw'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 4: ACCOUNT SETTINGS, REPORTS & DEACTIVATION                */}
            {/* ============================================================== */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                {/* Public Identity & Username Management Card */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-neutral-200/80 p-4 sm:p-8 space-y-5 sm:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-[#1F242D] flex items-center gap-2">
                        <User className="w-5 h-5 text-[#C80828]" />
                        <span>{lang === 'bn' ? 'পাবলিক পরিচিতি ও ইউনিক ইউজারনেম' : 'Public Profile & Username'}</span>
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1">
                        {lang === 'bn'
                          ? 'রক্তদেই প্ল্যাটফর্মে আপনার মূল পরিচিতি, নাম, অনন্য @হ্যান্ডেল ও যোগাযোগের ভাষা।'
                          : 'Your public handle, full name, and language settings across Rokto Dei.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenEditIdentityModal}
                      className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs shrink-0"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>{lang === 'bn' ? 'প্রোফাইল ও ইউজারনেম সম্পাদনা' : 'Edit Profile & Handle'}</span>
                    </button>
                  </div>

                  {/* Identity Key Value Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5 pt-1">
                    <div className="bg-[#FAF8F9] rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-neutral-200/80">
                      <span className="text-[11px] font-semibold text-neutral-500 block mb-1">
                        {lang === 'bn' ? 'প্রদর্শিত পূর্ণ নাম' : 'Full Name'}
                      </span>
                      <p className="text-sm font-bold text-[#1F242D] truncate">
                        {shownName}
                      </p>
                    </div>

                    <div className="bg-[#FAF8F9] rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-neutral-200/80">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[11px] font-semibold text-neutral-500">
                          {lang === 'bn' ? 'অনন্য ইউজারনেম' : 'Unique Username'}
                        </span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
                          {lang === 'bn' ? 'সংরক্ষিত' : 'Active'}
                        </span>
                      </div>
                      <p className="text-sm font-mono font-bold text-[#C80828] truncate">
                        @{currentUsername}
                      </p>
                    </div>

                    <div className="bg-[#FAF8F9] rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-neutral-200/80">
                      <span className="text-[11px] font-semibold text-neutral-500 block mb-1">
                        {lang === 'bn' ? 'পছন্দের ভাষা' : 'Language'}
                      </span>
                      <p className="text-sm font-bold text-[#1F242D]">
                        {preferredLanguage === 'bn' ? 'বাংলা (Bengali)' : 'English'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Account Security & Verification Card */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-neutral-200/80 p-4 sm:p-8 space-y-4">
                  <h3 className="text-base font-bold text-[#1F242D] flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>{lang === 'bn' ? 'অ্যাকাউন্ট নিরাপত্তা ও যাচাইকরণ' : 'Security & Verification'}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="bg-[#FAF8F9] rounded-2xl p-4 border border-neutral-200/80">
                      <span className="text-[11px] font-semibold text-neutral-500 block mb-1">
                        {lang === 'bn' ? 'নিবন্ধিত ইমেইল' : 'Registered Email'}
                      </span>
                      <p className="text-sm font-bold text-[#1F242D] truncate">
                        {firebaseUser.email || (lang === 'bn' ? 'ইমেইল নেই' : 'No email')}
                      </p>
                      <div className="mt-2">
                        {isEmailVerified ? (
                          <span className="text-[11px] text-emerald-700 font-semibold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{lang === 'bn' ? 'ইমেইল সফলভাবে যাচাইকৃত' : 'Email verified'}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-700 font-medium inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>{lang === 'bn' ? 'ইমেইল যাচাইকরণ বাকি' : 'Email unverified'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#FAF8F9] rounded-2xl p-4 border border-neutral-200/80">
                      <span className="text-[11px] font-semibold text-neutral-500 block mb-1">
                        {lang === 'bn' ? 'ফায়ারবেস ইউজার আইডি (UID)' : 'Firebase User ID'}
                      </span>
                      <p className="text-xs font-mono font-bold text-neutral-700 select-all break-all">
                        {firebaseUser.uid}
                      </p>
                      <span className="text-[11px] text-neutral-400 mt-2 block">
                        {lang === 'bn' ? 'সিস্টেম ট্র্যাকিং ও ডেটা সিকিউরিটি আইডেন্টিফায়ার' : 'Secure system identifier'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* My Submitted Reports */}
                <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 space-y-4">
                  <h3 className="text-base font-bold text-[#1F242D]">
                    {lang === 'bn'
                      ? 'আমার দাখিলকৃত রিপোর্টসমূহ'
                      : 'My Submitted Reports'}
                  </h3>
                  {myReports.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      {lang === 'bn'
                        ? 'আপনি এখনো কোনো রিপোর্ট জমা দেননি।'
                        : 'You have not submitted any reports.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {myReports.map((rep) => (
                        <div key={rep.id} className="py-3.5 space-y-1">
                          <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[#1F242D]">
                            <span>{reportReasonLabel(rep.reason, lang)}</span>
                            <span className="text-xs font-medium text-neutral-600">
                              {reportStatusLabel(rep.status, lang)}
                            </span>
                          </div>
                          {rep.description && (
                            <p className="text-xs text-neutral-600">
                              {rep.description}
                            </p>
                          )}
                          <p className="text-[11px] text-neutral-400 tabular-nums">
                            {formatTimestamp(rep.createdAt, lang)}
                            {rep.resolutionNote
                              ? ` · মডারেশন নোট: ${rep.resolutionNote}`
                              : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Account Sign Out Section */}
                <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[#1F242D] flex items-center gap-2">
                        <LogOut className="w-4 h-4 text-[#C80828]" />
                        <span>
                          {lang === 'bn'
                            ? 'অ্যাকাউন্ট থেকে লগআউট (Sign Out)'
                            : 'Sign Out of Account'}
                        </span>
                      </h3>
                      <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                        {lang === 'bn'
                          ? 'রক্তদেই অ্যাকাউন্ট থেকে নিরাপদে প্রস্থান করুন। ভুল ক্লিক রোধে ১০ সেকেন্ডের নিরাপত্তা কাউন্টডাউন পপআপ প্রদর্শিত হবে।'
                          : 'Safely sign out of your session. A 10-second confirmation window ensures intentional signout.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenLogoutModal}
                      className="min-h-[44px] px-5 py-2.5 bg-[#FDF2F4] hover:bg-[#FADCE2] text-[#C80828] border border-[#F7D4DC] text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-colors shadow-xs"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{lang === 'bn' ? 'লগআউট করুন' : 'Log Out'}</span>
                    </button>
                  </div>
                </div>

                {/* Account Deactivation */}
                <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 space-y-4">
                  <h3 className="text-base font-bold text-[#C80828]">
                    {lang === 'bn'
                      ? 'অ্যাকাউন্ট নিষ্ক্রিয়করণ (Deactivate Account)'
                      : 'Deactivate Account'}
                  </h3>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    {lang === 'bn'
                      ? 'অ্যাকাউন্ট নিষ্ক্রিয় করলে আপনার রক্তদাতা প্রোফাইল তাৎক্ষণিকভাবে সার্চ তালিকা থেকে সরিয়ে ফেলা হবে এবং আপনি স্বয়ংক্রিয়ভাবে লগআউট হয়ে যাবেন।'
                      : 'Deactivating your account immediately removes any active donor listing from search results and signs you out.'}
                  </p>

                  {!confirmDeactivate ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeactivate(true)}
                      className="min-h-[44px] px-4 py-2 bg-[#FDF2F4] hover:bg-[#FADCE2] text-[#C80828] text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      {lang === 'bn'
                        ? 'আমার অ্যাকাউন্ট নিষ্ক্রিয় করুন'
                        : 'Request Account Deactivation'}
                    </button>
                  ) : (
                    <div className="pt-3 border-t border-neutral-100 space-y-3">
                      <p className="text-xs font-semibold text-[#C80828]">
                        {lang === 'bn'
                          ? 'আপনি কি নিশ্চিতভাবে অ্যাকাউন্ট ও ডোনার লিস্টিং নিষ্ক্রিয় করতে চান?'
                          : 'Confirm account and donor listing deactivation?'}
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={handleDeactivate}
                          className="min-h-[44px] px-5 py-2 bg-[#C80828] text-white text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          {lang === 'bn'
                            ? 'হ্যাঁ, নিষ্ক্রিয় করুন'
                            : 'Yes, Deactivate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeactivate(false)}
                          className="min-h-[44px] px-4 py-2 bg-neutral-100 text-neutral-700 text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: ADD DONATION HISTORY RECORD                           */}
      {/* ============================================================== */}
      {showAddDonationModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-xl bg-white rounded-3xl border border-neutral-200 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#1F242D]">
                  {lang === 'bn'
                    ? 'রক্তদানের নতুন রেকর্ড যোগ করুন'
                    : 'Add Blood Donation Record'}
                </h2>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {lang === 'bn'
                    ? 'কবে, কোন হাসপাতালে এবং কতটুকু রক্ত দিয়েছেন তা সংরক্ষণ করুন।'
                    : 'Record when, where, and how much blood you donated.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDonationModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-900 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDonationSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'কবে রক্ত দিয়েছেন (তারিখ)' : 'Donation Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={recDate}
                    onChange={(e) => setRecDate(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'রক্তদানের ধরন' : 'Component Type'}
                  </label>
                  <select
                    value={recType}
                    onChange={(e) =>
                      setRecType(e.target.value as DonationComponentType)
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  >
                    {DONATION_COMPONENT_TYPES.map((ct) => (
                      <option key={ct} value={ct}>
                        {donationComponentLabel(ct, lang)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  {lang === 'bn'
                    ? 'কোথায় দিয়েছেন (হাসপাতাল বা ব্লাড ব্যাংকের নাম)'
                    : 'Hospital or Blood Bank Name'}
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={recHospital}
                  onChange={(e) => setRecHospital(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'যেমন: ঢাকা মেডিকেল কলেজ হাসপাতাল / রেড ক্রিসেন্ট ব্লাড সেন্টার'
                      : 'e.g. Dhaka Medical College Hospital'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'বিভাগ' : 'Division'}
                  </label>
                  <select
                    value={recDivisionId}
                    onChange={(e) => {
                      const nextDiv = e.target.value;
                      setRecDivisionId(nextDiv);
                      const firstDist = getDistrictsByDivision(nextDiv)[0];
                      const nextDistId = firstDist?.id || '';
                      setRecDistrictId(nextDistId);
                      setRecUpazilaId(firstDist?.upazilas[0]?.id || '');
                    }}
                    className="w-full min-h-[44px] px-3 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  >
                    {DIVISIONS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d[lang]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'জেলা' : 'District'}
                  </label>
                  <select
                    value={recDistrictId}
                    onChange={(e) => {
                      const nextDist = e.target.value;
                      setRecDistrictId(nextDist);
                      const firstUpz = getUpazilasByDistrict(nextDist)[0];
                      setRecUpazilaId(firstUpz?.id || '');
                    }}
                    className="w-full min-h-[44px] px-3 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  >
                    {recDistricts.map((dist) => (
                      <option key={dist.id} value={dist.id}>
                        {dist[lang]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'উপজেলা / থানা' : 'Upazila'}
                  </label>
                  <select
                    value={recUpazilaId}
                    onChange={(e) => setRecUpazilaId(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  >
                    {recUpazilas.map((upz) => (
                      <option key={upz.id} value={upz.id}>
                        {upz[lang]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn'
                      ? 'কতটুকু রক্ত দিয়েছেন (পরিমাণ ml)'
                      : 'Volume Donated (ml)'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      required
                      min={150}
                      max={1500}
                      value={recVolumeMl}
                      onChange={(e) => setRecVolumeMl(Number(e.target.value))}
                      className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setRecVolumeMl(350);
                        setRecUnits(1);
                      }}
                      className="min-h-[44px] px-2.5 text-xs font-mono font-semibold rounded-xl bg-[#FDF2F4] text-[#8F1D30] cursor-pointer"
                    >
                      350ml
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecVolumeMl(450);
                        setRecUnits(1);
                      }}
                      className="min-h-[44px] px-2.5 text-xs font-mono font-semibold rounded-xl bg-[#FDF2F4] text-[#8F1D30] cursor-pointer"
                    >
                      450ml
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'ব্যাগ সংখ্যা (১–৪)' : 'Units / Bags (1–4)'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={4}
                    value={recUnits}
                    onChange={(e) => setRecUnits(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  {lang === 'bn'
                    ? 'সংক্ষিপ্ত বিবরণ (ঐচ্ছিক, কার জন্য বা কী প্রয়োজনে দিয়েছেন)'
                    : 'Short Summary (Optional)'}
                </label>
                <input
                  type="text"
                  maxLength={240}
                  value={recSummary}
                  onChange={(e) => setRecSummary(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'যেমন: থ্যালাসেমিয়া রোগীর জন্য ১ ব্যাগ হোল ব্লাড প্রদান'
                      : 'e.g. Emergency surgery patient'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                />
              </div>

              {ownDonor && (
                <label className="flex items-start gap-2.5 text-xs text-neutral-700 leading-relaxed cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recMarkUnavailable}
                    onChange={(e) => setRecMarkUnavailable(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#C80828]"
                  />
                  <span>
                    {lang === 'bn'
                      ? 'রক্তদান পরবর্তী বিশ্রামের জন্য আমার প্রোফাইল স্ট্যাটাস স্বয়ংক্রিয়ভাবে "সাময়িকভাবে অনুপস্থিত" করুন যেন অযথা কেউ কল না করে।'
                      : 'Automatically set my availability to Temporarily Unavailable for post-donation rest.'}
                  </span>
                </label>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDonationModal(false)}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-xl cursor-pointer"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] px-6 py-2 bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-60 text-white text-sm font-semibold rounded-xl cursor-pointer"
                >
                  {saving
                    ? lang === 'bn'
                      ? 'সংরক্ষণ হচ্ছে...'
                      : 'Saving...'
                    : lang === 'bn'
                    ? 'ইতিহাসে সংরক্ষণ করুন'
                    : 'Save Donation Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: BOOK DONOR & LOCK CALLS ON OWN REQUEST                */}
      {/* ============================================================== */}
      {bookingModalReq && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-lg bg-white rounded-3xl border border-neutral-200 p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#1F242D]">
                  {lang === 'bn'
                    ? 'ডোনার বুক করুন ও নতুন কল বন্ধ রাখুন'
                    : 'Book Confirmed Donor & Pause New Calls'}
                </h2>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {bookingModalReq.hospitalName} ({bookingModalReq.bloodGroup})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBookingModalReq(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-900 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmBookDonor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  {lang === 'bn'
                    ? 'চূড়ান্ত হওয়া রক্তদাতার নাম'
                    : 'Confirmed Donor Name'}
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={bookDonorNameInput}
                  onChange={(e) => setBookDonorNameInput(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'যেমন: তানভীর আহমেদ'
                      : 'Enter confirmed donor name'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  {lang === 'bn'
                    ? 'বুকিং নোট (অন্যান্য ডোনাররা কার্ডে দেখতে পাবেন)'
                    : 'Booking Note (Shown publicly on card)'}
                </label>
                <textarea
                  rows={2}
                  maxLength={240}
                  value={bookNoteInput}
                  onChange={(e) => setBookNoteInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                />
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">
                {lang === 'bn'
                  ? 'বুক করার সাথে সাথে আপনার ফোন নম্বর ও কল বাটন অন্য সকলের জন্য লক হয়ে যাবে যেন কেউ অযথা ফোন দিয়ে বিরক্ত না করে। প্রয়োজনে পরে আবার ওপেন করতে পারবেন।'
                  : 'Booking immediately locks your phone number in Firestore so nobody else calls to disturb you. You can re-open calls anytime if needed.'}
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBookingModalReq(null)}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-xl cursor-pointer"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] px-5 py-2 bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-60 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {lang === 'bn'
                      ? 'ডোনার বুক করুন ও কল লক করুন'
                      : 'Confirm Booking & Lock Calls'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2.5: UNIFIED PROFILE & IDENTITY EDIT MODAL               */}
      {/* ============================================================== */}
      {showEditIdentityModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl border border-neutral-200 shadow-2xl p-4 sm:p-7 space-y-4 sm:space-y-5 relative my-4 sm:my-8 max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                if (!savingIdentity) setShowEditIdentityModal(false);
              }}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer transition-colors"
              title={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FDF2F4] text-[#C80828] flex items-center justify-center shrink-0 border border-[#FADCE2]">
                <Edit2 className="w-6 h-6" />
              </div>
              <div className="min-w-0 pr-6">
                <h2 className="text-lg sm:text-xl font-bold text-[#1F242D] tracking-tight">
                  {lang === 'bn' ? 'প্রোফাইল ও পরিচিতি সম্পাদনা' : 'Edit Profile & Identity'}
                </h2>
                <p className="text-xs text-neutral-500">
                  {lang === 'bn'
                    ? 'আপনার প্রদর্শিত নাম ও অনন্য ইউনিক ইউজারনেম পরিবর্তন করুন'
                    : 'Update your display name and unique @username'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveUnifiedIdentity} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  {lang === 'bn' ? 'পূর্ণ নাম' : 'Full Name'} <span className="text-[#C80828]">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={SCHEMA_LIMITS.NAME_MIN}
                  maxLength={SCHEMA_LIMITS.NAME_MAX}
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  placeholder={lang === 'bn' ? 'আপনার আসল নাম লিখুন' : 'Enter your full name'}
                  className="w-full min-h-[46px] px-4 py-2.5 text-sm font-semibold border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828] shadow-xs"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  {lang === 'bn' ? 'এটি রক্তদেই প্ল্যাটফর্মের সর্বত্র প্রদর্শিত হবে।' : 'Displayed on donor records and blood requests.'}
                </p>
              </div>

              {/* Unique Username */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-neutral-700">
                    {lang === 'bn' ? 'অনন্য ইউজারনেম (Unique @Username)' : 'Unique Username'} <span className="text-[#C80828]">*</span>
                  </label>
                  {identityUsernameStatus.message && (
                    <div className="text-xs font-medium">
                      {identityUsernameStatus.checking ? (
                        <span className="text-neutral-500 inline-flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin text-neutral-400" />
                          <span>{identityUsernameStatus.message}</span>
                        </span>
                      ) : identityUsernameStatus.status === 'available' ? (
                        <span className="text-emerald-700 inline-flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{identityUsernameStatus.message}</span>
                        </span>
                      ) : (
                        <span className="text-red-600 inline-flex items-center gap-1 font-semibold">
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                          <span>{identityUsernameStatus.message}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-neutral-400 font-mono font-bold text-sm select-none">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={30}
                    value={editUsernameInput}
                    onChange={(e) =>
                      setEditUsernameInput(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                      )
                    }
                    placeholder="your_handle"
                    className="w-full min-h-[46px] pl-9 pr-4 py-2.5 text-sm font-mono font-bold border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828] shadow-xs"
                  />
                </div>

                <div className="bg-[#FAF8F9] rounded-xl p-3 border border-neutral-200/80 text-[11px] text-neutral-600 space-y-1 mt-2">
                  <div className="font-semibold text-neutral-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{lang === 'bn' ? 'ইউজারনেমের নিয়মাবলী:' : 'Username Requirements:'}</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-neutral-500">
                    <li>{lang === 'bn' ? 'দৈর্ঘ্য ৩ থেকে ৩০ অক্ষর।' : '3 to 30 characters.'}</li>
                    <li>{lang === 'bn' ? 'শুধুমাত্র ইংরেজি ছোট হাতের অক্ষর (a-z), সংখ্যা (0-9) এবং আন্ডারস্কোর (_)।' : 'Lowercase English letters (a-z), numbers (0-9), and _ only.'}</li>
                    <li>{lang === 'bn' ? 'সম্পূর্ণ ইউনিক—একই ইউজারনেম একাধিক ব্যক্তি নিতে পারবেন না।' : 'Globally unique; no duplicates allowed.'}</li>
                  </ul>
                </div>
              </div>

              {/* Preferred Language */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  {lang === 'bn' ? 'পছন্দের ভাষা' : 'Preferred Language'}
                </label>
                <select
                  value={editLangInput}
                  onChange={(e) => setEditLangInput(e.target.value as AppLanguage)}
                  className="w-full min-h-[46px] px-4 py-2.5 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828] shadow-xs"
                >
                  <option value="bn">বাংলা (Bengali)</option>
                  <option value="en">English</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditIdentityModal(false)}
                  disabled={savingIdentity}
                  className="min-h-[46px] px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs sm:text-sm font-semibold rounded-xl cursor-pointer transition-colors"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={
                    savingIdentity ||
                    identityUsernameStatus.checking ||
                    identityUsernameStatus.status === 'taken' ||
                    identityUsernameStatus.status === 'invalid' ||
                    !editNameInput.trim() ||
                    !editUsernameInput.trim()
                  }
                  className="min-h-[46px] px-4 py-2.5 bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl cursor-pointer transition-all shadow-xs inline-flex items-center justify-center gap-2"
                >
                  {savingIdentity ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Changes'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: 10-SECOND COUNTDOWN LOGOUT CONFIRMATION MODAL         */}
      {/* ============================================================== */}
      {showLogoutModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 shadow-2xl p-6 sm:p-7 space-y-5 text-center relative overflow-hidden">
            {/* Top red decorative accent line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#C80828]" />

            {/* Pulsing Warning Icon Crest */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-[#FDF2F4] border border-[#FADCE2] flex items-center justify-center text-[#C80828] relative">
              <LogOut className="w-8 h-8" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#C80828]"></span>
              </span>
            </div>

            {/* Modal Heading & Explanation */}
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-[#1F242D]">
                {lang === 'bn' ? 'লগআউট নিশ্চিতকরণ' : 'Confirm Logout'}
              </h2>
              <p className="text-xs text-neutral-600 leading-relaxed max-w-xs mx-auto">
                {lang === 'bn'
                  ? 'আপনি কি নিশ্চিতভাবে রক্তদেই অ্যাকাউন্ট থেকে লগআউট করতে চান?'
                  : 'Are you sure you want to log out of your Rokto Dei account?'}
              </p>
            </div>

            {/* 10-Second Live Countdown Widget */}
            <div className="bg-[#FAF8F9] border border-neutral-200/90 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#C80828]" />
                  <span>{lang === 'bn' ? 'নিরাপত্তা কাউন্টডাউন' : 'Safety Countdown'}</span>
                </span>
                <span className="font-mono text-sm font-bold text-[#C80828] tabular-nums">
                  {lang === 'bn' ? `${logoutCountdown} সেকেন্ড` : `${logoutCountdown}s`}
                </span>
              </div>

              {/* Visual Animated Countdown Progress Bar */}
              <div className="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-[#C80828] h-2.5 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(logoutCountdown / 10) * 100}%` }}
                />
              </div>

              <p className="text-[11px] text-neutral-500 leading-normal text-left">
                {logoutCountdown > 0
                  ? lang === 'bn'
                    ? 'কাউন্টডাউন চলাকালীন বাটনটি লক থাকবে। ১০ সেকেন্ড শেষ হলে বাটনটি সক্রিয় হবে।'
                    : 'The logout button is locked during the countdown and will unlock in 10s.'
                  : lang === 'bn'
                  ? '১০ সেকেন্ড পূর্ণ হয়েছে। লগআউট সম্পন্ন করতে নিচের লাল বোতামে চাপুন।'
                  : 'Countdown complete! Click the confirm button below to sign out.'}
              </p>
            </div>

            {/* User Details Preview Box */}
            <div className="p-3 bg-neutral-50 rounded-xl text-left flex items-center gap-3 border border-neutral-100">
              <div className="w-9 h-9 rounded-full bg-[#FDF2F4] text-[#C80828] font-bold text-sm flex items-center justify-center shrink-0">
                {avatarInitial}
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-semibold text-neutral-900 truncate">{shownName}</p>
                <p className="text-neutral-500 truncate text-[11px]">{firebaseUser.email}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleCancelLogout}
                disabled={loggingOut}
                className="min-h-[46px] px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs sm:text-sm font-semibold rounded-xl cursor-pointer transition-colors"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleConfirmLogout}
                disabled={logoutCountdown > 0 || loggingOut}
                className={`min-h-[46px] px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                  logoutCountdown > 0
                    ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed border border-neutral-300/70 select-none'
                    : 'bg-[#C80828] hover:bg-[#A3051E] text-white cursor-pointer shadow-md'
                }`}
              >
                {loggingOut ? (
                  <span>{lang === 'bn' ? 'লগআউট হচ্ছে...' : 'Signing out...'}</span>
                ) : logoutCountdown > 0 ? (
                  <>
                    <Lock className="w-4 h-4 text-neutral-500" />
                    <span>
                      {lang === 'bn'
                        ? `অপেক্ষা করুন (${logoutCountdown}s)`
                        : `Please wait (${logoutCountdown}s)`}
                    </span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>
                      {lang === 'bn'
                        ? 'লগআউট নিশ্চিত করুন'
                        : 'Confirm Logout'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital Donor Recognition Card Modal (Private to enrolled owner) */}
      <DigitalDonorCardModal
        isOpen={Boolean(showOwnBadgeModal && ownDonor)}
        onClose={() => setShowOwnBadgeModal(false)}
        donor={ownDonor}
        phoneNumber={ownDonorPhone || ''}
        lang={lang}
      />
    </div>
  );
}
