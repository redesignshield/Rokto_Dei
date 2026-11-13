import React, { useState } from 'react';
import { MailCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function VerificationBanner() {
  const {
    firebaseUser,
    isEmailVerified,
    resendVerification,
    refreshVerificationState,
    lang,
  } = useAuth();

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!firebaseUser || isEmailVerified) return null;

  const handleResend = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await resendVerification();
      setNotice(
        lang === 'bn'
          ? 'নতুন যাচাইকরণ ইমেইল পাঠানো হয়েছে। অনুগ্রহ করে Inbox এবং Spam/Junk ফোল্ডার চেক করুন।'
          : 'Verification email sent. Please check your Inbox and Spam folder.'
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'ইমেইল পাঠানো যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const verified = await refreshVerificationState();
      if (!verified) {
        setNotice(
          lang === 'bn'
            ? 'এখনো ইমেইল ভেরিফিকেশন সম্পন্ন হয়নি। ইমেইলের লিংকে ক্লিক করার পর আবার চেষ্টা করুন।'
            : 'Email is not verified yet. Click the link in your email first.'
        );
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'যাচাই করা যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-950 flex items-center gap-2">
            <MailCheck className="w-4 h-4 shrink-0 text-amber-800" />
            <span>
              {lang === 'bn'
                ? 'আপনার ইমেইল এখনো যাচাই (Verified) করা হয়নি'
                : 'Your email address is not verified yet'}
            </span>
          </p>
          <p className="text-xs text-amber-900 leading-relaxed">
            {lang === 'bn'
              ? `${firebaseUser.email} ঠিকানায় পাঠানো লিংকে ক্লিক করুন। নিরাপত্তার স্বার্থে ইমেইল যাচাই না হওয়া পর্যন্ত রক্তদাতা অনুসন্ধান ও ফোন নম্বর দেখা বন্ধ রয়েছে।`
              : `Click the verification link sent to ${firebaseUser.email} to unlock donor search and contact features.`}
          </p>
          {notice && (
            <p className="text-xs font-medium text-amber-950 pt-0.5">{notice}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={handleRefresh}
            className="min-h-[40px] px-3.5 py-2 bg-amber-900 hover:bg-amber-950 disabled:opacity-60 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>
              {lang === 'bn'
                ? 'আমি ভেরিফাই করেছি — রিফ্রেশ'
                : 'I Verified — Refresh'}
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleResend}
            className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-950 text-xs font-semibold rounded-xl whitespace-nowrap cursor-pointer"
          >
            {lang === 'bn' ? 'পুনরায় মেইল পাঠান' : 'Resend Email'}
          </button>
        </div>
      </div>
    </div>
  );
}
