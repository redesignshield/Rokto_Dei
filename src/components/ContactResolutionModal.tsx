import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Phone, MessageSquare, X } from 'lucide-react';
import { buildContactDeepLink } from '../lib/validation';
import { contactMethodLabel } from '../lib/i18n';
import type { AppLanguage, ContactMethod } from '../types';

interface ContactResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  personName: string;
  bloodGroup: string;
  selectedMethod: ContactMethod;
  phoneNumber: string;
  quota?: {
    hourlyUsed: number;
    hourlyLimit: number;
    dailyUsed: number;
    dailyLimit: number;
  };
  lang: AppLanguage;
}

export function ContactResolutionModal({
  isOpen,
  onClose,
  personName,
  bloodGroup,
  selectedMethod,
  phoneNumber,
  quota,
  lang,
}: ContactResolutionModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const deepLink = buildContactDeepLink(phoneNumber, selectedMethod);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(phoneNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-neutral-500">
              {bloodGroup} · {contactMethodLabel(selectedMethod, lang)}
            </p>
            <h3
              id="contact-modal-title"
              className="text-lg font-bold text-[#1F242D] mt-0.5"
            >
              {personName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close contact dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-900 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Phone Number Surface */}
        <div className="p-4 rounded-2xl bg-[#FDF2F4] flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-neutral-600">
              {lang === 'bn'
                ? 'যোগাযোগের নম্বর (OTP-যাচাইকৃত নয়)'
                : 'Contact Number (Unverified by OTP)'}
            </div>
            <div className="text-xl font-mono font-semibold text-[#1F242D] tabular-nums mt-0.5">
              {phoneNumber}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-neutral-50 rounded-xl text-xs font-semibold text-[#C80828] flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-700" />
                <span>{lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>{lang === 'bn' ? 'নম্বর কপি' : 'Copy'}</span>
              </>
            )}
          </button>
        </div>

        {/* Action Link or Safe IMO Fallback (TC-015 & TC-016) */}
        {deepLink ? (
          <div className="space-y-2.5">
            <a
              href={deepLink}
              target={selectedMethod === 'whatsapp' ? '_blank' : undefined}
              rel={
                selectedMethod === 'whatsapp'
                  ? 'noopener noreferrer'
                  : undefined
              }
              className="w-full min-h-[48px] px-4 py-2.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {selectedMethod === 'call' && <Phone className="w-4 h-4" />}
              {selectedMethod === 'sms' && (
                <MessageSquare className="w-4 h-4" />
              )}
              {selectedMethod === 'whatsapp' && (
                <ExternalLink className="w-4 h-4" />
              )}
              <span>
                {selectedMethod === 'call'
                  ? lang === 'bn'
                    ? 'এখনই ফোনে কল করুন'
                    : 'Place Phone Call'
                  : selectedMethod === 'sms'
                  ? lang === 'bn'
                    ? 'SMS অ্যাপ ওপেন করুন'
                    : 'Open SMS App'
                  : lang === 'bn'
                  ? 'WhatsApp-এ মেসেজ দিন'
                  : 'Open in WhatsApp'}
              </span>
            </a>
            <p className="text-xs text-neutral-500 leading-relaxed">
              {lang === 'bn'
                ? 'আপনার ডিভাইসে অ্যাপ না খুললে উপরের "নম্বর কপি" বাটন ব্যবহার করে সরাসরি যোগাযোগ করুন।'
                : 'If your device does not open the target app automatically, copy the number above.'}
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-neutral-100 text-xs text-neutral-700 leading-relaxed">
            {lang === 'bn'
              ? 'IMO-এর জন্য নিরাপদ নির্দেশনা: উপরের "নম্বর কপি" বাটনে ক্লিক করে নম্বরটি কপি করুন এবং আপনার ফোনের IMO অ্যাপে গিয়ে নম্বরটি দিয়ে সার্চ করে যোগাযোগ করুন।'
              : 'IMO Safe Fallback: Copy the number above and search it inside your IMO app to initiate contact.'}
          </div>
        )}

        {/* Privacy & Medical Responsibility Disclosure */}
        <div className="pt-3 border-t border-neutral-200 space-y-2 text-xs text-neutral-600 leading-relaxed">
          <p>
            {lang === 'bn'
              ? 'সতর্কতা: এই নম্বরটি শুধুমাত্র রক্তদান সংক্রান্ত যোগাযোগের জন্য দেওয়া হয়েছে। নম্বরটি অন্য কোথাও বিক্রি, প্রকাশ বা অপব্যবহার করা সম্পূর্ণ নিষিদ্ধ। রক্তগ্রহণের আগে অবশ্যই চিকিৎসকের তত্ত্বাবধানে ক্রসম্যাচিং সম্পন্ন করুন।'
              : 'Notice: Use this contact strictly for genuine blood-related communication. Redistribution or misuse is prohibited. Always complete medical crossmatching before transfusion.'}
          </p>
          {quota && (
            <p className="text-[11px] text-neutral-500 font-mono tabular-nums">
              {lang === 'bn'
                ? `নিরাপত্তা কোটা ব্যবহৃত: ঘণ্টায় ${quota.hourlyUsed}/${quota.hourlyLimit} · আজ ${quota.dailyUsed}/${quota.dailyLimit}`
                : `Lookup quota: ${quota.hourlyUsed}/${quota.hourlyLimit} hourly · ${quota.dailyUsed}/${quota.dailyLimit} daily`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
