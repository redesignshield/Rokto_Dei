/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, X } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { UpdateProvider } from './contexts/UpdateContext';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { VerificationBanner } from './components/VerificationBanner';
import { DonorSearchView } from './components/DonorSearchView';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { AppUpdateModal } from './components/AppUpdateModal';
import { LaunchAndOnboardingOverlay } from './components/LaunchAndOnboardingOverlay';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ViewSkeletonLoader } from './components/ViewSkeletonLoader';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import {
  ApkGoogleAuthBridge,
  getApkGoogleAuthBridgeParams,
} from './components/ApkGoogleAuthBridge';
import type { AppView } from './types';

// Code-split secondary heavy views so initial page load is ultra-fast
const BloodRequestsView = React.lazy(() =>
  import('./components/BloodRequestsView').then((m) => ({
    default: m.BloodRequestsView,
  }))
);
const ProfileView = React.lazy(() =>
  import('./components/ProfileView').then((m) => ({
    default: m.ProfileView,
  }))
);
const AdminDashboardView = React.lazy(() =>
  import('./components/AdminDashboardView').then((m) => ({
    default: m.AdminDashboardView,
  }))
);
const HowItWorksView = React.lazy(() =>
  import('./components/InfoViews').then((m) => ({
    default: m.HowItWorksView,
  }))
);
const SafetyDisclaimerView = React.lazy(() =>
  import('./components/InfoViews').then((m) => ({
    default: m.SafetyDisclaimerView,
  }))
);
const PrivacyPolicyView = React.lazy(() =>
  import('./components/InfoViews').then((m) => ({
    default: m.PrivacyPolicyView,
  }))
);
const TermsView = React.lazy(() =>
  import('./components/InfoViews').then((m) => ({
    default: m.TermsView,
  }))
);

const CARD_TOKEN_REGEX = /^RD-[0-9A-F]{4}-[0-9A-F]{4}$/i;

const PATH_TO_VIEW: Record<string, AppView> = {
  '/': 'find_donors',
  '/donors': 'find_donors',
  '/requests': 'blood_requests',
  '/blood-requests': 'blood_requests',
  '/profile': 'profile',
  '/admin': 'admin',
  '/how-it-works': 'how_it_works',
  '/safety': 'safety',
  '/privacy': 'privacy',
  '/privacy-policy': 'privacy',
  '/terms': 'terms',
};

const VIEW_TO_PATH: Record<AppView, string> = {
  find_donors: '/',
  blood_requests: '/requests',
  profile: '/profile',
  admin: '/admin',
  how_it_works: '/how-it-works',
  safety: '/safety',
  privacy: '/privacy',
  terms: '/terms',
};

function resolveInitialViewFromLocation(): AppView {
  if (typeof window === 'undefined') return 'find_donors';
  try {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view')?.trim().toLowerCase();
    if (viewParam) {
      if (viewParam in VIEW_TO_PATH) return viewParam as AppView;
      if (viewParam === 'requests') return 'blood_requests';
      if (viewParam === 'privacy-policy') return 'privacy';
    }
    const cleanPath =
      window.location.pathname.replace(/\/+$/, '').toLowerCase() || '/';
    return PATH_TO_VIEW[cleanPath] || 'find_donors';
  } catch {
    return 'find_donors';
  }
}

function AppShell() {
  const { isAuthReady, lang, applyEmailVerificationCode } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>(() =>
    resolveInitialViewFromLocation()
  );
  const [targetRequestId, setTargetRequestId] = useState<string | null>(null);
  const [targetDonorUid, setTargetDonorUid] = useState<string | null>(null);
  const [targetPledgeContext, setTargetPledgeContext] = useState<any | null>(
    null
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [resetOobCode, setResetOobCode] = useState<string | null>(null);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [verifyToken, setVerifyToken] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token')?.trim();
      return token ? token.slice(0, 32) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () =>
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Handle Firebase Auth action links (?mode=resetPassword&oobCode=... or ?mode=verifyEmail&oobCode=...)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const actionMode = url.searchParams.get('mode');
      const oobCode = url.searchParams.get('oobCode')?.trim();
      if (!oobCode || (actionMode !== 'resetPassword' && actionMode !== 'verifyEmail')) {
        return;
      }

      // Remove one-time action code from address bar immediately
      url.searchParams.delete('mode');
      url.searchParams.delete('oobCode');
      url.searchParams.delete('apiKey');
      url.searchParams.delete('lang');
      url.searchParams.delete('continueUrl');
      window.history.replaceState(
        window.history.state,
        '',
        url.pathname + url.search + url.hash
      );

      if (actionMode === 'resetPassword') {
        setResetOobCode(oobCode);
        setAuthModalOpen(true);
      } else if (actionMode === 'verifyEmail') {
        void applyEmailVerificationCode(oobCode).catch(() => {
          // Non-fatal: user may also verify directly on Firebase hosted page
        });
      }
    } catch {
      // Ignore URL parsing issues
    }
  }, [applyEmailVerificationCode]);

  const handleCloseVerifyToken = () => {
    setVerifyToken(null);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('token')) {
        url.searchParams.delete('token');
        window.history.replaceState(
          window.history.state,
          '',
          url.pathname + url.search + url.hash
        );
      }
    } catch {
      // Ignore URL manipulation issues
    }
  };

  // Initialize and synchronize browser & Android hardware back button + direct public routes
  useEffect(() => {
    const initialView = resolveInitialViewFromLocation();
    if (!window.history.state || !window.history.state.view) {
      window.history.replaceState(
        { view: initialView, targetId: null, targetDonorUid: null },
        '',
        window.location.pathname + window.location.search
      );
    }

    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.view) {
        setCurrentView(e.state.view);
        setTargetRequestId(e.state.targetId || null);
        setTargetDonorUid(e.state.targetDonorUid || null);
      } else {
        setCurrentView(resolveInitialViewFromLocation());
        setTargetRequestId(null);
        setTargetDonorUid(null);
        setTargetPledgeContext(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (
    view: AppView,
    targetId?: string,
    donorUid?: string,
    pledgeCtx?: any
  ) => {
    setTargetRequestId(targetId || null);
    setTargetDonorUid(donorUid || null);
    setTargetPledgeContext(pledgeCtx || null);
    const nextPath = VIEW_TO_PATH[view] || '/';
    if (view !== currentView || targetId || donorUid) {
      window.history.pushState(
        {
          view,
          targetId: targetId || null,
          targetDonorUid: donorUid || null,
        },
        '',
        nextPath
      );
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isTokenValidFormat = Boolean(
    verifyToken && CARD_TOKEN_REGEX.test(verifyToken)
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F9] text-[#1F242D] w-full max-w-full overflow-x-hidden">
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <VerificationBanner />

      <main className="flex-1 w-full max-w-full">
        {!isAuthReady && (currentView === 'profile' || currentView === 'admin') ? (
          <ViewSkeletonLoader lang={lang} />
        ) : (
          <Suspense fallback={<ViewSkeletonLoader lang={lang} />}>
            {currentView === 'find_donors' && (
              <DonorSearchView
                onOpenAuth={() => setAuthModalOpen(true)}
                onNavigate={handleNavigate}
              />
            )}
            {currentView === 'blood_requests' && (
              <BloodRequestsView
                onOpenAuth={() => setAuthModalOpen(true)}
                targetRequestId={targetRequestId}
                onClearTargetRequest={() => setTargetRequestId(null)}
                targetDonorUid={targetDonorUid}
                targetPledgeContext={targetPledgeContext}
                onClearTargetDonor={() => {
                  setTargetDonorUid(null);
                  setTargetPledgeContext(null);
                }}
              />
            )}
            {currentView === 'profile' && (
              <ProfileView onNavigate={handleNavigate} />
            )}
            {currentView === 'admin' && <AdminDashboardView />}
            {currentView === 'how_it_works' && (
              <HowItWorksView onNavigate={handleNavigate} />
            )}
            {currentView === 'safety' && <SafetyDisclaimerView />}
            {currentView === 'privacy' && <PrivacyPolicyView />}
            {currentView === 'terms' && <TermsView />}
          </Suspense>
        )}
      </main>

      <Footer onNavigate={handleNavigate} />

      <MobileBottomNav
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <OfflineIndicator lang={lang} />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        resetOobCode={resetOobCode}
        onClearResetOobCode={() => setResetOobCode(null)}
      />

      <AppUpdateModal />

      <LaunchAndOnboardingOverlay />

      {verifyToken && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            lang === 'bn'
              ? 'ডিজিটাল ডোনার কার্ড ভেরিফিকেশন'
              : 'Digital Donor Card Verification'
          }
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={handleCloseVerifyToken}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    isTokenValidFormat
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {isTokenValidFormat ? (
                    <ShieldCheck className="w-6 h-6" />
                  ) : (
                    <AlertTriangle className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1F242D]">
                    {isTokenValidFormat
                      ? lang === 'bn'
                        ? 'বৈধ কার্ড ভেরিফিকেশন আইডি'
                        : 'Valid Card Verification ID'
                      : lang === 'bn'
                      ? 'অকার্যকর ভেরিফিকেশন কোড'
                      : 'Invalid Verification Code'}
                  </h3>
                  <p className="text-xs font-mono font-bold text-[#C80828] mt-0.5">
                    {verifyToken}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseVerifyToken}
                className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
              {isTokenValidFormat
                ? lang === 'bn'
                  ? 'এই ভেরিফিকেশন কোডটি রক্তদেই অফিসিয়াল ডিজিটাল কার্ড ফরম্যাটের সাথে মিল রয়েছে। গোপনীয়তার স্বার্থে কার্ডের ব্যক্তিগত তথ্য শুধুমাত্র ডোনারের শেয়ার করা মূল কার্ড ইমেজেই প্রদর্শিত হয়।'
                  : 'This verification ID matches the official Rokto Dei Digital Donor Card format. For donor privacy, personal details are never exposed via URL lookup and are only visible on the card shared directly by the donor.'
                : lang === 'bn'
                ? 'প্রদত্ত ভেরিফিকেশন কোডটির ফরম্যাট সঠিক নয় (সঠিক ফরম্যাট: RD-XXXX-XXXX)।'
                : 'The provided verification token format is invalid (expected RD-XXXX-XXXX).'}
            </p>

            <button
              type="button"
              onClick={handleCloseVerifyToken}
              className="w-full min-h-[42px] rounded-xl bg-[#C80828] hover:bg-[#A3051E] text-white text-sm font-semibold cursor-pointer transition-colors"
            >
              {lang === 'bn' ? 'রক্তদাতা খুঁজুন' : 'Continue to Rokto Dei'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { isBridge } = getApkGoogleAuthBridgeParams();

  if (isBridge) {
    return (
      <AppErrorBoundary variant="app" lang="bn">
        <ApkGoogleAuthBridge />
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary variant="app" lang="bn">
      <AuthProvider>
        <NotificationProvider>
          <UpdateProvider>
            <AppShell />
          </UpdateProvider>
        </NotificationProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
