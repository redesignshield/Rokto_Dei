import React from 'react';

/**
 * Clean flat-vector SVG medical illustrations inspired by the reference design:
 * 1. DonationCareIllustration — Voluntary donor care with IV stand & nurse
 * 2. LabCrossmatchIllustration — Hospital blood group testing & crossmatching
 * 3. BloodDropCrest — Minimalist hand + blood drop emblem
 */

export function BloodDropCrest({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="রক্তদেই"
      className={`object-contain rounded-md ${className}`}
    />
  );
}

export function DonationCareIllustration({
  className = 'w-56 h-44',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 280 210"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Soft circular blush backdrop */}
      <circle cx="145" cy="108" r="82" fill="#FDF2F4" />

      {/* Clinic window */}
      <rect
        x="48"
        y="34"
        width="76"
        height="62"
        rx="8"
        fill="#E0F2FE"
        stroke="#BAE6FD"
        strokeWidth="2"
      />
      <line x1="86" y1="34" x2="86" y2="96" stroke="#BAE6FD" strokeWidth="2" />
      <line x1="48" y1="65" x2="124" y2="65" stroke="#BAE6FD" strokeWidth="2" />

      {/* Framed blood drop wall sign */}
      <rect
        x="182"
        y="40"
        width="32"
        height="36"
        rx="6"
        fill="#FFFFFF"
        stroke="#C80828"
        strokeWidth="2"
      />
      <path
        d="M198 48C198 48 190 57 190 62.5C190 66.9 193.6 70.5 198 70.5C202.4 70.5 206 66.9 206 62.5C206 57 198 48 198 48Z"
        fill="#C80828"
      />

      {/* IV Pole & Blood Collection Unit */}
      <line x1="154" y1="42" x2="154" y2="168" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
      <path d="M142 44H166" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
      <rect x="139" y="50" width="12" height="20" rx="4" fill="#C80828" />
      <rect x="157" y="54" width="11" height="17" rx="3.5" fill="#F43F5E" />
      <path
        d="M145 70C145 88 168 92 176 108"
        stroke="#C80828"
        strokeWidth="2"
        strokeDasharray="3 2"
      />

      {/* Reclining Donor Chair */}
      <path
        d="M118 140L168 140L198 106"
        stroke="#1E293B"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M132 142L122 170M162 142L174 170"
        stroke="#475569"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Donor resting comfortably */}
      <circle cx="188" cy="94" r="10" fill="#FDBA74" />
      <path
        d="M181 89C183 83 193 83 196 90"
        stroke="#1E293B"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M150 132L182 106"
        stroke="#38BDF8"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M116 134L150 132"
        stroke="#0284C7"
        strokeWidth="11"
        strokeLinecap="round"
      />

      {/* Attending Healthcare Professional in Teal Scrubs */}
      <circle cx="94" cy="82" r="10" fill="#FDBA74" />
      <path
        d="M86 78C88 71 99 71 102 78"
        fill="#0F766E"
      />
      <rect x="82" y="94" width="24" height="44" rx="8" fill="#14B8A6" />
      <line x1="89" y1="138" x2="87" y2="170" stroke="#0F766E" strokeWidth="6" strokeLinecap="round" />
      <line x1="99" y1="138" x2="102" y2="170" stroke="#0F766E" strokeWidth="6" strokeLinecap="round" />
      <path d="M104 104L122 114" stroke="#14B8A6" strokeWidth="6" strokeLinecap="round" />

      {/* Ground baseline */}
      <line x1="52" y1="172" x2="228" y2="172" stroke="#F1DDE2" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LabCrossmatchIllustration({
  className = 'w-56 h-44',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 280 210"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="142" cy="108" r="80" fill="#FDF2F4" />

      {/* Lab Specimen Rack & Blood Tubes */}
      <rect x="92" y="128" width="64" height="28" rx="4" fill="#CBD5E1" />
      <rect x="102" y="106" width="8" height="44" rx="4" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />
      <rect x="103" y="124" width="6" height="25" rx="3" fill="#C80828" />

      <rect x="118" y="106" width="8" height="44" rx="4" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />
      <rect x="119" y="120" width="6" height="29" rx="3" fill="#C80828" />

      <rect x="134" y="106" width="8" height="44" rx="4" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />
      <rect x="135" y="127" width="6" height="22" rx="3" fill="#C80828" />

      {/* Microscope */}
      <path d="M58 156H90" stroke="#1E293B" strokeWidth="5" strokeLinecap="round" />
      <path d="M74 156V134C74 120 84 112 92 112" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
      <rect x="78" y="96" width="10" height="24" rx="3" transform="rotate(20 78 96)" fill="#1E293B" />

      {/* Lab Technologist */}
      <circle cx="184" cy="76" r="14" fill="#FED7AA" />
      <path d="M170 72C172 58 196 58 198 72" fill="#1E293B" />
      <rect x="162" y="94" width="46" height="62" rx="12" fill="#2DD4BF" />
      <path d="M162 112L140 102" stroke="#2DD4BF" strokeWidth="9" strokeLinecap="round" />

      {/* Lab bench */}
      <line x1="46" y1="158" x2="234" y2="158" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
