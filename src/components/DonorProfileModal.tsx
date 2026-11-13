import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { BloodGroup, ContactMethod, DonorProfile } from '../types';
import { formatLocationLabel } from '../data/bdLocations';
import { buildContactDeepLink, daysSinceDate } from '../lib/validation';

export interface PledgeBookingContext {
  requestId: string;
  hospitalName?: string;
  requestBloodGroup?: BloodGroup;
  totalUnits?: number;
  fulfilledUnits?: number;
  offeredUnits?: number;
  pledgeMessage?: string;
  pledgeId?: string;
}

interface DonorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  donor: DonorProfile | null;
  phoneNumber?: string;
  onRequestContact?: (donor: DonorProfile, method: ContactMethod) => void;
  pledgeContext?: PledgeBookingContext | null;
  onConfirmBook?: (donor: DonorProfile, units: number) => Promise<void> | void;
  isBooking?: boolean;
  lang?: 'bn' | 'en';
}

export function DonorProfileModal({
  isOpen,
  onClose,
  donor,
  phoneNumber,
  onRequestContact,
  pledgeContext,
  onConfirmBook,
  isBooking = false,
  lang = 'bn',
}: DonorProfileModalProps) {
  const [copiedPhone, setCopiedPhone] = useState(false);

  if (!isOpen || !donor) return null;

  const unlockedPhone = phoneNumber?.trim() || '';

  const handleCall = () => {
    if (!unlockedPhone) return;
    const uri = buildContactDeepLink(unlockedPhone, 'call');
    if (uri) window.location.href = uri;
  };

  const handleSms = () => {
    if (!unlockedPhone) return;
    const uri = buildContactDeepLink(unlockedPhone, 'sms');
    if (uri) window.location.href = uri;
  };

  const handleWhatsApp = () => {
    if (!unlockedPhone) return;
    const baseUri = buildContactDeepLink(unlockedPhone, 'whatsapp');
    if (!baseUri) return;
    const text = encodeURIComponent(
      lang === 'bn'
        ? `আসসালামু আলাইকুম ${donor.displayName}, রক্তদেই অ্যাপ থেকে রক্তের জন্য যোগাযোগ করছি।`
        : `Hello ${donor.displayName}, contacting you regarding blood donation via Rokto Dei.`
    );
    window.location.href = `${baseUri}?text=${text}`;
  };

  const handleImo = async () => {
    if (!unlockedPhone) return;
    try {
      await navigator.clipboard.writeText(unlockedPhone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 3500);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  const daysSinceLast = daysSinceDate(donor.lastDonationDate);
  const isEligible = daysSinceLast === null || daysSinceLast >= 90;
  const offeredBags = pledgeContext?.offeredUnits || 1;
  const totalBags = pledgeContext?.totalUnits || 3;
  const currentFulfilled = pledgeContext?.fulfilledUnits || 0;
  const remainingAfterThis = Math.max(
    0,
    totalBags - (currentFulfilled + offeredBags)
  );

  const availableMethods: ContactMethod[] =
    donor.contactMethods && donor.contactMethods.length > 0
      ? donor.contactMethods
      : ['call', 'sms'];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        lang === 'bn' ? 'রক্তদাতার পূর্ণাঙ্গ প্রোফাইল' : 'Donor Full Profile'
      }
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-3xl border border-neutral-200 p-5 sm:p-7 space-y-5 my-auto max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
          </button>

          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
            {lang === 'bn' ? 'রক্তদাতার তথ্য' : 'Donor Profile'}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Header: Avatar + Name + Blood Group */}
        <div className="bg-[#FAF8F9] rounded-2xl p-4 sm:p-5 border border-neutral-200/80 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-[#FDF2F4] border-2 border-white shadow-xs flex items-center justify-center shrink-0">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#C80828]">
              {donor.bloodGroup}
            </span>
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-[#1F242D]">
                {donor.displayName}
              </h2>
              {donor.username && (
                <span className="font-mono text-xs font-semibold text-[#C80828] bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  @{donor.username}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-semibold inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lang === 'bn' ? 'ইমেইল যাচাইকৃত' : 'Email Verified'}</span>
              </span>
            </div>

            <div className="text-xs text-neutral-600 flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-0.5">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                <span>
                  {formatLocationLabel(
                    donor.divisionId,
                    donor.districtId,
                    donor.upazilaId,
                    lang
                  )}
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  donor.availability === 'available'
                    ? 'font-semibold text-emerald-700'
                    : 'text-neutral-500'
                }
              >
                {donor.availability === 'available'
                  ? lang === 'bn'
                    ? 'রক্তদানের জন্য প্রস্তুত'
                    : 'Available'
                  : lang === 'bn'
                  ? 'অপেক্ষমাণ'
                  : 'Unavailable'}
              </span>
            </div>

            {donor.occupation && (
              <p className="text-xs text-neutral-500">
                <span className="font-medium text-neutral-700">
                  {lang === 'bn' ? 'পেশা: ' : 'Occupation: '}
                </span>
                {donor.occupation}
              </p>
            )}
          </div>
        </div>

        {/* Pledge / Offer Context Card (When viewing through a response/notification) */}
        {pledgeContext && (
          <div className="bg-[#FFF9FA] border-2 border-[#FADCE2] rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-bold text-[#C80828]">
                <Heart className="w-4 h-4 fill-[#C80828]" />
                <span>
                  {lang === 'bn'
                    ? `রক্তদানের সম্মতি: ${offeredBags} ব্যাগ রক্ত`
                    : `Donation Offer: ${offeredBags} Bag(s)`}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#FADCE2] text-[#C80828] text-xs font-mono font-bold">
                {currentFulfilled}/{totalBags}{' '}
                {lang === 'bn' ? 'ব্যাগ সম্পন্ন' : 'Bags'}
              </span>
            </div>

            {pledgeContext.hospitalName && (
              <div className="text-xs text-neutral-700">
                <span className="font-semibold text-neutral-900">
                  {lang === 'bn' ? 'হাসপাতাল: ' : 'Hospital: '}
                </span>
                {pledgeContext.hospitalName}
              </div>
            )}

            {pledgeContext.pledgeMessage && (
              <div className="bg-white p-3 rounded-xl border border-neutral-200 text-xs text-neutral-700 leading-relaxed italic">
                "{pledgeContext.pledgeMessage}"
              </div>
            )}

            <div className="text-xs text-neutral-600 leading-relaxed">
              {remainingAfterThis > 0 ? (
                <span className="text-[#1F242D] font-medium">
                  {lang === 'bn'
                    ? `এই ডোনারকে বুক করলে আপনার মোট ${totalBags} ব্যাগের মধ্যে ${currentFulfilled + offeredBags}টি চূড়ান্ত হবে এবং অবশিষ্ট ${remainingAfterThis}টি ব্যাগের জন্য অনুরোধটি চালু থাকবে।`
                    : `Booking this donor confirms ${currentFulfilled + offeredBags} of ${totalBags} bags. Request stays open for the remaining ${remainingAfterThis} bag(s).`}
                </span>
              ) : (
                <span className="text-emerald-800 font-bold">
                  {lang === 'bn'
                    ? `এই ডোনারকে বুক করলে আপনার সবগুলো ব্যাগ (${totalBags}টি) সম্পন্ন হবে এবং নতুন কল বন্ধ করা হবে।`
                    : `Booking this donor fully fulfills all ${totalBags} bags. Incoming calls will be locked.`}
                </span>
              )}
            </div>

            {/* Direct Booking Action Button */}
            {onConfirmBook && (
              <button
                type="button"
                disabled={isBooking}
                onClick={() => onConfirmBook(donor, offeredBags)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#C80828] hover:bg-[#A3051E] disabled:bg-neutral-400 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
              >
                {isBooking ? (
                  <span>{lang === 'bn' ? 'বুক হচ্ছে...' : 'Booking...'}</span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>
                      {lang === 'bn'
                        ? `এই ডোনারকে নিশ্চিত / বুক করুন (${offeredBags} ব্যাগ)`
                        : `Confirm & Book Donor (${offeredBags} Bag)`}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* 4-Item Impact & Health Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-0.5">
            <div className="text-[11px] text-neutral-500">
              {lang === 'bn' ? 'মোট রক্তদান' : 'Donations'}
            </div>
            <div className="text-lg font-bold font-mono text-[#1F242D]">
              {donor.totalDonationsCount || 0}{' '}
              <span className="text-xs font-normal">
                {lang === 'bn' ? 'বার' : 'times'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-0.5">
            <div className="text-[11px] text-neutral-500">
              {lang === 'bn' ? 'শেষ রক্তদান' : 'Last Donation'}
            </div>
            <div className="text-xs font-bold font-mono text-neutral-800 pt-1">
              {donor.lastDonationDate || (lang === 'bn' ? 'তথ্য নেই' : 'N/A')}
            </div>
          </div>

          <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-0.5">
            <div className="text-[11px] text-neutral-500">
              {lang === 'bn' ? 'শারীরিক তথ্য' : 'Health Stats'}
            </div>
            <div className="text-xs font-bold text-neutral-800 pt-1">
              {donor.weightKg ? `${donor.weightKg} kg` : '-'} ·{' '}
              {donor.ageYears ? `${donor.ageYears} yrs` : '-'}
            </div>
          </div>

          <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-0.5">
            <div className="text-[11px] text-neutral-500">
              {lang === 'bn' ? 'উপযুক্ততা' : 'Eligibility'}
            </div>
            <div
              className={`text-xs font-bold pt-1 ${
                isEligible ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {isEligible
                ? lang === 'bn'
                  ? 'রক্তদানে প্রস্তুত'
                  : 'Eligible'
                : lang === 'bn'
                ? 'বিশ্রামে আছেন'
                : 'Resting'}
            </div>
          </div>
        </div>

        {/* Contact Gate / Unlocked Direct Contact Section */}
        <div className="space-y-2 pt-2 border-t border-neutral-100">
          <div className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
            {!unlockedPhone && <Lock className="w-3.5 h-3.5 text-[#C80828]" />}
            <span>
              {unlockedPhone
                ? lang === 'bn'
                  ? 'ডোনারের সাথে সরাসরি যোগাযোগ:'
                  : 'Contact Donor:'
                : lang === 'bn'
                ? 'নিরাপদ কন্টাক্ট গেটের মাধ্যমে যোগাযোগ করুন:'
                : 'Unlock Verified Contact:'}
            </span>
          </div>

          {unlockedPhone ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={handleCall}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-[#C80828] hover:bg-[#A3051E] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'সরাসরি কল' : 'Call'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleSms}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>SMS</span>
                </button>

                <button
                  type="button"
                  onClick={handleImo}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedPhone ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>{lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono font-bold text-xs">IMO</span>
                      <span>{lang === 'bn' ? 'নম্বর কপি' : 'Copy No.'}</span>
                    </>
                  )}
                </button>
              </div>
              {copiedPhone && (
                <p className="text-[11px] text-sky-800 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
                  {lang === 'bn'
                    ? 'নম্বরটি কপি করা হয়েছে — এখন IMO অ্যাপ খুলে নম্বরটি সার্চ করে কল বা মেসেজ দিন।'
                    : 'Phone number copied — open the IMO app and paste this number to chat or call.'}
                </p>
              )}
            </div>
          ) : onRequestContact ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {availableMethods.map((method) => {
                const labelMap: Record<ContactMethod, string> = {
                  call: lang === 'bn' ? 'কল আনলক' : 'Unlock Call',
                  whatsapp: 'WhatsApp',
                  sms: 'SMS',
                  imo: 'IMO',
                };
                const styleMap: Record<ContactMethod, string> = {
                  call: 'bg-[#C80828] hover:bg-[#A3051E] text-white',
                  whatsapp: 'bg-emerald-600 hover:bg-emerald-700 text-white',
                  sms: 'bg-neutral-800 hover:bg-neutral-900 text-white',
                  imo: 'bg-sky-700 hover:bg-sky-800 text-white',
                };
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequestContact(donor, method);
                    }}
                    className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${styleMap[method]}`}
                  >
                    <Lock className="w-3 h-3 opacity-85" />
                    <span>{labelMap[method]}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 flex items-center gap-2">
              <Lock className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>
                {lang === 'bn'
                  ? 'গোপনীয়তার স্বার্থে নম্বরটি সুরক্ষিত রয়েছে। ডোনার তালিকা বা যাচাইকৃত কন্টাক্ট গেটের মাধ্যমে নম্বর আনলক করুন।'
                  : 'Phone number is protected. Unlock via the verified contact gate.'}
              </span>
            </div>
          )}
        </div>

        {/* Additional Donor Preferences */}
        {(donor.preferredHospitalArea || donor.donorNote) && (
          <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-1.5 text-xs text-neutral-700">
            {donor.preferredHospitalArea && (
              <div>
                <span className="font-semibold text-neutral-900">
                  {lang === 'bn'
                    ? 'পছন্দের হাসপাতাল/এলাকা: '
                    : 'Preferred Area: '}
                </span>
                {donor.preferredHospitalArea}
              </div>
            )}
            {donor.donorNote && (
              <div>
                <span className="font-semibold text-neutral-900">
                  {lang === 'bn' ? 'ডোনারের বার্তা: ' : 'Note: '}
                </span>
                {donor.donorNote}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
