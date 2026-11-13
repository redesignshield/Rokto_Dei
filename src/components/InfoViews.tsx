import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { AppView } from '../types';
import {
  BloodDropCrest,
  DonationCareIllustration,
  LabCrossmatchIllustration,
} from './MedicalIllustrations';

export function HowItWorksView({
  onNavigate,
}: {
  onNavigate: (v: AppView) => void;
}) {
  const { lang } = useAuth();

  const steps = [
    {
      num: '০১',
      title:
        lang === 'bn'
          ? 'একটি অ্যাকাউন্ট খুলুন ও ইমেইল যাচাই করুন'
          : '01. Create One Verified Account',
      desc:
        lang === 'bn'
          ? 'Google দিয়ে ১ ক্লিকে অথবা ইমেইল-পাসওয়ার্ড দিয়ে নিবন্ধন করে ইমেইল যাচাই সম্পন্ন করুন। একই অ্যাকাউন্ট দিয়ে রক্ত খোঁজা এবং রক্তদাতা হওয়া—দুটোই করা যায়।'
          : 'Sign in with Google or verify your email address. One single account lets you search for blood and optionally list yourself as a donor.',
    },
    {
      num: '০২',
      title:
        lang === 'bn'
          ? 'রক্তের গ্রুপ ও এলাকার পরিধি নির্বাচন করুন'
          : '02. Pick Blood Group & Area Scope',
      desc:
        lang === 'bn'
          ? 'প্রয়োজনীয় রক্তের গ্রুপ এবং বিভাগ, জেলা বা উপজেলা পরিধি নির্বাচন করলে মোট নিবন্ধিত ডোনার এবং বর্তমানে প্রস্তুত (Available) ডোনারের সংখ্যা আলাদাভাবে দেখা যাবে।'
          : 'Filter by exact blood group and division, district, or upazila. Total registered donors and currently Available donors are shown separately.',
    },
    {
      num: '০৩',
      title:
        lang === 'bn'
          ? 'ডোনারের নির্বাচিত মাধ্যমে সরাসরি যোগাযোগ করুন'
          : '03. Contact Directly Without Waiting Online',
      desc:
        lang === 'bn'
          ? 'ইন-অ্যাপ চ্যাট বা অনুমোদনের অপেক্ষায় সময় নষ্ট হয় না। ডোনার যে মাধ্যম (Call, SMS, WhatsApp বা IMO) চালু রেখেছেন, তাতে ক্লিক করে সরাসরি যোগাযোগ করুন।'
          : 'No in-app chat delays. Use the donor-enabled Call, SMS, WhatsApp, or IMO channel directly.',
    },
    {
      num: '০৪',
      title:
        lang === 'bn'
          ? 'নিজের ইচ্ছামতো প্রাপ্যতা পরিবর্তন করুন'
          : '04. Update Availability Anytime',
      desc:
        lang === 'bn'
          ? 'ডোনার হিসেবে যুক্ত হলে প্রতিদিন অ্যাপে ঢোকার কোনো বাধ্যবাধকতা নেই। আপনি যখন খুশি Available, Temporarily Unavailable বা লিস্টিং বন্ধ করতে পারবেন।'
          : 'No mandatory daily check-ins. Update your availability or pause your listing whenever you choose.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-7 space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1F242D]">
            {lang === 'bn'
              ? 'রক্তদেই কীভাবে কাজ করে'
              : 'How Rokto Dei Works'}
          </h1>
          <p className="text-sm text-neutral-600 leading-relaxed">
            {lang === 'bn'
              ? 'সহজ, দ্রুত ও গোপনীয়তা-সুরক্ষিত প্রক্রিয়ায় রক্তপ্রার্থী ও স্বেচ্ছায় রক্তদাতাদের সরাসরি সংযোগ।'
              : 'A transparent, privacy-conscious workflow connecting blood seekers and voluntary donors across Bangladesh.'}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigate('find_donors')}
              className="min-h-[46px] px-6 py-2.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-sm font-semibold rounded-xl cursor-pointer"
            >
              {lang === 'bn' ? 'রক্তদাতা অনুসন্ধানে যান' : 'Find Donors Now'}
            </button>
          </div>
        </div>
        <div className="md:col-span-5 flex justify-center">
          <DonationCareIllustration className="w-60 h-44" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((s) => (
          <div
            key={s.num}
            className="bg-[#FDF2F4] rounded-2xl border border-[#F7D4DC] p-6 space-y-2"
          >
            <div className="text-xs font-mono font-bold text-[#C80828]">
              {s.num}
            </div>
            <h2 className="text-base font-bold text-[#1F242D]">{s.title}</h2>
            <p className="text-sm text-neutral-700 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SafetyDisclaimerView() {
  const { lang } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <div className="md:col-span-7 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1F242D]">
            {lang === 'bn'
              ? 'নিরাপত্তা নীতি ও চিকিৎসা ক্রসম্যাচিং সতর্কতা'
              : 'Safety Rules & Medical Testing Disclaimer'}
          </h1>
          <p className="text-sm text-neutral-600 leading-relaxed">
            {lang === 'bn'
              ? 'রক্তগ্রহণের পূর্বে অনুমোদিত ল্যাবরেটরিতে রক্তের গ্রুপ পরীক্ষা ও স্ক্রিনিং (Testing & Crossmatching) বাধ্যতামূলক।'
              : 'Hospital laboratory screening and crossmatching are mandatory before any transfusion.'}
          </p>
        </div>
        <div className="md:col-span-5 flex justify-center">
          <LabCrossmatchIllustration className="w-56 h-44" />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 space-y-6 text-sm text-neutral-700 leading-relaxed">
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-[#1F242D]">
            ১. চিকিৎসা ও ক্রসম্যাচিং সংক্রান্ত দায়বদ্ধতা
          </h2>
          <p>
            রক্তদেই (Rokto Dei) কেবল একটি তথ্য ও যোগাযোগের মাধ্যম; এটি কোনো হাসপাতাল, ব্লাড ব্যাংক বা জরুরি মেডিকেল সার্ভিস নয়। কোনো ডোনার রক্তদানে শারীরিকভাবে উপযুক্ত কি না, রক্তের গ্রুপ সঠিক কি না এবং রক্ত নিরাপদ কি না—তা অবশ্যই অনুমোদিত হাসপাতাল ও নিবন্ধিত চিকিৎসকের মাধ্যমে পরীক্ষা (Screening & Crossmatching) করে নিশ্চিত হতে হবে।
          </p>
        </div>

        <div className="space-y-1.5 pt-4 border-t border-neutral-100">
          <h2 className="text-base font-bold text-[#1F242D]">
            ২. ইমেইল ও ফোন নম্বর যাচাইকরণের সীমা
          </h2>
          <p>
            প্রাথমিক সংস্করণে (MVP) শুধুমাত্র ব্যবহারকারীর ইমেইল ঠিকানার নিয়ন্ত্রণ যাচাই করা হয়। ফোন নম্বরে OTP যাচাই চালু নেই, তাই প্রদত্ত নম্বর ভুল বা পুরোনো হতে পারে। "ইমেইল যাচাইকৃত" লেখার অর্থ কখনোই জাতীয় পরিচয় বা মেডিকেল যোগ্যতা যাচাইকৃত নয়।
          </p>
        </div>

        <div className="space-y-1.5 pt-4 border-t border-neutral-100">
          <h2 className="text-base font-bold text-[#1F242D]">
            ৩. আর্থিক লেনদেন হতে বিরত থাকুন
          </h2>
          <p>
            স্বেচ্ছায় রক্তদান একটি মানবিক কাজ। রক্তদানের বিনিময়ে কোনো প্রকার অর্থ দাবি বা অগ্রিম টাকা প্রেরণ করবেন না। সন্দেহজনক বা প্রতারণামূলক প্রোফাইল দেখলে সাথে সাথে "রিপোর্ট" বাটন ব্যবহার করে অ্যাডমিন টিমকে জানান।
          </p>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPolicyView() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1F242D]">
          গোপনীয়তা নীতি (Privacy Policy)
        </h1>
        <p className="text-xs text-neutral-500">
          সর্বশেষ হালনাগাদ: নভেম্বর ২০২৬ · যোগাযোগ:{' '}
          <a
            href="mailto:info.redesignshield@gmail.com"
            className="text-[#C80828] font-semibold underline"
          >
            info.redesignshield@gmail.com
          </a>
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 space-y-5 text-sm text-neutral-700 leading-relaxed">
        <section className="space-y-1">
          <h2 className="font-bold text-[#1F242D]">১. সংগৃহীত তথ্য</h2>
          <p>
            অ্যাকাউন্টের ইমেইল, নাম, ইউনিক ইউজারনেম, রক্তদাতা প্রোফাইলের রক্তের গ্রুপ ও সাধারণ এলাকা (বিভাগ/জেলা/উপজেলা), সুরক্ষিত ফোন নম্বর ও নির্বাচিত যোগাযোগ মাধ্যম, প্রাপ্যতা স্ট্যাটাস, রক্তের অনুরোধের তথ্য এবং নিরাপত্তা অডিট মেটাডেটা। আমরা গোপনে লাইভ GPS ট্র্যাকিং করি না।
          </p>
        </section>

        <section className="space-y-1 pt-4 border-t border-neutral-100">
          <h2 className="font-bold text-[#1F242D]">
            ২. ফোন নম্বরের সুরক্ষা ও ডিজিটাল কার্ড গোপনীয়তা
          </h2>
          <p>
            ডোনারের ফোন নম্বর কখনোই পাবলিক সার্চ ফলাফলে প্রদর্শিত হয় না। ডোনার স্পষ্ট সম্মতি (Consent) দিলে শুধুমাত্র লগইনকৃত ও ইমেইল-যাচাইকৃত ব্যবহারকারী সার্ভার অনুমোদন ও রেট-লিমিট যাচাইয়ের পর নম্বরটি দেখতে পান। একইভাবে ডিজিটাল ডোনার কার্ড শুধুমাত্র কার্ডের মালিক নিজের প্রোফাইল থেকে দেখতে ও কাস্টমাইজ করতে পারবেন।
          </p>
        </section>

        <section className="space-y-1 pt-4 border-t border-neutral-100">
          <h2 className="font-bold text-[#1F242D]">
            ৩. তথ্য নিয়ন্ত্রণ ও অ্যাকাউন্ট অপসারণ (Data Deletion)
          </h2>
          <p>
            ব্যবহারকারীর ব্যক্তিগত তথ্য বিক্রি বা বাণিজ্যিকভাবে শেয়ার করা হয় না। আপনি প্রোফাইলের "অ্যাকাউন্ট ও রিপোর্ট" ট্যাব থেকে যেকোনো সময় আপনার প্রোফাইল তথ্য সম্পাদনা, ডোনার তালিকা থেকে নিজেকে সরানো বা অ্যাকাউন্ট নিষ্ক্রিয় করতে পারবেন। স্থায়ীভাবে ডেটা মুছে ফেলতে{' '}
            <a
              href="mailto:info.redesignshield@gmail.com"
              className="text-[#C80828] font-semibold underline"
            >
              info.redesignshield@gmail.com
            </a>{' '}
            ঠিকানায় ইমেইল করুন।
          </p>
        </section>
      </div>
    </div>
  );
}

export function TermsView() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1F242D]">
          ব্যবহারের শর্তাবলি (Terms & Conditions)
        </h1>
        <p className="text-xs text-neutral-500">
          সর্বশেষ হালনাগাদ: নভেম্বর ২০২৬ · অপারেটর যোগাযোগ:{' '}
          <a
            href="mailto:info.redesignshield@gmail.com"
            className="text-[#C80828] font-semibold underline"
          >
            info.redesignshield@gmail.com
          </a>
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 space-y-5 text-sm text-neutral-700 leading-relaxed">
        <section className="space-y-1">
          <h2 className="font-bold text-[#1F242D]">১. সেবার প্রকৃতি</h2>
          <p>
            রক্তদেই (Rokto Dei) শুধুমাত্র রক্তপ্রার্থী ও স্বেচ্ছায় রক্তদাতাদের যোগাযোগের একটি প্ল্যাটফর্ম। এটি কোনো চিকিৎসা প্রতিষ্ঠান নয় এবং রক্তের প্রাপ্যতা বা চিকিৎসা ফলাফলের নিশ্চয়তা প্রদান করে না। যেকোনো রক্তদানের পূর্বে অনুমোদিত ল্যাবে ক্রসম্যাচিং ও স্ক্রিনিং বাধ্যতামূলক।
          </p>
        </section>

        <section className="space-y-1 pt-4 border-t border-neutral-100">
          <h2 className="font-bold text-[#1F242D]">২. ব্যবহারকারীর দায়িত্ব</h2>
          <p>
            সঠিক তথ্য প্রদান করা, শুধুমাত্র প্রকৃত রক্তের প্রয়োজনে যোগাযোগ করা, অর্থ লেনদেন থেকে বিরত থাকা এবং অন্য কোনো ব্যবহারকারীকে হয়রানি, স্প্যাম বা তথ্য স্ক্র্যাপিং না করা প্রতিটি ব্যবহারকারীর জন্য বাধ্যতামূলক। শর্ত ভঙ্গকারী অ্যাকাউন্ট স্থগিত বা অপসারণ করা হবে।
          </p>
        </section>

        <section className="space-y-1 pt-4 border-t border-neutral-100">
          <h2 className="font-bold text-[#1F242D]">
            ৩. তৃতীয় পক্ষের যোগাযোগ মাধ্যম
          </h2>
          <p>
            ফোন কল, SMS, WhatsApp এবং IMO সংশ্লিষ্ট তৃতীয় পক্ষের নিজস্ব শর্ত ও প্রাইভেসি নীতিমালা অনুযায়ী পরিচালিত হয়।
          </p>
        </section>
      </div>
    </div>
  );
}

export function Footer({
  onNavigate,
}: {
  onNavigate: (view: AppView) => void;
}) {
  const { lang, setLang } = useAuth();

  return (
    <footer className="border-t border-neutral-200 bg-white mt-12 pb-16 md:pb-0">
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
