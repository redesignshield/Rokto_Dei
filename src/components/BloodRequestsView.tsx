import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Flag,
  HeartHandshake,
  Lock,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  Unlock,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  DIVISIONS,
  formatLocationLabel,
  getDistrictsByDivision,
  getUpazilasByDistrict,
} from '../data/bdLocations';
import {
  contactMethodLabel,
  formatTimestamp,
  pledgeStatusLabel,
  requestStatusLabel,
  urgencyLabel,
} from '../lib/i18n';
import { BLOOD_GROUPS, CONTACT_METHODS } from '../lib/validation';
import {
  bookBloodRequestDonor,
  closeOwnBloodRequest,
  createBloodRequestBundle,
  getDonorProfileByUid,
  listMyBloodRequests,
  listMyDonorPledges,
  listOpenBloodRequests,
  listPledgesForMyRequests,
  reopenBookedBloodRequest,
  resolveBloodRequestContact,
  submitRequestPledge,
} from '../services/roktoService';
import type {
  BloodGroup,
  BloodRequest,
  BloodRequestUrgency,
  BookedDonorSummary,
  ContactMethod,
  DonorProfile,
  RequestPledge,
} from '../types';
import { ContactResolutionModal } from './ContactResolutionModal';
import { DonorProfileModal, type PledgeBookingContext } from './DonorProfileModal';
import { DonationCareIllustration } from './MedicalIllustrations';
import { ReportModal } from './ReportModal';

interface BloodRequestsViewProps {
  onOpenAuth: () => void;
  targetRequestId?: string | null;
  onClearTargetRequest?: () => void;
  targetDonorUid?: string | null;
  targetPledgeContext?: any | null;
  onClearTargetDonor?: () => void;
}

export function BloodRequestsView({
  onOpenAuth,
  targetRequestId,
  onClearTargetRequest,
  targetDonorUid,
  targetPledgeContext,
  onClearTargetDonor,
}: BloodRequestsViewProps) {
  const {
    firebaseUser,
    isEmailVerified,
    userProfile,
    ownDonor,
    ownDonorPhone,
    lang,
  } = useAuth();
  const canViewRequests = Boolean(firebaseUser && isEmailVerified);

  const [subTab, setSubTab] = useState<'all' | 'mine'>('all');
  const [statusFilter, setStatusFilter] = useState<
    'active_all' | 'open_only' | 'booked_only'
  >('active_all');
  const [filterGroup, setFilterGroup] = useState<BloodGroup | ''>('');
  const [filterDivision, setFilterDivision] = useState('');

  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [mySentPledges, setMySentPledges] = useState<RequestPledge[]>([]);
  const [ownerIncomingPledges, setOwnerIncomingPledges] = useState<
    RequestPledge[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Create Request Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [requesterName, setRequesterName] = useState('');
  const [rawPhone, setRawPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [units, setUnits] = useState(1);
  const [divisionId, setDivisionId] = useState('dhaka');
  const [districtId, setDistrictId] = useState('dhaka');
  const [upazilaId, setUpazilaId] = useState('dhanmondi');
  const [hospitalName, setHospitalName] = useState('');
  const [urgency, setUrgency] = useState<BloodRequestUrgency>('emergency');
  const [requiredDate, setRequiredDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [patientNote, setPatientNote] = useState('');
  const [contactMethods, setContactMethods] = useState<ContactMethod[]>([
    'call',
  ]);
  const [hasConsented, setHasConsented] = useState(false);
  const [creating, setCreating] = useState(false);

  // Offer to Donate (Pledge) Modal
  const [pledgeTargetReq, setPledgeTargetReq] = useState<BloodRequest | null>(
    null
  );
  const [pledgeDonorName, setPledgeDonorName] = useState('');
  const [pledgeBloodGroup, setPledgeBloodGroup] = useState<BloodGroup>('O+');
  const [pledgeUnits, setPledgeUnits] = useState(1);
  const [pledgeMessage, setPledgeMessage] = useState('');
  const [submittingPledge, setSubmittingPledge] = useState(false);

  // Donor Full Profile Modal State (Triggered by Notification Click or Details view)
  const [selectedDonorProfile, setSelectedDonorProfile] =
    useState<DonorProfile | null>(null);
  const [selectedDonorPhone, setSelectedDonorPhone] = useState<
    string | undefined
  >(undefined);
  const [selectedDonorPledgeContext, setSelectedDonorPledgeContext] =
    useState<PledgeBookingContext | null>(null);
  const [isDonorModalOpen, setIsDonorModalOpen] = useState(false);
  const [isBookingFromModal, setIsBookingFromModal] = useState(false);

  // Book Donor & Lock Calls Modal
  const [bookingTargetReq, setBookingTargetReq] = useState<BloodRequest | null>(
    null
  );
  const [bookingDonorName, setBookingDonorName] = useState('');
  const [bookingDonorUid, setBookingDonorUid] = useState('');
  const [bookingAcceptedPledgeId, setBookingAcceptedPledgeId] = useState('');
  const [bookingNote, setBookingNote] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Contact Resolution & Report Modals
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
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
  const [reportTarget, setReportTarget] = useState<BloodRequest | null>(null);

  const formDistricts = getDistrictsByDivision(divisionId);
  const formUpazilas = getUpazilasByDistrict(districtId);

  const loadRequests = useCallback(async () => {
    const hasVerifiedSession = Boolean(firebaseUser && isEmailVerified);
    if (!hasVerifiedSession || !firebaseUser) {
      setRequests([]);
      setMySentPledges([]);
      setOwnerIncomingPledges([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [outPledges, inPledges] = await Promise.all([
        listMyDonorPledges(firebaseUser.uid).catch(() => []),
        listPledgesForMyRequests(firebaseUser.uid).catch(() => []),
      ]);
      setMySentPledges(outPledges);
      setOwnerIncomingPledges(inPledges);

      if (subTab === 'mine') {
        const mine = await listMyBloodRequests(firebaseUser.uid);
        setRequests(mine);
      } else {
        const liveActiveList = await listOpenBloodRequests({
          bloodGroup: filterGroup,
          divisionId: filterDivision || undefined,
          statusFilter,
        });
        setRequests(liveActiveList);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'রক্তের অনুরোধ তালিকা লোড করা যায়নি।'
      );
    } finally {
      setLoading(false);
    }
  }, [
    firebaseUser,
    isEmailVerified,
    subTab,
    statusFilter,
    filterGroup,
    filterDivision,
  ]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const displayedRequests = requests;

  // Full Request Detail Modal state & back button handling
  const [selectedRequest, setSelectedRequest] = useState<BloodRequest | null>(
    null
  );

  // Keep selectedRequest updated when overrides or data change
  const currentSelectedRequest = selectedRequest
    ? displayedRequests.find((r) => r.id === selectedRequest.id) || selectedRequest
    : null;

  // Auto-open request when targetRequestId is passed (e.g. from notification click)
  useEffect(() => {
    if (targetRequestId && displayedRequests.length > 0) {
      const found = displayedRequests.find((r) => r.id === targetRequestId);
      if (found) {
        setSelectedRequest(found);
      }
    }
  }, [targetRequestId, displayedRequests]);

  // Auto-open donor profile when targetDonorUid is passed from notification click
  useEffect(() => {
    if (targetDonorUid) {
      (async () => {
        try {
          const res = await getDonorProfileByUid(targetDonorUid);
          if (res.donor) {
            setSelectedDonorProfile(res.donor);
            setSelectedDonorPhone(res.phoneNumber);
            if (targetPledgeContext) {
              setSelectedDonorPledgeContext(targetPledgeContext);
            } else if (targetRequestId) {
              const matchedReq =
                displayedRequests.find((r) => r.id === targetRequestId) ||
                requests.find((r) => r.id === targetRequestId);
              if (matchedReq) {
                setSelectedDonorPledgeContext({
                  requestId: matchedReq.id,
                  hospitalName: matchedReq.hospitalName,
                  requestBloodGroup: matchedReq.bloodGroup,
                  totalUnits: matchedReq.units,
                  fulfilledUnits: matchedReq.fulfilledUnits || 0,
                  offeredUnits: 1,
                });
              }
            }
            setIsDonorModalOpen(true);
          }
        } catch (e) {
          console.error('Failed to load target donor profile:', e);
        }
      })();
    }
  }, [
    targetDonorUid,
    targetPledgeContext,
    targetRequestId,
    displayedRequests,
    requests,
  ]);

  const handleOpenDonorProfile = useCallback(
    async (donorUid: string, pledgeCtx?: PledgeBookingContext) => {
      try {
        const res = await getDonorProfileByUid(donorUid);
        if (res.donor) {
          setSelectedDonorProfile(res.donor);
          setSelectedDonorPhone(res.phoneNumber);
          setSelectedDonorPledgeContext(pledgeCtx || null);
          setIsDonorModalOpen(true);
        }
      } catch (err) {
        setError(
          lang === 'bn'
            ? 'রক্তদাতার প্রোফাইল লোড করা যায়নি।'
            : 'Failed to load donor profile.'
        );
      }
    },
    [lang]
  );

  const handleConfirmDonorModalBook = useCallback(
    async (donor: DonorProfile, unitsToBook: number = 1) => {
      if (!selectedDonorPledgeContext) return;
      const reqId = selectedDonorPledgeContext.requestId;
      const targetReq =
        displayedRequests.find((r) => r.id === reqId) ||
        requests.find((r) => r.id === reqId);
      if (!targetReq) return;

      setIsBookingFromModal(true);
      setError(null);
      setSuccessNotice(null);

      try {
        // Live Firestore request
        await bookBloodRequestDonor({
          requestId: targetReq.id,
          bookedDonorUid: donor.uid,
          bookedDonorName: donor.displayName,
          bookingNote: `${donor.displayName} confirmed for ${unitsToBook} bag(s)`,
          acceptedPledgeId: selectedDonorPledgeContext.pledgeId,
        });

        setIsDonorModalOpen(false);
        onClearTargetDonor?.();

        setSuccessNotice(
          lang === 'bn'
            ? `${donor.displayName} কে ${unitsToBook} ব্যাগের জন্য সফলভাবে নিশ্চিত করা হয়েছে!`
            : `${donor.displayName} confirmed for ${unitsToBook} bag(s)!`
        );
        await loadRequests();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'বুকিং সম্পন্ন করা যায়নি।'
        );
      } finally {
        setIsBookingFromModal(false);
      }
    },
    [
      selectedDonorPledgeContext,
      displayedRequests,
      requests,
      lang,
      onClearTargetDonor,
      loadRequests,
    ]
  );

  const openRequestDetails = useCallback((reqItem: BloodRequest) => {
    setSelectedRequest(reqItem);
    if (window.history.state?.modal !== 'request_detail') {
      window.history.pushState(
        {
          view: 'blood_requests',
          modal: 'request_detail',
          targetId: reqItem.id,
        },
        '',
        window.location.pathname
      );
    }
  }, []);

  const closeRequestDetails = useCallback(() => {
    setSelectedRequest(null);
    onClearTargetRequest?.();
    if (window.history.state?.modal === 'request_detail') {
      window.history.back();
    }
  }, [onClearTargetRequest]);

  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      if (!e.state || e.state.modal !== 'request_detail') {
        setSelectedRequest(null);
        onClearTargetRequest?.();
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [onClearTargetRequest]);

  const openCreateDialog = () => {
    if (!firebaseUser) {
      onOpenAuth();
      return;
    }
    setRequesterName(userProfile?.fullName || firebaseUser.displayName || '');
    setRawPhone(ownDonorPhone || '');
    setShowCreateModal(true);
  };

  const toggleMethod = (method: ContactMethod) => {
    setContactMethods((prev) =>
      prev.includes(method)
        ? prev.filter((m) => m !== method)
        : [...prev, method]
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setSuccessNotice(null);
    try {
      await createBloodRequestBundle({
        requesterName,
        rawPhone,
        bloodGroup,
        units,
        divisionId,
        districtId,
        upazilaId,
        hospitalName,
        urgency,
        requiredDate,
        patientNote,
        contactMethods,
        hasConsented,
      });
      setShowCreateModal(false);
      setHospitalName('');
      setPatientNote('');
      setHasConsented(false);
      setSuccessNotice(
        lang === 'bn'
          ? 'রক্তের অনুরোধ প্রকাশিত হয়েছে। ডোনার চূড়ান্ত হলে কার্ড থেকে "ডোনার বুক করুন" বাটনে চাপলে নতুন কল বন্ধ হয়ে যাবে।'
          : 'Blood request published. Book your donor once confirmed to pause further calls.'
      );
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'অনুরোধ পোস্ট করা যায়নি।');
    } finally {
      setCreating(false);
    }
  };

  const openPledgeDialog = (reqItem: BloodRequest) => {
    if (!firebaseUser) {
      onOpenAuth();
      return;
    }
    const isOwner = Boolean(
      firebaseUser.uid === reqItem.createdBy ||
        firebaseUser.email === reqItem.createdBy
    );
    if (isOwner) {
      setError(
        lang === 'bn'
          ? 'আপনি এই রক্তের অনুরোধটি পোস্ট করেছেন। পোস্টকারী হিসেবে আপনি নিজে বুক করতে পারবেন না, অন্য রক্তদাতারা আপনার অনুরোধে রক্ত দিতে বুক করতে পারবেন।'
          : 'You created this request. As the requester, you cannot book blood on your own post; other donors can book.'
      );
      return;
    }
    setPledgeTargetReq(reqItem);
    setPledgeDonorName(
      ownDonor?.displayName ||
        userProfile?.fullName ||
        firebaseUser.displayName ||
        ''
    );
    setPledgeBloodGroup(ownDonor?.bloodGroup || reqItem.bloodGroup);
    setPledgeMessage(
      lang === 'bn'
        ? 'আমি রক্ত দিতে প্রস্তুত, ফোনে কথা বলে নির্ধারিত সময়ে হাসপাতালে উপস্থিত হতে পারব।'
        : 'I am ready to donate and can visit the hospital at the scheduled time.'
    );
  };

  const handlePledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pledgeTargetReq) return;
    setSubmittingPledge(true);
    setError(null);
    setSuccessNotice(null);
    try {
      await submitRequestPledge({
        request: pledgeTargetReq,
        donorName: pledgeDonorName,
        donorBloodGroup: pledgeBloodGroup,
        units: pledgeUnits || 1,
        message: pledgeMessage,
      });
      setPledgeTargetReq(null);
      setSuccessNotice(
        lang === 'bn'
          ? `আপনার ${pledgeUnits} ব্যাগ রক্তদানের আগ্রহ পাঠানো হয়েছে। অনুরোধকারী এটি গ্রহণ করলে আপডেট দেখতে পাবেন।`
          : `Your offer for ${pledgeUnits} bag(s) has been sent to the requester.`
      );
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'সাড়া পাঠানো যায়নি।');
    } finally {
      setSubmittingPledge(false);
    }
  };

  const openBookDonorDialog = (
    reqItem: BloodRequest,
    pledge?: RequestPledge
  ) => {
    setBookingTargetReq(reqItem);
    setBookingDonorName(pledge?.donorName || reqItem.bookedDonorName || '');
    setBookingDonorUid(pledge?.donorUid || reqItem.bookedDonorUid || '');
    setBookingAcceptedPledgeId(pledge?.id || '');
    setBookingNote(
      reqItem.bookingNote ||
        (lang === 'bn'
          ? 'ডোনারের সাথে ফোনে চূড়ান্ত কথা হয়েছে। দয়া করে নতুন কেউ কল বা মেসেজ দিয়ে বিরক্ত করবেন না।'
          : 'Donor confirmed by phone. New incoming calls are paused.')
    );
  };

  const handleBookDonorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingTargetReq) return;
    setSubmittingBooking(true);
    setError(null);
    setSuccessNotice(null);

    try {
      const otherOfferedIds = ownerIncomingPledges
        .filter(
          (p) =>
            p.requestId === bookingTargetReq.id &&
            p.status === 'offered' &&
            p.id !== bookingAcceptedPledgeId
        )
        .map((p) => p.id);

      await bookBloodRequestDonor({
        requestId: bookingTargetReq.id,
        bookedDonorUid: bookingDonorUid,
        bookedDonorName: bookingDonorName,
        bookingNote,
        acceptedPledgeId: bookingAcceptedPledgeId || undefined,
        declineOtherPledgeIds: otherOfferedIds,
      });
      setBookingTargetReq(null);
      setSuccessNotice(
        lang === 'bn'
          ? 'ডোনার বুকড হয়েছে এবং আপনার ফোন নম্বর অন্যদের কলের জন্য লক করা হয়েছে।'
          : 'Donor booked and phone number locked against new calls.'
      );
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'বুকিং সম্পন্ন করা যায়নি।');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleReopenRequest = async (reqItem: BloodRequest) => {
    setError(null);
    setSuccessNotice(null);

    try {
      await reopenBookedBloodRequest(reqItem.id);
      setSuccessNotice(
        lang === 'bn'
          ? 'বুকিং খুলে অনুরোধটি পুনরায় ওপেন করা হয়েছে—এখন ডোনাররা কল করতে পারবেন।'
          : 'Request re-opened for donor calls.'
      );
      await loadRequests();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'পুনরায় ওপেন করা যায়নি।'
      );
    }
  };

  const handleCloseRequest = async (
    reqItem: BloodRequest,
    status: 'fulfilled' | 'cancelled'
  ) => {
    setError(null);
    setSuccessNotice(null);

    try {
      await closeOwnBloodRequest(reqItem.id, status);
      await loadRequests();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'স্ট্যাটাস পরিবর্তন করা যায়নি।'
      );
    }
  };

  const handleResolveContact = async (
    reqItem: BloodRequest,
    method: ContactMethod
  ) => {
    if (reqItem.status !== 'open') {
      setError(
        lang === 'bn'
          ? 'এই অনুরোধটিতে ডোনার বুকড থাকায় নতুন কল বন্ধ রাখা হয়েছে।'
          : 'Calls are paused because a donor is already booked for this request.'
      );
      return;
    }

    if (!firebaseUser) {
      onOpenAuth();
      return;
    }
    if (!isEmailVerified) {
      setError('যোগাযোগের নম্বর দেখতে আগে আপনার ইমেইল ভেরিফাই করুন।');
      return;
    }

    const key = `${reqItem.id}:${method}`;
    setResolvingKey(key);
    setError(null);
    try {
      const resolved = await resolveBloodRequestContact({
        requestId: reqItem.id,
        requestedMethod: method,
      });
      setContactModalData({
        personName: reqItem.requesterName,
        bloodGroup: reqItem.bloodGroup,
        selectedMethod: method,
        phoneNumber: resolved.phoneNumber,
        quota: resolved.quota,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'যোগাযোগ নম্বর লোড করা যায়নি।'
      );
    } finally {
      setResolvingKey(null);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Crimson Header Strip */}
      <section className="bg-[#C80828] text-white py-6 sm:py-9 rounded-b-[2rem]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold tracking-wide text-white leading-snug">
              {lang === 'bn'
                ? 'জরুরি রক্তের অনুরোধ ও ডোনার বুকিং'
                : 'Blood Requests & Donor Booking'}
            </h1>
            <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
              {lang === 'bn'
                ? 'রক্তদাতা চূড়ান্ত হলে অনুরোধটি "বুক" করে রাখুন—এতে অযথা কল ও বিরক্তি স্বয়ংক্রিয়ভাবে বন্ধ থাকবে।'
                : 'Post genuine hospital requests, respond as a donor, and book confirmed donors to stop extra calls.'}
            </p>
          </div>

          {firebaseUser && isEmailVerified && (
            <button
              type="button"
              onClick={openCreateDialog}
              className="min-h-[44px] max-w-full px-4 sm:px-5 py-2.5 bg-white text-[#C80828] hover:bg-neutral-100 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 sm:whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'bn'
                  ? 'রক্তের অনুরোধ পোস্ট করুন'
                  : 'Create Blood Request'}
              </span>
            </button>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {!canViewRequests ? (
          <div className="bg-white rounded-3xl border border-neutral-200/80 p-8 sm:p-12 text-center max-w-2xl mx-auto flex flex-col items-center space-y-4">
            <DonationCareIllustration className="w-56 h-40" />
            <h2 className="text-lg sm:text-xl font-bold text-[#1F242D]">
              {lang === 'bn'
                ? 'রক্তের অনুরোধ দেখতে বা পোস্ট করতে ভেরিফায়েড অ্যাকাউন্ট প্রয়োজন'
                : 'Sign in with a verified email to view or create blood requests'}
            </h2>
            {!firebaseUser && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[46px] px-6 py-2.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-sm font-semibold rounded-xl cursor-pointer"
              >
                {lang === 'bn' ? 'লগইন / নিবন্ধন' : 'Login / Register'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Toolbar: Segmented Tabs + Booking Status Filter + Blood Group Bar */}
            <div className="bg-white rounded-3xl border border-neutral-200/80 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 min-w-0">
                  <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto p-1 bg-[#FDF2F4] rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setSubTab('all')}
                      className={`min-h-[38px] px-2.5 sm:px-4 py-1.5 text-xs font-semibold rounded-lg text-center cursor-pointer ${
                        subTab === 'all'
                          ? 'bg-[#C80828] text-white shadow-xs'
                          : 'text-[#8F1D30] hover:text-[#C80828]'
                      }`}
                    >
                      {lang === 'bn' ? 'সকল অনুরোধ' : 'All Requests'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubTab('mine')}
                      className={`min-h-[38px] px-2.5 sm:px-4 py-1.5 text-xs font-semibold rounded-lg text-center cursor-pointer ${
                        subTab === 'mine'
                          ? 'bg-[#C80828] text-white shadow-xs'
                          : 'text-[#8F1D30] hover:text-[#C80828]'
                      }`}
                    >
                      {lang === 'bn' ? 'আমার পোস্টকৃত অনুরোধ' : 'My Requests'}
                    </button>
                  </div>

                  {subTab === 'all' && (
                    <div className="flex flex-wrap sm:inline-flex w-full sm:w-auto gap-1 p-1 bg-neutral-100 rounded-xl">
                      {(
                        [
                          [
                            'active_all',
                            lang === 'bn'
                              ? 'কল সচল ও বুকড সব'
                              : 'Open & Booked',
                          ],
                          [
                            'open_only',
                            lang === 'bn' ? 'শুধু কল সচল' : 'Open Only',
                          ],
                          [
                            'booked_only',
                            lang === 'bn' ? 'ডোনার বুকড' : 'Booked Only',
                          ],
                        ] as const
                      ).map(([stKey, stLabel]) => (
                        <button
                          key={stKey}
                          type="button"
                          onClick={() => setStatusFilter(stKey)}
                          className={`flex-1 sm:flex-initial min-h-[36px] px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-lg text-center cursor-pointer ${
                            statusFilter === stKey
                              ? 'bg-white text-[#1F242D] shadow-xs'
                              : 'text-neutral-600 hover:text-[#1F242D]'
                          }`}
                        >
                          {stLabel}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {subTab === 'all' && (
                  <select
                    value={filterDivision}
                    onChange={(e) => setFilterDivision(e.target.value)}
                    className="min-h-[42px] px-3.5 py-1.5 text-xs font-medium border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  >
                    <option value="">
                      {lang === 'bn' ? 'সকল বিভাগ' : 'All Divisions'}
                    </option>
                    {DIVISIONS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d[lang]}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {subTab === 'all' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterGroup('')}
                    className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer ${
                      filterGroup === ''
                        ? 'bg-[#C80828] text-white'
                        : 'bg-[#FDF2F4] text-[#B00723] hover:bg-[#FADCE2]'
                    }`}
                  >
                    {lang === 'bn' ? 'সব গ্রুপ' : 'All'}
                  </button>
                  {BLOOD_GROUPS.map((bg) => {
                    const active = filterGroup === bg;
                    return (
                      <button
                        key={bg}
                        type="button"
                        onClick={() => setFilterGroup(bg)}
                        className={`min-h-[40px] px-3.5 rounded-xl font-mono text-xs font-bold whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-[#C80828] text-white'
                            : 'bg-[#FDF2F4] text-[#B00723] hover:bg-[#FADCE2]'
                        }`}
                      >
                        {bg}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-900"
              >
                {error}
              </div>
            )}

            {successNotice && (
              <div
                role="status"
                className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900"
              >
                {successNotice}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="h-48 rounded-2xl bg-[#FDF2F4] border border-[#F7D4DC] p-6 animate-pulse"
                  />
                ))}
              </div>
            ) : displayedRequests.length === 0 ? (
              <div className="bg-white rounded-3xl border border-neutral-200/80 p-10 text-center space-y-4">
                <DonationCareIllustration className="w-48 h-36 mx-auto" />
                <h3 className="text-base font-bold text-[#1F242D]">
                  {subTab === 'mine'
                    ? lang === 'bn'
                      ? 'আপনি এখনো কোনো রক্তের অনুরোধ পোস্ট করেননি'
                      : 'You have not created any blood requests yet'
                    : lang === 'bn'
                    ? 'এই ফিল্টারে কোনো সক্রিয় রক্তের অনুরোধ নেই'
                    : 'No matching blood requests right now'}
                </h3>
                <button
                  type="button"
                  onClick={openCreateDialog}
                  className="min-h-[44px] px-5 py-2.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {lang === 'bn'
                    ? 'নতুন অনুরোধ পোস্ট করুন'
                    : 'Create First Request'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {displayedRequests.map((reqItem) => {
                  const isOwner = Boolean(
                    firebaseUser &&
                      (reqItem.createdBy === firebaseUser.uid ||
                        reqItem.createdBy === firebaseUser.email)
                  );
                  const canManageBooking = isOwner;

                  const myPledge = mySentPledges.find(
                    (p) => p.requestId === reqItem.id
                  );

                  const cardPledges = isOwner
                    ? ownerIncomingPledges.filter(
                        (p) =>
                          p.requestId === reqItem.id &&
                          p.status !== 'withdrawn'
                      )
                    : [];

                  return (
                    <article
                      key={reqItem.id}
                      onClick={() => openRequestDetails(reqItem)}
                      className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all hover:shadow-md cursor-pointer ${
                        reqItem.status === 'booked'
                          ? 'bg-white border-neutral-200'
                          : 'bg-[#FDF2F4] border-[#F7D4DC]'
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Top: Hospital name & Blood Group / Bags */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-[#1F242D] leading-snug line-clamp-1">
                                {reqItem.hospitalName}
                              </h3>
                              {isOwner && (
                                <span className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-700 text-[10px] font-bold shrink-0">
                                  {lang === 'bn' ? 'আমার পোস্ট' : 'My Post'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-600 mt-0.5 line-clamp-1">
                              {formatLocationLabel(
                                reqItem.divisionId,
                                reqItem.districtId,
                                reqItem.upazilaId,
                                lang
                              )}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-lg font-extrabold font-mono tabular-nums text-[#C80828]">
                              {reqItem.bloodGroup}
                            </span>
                            <span className="text-xs font-semibold text-neutral-600 ml-1.5 font-mono tabular-nums">
                              ({reqItem.units} {lang === 'bn' ? 'ব্যাগ' : 'Bag'})
                            </span>
                            {(reqItem.fulfilledUnits || 0) > 0 &&
                              reqItem.status === 'open' && (
                                <div className="text-[10px] font-bold text-emerald-800">
                                  {lang === 'bn'
                                    ? `${reqItem.fulfilledUnits}টি নিশ্চিত · ${
                                        reqItem.units -
                                        (reqItem.fulfilledUnits || 0)
                                      }টি বাকি`
                                    : `${reqItem.fulfilledUnits} confirmed · ${
                                        reqItem.units -
                                        (reqItem.fulfilledUnits || 0)
                                      } needed`}
                                </div>
                              )}
                          </div>
                        </div>

                        {/* Metadata row: Urgency, Date, Status */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-600">
                          <span
                            className={
                              reqItem.urgency === 'emergency'
                                ? 'font-bold text-[#C80828]'
                                : 'font-semibold text-neutral-700'
                            }
                          >
                            {urgencyLabel(reqItem.urgency, lang)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {lang === 'bn' ? 'তারিখ: ' : 'Date: '}
                            {reqItem.requiredDate}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              reqItem.status === 'booked'
                                ? 'font-semibold text-amber-800'
                                : (reqItem.fulfilledUnits || 0) > 0
                                ? 'font-bold text-emerald-800'
                                : reqItem.status === 'open'
                                ? 'font-semibold text-emerald-800'
                                : 'text-neutral-600'
                            }
                          >
                            {reqItem.status === 'booked'
                              ? lang === 'bn'
                                ? '🔒 ডোনার বুকড (কল বন্ধ)'
                                : '🔒 Booked (Calls Locked)'
                              : (reqItem.fulfilledUnits || 0) > 0
                              ? lang === 'bn'
                                ? `চলমান (${reqItem.fulfilledUnits}/${reqItem.units} নিশ্চিত · কল সচল)`
                                : `Active (${reqItem.fulfilledUnits}/${reqItem.units} confirmed · Calls open)`
                              : requestStatusLabel(reqItem.status, lang)}
                          </span>
                        </div>

                        {/* 1-line note preview if available */}
                        {reqItem.patientNote && (
                          <p className="text-xs text-neutral-600 line-clamp-1">
                            {reqItem.patientNote}
                          </p>
                        )}
                      </div>

                      {/* Card Bottom: Summary + Single Primary Action Button (Fixed Image 2) */}
                      <div className="pt-2.5 border-t border-neutral-200/60 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-neutral-500 truncate">
                          {reqItem.status === 'booked'
                            ? lang === 'bn'
                              ? `বুকড: ${
                                  reqItem.bookedDonorName || 'নির্ধারিত ডোনার'
                                }`
                              : `Booked: ${
                                  reqItem.bookedDonorName || 'Confirmed'
                                }`
                            : `${
                                lang === 'bn' ? 'যোগাযোগ: ' : 'Contact: '
                              }${reqItem.requesterName}`}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRequestDetails(reqItem);
                            }}
                            className="min-h-[36px] px-3.5 py-1 bg-[#C80828] hover:bg-[#A3051E] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>
                              {isOwner
                                ? lang === 'bn'
                                  ? 'আমার অনুরোধের বিবরণ'
                                  : 'My Request Details'
                                : lang === 'bn'
                                ? 'রক্ত দিতে বুক করুন / বিবরণ'
                                : 'Book to Donate / Details'}
                            </span>
                            <span aria-hidden="true">→</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Request Details & Contact Modal (Opened when clicking card / notification) */}
      {currentSelectedRequest && (() => {
        const reqItem = currentSelectedRequest;
        const isOwner = Boolean(
          firebaseUser &&
            (reqItem.createdBy === firebaseUser.uid ||
              reqItem.createdBy === firebaseUser.email)
        );
        const canManageBooking = isOwner;
        const myPledge = mySentPledges.find((p) => p.requestId === reqItem.id);

        const cardPledges = isOwner
          ? ownerIncomingPledges.filter(
              (p) =>
                p.requestId === reqItem.id &&
                p.status !== 'withdrawn'
            )
          : [];

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              lang === 'bn'
                ? 'রক্তের অনুরোধের বিস্তারিত'
                : 'Blood Request Details'
            }
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
            onClick={closeRequestDetails}
          >
            <div
              className="w-full max-w-2xl bg-white rounded-3xl border border-neutral-200 p-5 sm:p-7 space-y-5 my-auto max-h-[92vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar with explicit Back Button */}
              <div className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-3">
                <button
                  type="button"
                  onClick={closeRequestDetails}
                  className="min-h-[38px] px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>
                    {lang === 'bn' ? 'তালিকায় ফিরে যান' : 'Back to Requests'}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  {!isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!firebaseUser) {
                          onOpenAuth();
                          return;
                        }
                        setReportTarget(reqItem);
                      }}
                      title={lang === 'bn' ? 'রিপোর্ট' : 'Report'}
                      className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-red-50 hover:text-red-600 text-neutral-500 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={closeRequestDetails}
                    className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Main Hospital & Group Banner */}
              <div className="bg-[#FAF8F9] rounded-2xl p-4 sm:p-5 border border-neutral-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <h2 className="text-xl font-bold text-[#1F242D]">
                    {reqItem.hospitalName}
                  </h2>
                  <div className="text-right shrink-0">
                    <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[#C80828]">
                      {reqItem.bloodGroup} · {reqItem.units}{' '}
                      {lang === 'bn' ? 'ব্যাগ' : 'Bags'}
                    </div>
                    {(reqItem.fulfilledUnits || 0) > 0 && (
                      <div className="text-xs font-semibold text-emerald-800">
                        {lang === 'bn'
                          ? `${reqItem.fulfilledUnits}টি নিশ্চিত · ${Math.max(
                              0,
                              reqItem.units - (reqItem.fulfilledUnits || 0)
                            )}টি বাকি`
                          : `${reqItem.fulfilledUnits} confirmed · ${Math.max(
                              0,
                              reqItem.units - (reqItem.fulfilledUnits || 0)
                            )} needed`}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-xs sm:text-sm text-neutral-700">
                  <span className="font-semibold text-neutral-900">
                    {lang === 'bn' ? 'এলাকা: ' : 'Location: '}
                  </span>
                  {formatLocationLabel(
                    reqItem.divisionId,
                    reqItem.districtId,
                    reqItem.upazilaId,
                    lang
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-600 pt-1 border-t border-neutral-200/60">
                  <span
                    className={
                      reqItem.urgency === 'emergency'
                        ? 'font-bold text-[#C80828]'
                        : 'font-semibold text-neutral-800'
                    }
                  >
                    {urgencyLabel(reqItem.urgency, lang)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {lang === 'bn' ? 'প্রয়োজনের তারিখ: ' : 'Needed Date: '}
                    {reqItem.requiredDate}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {lang === 'bn' ? 'যোগাযোগকারী: ' : 'Requester: '}
                    {reqItem.requesterName}
                  </span>
                </div>
              </div>

              {/* Patient Condition / Medical Note */}
              {reqItem.patientNote && (
                <div className="space-y-1.5 bg-white p-4 rounded-2xl border border-neutral-200">
                  <div className="text-xs font-semibold text-neutral-500">
                    {lang === 'bn'
                      ? 'রোগীর অবস্থা ও জরুরি বিবরণ:'
                      : 'Patient Note:'}
                  </div>
                  <p className="text-sm text-neutral-800 leading-relaxed">
                    {reqItem.patientNote}
                  </p>
                </div>
              )}

              {/* Anti-Disturb Booked Lock Banner when status === 'booked' */}
              {reqItem.status === 'booked' && (
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
                    <Lock className="w-4 h-4 text-[#C80828] shrink-0" />
                    <span>
                      {lang === 'bn'
                        ? `রক্তদাতা চূড়ান্ত ও বুকড: ${
                            reqItem.bookedDonorName || 'নির্ধারিত ডোনার'
                          }`
                        : `Confirmed Donor Booked: ${
                            reqItem.bookedDonorName || 'Confirmed'
                          }`}
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    {reqItem.bookingNote ||
                      (lang === 'bn'
                        ? 'এই অনুরোধটির জন্য রক্তদাতা চূড়ান্ত হওয়ায় নতুন কল ও মেসেজ বন্ধ রাখা হয়েছে যেন রোগী ও ডোনার অযথা বিরক্ত না হন।'
                        : 'A donor is confirmed for this request. Phone access is paused so nobody else calls to disturb.')}
                  </p>

                  {/* Requester Reopen / Fulfilled Controls when Booked */}
                  {canManageBooking && (
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReopenRequest(reqItem)}
                        className="min-h-[40px] px-3.5 py-1.5 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'bn'
                            ? 'আবার কল চালু করুন (বুকিং আনলক)'
                            : 'Re-open Calls (Unlock)'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCloseRequest(reqItem, 'fulfilled')}
                        className="min-h-[40px] px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'bn'
                            ? 'রক্ত মিলেছে (সম্পন্ন)'
                            : 'Mark Fulfilled'}
                        </span>
                      </button>

                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleCloseRequest(reqItem, 'cancelled')}
                          className="min-h-[40px] px-3.5 py-1.5 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>
                            {lang === 'bn' ? 'অনুরোধ বাতিল' : 'Cancel'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* If Open: Contact Channels and Pledges */}
              {reqItem.status === 'open' && (
                <div className="space-y-4">
                  {/* Contact Buttons */}
                  <div className="p-4 rounded-2xl bg-white border border-neutral-200 space-y-3">
                    <div className="text-xs font-semibold text-neutral-700">
                      {lang === 'bn'
                        ? 'রোগীর পরিবারের সাথে যোগাযোগের মাধ্যম:'
                        : 'Contact Requester Directly:'}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {(Array.isArray(reqItem.contactMethods) && reqItem.contactMethods.length > 0
                        ? reqItem.contactMethods
                        : (['call'] as ContactMethod[])
                      ).map((method) => {
                        const busy = resolvingKey === `${reqItem.id}:${method}`;
                        return (
                          <button
                            key={method}
                            type="button"
                            disabled={Boolean(resolvingKey)}
                            onClick={() => handleResolveContact(reqItem, method)}
                            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#C80828] hover:bg-[#A3051E] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            {busy ? (
                              <span>...</span>
                            ) : method === 'call' ? (
                              <Phone className="w-4 h-4" />
                            ) : method === 'sms' ? (
                              <MessageSquare className="w-4 h-4" />
                            ) : method === 'whatsapp' ? (
                              <MessageCircle className="w-4 h-4" />
                            ) : (
                              <span className="font-mono font-bold">IMO</span>
                            )}
                            <span>{contactMethodLabel(method, lang)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Donor Offer / Booking Pledge Button for Non-owners (bakira parbe) vs Owner Notice */}
                  {!isOwner ? (
                    <div className="p-4 rounded-2xl bg-[#FDF2F4] border border-[#F7D4DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-[#1F242D] flex items-center gap-1.5">
                          <HeartHandshake className="w-4 h-4 text-[#C80828]" />
                          <span>
                            {lang === 'bn'
                              ? 'আপনি কি রক্ত দিতে পারবেন? (বুক করুন)'
                              : 'Can you donate blood? (Book / Pledge)'}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600 mt-0.5">
                          {lang === 'bn'
                            ? 'আপনি কয়টি ব্যাগ রক্ত দিতে পারবেন তা বুক করুন, রোগীর পরিবার সরাসরি নোটিফিকেশন পেয়ে আপনার সাথে যোগাযোগ করবে।'
                            : 'Book the units you can donate. The family will receive an instant notification to coordinate.'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => openPledgeDialog(reqItem)}
                        className="min-h-[44px] px-4 py-2 bg-[#C80828] hover:bg-[#A3051E] text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 shadow-xs active:scale-95 transition-all"
                      >
                        <HeartHandshake className="w-4 h-4" />
                        <span>
                          {myPledge && myPledge.status === 'offered'
                            ? lang === 'bn'
                              ? '✓ বুকিং পাঠানো হয়েছে'
                              : '✓ Booking Sent'
                            : lang === 'bn'
                            ? 'রক্ত দিতে বুক করুন'
                            : 'Book to Donate'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-neutral-200/80 text-neutral-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div className="text-xs space-y-1">
                        <div className="font-bold text-neutral-900">
                          {lang === 'bn'
                            ? 'আপনার পোস্টকৃত রক্তের অনুরোধ'
                            : 'Your Blood Request Post'}
                        </div>
                        <p className="text-neutral-600 leading-relaxed">
                          {lang === 'bn'
                            ? 'পোস্টকারী হিসেবে আপনি নিজে বুক করতে পারবেন না। অন্য কোনো রক্তদাতা রক্ত দিতে বুক বা সম্মতি জানালে আপনি তাৎক্ষণিক নোটিফিকেশন পাবেন এবং নিচে তাদের তালিকা দেখতে পাবেন।'
                            : 'As the requester, you cannot book blood on your own post. When other donors book, you will receive real-time notifications and see them listed below.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Interested Donors List (With Profile View & Booking - Fixed Image 1) */}
                  {canManageBooking && (
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-neutral-800">
                        <span>
                          {lang === 'bn'
                            ? `রক্ত দিতে আগ্রহী রক্তদাতারা (${cardPledges.length}):`
                            : `Interested Donors (${cardPledges.length}):`}
                        </span>
                        {(reqItem.fulfilledUnits || 0) > 0 && (
                          <span className="font-mono text-[#C80828] bg-white px-2 py-0.5 rounded-lg border border-neutral-200">
                            {reqItem.fulfilledUnits}/{reqItem.units}{' '}
                            {lang === 'bn' ? 'ব্যাগ নিশ্চিত' : 'Bags'}
                          </span>
                        )}
                      </div>

                      {cardPledges.length > 0 ? (
                        <div className="space-y-2">
                          {cardPledges.map((pl) => (
                            <div
                              key={pl.id}
                              className="p-3.5 rounded-xl bg-white border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold text-[#1F242D] text-sm">
                                    {pl.donorName}
                                  </span>
                                  <span className="font-mono font-bold text-[#C80828] bg-[#FDF2F4] px-1.5 py-0.5 rounded-md">
                                    {pl.donorBloodGroup}
                                  </span>
                                  <span className="text-neutral-400">·</span>
                                  <span className="font-semibold text-emerald-800">
                                    {lang === 'bn'
                                      ? `${pl.units || 1} ব্যাগ দিতে চান`
                                      : `${pl.units || 1} Bag offered`}
                                  </span>
                                  <span className="text-neutral-400">·</span>
                                  <span className="text-neutral-500">
                                    {pledgeStatusLabel(pl.status, lang)}
                                  </span>
                                </div>
                                {pl.message && (
                                  <p className="text-neutral-600 italic">
                                    "{pl.message}"
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenDonorProfile(pl.donorUid, {
                                      requestId: reqItem.id,
                                      hospitalName: reqItem.hospitalName,
                                      requestBloodGroup: reqItem.bloodGroup,
                                      totalUnits: reqItem.units,
                                      fulfilledUnits:
                                        reqItem.fulfilledUnits || 0,
                                      offeredUnits: pl.units || 1,
                                      pledgeMessage: pl.message,
                                      pledgeId: pl.id,
                                    })
                                  }
                                  className="min-h-[36px] px-3.5 py-1 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 text-xs font-semibold rounded-xl inline-flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <span>
                                    {lang === 'bn'
                                      ? 'প্রোফাইল দেখুন'
                                      : 'View Profile'}
                                  </span>
                                  <span aria-hidden="true">→</span>
                                </button>

                                {pl.status === 'offered' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenDonorProfile(pl.donorUid, {
                                        requestId: reqItem.id,
                                        hospitalName: reqItem.hospitalName,
                                        requestBloodGroup: reqItem.bloodGroup,
                                        totalUnits: reqItem.units,
                                        fulfilledUnits:
                                          reqItem.fulfilledUnits || 0,
                                        offeredUnits: pl.units || 1,
                                        pledgeMessage: pl.message,
                                        pledgeId: pl.id,
                                      })
                                    }
                                    className="min-h-[36px] px-3 py-1 bg-[#C80828] hover:bg-[#A3051E] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <Lock className="w-3 h-3" />
                                    <span>
                                      {lang === 'bn' ? 'বুক করুন' : 'Book'}
                                    </span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-white rounded-xl border border-neutral-200 text-neutral-500 text-xs text-center">
                          {lang === 'bn'
                            ? 'এখনও কোনো রক্তদাতা সাড়া জানাননি। আগ্রহী ডোনাররা সাড়া জানালে এখানে তাদের তালিকা ও প্রোফাইল দেখতে পাবেন।'
                            : 'No donors have responded yet.'}
                        </div>
                      )}

                      {/* Confirmed / Booked Donors List */}
                      {reqItem.bookedDonors &&
                        reqItem.bookedDonors.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-neutral-200">
                            <div className="text-xs font-semibold text-emerald-800">
                              {lang === 'bn'
                                ? `নিশ্চিতকৃত রক্তদাতারা (${reqItem.bookedDonors.length}):`
                                : `Confirmed Donors (${reqItem.bookedDonors.length}):`}
                            </div>
                            {reqItem.bookedDonors.map((bd, idx) => (
                              <div
                                key={`${bd.donorUid}_${idx}`}
                                className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                  <span className="font-bold text-[#1F242D] truncate">
                                    {bd.donorName}
                                  </span>
                                  {bd.donorBloodGroup && (
                                    <span className="font-mono font-bold text-[#C80828]">
                                      ({bd.donorBloodGroup})
                                    </span>
                                  )}
                                  <span className="text-neutral-400">·</span>
                                  <span className="font-medium text-emerald-800 shrink-0">
                                    {bd.units}{' '}
                                    {lang === 'bn' ? 'ব্যাগ নিশ্চিত' : 'Bag(s)'}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenDonorProfile(bd.donorUid)
                                  }
                                  className="px-2.5 py-1 bg-white hover:bg-neutral-100 border border-emerald-300 text-emerald-900 text-[11px] font-semibold rounded-lg shrink-0 cursor-pointer"
                                >
                                  {lang === 'bn' ? 'প্রোফাইল' : 'Profile'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Create Blood Request Modal */}
      {showCreateModal && (
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
                    ? 'নতুন রক্তের অনুরোধ পোস্ট করুন'
                    : 'Post a New Blood Request'}
                </h2>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {lang === 'bn'
                    ? 'সঠিক তথ্য দিন। ডোনার চূড়ান্ত হলে "ডোনার বুক করুন" চাপলে নতুন কল বন্ধ হয়ে যাবে।'
                    : 'Provide hospital details. Book your donor once confirmed to pause further calls.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-900 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  {lang === 'bn' ? 'প্রয়োজনীয় রক্তের গ্রুপ' : 'Blood Group'}
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {BLOOD_GROUPS.map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setBloodGroup(bg)}
                      className={`min-h-[42px] rounded-xl font-mono text-xs font-bold cursor-pointer ${
                        bloodGroup === bg
                          ? 'bg-[#C80828] text-white'
                          : 'bg-[#FDF2F4] text-[#B00723]'
                      }`}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'ব্যাগ সংখ্যা (১–১০)' : 'Units (1–10)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={units}
                    onChange={(e) => setUnits(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'জরুরিতার ধরন' : 'Urgency'}
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) =>
                      setUrgency(e.target.value as BloodRequestUrgency)
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  >
                    <option value="emergency">
                      {urgencyLabel('emergency', lang)}
                    </option>
                    <option value="urgent">
                      {urgencyLabel('urgent', lang)}
                    </option>
                    <option value="scheduled">
                      {urgencyLabel('scheduled', lang)}
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'হাসপাতালের নাম' : 'Hospital Name'}
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={120}
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    placeholder={
                      lang === 'bn'
                        ? 'যেমন: ঢাকা মেডিকেল কলেজ হাসপাতাল'
                        : 'e.g. Dhaka Medical College Hospital'
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'প্রয়োজনের তারিখ' : 'Required Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'বিভাগ' : 'Division'}
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
                    value={districtId}
                    onChange={(e) => {
                      const nextDist = e.target.value;
                      setDistrictId(nextDist);
                      const firstUpz = getUpazilasByDistrict(nextDist)[0];
                      setUpazilaId(firstUpz?.id || '');
                    }}
                    className="w-full min-h-[44px] px-3 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  >
                    {formDistricts.map((dist) => (
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
                    value={upazilaId}
                    onChange={(e) => setUpazilaId(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  >
                    {formUpazilas.map((upz) => (
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
                    {lang === 'bn' ? 'যোগাযোগকারীর নাম' : 'Contact Person Name'}
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn'
                      ? 'মোবাইল নম্বর (বাংলাদেশ)'
                      : 'Mobile Number (BD)'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={rawPhone}
                    onChange={(e) => setRawPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  {lang === 'bn' ? 'যোগাযোগের মাধ্যমসমূহ' : 'Contact Channels'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {CONTACT_METHODS.map((m) => {
                    const checked = contactMethods.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMethod(m)}
                        className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-xl cursor-pointer ${
                          checked
                            ? 'bg-[#C80828] text-white'
                            : 'bg-[#FDF2F4] text-[#8F1D30]'
                        }`}
                      >
                        {contactMethodLabel(m, lang)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  {lang === 'bn'
                    ? 'সংক্ষিপ্ত বিবরণ (ঐচ্ছিক, গোপন মেডিকেল রিপোর্ট লিখবেন না)'
                    : 'Short Note (Optional)'}
                </label>
                <textarea
                  rows={2}
                  maxLength={400}
                  value={patientNote}
                  onChange={(e) => setPatientNote(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'যেমন: ওয়ার্ড নম্বর বা কখন রক্ত প্রয়োজন...'
                      : 'e.g. Ward info or timing...'
                  }
                  className="w-full px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs text-neutral-700 leading-relaxed cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={hasConsented}
                  onChange={(e) => setHasConsented(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#C80828]"
                />
                <span>
                  {lang === 'bn'
                    ? 'আমি সম্মতি দিচ্ছি যে রক্তদেই-এর লগইনকৃত ও ইমেইল-যাচাইকৃত ব্যবহারকারীরা রক্তদান সংক্রান্ত যোগাযোগের জন্য এই ফোন নম্বরটি দেখতে পারবেন এবং ডোনার বুক করলে কল বন্ধ হয়ে যাবে।'
                    : 'I consent to making this phone number accessible to verified Rokto Dei users while the request is open.'}
                </span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-xl cursor-pointer"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="min-h-[44px] px-6 py-2 bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-60 text-white text-sm font-semibold rounded-xl cursor-pointer"
                >
                  {creating
                    ? lang === 'bn'
                      ? 'পোস্ট হচ্ছে...'
                      : 'Posting...'
                    : lang === 'bn'
                    ? 'অনুরোধ প্রকাশ করুন'
                    : 'Publish Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Donor Offer / Pledge Modal */}
      {pledgeTargetReq && (
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
                    ? 'রক্তদানের আগ্রহ ও বুকিং অনুরোধ পাঠান'
                    : 'Offer to Donate Blood'}
                </h2>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {pledgeTargetReq.hospitalName} ({pledgeTargetReq.bloodGroup})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPledgeTargetReq(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-900 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePledgeSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'আপনার নাম' : 'Your Name'}
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={pledgeDonorName}
                    onChange={(e) => setPledgeDonorName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'আপনার রক্তের গ্রুপ' : 'Your Blood Group'}
                  </label>
                  <select
                    value={pledgeBloodGroup}
                    onChange={(e) =>
                      setPledgeBloodGroup(e.target.value as BloodGroup)
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono font-bold border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  >
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn' ? 'কত ব্যাগ দিতে পারবেন' : 'Bags to Donate'}
                  </label>
                  <select
                    value={pledgeUnits}
                    onChange={(e) =>
                      setPledgeUnits(
                        Math.max(1, parseInt(e.target.value, 10) || 1)
                      )
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono font-bold border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                  >
                    {Array.from(
                      {
                        length: Math.max(
                          1,
                          pledgeTargetReq.units -
                            (pledgeTargetReq.fulfilledUnits || 0)
                        ),
                      },
                      (_, i) => i + 1
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n} {lang === 'bn' ? 'ব্যাগ' : 'Bag'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  {lang === 'bn'
                    ? 'সংক্ষিপ্ত বার্তা (কখন আসতে পারবেন বা ফোনে কথা হয়েছে কি না)'
                    : 'Short Note'}
                </label>
                <textarea
                  rows={2}
                  maxLength={240}
                  value={pledgeMessage}
                  onChange={(e) => setPledgeMessage(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPledgeTargetReq(null)}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-xl cursor-pointer"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submittingPledge}
                  className="min-h-[44px] px-5 py-2 bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-60 text-white text-sm font-semibold rounded-xl cursor-pointer"
                >
                  {submittingPledge
                    ? lang === 'bn'
                      ? 'পাঠানো হচ্ছে...'
                      : 'Sending...'
                    : lang === 'bn'
                    ? 'সাড়া পাঠান'
                    : 'Send Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Confirmed Donor & Pause Calls Modal */}
      {bookingTargetReq && (
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
                    ? 'ডোনার চূড়ান্ত / বুক করুন (নতুন কল বন্ধ রাখুন)'
                    : 'Book Confirmed Donor & Lock Calls'}
                </h2>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {bookingTargetReq.hospitalName} ({bookingTargetReq.bloodGroup}
                  )
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBookingTargetReq(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-900 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBookDonorSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  {lang === 'bn'
                    ? 'যে ডোনার রক্ত দেবেন তার নাম'
                    : 'Confirmed Donor Name'}
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={bookingDonorName}
                  onChange={(e) => setBookingDonorName(e.target.value)}
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
                    ? 'পাবলিক বুকিং নোট (অন্য ডোনাররা দেখবেন)'
                    : 'Booking Status Note'}
                </label>
                <textarea
                  rows={2}
                  maxLength={240}
                  value={bookingNote}
                  onChange={(e) => setBookingNote(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9]"
                />
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">
                {lang === 'bn'
                  ? 'বুক করার সাথে সাথে এই পোস্টে আপনার ফোন নম্বর লক হয়ে যাবে এবং কল/SMS/WhatsApp বাটন বন্ধ হয়ে যাবে, যাতে অন্য কেউ ফোন দিয়ে বিরক্ত করতে না পারে। কোনো কারণে ডোনার না আসতে পারলে ১ ক্লিকেই আবার কল চালু করতে পারবেন।'
                  : 'Booking immediately hides call buttons and locks phone number access in Firestore so nobody else disturbs you. You can re-open calls anytime if needed.'}
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBookingTargetReq(null)}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-xl cursor-pointer"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submittingBooking}
                  className="min-h-[44px] px-5 py-2 bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-60 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {submittingBooking
                      ? lang === 'bn'
                        ? 'বুক হচ্ছে...'
                        : 'Booking...'
                      : lang === 'bn'
                      ? 'বুক করুন ও কল লক করুন'
                      : 'Confirm Booking'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {reportTarget && (
        <ReportModal
          isOpen={Boolean(reportTarget)}
          onClose={() => setReportTarget(null)}
          targetType="blood_request"
          targetId={reportTarget.id}
          targetUid={reportTarget.createdBy}
          targetLabel={`${reportTarget.hospitalName} (${reportTarget.bloodGroup})`}
          lang={lang}
        />
      )}

      {/* Full Donor Profile Modal (Accessible via Notification click or View Profile button) */}
      <DonorProfileModal
        isOpen={isDonorModalOpen}
        onClose={() => {
          setIsDonorModalOpen(false);
          onClearTargetDonor?.();
        }}
        donor={selectedDonorProfile}
        phoneNumber={selectedDonorPhone}
        pledgeContext={selectedDonorPledgeContext}
        onConfirmBook={handleConfirmDonorModalBook}
        isBooking={isBookingFromModal}
        lang={lang}
      />
    </div>
  );
}
