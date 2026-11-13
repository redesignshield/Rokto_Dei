import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  Droplets,
  HeartHandshake,
  Info,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  type AppNotification,
  useNotifications,
} from '../contexts/NotificationContext';
import type { AppView } from '../types';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (
    view: AppView,
    targetId?: string,
    targetDonorUid?: string,
    pledgeContext?: any
  ) => void;
}

export function NotificationPanel({
  isOpen,
  onClose,
  onNavigate,
}: NotificationPanelProps) {
  const { lang } = useAuth();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  if (!isOpen) return null;

  const filtered = notifications.filter((item) => {
    if (tab === 'unread') return !item.read;
    return true;
  });

  const handleItemClick = (item: AppNotification) => {
    markAsRead(item.id);
    if (item.targetView) {
      onNavigate(
        item.targetView,
        item.targetId,
        item.targetDonorUid || item.metadata?.donorUid,
        item.metadata
      );
    }
    onClose();
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'emergency_alert':
        return <Droplets className="w-4 h-4 text-[#C80828]" />;
      case 'pledge_received':
      case 'pledge_accepted':
        return <HeartHandshake className="w-4 h-4 text-emerald-600" />;
      case 'donor_booked':
        return <Lock className="w-4 h-4 text-amber-600" />;
      case 'moderator_granted':
        return <ShieldCheck className="w-4 h-4 text-indigo-600" />;
      case 'moderator_revoked':
        return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      case 'user_status_changed':
        return <UserX className="w-4 h-4 text-amber-600" />;
      case 'eligibility_reminder':
        return <Droplets className="w-4 h-4 text-emerald-600" />;
      default:
        return <Info className="w-4 h-4 text-neutral-500" />;
    }
  };

  const formatRelativeTime = (isoString: string): string => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 2) return lang === 'bn' ? 'এইমাত্র' : 'Just now';
      if (diffMin < 60)
        return lang === 'bn' ? `${diffMin} মিনিট আগে` : `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24)
        return lang === 'bn' ? `${diffHours} ঘণ্টা আগে` : `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return lang === 'bn' ? `${diffDays} দিন আগে` : `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Semi-transparent backdrop to close on outside click */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Overlapping Floating Notification Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={lang === 'bn' ? 'নোটিফিকেশন' : 'Notifications'}
        className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-[410px] max-w-[calc(100vw-1.5rem)] z-50 bg-white text-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[82vh] animate-in fade-in slide-in-from-top-2 duration-200"
      >
        {/* Panel Header */}
        <div className="px-4 py-3.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-[#C80828] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <span>{lang === 'bn' ? 'নোটিফিকেশন' : 'Notifications'}</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.2 bg-[#C80828] text-white text-[11px] font-bold rounded-full font-mono tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500">
                {lang === 'bn'
                  ? 'রক্তদানের অনুরোধ, সাড়া ও আপডেট'
                  : 'Requests, pledges & alerts'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                title={
                  lang === 'bn' ? 'সব পঠিত করুন' : 'Mark all read'
                }
                className="min-h-[32px] px-2 py-1 text-[11px] font-semibold text-neutral-600 hover:text-[#C80828] hover:bg-neutral-100 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {lang === 'bn' ? 'সব পঠিত' : 'Read all'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-xl cursor-pointer transition-colors"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between gap-2 bg-white">
          <div className="flex items-center gap-1 p-0.5 bg-neutral-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                tab === 'all'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {lang === 'bn'
                ? `সব (${notifications.length})`
                : `All (${notifications.length})`}
            </button>
            <button
              type="button"
              onClick={() => setTab('unread')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                tab === 'unread'
                  ? 'bg-white text-[#C80828] shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {lang === 'bn'
                ? `অপঠিত (${unreadCount})`
                : `Unread (${unreadCount})`}
            </button>
          </div>

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              title={lang === 'bn' ? 'সব নোটিফিকেশন মুছুন' : 'Clear all notifications'}
              className="min-h-[32px] px-2.5 py-1 text-[11px] font-semibold text-neutral-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'সব মুছুন' : 'Clear all'}</span>
            </button>
          )}
        </div>

        {/* Notifications Scroll List */}
        <div className="overflow-y-auto flex-1 divide-y divide-neutral-100">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-neutral-500 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center">
                <Bell className="w-5 h-5 opacity-60" />
              </div>
              <p className="text-xs font-medium">
                {tab === 'unread'
                  ? lang === 'bn'
                    ? 'কোনো অপঠিত নোটিফিকেশন নেই।'
                    : 'No unread notifications.'
                  : lang === 'bn'
                  ? 'আপাতত কোনো নতুন নোটিফিকেশন নেই।'
                  : 'No notifications at this moment.'}
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const title = lang === 'bn' ? item.titleBn : item.titleEn;
              const msg = lang === 'bn' ? item.messageBn : item.messageEn;
              const timeLabel = formatRelativeTime(item.timestamp);

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3.5 sm:p-4 hover:bg-neutral-50 transition-colors flex items-start gap-3 cursor-pointer group ${
                    !item.read ? 'bg-red-50/30' : 'bg-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4
                        className={`text-xs truncate ${
                          !item.read
                            ? 'font-bold text-neutral-900'
                            : 'font-semibold text-neutral-700'
                        }`}
                      >
                        {title}
                      </h4>
                      <span className="text-[10px] text-neutral-400 font-mono tabular-nums whitespace-nowrap shrink-0">
                        {timeLabel}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                      {msg}
                    </p>

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] font-semibold text-[#C80828] group-hover:underline">
                        {lang === 'bn' ? 'বিস্তারিত দেখুন →' : 'View details →'}
                      </span>

                      {!item.read && (
                        <span className="inline-block w-2 h-2 rounded-full bg-[#C80828] shrink-0" />
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(item.id);
                    }}
                    title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                    className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 rounded-lg transition-colors cursor-pointer shrink-0"
                    aria-label="Delete notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
