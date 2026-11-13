import React, { useState } from 'react';
import { Award, Bell, Globe, Menu, User, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useIsApkAppShell } from '../lib/platform';
import type { AppView } from '../types';
import { NotificationPanel } from './NotificationPanel';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentView: AppView;
  onNavigate: (
    view: AppView,
    targetId?: string,
    targetDonorUid?: string,
    pledgeContext?: any
  ) => void;
  onOpenAuth: () => void;
}

export function Header({ currentView, onNavigate, onOpenAuth }: HeaderProps) {
  const { firebaseUser, isAdmin, lang, setLang } = useAuth();
  const { unreadCount } = useNotifications();
  const isApkAppShell = useIsApkAppShell();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const navItems: { view: AppView; label: string }[] = [
    {
      view: 'find_donors',
      label: lang === 'bn' ? 'রক্তদাতা খুঁজুন' : 'Find Donors',
    },
    {
      view: 'blood_requests',
      label: lang === 'bn' ? 'রক্তের অনুরোধ' : 'Blood Requests',
    },
    {
      view: 'how_it_works',
      label: lang === 'bn' ? 'কীভাবে কাজ করে' : 'How It Works',
    },
    {
      view: 'safety',
      label: lang === 'bn' ? 'নিরাপত্তা নীতি' : 'Safety & Rules',
    },
  ];

  if (isAdmin) {
    navItems.push({
      view: 'admin',
      label: lang === 'bn' ? 'অ্যাডমিন প্যানেল' : 'Admin Panel',
    });
  }

  const handleNavClick = (
    view: AppView,
    targetId?: string,
    targetDonorUid?: string,
    pledgeContext?: any
  ) => {
    onNavigate(view, targetId, targetDonorUid, pledgeContext);
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
  };

  const toggleLanguage = () => {
    setLang(lang === 'bn' ? 'en' : 'bn');
  };

  return (
    <header className="sticky top-0 z-40 bg-[#C80828] text-white border-b border-white/15 w-full max-w-full">
      {/* Web version: 3-Zone Top Menu Bar | APK/Standalone App: Compact Top Bar without redundant top menu */}
      <div className="max-w-7xl mx-auto h-14 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick('find_donors')}
          className="font-bold tracking-tight text-white hover:text-white/90 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white flex items-center gap-2 sm:gap-2.5"
        >
          <img
            src="/logo.png"
            alt="রক্তদেই"
            className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-xl bg-white p-0.5 shadow-xs ring-1 ring-white/30 shrink-0"
          />
          <div className="flex flex-col text-left leading-none">
            <span className="font-black text-base sm:text-lg tracking-tight text-white">
              {lang === 'bn' ? 'রক্তদেই' : 'Rokto Dei'}
            </span>
            <span className="text-[9px] sm:text-[10px] text-white/85 font-normal tracking-wide mt-0.5">
              {lang === 'bn' ? 'রক্ত নেই, রক্ত দেই' : 'Blood Network'}
            </span>
          </div>
        </button>

        {/* Zone 2: Desktop Web Navigation Menu (Hidden in APK / Installed App Shell) */}
        {!isApkAppShell && (
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {navItems.map((item) => {
              const active = currentView === item.view;
              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => handleNavClick(item.view)}
                  className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                    active
                      ? 'border-white text-white font-semibold'
                      : 'border-transparent text-white/85 hover:text-white hover:border-white/50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!isApkAppShell && (
            <div className="hidden sm:block">
              <PWAInstallButton lang={lang} variant="header" />
            </div>
          )}

          {isApkAppShell && (
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={lang === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন'}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'EN' : 'বাং'}</span>
            </button>
          )}

          {/* Notification Bell with Floating Unread Badge */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((prev) => !prev);
                setMobileMenuOpen(false);
              }}
              aria-label={
                lang === 'bn'
                  ? `নোটিফিকেশন (${unreadCount} অপঠিত)`
                  : `Notifications (${unreadCount} unread)`
              }
              className="relative min-h-[40px] min-w-[40px] p-2 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 rounded-xl cursor-pointer transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-white text-[#C80828] text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs font-mono tabular-nums ring-2 ring-[#C80828]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <NotificationPanel
              isOpen={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
              onNavigate={handleNavClick}
            />
          </div>

          {/* Profile / Auth Button */}
          {firebaseUser ? (
            <button
              type="button"
              onClick={() => handleNavClick('profile')}
              className={`min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'profile'
                  ? 'bg-white text-[#C80828] shadow-xs'
                  : 'bg-white/95 text-[#C80828] hover:bg-white'
              }`}
            >
              <span className="sm:hidden flex items-center gap-1 font-bold">
                <User className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'প্রোফাইল' : 'Profile'}</span>
              </span>
              <span className="hidden sm:inline">
                {lang === 'bn' ? 'আমার প্রোফাইল' : 'My Profile'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#C80828] bg-white rounded-xl hover:bg-neutral-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="sm:hidden">{lang === 'bn' ? 'লগইন' : 'Login'}</span>
              <span className="hidden sm:inline">
                {lang === 'bn' ? 'লগইন / নিবন্ধন' : 'Login / Register'}
              </span>
            </button>
          )}

          {/* Mobile Hamburger Menu Button — Web Browser Only (Hidden in APK Mode) */}
          {!isApkAppShell && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen((prev) => !prev);
                setNotificationsOpen(false);
              }}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-white hover:bg-white/10 rounded-xl cursor-pointer transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation Dropdown — Web Browser Only */}
      {!isApkAppShell && mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 top-14 bg-black/50 z-40 backdrop-blur-2xs transition-opacity animate-in fade-in duration-150"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-label="Mobile Navigation Menu"
            className="md:hidden absolute top-full left-0 right-0 z-50 bg-[#A80620] shadow-2xl border-t border-white/15 px-4 py-3.5 space-y-1.5 rounded-b-2xl animate-in slide-in-from-top-2 duration-200"
          >
            {navItems.map((item) => {
              const active = currentView === item.view;
              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => handleNavClick(item.view)}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 text-left text-sm font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-between ${
                    active
                      ? 'bg-white text-[#C80828] shadow-xs'
                      : 'text-white/95 hover:bg-white/10'
                  }`}
                >
                  <span>{item.label}</span>
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C80828]" />
                  )}
                </button>
              );
            })}

            {firebaseUser && (
              <button
                type="button"
                onClick={() => handleNavClick('profile')}
                className="w-full min-h-[44px] px-3.5 py-2.5 text-left text-sm font-bold rounded-xl bg-white text-[#C80828] shadow-xs flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#C80828]" />
                  <span>
                    {lang === 'bn'
                      ? 'আমার ডিজিটাল ডোনার কার্ড'
                      : 'My Digital Donor Card'}
                  </span>
                </span>
                <span className="text-[10px] bg-[#FDF2F4] px-2 py-0.5 rounded-md font-semibold text-[#8F1D30]">
                  {lang === 'bn' ? 'প্রোফাইল' : 'Profile'}
                </span>
              </button>
            )}

            <PWAInstallButton lang={lang} variant="menu" />

            <div className="pt-2 border-t border-white/15 flex items-center justify-between px-1 text-xs">
              <span className="text-white/70">
                {lang === 'bn' ? 'ভাষা / Language' : 'Language'}
              </span>
              <button
                type="button"
                onClick={toggleLanguage}
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
