import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Droplets,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ONBOARDING_STORAGE_KEY = 'roktodei_onboarding_seen_v1';

type OverlayPhase = 'splash' | 'onboarding' | 'done';

function shouldBypassLaunchOverlay(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('apk_google_auth') === '1') {
      return true;
    }
    const mode = params.get('mode');
    if (mode === 'resetPassword' || mode === 'verifyEmail') {
      return true;
    }
    if (params.get('token')) {
      return true;
    }
  } catch {
    // Ignore URL parse error
  }
  return false;
}

function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markOnboardingCompleted(): void {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
  } catch {
    // Ignore storage error
  }
}

function SlideHeroIllustration({
  slideIndex,
  lang,
}: {
  slideIndex: number;
  lang: 'bn' | 'en';
}) {
  if (slideIndex === 0) {
    return (
      <svg
        viewBox="0 0 360 220"
        className="w-full max-w-[300px] h-auto mx-auto select-none"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="dropGlow" cx="45%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FF4D6A" />
            <stop offset="55%" stopColor="#C80828" />
            <stop offset="100%" stopColor="#820217" />
          </radialGradient>
          <linearGradient id="skyFade" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F5DCE0" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#FAF8F9" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Subtle Jatiya Smriti Soudha & Dhaka skyline silhouette */}
        <path
          d="M15 168 L42 168 L52 108 L62 168 L74 168 L80 132 L86 168 L112 168 M248 168 L272 168 L282 114 L292 168 L302 168 L312 136 L322 168 L345 168"
          fill="url(#skyFade)"
          stroke="#ECC6CD"
          strokeWidth="1.2"
        />

        {/* Floating soft hearts */}
        <path
          d="M90 74 C90 67 80 65 77 72 C74 65 64 67 64 74 C64 82 77 90 77 90 C77 90 90 82 90 74 Z"
          fill="#F9C3CE"
          opacity="0.85"
        />
        <path
          d="M294 64 C294 56 282 54 278 62 C274 54 262 56 262 64 C262 74 278 83 278 83 C278 83 294 74 294 64 Z"
          fill="#F4A5B5"
          opacity="0.8"
        />
        <path
          d="M116 112 C116 107 109 106 107 110 C105 106 98 107 98 112 C98 117 107 123 107 123 C107 123 116 117 116 112 Z"
          fill="#FBD8DF"
        />

        {/* Central glowing blood drop */}
        <path
          d="M180 28 C180 28 224 84 224 118 C224 143 204 162 180 162 C156 162 136 143 136 118 C136 84 180 28 180 28 Z"
          fill="url(#dropGlow)"
        />
        <ellipse
          cx="166"
          cy="98"
          rx="9"
          ry="18"
          transform="rotate(-18 166 98)"
          fill="#FFFFFF"
          opacity="0.28"
        />
        {/* White heart inside drop */}
        <path
          d="M196 111 C196 102 184 99 180 107 C176 99 164 102 164 111 C164 122 180 133 180 133 C180 133 196 122 196 111 Z"
          fill="#FFFFFF"
          opacity="0.96"
        />

        {/* Two caring hands cradling the drop */}
        <path
          d="M78 134 C86 130 96 140 108 156 C122 174 146 184 168 186 L168 198 C134 196 106 184 86 160 C74 146 72 138 78 134 Z"
          fill="#F3A27D"
          stroke="#DA7C57"
          strokeWidth="1.5"
        />
        <path
          d="M282 134 C274 130 264 140 252 156 C238 174 214 184 192 186 L192 198 C226 196 254 184 274 160 C286 146 288 138 282 134 Z"
          fill="#F3A27D"
          stroke="#DA7C57"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  if (slideIndex === 1) {
    return (
      <div className="w-full max-w-[290px] mx-auto py-4 px-5 rounded-3xl bg-[#FDF2F4] border border-[#F4D0D7] space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-[#C80828]">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            <span>{lang === 'bn' ? 'লাইভ ম্যাপ · বাংলাদেশ' : 'Live Map · Bangladesh'}</span>
          </span>
          <span className="font-mono text-[11px] text-emerald-700">Live GPS</span>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {['1.2 km', '2.8 km', '4.5 km'].map((dist, idx) => (
            <div
              key={dist}
              className="rounded-2xl bg-white border border-neutral-200 p-2.5 text-center space-y-1 shadow-2xs"
            >
              <div className="w-8 h-8 rounded-xl bg-[#C80828] text-white font-mono text-xs font-bold flex items-center justify-center mx-auto">
                {idx === 0 ? 'O+' : idx === 1 ? 'A+' : 'B+'}
              </div>
              <div className="text-[11px] font-mono font-semibold text-neutral-700">
                {dist}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[290px] mx-auto py-5 px-5 rounded-3xl bg-[#FDF2F4] border border-[#F4D0D7] space-y-3 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#C80828] text-white flex items-center justify-center mx-auto shadow-md">
        <ShieldCheck className="w-7 h-7" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-bold text-[#1F242D]">
          ডোনার বুকিং ও কল লক সুরক্ষা
        </div>
        <p className="text-xs text-neutral-600 leading-relaxed">
          রক্তদাতা নিশ্চিত হলেই স্বয়ংক্রিয়ভাবে অপ্রয়োজনীয় কল বন্ধ হয়ে যায় এবং সরাসরি নিরাপদ যোগাযোগ চালু থাকে।
        </p>
      </div>
    </div>
  );
}

export function LaunchAndOnboardingOverlay() {
  const { lang, setLang } = useAuth();

  const [phase, setPhase] = useState<OverlayPhase>(() => {
    if (shouldBypassLaunchOverlay()) return 'done';
    return 'splash';
  });
  const [slideIndex, setSlideIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    const handleReplay = () => {
      setIsExiting(false);
      setSlideIndex(0);
      setPhase('onboarding');
    };
    window.addEventListener('roktodei:replay-onboarding', handleReplay);
    return () =>
      window.removeEventListener('roktodei:replay-onboarding', handleReplay);
  }, []);

  useEffect(() => {
    if (phase !== 'splash') return;

    const alreadySeen = hasCompletedOnboarding();
    const delayMs = alreadySeen ? 700 : 1250;

    const timer = window.setTimeout(() => {
      if (alreadySeen) {
        setIsExiting(true);
        window.setTimeout(() => setPhase('done'), 220);
      } else {
        setPhase('onboarding');
      }
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [phase]);

  const handleFinishOnboarding = () => {
    markOnboardingCompleted();
    setIsExiting(true);
    window.setTimeout(() => {
      setPhase('done');
    }, 180);
  };

  if (phase === 'done') return null;

  const slides =
    lang === 'bn'
      ? [
          {
            heading: 'রক্তদেই-এ স্বাগতম',
            subtext: 'এক ফোঁটা রক্ত, বাঁচাতে পারে একটি জীবন',
            detail:
              'সারা বাংলাদেশের ৬৪ জেলায় স্বেচ্ছায় রক্তদাতাদের সাথে দ্রুত, নিরাপদ ও সরাসরি সংযোগ তৈরি করুন।',
          },
          {
            heading: 'কাছের রক্তদাতা খুঁজুন রিয়েল-টাইমে',
            subtext: 'আপনার অবস্থান থেকেই সবচেয়ে কাছের ডোনার',
            detail:
              'লাইভ জিপিএস বা আপনার এলাকা নির্বাচন করে নিকটবর্তী রক্তদাতাদের দূরত্ব ও প্রাপ্যতা সাথে সাথে দেখুন।',
          },
          {
            heading: 'সুরক্ষিত যোগাযোগ ও ডোনার বুকিং',
            subtext: 'অযথা কল নয় — নিশ্চিত হলেই বুকিং লক',
            detail:
              'যাচাইকৃত অ্যাকাউন্টের মাধ্যমে সরাসরি Call, WhatsApp বা SMS করুন এবং রক্তদাতা চূড়ান্ত হলে অনুরোধ লক করুন।',
          },
        ]
      : [
          {
            heading: 'Welcome to Rokto Dei',
            subtext: 'এক ফোঁটা রক্ত, বাঁচাতে পারে একটি জীবন',
            detail:
              'Connect directly and safely with verified voluntary blood donors across all 64 districts of Bangladesh.',
          },
          {
            heading: 'Real-Time Nearest Donor Map',
            subtext: 'Find the closest ready donors first',
            detail:
              'Use live GPS or pick any district/area to sort verified donors from nearest to farthest on the live map.',
          },
          {
            heading: 'Verified Contact & Call Lock',
            subtext: 'Protecting patients from spam calls',
            detail:
              'Contact donors via Call, WhatsApp, or SMS and book confirmed donors to stop extra calls immediately.',
          },
        ];

  const activeSlide = slides[slideIndex] || slides[0];

  if (phase === 'splash') {
    return (
      <div
        role="status"
        aria-label={lang === 'bn' ? 'রক্তদেই লোড হচ্ছে' : 'Loading Rokto Dei'}
        className={`fixed inset-0 z-[70] flex flex-col items-center justify-between px-6 py-12 text-white bg-gradient-to-b from-[#D40B2D] via-[#B40621] to-[#7B0214] transition-opacity duration-200 ${
          isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="h-6" />

        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-[2rem] bg-white p-3.5 shadow-2xl border-2 border-white/60 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="রক্তদেই"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-xs">
              রক্ত নেই, রক্ত দেই
            </h1>
            <p className="text-xs sm:text-sm font-medium text-white/85">
              {lang === 'bn'
                ? 'স্বেচ্ছায় রক্তদাতা সংযোগ নেটওয়ার্ক · বাংলাদেশ'
                : 'Voluntary Blood Donor Network · Bangladesh'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 pb-4">
          <div className="w-9 h-9 rounded-full border-[3px] border-white/25 border-t-white animate-spin" />
          <span className="text-xs font-medium text-white/90 tracking-wide">
            {lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'bn' ? 'রক্তদেই পরিচিতি' : 'Welcome to Rokto Dei'}
      className={`fixed inset-0 z-[70] bg-gradient-to-b from-[#FFFDFD] via-[#FAF8F9] to-[#F9E8EC] text-[#1F242D] overflow-y-auto flex flex-col justify-between transition-opacity duration-200 ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartXRef.current === null) return;
        const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
        const diff = touchStartXRef.current - endX;
        if (diff > 48 && slideIndex < slides.length - 1) {
          setSlideIndex((s) => s + 1);
        } else if (diff < -48 && slideIndex > 0) {
          setSlideIndex((s) => s - 1);
        }
        touchStartXRef.current = null;
      }}
    >
      {/* Top Bar: Language Toggle + Skip */}
      <div className="w-full max-w-2xl mx-auto px-5 pt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
          className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white/90 border border-neutral-200 text-xs font-semibold text-neutral-700 hover:text-[#C80828] cursor-pointer transition-colors"
        >
          {lang === 'bn' ? 'English' : 'বাংলা'}
        </button>

        <button
          type="button"
          onClick={handleFinishOnboarding}
          className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#FDF2F4] hover:bg-[#FADCE2] border border-[#F5C6CE] text-xs font-bold text-[#C80828] inline-flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>{lang === 'bn' ? 'এড়িয়ে যান' : 'Skip'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center Content */}
      <div className="w-full max-w-xl mx-auto px-5 py-4 flex-1 flex flex-col items-center justify-center text-center space-y-5">
        {/* Brand Emblem */}
        <div className="flex flex-col items-center space-y-2">
          <img
            src="/logo.png"
            alt="রক্তদেই (Rokto Dei)"
            className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
          />
        </div>

        {/* Dynamic Slide Headline */}
        <div className="space-y-1.5 max-w-md">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1F242D]">
            {activeSlide.heading}
          </h2>
          <p className="text-sm sm:text-base font-bold text-[#C80828]">
            {activeSlide.subtext}
          </p>
          <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed pt-1">
            {activeSlide.detail}
          </p>
        </div>

        {/* Slide Illustration */}
        <div className="w-full pt-1">
          <SlideHeroIllustration slideIndex={slideIndex} lang={lang} />
        </div>

        {/* Interactive 3-Pillar Feature Strip */}
        <div className="w-full grid grid-cols-3 divide-x divide-[#C80828]/15 rounded-2xl bg-[#FDF2F4]/90 border border-[#F5D6DC] overflow-hidden">
          {(
            [
              {
                idx: 0,
                icon: HeartHandshake,
                bn: 'জীবন বাঁচান',
                en: 'Save Lives',
              },
              {
                idx: 1,
                icon: Users,
                bn: 'ডোনার খুঁজুন',
                en: 'Find Donor',
              },
              {
                idx: 2,
                icon: Droplets,
                bn: 'রক্তদান করুন',
                en: 'Donate Blood',
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = slideIndex === item.idx;
            return (
              <button
                key={item.idx}
                type="button"
                onClick={() => setSlideIndex(item.idx)}
                className={`py-3 px-2 flex flex-col items-center justify-center gap-1.5 min-h-[72px] cursor-pointer transition-colors ${
                  active
                    ? 'bg-white text-[#C80828]'
                    : 'text-neutral-700 hover:bg-white/60'
                }`}
              >
                <Icon className="w-5 h-5 text-[#C80828]" />
                <span className="text-[11px] sm:text-xs font-bold leading-tight">
                  {lang === 'bn' ? item.bn : item.en}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA & Step Dots */}
      <div className="w-full max-w-md mx-auto px-5 pb-8 pt-2 space-y-4">
        <button
          type="button"
          onClick={handleFinishOnboarding}
          className="w-full min-h-[50px] px-6 py-3 rounded-2xl bg-gradient-to-r from-[#D71920] to-[#B0061F] hover:from-[#B5141A] hover:to-[#8E0418] text-white text-base font-bold shadow-lg shadow-[#C80828]/25 inline-flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
        >
          <span>
            {lang === 'bn' ? 'শুরু করুন' : 'Start the Journey'}
          </span>
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Carousel Pagination Dots */}
        <div
          className="flex items-center justify-center gap-2"
          role="tablist"
          aria-label="Onboarding steps"
        >
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={slideIndex === idx}
              aria-label={`Slide ${idx + 1}`}
              onClick={() => setSlideIndex(idx)}
              className={`h-2.5 rounded-full transition-all cursor-pointer ${
                slideIndex === idx
                  ? 'w-7 bg-[#C80828]'
                  : 'w-2.5 bg-[#E7BCC4] hover:bg-[#D48A97]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
