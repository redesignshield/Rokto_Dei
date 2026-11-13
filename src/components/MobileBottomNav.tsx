import React from 'react';
import { Droplets, HeartPulse, Search, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useIsApkAppShell } from '../lib/platform';
import type { AppView } from '../types';

interface MobileBottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenAuth: () => void;
}

export function MobileBottomNav({
  currentView,
  onNavigate,
  onOpenAuth,
}: MobileBottomNavProps) {
  const { firebaseUser, isAdmin, lang } = useAuth();
  const isApkAppShell = useIsApkAppShell();

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className={`${
        isApkAppShell ? '' : 'md:hidden '
      }fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-neutral-200`}
    >
      <div
        className={`grid ${
          isAdmin ? 'grid-cols-5' : 'grid-cols-4'
        } items-center h-14 px-1`}
      >
        <button
          type="button"
          onClick={() => onNavigate('find_donors')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            currentView === 'find_donors'
              ? 'text-[#C80828] font-semibold'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] whitespace-nowrap">
            {lang === 'bn' ? 'ডোনার খুঁজুন' : 'Search'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('blood_requests')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            currentView === 'blood_requests'
              ? 'text-[#C80828] font-semibold'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Droplets className="w-5 h-5" />
          <span className="text-[10px] whitespace-nowrap">
            {lang === 'bn' ? 'অনুরোধ' : 'Requests'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('how_it_works')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            currentView === 'how_it_works' || currentView === 'safety'
              ? 'text-[#C80828] font-semibold'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <HeartPulse className="w-5 h-5" />
          <span className="text-[10px] whitespace-nowrap">
            {lang === 'bn' ? 'নির্দেশিকা' : 'Guide'}
          </span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              currentView === 'admin'
                ? 'text-[#C80828] font-semibold'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px] whitespace-nowrap">
              {lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (firebaseUser) {
              onNavigate('profile');
            } else {
              onOpenAuth();
            }
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            currentView === 'profile'
              ? 'text-[#C80828] font-semibold'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] whitespace-nowrap">
            {firebaseUser
              ? lang === 'bn'
                ? 'প্রোফাইল'
                : 'Profile'
              : lang === 'bn'
              ? 'লগইন'
              : 'Login'}
          </span>
        </button>
      </div>
    </nav>
  );
}
