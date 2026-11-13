import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  lang?: 'bn' | 'en';
  variant?: 'header' | 'menu';
}

export function PWAInstallButton({
  lang = 'bn',
  variant = 'header',
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    if (variant === 'menu') {
      return (
        <button
          type="button"
          onClick={() => void install()}
          className="w-full min-h-[44px] px-3.5 py-2.5 text-left text-sm font-bold rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-between cursor-pointer transition-colors"
        >
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            <span>{lang === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}</span>
          </span>
          <span className="text-[10px] bg-white text-[#C80828] px-2 py-0.5 rounded-md font-bold">
            PWA
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => void install()}
        aria-label={lang === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}
        className="min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/25 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">
          {lang === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install App'}
        </span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'menu'
              ? 'w-full min-h-[44px] px-3.5 py-2.5 text-left text-sm font-semibold rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center gap-2 cursor-pointer transition-colors'
              : 'min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/25 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors'
          }
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>{lang === 'bn' ? 'হোম স্ক্রিনে যুক্ত' : 'Install iOS'}</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              lang === 'bn'
                ? 'iPhone বা iPad-এ অ্যাপ ইনস্টল নির্দেশিকা'
                : 'Install on iPhone or iPad'
            }
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white text-[#1F242D] p-5 shadow-2xl border border-neutral-200 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">
                  {lang === 'bn'
                    ? 'iPhone / iPad-এ ইনস্টল করুন'
                    : 'Install on iPhone / iPad'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-neutral-600" />
                </button>
              </div>
              <ol className="text-xs sm:text-sm text-neutral-700 space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  {lang === 'bn' ? (
                    <>
                      Safari ব্রাউজারের নিচের <strong className="inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 inline" /> Share</strong> বাটনে ট্যাপ করুন।
                    </>
                  ) : (
                    <>
                      Tap the <strong>Share</strong> button in Safari toolbar.
                    </>
                  )}
                </li>
                <li>
                  {lang === 'bn' ? (
                    <>
                      নিচে স্ক্রল করে <strong>Add to Home Screen</strong> নির্বাচন করুন।
                    </>
                  ) : (
                    <>
                      Scroll down and tap <strong>Add to Home Screen</strong>.
                    </>
                  )}
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[42px] rounded-xl bg-[#C80828] hover:bg-[#A3051E] text-white text-sm font-semibold cursor-pointer transition-colors"
              >
                {lang === 'bn' ? 'বুঝেছি' : 'Got it'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
