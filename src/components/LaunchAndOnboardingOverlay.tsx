import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  MotionConfig,
  motion,
} from 'motion/react';
import {
  ArrowRight,
  ChevronRight,
  Droplets,
  HeartHandshake,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ONBOARDING_STORAGE_KEY = 'roktodei_onboarding_seen_v1';
const AUTO_SLIDE_DURATION_MS = 5000;
const TOTAL_SLIDES = 3;

type OverlayPhase = 'splash' | 'onboarding' | 'done';

const LUXURY_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

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
      <div className="relative w-full max-w-[320px] h-[200px] mx-auto flex items-center justify-center select-none">
        {/* Soft breathing radial aura behind the blood drop */}
        <motion.div
          aria-hidden="true"
          animate={{
            scale: [0.92, 1.08, 0.92],
            opacity: [0.38, 0.68, 0.38],
          }}
          transition={{
            duration: 3.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute w-40 h-40 rounded-full bg-radial from-[#FF6B84]/30 via-[#C80828]/10 to-transparent blur-xl pointer-events-none"
        />

        <svg
          viewBox="0 0 360 220"
          className="relative w-full h-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="dropGlow" cx="42%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#FF5975" />
              <stop offset="52%" stopColor="#C80828" />
              <stop offset="100%" stopColor="#7C0216" />
            </radialGradient>
            <linearGradient id="skyFade" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F5DCE0" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#FAF8F9" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="ecgSweep" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E6B6BF" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#C80828" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#E6B6BF" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Subtle Jatiya Smriti Soudha & Dhaka skyline silhouette */}
          <path
            d="M15 168 L42 168 L52 108 L62 168 L74 168 L80 132 L86 168 L112 168 M248 168 L272 168 L282 114 L292 168 L302 168 L312 136 L322 168 L345 168"
            fill="url(#skyFade)"
            stroke="#ECC6CD"
            strokeWidth="1.2"
          />

          {/* Base static faint ECG line */}
          <path
            d="M18 148 L74 148 L84 134 L94 162 L106 118 L118 164 L128 148 L232 148 L242 134 L252 162 L264 118 L276 164 L286 148 L342 148"
            fill="none"
            stroke="#F1CDD4"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Animated living ECG pulse wave */}
          <motion.path
            d="M18 148 L74 148 L84 134 L94 162 L106 118 L118 164 L128 148 L232 148 L242 134 L252 162 L264 118 L276 164 L286 148 L342 148"
            fill="none"
            stroke="url(#ecgSweep)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="95 360"
            animate={{ strokeDashoffset: [455, 0] }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: 'linear',
            }}
          />

          {/* Floating soft hearts */}
          <motion.path
            d="M90 74 C90 67 80 65 77 72 C74 65 64 67 64 74 C64 82 77 90 77 90 C77 90 90 82 90 74 Z"
            fill="#F9C3CE"
            animate={{ y: [0, -7, 0], opacity: [0.65, 0.95, 0.65] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.path
            d="M294 64 C294 56 282 54 278 62 C274 54 262 56 262 64 C262 74 278 83 278 83 C278 83 294 74 294 64 Z"
            fill="#F4A5B5"
            animate={{ y: [0, -9, 0], opacity: [0.6, 0.9, 0.6] }}
            transition={{
              duration: 4.1,
              delay: 0.6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.path
            d="M116 112 C116 107 109 106 107 110 C105 106 98 107 98 112 C98 117 107 123 107 123 C107 123 116 117 116 112 Z"
            fill="#FBD8DF"
            animate={{ y: [0, -5, 0], scale: [0.95, 1.08, 0.95] }}
            transition={{
              duration: 3.0,
              delay: 1.1,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Central floating blood drop + realistic inner heartbeat */}
          <motion.g
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          >
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
            <motion.path
              d="M196 111 C196 102 184 99 180 107 C176 99 164 102 164 111 C164 122 180 133 180 133 C180 133 196 122 196 111 Z"
              fill="#FFFFFF"
              opacity="0.96"
              style={{ transformOrigin: '180px 115px' }}
              animate={{ scale: [1, 1.12, 1, 1.07, 1] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                repeatDelay: 0.9,
                ease: 'easeInOut',
              }}
            />
          </motion.g>

          {/* Two caring hands gently cradling the drop */}
          <motion.g
            animate={{ y: [0, -2, 0] }}
            transition={{
              duration: 3.6,
              delay: 0.25,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
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
          </motion.g>
        </svg>
      </div>
    );
  }

  if (slideIndex === 1) {
    const pins = [
      {
        cx: 78,
        cy: 90,
        group: 'O+',
        dist: '1.2 km',
        delay: 0.08,
        floatDur: 3.3,
      },
      {
        cx: 282,
        cy: 78,
        group: 'A+',
        dist: '2.8 km',
        delay: 0.18,
        floatDur: 3.8,
      },
      {
        cx: 268,
        cy: 162,
        group: 'B+',
        dist: '4.5 km',
        delay: 0.28,
        floatDur: 3.5,
      },
    ];

    return (
      <div className="relative w-full max-w-[330px] h-[205px] mx-auto flex items-center justify-center select-none">
        <motion.div
          aria-hidden="true"
          animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 4.0, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute w-44 h-44 rounded-full bg-radial from-[#FF6B84]/25 via-[#C80828]/8 to-transparent blur-xl pointer-events-none"
        />

        <svg
          viewBox="0 0 360 220"
          className="relative w-full h-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="radarPinGrad" cx="40%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FF5975" />
              <stop offset="58%" stopColor="#C80828" />
              <stop offset="100%" stopColor="#860318" />
            </radialGradient>
            <linearGradient id="mapHorizon" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F5DCE0" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#FAF8F9" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Subtle map ground arcs */}
          <ellipse
            cx="180"
            cy="120"
            rx="132"
            ry="76"
            fill="url(#mapHorizon)"
            stroke="#F2CFD6"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <circle
            cx="180"
            cy="120"
            r="56"
            fill="none"
            stroke="#F1C7D0"
            strokeWidth="1.2"
          />

          {/* Live expanding GPS sonar rings */}
          <motion.circle
            cx="180"
            cy="120"
            r="26"
            fill="none"
            stroke="#C80828"
            strokeWidth="1.8"
            animate={{ scale: [1, 3.1], opacity: [0.5, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
            style={{ transformOrigin: '180px 120px' }}
          />
          <motion.circle
            cx="180"
            cy="120"
            r="26"
            fill="none"
            stroke="#C80828"
            strokeWidth="1.4"
            animate={{ scale: [1, 3.1], opacity: [0.4, 0] }}
            transition={{
              duration: 2.6,
              delay: 1.3,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            style={{ transformOrigin: '180px 120px' }}
          />

          {/* Curved connection routes from user GPS to nearest donors */}
          <path
            d="M180 120 Q125 90 78 90"
            fill="none"
            stroke="#E598A6"
            strokeWidth="1.6"
            strokeDasharray="4 4"
          />
          <path
            d="M180 120 Q230 85 282 78"
            fill="none"
            stroke="#E598A6"
            strokeWidth="1.6"
            strokeDasharray="4 4"
          />
          <path
            d="M180 120 Q226 150 268 162"
            fill="none"
            stroke="#E598A6"
            strokeWidth="1.6"
            strokeDasharray="4 4"
          />

          {/* Central user GPS pin */}
          <motion.g
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3.0, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ellipse
              cx="180"
              cy="148"
              rx="14"
              ry="4.5"
              fill="#C80828"
              opacity="0.16"
            />
            <path
              d="M180 78 C164 78 152 90 152 105 C152 124 180 146 180 146 C180 146 208 124 208 105 C208 90 196 78 180 78 Z"
              fill="url(#radarPinGrad)"
            />
            <circle cx="180" cy="105" r="10" fill="#FFFFFF" opacity="0.96" />
            <circle cx="180" cy="105" r="4.5" fill="#C80828" />
          </motion.g>

          {/* 3 Floating nearest donor markers */}
          {pins.map((pin) => (
            <motion.g
              key={pin.group}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: [0, -5, 0],
              }}
              transition={{
                opacity: { duration: 0.4, delay: pin.delay, ease: LUXURY_EASE },
                scale: { duration: 0.4, delay: pin.delay, ease: LUXURY_EASE },
                y: {
                  duration: pin.floatDur,
                  delay: pin.delay,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }}
              style={{ transformOrigin: `${pin.cx}px ${pin.cy}px` }}
            >
              <circle
                cx={pin.cx}
                cy={pin.cy}
                r="20"
                fill="#FFFFFF"
                stroke="#F2C8D0"
                strokeWidth="1.5"
              />
              <circle cx={pin.cx} cy={pin.cy} r="15.5" fill="#C80828" />
              <text
                x={pin.cx}
                y={pin.cy + 4}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="11"
                fontWeight="700"
                fontFamily="monospace"
              >
                {pin.group}
              </text>
              <text
                x={pin.cx}
                y={pin.cy + 33}
                textAnchor="middle"
                fill="#4B5563"
                fontSize="10.5"
                fontWeight="700"
                fontFamily="monospace"
              >
                {pin.dist}
              </text>
            </motion.g>
          ))}

          {/* Quiet caption inside bottom of SVG */}
          <text
            x="180"
            y="207"
            textAnchor="middle"
            fill="#A3051E"
            fontSize="11"
            fontWeight="700"
          >
            {lang === 'bn'
              ? 'লাইভ জিপিএস · ৬৪ জেলায় নিকটবর্তী ডোনার'
              : 'Live GPS · Nearest Donors Across 64 Districts'}
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[330px] h-[205px] mx-auto flex items-center justify-center select-none">
      <motion.div
        aria-hidden="true"
        animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.35, 0.62, 0.35] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-44 h-44 rounded-full bg-radial from-[#FF6B84]/28 via-[#C80828]/10 to-transparent blur-xl pointer-events-none"
      />

      <svg
        viewBox="0 0 360 220"
        className="relative w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="shieldGrad" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#FF4F6C" />
            <stop offset="55%" stopColor="#C80828" />
            <stop offset="100%" stopColor="#820217" />
          </linearGradient>
          <linearGradient id="arcGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F4B6C2" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#C80828" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#F4B6C2" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Rotating protective orbital halo */}
        <motion.circle
          cx="180"
          cy="108"
          r="70"
          fill="none"
          stroke="#ECC0C9"
          strokeWidth="1.5"
          strokeDasharray="6 6"
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '180px 108px' }}
        />

        {/* Animated secure connection waves left & right */}
        <path
          d="M78 108 C105 90 124 96 142 108"
          fill="none"
          stroke="#F1C7D0"
          strokeWidth="1.6"
        />
        <motion.path
          d="M78 108 C105 90 124 96 142 108"
          fill="none"
          stroke="url(#arcGlow)"
          strokeWidth="2.2"
          strokeDasharray="24 60"
          animate={{ strokeDashoffset: [84, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        />
        <path
          d="M282 108 C255 90 236 96 218 108"
          fill="none"
          stroke="#F1C7D0"
          strokeWidth="1.6"
        />
        <motion.path
          d="M282 108 C255 90 236 96 218 108"
          fill="none"
          stroke="url(#arcGlow)"
          strokeWidth="2.2"
          strokeDasharray="24 60"
          animate={{ strokeDashoffset: [0, 84] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        />

        {/* Central sculpted Crimson Shield */}
        <motion.g
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d="M180 44 L226 62 V106 C226 138 205 162 180 172 C155 162 134 138 134 106 V62 L180 44 Z"
            fill="url(#shieldGrad)"
          />
          <path
            d="M180 51 L219 66.5 V105 C219 132 201 153 180 162.5 C159 153 141 132 141 105 V66.5 L180 51 Z"
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.24"
            strokeWidth="1.2"
          />
          {/* Crisp verified checkmark inside shield */}
          <motion.path
            d="M164 106 L175 117 L198 92"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0.2, opacity: 0.5 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.65, ease: LUXURY_EASE }}
          />
        </motion.g>

        {/* Left floating Call-Lock node */}
        <motion.g
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 3.2,
            delay: 0.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <circle
            cx="64"
            cy="108"
            r="22"
            fill="#FFFFFF"
            stroke="#F2C8D0"
            strokeWidth="1.5"
          />
          <rect
            x="55"
            y="106"
            width="18"
            height="13"
            rx="3.5"
            fill="#C80828"
          />
          <path
            d="M58.5 106 V102 C58.5 98.7 61 96.5 64 96.5 C67 96.5 69.5 98.7 69.5 102 V106"
            fill="none"
            stroke="#C80828"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="64" cy="112.5" r="1.8" fill="#FFFFFF" />
        </motion.g>

        {/* Right floating Direct Call / Verified Heart node */}
        <motion.g
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 3.6,
            delay: 0.55,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <circle
            cx="296"
            cy="108"
            r="22"
            fill="#FFFFFF"
            stroke="#F2C8D0"
            strokeWidth="1.5"
          />
          <path
            d="M306 105 C306 99 298.5 97 296 102 C293.5 97 286 99 286 105 C286 112 296 119.5 296 119.5 C296 119.5 306 112 306 105 Z"
            fill="#C80828"
          />
        </motion.g>

        {/* Quiet clean unboxed highlights below */}
        <text
          x="180"
          y="204"
          textAnchor="middle"
          fill="#A3051E"
          fontSize="11"
          fontWeight="700"
        >
          {lang === 'bn'
            ? 'যাচাইকৃত যোগাযোগ · বুকিং কল লক · গোপনীয়তা সুরক্ষা'
            : 'Verified Contact · Booking Call-Lock · Privacy Guard'}
        </text>
      </svg>
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
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPaused, setIsPaused] = useState(false);
  const [cycleNonce, setCycleNonce] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const goToSlide = useCallback(
    (nextIndex: number) => {
      const normalized =
        ((nextIndex % TOTAL_SLIDES) + TOTAL_SLIDES) % TOTAL_SLIDES;
      setDirection(normalized >= slideIndex ? 1 : -1);
      setSlideIndex(normalized);
      setCycleNonce((n) => n + 1);
    },
    [slideIndex]
  );

  useEffect(() => {
    const handleReplay = () => {
      setIsExiting(false);
      setDirection(1);
      setSlideIndex(0);
      setCycleNonce((n) => n + 1);
      setIsPaused(false);
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

  // Smooth 5-second automatic slide progression during onboarding
  useEffect(() => {
    if (phase !== 'onboarding' || isExiting || isPaused) return;

    const timer = window.setTimeout(() => {
      setDirection(1);
      setSlideIndex((prev) => (prev + 1) % TOTAL_SLIDES);
    }, AUTO_SLIDE_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [phase, isExiting, isPaused, slideIndex, cycleNonce]);

  const handleFinishOnboarding = () => {
    markOnboardingCompleted();
    setIsExiting(true);
    window.setTimeout(() => {
      setPhase('done');
    }, 200);
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
      <MotionConfig reducedMotion="user">
        <div
          role="status"
          aria-label={lang === 'bn' ? 'রক্তদেই লোড হচ্ছে' : 'Loading Rokto Dei'}
          className={`fixed inset-0 z-[70] flex flex-col items-center justify-between px-6 py-12 text-white bg-gradient-to-b from-[#D40B2D] via-[#B40621] to-[#7B0214] transition-opacity duration-200 ${
            isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="h-6" />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, ease: LUXURY_EASE }}
            className="flex flex-col items-center text-center space-y-6"
          >
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
          </motion.div>

          <div className="flex flex-col items-center gap-3 pb-4">
            <div className="w-9 h-9 rounded-full border-[3px] border-white/25 border-t-white animate-spin" />
            <span className="text-xs font-medium text-white/90 tracking-wide">
              {lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}
            </span>
          </div>
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={lang === 'bn' ? 'রক্তদেই পরিচিতি' : 'Welcome to Rokto Dei'}
        className={`fixed inset-0 z-[70] bg-gradient-to-b from-[#FFFDFD] via-[#FAF8F9] to-[#F9E8EC] text-[#1F242D] overflow-y-auto flex flex-col justify-between transition-opacity duration-200 ${
          isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        onTouchStart={(e) => {
          setIsPaused(true);
          touchStartXRef.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          setIsPaused(false);
          if (touchStartXRef.current === null) return;
          const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
          const diff = touchStartXRef.current - endX;
          if (diff > 48) {
            goToSlide(slideIndex + 1);
          } else if (diff < -48) {
            goToSlide(slideIndex - 1);
          }
          touchStartXRef.current = null;
        }}
      >
        {/* Top Bar: Language Toggle + Skip */}
        <div className="w-full max-w-2xl mx-auto px-5 pt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="min-h-[44px] px-4 py-1.5 rounded-xl bg-white/90 border border-neutral-200 text-xs font-semibold text-neutral-700 hover:text-[#C80828] cursor-pointer transition-colors"
          >
            {lang === 'bn' ? 'English' : 'বাংলা'}
          </button>

          <button
            type="button"
            onClick={handleFinishOnboarding}
            className="min-h-[44px] px-4 py-1.5 rounded-xl bg-[#FDF2F4] hover:bg-[#FADCE2] border border-[#F5C6CE] text-xs font-bold text-[#C80828] inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>{lang === 'bn' ? 'এড়িয়ে যান' : 'Skip'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center Content */}
        <div
          className="w-full max-w-xl mx-auto px-5 py-3 flex-1 flex flex-col items-center justify-center text-center space-y-4"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Crisp Integrated Brand Emblem */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: LUXURY_EASE }}
            className="flex flex-col items-center"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[22px] bg-white p-2 shadow-md shadow-[#C80828]/10 ring-1 ring-[#C80828]/12 flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="রক্তদেই (Rokto Dei)"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
          </motion.div>

          {/* Dynamic Slide Headline with Smooth Directional Crossfade */}
          <div className="w-full max-w-md min-h-[128px] sm:min-h-[134px] flex items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={`${lang}-${slideIndex}`}
                custom={direction}
                initial={{
                  opacity: 0,
                  x: direction * 26,
                  filter: 'blur(4px)',
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                  filter: 'blur(0px)',
                }}
                exit={{
                  opacity: 0,
                  x: direction * -20,
                  filter: 'blur(3px)',
                }}
                transition={{ duration: 0.45, ease: LUXURY_EASE }}
                className="space-y-1.5 w-full"
              >
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1F242D]">
                  {activeSlide.heading}
                </h2>
                <p className="text-sm sm:text-base font-bold text-[#C80828]">
                  {activeSlide.subtext}
                </p>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed pt-0.5">
                  {activeSlide.detail}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Slide Illustration Stage */}
          <div className="w-full min-h-[210px] pt-1 flex items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={`illus-${slideIndex}`}
                custom={direction}
                initial={{
                  opacity: 0,
                  x: direction * 34,
                  scale: 0.94,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  x: direction * -26,
                  scale: 0.96,
                }}
                transition={{ duration: 0.48, ease: LUXURY_EASE }}
                className="w-full"
              >
                <SlideHeroIllustration slideIndex={slideIndex} lang={lang} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Interactive 3-Pillar Feature Strip with Sliding Highlight */}
          <div className="w-full grid grid-cols-3 p-1 rounded-2xl bg-[#FDF2F4]/95 border border-[#F5D6DC] gap-1">
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
                  onClick={() => goToSlide(item.idx)}
                  className={`relative py-2.5 px-2 rounded-xl flex flex-col items-center justify-center gap-1.5 min-h-[68px] cursor-pointer transition-colors ${
                    active
                      ? 'text-[#C80828]'
                      : 'text-neutral-700 hover:text-[#C80828]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="onboarding-active-pillar"
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 32,
                      }}
                      className="absolute inset-0 rounded-xl bg-white shadow-xs"
                    />
                  )}
                  <motion.span
                    animate={{ scale: active ? 1.08 : 1 }}
                    transition={{ duration: 0.2 }}
                    className="relative z-10"
                  >
                    <Icon className="w-5 h-5 text-[#C80828]" />
                  </motion.span>
                  <span className="relative z-10 text-[11px] sm:text-xs font-bold leading-tight whitespace-nowrap">
                    {lang === 'bn' ? item.bn : item.en}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA & Animated 5-Second Progress Indicators */}
        <div className="w-full max-w-md mx-auto px-5 pb-7 pt-2 space-y-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            onClick={handleFinishOnboarding}
            className="relative overflow-hidden w-full min-h-[52px] px-6 py-3 rounded-2xl bg-gradient-to-r from-[#D71920] to-[#B0061F] hover:from-[#B5141A] hover:to-[#8E0418] text-white text-base font-bold shadow-lg shadow-[#C80828]/25 inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            {/* Subtle premium sheen sweep */}
            <motion.span
              aria-hidden="true"
              animate={{ x: ['-120%', '220%'] }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                repeatDelay: 2.8,
                ease: 'easeInOut',
              }}
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
            />
            <span className="relative z-10">
              {lang === 'bn' ? 'শুরু করুন' : 'Start the Journey'}
            </span>
            <ArrowRight className="relative z-10 w-5 h-5" />
          </motion.button>

          {/* Carousel Pagination Dots with Smooth 5s Progress Fill */}
          <div
            className="flex items-center justify-center gap-1"
            role="tablist"
            aria-label="Onboarding steps"
          >
            {slides.map((_, idx) => {
              const isActive = slideIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Slide ${idx + 1}`}
                  onClick={() => goToSlide(idx)}
                  className="min-h-[44px] px-1.5 flex items-center justify-center cursor-pointer"
                >
                  {isActive ? (
                    <span className="relative w-10 h-2 rounded-full bg-[#EBC6CE] overflow-hidden block">
                      <motion.span
                        key={`progress-${slideIndex}-${cycleNonce}-${isPaused ? 'p' : 'r'}`}
                        initial={{ scaleX: isPaused ? 0.35 : 0 }}
                        animate={{ scaleX: isPaused ? 0.35 : 1 }}
                        transition={{
                          duration: isPaused ? 0.2 : AUTO_SLIDE_DURATION_MS / 1000,
                          ease: 'linear',
                        }}
                        className="absolute inset-0 origin-left rounded-full bg-[#C80828]"
                      />
                    </span>
                  ) : (
                    <span className="w-2.5 h-2 rounded-full bg-[#E3B4BE] hover:bg-[#D48A97] transition-colors block" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
