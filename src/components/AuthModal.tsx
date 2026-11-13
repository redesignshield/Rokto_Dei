import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BloodDropCrest } from './MedicalIllustrations';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthTab = 'login' | 'register' | 'reset';

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const {
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    lang,
  } = useAuth();

  const [tab, setTab] = useState<AuthTab>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  if (!isOpen) return null;

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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);

    try {
      if (tab === 'login') {
        await loginWithEmail(email, password);
        onClose();
      } else if (tab === 'register') {
        if (fullName.trim().length < 2) {
          throw new Error('আপনার পূর্ণ নাম কমপক্ষে ২ অক্ষরের হতে হবে।');
        }
        await registerWithEmail(fullName, email, password);
        setPassword('');
        setTab('login');
        setInfoMessage(
          lang === 'bn'
            ? 'অ্যাকাউন্ট তৈরি হয়েছে! আপনার ইমেইলে একটি যাচাইকরণ লিংক (Verification Link) পাঠানো হয়েছে। Inbox বা Spam ফোল্ডার থেকে লিংকটি ক্লিক করে ভেরিফাই করুন।'
            : 'Account created! A verification link has been sent to your email. Please check Inbox/Spam to verify.'
        );
      } else {
        await resetPassword(email);
        setInfoMessage(
          'পাসওয়ার্ড রিসেট করার লিংক আপনার ইমেইলে পাঠানো হয়েছে।'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'অনুরোধ সম্পন্ন করা যায়নি।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden border border-neutral-200 max-h-[92vh] overflow-y-auto">
        {/* Crimson Crest Banner (Inspired by SaveLife Splash Card) */}
        <div className="bg-[#C80828] text-white px-6 pt-6 pb-5 relative text-center">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white/80 hover:text-white rounded-xl absolute top-3 right-3 cursor-pointer"
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
            {lang === 'bn'
              ? 'একই অ্যাকাউন্টে রক্তদাতা ও রক্তপ্রার্থী'
              : 'One Account for Seeker & Donor'}
          </h2>
          <p className="text-xs text-white/85 mt-1">
            {lang === 'bn'
              ? 'লগইন করে রক্তদাতা খুঁজুন অথবা স্বেচ্ছায় নিজের ডোনার প্রোফাইল চালু করুন'
              : 'Sign in once to search donors or enable your voluntary donor profile'}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Recommended 1-Click Verified Google Login */}
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
            <span>{lang === 'bn' ? 'অথবা ইমেইল ও পাসওয়ার্ড' : 'OR EMAIL'}</span>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>

          {/* Segmented Control */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#FDF2F4] rounded-xl">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
                setInfoMessage(null);
              }}
              className={`min-h-[38px] px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'login'
                  ? 'bg-[#C80828] text-white shadow-xs'
                  : 'text-[#8F1D30] hover:text-[#C80828]'
              }`}
            >
              {lang === 'bn' ? 'লগইন' : 'Login'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError(null);
                setInfoMessage(null);
              }}
              className={`min-h-[38px] px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'register'
                  ? 'bg-[#C80828] text-white shadow-xs'
                  : 'text-[#8F1D30] hover:text-[#C80828]'
              }`}
            >
              {lang === 'bn' ? 'নতুন নিবন্ধন' : 'Register'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('reset');
                setError(null);
                setInfoMessage(null);
              }}
              className={`min-h-[38px] px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'reset'
                  ? 'bg-[#C80828] text-white shadow-xs'
                  : 'text-[#8F1D30] hover:text-[#C80828]'
              }`}
            >
              {lang === 'bn' ? 'পাসওয়ার্ড রিসেট' : 'Reset'}
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
              className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed"
            >
              {infoMessage}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  {lang === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
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
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                {lang === 'bn' ? 'ইমেইল ঠিকানা' : 'Email Address'}
              </label>
              <input
                type="email"
                required
                maxLength={160}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full min-h-[46px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
              />
            </div>

            {tab !== 'reset' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  {lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[46px] px-3.5 py-2 text-sm border border-neutral-200 rounded-xl bg-[#FAF8F9] focus:bg-white focus:outline-none focus:border-[#C80828]"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] px-4 py-2.5 bg-[#C80828] hover:bg-[#A3051E] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {submitting
                ? lang === 'bn'
                  ? 'অপেক্ষা করুন...'
                  : 'Please wait...'
                : tab === 'login'
                ? lang === 'bn'
                  ? 'ইমেইল দিয়ে লগইন করুন'
                  : 'Sign In with Email'
                : tab === 'register'
                ? lang === 'bn'
                  ? 'অ্যাকাউন্ট তৈরি করুন'
                  : 'Create Account'
                : lang === 'bn'
                ? 'রিসেট লিংক পাঠান'
                : 'Send Reset Link'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
