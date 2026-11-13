import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useIsApkAppShell } from '../lib/platform';
import type { AppView } from '../types';

export function Footer({
  onNavigate,
}: {
  onNavigate: (view: AppView) => void;
}) {
  const { lang, setLang } = useAuth();
  const isApkAppShell = useIsApkAppShell();

  return (
    <footer
      className={`border-t border-neutral-200 bg-white mt-12 ${
        isApkAppShell ? 'pb-16' : 'pb-16 md:pb-0'
      } w-full max-w-full overflow-x-hidden`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="রক্তদেই"
            className="w-11 h-11 object-contain rounded-xl border border-neutral-200/80 shadow-xs shrink-0"
          />
          <div className="space-y-0.5">
            <div className="text-base font-bold text-[#C80828]">
              {lang === 'bn' ? 'রক্তদেই (Rokto Dei)' : 'Rokto Dei'}
            </div>
            <p className="text-xs text-neutral-500">
              {lang === 'bn'
                ? 'স্বেচ্ছায় রক্তদাতা অনুসন্ধান ও সংযোগ প্ল্যাটফর্ম · বাংলাদেশ'
                : 'Voluntary Blood Donor Finder & Connection Platform · Bangladesh'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-neutral-600">
          <button
            type="button"
            onClick={() => onNavigate('how_it_works')}
            className="hover:text-[#1F242D] cursor-pointer"
          >
            {lang === 'bn' ? 'কীভাবে কাজ করে' : 'How It Works'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('safety')}
            className="hover:text-[#1F242D] cursor-pointer"
          >
            {lang === 'bn' ? 'নিরাপত্তা ও সতর্কতা' : 'Safety & Disclaimer'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('privacy')}
            className="hover:text-[#1F242D] cursor-pointer"
          >
            {lang === 'bn' ? 'গোপনীয়তা নীতি' : 'Privacy Policy'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('terms')}
            className="hover:text-[#1F242D] cursor-pointer"
          >
            {lang === 'bn' ? 'শর্তাবলি' : 'Terms'}
          </button>

          <button
            type="button"
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#FDF2F4] text-[#C80828] font-semibold hover:bg-[#FADCE2] cursor-pointer"
          >
            {lang === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </div>
      </div>
    </footer>
  );
}
