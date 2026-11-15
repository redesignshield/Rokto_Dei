import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Crosshair,
  Droplets,
  Eye,
  Flag,
  HeartHandshake,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  RotateCcw,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  DIVISIONS,
  formatLocationLabel,
  getDistrictsByDivision,
  getUpazilasByDistrict,
} from '../data/bdLocations';
import {
  availabilityLabel,
  contactMethodLabel,
  formatTimestamp,
} from '../lib/i18n';
import { BLOOD_GROUPS, daysSinceDate } from '../lib/validation';
import {
  listOpenBloodRequests,
  resolveDonorContact,
  searchActiveDonors,
  subscribeActiveDonors,
} from '../services/roktoService';
import type {
  AppView,
  BloodGroup,
  BloodRequest,
  ContactMethod,
  DonorProfile,
} from '../types';
import { ContactResolutionModal } from './ContactResolutionModal';
import { DonorProfileModal } from './DonorProfileModal';
import { DonationCareIllustration } from './MedicalIllustrations';
import { ReportModal } from './ReportModal';
import { DonorMapComponent } from './DonorMapComponent';
import {
  formatDistanceKm,
  getAreaCoords,
  getObfuscatedDonorCoords,
  haversineDistance,
  type GeoCoordinate,
} from '../lib/geoUtils';
import { getDonorTier } from '../lib/donorBadge';

interface DonorSearchViewProps {
  onOpenAuth: () => void;
  onNavigate: (view: AppView, targetId?: string, donorUid?: string) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'র';
  if (parts.length === 1) return Array.from(parts[0])[0] || 'র';
  return `${Array.from(parts[0])[0] || ''}${Array.from(parts[parts.length - 1])[0] || ''}`.toUpperCase();
}

export function DonorSearchView({
  onOpenAuth,
  onNavigate,
}: DonorSearchViewProps) {
  const {
    firebaseUser,
    userProfile,
    ownDonor,
    isEmailVerified,
    lang,
  } = useAuth();
  const canViewDirectory = Boolean(firebaseUser && isEmailVerified);

  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [divisionId, setDivisionId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [upazilaId, setUpazilaId] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [keyword, setKeyword] = useState('');

  const [donors, setDonors] = useState<DonorProfile[]>([]);
  const [totalListedCount, setTotalListedCount] = useState<number>(0);
  const [availableCount, setAvailableCount] = useState<number>(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live emergency requests preview on home page
  const [liveEmergencyRequests, setLiveEmergencyRequests] = useState<
    BloodRequest[]
  >([]);

  // Selected donor for full profile modal view
  const [selectedDonorForModal, setSelectedDonorForModal] =
    useState<DonorProfile | null>(null);

  // Contact resolution state
  const [resolvingDonorKey, setResolvingDonorKey] = useState<string | null>(
    null
  );
  const [contactModalData, setContactModalData] = useState<{
    personName: string;
    bloodGroup: string;
    selectedMethod: ContactMethod;
    phoneNumber: string;
    quota?: {
      hourlyUsed: number;
      hourlyLimit: number;
      dailyUsed: number;
      dailyLimit: number;
    };
  } | null>(null);

  // Report modal state
  const [reportTarget, setReportTarget] = useState<DonorProfile | null>(null);

  // Real-Time Google Maps, Live GPS & Reverse-Geocoded Address States
  const [userLocation, setUserLocation] = useState<GeoCoordinate | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<'gps' | 'manual' | null>(null);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationModeRef = useRef<'gps' | 'manual' | null>(null);
  const lastGeocodedRef = useRef<{
    lat: number;
    lng: number;
    lang: 'bn' | 'en';
  } | null>(null);

  useEffect(() => {
    locationModeRef.current = locationMode;
  }, [locationMode]);

  const resolveUserAddress = useCallback(
    async (coords: GeoCoordinate, activeLang: 'bn' | 'en', force = false) => {
      const prev = lastGeocodedRef.current;
      if (
        !force &&
        prev &&
        prev.lang === activeLang &&
        haversineDistance(prev.lat, prev.lng, coords.lat, coords.lng) < 0.15
      ) {
        return;
      }

      lastGeocodedRef.current = {
        lat: coords.lat,
        lng: coords.lng,
        lang: activeLang,
      };
      setResolvingAddress(true);

      try {
        const apiBase = (
          (import.meta as { env?: Record<string, string | undefined> }).env
            ?.VITE_API_BASE_URL || ''
        ).replace(/\/$/, '');
        const res = await fetch(
          `${apiBase}/api/reverse-geocode?lat=${encodeURIComponent(
            coords.lat
          )}&lng=${encodeURIComponent(coords.lng)}&lang=${activeLang}`
        );

        if (res.status === 429) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          return;
        }

        const data = (await res.json()) as {
          formattedAddress?: string;
          areaLabel?: string;
          error?: { status?: string };
        };

        if (data?.error?.status === 'RESOURCE_EXHAUSTED') {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          return;
        }

        const resolved =
          data.formattedAddress?.trim() || data.areaLabel?.trim() || '';
        if (resolved) {
          setUserAddress(resolved);
        }
      } catch {
        // Keep existing address or fall back gracefully
      } finally {
        setResolvingAddress(false);
      }
    },
    []
  );

  // Automatically watch user's live GPS location when viewing the verified directory
  useEffect(() => {
    if (!canViewDirectory) {
      return;
    }
    if (!navigator.geolocation) {
      if (locationModeRef.current !== 'manual') {
        setLocationError(
          lang === 'bn'
            ? 'ব্রাউজারে GPS নেই — নিচ থেকে জেলা বেছে নিন অথবা ম্যাপে ট্যাপ করুন।'
            : 'Geolocation not available — pick your district or tap the map.'
        );
      }
      return;
    }

    setLocatingUser(true);
    setLocationError(null);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (locationModeRef.current === 'manual') {
          setLocatingUser(false);
          return;
        }
        const nextCoords: GeoCoordinate = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(nextCoords);
        setLocationMode('gps');
        setLocatingUser(false);
        setLocationError(null);
        void resolveUserAddress(nextCoords, lang);
      },
      (err) => {
        setLocatingUser(false);
        if (locationModeRef.current === 'manual') {
          return;
        }
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError(
            lang === 'bn'
              ? 'GPS পারমিশন পাওয়া যায়নি। এখান থেকে আপনার জেলা বেছে নিন অথবা ম্যাপে ট্যাপ করুন।'
              : 'GPS permission blocked. Select your district here or tap anywhere on the map.'
          );
        } else {
          setLocationError(
            lang === 'bn'
              ? 'বর্তমান GPS অবস্থান পাওয়া যায়নি। এখান থেকে আপনার জেলা বেছে নিন।'
              : 'Unable to detect GPS location. Select your district here or tap on the map.'
          );
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [canViewDirectory, lang, resolveUserAddress]);

  const handleRequestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError(
        lang === 'bn'
          ? 'ব্রাউজারে GPS সাপোর্ট নেই। অনুগ্রহ করে জেলা বেছে নিন বা ম্যাপে ট্যাপ করুন।'
          : 'Geolocation is not supported. Please select a district or tap the map.'
      );
      return;
    }
    setLocatingUser(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextCoords: GeoCoordinate = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(nextCoords);
        setLocationMode('gps');
        locationModeRef.current = 'gps';
        setLocatingUser(false);
        void resolveUserAddress(nextCoords, lang, true);
      },
      () => {
        setLocatingUser(false);
        setLocationError(
          lang === 'bn'
            ? 'GPS পারমিশন বন্ধ আছে। নিচের ড্রপডাউন থেকে জেলা বেছে নিন অথবা ম্যাপে ট্যাপ করুন।'
            : 'GPS permission is blocked. Choose your district below or tap anywhere on the map.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [lang, resolveUserAddress]);

  const handleSetManualLocation = useCallback(
    (coords: GeoCoordinate, customLabel?: string) => {
      locationModeRef.current = 'manual';
      setLocationMode('manual');
      setUserLocation(coords);
      setLocatingUser(false);
      setLocationError(null);
      if (customLabel) {
        setUserAddress(customLabel);
      }
      void resolveUserAddress(coords, lang, true);
    },
    [lang, resolveUserAddress]
  );

  const mapFocusCoords = useMemo(
    () =>
      getAreaCoords(
        districtId || ownDonor?.districtId,
        upazilaId || ownDonor?.upazilaId
      ),
    [districtId, upazilaId, ownDonor?.districtId, ownDonor?.upazilaId]
  );

  const districts = getDistrictsByDivision(divisionId);
  const upazilas = getUpazilasByDistrict(districtId);

  // Load emergency requests for urgent homepage banner
  useEffect(() => {
    let isSubscribed = true;
    async function loadUrgent() {
      if (!firebaseUser || !isEmailVerified) {
        if (isSubscribed) {
          setLiveEmergencyRequests([]);
        }
        return;
      }
      try {
        const reqs = await listOpenBloodRequests({
          statusFilter: 'open_only',
        });
        if (isSubscribed) {
          setLiveEmergencyRequests(reqs.slice(0, 3));
        }
      } catch {
        if (isSubscribed) {
          setLiveEmergencyRequests([]);
        }
      }
    }
    loadUrgent();
    return () => {
      isSubscribed = false;
    };
  }, [firebaseUser, isEmailVerified]);

  const executeSearch = useCallback(
    async (override?: {
      divisionId?: string;
      districtId?: string;
      upazilaId?: string;
      bloodGroup?: BloodGroup;
      onlyAvailable?: boolean;
    }) => {
      const hasVerifiedSession = Boolean(firebaseUser && isEmailVerified);
      if (!hasVerifiedSession) {
        setDonors([]);
        setTotalListedCount(0);
        setAvailableCount(0);
        setHasSearched(true);
        return;
      }

      const activeGroup = override?.bloodGroup || bloodGroup;
      const activeDiv =
        override?.divisionId !== undefined ? override.divisionId : divisionId;
      const activeDist =
        override?.districtId !== undefined ? override.districtId : districtId;
      const activeUpz =
        override?.upazilaId !== undefined ? override.upazilaId : upazilaId;
      const activeOnlyAvailable =
        override?.onlyAvailable !== undefined
          ? override.onlyAvailable
          : onlyAvailable;

      setLoading(true);
      setError(null);
      setHasSearched(true);

      try {
        const liveResult = await searchActiveDonors({
          bloodGroup: activeGroup,
          divisionId: activeDiv || undefined,
          districtId: activeDist || undefined,
          upazilaId: activeUpz || undefined,
          onlyAvailable: activeOnlyAvailable,
        });

        setDonors(liveResult.donors);
        setTotalListedCount(liveResult.totalListedCount);
        setAvailableCount(liveResult.availableCount);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'রক্তদাতার তালিকা লোড করতে সমস্যা হয়েছে।'
        );
      } finally {
        setLoading(false);
      }
    },
    [
      firebaseUser,
      isEmailVerified,
      bloodGroup,
      divisionId,
      districtId,
      upazilaId,
      onlyAvailable,
    ]
  );

  // Real-time Firestore listener for matching donors
  useEffect(() => {
    if (!canViewDirectory) {
      setDonors([]);
      setTotalListedCount(0);
      setAvailableCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    const unsubscribe = subscribeActiveDonors(
      {
        bloodGroup,
        divisionId: divisionId || undefined,
        districtId: districtId || undefined,
        upazilaId: upazilaId || undefined,
        onlyAvailable,
      },
      (liveResult) => {
        setDonors(liveResult.donors);
        setTotalListedCount(liveResult.totalListedCount);
        setAvailableCount(liveResult.availableCount);
        setLoading(false);
      },
      (err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'রক্তদাতার তালিকা লোড করতে সমস্যা হয়েছে।'
        );
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [
    canViewDirectory,
    bloodGroup,
    divisionId,
    districtId,
    upazilaId,
    onlyAvailable,
  ]);

  // Live client-side keyword search & strict nearest-to-farthest proximity sorting
  const filteredDonors = useMemo(() => {
    let result = donors;

    // 1. Keyword search
    const q = keyword.trim().toLowerCase();
    if (q) {
      result = result.filter((d) => {
        const locBn = formatLocationLabel(
          d.divisionId,
          d.districtId,
          d.upazilaId,
          'bn'
        ).toLowerCase();
        const locEn = formatLocationLabel(
          d.divisionId,
          d.districtId,
          d.upazilaId,
          'en'
        ).toLowerCase();
        const name = d.displayName.toLowerCase();
        const hospital = (d.preferredHospitalArea || '').toLowerCase();
        return (
          name.includes(q) ||
          locBn.includes(q) ||
          locEn.includes(q) ||
          hospital.includes(q)
        );
      });
    }

    // 2. Sort strictly from nearest to farthest relative to user's live location
    if (userLocation) {
      const rank: Record<DonorProfile['availability'], number> = {
        available: 0,
        not_specified: 1,
        temporarily_unavailable: 2,
      };
      result = [...result].sort((a, b) => {
        const coordsA = getObfuscatedDonorCoords(
          a.districtId,
          a.uid,
          a.upazilaId
        );
        const distA = haversineDistance(
          userLocation.lat,
          userLocation.lng,
          coordsA.lat,
          coordsA.lng
        );
        const coordsB = getObfuscatedDonorCoords(
          b.districtId,
          b.uid,
          b.upazilaId
        );
        const distB = haversineDistance(
          userLocation.lat,
          userLocation.lng,
          coordsB.lat,
          coordsB.lng
        );
        if (distA !== distB) {
          return distA - distB;
        }
        return rank[a.availability] - rank[b.availability];
      });
    }

    return result;
  }, [donors, keyword, userLocation]);

  const handleGroupSelect = (bg: BloodGroup) => {
    setBloodGroup(bg);
    executeSearch({ bloodGroup: bg });
  };

  const handleResetFilters = () => {
    setDivisionId('');
    setDistrictId('');
    setUpazilaId('');
    setKeyword('');
    setOnlyAvailable(false);
    executeSearch({
      divisionId: '',
      districtId: '',
      upazilaId: '',
      onlyAvailable: false,
    });
  };

  const handleContactAction = async (
    donor: DonorProfile,
    method: ContactMethod
  ) => {
    if (!firebaseUser) {
      onOpenAuth();
      return;
    }
    if (!isEmailVerified) {
      setError('যোগাযোগের নম্বর দেখতে আগে আপনার ইমেইল ভেরিফাই করুন।');
      return;
    }
    if (userProfile && userProfile.accountStatus !== 'active') {
      setError('আপনার অ্যাকাউন্টটি বর্তমানে সক্রিয় নয়।');
      return;
    }

    const key = `${donor.uid}:${method}`;
    setResolvingDonorKey(key);
    setError(null);

    try {
      const resolved = await resolveDonorContact({
        donorUid: donor.uid,
        requestedMethod: method,
      });
      setContactModalData({
        personName: donor.displayName,
        bloodGroup: donor.bloodGroup,
        selectedMethod: method,
        phoneNumber: resolved.phoneNumber,
        quota: resolved.quota,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'যোগাযোগ নম্বর পাওয়া যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।'
      );
    } finally {
      setResolvingDonorKey(null);
    }
  };

  const hasActiveFilters = Boolean(
    divisionId || districtId || upazilaId || onlyAvailable || keyword
  );

  return (
    <div className="space-y-8 pb-16">
      {/* =========================================================================
          1. Hero Banner: Clean, Bold, Life-Saving Presence
         ========================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#A0051E] via-[#C80828] to-[#800315] text-white pt-8 pb-12 sm:pt-12 sm:pb-16 rounded-b-[2.5rem] shadow-sm">
        {/* Subtle geometric background accents */}
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-white/5 blur-2xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-black/10 blur-xl pointer-events-none"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-xs rounded-lg text-white/95 text-xs font-semibold tracking-wide">
                <img
                  src="/logo.png"
                  alt="রক্তদেই"
                  className="w-5 h-5 object-contain rounded-md bg-white p-0.5"
                />
                <span>
                  {lang === 'bn'
                    ? 'স্বেচ্ছায় রক্তদাতা ও জরুরি রক্তের সংযোগ নেটওয়ার্ক'
                    : 'Voluntary Blood Donors Network · Bangladesh'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white text-balance">
                {lang === 'bn'
                  ? 'জরুরি প্রয়োজনে সঠিক রক্তদাতার সাথে সরাসরি যোগাযোগ'
                  : 'Find Voluntary Blood Donors Across Bangladesh'}
              </h1>
              <p className="text-sm sm:text-base text-white/85 leading-relaxed max-w-xl">
                {lang === 'bn'
                  ? '৮টি বিভাগ ও ৬৪ জেলার রক্তদাতাদের সুরক্ষিত তালিকা। রক্ত নিশ্চিত হলে ডোনার বুক করুন যাতে রোগীর পরিবার অযথা কলের ঝামেলা থেকে মুক্তি পায়।'
                  : 'Search verified donors across all 64 districts. Call directly and lock contact once confirmed to protect patient peace.'}
              </p>
            </div>

            {/* Quick Hero CTA Buttons */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('blood_requests')}
                className="min-h-[48px] px-6 py-3 bg-white text-[#C80828] hover:bg-neutral-50 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg whitespace-nowrap"
              >
                <Droplets className="w-4 h-4 fill-current" />
                <span>
                  {lang === 'bn'
                    ? 'জরুরি রক্তের অনুরোধ পোস্ট করুন'
                    : 'Post a Blood Request'}
                </span>
              </button>

              {(!firebaseUser || !ownDonor?.isListed) && (
                <button
                  type="button"
                  onClick={() => {
                    if (!firebaseUser) {
                      onOpenAuth();
                    } else {
                      onNavigate('profile');
                    }
                  }}
                  className="min-h-[48px] px-6 py-3 bg-white/15 hover:bg-white/25 text-white border border-white/30 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {lang === 'bn'
                      ? 'স্বেচ্ছায় রক্তদাতা হন'
                      : 'Register as Blood Donor'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* =========================================================================
              UNIFIED MASTER DONOR FINDER & FILTER CONSOLE
             ========================================================================= */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl border border-white/20 text-neutral-900 space-y-4">
            {/* 1. Blood Group Selector Row */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <span className="font-bold text-neutral-800 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-[#C80828] fill-current" />
                  <span>
                    {lang === 'bn'
                      ? 'রক্তের গ্রুপ নির্বাচন করুন:'
                      : 'Select Blood Group:'}
                  </span>
                </span>
                <span className="text-neutral-500 font-mono text-[11px] sm:text-xs">
                  {lang === 'bn'
                    ? `বর্তমানে নির্বাচিত: ${bloodGroup}`
                    : `Active Group: ${bloodGroup}`}
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 sm:gap-2.5">
                {BLOOD_GROUPS.map((bg) => {
                  const selected = bloodGroup === bg;
                  return (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => handleGroupSelect(bg)}
                      className={`min-h-[46px] sm:min-h-[50px] rounded-xl font-mono text-base font-extrabold transition-all cursor-pointer flex items-center justify-center ${
                        selected
                          ? 'bg-[#C80828] text-white shadow-md scale-102 ring-2 ring-[#C80828]/30'
                          : 'bg-neutral-100 hover:bg-[#FDF2F4] text-neutral-800 hover:text-[#C80828]'
                      }`}
                    >
                      <span>{bg}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Keyword Search & Location Hierarchy Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-2 border-t border-neutral-100">
              {/* Search Keyword Input */}
              <div className="sm:col-span-2 lg:col-span-4 relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'রক্তদাতার নাম, এলাকা বা হাসপাতালের নাম...'
                      : 'Search by donor name, area, hospital...'
                  }
                  className="w-full h-11 pl-10 pr-8 bg-neutral-50 hover:bg-neutral-100/70 focus:bg-white rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#C80828]/30 transition-all border border-neutral-200"
                />
                {keyword && (
                  <button
                    type="button"
                    onClick={() => setKeyword('')}
                    aria-label="Clear search"
                    className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-700 absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Division Dropdown */}
              <div className="lg:col-span-2">
                <select
                  value={divisionId}
                  onChange={(e) => {
                    setDivisionId(e.target.value);
                    setDistrictId('');
                    setUpazilaId('');
                    executeSearch({
                      divisionId: e.target.value,
                      districtId: '',
                      upazilaId: '',
                    });
                  }}
                  className="w-full h-11 px-3 text-xs sm:text-sm bg-neutral-50 hover:bg-neutral-100/70 focus:bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C80828]/30 transition-colors font-medium text-neutral-800"
                >
                  <option value="">
                    {lang === 'bn' ? 'সকল বিভাগ' : 'All Divisions'}
                  </option>
                  {DIVISIONS.map((div) => (
                    <option key={div.id} value={div.id}>
                      {div[lang]}
                    </option>
                  ))}
                </select>
              </div>

              {/* District Dropdown */}
              <div className="lg:col-span-2">
                <select
                  value={districtId}
                  disabled={!divisionId}
                  onChange={(e) => {
                    setDistrictId(e.target.value);
                    setUpazilaId('');
                    executeSearch({ districtId: e.target.value, upazilaId: '' });
                  }}
                  className="w-full h-11 px-3 text-xs sm:text-sm bg-neutral-50 hover:bg-neutral-100/70 focus:bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C80828]/30 disabled:opacity-50 transition-colors font-medium text-neutral-800"
                >
                  <option value="">
                    {lang === 'bn' ? 'সকল জেলা' : 'All Districts'}
                  </option>
                  {districts.map((dist) => (
                    <option key={dist.id} value={dist.id}>
                      {dist[lang]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upazila Dropdown */}
              <div className="lg:col-span-2">
                <select
                  value={upazilaId}
                  disabled={!districtId}
                  onChange={(e) => {
                    setUpazilaId(e.target.value);
                    executeSearch({ upazilaId: e.target.value });
                  }}
                  className="w-full h-11 px-3 text-xs sm:text-sm bg-neutral-50 hover:bg-neutral-100/70 focus:bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C80828]/30 disabled:opacity-50 transition-colors font-medium text-neutral-800"
                >
                  <option value="">
                    {lang === 'bn' ? 'সকল উপজেলা / থানা' : 'All Upazilas'}
                  </option>
                  {upazilas.map((upz) => (
                    <option key={upz.id} value={upz.id}>
                      {upz[lang]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit / Find Button */}
              <div className="sm:col-span-2 lg:col-span-2">
                <button
                  type="button"
                  onClick={() => executeSearch()}
                  disabled={loading}
                  className="w-full h-11 px-4 bg-[#C80828] hover:bg-[#A0051E] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60 whitespace-nowrap"
                >
                  <Search className="w-4 h-4 shrink-0" />
                  <span>{lang === 'bn' ? 'অনুসন্ধান' : 'Search'}</span>
                </button>
              </div>
            </div>

            {/* 3. Availability Toggle & Real-time Live Counters */}
            <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 font-semibold text-neutral-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setOnlyAvailable(checked);
                    executeSearch({ onlyAvailable: checked });
                  }}
                  className="w-4 h-4 accent-[#C80828] rounded cursor-pointer"
                />
                <span className="text-emerald-700 font-semibold">
                  {lang === 'bn'
                    ? 'শুধুমাত্র রক্তদানে প্রস্তুত রক্তদাতা'
                    : 'Available Donors Only'}
                </span>
              </label>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 text-neutral-600 font-mono text-[11px] sm:text-xs">
                  <span>
                    {lang === 'bn' ? 'তালিকাভুক্ত: ' : 'Listed: '}
                    <strong className="text-neutral-900 tabular-nums">
                      {totalListedCount}
                    </strong>
                  </span>
                  <span className="text-neutral-300">·</span>
                  <span>
                    {lang === 'bn' ? 'প্রস্তুত: ' : 'Ready: '}
                    <strong className="text-emerald-700 tabular-nums">
                      {availableCount}
                    </strong>
                  </span>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 hover:text-red-600 hover:bg-neutral-100 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{lang === 'bn' ? 'রিসেট' : 'Reset'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        {/* =========================================================================
            2. High-Priority Emergency Blood Requests Strip
           ========================================================================= */}
        {liveEmergencyRequests.length > 0 && (
          <section className="bg-white rounded-3xl border border-red-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-[#C80828] fill-current shrink-0" />
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <span>
                    {lang === 'bn'
                      ? 'জরুরি রক্তের প্রয়োজন (আজকের অনুরোধ)'
                      : 'Urgent Emergency Blood Needs'}
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('blood_requests')}
                className="text-xs sm:text-sm font-semibold text-[#C80828] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{lang === 'bn' ? 'সকল অনুরোধ দেখুন' : 'View all'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
              {liveEmergencyRequests.map((req) => {
                const isMyPost = Boolean(
                  firebaseUser &&
                    (req.createdBy === firebaseUser.uid ||
                      req.createdBy === firebaseUser.email)
                );

                return (
                  <div
                    key={req.id}
                    onClick={() => onNavigate('blood_requests', req.id)}
                    className="p-4 rounded-2xl bg-gradient-to-br from-[#FFF5F6] to-white border border-[#FADCE2] hover:border-[#C80828] transition-all cursor-pointer space-y-2.5 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xl font-mono font-extrabold text-[#C80828]">
                        {req.bloodGroup}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isMyPost && (
                          <span className="text-[10px] font-bold text-neutral-700 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-md">
                            {lang === 'bn' ? 'আমার পোস্ট' : 'My Post'}
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-red-700 bg-red-100/80 px-2 py-0.5 rounded-md">
                          {req.units} {lang === 'bn' ? 'ব্যাগ প্রয়োজন' : 'Bags Needed'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
                        {req.hospitalName}
                      </h3>
                      <p className="text-xs text-neutral-600 truncate">
                        {formatLocationLabel(
                          req.divisionId,
                          req.districtId,
                          req.upazilaId,
                          lang
                        )}
                      </p>
                    </div>

                    <div className="pt-1 flex items-center justify-between text-[11px] text-neutral-500 border-t border-neutral-100">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-red-500" />
                        <span>{req.requiredDate}</span>
                      </span>
                      {isMyPost ? (
                        <span className="text-neutral-600 font-semibold inline-flex items-center gap-1">
                          <span>
                            {lang === 'bn' ? 'অনুরোধ দেখুন →' : 'View Request →'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[#C80828] font-bold hover:underline inline-flex items-center gap-1">
                          <HeartHandshake className="w-3 h-3 text-[#C80828]" />
                          <span>
                            {lang === 'bn'
                              ? 'রক্ত দিতে বুক করুন →'
                              : 'Book to Donate →'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-900 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-[#C80828] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* =========================================================================
            3. Verified Blood Donors Directory (Real-Time Map + Nearest-First Feed)
           ========================================================================= */}
        <section className="space-y-5">
          {/* Donor Feed / Unauthenticated Guard */}
          {!canViewDirectory && !firebaseUser ? (
            <div className="bg-white rounded-3xl border border-neutral-200/80 p-8 sm:p-12 text-center flex flex-col items-center space-y-5">
              <DonationCareIllustration className="w-64 h-48" />
              <div className="max-w-md space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-neutral-900">
                  {lang === 'bn'
                    ? 'স্বেচ্ছায় রক্তদান ও সুরক্ষিত সংযোগ'
                    : 'Connect Directly with Voluntary Donors'}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  {lang === 'bn'
                    ? 'রক্তদাতাদের ব্যক্তিগত নম্বর সুরক্ষিত রাখতে শুধুমাত্র লগইনকৃত ও যাচাইকৃত ব্যবহারকারীরা রক্তদাতা তালিকা এবং সরাসরি Call, WhatsApp ও SMS করতে পারেন।'
                    : 'Sign in with a verified account to view real donor listings and connect directly via Call, WhatsApp, or SMS.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full max-w-xs min-h-[48px] px-6 py-3 bg-[#C80828] hover:bg-[#A3051E] text-white text-sm font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                {lang === 'bn'
                  ? 'শুরু করুন — লগইন / নিবন্ধন'
                  : "Let's Begin — Sign In"}
              </button>
            </div>
          ) : !canViewDirectory && !isEmailVerified ? (
            <div className="bg-white rounded-3xl border border-amber-200 p-8 sm:p-10 text-center space-y-3">
              <h2 className="text-lg font-bold text-neutral-900">
                {lang === 'bn'
                  ? 'অনুগ্রহ করে আগে আপনার ইমেইল ভেরিফাই করুন'
                  : 'Please verify your email address first'}
              </h2>
              <p className="text-sm text-neutral-600 max-w-lg mx-auto leading-relaxed">
                {lang === 'bn'
                  ? 'উপরের ব্যানার থেকে ইমেইল যাচাই সম্পন্ন করে রিফ্রেশ বাটনে ক্লিক করলেই রক্তদাতা তালিকা আনলক হয়ে যাবে।'
                  : 'Verify the link sent to your email and click Refresh in the banner above to unlock donor listings.'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Live Real-Time Google Map with User Location Address & Nearest Donor Pins */}
              <DonorMapComponent
                donors={filteredDonors}
                userLocation={userLocation}
                userAddress={userAddress}
                locationMode={locationMode}
                locatingUser={locatingUser}
                resolvingAddress={resolvingAddress}
                locationError={locationError}
                selectedDistrictId={districtId || ownDonor?.districtId}
                focusCoords={mapFocusCoords}
                onRequestLocation={handleRequestUserLocation}
                onSetManualLocation={handleSetManualLocation}
                onSelectDonor={(d) => setSelectedDonorForModal(d)}
                lang={lang}
              />

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-28 rounded-2xl bg-white border border-neutral-200 p-5 animate-pulse flex items-center gap-4"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-neutral-100 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-40 bg-neutral-200 rounded" />
                        <div className="h-3 w-60 bg-neutral-100 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredDonors.length === 0 && hasSearched ? (
                <div className="bg-white rounded-3xl border border-neutral-200/80 p-8 sm:p-12 text-center space-y-4">
                  <DonationCareIllustration className="w-48 h-36 mx-auto" />
                  <h3 className="text-lg font-bold text-neutral-900">
                    {lang === 'bn'
                      ? 'এই এলাকায় বা ফিল্টারে কোনো রক্তদাতা পাওয়া যায়নি'
                      : 'No active donors found matching these filters'}
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
                    {lang === 'bn'
                      ? 'ফিল্টার পরিধি বাড়িয়ে পুরো জেলা বা বিভাগে খুঁজে দেখতে পারেন, অথবা সরাসরি জরুরি রক্তের অনুরোধ পোস্ট করতে পারেন।'
                      : 'Broaden your search to full district/division or post an emergency request.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="min-h-[44px] px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-xl cursor-pointer"
                      >
                        {lang === 'bn'
                          ? 'সকল এলাকা ও ফিল্টার রিসেট'
                          : 'Reset All Filters'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigate('blood_requests')}
                      className="min-h-[44px] px-6 py-2.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                    >
                      {lang === 'bn'
                        ? 'জরুরি রক্তের অনুরোধ পোস্ট করুন'
                        : 'Post a Blood Request'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Sleek, Modern Donor Cards Feed Sorted Closest to Farthest */
                <div className="space-y-3">
                  {filteredDonors.map((donor, idx) => {
                    const donationDays = daysSinceDate(donor.lastDonationDate);
                    const initials = getInitials(donor.displayName);
                    const isAvailable = donor.availability === 'available';
                    const donorCoords = getObfuscatedDonorCoords(
                      donor.districtId,
                      donor.uid,
                      donor.upazilaId
                    );
                    const distanceKm = userLocation
                      ? haversineDistance(
                          userLocation.lat,
                          userLocation.lng,
                          donorCoords.lat,
                          donorCoords.lng
                        )
                      : null;

                    return (
                      <article
                        key={donor.uid}
                        className="bg-white hover:bg-neutral-50/80 transition-all rounded-2xl border border-neutral-200/90 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs hover:shadow-xs"
                      >
                        {/* Left & Info Zone */}
                        <div className="flex items-start gap-4 min-w-0">
                          {/* Monogram Blood Avatar */}
                          <div
                            aria-hidden="true"
                            className="w-14 h-14 rounded-2xl bg-[#FDF2F4] border border-[#FADCE2] flex flex-col items-center justify-center shrink-0 text-[#C80828]"
                          >
                            <span className="text-base font-extrabold leading-none">
                              {initials}
                            </span>
                            <span className="text-[11px] font-mono font-extrabold text-[#C80828] mt-1">
                              {donor.bloodGroup}
                            </span>
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-neutral-900 truncate">
                                {donor.displayName}
                              </h3>
                              {donor.username && (
                                <span className="font-mono text-[11px] font-semibold text-[#C80828] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  @{donor.username}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-md">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>{lang === 'bn' ? 'যাচাইকৃত' : 'Verified'}</span>
                              </span>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.2 rounded-md ${
                                  isAvailable
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-800'
                                }`}
                              >
                                {availabilityLabel(donor.availability, lang)}
                              </span>

                              {/* Distance Badge if location active (closest donors highlighted first) */}
                              {distanceKm !== null && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C80828] bg-[#FDF2F4] px-2 py-0.5 rounded-md border border-[#FADCE2]">
                                  <Crosshair className="w-3 h-3 text-[#C80828]" />
                                  <span>
                                    {idx === 0 &&
                                      (lang === 'bn'
                                        ? 'সবচেয়ে কাছে · '
                                        : 'Nearest · ')}
                                    {formatDistanceKm(distanceKm, lang)}
                                  </span>
                                </span>
                              )}

                              {/* Recognition Tier Badge */}
                              {(() => {
                                const tier = getDonorTier(
                                  donor.totalDonationsCount || 0
                                );
                                return (
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border"
                                    style={{
                                      backgroundColor: tier.badgeBg,
                                      borderColor: tier.ribbonColor,
                                      color: tier.badgeTextColor,
                                    }}
                                  >
                                    <span>{tier.icon}</span>
                                    <span>
                                      {lang === 'bn'
                                        ? tier.nameBn
                                        : tier.nameEn}
                                    </span>
                                  </span>
                                );
                              })()}
                            </div>

                            <p className="text-xs sm:text-sm text-neutral-600 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span className="truncate">
                                {formatLocationLabel(
                                  donor.divisionId,
                                  donor.districtId,
                                  donor.upazilaId,
                                  lang
                                )}
                              </span>
                            </p>

                            {/* Clean Unboxed Metadata Line */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500 pt-0.5">
                              {donationDays !== null && (
                                <>
                                  <span className="tabular-nums">
                                    {lang === 'bn'
                                      ? `${donationDays} দিন আগে শেষ রক্তদান`
                                      : `${donationDays}d since last donation`}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                </>
                              )}
                              {typeof donor.totalDonationsCount === 'number' &&
                                donor.totalDonationsCount > 0 && (
                                  <>
                                    <span className="font-semibold text-neutral-800 tabular-nums">
                                      {lang === 'bn'
                                        ? `মোট ${donor.totalDonationsCount} বার রক্তদান`
                                        : `${donor.totalDonationsCount} donations`}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                  </>
                                )}
                              <span>
                                {lang === 'bn'
                                  ? `আপডেট: ${formatTimestamp(
                                      donor.lastAvailabilityUpdatedAt,
                                      lang
                                    )}`
                                  : `Updated: ${formatTimestamp(
                                      donor.lastAvailabilityUpdatedAt,
                                      lang
                                    )}`}
                              </span>
                            </div>

                            {donor.preferredHospitalArea && (
                              <p className="text-[11px] text-neutral-500 truncate">
                                {lang === 'bn'
                                  ? `সুবিধাজনক এলাকা: ${donor.preferredHospitalArea}`
                                  : `Preferred Hospital: ${donor.preferredHospitalArea}`}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right Action Zone */}
                        <div className="flex items-center justify-between md:justify-end gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-neutral-100 shrink-0">
                          {/* Full Profile View Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedDonorForModal(donor)}
                            className="min-h-[40px] px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-neutral-600" />
                            <span>
                              {lang === 'bn'
                                ? 'প্রোফাইল দেখুন'
                                : 'View Profile'}
                            </span>
                          </button>

                          {/* Contact Method Buttons */}
                          <div className="flex items-center gap-1.5">
                            {donor.contactMethods.map((method) => {
                              const busy =
                                resolvingDonorKey === `${donor.uid}:${method}`;
                              return (
                                <button
                                  key={method}
                                  type="button"
                                  disabled={Boolean(resolvingDonorKey)}
                                  onClick={() =>
                                    handleContactAction(donor, method)
                                  }
                                  title={contactMethodLabel(method, lang)}
                                  aria-label={`${donor.displayName} - ${contactMethodLabel(
                                    method,
                                    lang
                                  )}`}
                                  className="w-10 h-10 rounded-xl bg-[#FADCE2] hover:bg-[#C80828] text-[#C80828] hover:text-white disabled:opacity-50 transition-colors flex items-center justify-center shrink-0 cursor-pointer shadow-2xs"
                                >
                                  {busy ? (
                                    <span className="text-[10px] font-bold">
                                      ...
                                    </span>
                                  ) : method === 'call' ? (
                                    <Phone className="w-4 h-4" />
                                  ) : method === 'sms' ? (
                                    <MessageSquare className="w-4 h-4" />
                                  ) : method === 'whatsapp' ? (
                                    <MessageCircle className="w-4 h-4" />
                                  ) : (
                                    <span className="text-[10px] font-mono font-extrabold">
                                      IMO
                                    </span>
                                  )}
                                </button>
                              );
                            })}

                            {firebaseUser?.uid !== donor.uid && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!firebaseUser) {
                                    onOpenAuth();
                                    return;
                                  }
                                  setReportTarget(donor);
                                }}
                                title={lang === 'bn' ? 'রিপোর্ট' : 'Report'}
                                aria-label="Report"
                                className="w-9 h-9 rounded-xl hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                              >
                                <Flag className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>


      </div>

      {/* Full Donor Profile Modal */}
      {selectedDonorForModal && (
        <DonorProfileModal
          isOpen={Boolean(selectedDonorForModal)}
          onClose={() => setSelectedDonorForModal(null)}
          donor={selectedDonorForModal}
          onRequestContact={(donor, method) => {
            void handleContactAction(donor, method);
          }}
          lang={lang}
        />
      )}

      {/* Contact Resolution Modal */}
      {contactModalData && (
        <ContactResolutionModal
          isOpen={Boolean(contactModalData)}
          onClose={() => setContactModalData(null)}
          personName={contactModalData.personName}
          bloodGroup={contactModalData.bloodGroup}
          selectedMethod={contactModalData.selectedMethod}
          phoneNumber={contactModalData.phoneNumber}
          quota={contactModalData.quota}
          lang={lang}
        />
      )}

      {/* Abuse Report Modal */}
      {reportTarget && (
        <ReportModal
          isOpen={Boolean(reportTarget)}
          onClose={() => setReportTarget(null)}
          targetType="donor"
          targetId={reportTarget.uid}
          targetUid={reportTarget.uid}
          targetLabel={`${reportTarget.displayName} (${reportTarget.bloodGroup})`}
          lang={lang}
        />
      )}

    </div>
  );
}
