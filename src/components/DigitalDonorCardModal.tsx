import React, { useEffect, useRef, useState } from 'react';
import {
  AtSign,
  Award,
  Building2,
  Check,
  Copy,
  Download,
  Lock,
  MapPin,
  Phone,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { getDistrictById, getDivisionById } from '../data/bdLocations';
import {
  DONOR_TIERS,
  generateBadgeVerificationId,
  renderDonorCardToCanvas,
} from '../lib/donorBadge';
import type { DonorProfile } from '../types';

interface DigitalDonorCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  donor: DonorProfile | null;
  phoneNumber?: string;
  lang: 'bn' | 'en';
}

export function DigitalDonorCardModal({
  isOpen,
  onClose,
  donor,
  phoneNumber,
  lang,
}: DigitalDonorCardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const [logoLoadedTick, setLogoLoadedTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // User Privacy Customization Toggles for the Card
  const [showPhone, setShowPhone] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  const [showUsername, setShowUsername] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showHospitalArea, setShowHospitalArea] = useState(true);

  const division = donor ? getDivisionById(donor.divisionId) : null;
  const district = donor ? getDistrictById(donor.districtId) : null;
  const totalDonations = donor?.totalDonationsCount || 0;

  const effectivePhone = phoneNumber || '';

  const verificationToken = donor
    ? generateBadgeVerificationId(
        donor.uid,
        donor.bloodGroup,
        district ? district[lang] : ''
      )
    : '';

  // Preload clean white-backed Rokto Dei logo once for crisp canvas rendering (zero black corners)
  useEffect(() => {
    if (logoImageRef.current) return;
    const img = new Image();
    img.src = '/pwa-maskable-512x512.png';
    img.onload = () => {
      logoImageRef.current = img;
      setLogoLoadedTick((t) => t + 1);
    };
  }, []);

  // Render canvas whenever modal opens, donor changes, fonts/logo finish loading, or privacy toggles change
  useEffect(() => {
    if (!isOpen || !donor || !canvasRef.current) return;

    let cancelled = false;
    const draw = () => {
      if (cancelled || !canvasRef.current) return;
      renderDonorCardToCanvas(canvasRef.current, {
        displayName: donor.displayName,
        username: donor.username,
        bloodGroup: donor.bloodGroup,
        districtName: district ? district[lang] : '',
        divisionName: division ? division[lang] : '',
        totalDonations,
        lastDonationDate: donor.lastDonationDate,
        donorUid: donor.uid,
        phoneNumber: effectivePhone,
        preferredHospitalArea: donor.preferredHospitalArea,
        lang,
        logoImage: logoImageRef.current,
        options: {
          showPhone,
          showLocation,
          showUsername,
          showStats,
          showHospitalArea,
        },
      });
    };

    draw();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(draw).catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    donor,
    district,
    division,
    totalDonations,
    effectivePhone,
    showPhone,
    showLocation,
    showUsername,
    showStats,
    showHospitalArea,
    lang,
    logoLoadedTick,
  ]);

  if (!isOpen || !donor) return null;

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setDownloading(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `RoktoDei-DonorCard-${donor.bloodGroup}-${donor.displayName.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download card failed', err);
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    const shareTitle =
      lang === 'bn'
        ? `${donor.displayName} - রক্তদেই ভেরিফায়েড রক্তদাতা সম্মাননা`
        : `${donor.displayName} - Rokto Dei Verified Blood Donor`;
    const shareText =
      lang === 'bn'
        ? `আমি রক্তদেই প্ল্যাটফর্মে একজন নিবন্ধিত ও ভেরিফায়েড রক্তদাতা (${donor.bloodGroup})। রক্ত দিন, জীবন বাঁচান!`
        : `I am a verified voluntary blood donor (${donor.bloodGroup}) on Rokto Dei. Donate blood, save lives!`;

    if (canvas && navigator.share) {
      try {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        );
        if (blob) {
          const file = new File([blob], 'donor-card.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: shareTitle,
              text: shareText,
              files: [file],
            });
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 2000);
            return;
          }
        }
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: `${window.location.origin}/?token=${verificationToken}`,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
        return;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
      }
    }

    handleCopyLink();
  };

  const handleCopyLink = () => {
    const verifyUrl = `${window.location.origin}/?token=${verificationToken}`;
    navigator.clipboard.writeText(verifyUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Next tier calculation
  let nextTier = null;
  let donationsNeeded = 0;
  if (totalDonations < 3) {
    nextTier = DONOR_TIERS[1];
    donationsNeeded = 3 - totalDonations;
  } else if (totalDonations < 6) {
    nextTier = DONOR_TIERS[2];
    donationsNeeded = 6 - totalDonations;
  } else if (totalDonations < 11) {
    nextTier = DONOR_TIERS[3];
    donationsNeeded = 11 - totalDonations;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-3xl w-full border border-neutral-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="relative bg-gradient-to-r from-[#C80828] to-[#99061E] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-maskable-512x512.png"
              alt="রক্তদেই"
              className="w-10 h-10 object-contain rounded-xl bg-white p-0.5 shadow-sm ring-1 ring-white/30 shrink-0"
            />
            <div>
              <h3 className="text-base sm:text-lg font-bold leading-tight">
                {lang === 'bn'
                  ? 'ডিজিটাল ডোনার কার্ড ও স্বীকৃতি'
                  : 'Digital Donor Card & Recognition'}
              </h3>
              <p className="text-xs text-white/85">
                {lang === 'bn'
                  ? 'ব্যক্তিগত তথ্য নিয়ন্ত্রণ ও অফিসিয়াল পরিচয়পত্র'
                  : 'Private Controls & Official Donor Credential'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto no-scrollbar">
          {/* Card Privacy & Detail Visibility Controls */}
          <div className="bg-[#FAF8F9] border border-neutral-200/90 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#C80828] shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-[#1F242D]">
                  {lang === 'bn'
                    ? 'কার্ডের তথ্যের গোপনীয়তা নিয়ন্ত্রণ'
                    : 'Card Privacy Controls'}
                </span>
              </div>
              <span className="text-[11px] text-neutral-500">
                {lang === 'bn'
                  ? 'কোনো তথ্য লুকালে কার্ড স্বয়ংক্রিয়ভাবে ছোট হবে'
                  : 'Hidden fields collapse cleanly with zero gap'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* Phone toggle */}
              {effectivePhone && (
                <button
                  type="button"
                  onClick={() => setShowPhone((p) => !p)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    showPhone
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>{lang === 'bn' ? 'ফোন নম্বর' : 'Phone'}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                      showPhone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {showPhone
                      ? lang === 'bn'
                        ? 'অন'
                        : 'ON'
                      : lang === 'bn'
                      ? 'অফ'
                      : 'OFF'}
                  </span>
                </button>
              )}

              {/* Location toggle */}
              <button
                type="button"
                onClick={() => setShowLocation((l) => !l)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  showLocation
                    ? 'bg-rose-50 text-[#C80828] border-rose-200'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-[#C80828] shrink-0" />
                <span>{lang === 'bn' ? 'ঠিকানা ও এলাকা' : 'Location'}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                    showLocation
                      ? 'bg-[#C80828] text-white'
                      : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {showLocation
                    ? lang === 'bn'
                      ? 'অন'
                      : 'ON'
                    : lang === 'bn'
                    ? 'অফ'
                    : 'OFF'}
                </span>
              </button>

              {/* Username toggle */}
              {donor.username && (
                <button
                  type="button"
                  onClick={() => setShowUsername((u) => !u)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    showUsername
                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <AtSign className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span>{donor.username}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                      showUsername
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {showUsername
                      ? lang === 'bn'
                        ? 'অন'
                        : 'ON'
                      : lang === 'bn'
                      ? 'অফ'
                      : 'OFF'}
                  </span>
                </button>
              )}

              {/* Donation Stats toggle */}
              <button
                type="button"
                onClick={() => setShowStats((s) => !s)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  showStats
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{lang === 'bn' ? 'পরিসংখ্যান' : 'Stats'}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                    showStats
                      ? 'bg-amber-600 text-white'
                      : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {showStats
                    ? lang === 'bn'
                      ? 'অন'
                      : 'ON'
                    : lang === 'bn'
                    ? 'অফ'
                    : 'OFF'}
                </span>
              </button>

              {/* Hospital area toggle */}
              {donor.preferredHospitalArea && (
                <button
                  type="button"
                  onClick={() => setShowHospitalArea((h) => !h)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    showHospitalArea
                      ? 'bg-slate-100 text-slate-900 border-slate-300'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  <span>{lang === 'bn' ? 'হাসপাতাল এলাকা' : 'Hospital Area'}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                      showHospitalArea
                        ? 'bg-slate-800 text-white'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {showHospitalArea
                      ? lang === 'bn'
                        ? 'অন'
                        : 'ON'
                      : lang === 'bn'
                      ? 'অফ'
                      : 'OFF'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Redesigned Landscape Card Preview Stage */}
          <div className="flex justify-center bg-slate-100/80 p-3 sm:p-5 rounded-2xl border border-slate-200/80">
            <canvas
              ref={canvasRef}
              className="w-full max-w-[660px] h-auto drop-shadow-lg"
            />
          </div>

          {/* Privacy & Token Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#FDF2F4] border border-[#F7D4DC] rounded-xl flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-[#C80828] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[#8F1D30] block">
                  {lang === 'bn'
                    ? 'ব্যক্তিগত প্রাইভেসি নিয়ন্ত্রণ'
                    : 'Owner-Only Privacy Control'}
                </span>
                <span className="text-[#64748B]">
                  {showPhone && effectivePhone
                    ? lang === 'bn'
                      ? 'কার্ডে ফোন নম্বর বর্তমানে দৃশ্যমান। চাইলে উপরে থেকে লুকাতে পারবেন।'
                      : 'Phone number is visible on this card. Toggle it off above anytime.'
                    : lang === 'bn'
                    ? 'আপনার অনুমতি ছাড়া অন্য কেউ এই কার্ড দেখতে বা ফোন নম্বর পেতে পারবে না।'
                    : 'Only you can view or share this card; phone number is hidden.'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-800 block">
                  {lang === 'bn'
                    ? 'ট্যাম্পার-প্রুফ ভেরিফিকেশন টোকেন'
                    : 'Tamper-Proof Token'}
                </span>
                <span className="font-mono text-emerald-700 font-semibold tabular-nums">
                  {verificationToken}
                </span>
              </div>
            </div>
          </div>

          {/* Tier Upgrade Banner */}
          {nextTier && (
            <div className="px-3.5 py-2.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-amber-900">
                  {lang === 'bn'
                    ? `পরবর্তী সম্মাননা "${nextTier.nameBn}" পেতে আর মাত্র ${donationsNeeded}টি রক্তদান প্রয়োজন।`
                    : `Next tier: ${donationsNeeded} more donation(s) to unlock "${nextTier.nameEn}".`}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={downloading}
              className="min-h-[44px] px-4 py-2.5 bg-[#C80828] hover:bg-[#a3051e] active:bg-[#800417] text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>
                {downloading
                  ? lang === 'bn'
                    ? 'তৈরি হচ্ছে...'
                    : 'Downloading...'
                  : lang === 'bn'
                  ? 'ডাউনলোড PNG'
                  : 'Download PNG'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="min-h-[44px] px-4 py-2.5 bg-[#FDF2F4] hover:bg-[#FADCE2] text-[#8F1D30] font-semibold text-sm rounded-xl border border-[#F7D4DC] flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>
                {shareSuccess
                  ? lang === 'bn'
                    ? 'শেয়ার সম্পন্ন!'
                    : 'Shared!'
                  : lang === 'bn'
                  ? 'কার্ড শেয়ার'
                  : 'Share Card'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="min-h-[44px] px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-medium text-sm rounded-xl border border-neutral-300 flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-emerald-700 font-semibold">
                    {lang === 'bn' ? 'কপি হয়েছে' : 'Copied!'}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span>
                    {lang === 'bn' ? 'টোকেন কপি' : 'Copy Token'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
