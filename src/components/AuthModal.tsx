import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  MailCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  resetOobCode?: string | null;
  onClearResetOobCode?: () => void;
}

type AuthMode = 'login' | 'register' | 'recovery' | 'confirm_reset';

const RESEND_COOLDOWN_SECONDS = 60;

export function AuthModal({
  isOpen,
  onClose,
  resetOobCode,
  onClearResetOobCode,
}: AuthModalProps) {
  const {
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    verifyResetCode,
    confirmResetPassword,
    lang,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Recovery sub-flow state
  const [recoverySentEmail, setRecoverySentEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // In-app reset confirmation state (when arriving via Firebase ?mode=resetPassword&oobCode=...)
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifiedResetEmail, setVerifiedResetEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Handle resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  // Verify incoming Firebase oobCode when modal opens for confirm_reset
  useEffect(() => {
    if (!isOpen || !resetOobCode) return;

    let cancelled = false;
    setMode('confirm_reset');
    setError(null);
    setInfoMessage(null);
    setVerifyingCode(true);
    setVerifiedResetEmail(null);
    setNewPassword('');
    setConfirmNewPassword('');

    verifyResetCode(resetOobCode)
      .then((accountEmail) => {
        if (cancelled) return;
        setVerifiedResetEmail(accountEmail);
        setEmail(accountEmail);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : lang === 'bn'
            ? 'পাসওয়ার্ড রিসেট লিংকটি অকার্যকর বা মেয়াদোত্তীর্ণ।'
            : 'This password reset link is invalid or has expired.'
        );
      })
      .finally(() => {
        if (!cancelled) {
          setVerifyingCode(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, resetOobCode, verifyResetCode, lang]);

  // Reset transient visibility flags when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowPassword(false);
      setShowConfirmPassword(false);
      setShowNewPassword(false);
      setShowConfirmNewPassword(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const switchMode = (nextMode: AuthMode, keepMessages = false) => {
    setMode(nextMode);
    if (!keepMessages) {
      setError(null);
      setInfoMessage(null);
    }
    setShowPassword(false);
    setShowConfirmPassword(false);
    if (nextMode !== 'recovery') {
      setRecoverySentEmail(null);
    }
  };

  const handleClose = () => {
    if (mode === 'confirm_reset') {
      onClearResetOobCode?.();
      setMode('login');
    }
    onClose();
  };

  const handleGoogle = async () => {
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'লগইন ব্যর্থ হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginOrRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (mode === 'register') {
      if (fullName.trim().length < 2) {
        setError(
          lang === 'bn'
            ? 'আপনার পূর্ণ নাম কমপক্ষে ২ অক্ষরের হতে হবে।'
            : 'Full name must be at least 2 characters.'
        );
        return;
      }
      if (password.length < 6) {
        setError(
          lang === 'bn'
            ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
            : 'Password must be at least 6 characters.'
        );
        return;
      }
      if (password !== confirmPassword) {
        setError(
          lang === 'bn'
            ? 'পাসওয়ার্ড এবং নিশ্চিত পাসওয়ার্ড মিলছে না।'
            : 'Passwords do not match.'
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        onClose();
      } else if (mode === 'register') {
        await registerWithEmail(fullName, email, password);
        setPassword('');
        setConfirmPassword('');
        switchMode('login', true);
        setInfoMessage(
          lang === 'bn'
            ? 'অ্যাকাউন্ট তৈরি হয়েছে! আপনার ইমেইলে একটি যাচাইকরণ লিংক (Verification Link) পাঠানো হয়েছে। Inbox বা Spam ফোল্ডার থেকে লিংকটি ক্লিক করে ভেরিফাই করুন।'
            : 'Account created! A verification link has been sent to your email. Please check Inbox/Spam to verify.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'অনুরোধ সম্পন্ন করা যায়নি।');
    } finally {
      setSubmitting(false);
    }
  };

  const sendRecoveryEmail = async (targetEmail: string) => {
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      await resetPassword(targetEmail);
      setRecoverySentEmail(targetEmail.trim());
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : lang === 'bn'
          ? 'রিসেট লিংক পাঠানো যায়নি।'
          : 'Could not send password reset email.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendRecoveryEmail(email);
  };

  const handleConfirmNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetOobCode) return;
    setError(null);

    if (newPassword.length < 6) {
      setError(
        lang === 'bn'
          ? 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
          : 'New password must be at least 6 characters.'
      );
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError(
        lang === 'bn'
          ? 'নতুন পাসওয়ার্ড দুটি মিলছে না।'
          : 'New passwords do not match.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await confirmResetPassword(resetOobCode, newPassword);
      onClearResetOobCode?.();
      setNewPassword('');
      setConfirmNewPassword('');
      setPassword('');
      switchMode('login', true);
      setInfoMessage(
        lang === 'bn'
          ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে! এখন আপনার নতুন পাসওয়ার্ড দিয়ে লগইন করুন।'
          : 'Password updated successfully! Sign in with your new password.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : lang === 'bn'
          ? 'পাসওয়ার্ড পরিবর্তন করা যায়নি।'
          : 'Failed to update password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const passwordsMismatchInRegister =
    mode === 'register' &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden border border-neutral-200 max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Crimson Crest Banner */}
        <div className="bg-[#C80828] text-white px-6 pt-6 pb-5 relative text-center">
          <button
            type="button"
            onClick={handleClose}
            aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close dialog'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white/80 hover:text-white rounded-xl absolute top-3 right-3 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <img
            src="/logo.png"
            alt="রক্তদেই"
            className="w-14 h-14 object-contain rounded-2xl bg-white p-1 mx-auto mb-3 shadow-md ring-2 ring-white/30"
          />
          <h2
            id="auth-modal-title"
            className="text-lg font-bold tracking-wide text-white"
          >
            {mode === 'recovery'
              ? lang === 'bn'
                ? 'পাসওয়ার্ড পুনরুদ্ধার'
                : 'Recover Your Password'
              : mode === 'confirm_reset'
              ? lang === 'bn'
                ? 'নতুন পাসওয়ার্ড সেট করুন'
                : 'Set New Password'
              : lang === 'bn'
              ? 'একই অ্যাকাউন্টে রক্তদাতা ও রক্তপ্রার্থী'
              : 'One Account for Seeker & Donor'}
          </h2>
          <p className="text-xs text-white/85 mt-1">
            {mode === 'recovery'
              ? lang === 'bn'
                ? 'আপনার নিবন্ধিত ইমেইলে নিরাপদ পাসওয়ার্ড রিসেট লিংক পাঠানো হবে'
                : 'We will email you a secure link to reset your password'
              : mode === 'confirm_reset'
              ? lang === 'bn'
                ? 'আপনার অ্যাকাউন্টের জন্য একটি শক্তিশালী নতুন পাসওয়ার্ড দিন'
                : 'Choose a strong new password for your account'
              : lang === 'bn'
              ? 'লগইন করে রক্তদাতা খুঁজুন অথবা স্বেচ্ছায় নিজের ডোনার প্রোফাইল চালু করুন'
              : 'Sign in once to search donors or enable your voluntary donor profile'}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Primary Login & Register View */}
          {(mode === 'login' || mode === 'register') && (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogle}
                className="w-full min-h-[48px] px-4 py-2.5 bg-[#1F242D] hover:bg-neutral-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <span>
                  {lang === 'bn'
                    ? 'Google দিয়ে দ্রুত লগইন করুন (তাৎক্ষণিক ভেরিফায়েড)'
                    : 'Continue with Google (Instant Verified)'}
                </span>
              </button>

              <div className="flex items-center gap-3 text-xs text-neutral-400">
                <div className="h-px flex-1 bg-neutral-200" />
                <span>{lang === 'bn' ? 'অথবা ইমেইল ও পাসওয়ার্ড' : 'OR EMAIL & PASSWORD'}</span>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              {/* Clean 2-Tab Segmented Switch (Login / Register only) */}
              <div
                role="tablist"
                aria-label={lang === 'bn' ? 'অ্যাকাউন্ট মোড' : 'Account mode'}
                className="grid grid-cols-2 gap-1 p-1 bg-[#FDF2F4] rounded-xl"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  onClick={() => switchMode('login')}
                  className={`min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    mode === 'login'
                      ? 'bg-[#C80828] text-white shadow-xs'
                      : 'text-[#8F1D30] hover:text-[#C80828]'
                  }`}
                >
                  {lang === 'bn' ? 'লগইন' : 'Login'}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => switchMode('register')}
                  className={`min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    mode === 'register'
                      ? 'bg-[#C80828] text-white shadow-xs'
                      : 'text-[#8F1D30] hover:text-[#C80828]'
                  }`}
                >
                  {lang === 'bn' ? 'নতুন নিবন্ধন' : 'Register'}
                </button>
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed"
                >
                  {error}
                </div>
              )}

              {infoMessage && (
                <div
                  role="status"
                  className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{infoMessage}</span>
                </div>
              )}

              <form onSubmit={handleLoginOrRegisterSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label
                      htmlFor="auth-full-name"
                      className="block text-xs font-semibold text-neutral-700 mb-1.5"
                    >
                      {lang === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
                    </label>
                    <input
                      id="auth-full-name"
                      type="text"
                      required
                      autoComplete="name"
                      minLength={2}
                      maxLength={80}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={lang === 'bn' ? 'আপনার নাম লিখুন' : 'Your full name'}
                      className="w-full min-h-[46px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-semibold text-neutral-700 mb-1.5"
                  >
                    {lang === 'bn' ? 'ইমেইল ঠিকানা' : 'Email Address'}
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                    maxLength={160}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full min-h-[46px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="auth-password"
                      className="block text-xs font-semibold text-neutral-700"
                    >
                      {lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('recovery')}
                        className="text-xs font-semibold text-[#C80828] hover:text-[#A3051E] hover:underline focus-visible:outline-2 focus-visible:outline-[#C80828] rounded px-1 py-0.5 cursor-pointer"
                      >
                        {lang === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot password?'}
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={
                        mode === 'login' ? 'current-password' : 'new-password'
                      }
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        showPassword
                          ? lang === 'bn'
                            ? 'পাসওয়ার্ড লিখুন'
                            : 'Enter password'
                          : '••••••••'
                      }
                      className="w-full min-h-[46px] pl-3.5 pr-11 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-pressed={showPassword}
                      aria-label={
                        showPassword
                          ? lang === 'bn'
                            ? 'পাসওয়ার্ড লুকান'
                            : 'Hide password'
                          : lang === 'bn'
                          ? 'পাসওয়ার্ড দেখুন'
                          : 'Show password'
                      }
                      title={
                        showPassword
                          ? lang === 'bn'
                            ? 'পাসওয়ার্ড লুকান'
                            : 'Hide password'
                          : lang === 'bn'
                          ? 'পাসওয়ার্ড দেখুন'
                          : 'Show password'
                      }
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-neutral-500 hover:text-neutral-800 rounded-lg cursor-pointer transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {mode === 'register' && (
                    <p className="text-[11px] text-neutral-500 mt-1">
                      {lang === 'bn'
                        ? 'কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন'
                        : 'Use at least 6 characters'}
                    </p>
                  )}
                </div>

                {mode === 'register' && (
                  <div>
                    <label
                      htmlFor="auth-confirm-password"
                      className="block text-xs font-semibold text-neutral-700 mb-1.5"
                    >
                      {lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'}
                    </label>
                    <div className="relative">
                      <input
                        id="auth-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={
                          showConfirmPassword
                            ? lang === 'bn'
                              ? 'পাসওয়ার্ডটি আবার লিখুন'
                              : 'Re-enter password'
                            : '••••••••'
                        }
                        className={`w-full min-h-[46px] pl-3.5 pr-11 py-2 text-sm border rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none ${
                          passwordsMismatchInRegister
                            ? 'border-red-400 focus:border-red-500'
                            : 'border-neutral-200 focus:border-[#C80828]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-pressed={showConfirmPassword}
                        aria-label={
                          showConfirmPassword
                            ? lang === 'bn'
                              ? 'নিশ্চিত পাসওয়ার্ড লুকান'
                              : 'Hide confirm password'
                            : lang === 'bn'
                            ? 'নিশ্চিত পাসওয়ার্ড দেখুন'
                            : 'Show confirm password'
                        }
                        className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-neutral-500 hover:text-neutral-800 rounded-lg cursor-pointer transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {passwordsMismatchInRegister && (
                      <p className="text-[11px] text-red-600 mt-1">
                        {lang === 'bn'
                          ? 'পাসওয়ার্ড দুটি মিলছে না'
                          : 'Passwords do not match'}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || passwordsMismatchInRegister}
                  className="w-full min-h-[48px] px-4 py-2.5 bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {submitting
                    ? lang === 'bn'
                      ? 'অপেক্ষা করুন...'
                      : 'Please wait...'
                    : mode === 'login'
                    ? lang === 'bn'
                      ? 'ইমেইল দিয়ে লগইন করুন'
                      : 'Sign In with Email'
                    : lang === 'bn'
                    ? 'অ্যাকাউন্ট তৈরি করুন'
                    : 'Create Account'}
                </button>
              </form>
            </>
          )}

          {/* Dedicated Password Recovery Flow */}
          {mode === 'recovery' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-[#C80828] min-h-[36px] -ml-1 px-1 rounded-lg cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>
                  {lang === 'bn' ? 'লগইনে ফিরে যান' : 'Back to sign in'}
                </span>
              </button>

              {error && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed"
                >
                  {error}
                </div>
              )}

              {recoverySentEmail ? (
                <div className="space-y-4">
                  <div
                    role="status"
                    className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <MailCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-emerald-950">
                          {lang === 'bn'
                            ? 'রিসেট লিংক পাঠানো হয়েছে'
                            : 'Password reset link sent'}
                        </h3>
                        <p className="text-xs text-emerald-900 mt-0.5 break-all">
                          {recoverySentEmail}
                        </p>
                      </div>
                    </div>

                    <ol className="text-xs text-emerald-900/90 space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>
                        {lang === 'bn'
                          ? 'আপনার ইমেইলের Inbox বা Spam ফোল্ডার চেক করুন।'
                          : 'Check your email Inbox or Spam folder.'}
                      </li>
                      <li>
                        {lang === 'bn'
                          ? 'মেইলের রিসেট লিংকে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন।'
                          : 'Open the reset link and choose a new password.'}
                      </li>
                      <li>
                        {lang === 'bn'
                          ? 'তারপর নিচের বাটনে ফিরে নতুন পাসওয়ার্ড দিয়ে লগইন করুন।'
                          : 'Return here and sign in with your new password.'}
                      </li>
                    </ol>
                  </div>

                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="w-full min-h-[48px] px-4 py-2.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    {lang === 'bn' ? 'লগইন স্ক্রিনে ফিরে যান' : 'Return to Sign In'}
                  </button>

                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <button
                      type="button"
                      disabled={submitting || resendCooldown > 0}
                      onClick={() => void sendRecoveryEmail(recoverySentEmail)}
                      className="font-semibold text-[#C80828] hover:underline disabled:text-neutral-400 disabled:no-underline cursor-pointer disabled:cursor-not-allowed min-h-[36px]"
                    >
                      {resendCooldown > 0
                        ? lang === 'bn'
                          ? `আবার পাঠান (${resendCooldown}s)`
                          : `Resend in ${resendCooldown}s`
                        : lang === 'bn'
                        ? 'আবার লিংক পাঠান'
                        : 'Resend reset link'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecoverySentEmail(null)}
                      className="font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer min-h-[36px]"
                    >
                      {lang === 'bn' ? 'ইমেইল পরিবর্তন করুন' : 'Change email'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRecoverySubmit} className="space-y-4">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#FAF8F9] border border-neutral-200/80 text-xs text-neutral-700 leading-relaxed">
                    <KeyRound className="w-4 h-4 text-[#C80828] shrink-0 mt-0.5" />
                    <span>
                      {lang === 'bn'
                        ? 'আগে Google দিয়ে অ্যাকাউন্ট খুলে থাকলেও আপনার ওই ইমেইল দিয়ে রিসেট লিংক পাঠিয়ে নতুন পাসওয়ার্ড সেট করতে পারবেন।'
                        : 'Even if you previously signed up with Google, you can request a reset link here to set a password for APK login.'}
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="recovery-email"
                      className="block text-xs font-semibold text-neutral-700 mb-1.5"
                    >
                      {lang === 'bn' ? 'নিবন্ধিত ইমেইল ঠিকানা' : 'Registered Email Address'}
                    </label>
                    <input
                      id="recovery-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      required
                      maxLength={160}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full min-h-[46px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[48px] px-4 py-2.5 bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    {submitting
                      ? lang === 'bn'
                        ? 'পাঠানো হচ্ছে...'
                        : 'Sending...'
                      : lang === 'bn'
                      ? 'রিসেট লিংক পাঠান'
                      : 'Send Reset Link'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* In-App Confirm Password Reset (when handling ?mode=resetPassword&oobCode=...) */}
          {mode === 'confirm_reset' && (
            <div className="space-y-4">
              {verifyingCode ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-7 h-7 border-2 border-[#C80828] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-neutral-600">
                    {lang === 'bn'
                      ? 'রিসেট লিংক যাচাই করা হচ্ছে...'
                      : 'Verifying reset link...'}
                  </p>
                </div>
              ) : verifiedResetEmail ? (
                <form onSubmit={handleConfirmNewPasswordSubmit} className="space-y-4">
                  <div className="p-3 rounded-xl bg-[#FAF8F9] border border-neutral-200 text-xs text-neutral-700">
                    {lang === 'bn' ? 'অ্যাকাউন্ট: ' : 'Account: '}
                    <span className="font-semibold text-[#1F242D]">
                      {verifiedResetEmail}
                    </span>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed"
                    >
                      {error}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="new-reset-password"
                      className="block text-xs font-semibold text-neutral-700 mb-1.5"
                    >
                      {lang === 'bn' ? 'নতুন পাসওয়ার্ড' : 'New Password'}
                    </label>
                    <div className="relative">
                      <input
                        id="new-reset-password"
                        type={showNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={
                          showNewPassword
                            ? lang === 'bn'
                              ? 'নতুন পাসওয়ার্ড লিখুন'
                              : 'Enter new password'
                            : '••••••••'
                        }
                        className="w-full min-h-[46px] pl-3.5 pr-11 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        aria-pressed={showNewPassword}
                        aria-label={
                          showNewPassword
                            ? lang === 'bn'
                              ? 'পাসওয়ার্ড লুকান'
                              : 'Hide password'
                            : lang === 'bn'
                            ? 'পাসওয়ার্ড দেখুন'
                            : 'Show password'
                        }
                        className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-neutral-500 hover:text-neutral-800 rounded-lg cursor-pointer"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="confirm-reset-password"
                      className="block text-xs font-semibold text-neutral-700 mb-1.5"
                    >
                      {lang === 'bn'
                        ? 'নতুন পাসওয়ার্ড নিশ্চিত করুন'
                        : 'Confirm New Password'}
                    </label>
                    <div className="relative">
                      <input
                        id="confirm-reset-password"
                        type={showConfirmNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder={
                          showConfirmNewPassword
                            ? lang === 'bn'
                              ? 'নতুন পাসওয়ার্ডটি আবার লিখুন'
                              : 'Re-enter new password'
                            : '••••••••'
                        }
                        className="w-full min-h-[46px] pl-3.5 pr-11 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                        aria-pressed={showConfirmNewPassword}
                        aria-label={
                          showConfirmNewPassword
                            ? lang === 'bn'
                              ? 'পাসওয়ার্ড লুকান'
                              : 'Hide password'
                            : lang === 'bn'
                            ? 'পাসওয়ার্ড দেখুন'
                            : 'Show password'
                        }
                        className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-neutral-500 hover:text-neutral-800 rounded-lg cursor-pointer"
                      >
                        {showConfirmNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[48px] px-4 py-2.5 bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    {submitting
                      ? lang === 'bn'
                        ? 'সংরক্ষণ হচ্ছে...'
                        : 'Saving...'
                      : lang === 'bn'
                      ? 'নতুন পাসওয়ার্ড সংরক্ষণ করুন'
                      : 'Save New Password'}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  {error && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed"
                    >
                      {error}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onClearResetOobCode?.();
                      switchMode('recovery');
                    }}
                    className="w-full min-h-[48px] px-4 py-2.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    {lang === 'bn'
                      ? 'নতুন রিসেট লিংক পাঠান'
                      : 'Request a New Reset Link'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
