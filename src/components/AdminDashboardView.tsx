import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { AlertCircle, RefreshCw, Rocket, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useAppUpdate } from '../contexts/UpdateContext';
import { formatLocationLabel } from '../data/bdLocations';
import {
  CURRENT_APP_VERSION,
  CURRENT_BUILD_TIME,
  DEFAULT_GITHUB_REPO,
} from '../lib/appVersion';
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
  urgencyLabel,
} from '../lib/i18n';
import {
  adminFetchDashboardData,
  adminGrantModeratorRole,
  adminPublishAppRelease,
  adminRemoveBloodRequest,
  adminRemoveDonationRecord,
  adminReopenBloodRequest,
  adminReviewAbuseReport,
  adminRevokeModeratorRole,
  adminSetDonorListing,
  adminSetUserAccountStatus,
} from '../services/roktoService';
import type {
  AbuseReport,
  AdminRoleRecord,
  AuditLogRecord,
  BloodRequest,
  ContactAccessLogRecord,
  DonationRecord,
  DonorProfile,
  ReportStatus,
  RequestPledge,
  UserProfile,
} from '../types';

type AdminTabKey =
  | 'activity'
  | 'requests'
  | 'donations'
  | 'donors'
  | 'interactions'
  | 'reports'
  | 'users'
  | 'audit'
  | 'release';

type ActivityFilterKey =
  | 'all'
  | 'requests'
  | 'donations'
  | 'pledges'
  | 'contacts'
  | 'moderation';

interface UnifiedActivityEvent {
  id: string;
  category: Exclude<ActivityFilterKey, 'all'>;
  categoryLabelBn: string;
  categoryLabelEn: string;
  title: string;
  subtitle: string;
  meta: string;
  timestampMs: number;
  timestampLabel: string;
  tone: 'neutral' | 'crimson' | 'emerald' | 'amber';
}

function toMillisSafe(ts: Timestamp | null | undefined): number {
  if (!ts || typeof ts.toMillis !== 'function') return 0;
  return ts.toMillis();
}

export function AdminDashboardView() {
  const { isAdmin, isSuperAdmin, lang } = useAuth();
  const { addNotification } = useNotifications();
  const { releaseConfig } = useAppUpdate();

  const [tab, setTab] = useState<AdminTabKey>('activity');
  const [activityFilter, setActivityFilter] =
    useState<ActivityFilterKey>('all');
  const [interactionView, setInteractionView] = useState<
    'pledges' | 'contacts'
  >('pledges');
  const [searchQuery, setSearchQuery] = useState('');

  const [liveUsers, setLiveUsers] = useState<UserProfile[]>([]);
  const [liveDonors, setLiveDonors] = useState<DonorProfile[]>([]);
  const [liveDonationRecords, setLiveDonationRecords] = useState<
    DonationRecord[]
  >([]);
  const [liveRequests, setLiveRequests] = useState<BloodRequest[]>([]);
  const [livePledges, setLivePledges] = useState<RequestPledge[]>([]);
  const [liveContactLogs, setLiveContactLogs] = useState<
    ContactAccessLogRecord[]
  >([]);
  const [liveReports, setLiveReports] = useState<AbuseReport[]>([]);
  const [liveAuditLogs, setLiveAuditLogs] = useState<AuditLogRecord[]>([]);
  const [adminRoles, setAdminRoles] = useState<AdminRoleRecord[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [reasonHighlight, setReasonHighlight] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const reasonInputRef = useRef<HTMLInputElement>(null);

  const [relVersion, setRelVersion] = useState(CURRENT_APP_VERSION);
  const [relMinVersion, setRelMinVersion] = useState('1.0.0');
  const [relGithubRepo, setRelGithubRepo] = useState(DEFAULT_GITHUB_REPO);
  const [relReleaseUrl, setRelReleaseUrl] = useState('');
  const [relApkUrl, setRelApkUrl] = useState('');
  const [relSha256, setRelSha256] = useState('');
  const [relNotesBn, setRelNotesBn] = useState('');
  const [relNotesEn, setRelNotesEn] = useState('');
  const [relCritical, setRelCritical] = useState(false);

  useEffect(() => {
    if (!releaseConfig) return;
    setRelVersion(releaseConfig.version || CURRENT_APP_VERSION);
    setRelMinVersion(releaseConfig.minSupportedVersion || '1.0.0');
    setRelGithubRepo(releaseConfig.githubRepo || DEFAULT_GITHUB_REPO);
    setRelReleaseUrl(releaseConfig.releaseUrl || '');
    setRelApkUrl(releaseConfig.apkDownloadUrl || '');
    setRelSha256(releaseConfig.sha256Checksum || '');
    setRelNotesBn(releaseConfig.releaseNotesBn || '');
    setRelNotesEn(releaseConfig.releaseNotesEn || '');
    setRelCritical(Boolean(releaseConfig.isCriticalUpdate));
  }, [releaseConfig]);

  const loadAll = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetchDashboardData(isSuperAdmin);
      setLiveUsers(data.users);
      setLiveDonors(data.donors);
      setLiveDonationRecords(data.donationRecords);
      setLiveRequests(data.requests);
      setLivePledges(data.pledges);
      setLiveContactLogs(data.contactLogs);
      setLiveReports(data.reports);
      setLiveAuditLogs(data.auditLogs);
      setAdminRoles(data.adminRoles);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'অ্যাডমিন ডেটা লোড করতে সমস্যা হয়েছে।'
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isSuperAdmin]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const users = liveUsers;
  const donors = liveDonors;
  const donationRecords = useMemo(
    () =>
      [...liveDonationRecords].sort((a, b) =>
        b.donationDate.localeCompare(a.donationDate)
      ),
    [liveDonationRecords]
  );

  const requests = useMemo(
    () =>
      [...liveRequests].sort(
        (a, b) => toMillisSafe(b.updatedAt) - toMillisSafe(a.updatedAt)
      ),
    [liveRequests]
  );

  const pledges = useMemo(
    () =>
      [...livePledges].sort(
        (a, b) => toMillisSafe(b.updatedAt) - toMillisSafe(a.updatedAt)
      ),
    [livePledges]
  );

  const contactLogs = useMemo(
    () =>
      [...liveContactLogs].sort(
        (a, b) => toMillisSafe(b.updatedAt) - toMillisSafe(a.updatedAt)
      ),
    [liveContactLogs]
  );

  const reports = useMemo(
    () =>
      [...liveReports].sort(
        (a, b) => toMillisSafe(b.updatedAt) - toMillisSafe(a.updatedAt)
      ),
    [liveReports]
  );

  const auditLogs = useMemo(
    () =>
      [...liveAuditLogs].sort(
        (a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt)
      ),
    [liveAuditLogs]
  );

  // Lookup maps for human-readable actor/donor names in contact logs & pledges
  const nameByUid = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      map.set(u.uid, `${u.fullName} (${u.email})`);
    }
    for (const d of donors) {
      if (!map.has(d.uid)) {
        map.set(d.uid, `${d.displayName} (${d.bloodGroup})`);
      }
    }
    for (const r of requests) {
      if (!map.has(r.createdBy)) {
        map.set(r.createdBy, r.requesterName);
      }
    }
    return map;
  }, [users, donors, requests]);

  const pledgesByRequestId = useMemo(() => {
    const map = new Map<string, RequestPledge[]>();
    for (const p of pledges) {
      const list = map.get(p.requestId) || [];
      list.push(p);
      map.set(p.requestId, list);
    }
    return map;
  }, [pledges]);

  // Unified platform-wide activity stream
  const activityFeed = useMemo<UnifiedActivityEvent[]>(() => {
    const events: UnifiedActivityEvent[] = [];

    for (const req of requests) {
      const isBooked = req.status === 'booked';
      const ts = isBooked && req.bookedAt ? req.bookedAt : req.updatedAt || req.createdAt;
      events.push({
        id: `act_req_${req.id}`,
        category: 'requests',
        categoryLabelBn: isBooked ? 'ডোনার বুকড (কল লক)' : 'রক্তের অনুরোধ',
        categoryLabelEn: isBooked ? 'Donor Booked (Locked)' : 'Blood Request',
        title: `${req.hospitalName} — ${req.bloodGroup} (${req.units} ব্যাগ)`,
        subtitle: isBooked
          ? `চূড়ান্ত ডোনার: ${req.bookedDonorName || 'নির্ধারিত'} · নতুন কল বন্ধ করা হয়েছে${
              req.bookingNote ? ` (${req.bookingNote})` : ''
            }`
          : `যোগাযোগকারী: ${req.requesterName} · ${urgencyLabel(req.urgency, lang)} · প্রয়োজন: ${req.requiredDate}`,
        meta: `${requestStatusLabel(req.status, lang)} · ${formatLocationLabel(
          req.divisionId,
          req.districtId,
          req.upazilaId,
          lang
        )}`,
        timestampMs: toMillisSafe(ts),
        timestampLabel: formatTimestamp(ts, lang),
        tone: isBooked
          ? 'amber'
          : req.status === 'fulfilled'
            ? 'emerald'
            : req.status === 'open'
              ? 'crimson'
              : 'neutral',
      });
    }

    for (const don of donationRecords) {
      events.push({
        id: `act_don_${don.id}`,
        category: 'donations',
        categoryLabelBn: 'রক্তদানের রেকর্ড',
        categoryLabelEn: 'Donation Logged',
        title: `${don.donorName} (${don.bloodGroup}) — ${don.volumeMl} ml (${don.units} ব্যাগ)`,
        subtitle: `স্থান: ${don.hospitalOrCenter}${
          don.recipientSummary ? ` · ${don.recipientSummary}` : ''
        }`,
        meta: `রক্তদানের তারিখ: ${don.donationDate} · ${donationComponentLabel(
          don.donationType,
          lang
        )} · ${formatLocationLabel(
          don.divisionId,
          don.districtId,
          don.upazilaId,
          lang
        )}`,
        timestampMs: toMillisSafe(don.createdAt),
        timestampLabel: formatTimestamp(don.createdAt, lang),
        tone: 'emerald',
      });
    }

    for (const pl of pledges) {
      events.push({
        id: `act_pl_${pl.id}`,
        category: 'pledges',
        categoryLabelBn: 'ডোনার সাড়া',
        categoryLabelEn: 'Donor Pledge',
        title: `${pl.donorName} (${pl.donorBloodGroup}) সাড়া দিয়েছেন — ${pl.hospitalName}`,
        subtitle: pl.message || 'রক্তদানের জন্য আগ্রহ প্রকাশ করেছেন।',
        meta: `${pledgeStatusLabel(pl.status, lang)} · অনুরোধ আইডি: ${pl.requestId.slice(0, 14)}`,
        timestampMs: toMillisSafe(pl.updatedAt),
        timestampLabel: formatTimestamp(pl.updatedAt, lang),
        tone: pl.status === 'accepted' ? 'emerald' : 'neutral',
      });
    }

    for (const cl of contactLogs) {
      const callerLabel = nameByUid.get(cl.callerUid) || cl.callerUid.slice(0, 14);
      const donorLabel = nameByUid.get(cl.donorUid) || cl.donorUid.slice(0, 14);
      events.push({
        id: `act_cl_${cl.id}`,
        category: 'contacts',
        categoryLabelBn: 'নম্বর আনলক',
        categoryLabelEn: 'Contact Unlocked',
        title: `${callerLabel} → ${donorLabel}`,
        subtitle: `মাধ্যম: ${contactMethodLabel(cl.requestedMethod, lang)} · মোট আনলক: ${cl.accessCount} বার`,
        meta: `কলার UID: ${cl.callerUid.slice(0, 12)} · ডোনার UID: ${cl.donorUid.slice(0, 12)}`,
        timestampMs: toMillisSafe(cl.updatedAt),
        timestampLabel: formatTimestamp(cl.updatedAt, lang),
        tone: 'neutral',
      });
    }

    for (const rep of reports) {
      events.push({
        id: `act_rep_${rep.id}`,
        category: 'moderation',
        categoryLabelBn: 'অভিযোগ / রিপোর্ট',
        categoryLabelEn: 'Abuse Report',
        title: `${reportReasonLabel(rep.reason, lang)} (${rep.targetType})`,
        subtitle: rep.description || 'কোনো অতিরিক্ত বিবরণ দেওয়া হয়নি।',
        meta: `${reportStatusLabel(rep.status, lang)} · লক্ষ্য: ${rep.targetId.slice(0, 14)}`,
        timestampMs: toMillisSafe(rep.updatedAt),
        timestampLabel: formatTimestamp(rep.updatedAt, lang),
        tone: rep.status === 'open' ? 'crimson' : 'neutral',
      });
    }

    for (const log of auditLogs) {
      events.push({
        id: `act_aud_${log.id}`,
        category: 'moderation',
        categoryLabelBn: 'অ্যাডমিন অ্যাকশন',
        categoryLabelEn: 'Admin Audit',
        title: `${log.action} (${log.targetType}: ${log.targetId.slice(0, 14)})`,
        subtitle: `কারণ: ${log.reason}`,
        meta: `অ্যাডমিন: ${log.actorEmail}`,
        timestampMs: toMillisSafe(log.createdAt),
        timestampLabel: formatTimestamp(log.createdAt, lang),
        tone: 'neutral',
      });
    }

    for (const u of users) {
      events.push({
        id: `act_usr_${u.uid}`,
        category: 'moderation',
        categoryLabelBn: 'ব্যবহারকারী অ্যাকাউন্ট',
        categoryLabelEn: 'User Registered',
        title: `${u.fullName} (${u.email})`,
        subtitle: `অ্যাকাউন্ট অবস্থা: ${u.accountStatus}`,
        meta: `UID: ${u.uid.slice(0, 14)}`,
        timestampMs: toMillisSafe(u.createdAt),
        timestampLabel: formatTimestamp(u.createdAt, lang),
        tone: 'neutral',
      });
    }

    events.sort((a, b) => b.timestampMs - a.timestampMs);
    return events;
  }, [
    requests,
    donationRecords,
    pledges,
    contactLogs,
    reports,
    auditLogs,
    users,
    nameByUid,
    lang,
  ]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchesSearch = useCallback(
    (...values: Array<string | number | undefined | null>) => {
      if (!normalizedQuery) return true;
      return values.some((val) =>
        String(val ?? '')
          .toLowerCase()
          .includes(normalizedQuery)
      );
    },
    [normalizedQuery]
  );

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14 text-center">
        <p className="text-sm font-semibold text-red-800">
          {lang === 'bn'
            ? 'অনুমতি নেই: এই পেজটি শুধুমাত্র সার্ভার-অনুমোদিত অ্যাডমিনদের জন্য সংরক্ষিত।'
            : 'Access Denied: Server-authorized admin privileges required.'}
        </p>
      </div>
    );
  }

  const requireReason = (): string | null => {
    const trimmed = actionReason.trim();
    if (trimmed.length < 3) {
      setReasonHighlight(true);
      setError(
        lang === 'bn'
          ? 'যেকোনো অ্যাডমিন অ্যাকশন নেওয়ার আগে "মডারেশন / অডিট লগের কারণ" বক্সে কমপক্ষে ৩ অক্ষরের কারণ লিখুন।'
          : 'Please enter a justification (min 3 characters) in the Audit Reason box before executing an admin action.'
      );
      if (reasonInputRef.current) {
        reasonInputRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        reasonInputRef.current.focus();
      }
      return null;
    }
    setReasonHighlight(false);
    return trimmed;
  };

  const handleReportStatus = async (reportId: string, status: ReportStatus) => {
    const reason = requireReason();
    if (!reason) return;

    setBusyId(reportId);
    setError(null);
    setFeedbackMessage(null);
    try {
      await adminReviewAbuseReport({
        reportId,
        status,
        resolutionNote: reason,
      });
      setActionReason('');
      setFeedbackMessage('রিপোর্ট আপডেট ও অডিট লগে সংরক্ষণ করা হয়েছে।');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'অ্যাকশন ব্যর্থ হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleDonorList = async (donor: DonorProfile) => {
    if (
      !donor.isListed &&
      (!donor.hasConsented || donor.contactMethods.length === 0)
    ) {
      setError(
        lang === 'bn'
          ? 'এই ডোনার এখনো যোগাযোগের সম্মতি বা মাধ্যম প্রদান করেননি, তাই তালিকাভুক্ত করা যাবে না।'
          : 'Cannot re-list a donor without explicit consent and at least one contact method.'
      );
      return;
    }
    const reason = requireReason();
    if (!reason) return;

    setBusyId(donor.uid);
    setError(null);
    setFeedbackMessage(null);
    try {
      await adminSetDonorListing({
        donorUid: donor.uid,
        isListed: !donor.isListed,
        currentAccountStatus: donor.accountStatus,
        reason,
      });
      setActionReason('');
      setFeedbackMessage('ডোনার লিস্টিং আপডেট করা হয়েছে।');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'অ্যাকশন ব্যর্থ হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleUserStatus = async (u: UserProfile) => {
    const reason = requireReason();
    if (!reason) return;
    setBusyId(u.uid);
    setError(null);
    setFeedbackMessage(null);
    const hasDonorDoc = liveDonors.some((d) => d.uid === u.uid);
    const nextStatus = u.accountStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await adminSetUserAccountStatus({
        targetUid: u.uid,
        newStatus: nextStatus,
        hasDonorDoc,
        reason,
      });
      addNotification({
        type: 'user_status_changed',
        titleBn:
          nextStatus === 'suspended'
            ? `${u.fullName}-এর অ্যাকাউন্ট স্থগিত করা হয়েছে`
            : `${u.fullName}-এর অ্যাকাউন্ট সচল করা হয়েছে`,
        titleEn:
          nextStatus === 'suspended'
            ? `Account suspended for ${u.fullName}`
            : `Account restored for ${u.fullName}`,
        messageBn: `কারণ: "${reason}"।`,
        messageEn: `Reason: "${reason}".`,
        targetView: 'admin',
        urgency: nextStatus === 'suspended' ? 'emergency' : 'info',
      });
      setActionReason('');
      setFeedbackMessage('ব্যবহারকারীর অ্যাকাউন্ট অবস্থা আপডেট করা হয়েছে।');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'অ্যাকশন ব্যর্থ হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  const handlePromoteModerator = async (u: UserProfile) => {
    const reason = requireReason();
    if (!reason) return;
    setBusyId(`mod_${u.uid}`);
    setError(null);
    setFeedbackMessage(null);
    const existsAlready = adminRoles.some((r) => r.uid === u.uid);
    try {
      await adminGrantModeratorRole({
        targetUid: u.uid,
        role: 'moderator',
        existsAlready,
        reason,
      });
      addNotification({
        type: 'moderator_granted',
        titleBn: `${u.fullName} কে মডারেটর রোল প্রদান করা হয়েছে 🛡️`,
        titleEn: `Moderator role granted to ${u.fullName} 🛡️`,
        messageBn: `কারণ/নোট: "${reason}"। ব্যবহারকারী এখন মডারেশন প্যানেলের রিপোর্ট ও ডেটা পরিচালনা করতে পারবেন।`,
        messageEn: `Reason/Note: "${reason}". User can now access moderation tools.`,
        targetView: 'admin',
        urgency: 'info',
      });
      setActionReason('');
      setFeedbackMessage(
        lang === 'bn'
          ? `${u.fullName} কে সফলভাবে মডারেটর রোল প্রদান করা হয়েছে।`
          : `Moderator role granted to ${u.fullName}.`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'রোল প্রদান করা যায়নি।');
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeModerator = async (u: UserProfile) => {
    const reason = requireReason();
    if (!reason) return;
    setBusyId(`mod_${u.uid}`);
    setError(null);
    setFeedbackMessage(null);
    try {
      await adminRevokeModeratorRole({
        targetUid: u.uid,
        reason,
      });
      addNotification({
        type: 'moderator_revoked',
        titleBn: `${u.fullName}-এর মডারেটর রোল প্রত্যাহার করা হয়েছে`,
        titleEn: `Moderator role revoked from ${u.fullName}`,
        messageBn: `কারণ: "${reason}"। ব্যবহারকারীকে সাধারণ ব্যবহারকারী হিসেবে পরিবর্তন করা হয়েছে।`,
        messageEn: `Reason: "${reason}". User is now a standard member.`,
        targetView: 'admin',
        urgency: 'urgent',
      });
      setActionReason('');
      setFeedbackMessage(
        lang === 'bn'
          ? `${u.fullName} এর মডারেটর রোল সফলভাবে প্রত্যাহার করা হয়েছে এবং সাধারণ ব্যবহারকারী করা হয়েছে।`
          : `Moderator role revoked from ${u.fullName}.`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'মডারেটর রোল প্রত্যাহার করা যায়নি।');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveRequest = async (reqId: string) => {
    const reason = requireReason();
    if (!reason) return;

    setBusyId(reqId);
    setError(null);
    setFeedbackMessage(null);
    try {
      await adminRemoveBloodRequest({ requestId: reqId, reason });
      setActionReason('');
      setFeedbackMessage('রক্তের অনুরোধটি মডারেশনের মাধ্যমে অপসারণ করা হয়েছে।');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'অপসারণ ব্যর্থ হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  const handleReopenRequest = async (reqId: string) => {
    const reason = requireReason();
    if (!reason) return;

    setBusyId(`reopen_${reqId}`);
    setError(null);
    setFeedbackMessage(null);
    try {
      await adminReopenBloodRequest({ requestId: reqId, reason });
      setActionReason('');
      setFeedbackMessage('বুকিং আনলক করে অনুরোধটি পুনরায় ওপেন করা হয়েছে।');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'বুকিং আনলক ব্যর্থ হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveDonationRecord = async (recordId: string) => {
    const reason = requireReason();
    if (!reason) return;

    setBusyId(recordId);
    setError(null);
    setFeedbackMessage(null);
    try {
      await adminRemoveDonationRecord({ recordId, reason });
      setActionReason('');
      setFeedbackMessage('রক্তদানের রেকর্ড মুছে অডিট লগে সংরক্ষণ করা হয়েছে।');
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'রেকর্ড মুছে ফেলা ব্যর্থ হয়েছে।'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handlePublishAppRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    const reason = requireReason();
    if (!reason) return;

    setBusyId('publish_release');
    setError(null);
    setFeedbackMessage(null);
    try {
      await adminPublishAppRelease({
        version: relVersion,
        minSupportedVersion: relMinVersion,
        githubRepo: relGithubRepo,
        releaseUrl: relReleaseUrl,
        apkDownloadUrl: relApkUrl,
        sha256Checksum: relSha256,
        releaseNotesBn: relNotesBn,
        releaseNotesEn: relNotesEn,
        isCriticalUpdate: relCritical,
        reason,
      });
      setActionReason('');
      setFeedbackMessage(
        lang === 'bn'
          ? `নতুন রিলিজ (v${relVersion.replace(/^[vV]/, '')}) সফলভাবে প্রকাশিত হয়েছে। সকল Web ও APK ব্যবহারকারীরা এখন রিয়েল-টাইমে আপডেট নোটিফিকেশন পাবেন।`
          : `Release v${relVersion.replace(/^[vV]/, '')} published. All Web and APK users will receive live update notifications.`
      );
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'রিলিজ কনফিগারেশন প্রকাশ করা যায়নি।'
      );
    } finally {
      setBusyId(null);
    }
  };

  // Real-time KPI summaries
  const openReportsCount = reports.filter(
    (r) => r.status === 'open' || r.status === 'reviewing'
  ).length;
  const activeListedDonorsCount = donors.filter(
    (d) => d.isListed && d.accountStatus === 'active'
  ).length;
  const availableDonorsCount = donors.filter(
    (d) =>
      d.isListed &&
      d.accountStatus === 'active' &&
      d.availability === 'available'
  ).length;
  const openRequestsCount = requests.filter((r) => r.status === 'open').length;
  const bookedRequestsCount = requests.filter(
    (r) => r.status === 'booked'
  ).length;
  const totalLoggedMl = donationRecords.reduce(
    (sum, r) => sum + (Number(r.volumeMl) || 0),
    0
  );
  const totalContactUnlocks = contactLogs.reduce(
    (sum, c) => sum + (Number(c.accessCount) || 1),
    0
  );

  // Filtered views based on search box
  const filteredActivity = activityFeed.filter((ev) => {
    if (activityFilter !== 'all' && ev.category !== activityFilter) {
      return false;
    }
    return matchesSearch(ev.title, ev.subtitle, ev.meta, ev.categoryLabelBn);
  });

  const filteredRequests = requests.filter((req) =>
    matchesSearch(
      req.hospitalName,
      req.bloodGroup,
      req.requesterName,
      req.bookedDonorName,
      req.bookingNote,
      req.patientNote,
      req.id
    )
  );

  const filteredDonations = donationRecords.filter((rec) =>
    matchesSearch(
      rec.donorName,
      rec.bloodGroup,
      rec.hospitalOrCenter,
      rec.donationDate,
      rec.recipientSummary,
      rec.donorUid
    )
  );

  const filteredDonors = donors.filter((d) =>
    matchesSearch(
      d.displayName,
      d.bloodGroup,
      d.preferredHospitalArea,
      d.occupation,
      d.uid,
      formatLocationLabel(d.divisionId, d.districtId, d.upazilaId, lang)
    )
  );

  const filteredPledges = pledges.filter((p) =>
    matchesSearch(
      p.donorName,
      p.donorBloodGroup,
      p.hospitalName,
      p.message,
      p.requestId
    )
  );

  const filteredContactLogs = contactLogs.filter((c) =>
    matchesSearch(
      c.callerUid,
      c.donorUid,
      nameByUid.get(c.callerUid),
      nameByUid.get(c.donorUid),
      c.requestedMethod
    )
  );

  const filteredReports = reports.filter((r) =>
    matchesSearch(
      reportReasonLabel(r.reason, lang),
      r.description,
      r.resolutionNote,
      r.targetId,
      r.targetType
    )
  );

  const filteredUsers = users.filter((u) =>
    matchesSearch(u.fullName, u.email, u.uid, u.accountStatus)
  );

  const filteredAuditLogs = auditLogs.filter((l) =>
    matchesSearch(l.action, l.actorEmail, l.reason, l.targetId, l.targetType)
  );

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6">

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[#202124] flex items-start sm:items-center gap-2 leading-snug">
            <ShieldCheck className="w-6 h-6 text-[#D71920] shrink-0 mt-0.5 sm:mt-0" />
            <span>
              {lang === 'bn'
                ? 'কেন্দ্রীয় অ্যাডমিন ও পর্যবেক্ষণ প্যানেল'
                : 'Central Admin & Observability Console'}
            </span>
          </h1>
          <p className="text-xs sm:text-[13px] text-neutral-600 mt-1 leading-relaxed">
            {lang === 'bn'
              ? 'ব্যবহারকারী, ডোনার, রক্তদান, বুকিং (কল-লক), ডোনার সাড়া ও অডিট লগ এক জায়গা থেকে পরিচালনা করুন।'
              : 'Monitor and moderate users, donors, donations, bookings, pledges, contact unlocks, and audit trails.'}
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={loadAll}
          className="min-h-[44px] px-4 py-2 bg-white hover:bg-neutral-50 border border-neutral-300 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-2 w-full sm:w-auto whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
          />
          <span>{lang === 'bn' ? 'সর্বশেষ তথ্য রিফ্রেশ' : 'Refresh Data'}</span>
        </button>
      </div>

      {!isSuperAdmin && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-3.5 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
              🛡️ {lang === 'bn' ? 'মডারেটর সেশন সক্রিয়' : 'Moderator Active'}
            </span>
            <span className="font-medium">
              {lang === 'bn'
                ? 'আপনি মডারেটর হিসেবে রক্তদাতার তথ্য, রক্তের অনুরোধ, ডোনারের সাড়া ও অভিযোগ মডারেশন করার পূর্ণ ক্ষমতা পেয়েছেন।'
                : 'You have active moderator capabilities for blood requests, donors, pledges, and reports.'}
            </span>
          </div>
          <span className="text-[11px] text-emerald-800 shrink-0">
            {lang === 'bn'
              ? 'মডারেটর নিয়োগ/প্রত্যাহার সুপার অ্যাডমিনের জন্য সংরক্ষিত।'
              : 'Role management reserved for Super Admin.'}
          </span>
        </div>
      )}

      {/* 6-Column Real-Time Platform Metrics Strip */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5">
        <div>
          <div className="text-xs text-neutral-500">
            {lang === 'bn' ? 'নিবন্ধিত ব্যবহারকারী' : 'Registered Users'}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#202124] mt-1">
            {users.length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5 tabular-nums">
            {adminRoles.length}{' '}
            {lang === 'bn' ? 'জন মডারেটর/অ্যাডমিন' : 'moderators'}
          </div>
        </div>

        <div>
          <div className="text-xs text-neutral-500">
            {lang === 'bn' ? 'তালিকাভুক্ত ডোনার' : 'Listed Donors'}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#202124] mt-1">
            {activeListedDonorsCount}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5 tabular-nums">
            {availableDonorsCount}{' '}
            {lang === 'bn' ? 'জন রক্তদানে প্রস্তুত' : 'available now'}
          </div>
        </div>

        <div>
          <div className="text-xs text-neutral-500">
            {lang === 'bn' ? 'মোট রক্তদান রেকর্ড' : 'Logged Donations'}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {donationRecords.length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5 tabular-nums">
            {totalLoggedMl.toLocaleString()}{' '}
            {lang === 'bn' ? 'ml লগকৃত রক্ত' : 'ml total logged'}
          </div>
        </div>

        <div>
          <div className="text-xs text-neutral-500">
            {lang === 'bn' ? 'চলমান ও বুকড অনুরোধ' : 'Open & Booked'}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#202124] mt-1">
            {openRequestsCount}
            <span className="text-sm font-normal text-neutral-400 mx-1">/</span>
            <span className="text-amber-700">{bookedRequestsCount}</span>
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5 tabular-nums">
            {openRequestsCount} {lang === 'bn' ? 'ওপেন' : 'open'} ·{' '}
            {bookedRequestsCount}{' '}
            {lang === 'bn' ? 'ডোনার বুকড' : 'donor booked'}
          </div>
        </div>

        <div>
          <div className="text-xs text-neutral-500">
            {lang === 'bn' ? 'ডোনার সাড়া ও আনলক' : 'Pledges & Unlocks'}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#202124] mt-1">
            {pledges.length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5 tabular-nums">
            {totalContactUnlocks}{' '}
            {lang === 'bn' ? 'বার নম্বর আনলক' : 'phone unlocks'}
          </div>
        </div>

        <div>
          <div className="text-xs text-neutral-500">
            {lang === 'bn' ? 'অপেক্ষমাণ রিপোর্ট' : 'Pending Reports'}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#D71920] mt-1">
            {openReportsCount}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5 tabular-nums">
            {reports.length}{' '}
            {lang === 'bn' ? 'টি মোট অভিযোগ' : 'total reports'}
          </div>
        </div>
      </div>

      {/* Controls Row: Search Input + Mandatory Audit Reason */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-5">
          <label
            htmlFor="admin-quick-search"
            className="block text-xs font-semibold text-neutral-700 mb-1.5"
          >
            {lang === 'bn'
              ? 'দ্রুত অনুসন্ধান (নাম, হাসপাতাল, গ্রুপ, আইডি):'
              : 'Quick Search (Name, Hospital, Blood Group, ID):'}
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="admin-quick-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'যেকোনো তথ্য লিখে ফিল্টার করুন...'
                  : 'Filter active tab rows...'
              }
              className="w-full min-h-[44px] pl-9 pr-3.5 py-2 text-sm border border-neutral-300 rounded-xl focus:outline-none focus:border-[#D71920]"
            />
          </div>
        </div>

        <div className="lg:col-span-7">
          <label
            htmlFor="admin-audit-reason"
            className="block text-xs font-semibold text-neutral-700 mb-1.5"
          >
            {lang === 'bn'
              ? 'মডারেশন / অডিট লগের কারণ (অ্যাকশন নেওয়ার আগে আবশ্যিক):'
              : 'Mandatory Audit Reason (Required before moderation actions):'}
          </label>
          <input
            ref={reasonInputRef}
            id="admin-audit-reason"
            type="text"
            maxLength={400}
            value={actionReason}
            onChange={(e) => {
              setActionReason(e.target.value);
              if (e.target.value.trim().length >= 3) {
                setReasonHighlight(false);
              }
            }}
            placeholder={
              lang === 'bn'
                ? 'যেমন: ডোনার অনুপস্থিত থাকায় আনলক / ভুয়া তথ্য অপসারণ...'
                : 'Enter clear moderation reason (3–400 chars)...'
            }
            className={`w-full min-h-[44px] px-3.5 py-2 text-sm border rounded-xl focus:outline-none transition-colors ${
              reasonHighlight && actionReason.trim().length < 3
                ? 'border-[#D71920] ring-2 ring-[#D71920]/25 bg-red-50/40'
                : 'border-neutral-300 focus:border-[#D71920]'
            }`}
          />
          {reasonHighlight && actionReason.trim().length < 3 && (
            <p className="text-xs font-medium text-[#D71920] mt-1.5 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {lang === 'bn'
                  ? 'নিরাপত্তা নীতি: অ্যাকশন চালানোর আগে এখানে কমপক্ষে ৩ অক্ষরের কারণ লিখুন।'
                  : 'Security policy: enter at least 3 characters here before running an action.'}
              </span>
            </p>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 sm:p-4 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-900 leading-relaxed"
        >
          {error}
        </div>
      )}

      {feedbackMessage && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm font-medium text-emerald-950"
        >
          {feedbackMessage}
        </div>
      )}

      {/* 8-Tab Admin Navigation (single horizontal swipeable strip on mobile) */}
      <div className="flex flex-nowrap overflow-x-auto sm:flex-wrap gap-1.5 p-1.5 bg-neutral-100 border border-neutral-200 rounded-xl w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {(
          [
            [
              'activity',
              lang === 'bn'
                ? `লাইভ অ্যাক্টিভিটি (${activityFeed.length})`
                : `Live Activity (${activityFeed.length})`,
            ],
            [
              'requests',
              lang === 'bn'
                ? `অনুরোধ ও বুকিং (${requests.length})`
                : `Requests & Bookings (${requests.length})`,
            ],
            [
              'donations',
              lang === 'bn'
                ? `রক্তদানের ইতিহাস (${donationRecords.length})`
                : `Donation Logs (${donationRecords.length})`,
            ],
            [
              'donors',
              lang === 'bn'
                ? `রক্তদাতা তালিকা (${donors.length})`
                : `Donors (${donors.length})`,
            ],
            [
              'interactions',
              lang === 'bn'
                ? `সাড়া ও আনলক লগ (${pledges.length + contactLogs.length})`
                : `Pledges & Contacts (${pledges.length + contactLogs.length})`,
            ],
            [
              'reports',
              lang === 'bn'
                ? `রিপোর্ট কিউ (${reports.length})`
                : `Reports (${reports.length})`,
            ],
            [
              'users',
              lang === 'bn'
                ? `ব্যবহারকারী (${users.length})`
                : `Users (${users.length})`,
            ],
            [
              'audit',
              lang === 'bn'
                ? `অডিট লগ (${auditLogs.length})`
                : `Audit Logs (${auditLogs.length})`,
            ],
            [
              'release',
              lang === 'bn' ? 'রিলিজ ও আপডেট' : 'App Release',
            ],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`min-h-[42px] px-3.5 py-2 text-xs sm:text-[13px] font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              tab === key
                ? 'bg-white text-[#202124] shadow-xs border border-neutral-200/80'
                : 'text-neutral-600 hover:text-[#202124]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Data Surface */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        {/* TAB 1: Unified Chronological Activity Stream */}
        {tab === 'activity' && (
          <div>
            <div className="px-4 py-3 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="text-xs sm:text-[13px] font-semibold text-neutral-700">
                {lang === 'bn'
                  ? 'প্ল্যাটফর্মের সামগ্রিক কার্যক্রম (সময়ক্রম অনুসারে)'
                  : 'Chronological Platform Activity Stream'}
              </div>
              <div className="flex flex-nowrap overflow-x-auto md:flex-wrap gap-1 bg-neutral-100 p-1 rounded-lg [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {(
                  [
                    ['all', lang === 'bn' ? 'সব ইভেন্ট' : 'All'],
                    ['requests', lang === 'bn' ? 'বুকিং ও অনুরোধ' : 'Requests & Bookings'],
                    ['donations', lang === 'bn' ? 'রক্তদান লগ' : 'Donations'],
                    ['pledges', lang === 'bn' ? 'ডোনার সাড়া' : 'Pledges'],
                    ['contacts', lang === 'bn' ? 'নম্বর আনলক' : 'Contact Unlocks'],
                    ['moderation', lang === 'bn' ? 'রিপোর্ট ও অডিট' : 'Moderation'],
                  ] as const
                ).map(([fKey, fLabel]) => (
                  <button
                    key={fKey}
                    type="button"
                    onClick={() => setActivityFilter(fKey)}
                    className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                      activityFilter === fKey
                        ? 'bg-white text-[#202124] shadow-2xs'
                        : 'text-neutral-600 hover:text-[#202124]'
                    }`}
                  >
                    {fLabel}
                  </button>
                ))}
              </div>
            </div>

            {filteredActivity.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-neutral-500">
                {lang === 'bn'
                  ? 'এই ফিল্টারে কোনো কার্যক্রম পাওয়া যায়নি।'
                  : 'No activity events match the current filter.'}
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {filteredActivity.map((ev) => {
                  const toneColor =
                    ev.tone === 'crimson'
                      ? 'text-[#D71920]'
                      : ev.tone === 'emerald'
                        ? 'text-emerald-700'
                        : ev.tone === 'amber'
                          ? 'text-amber-700'
                          : 'text-neutral-600';
                  return (
                    <div
                      key={ev.id}
                      className="px-4 sm:px-5 py-3.5 hover:bg-neutral-50/70 flex flex-col sm:flex-row sm:items-start justify-between gap-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-semibold">
                          <span className={toneColor}>
                            {lang === 'bn'
                              ? ev.categoryLabelBn
                              : ev.categoryLabelEn}
                          </span>
                          <span className="text-neutral-300 mx-1.5">·</span>
                          <span className="text-[#202124] text-sm">
                            {ev.title}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-700">
                          {ev.subtitle}
                        </p>
                        <div className="text-[11px] text-neutral-500 tabular-nums">
                          {ev.meta}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-500 font-mono tabular-nums whitespace-nowrap shrink-0">
                        {ev.timestampLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Blood Requests & Donor Bookings */}
        {tab === 'requests' && (
          <div>
            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-neutral-200">
              {filteredRequests.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-neutral-500">
                  কোনো রক্তের অনুরোধ পাওয়া যায়নি।
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const reqPledges = pledgesByRequestId.get(req.id) || [];
                  const isBooked = req.status === 'booked';
                  const statusColor = isBooked
                    ? 'text-amber-800'
                    : req.status === 'open'
                      ? 'text-emerald-700'
                      : req.status === 'removed'
                        ? 'text-[#D71920]'
                        : 'text-neutral-700';
                  return (
                    <div key={req.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-bold text-[#202124] leading-snug break-words">
                            {req.hospitalName}
                          </h3>
                          <div className="text-sm font-bold font-mono text-[#D71920] tabular-nums mt-0.5">
                            {req.bloodGroup} · {req.units} ব্যাগ
                          </div>
                        </div>
                        <div className={`text-xs font-bold text-right shrink-0 ${statusColor}`}>
                          {requestStatusLabel(req.status, lang)}
                        </div>
                      </div>

                      <div className="text-xs text-neutral-700 space-y-1.5 leading-relaxed">
                        <div>
                          <span className="text-neutral-500">এলাকা:</span>{' '}
                          {formatLocationLabel(
                            req.divisionId,
                            req.districtId,
                            req.upazilaId,
                            lang
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>
                            <span className="text-neutral-500">প্রয়োজন:</span>{' '}
                            <span className="font-mono font-medium text-[#202124] tabular-nums">
                              {req.requiredDate}
                            </span>
                          </span>
                          <span className="text-neutral-300">·</span>
                          <span>{urgencyLabel(req.urgency, lang)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>
                            <span className="text-neutral-500">যোগাযোগকারী:</span>{' '}
                            <span className="font-semibold text-[#202124]">
                              {req.requesterName}
                            </span>
                          </span>
                          <span className="text-neutral-300">·</span>
                          <span className="font-mono font-semibold text-[#202124] tabular-nums">
                            {reqPledges.length} টি সাড়া
                          </span>
                        </div>
                        {req.patientNote && (
                          <p className="text-xs text-neutral-600 bg-neutral-50 rounded-lg px-2.5 py-2 border border-neutral-200/70 break-words">
                            {req.patientNote}
                          </p>
                        )}
                        {isBooked && (
                          <div className="text-xs text-amber-950 bg-amber-50/70 rounded-lg px-2.5 py-2 border border-amber-200 space-y-0.5">
                            <div>
                              <span className="text-amber-800">বুকড ডোনার:</span>{' '}
                              <span className="font-semibold">
                                {req.bookedDonorName || 'নির্ধারিত ডোনার'}
                              </span>
                            </div>
                            {req.bookingNote && (
                              <div className="text-neutral-700 break-words">
                                নোট: {req.bookingNote}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="text-[11px] font-mono text-neutral-400 break-all">
                          ID: {req.id}
                        </div>
                      </div>

                      {(isBooked || req.status === 'open' || req.status === 'booked') && (
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          {isBooked && (
                            <button
                              type="button"
                              disabled={busyId === `reopen_${req.id}`}
                              onClick={() => handleReopenRequest(req.id)}
                              className="w-full min-h-[44px] px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                            >
                              {busyId === `reopen_${req.id}`
                                ? 'অপেক্ষা করুন...'
                                : 'বুকিং আনলক / কল চালু'}
                            </button>
                          )}
                          {(req.status === 'open' || req.status === 'booked') && (
                            <button
                              type="button"
                              disabled={busyId === req.id}
                              onClick={() => handleRemoveRequest(req.id)}
                              className="w-full min-h-[44px] px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                            >
                              {busyId === req.id ? 'অপসারণ হচ্ছে...' : 'স্প্যাম অপসারণ'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="border-b border-neutral-200 text-xs text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">হাসপাতাল, গ্রুপ ও এলাকা</th>
                    <th className="px-4 py-3 font-semibold">যোগাযোগকারী ও জরুরিতা</th>
                    <th className="px-4 py-3 font-semibold">স্ট্যাটাস ও চূড়ান্ত ডোনার বুকিং</th>
                    <th className="px-4 py-3 font-semibold text-right">ডোনার সাড়া</th>
                    <th className="px-4 py-3 font-semibold text-right">মডারেশন পদক্ষেপ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-neutral-500"
                      >
                        কোনো রক্তের অনুরোধ পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => {
                      const reqPledges = pledgesByRequestId.get(req.id) || [];
                      const isBooked = req.status === 'booked';
                      return (
                        <tr key={req.id} className="hover:bg-neutral-50/70">
                          <td className="px-4 py-3.5 align-top">
                            <div className="font-semibold text-[#202124]">
                              {req.hospitalName}{' '}
                              <span className="font-mono text-[#D71920] tabular-nums">
                                ({req.bloodGroup} · {req.units} ব্যাগ)
                              </span>
                            </div>
                            <div className="text-xs text-neutral-500 mt-0.5">
                              {formatLocationLabel(
                                req.divisionId,
                                req.districtId,
                                req.upazilaId,
                                lang
                              )}{' '}
                              · প্রয়োজন:{' '}
                              <span className="font-mono tabular-nums">
                                {req.requiredDate}
                              </span>
                            </div>
                            {req.patientNote && (
                              <div className="text-[11px] text-neutral-600 mt-1 max-w-sm">
                                {req.patientNote}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top text-xs text-neutral-700">
                            <div className="font-semibold text-[#202124]">
                              {req.requesterName}
                            </div>
                            <div className="text-neutral-500 mt-0.5">
                              {urgencyLabel(req.urgency, lang)}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                              ID: {req.id.slice(0, 14)}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 align-top text-xs">
                            <div
                              className={`font-semibold ${
                                isBooked
                                  ? 'text-amber-800'
                                  : req.status === 'open'
                                    ? 'text-emerald-700'
                                    : req.status === 'removed'
                                      ? 'text-[#D71920]'
                                      : 'text-neutral-700'
                              }`}
                            >
                              {requestStatusLabel(req.status, lang)}
                            </div>
                            {isBooked && (
                              <div className="mt-1 text-neutral-700 space-y-0.5">
                                <div>
                                  <span className="text-neutral-500">
                                    বুকড ডোনার:
                                  </span>{' '}
                                  <span className="font-semibold text-[#202124]">
                                    {req.bookedDonorName || 'নির্ধারিত ডোনার'}
                                  </span>
                                </div>
                                {req.bookingNote && (
                                  <div className="text-[11px] text-neutral-600 max-w-xs">
                                    নোট: {req.bookingNote}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top text-right font-mono text-xs tabular-nums text-neutral-700">
                            {reqPledges.length} টি সাড়া
                          </td>

                          <td className="px-4 py-3.5 align-top text-right whitespace-nowrap space-x-2">
                            {isBooked && (
                              <button
                                type="button"
                                disabled={busyId === `reopen_${req.id}`}
                                onClick={() => handleReopenRequest(req.id)}
                                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                বুকিং আনলক / কল চালু
                              </button>
                            )}
                            {(req.status === 'open' || req.status === 'booked') && (
                              <button
                                type="button"
                                disabled={busyId === req.id}
                                onClick={() => handleRemoveRequest(req.id)}
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                স্প্যাম অপসারণ
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Complete Platform Donation History Records */}
        {tab === 'donations' && (
          <div>
            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-neutral-200">
              {filteredDonations.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-neutral-500">
                  কোনো রক্তদানের ইতিহাস রেকর্ড পাওয়া যায়নি।
                </div>
              ) : (
                filteredDonations.map((rec) => (
                  <div key={rec.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-bold text-[#202124] break-words">
                          {rec.donorName}{' '}
                          <span className="font-mono text-[#D71920]">
                            ({rec.bloodGroup})
                          </span>
                        </h3>
                        <div className="text-xs font-mono text-neutral-500 tabular-nums mt-0.5">
                          তারিখ: {rec.donationDate}
                        </div>
                      </div>
                      <div className="text-xs font-bold font-mono text-emerald-800 text-right shrink-0 tabular-nums">
                        {rec.volumeMl} ml · {rec.units} ব্যাগ
                      </div>
                    </div>

                    <div className="text-xs text-neutral-700 space-y-1 leading-relaxed">
                      <div className="font-medium text-[#202124]">
                        {rec.hospitalOrCenter}
                      </div>
                      <div className="text-neutral-500">
                        {formatLocationLabel(
                          rec.divisionId,
                          rec.districtId,
                          rec.upazilaId,
                          lang
                        )}{' '}
                        · {donationComponentLabel(rec.donationType, lang)}
                      </div>
                      {rec.recipientSummary && (
                        <div className="text-neutral-600 bg-neutral-50 rounded-lg px-2.5 py-1.5 border border-neutral-200/70 break-words">
                          বিবরণ: {rec.recipientSummary}
                        </div>
                      )}
                      <div className="text-[11px] text-neutral-400 font-mono break-all">
                        UID: {rec.donorUid}
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        disabled={busyId === rec.id}
                        onClick={() => handleRemoveDonationRecord(rec.id)}
                        className="w-full min-h-[44px] px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                      >
                        {busyId === rec.id ? 'মুছে ফেলা হচ্ছে...' : 'ভুয়া রেকর্ড মুছুন'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-neutral-200 text-xs text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">রক্তদাতা ও গ্রুপ</th>
                    <th className="px-4 py-3 font-semibold">রক্তদানের তারিখ</th>
                    <th className="px-4 py-3 font-semibold">হাসপাতাল / সেন্টার ও এলাকা</th>
                    <th className="px-4 py-3 font-semibold text-right">পরিমাণ ও ধরন</th>
                    <th className="px-4 py-3 font-semibold">বিবরণ / রোগী নোট</th>
                    <th className="px-4 py-3 font-semibold text-right">পদক্ষেপ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredDonations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-neutral-500"
                      >
                        কোনো রক্তদানের ইতিহাস রেকর্ড পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredDonations.map((rec) => (
                      <tr key={rec.id} className="hover:bg-neutral-50/70">
                        <td className="px-4 py-3.5 align-top">
                          <div className="font-semibold text-[#202124]">
                            {rec.donorName}{' '}
                            <span className="font-mono text-[#D71920]">
                              ({rec.bloodGroup})
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-400 font-mono">
                            UID: {rec.donorUid.slice(0, 14)}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-top font-mono text-xs tabular-nums text-[#202124]">
                          {rec.donationDate}
                        </td>

                        <td className="px-4 py-3.5 align-top text-xs">
                          <div className="font-medium text-[#202124]">
                            {rec.hospitalOrCenter}
                          </div>
                          <div className="text-neutral-500 mt-0.5">
                            {formatLocationLabel(
                              rec.divisionId,
                              rec.districtId,
                              rec.upazilaId,
                              lang
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-top text-right text-xs tabular-nums">
                          <div className="font-semibold font-mono text-emerald-800">
                            {rec.volumeMl} ml · {rec.units} ব্যাগ
                          </div>
                          <div className="text-neutral-500 mt-0.5">
                            {donationComponentLabel(rec.donationType, lang)}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-top text-xs text-neutral-700 max-w-xs">
                          {rec.recipientSummary || '—'}
                        </td>

                        <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                          <button
                            type="button"
                            disabled={busyId === rec.id}
                            onClick={() => handleRemoveDonationRecord(rec.id)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            ভুয়া রেকর্ড মুছুন
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Enriched Donors Directory */}
        {tab === 'donors' && (
          <div>
            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-neutral-200">
              {filteredDonors.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-neutral-500">
                  কোনো ডোনার প্রোফাইল পাওয়া যায়নি।
                </div>
              ) : (
                filteredDonors.map((d) => {
                  const count = d.totalDonationsCount ?? 0;
                  const vol = d.totalVolumeMl ?? count * 450;
                  return (
                    <div key={d.uid} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-bold text-[#202124] break-words">
                            {d.displayName}{' '}
                            <span className="font-mono text-[#D71920]">
                              ({d.bloodGroup})
                            </span>
                          </h3>
                          <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">
                            {d.gender && d.gender !== 'not_specified'
                              ? `${genderLabel(d.gender, lang)} · `
                              : ''}
                            {d.ageYears ? `${d.ageYears} বছর · ` : ''}
                            {d.weightKg ? `${d.weightKg} কেজি` : ''}
                            {d.occupation ? ` · ${d.occupation}` : ''}
                          </div>
                        </div>
                        <div
                          className={`text-xs font-bold text-right shrink-0 ${
                            d.availability === 'available'
                              ? 'text-emerald-700'
                              : 'text-neutral-700'
                          }`}
                        >
                          {availabilityLabel(d.availability, lang)}
                        </div>
                      </div>

                      <div className="text-xs text-neutral-700 space-y-1 leading-relaxed">
                        <div>
                          <span className="text-neutral-500">এলাকা:</span>{' '}
                          {formatLocationLabel(
                            d.divisionId,
                            d.districtId,
                            d.upazilaId,
                            lang
                          )}
                        </div>
                        {d.preferredHospitalArea && (
                          <div>
                            <span className="text-neutral-500">পছন্দের হাসপাতাল:</span>{' '}
                            {d.preferredHospitalArea}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono tabular-nums">
                          <span className="font-semibold text-[#202124]">
                            {count} বার · {vol.toLocaleString()} ml
                          </span>
                          <span className="text-neutral-300">·</span>
                          <span className="text-neutral-600">
                            {d.lastDonationDate
                              ? `সর্বশেষ: ${d.lastDonationDate}`
                              : 'সর্বশেষ তারিখ নেই'}
                          </span>
                        </div>
                        <div className="text-neutral-600">
                          {d.isListed ? 'তালিকাভুক্ত' : 'লুকানো'} · {d.accountStatus}
                          {d.nightCallPreference
                            ? ` · ${nightCallPreferenceLabel(d.nightCallPreference, lang)}`
                            : ''}
                          {d.donationPreference
                            ? ` · ${donationPreferenceLabel(d.donationPreference, lang)}`
                            : ''}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono break-all">
                          UID: {d.uid}
                        </div>
                      </div>

                      <div className="pt-1">
                        <button
                          type="button"
                          disabled={busyId === d.uid}
                          onClick={() => handleToggleDonorList(d)}
                          className="w-full min-h-[44px] px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                        >
                          {busyId === d.uid
                            ? 'আপডেট হচ্ছে...'
                            : d.isListed
                              ? 'তালিকা থেকে লুকান'
                              : 'তালিকায় ফিরিয়ে আনুন'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="border-b border-neutral-200 text-xs text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">ডোনার ও শারীরিক তথ্য</th>
                    <th className="px-4 py-3 font-semibold">এলাকা ও পছন্দের হাসপাতাল</th>
                    <th className="px-4 py-3 font-semibold text-right">মোট রক্তদান ও সর্বশেষ তারিখ</th>
                    <th className="px-4 py-3 font-semibold">কল নীতিমালা ও প্রাপ্যতা</th>
                    <th className="px-4 py-3 font-semibold text-right">পদক্ষেপ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredDonors.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-neutral-500"
                      >
                        কোনো ডোনার প্রোফাইল পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredDonors.map((d) => {
                      const count = d.totalDonationsCount ?? 0;
                      const vol = d.totalVolumeMl ?? count * 450;
                      return (
                        <tr key={d.uid} className="hover:bg-neutral-50/70">
                          <td className="px-4 py-3.5 align-top">
                            <div className="font-semibold text-[#202124]">
                              {d.displayName}{' '}
                              <span className="font-mono text-[#D71920]">
                                ({d.bloodGroup})
                              </span>
                            </div>
                            <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">
                              {d.gender && d.gender !== 'not_specified'
                                ? `${genderLabel(d.gender, lang)} · `
                                : ''}
                              {d.ageYears ? `${d.ageYears} বছর · ` : ''}
                              {d.weightKg ? `${d.weightKg} কেজি` : ''}
                              {d.occupation ? ` · ${d.occupation}` : ''}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                              UID: {d.uid.slice(0, 12)}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 align-top text-xs text-neutral-700">
                            <div>
                              {formatLocationLabel(
                                d.divisionId,
                                d.districtId,
                                d.upazilaId,
                                lang
                              )}
                            </div>
                            {d.preferredHospitalArea && (
                              <div className="text-neutral-500 mt-0.5 max-w-xs">
                                হাসপাতাল: {d.preferredHospitalArea}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top text-right text-xs tabular-nums">
                            <div className="font-semibold font-mono text-[#202124]">
                              {count} বার · {vol.toLocaleString()} ml
                            </div>
                            <div className="text-neutral-500 mt-0.5 font-mono">
                              {d.lastDonationDate
                                ? `সর্বশেষ: ${d.lastDonationDate}`
                                : 'সর্বশেষ তারিখ উল্লেখ নেই'}
                            </div>
                            {d.donationPreference && (
                              <div className="text-[11px] text-neutral-500 mt-0.5">
                                {donationPreferenceLabel(
                                  d.donationPreference,
                                  lang
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top text-xs">
                            <div
                              className={`font-semibold ${
                                d.availability === 'available'
                                  ? 'text-emerald-700'
                                  : 'text-neutral-700'
                              }`}
                            >
                              {availabilityLabel(d.availability, lang)} ·{' '}
                              {d.isListed ? 'তালিকাভুক্ত' : 'লুকানো'} ·{' '}
                              {d.accountStatus}
                            </div>
                            {d.nightCallPreference && (
                              <div className="text-neutral-500 mt-0.5">
                                {nightCallPreferenceLabel(
                                  d.nightCallPreference,
                                  lang
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                            <button
                              type="button"
                              disabled={busyId === d.uid}
                              onClick={() => handleToggleDonorList(d)}
                              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {d.isListed
                                ? 'তালিকা থেকে লুকান'
                                : 'তালিকায় ফিরিয়ে আনুন'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: Donor Pledges & Contact Access Logs */}
        {tab === 'interactions' && (
          <div>
            <div className="px-4 py-3 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="text-xs sm:text-[13px] font-semibold text-neutral-700">
                {lang === 'bn'
                  ? 'ডোনারদের রক্তদানের সাড়া এবং ফোন নম্বর আনলক পর্যবেক্ষণ'
                  : 'Donor Pledges & Phone Contact Unlock Logs'}
              </div>
              <div className="grid grid-cols-2 sm:inline-flex gap-1 bg-neutral-100 p-1 rounded-lg w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setInteractionView('pledges')}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
                    interactionView === 'pledges'
                      ? 'bg-white text-[#202124] shadow-2xs'
                      : 'text-neutral-600 hover:text-[#202124]'
                  }`}
                >
                  {lang === 'bn'
                    ? `ডোনার সাড়া (${pledges.length})`
                    : `Donor Pledges (${pledges.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setInteractionView('contacts')}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
                    interactionView === 'contacts'
                      ? 'bg-white text-[#202124] shadow-2xs'
                      : 'text-neutral-600 hover:text-[#202124]'
                  }`}
                >
                  {lang === 'bn'
                    ? `আনলক লগ (${contactLogs.length})`
                    : `Contact Unlocks (${contactLogs.length})`}
                </button>
              </div>
            </div>

            {interactionView === 'pledges' ? (
              <div>
                {/* Mobile Card Layout */}
                <div className="md:hidden divide-y divide-neutral-200">
                  {filteredPledges.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-neutral-500">
                      কোনো ডোনার সাড়া রেকর্ড পাওয়া যায়নি।
                    </div>
                  ) : (
                    filteredPledges.map((pl) => (
                      <div key={pl.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-[15px] font-bold text-[#202124] break-words">
                              {pl.donorName}{' '}
                              <span className="font-mono text-[#D71920]">
                                ({pl.donorBloodGroup})
                              </span>
                            </h3>
                            <div className="text-xs font-medium text-neutral-700 mt-0.5 break-words">
                              {pl.hospitalName}
                            </div>
                          </div>
                          <span
                            className={`text-xs font-bold shrink-0 ${
                              pl.status === 'accepted'
                                ? 'text-emerald-700'
                                : pl.status === 'offered'
                                  ? 'text-amber-700'
                                  : 'text-neutral-600'
                            }`}
                          >
                            {pledgeStatusLabel(pl.status, lang)}
                          </span>
                        </div>
                        {pl.message && (
                          <p className="text-xs text-neutral-700 bg-neutral-50 rounded-lg px-2.5 py-2 border border-neutral-200/70 break-words">
                            {pl.message}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-neutral-500 pt-0.5">
                          <span className="break-all">
                            Req: {pl.requestId.slice(0, 14)} · UID: {pl.donorUid.slice(0, 12)}
                          </span>
                          <span className="tabular-nums">
                            {formatTimestamp(pl.updatedAt, lang)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-neutral-200 text-xs text-neutral-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">আগ্রহী ডোনার</th>
                        <th className="px-4 py-3 font-semibold">হাসপাতাল ও অনুরোধ আইডি</th>
                        <th className="px-4 py-3 font-semibold">ডোনারের বার্তা</th>
                        <th className="px-4 py-3 font-semibold">অবস্থা</th>
                        <th className="px-4 py-3 font-semibold text-right">সময়</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredPledges.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-10 text-center text-neutral-500"
                          >
                            কোনো ডোনার সাড়া রেকর্ড পাওয়া যায়নি।
                          </td>
                        </tr>
                      ) : (
                        filteredPledges.map((pl) => (
                          <tr key={pl.id} className="hover:bg-neutral-50/70">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[#202124]">
                                {pl.donorName}{' '}
                                <span className="font-mono text-[#D71920]">
                                  ({pl.donorBloodGroup})
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-neutral-400">
                                UID: {pl.donorUid.slice(0, 14)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <div className="font-medium text-[#202124]">
                                {pl.hospitalName}
                              </div>
                              <div className="font-mono text-neutral-400 mt-0.5">
                                Req: {pl.requestId.slice(0, 14)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-neutral-700 max-w-xs">
                              {pl.message || '—'}
                            </td>
                            <td className="px-4 py-3 text-xs font-semibold">
                              <span
                                className={
                                  pl.status === 'accepted'
                                    ? 'text-emerald-700'
                                    : pl.status === 'offered'
                                      ? 'text-amber-700'
                                      : 'text-neutral-600'
                                }
                              >
                                {pledgeStatusLabel(pl.status, lang)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-neutral-500 text-right font-mono tabular-nums">
                              {formatTimestamp(pl.updatedAt, lang)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div>
                {/* Mobile Card Layout */}
                <div className="md:hidden divide-y divide-neutral-200">
                  {filteredContactLogs.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-neutral-500">
                      কোনো নম্বর আনলক লগ পাওয়া যায়নি।
                    </div>
                  ) : (
                    filteredContactLogs.map((cl) => (
                      <div key={cl.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1 text-xs">
                            <div>
                              <span className="text-neutral-500">কলার:</span>{' '}
                              <span className="font-semibold text-[#202124] break-words">
                                {nameByUid.get(cl.callerUid) || 'নিবন্ধিত ব্যবহারকারী'}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-500">ডোনার:</span>{' '}
                              <span className="font-semibold text-[#202124] break-words">
                                {nameByUid.get(cl.donorUid) || 'তালিকাভুক্ত ডোনার'}
                              </span>
                            </div>
                          </div>
                          <div className="font-mono text-xs font-bold tabular-nums text-[#202124] shrink-0">
                            {cl.accessCount} বার
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
                          <span>{contactMethodLabel(cl.requestedMethod, lang)}</span>
                          <span className="font-mono text-[11px] text-neutral-500 tabular-nums">
                            {formatTimestamp(cl.updatedAt, lang)}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-neutral-400 break-all">
                          Caller: {cl.callerUid.slice(0, 14)} · Donor: {cl.donorUid.slice(0, 14)}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-neutral-200 text-xs text-neutral-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">কে নম্বর দেখেছেন (Caller)</th>
                        <th className="px-4 py-3 font-semibold">যার নম্বর আনলক হয়েছে (Donor)</th>
                        <th className="px-4 py-3 font-semibold">যোগাযোগ মাধ্যম</th>
                        <th className="px-4 py-3 font-semibold text-right">মোট আনলক সংখ্যা</th>
                        <th className="px-4 py-3 font-semibold text-right">সর্বশেষ সময়</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredContactLogs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-10 text-center text-neutral-500"
                          >
                            কোনো নম্বর আনলক লগ পাওয়া যায়নি।
                          </td>
                        </tr>
                      ) : (
                        filteredContactLogs.map((cl) => (
                          <tr key={cl.id} className="hover:bg-neutral-50/70">
                            <td className="px-4 py-3 text-xs">
                              <div className="font-semibold text-[#202124]">
                                {nameByUid.get(cl.callerUid) || 'নিবন্ধিত ব্যবহারকারী'}
                              </div>
                              <div className="font-mono text-neutral-400">
                                {cl.callerUid.slice(0, 16)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <div className="font-semibold text-[#202124]">
                                {nameByUid.get(cl.donorUid) || 'তালিকাভুক্ত ডোনার'}
                              </div>
                              <div className="font-mono text-neutral-400">
                                {cl.donorUid.slice(0, 16)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-neutral-700">
                              {contactMethodLabel(cl.requestedMethod, lang)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-[#202124]">
                              {cl.accessCount} বার
                            </td>
                            <td className="px-4 py-3 text-xs text-neutral-500 text-right font-mono tabular-nums">
                              {formatTimestamp(cl.updatedAt, lang)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: Abuse Reports Queue */}
        {tab === 'reports' && (
          <div>
            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-neutral-200">
              {filteredReports.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-neutral-500">
                  কোনো রিপোর্ট পাওয়া যায়নি।
                </div>
              ) : (
                filteredReports.map((rep) => (
                  <div key={rep.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-bold text-[#202124] break-words">
                          {reportReasonLabel(rep.reason, lang)}
                        </h3>
                        <div className="text-[11px] font-mono text-neutral-500 mt-0.5 break-all">
                          {rep.targetType} · {rep.targetId}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-neutral-800 shrink-0">
                        {reportStatusLabel(rep.status, lang)}
                      </span>
                    </div>

                    <div className="text-xs text-neutral-700 space-y-1.5 leading-relaxed">
                      <p className="break-words">{rep.description || '—'}</p>
                      {rep.resolutionNote && (
                        <div className="text-xs text-emerald-900 bg-emerald-50 rounded-lg px-2.5 py-1.5 border border-emerald-200 break-words">
                          সমাধান নোট: {rep.resolutionNote}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={busyId === rep.id}
                        onClick={() => handleReportStatus(rep.id, 'resolved')}
                        className="min-h-[44px] px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                      >
                        সমাধানকৃত
                      </button>
                      <button
                        type="button"
                        disabled={busyId === rep.id}
                        onClick={() => handleReportStatus(rep.id, 'dismissed')}
                        className="min-h-[44px] px-3 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                      >
                        খারিজ
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-neutral-200 text-xs text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">কারণ ও ধরন</th>
                    <th className="px-4 py-3 font-semibold">বিবরণ ও সমাধান নোট</th>
                    <th className="px-4 py-3 font-semibold">অবস্থা</th>
                    <th className="px-4 py-3 font-semibold text-right">পদক্ষেপ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-neutral-500"
                      >
                        কোনো রিপোর্ট পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((rep) => (
                      <tr key={rep.id} className="hover:bg-neutral-50/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#202124]">
                            {reportReasonLabel(rep.reason, lang)}
                          </div>
                          <div className="text-xs text-neutral-500 font-mono">
                            {rep.targetType} · {rep.targetId.slice(0, 14)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-700 max-w-xs">
                          {rep.description || '—'}
                          {rep.resolutionNote && (
                            <div className="text-[11px] text-emerald-800 mt-1">
                              সমাধান নোট: {rep.resolutionNote}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium">
                          {reportStatusLabel(rep.status, lang)}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            disabled={busyId === rep.id}
                            onClick={() => handleReportStatus(rep.id, 'resolved')}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            সমাধানকৃত
                          </button>
                          <button
                            type="button"
                            disabled={busyId === rep.id}
                            onClick={() => handleReportStatus(rep.id, 'dismissed')}
                            className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            খারিজ
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: Registered Users */}
        {tab === 'users' && (
          <div>
            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-neutral-200">
              {filteredUsers.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-neutral-500">
                  কোনো ব্যবহারকারী পাওয়া যায়নি।
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const roleEntry = adminRoles.find((r) => r.uid === u.uid);
                  const hasDonorProfile = liveDonors.some((d) => d.uid === u.uid);
                  return (
                    <div key={u.uid} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-bold text-[#202124] break-words">
                            {u.fullName}
                          </h3>
                          <div className="text-xs text-neutral-600 break-all mt-0.5">
                            {u.email}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold shrink-0 ${
                            u.accountStatus === 'active'
                              ? 'text-emerald-700'
                              : 'text-[#D71920]'
                          }`}
                        >
                          {u.accountStatus}
                        </span>
                      </div>

                      <div className="text-xs text-neutral-600 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
                        {roleEntry ? (
                          <span className="font-bold text-amber-900">
                            🛡️{' '}
                            {roleEntry.role === 'moderator'
                              ? lang === 'bn'
                                ? 'মডারেটর'
                                : 'Moderator'
                              : roleEntry.role}
                          </span>
                        ) : (
                          <span>
                            {lang === 'bn' ? 'সাধারণ ব্যবহারকারী' : 'Standard User'}
                          </span>
                        )}
                        {hasDonorProfile && (
                          <>
                            <span className="text-neutral-300">·</span>
                            <span className="text-emerald-700 font-medium">
                              ডোনার প্রোফাইল যুক্ত
                            </span>
                          </>
                        )}
                        <span className="text-neutral-300">·</span>
                        <span>{formatTimestamp(u.createdAt, lang)}</span>
                      </div>

                      <div className="text-[11px] font-mono text-neutral-400 break-all">
                        UID: {u.uid}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          type="button"
                          disabled={busyId === u.uid}
                          onClick={() => handleToggleUserStatus(u)}
                          className={`w-full min-h-[44px] px-3.5 py-2 border text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50 ${
                            u.accountStatus === 'suspended'
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200'
                              : 'bg-red-50 hover:bg-red-100 text-red-900 border-red-200'
                          }`}
                        >
                          {busyId === u.uid
                            ? 'অপেক্ষা করুন...'
                            : u.accountStatus === 'suspended'
                              ? lang === 'bn'
                                ? 'সচল করুন'
                                : 'Activate'
                              : lang === 'bn'
                                ? 'স্থগিত (Suspend)'
                                : 'Suspend'}
                        </button>
                        {isSuperAdmin &&
                          (roleEntry && roleEntry.role === 'moderator' ? (
                            <button
                              type="button"
                              disabled={busyId === `mod_${u.uid}`}
                              onClick={() => handleRevokeModerator(u)}
                              className="w-full min-h-[44px] px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-semibold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
                            >
                              {lang === 'bn'
                                ? 'মডারেটর প্রত্যাহার'
                                : 'Revoke Moderator'}
                            </button>
                          ) : !roleEntry ? (
                            <button
                              type="button"
                              disabled={busyId === `mod_${u.uid}`}
                              onClick={() => handlePromoteModerator(u)}
                              className="w-full min-h-[44px] px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 text-xs font-semibold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
                            >
                              {lang === 'bn' ? 'মডারেটর বানান' : 'Make Moderator'}
                            </button>
                          ) : null)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[740px] text-left text-sm">
                <thead className="border-b border-neutral-200 text-xs text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">নাম ও ইমেইল</th>
                    <th className="px-4 py-3 font-semibold">অ্যাকাউন্ট অবস্থা</th>
                    <th className="px-4 py-3 font-semibold">রোল ও নিবন্ধন তারিখ</th>
                    <th className="px-4 py-3 font-semibold text-right">পদক্ষেপ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-neutral-500"
                      >
                        কোনো ব্যবহারকারী পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const roleEntry = adminRoles.find((r) => r.uid === u.uid);
                      const hasDonorProfile = liveDonors.some(
                        (d) => d.uid === u.uid
                      );
                      return (
                        <tr key={u.uid} className="hover:bg-neutral-50/70">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#202124]">
                              {u.fullName}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {u.email}{' '}
                              {hasDonorProfile && (
                                <span className="text-emerald-700">
                                  · ডোনার প্রোফাইল যুক্ত
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium">
                            <span
                              className={
                                u.accountStatus === 'active'
                                  ? 'text-emerald-700'
                                  : 'text-[#D71920]'
                              }
                            >
                              {u.accountStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-neutral-600 tabular-nums">
                            {roleEntry ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                🛡️{' '}
                                {roleEntry.role === 'moderator'
                                  ? lang === 'bn'
                                    ? 'মডারেটর'
                                    : 'Moderator'
                                  : roleEntry.role}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-700">
                                {lang === 'bn' ? 'সাধারণ ব্যবহারকারী' : 'User'}
                              </span>
                            )}{' '}
                            · {formatTimestamp(u.createdAt, lang)}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              disabled={busyId === u.uid}
                              onClick={() => handleToggleUserStatus(u)}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {u.accountStatus === 'suspended'
                                ? lang === 'bn'
                                  ? 'সচল করুন'
                                  : 'Activate'
                                : lang === 'bn'
                                  ? 'স্থগিত (Suspend)'
                                  : 'Suspend'}
                            </button>
                            {isSuperAdmin &&
                              (roleEntry && roleEntry.role === 'moderator' ? (
                                <button
                                  type="button"
                                  disabled={busyId === `mod_${u.uid}`}
                                  onClick={() => handleRevokeModerator(u)}
                                  className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                                >
                                  {lang === 'bn'
                                    ? 'মডারেটর প্রত্যাহার'
                                    : 'Revoke Moderator'}
                                </button>
                              ) : !roleEntry ? (
                                <button
                                  type="button"
                                  disabled={busyId === `mod_${u.uid}`}
                                  onClick={() => handlePromoteModerator(u)}
                                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                                >
                                  {lang === 'bn'
                                    ? 'মডারেটর বানান'
                                    : 'Make Moderator'}
                                </button>
                              ) : null)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 8: Immutable Audit Logs */}
        {tab === 'audit' && (
          <div>
            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-neutral-200">
              {filteredAuditLogs.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-neutral-500">
                  কোনো অডিট লগ এখনো তৈরি হয়নি।
                </div>
              ) : (
                filteredAuditLogs.map((log) => (
                  <div key={log.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-mono text-xs font-bold text-[#202124] break-all">
                        {log.action}
                      </div>
                      <span className="text-[11px] font-mono text-neutral-500 tabular-nums shrink-0">
                        {formatTimestamp(log.createdAt, lang)}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-700 bg-neutral-50 rounded-lg px-2.5 py-2 border border-neutral-200/70 break-words">
                      <span className="text-neutral-500">কারণ:</span> {log.reason}
                    </div>
                    <div className="text-[11px] text-neutral-500 space-y-0.5 break-all">
                      <div>অ্যাডমিন: {log.actorEmail}</div>
                      <div className="font-mono">
                        লক্ষ্য: {log.targetType} · {log.targetId}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-neutral-200 text-xs text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">অ্যাকশন ও লক্ষ্য</th>
                    <th className="px-4 py-3 font-semibold">অ্যাডমিন</th>
                    <th className="px-4 py-3 font-semibold">কারণ</th>
                    <th className="px-4 py-3 font-semibold text-right">সময়</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-neutral-500"
                      >
                        কোনো অডিট লগ এখনো তৈরি হয়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50/70">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-[#202124]">
                          {log.action} ({log.targetType} ·{' '}
                          {log.targetId.slice(0, 14)})
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-600">
                          {log.actorEmail}
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-700">
                          {log.reason}
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500 text-right font-mono tabular-nums">
                          {formatTimestamp(log.createdAt, lang)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 9: Authoritative App Release & Update Control */}
        {tab === 'release' && (
          <div className="p-4 sm:p-6 space-y-6">
            {/* Live Build & Firestore Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                <div className="text-xs font-semibold text-neutral-500">
                  {lang === 'bn' ? 'বর্তমান চলমান অ্যাপ বিল্ড' : 'Current Running Build'}
                </div>
                <div className="text-lg font-bold font-mono text-[#202124]">
                  v{CURRENT_APP_VERSION}
                </div>
                <div className="text-[11px] text-neutral-500 font-mono break-all">
                  Build: {CURRENT_BUILD_TIME || 'dev-runtime'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                <div className="text-xs font-semibold text-emerald-800">
                  {lang === 'bn'
                    ? 'সর্বশেষ প্রকাশিত Firestore রিলিজ ফিড'
                    : 'Live Firestore Release Feed (/appConfig/release)'}
                </div>
                <div className="text-lg font-bold font-mono text-emerald-950">
                  {releaseConfig ? `v${releaseConfig.version}` : lang === 'bn' ? 'এখনো সেট করা হয়নি' : 'Not configured yet'}
                </div>
                <div className="text-[11px] text-emerald-800">
                  {releaseConfig
                    ? `Min: v${releaseConfig.minSupportedVersion} · Critical: ${
                        releaseConfig.isCriticalUpdate ? 'Yes' : 'No'
                      }`
                    : lang === 'bn'
                      ? 'Web (/version.json + PWA) এবং GitHub Releases সক্রিয় রয়েছে।'
                      : 'Web (/version.json + PWA) and GitHub Releases active.'}
                </div>
              </div>
            </div>

            {isSuperAdmin ? (
              <form onSubmit={handlePublishAppRelease} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-200 pb-2.5">
                  <Rocket className="w-5 h-5 text-[#D71920]" />
                  <h3 className="text-sm sm:text-base font-bold text-[#202124]">
                    {lang === 'bn'
                      ? 'নতুন GitHub রিলিজ ও ইন-অ্যাপ আপডেট ঘোষণা প্রকাশ করুন'
                      : 'Publish New App Release Notification'}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'bn' ? 'নতুন ভার্সন (SemVer)' : 'New Version (SemVer)'}
                    </label>
                    <input
                      type="text"
                      required
                      value={relVersion}
                      onChange={(e) => setRelVersion(e.target.value)}
                      placeholder="1.1.0"
                      className="w-full min-h-[42px] px-3 py-2 text-sm font-mono border border-neutral-300 rounded-xl focus:outline-none focus:border-[#D71920]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'bn'
                        ? 'ন্যূনতম সমর্থিত ভার্সন'
                        : 'Minimum Supported Version'}
                    </label>
                    <input
                      type="text"
                      required
                      value={relMinVersion}
                      onChange={(e) => setRelMinVersion(e.target.value)}
                      placeholder="1.0.0"
                      className="w-full min-h-[42px] px-3 py-2 text-sm font-mono border border-neutral-300 rounded-xl focus:outline-none focus:border-[#D71920]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      GitHub Repo (owner/repo)
                    </label>
                    <input
                      type="text"
                      value={relGithubRepo}
                      onChange={(e) => setRelGithubRepo(e.target.value)}
                      placeholder="username/roktodei"
                      className="w-full min-h-[42px] px-3 py-2 text-sm font-mono border border-neutral-300 rounded-xl focus:outline-none focus:border-[#D71920]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      GitHub Release URL (https://github.com/...)
                    </label>
                    <input
                      type="url"
                      value={relReleaseUrl}
                      onChange={(e) => setRelReleaseUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo/releases/tag/v1.1.0"
                      className="w-full min-h-[42px] px-3 py-2 text-xs font-mono border border-neutral-300 rounded-xl focus:outline-none focus:border-[#D71920]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      APK Download URL (https://github.com/...)
                    </label>
                    <input
                      type="url"
                      value={relApkUrl}
                      onChange={(e) => setRelApkUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo/releases/download/v1.1.0/RoktoDei-v1.1.0.apk"
                      className="w-full min-h-[42px] px-3 py-2 text-xs font-mono border border-neutral-300 rounded-xl focus:outline-none focus:border-[#D71920]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'bn'
                      ? 'APK SHA-256 Checksum (৬৪ অক্ষরের হেক্স — ঐচ্ছিক)'
                      : 'APK SHA-256 Checksum (64 hex chars — optional)'}
                  </label>
                  <input
                    type="text"
                    maxLength={64}
                    value={relSha256}
                    onChange={(e) => setRelSha256(e.target.value)}
                    placeholder="64-char sha256 hex from RoktoDei-vX.Y.Z.apk.sha256"
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-mono border border-neutral-300 rounded-xl focus:outline-none focus:border-[#D71920]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'bn' ? 'আপডেট নোট (বাংলা)' : 'Release Notes (Bengali)'}
                    </label>
                    <textarea
                      rows={3}
                      maxLength={800}
                      value={relNotesBn}
                      onChange={(e) => setRelNotesBn(e.target.value)}
                      placeholder="নতুন ফিচার, বাগ ফিক্স ও নিরাপত্তা উন্নতি..."
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-xl focus:outline-none focus:border-[#D71920]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Release Notes (English)
                    </label>
                    <textarea
                      rows={3}
                      maxLength={800}
                      value={relNotesEn}
                      onChange={(e) => setRelNotesEn(e.target.value)}
                      placeholder="New features, bug fixes, and security hardening..."
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-xl focus:outline-none focus:border-[#D71920]"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-neutral-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={relCritical}
                    onChange={(e) => setRelCritical(e.target.checked)}
                    className="w-4 h-4 accent-[#D71920] rounded cursor-pointer"
                  />
                  <span>
                    {lang === 'bn'
                      ? 'জরুরি নিরাপত্তা আপডেট (প্রতিবার অ্যাপ খুললে পপআপ দেখাবে)'
                      : 'Mark as Critical Security Update (re-prompts until updated)'}
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={busyId === 'publish_release'}
                  className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#D71920] hover:bg-[#B2141A] disabled:opacity-60 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Rocket className="w-4 h-4" />
                  <span>
                    {busyId === 'publish_release'
                      ? lang === 'bn'
                        ? 'প্রকাশ হচ্ছে...'
                        : 'Publishing...'
                      : lang === 'bn'
                        ? 'সকল ব্যবহারকারীর জন্য আপডেট প্রকাশ করুন'
                        : 'Publish Release Notification'}
                  </span>
                </button>
              </form>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                {lang === 'bn'
                  ? 'নতুন রিলিজ পাবলিশ করার ক্ষমতা শুধুমাত্র সুপার অ্যাডমিনের জন্য সংরক্ষিত।'
                  : 'Publishing new app releases is restricted to Super Admin.'}
              </div>
            )}

            {/* GitHub Tag Release Automation Guide */}
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2 text-xs text-neutral-700 leading-relaxed">
              <div className="font-bold text-neutral-900">
                {lang === 'bn'
                  ? 'GitHub Release অটোমেশন নির্দেশিকা:'
                  : 'GitHub Release Automation Workflow:'}
              </div>
              <p>
                {lang === 'bn'
                  ? '১) package.json-এ নতুন ভার্সন সেট করুন (যেমন 1.1.0), ২) GitHub-এ ট্যাগ পুশ করুন (git tag v1.1.0 && git push origin v1.1.0)। GitHub Actions স্বয়ংক্রিয়ভাবে সাইনড APK + SHA-256 চেকসামসহ Release তৈরি করবে। এরপর উপরের ফর্ম থেকে পাবলিশ করলে পুরনো APK ও Web ব্যবহারকারীরা সাথে সাথে পপআপ ও নোটিফিকেশন বেল এলার্ট পাবেন।'
                  : '1) Bump version in package.json (e.g. 1.1.0), 2) Push tag v1.1.0 to GitHub. GitHub Actions auto-publishes the signed APK + SHA-256 checksum. Then publish above to alert all installed APK and Web users in real time.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
