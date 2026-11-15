import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAppUpdate } from '../contexts/UpdateContext';
import { isNativeCapacitorShell } from '../lib/platform';

export function AppUpdateModal() {
  const { lang } = useAuth();
  const {
    currentVersion,
    availableUpdate,
    isUpdateModalOpen,
    isApplyingUpdate,
    dismissUpdateModal,
    applyWebUpdate,
  } = useAppUpdate();

  const [copiedSha, setCopiedSha] = useState(false);

  if (!isUpdateModalOpen || !availableUpdate) return null;

  const isApk = isNativeCapacitorShell();
  const hasWebRefresh =
    !isApk &&
    (availableUpdate.swReady || availableUpdate.source === 'web');
  const primaryGithubLink =
    availableUpdate.apkDownloadUrl || availableUpdate.releaseUrl;

  const notes =
    lang === 'bn'
      ? availableUpdate.notesBn
      : availableUpdate.notesEn || availableUpdate.notesBn;

  const handleCopySha = async () => {
    if (!availableUpdate.sha256Checksum) return;
    try {
      await navigator.clipboard.writeText(availableUpdate.sha256Checksum);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2200);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={dismissUpdateModal}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Banner Header */}
        <div
          className={`px-5 py-4 flex items-start justify-between gap-3 border-b ${
            availableUpdate.isCritical
              ? 'bg-red-50 border-red-200'
              : 'bg-[#FAF8F9] border-neutral-200'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                availableUpdate.isCritical
                  ? 'bg-[#C80828] text-white shadow-sm'
                  : 'bg-[#FDF2F4] text-[#C80828] border border-[#F5C6CE]'
              }`}
            >
              {availableUpdate.isCritical ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#C80828]">
                {availableUpdate.isCritical
                  ? lang === 'bn'
                    ? 'জরুরি নিরাপত্তা আপডেট'
                    : 'Critical Security Update'
                  : lang === 'bn'
                    ? 'নতুন ভার্সন উপলব্ধ'
                    : 'New Version Available'}
              </div>
              <h2
                id="app-update-modal-title"
                className="text-base sm:text-lg font-bold text-[#1F242D] leading-snug"
              >
                {lang === 'bn'
                  ? 'রক্তদেই অ্যাপ আপডেট'
                  : 'Rokto Dei App Update'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissUpdateModal}
            className="w-8 h-8 rounded-xl bg-white/80 hover:bg-neutral-200/70 text-neutral-500 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
            aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* SemVer Comparison Strip */}
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-neutral-50 border border-neutral-200">
            <div className="text-xs text-neutral-500">
              {lang === 'bn' ? 'বর্তমান ভার্সন:' : 'Current:'}{' '}
              <span className="font-mono font-semibold text-neutral-700">
                v{currentVersion}
              </span>
            </div>
            <span className="text-neutral-300 font-bold">→</span>
            <div className="text-xs font-semibold text-emerald-700">
              {lang === 'bn' ? 'নতুন ভার্সন:' : 'Latest:'}{' '}
              <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg">
                v{availableUpdate.version}
              </span>
            </div>
          </div>

          {availableUpdate.isForcedByMinVersion && (
            <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 leading-relaxed flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                {lang === 'bn'
                  ? 'আপনার ব্যবহৃত ভার্সনটি পুরনো। নিরাপত্তা ও নির্ভুল সার্ভিস নিশ্চিত করতে অনুগ্রহ করে নতুন ভার্সনে আপডেট করুন।'
                  : 'Your running version is outdated. Please update to ensure security and compatibility.'}
              </span>
            </div>
          )}

          {/* Sanitized Release Notes */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-neutral-700">
              {lang === 'bn' ? 'এই ভার্সনে যা থাকছে:' : "What's new:"}
            </div>
            <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed whitespace-pre-line bg-neutral-50/80 border border-neutral-200/80 rounded-2xl p-3.5 max-h-40 overflow-y-auto">
              {notes}
            </p>
          </div>

          {/* SHA-256 Checksum Integrity Verification Block (for APK downloads) */}
          {availableUpdate.sha256Checksum && (
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-emerald-900 inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  {lang === 'bn'
                    ? 'APK SHA-256 নিরাপত্তা চেকসাম'
                    : 'APK SHA-256 Integrity Checksum'}
                </span>
                <button
                  type="button"
                  onClick={handleCopySha}
                  className="px-2 py-0.5 rounded-lg bg-white border border-emerald-200 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedSha ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>{lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>{lang === 'bn' ? 'কপি' : 'Copy'}</span>
                    </>
                  )}
                </button>
              </div>
              <p className="font-mono text-[10px] text-emerald-900 break-all select-all leading-relaxed">
                {availableUpdate.sha256Checksum}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            {hasWebRefresh && (
              <button
                type="button"
                disabled={isApplyingUpdate}
                onClick={applyWebUpdate}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isApplyingUpdate ? 'animate-spin' : ''}`}
                />
                <span>
                  {isApplyingUpdate
                    ? lang === 'bn'
                      ? 'আপডেট প্রয়োগ হচ্ছে...'
                      : 'Applying update...'
                    : lang === 'bn'
                      ? 'এখনই অ্যাপ আপডেট করুন'
                      : 'Update App Now'}
                </span>
              </button>
            )}

            {primaryGithubLink && (
              <a
                href={primaryGithubLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full min-h-[46px] px-4 py-2.5 rounded-2xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors ${
                  !hasWebRefresh
                    ? 'bg-[#C80828] hover:bg-[#A3051E] text-white shadow-sm'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-neutral-200'
                }`}
              >
                {availableUpdate.apkDownloadUrl ? (
                  <Download className="w-4 h-4" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                <span>
                  {availableUpdate.apkDownloadUrl
                    ? lang === 'bn'
                      ? 'নতুন APK ডাউনলোড করুন (GitHub)'
                      : 'Download Latest APK (GitHub)'
                    : lang === 'bn'
                      ? 'GitHub Release দেখুন'
                      : 'View GitHub Release'}
                </span>
              </a>
            )}

            <button
              type="button"
              onClick={dismissUpdateModal}
              className="w-full min-h-[42px] px-4 py-2 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs sm:text-sm font-semibold cursor-pointer transition-colors"
            >
              {lang === 'bn' ? 'পরে আপডেট করুন' : 'Remind Me Later'}
            </button>

            <p className="text-[11px] text-center text-neutral-500">
              {lang === 'bn'
                ? 'এই আপডেট বার্তাটি উপরের নোটিফিকেশন বেল আইকনেও সংরক্ষিত থাকবে।'
                : 'This update alert is also saved in your notification bell.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
