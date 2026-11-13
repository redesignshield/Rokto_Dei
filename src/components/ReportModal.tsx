import React, { useState } from 'react';
import { X } from 'lucide-react';
import { isDemoRecordId } from '../data/removableDemoData';
import { REPORT_REASONS } from '../lib/validation';
import { reportReasonLabel } from '../lib/i18n';
import { submitAbuseReport } from '../services/roktoService';
import type { AppLanguage, ReportReason } from '../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'donor' | 'blood_request';
  targetId: string;
  targetUid: string;
  targetLabel: string;
  lang: AppLanguage;
}

export function ReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetUid,
  targetLabel,
  lang,
}: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>('incorrect_phone');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const isDemoTarget = isDemoRecordId(targetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!isDemoTarget) {
        await submitAbuseReport({
          targetType,
          targetId,
          targetUid,
          reason,
          description,
        });
      }
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'রিপোর্ট জমা দেওয়া সম্ভব হয়নি।'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setError(null);
    setDescription('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3
              id="report-modal-title"
              className="text-lg font-bold text-[#1F242D]"
            >
              {lang === 'bn' ? 'অভিযোগ / রিপোর্ট জানান' : 'Report Listing'}
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5">{targetLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close report dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-900 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 leading-relaxed">
              {isDemoTarget
                ? lang === 'bn'
                  ? 'ডেমো রিপোর্ট ফ্লো সফলভাবে কাজ করছে! (যেহেতু এটি একটি ডেমো তালিকা, তাই আসল Firestore ডাটাবেসে কোনো ভুয়া রিপোর্ট সংরক্ষণ করা হয়নি।)'
                  : 'Demo report flow verified! (No fake moderation report was written to live Firestore.)'
                : lang === 'bn'
                ? 'আপনার রিপোর্টটি সফলভাবে জমা হয়েছে। অ্যাডমিন টিম এটি যাচাই করে প্রয়োজনীয় ব্যবস্থা নেবে।'
                : 'Your report has been submitted for moderator review.'}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full min-h-[44px] px-4 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-xl cursor-pointer"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800"
              >
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                {lang === 'bn' ? 'রিপোর্টের কারণ' : 'Reason'}
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-neutral-300 rounded-xl bg-white focus:outline-none focus:border-[#D71920]"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {reportReasonLabel(r, lang)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                {lang === 'bn'
                  ? 'বিস্তারিত বিবরণ (ঐচ্ছিক, ব্যক্তিগত রোগীর তথ্য লিখবেন না)'
                  : 'Additional Details (Optional, omit sensitive patient data)'}
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'সংক্ষেপে সমস্যাটি লিখুন...'
                    : 'Briefly describe the issue...'
                }
                className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 rounded-xl focus:outline-none focus:border-[#D71920]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="min-h-[44px] px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-xl cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] px-5 py-2 bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-60 text-white text-sm font-semibold rounded-xl cursor-pointer"
              >
                {submitting
                  ? lang === 'bn'
                    ? 'জমা হচ্ছে...'
                    : 'Submitting...'
                  : lang === 'bn'
                  ? 'রিপোর্ট জমা দিন'
                  : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
