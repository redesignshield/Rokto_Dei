import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function DemoPreviewBanner() {
  const { demoMode, setDemoMode, lang } = useAuth();

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
          {demoMode ? (
            <>
              <span className="font-bold text-[#C80828]">
                {lang === 'bn' ? 'টেস্ট ডেমো ডেটা সক্রিয়:' : 'Test Demo Data Active:'}
              </span>{' '}
              <span>
                {lang === 'bn'
                  ? 'অ্যাপের ফিচার টেস্ট করার জন্য নমুনা তথ্য দেখানো হচ্ছে। আসল ডাটাবেসে (Firestore) কোনো ভূয়া ডাটা লেখা হয়নি এবং ১ ক্লিকে বন্ধ করা যায়।'
                  : 'Showing temporary test data for QA preview. Zero fake records are written to live Firestore.'}
              </span>
            </>
          ) : (
            <>
              <span className="font-bold text-[#1F242D]">
                {lang === 'bn' ? 'লাইভ ডাটাবেস মোড:' : 'Live Database Mode:'}
              </span>{' '}
              <span>
                {lang === 'bn'
                  ? 'ডেমো ডেটা বন্ধ রয়েছে — শুধুমাত্র আসল ব্যবহারকারীদের তথ্য প্রদর্শিত হচ্ছে।'
                  : 'Demo data is turned off — displaying live Firestore records only.'}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDemoMode(!demoMode)}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-auto transition-colors cursor-pointer ${
            demoMode
              ? 'bg-[#FDF2F4] hover:bg-[#FADCE2] text-[#C80828]'
              : 'bg-neutral-100 hover:bg-neutral-200 text-[#1F242D]'
          }`}
        >
          {demoMode ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>
                {lang === 'bn' ? 'ডেমো ডেটা বন্ধ করুন' : 'Turn Off Demo Data'}
              </span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>
                {lang === 'bn' ? 'ডেমো ডেটা চালু করুন' : 'Enable Demo Data'}
              </span>
            </>
          )}
        </button>
      </div>

      {demoMode && (
        <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center gap-2 text-[11px] font-medium text-neutral-600">
          <span className="text-neutral-500">
            {lang === 'bn' ? 'টেস্টের জন্য উপলব্ধ:' : 'Available for testing:'}
          </span>
          <span className="px-2.5 py-1 bg-red-50 text-[#C80828] rounded-lg">
            🩸 {lang === 'bn' ? '২৪ জন ডেমো রক্তদাতা (সব গ্রুপ)' : '24 Demo Donors'}
          </span>
          <span className="px-2.5 py-1 bg-amber-50 text-amber-900 rounded-lg">
            📋 {lang === 'bn' ? '৮টি রক্তের অনুরোধ (জরুরি ও বুকড লক সহ)' : '8 Blood Requests'}
          </span>
          <span className="px-2.5 py-1 bg-blue-50 text-blue-900 rounded-lg">
            👤 {lang === 'bn' ? 'প্রোফাইলে ৪টি রক্তদান হিস্ট্রি' : '4 Donation History Logs'}
          </span>
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-900 rounded-lg">
            🔔 {lang === 'bn' ? '৩টি অ্যাকশনযোগ্য নোটিফিকেশন' : '3 Test Notifications'}
          </span>
        </div>
      )}
    </div>
  );
}
