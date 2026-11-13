import React from 'react';
import { Droplets } from 'lucide-react';

interface ViewSkeletonLoaderProps {
  variant?: 'profile' | 'requests' | 'admin' | 'generic';
  lang?: 'bn' | 'en';
}

export function ViewSkeletonLoader({
  variant = 'generic',
  lang = 'bn',
}: ViewSkeletonLoaderProps) {
  return (
    <div className="w-full min-h-[60vh] pb-16 animate-pulse">
      {/* Crimson curved header skeleton */}
      <div className="relative bg-gradient-to-r from-[#C80828]/90 via-[#B80724]/90 to-[#99061e]/90 text-white pt-8 pb-20 shadow-inner overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20" />
            <div className="space-y-2">
              <div className="h-5 w-48 sm:w-64 bg-white/25 rounded-md" />
              <div className="h-3 w-32 sm:w-44 bg-white/15 rounded-md" />
            </div>
          </div>
          <div className="h-10 w-24 bg-white/20 rounded-xl" />
        </div>

        {/* Shimmer light bar across banner */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Floating Card Silhouette */}
      <div className="max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 -mt-10 sm:-mt-14 relative z-10 space-y-5 sm:space-y-6">
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-neutral-200/90 shadow-md p-4 sm:p-8 space-y-5 sm:space-y-6">
          {/* Identity Top Row */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 sm:gap-5 pb-5 sm:pb-6 border-b border-neutral-100">
            <div className="flex items-center sm:items-start gap-3.5 sm:gap-4 text-left w-full sm:w-auto">
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl bg-rose-50 border-2 sm:border-4 border-white shadow-md flex items-center justify-center shrink-0">
                <Droplets className="w-7 h-7 sm:w-8 sm:h-8 text-[#C80828]/40 animate-bounce" />
              </div>

              <div className="space-y-2 text-left flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-6 sm:h-7 w-32 sm:w-40 bg-neutral-200 rounded-lg" />
                  <div className="h-5 sm:h-6 w-16 sm:w-20 bg-rose-100 rounded-lg" />
                </div>
                <div className="h-4 w-44 sm:w-56 bg-neutral-100 rounded-md" />
              </div>
            </div>

            <div className="h-10 w-full sm:w-32 bg-neutral-100 rounded-xl" />
          </div>

          {/* 4 Box Matrix Placeholder (2 columns on mobile) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-[#FAF8F9] rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-neutral-200/80 space-y-2"
              >
                <div className="h-3 w-16 bg-neutral-200 rounded" />
                <div className="h-4 w-24 bg-neutral-200 rounded" />
                <div className="h-2.5 w-20 bg-neutral-100 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Content Section Placeholder */}
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm p-6 sm:p-8 space-y-4">
          <div className="h-5 w-44 bg-neutral-200 rounded-lg mb-4" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-neutral-100 rounded" />
            <div className="h-4 w-5/6 bg-neutral-100 rounded" />
            <div className="h-4 w-3/4 bg-neutral-100 rounded" />
          </div>
        </div>
      </div>

      <div className="text-center pt-6">
        <p className="text-xs text-neutral-400 font-medium inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#C80828] animate-ping" />
          <span>
            {lang === 'bn' ? 'তথ্য লোড হচ্ছে...' : 'Loading secure view...'}
          </span>
        </p>
      </div>
    </div>
  );
}
