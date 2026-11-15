import type { Timestamp } from 'firebase/firestore';

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type AvailabilityStatus =
  | 'available'
  | 'temporarily_unavailable'
  | 'not_specified';

export type ContactMethod = 'call' | 'sms' | 'whatsapp' | 'imo';

export type DonorGender = 'male' | 'female' | 'other' | 'not_specified';

export type DonationComponentType = 'whole_blood' | 'platelet' | 'plasma';

export type DonorDonationPreference = 'whole_blood' | 'platelet' | 'both';

export type NightCallPreference = 'anytime' | 'daytime_only' | 'message_first';

export type AccountStatus = 'active' | 'suspended' | 'deactivated';

export type AppLanguage = 'bn' | 'en';

export type BloodRequestUrgency = 'emergency' | 'urgent' | 'scheduled';

export type BloodRequestStatus =
  | 'open'
  | 'booked'
  | 'fulfilled'
  | 'cancelled'
  | 'expired'
  | 'removed';

export type PledgeStatus = 'offered' | 'accepted' | 'declined' | 'withdrawn';

export type ReportReason =
  | 'incorrect_phone'
  | 'abusive_contact'
  | 'fake_profile'
  | 'spam'
  | 'misleading_availability'
  | 'other';

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export type AdminRoleType = 'admin' | 'moderator';

export type AuditActionType =
  | 'suspend_user'
  | 'restore_user'
  | 'unlist_donor'
  | 'relist_donor'
  | 'resolve_report'
  | 'dismiss_report'
  | 'review_report'
  | 'remove_blood_request'
  | 'reopen_blood_request'
  | 'remove_donation_record'
  | 'grant_moderator'
  | 'revoke_moderator'
  | 'publish_app_release';

export interface UserProfile {
  uid: string;
  fullName: string;
  username?: string;
  usernameLower?: string;
  email: string;
  accountStatus: AccountStatus;
  preferredLanguage: AppLanguage;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface UsernameReservation {
  username: string;
  usernameLower: string;
  uid: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface DonorProfile {
  uid: string;
  displayName: string;
  username?: string;
  bloodGroup: BloodGroup;
  divisionId: string;
  districtId: string;
  upazilaId: string;
  availability: AvailabilityStatus;
  lastAvailabilityUpdatedAt: Timestamp | null;
  contactMethods: ContactMethod[];
  hasConsented: boolean;
  contactConsentAt: Timestamp | null;
  isListed: boolean;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  lastDonationDate: string;
  // Extended organized donor profile attributes (optional for backward compatibility)
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
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface DonorPrivateContact {
  uid: string;
  phoneNumber: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface DonationRecord {
  id: string;
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
  linkedRequestId: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ContactAccessLogRecord {
  id: string;
  callerUid: string;
  donorUid: string;
  requestedMethod: ContactMethod;
  accessCount: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface BookedDonorSummary {
  donorUid: string;
  donorName: string;
  donorBloodGroup?: BloodGroup;
  units: number;
  bookedAt?: Timestamp | null;
}

export interface BloodRequest {
  id: string;
  createdBy: string;
  requesterName: string;
  bloodGroup: BloodGroup;
  units: number;
  fulfilledUnits?: number; // Confirmed bags count (e.g., 1 of 3)
  bookedDonors?: BookedDonorSummary[]; // Donors who confirmed bags
  divisionId: string;
  districtId: string;
  upazilaId: string;
  hospitalName: string;
  urgency: BloodRequestUrgency;
  requiredDate: string;
  patientNote: string;
  contactMethods: ContactMethod[];
  hasConsented: boolean;
  status: BloodRequestStatus;
  // Donor booking & anti-disturb lock attributes
  bookedDonorUid?: string;
  bookedDonorName?: string;
  bookingNote?: string;
  bookedAt?: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface RequestPledge {
  id: string;
  requestId: string;
  requestCreatorUid: string;
  hospitalName: string;
  donorUid: string;
  donorName: string;
  donorBloodGroup: BloodGroup;
  units?: number; // Number of bags offered (defaults to 1)
  message: string;
  status: PledgeStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AbuseReport {
  id: string;
  reportedBy: string;
  targetType: 'donor' | 'blood_request';
  targetId: string;
  targetUid: string;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  reviewedBy: string;
  resolutionNote: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AdminRoleRecord {
  uid: string;
  role: AdminRoleType;
  grantedBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AuditLogRecord {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: AuditActionType;
  targetType:
    | 'user'
    | 'donor'
    | 'report'
    | 'blood_request'
    | 'donation_record'
    | 'admin_role'
    | 'app_config';
  targetId: string;
  reason: string;
  createdAt: Timestamp | null;
}

export interface AppReleaseConfig {
  version: string;
  minSupportedVersion: string;
  releaseNotesBn: string;
  releaseNotesEn: string;
  githubRepo: string;
  releaseUrl: string;
  apkDownloadUrl: string;
  sha256Checksum: string;
  isCriticalUpdate: boolean;
  publishedBy: string;
  updatedAt: Timestamp | null;
}

export type NotificationType =
  | 'pledge_received' // someone offered blood on your request
  | 'donor_booked' // donor booked on your request or you got booked
  | 'pledge_accepted' // your offer was accepted by requester
  | 'moderator_granted' // you were assigned moderator role
  | 'moderator_revoked' // moderator role was revoked with reason
  | 'user_status_changed' // account suspended or restored with reason
  | 'emergency_alert' // emergency request matching blood group / location
  | 'eligibility_reminder' // 90+ days since last donation, ready to donate
  | 'system_update'; // platform notice or security update

export interface NotificationRecord {
  id: string;
  targetUid: string;
  type: NotificationType;
  titleBn: string;
  titleEn: string;
  messageBn: string;
  messageEn: string;
  targetView: AppView;
  targetId?: string;
  targetDonorUid?: string;
  urgency: 'emergency' | 'urgent' | 'info';
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type AppView =
  | 'find_donors'
  | 'blood_requests'
  | 'how_it_works'
  | 'safety'
  | 'profile'
  | 'admin'
  | 'privacy'
  | 'terms';
