import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, isOfflineError, OperationType } from '../lib/firestoreError';
import { useAuth } from './AuthContext';
import type { AppView, BloodGroup, NotificationType } from '../types';

export type { NotificationType };

export interface AppNotification {
  id: string;
  type: NotificationType;
  titleBn: string;
  titleEn: string;
  messageBn: string;
  messageEn: string;
  timestamp: string; // ISO date or human label
  read: boolean;
  targetView: AppView;
  targetId?: string;
  targetDonorUid?: string; // Directly opens donor's full profile modal
  urgency?: 'emergency' | 'urgent' | 'info';
  metadata?: {
    bloodGroup?: BloodGroup;
    hospitalName?: string;
    donorName?: string;
    donorUid?: string;
    requesterName?: string;
    requestId?: string;
    units?: number;
    totalUnits?: number;
    pledgeMessage?: string;
    isAppUpdate?: boolean;
    version?: string;
  };
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  addNotification: (
    item: Omit<AppNotification, 'id' | 'timestamp' | 'read'> & { id?: string }
  ) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const STORAGE_KEY_READ_IDS = 'roktodei_read_notification_ids';
const STORAGE_KEY_DISMISSED_IDS = 'roktodei_dismissed_notification_ids';
const STORAGE_KEY_CUSTOM_NOTIFS = 'roktodei_custom_notifications';

function getStoredReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_READ_IDS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveStoredReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(
      STORAGE_KEY_READ_IDS,
      JSON.stringify(Array.from(ids))
    );
  } catch {
    // ignore
  }
}

function getStoredDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISMISSED_IDS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveStoredDismissedIds(ids: Set<string>) {
  try {
    localStorage.setItem(
      STORAGE_KEY_DISMISSED_IDS,
      JSON.stringify(Array.from(ids))
    );
  } catch {
    // ignore
  }
}

function getStoredCustomNotifs(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_NOTIFS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredCustomNotifs(notifs: AppNotification[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY_CUSTOM_NOTIFS,
      JSON.stringify(notifs.slice(0, 50))
    );
  } catch {
    // ignore
  }
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { firebaseUser, isEmailVerified, ownDonor } = useAuth();
  const [readIds, setReadIds] = useState<Set<string>>(() => getStoredReadIds());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() =>
    getStoredDismissedIds()
  );
  const [customNotifs, setCustomNotifs] = useState<AppNotification[]>(() =>
    getStoredCustomNotifs()
  );
  const [realtimeNotifs, setRealtimeNotifs] = useState<AppNotification[]>([]);

  // Real-time Firestore onSnapshot listener for verified recipients only
  useEffect(() => {
    if (!firebaseUser || !isEmailVerified) {
      setRealtimeNotifs([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('targetUid', '==', firebaseUser.uid),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: AppNotification[] = snapshot.docs.map((d) => {
          const data = d.data();
          let timestamp = new Date().toISOString();
          if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            timestamp = data.createdAt.toDate().toISOString();
          } else if (typeof data.createdAt === 'string') {
            timestamp = data.createdAt;
          }
          return {
            id: data.id || d.id,
            type: data.type,
            titleBn: data.titleBn,
            titleEn: data.titleEn,
            messageBn: data.messageBn,
            messageEn: data.messageEn,
            timestamp,
            read: Boolean(data.read),
            targetView: data.targetView || 'find_donors',
            targetId: data.targetId || undefined,
            targetDonorUid: data.targetDonorUid || undefined,
            urgency: data.urgency || 'info',
            metadata: data.metadata || {},
          };
        });
        setRealtimeNotifs(list);
      },
      (error) => {
        if (!isOfflineError(error)) {
          console.warn('Realtime notifications listener error:', error);
        } else {
          console.warn('Realtime notifications running in offline mode.');
        }
      }
    );

    return () => unsubscribe();
  }, [firebaseUser, isEmailVerified]);

  // Generate contextual default notifications
  const generatedNotifs = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = [];

    // 1. If user is logged in, add a personalized welcome / readiness alert
    if (firebaseUser) {
      list.push({
        id: `notif_welcome_${firebaseUser.uid}`,
        type: 'system_update',
        titleBn: 'রক্তদেই প্ল্যাটফর্মে স্বাগতম',
        titleEn: 'Welcome to Rokto Dei',
        messageBn:
          'আপনার অ্যাকাউন্ট সুরক্ষিত। ডোনার প্রোফাইল চালু করে অন্যদের জীবন বাঁচাতে পাশে দাঁড়ান।',
        messageEn:
          'Your account is active. Complete your donor profile to help save lives.',
        timestamp: new Date().toISOString(),
        read: readIds.has(`notif_welcome_${firebaseUser.uid}`),
        targetView: 'profile',
        urgency: 'info',
      });
    }

    // 2. Donor donation rest period / readiness reminder
    if (ownDonor?.lastDonationDate) {
      const lastDonation = new Date(ownDonor.lastDonationDate).getTime();
      const diffDays = Math.floor(
        (Date.now() - lastDonation) / (1000 * 60 * 60 * 24)
      );
      if (diffDays >= 90) {
        const id = `notif_ready_${ownDonor.uid}_${ownDonor.lastDonationDate}`;
        list.push({
          id,
          type: 'eligibility_reminder',
          titleBn: 'আপনি পুনরায় রক্তদানে প্রস্তুত!',
          titleEn: 'You are Eligible to Donate Blood Again!',
          messageBn: `আপনার শেষ রক্তদানের পর ${diffDays} দিন অতিক্রান্ত হয়েছে। আপনার বর্তমান স্ট্যাটাস রক্তদানে প্রস্তুত হিসেবে আপডেট করতে পারেন।`,
          messageEn: `It has been ${diffDays} days since your last donation. You are now eligible to donate blood.`,
          timestamp: new Date().toISOString(),
          read: readIds.has(id),
          targetView: 'profile',
          urgency: 'info',
        });
      }
    }

    return list;
  }, [firebaseUser, ownDonor, readIds]);

  // Combine real-time Firestore notifications with custom added and generated notifications
  const allNotifications = useMemo<AppNotification[]>(() => {
    const combined = [...realtimeNotifs, ...customNotifs, ...generatedNotifs];
    // deduplicate by id
    const seen = new Set<string>();
    const unique: AppNotification[] = [];
    for (const item of combined) {
      if (!seen.has(item.id) && !dismissedIds.has(item.id)) {
        seen.add(item.id);
        unique.push({
          ...item,
          read: readIds.has(item.id) || item.read,
        });
      }
    }

    // Sort: unread first, then latest timestamp
    unique.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return unique;
  }, [realtimeNotifs, customNotifs, generatedNotifs, readIds, dismissedIds]);

  const unreadCount = useMemo(() => {
    return allNotifications.filter((n) => !n.read).length;
  }, [allNotifications]);

  const markAsRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveStoredReadIds(next);
        return next;
      });
      setCustomNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setRealtimeNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );

      // Also persist to Firestore if this is a real database document
      if (firebaseUser && realtimeNotifs.some((n) => n.id === id)) {
        updateDoc(doc(db, 'notifications', id), {
          read: true,
          updatedAt: serverTimestamp(),
        }).catch((err) => {
          console.warn('Realtime markAsRead Firestore sync notice:', err);
        });
      }
    },
    [firebaseUser, realtimeNotifs]
  );

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      allNotifications.forEach((n) => next.add(n.id));
      saveStoredReadIds(next);
      return next;
    });
    setCustomNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    setRealtimeNotifs((prev) => prev.map((n) => ({ ...n, read: true })));

    if (firebaseUser && realtimeNotifs.length > 0) {
      const unreadList = realtimeNotifs.filter((n) => !n.read);
      if (unreadList.length > 0) {
        const batch = writeBatch(db);
        for (const item of unreadList) {
          batch.update(doc(db, 'notifications', item.id), {
            read: true,
            updatedAt: serverTimestamp(),
          });
        }
        batch.commit().catch((err) => {
          console.warn('Realtime markAllAsRead Firestore sync notice:', err);
        });
      }
    }
  }, [allNotifications, firebaseUser, realtimeNotifs]);

  const deleteNotification = useCallback(
    (id: string) => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveStoredDismissedIds(next);
        return next;
      });
      setCustomNotifs((prev) => {
        const filtered = prev.filter((n) => n.id !== id);
        saveStoredCustomNotifs(filtered);
        return filtered;
      });
      setRealtimeNotifs((prev) => prev.filter((n) => n.id !== id));
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveStoredReadIds(next);
        return next;
      });

      if (firebaseUser && realtimeNotifs.some((n) => n.id === id)) {
        deleteDoc(doc(db, 'notifications', id)).catch((err) => {
          console.warn('Realtime deleteNotification Firestore sync notice:', err);
        });
      }
    },
    [firebaseUser, realtimeNotifs]
  );

  const clearAll = useCallback(() => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      allNotifications.forEach((n) => next.add(n.id));
      saveStoredDismissedIds(next);
      return next;
    });
    setReadIds((prev) => {
      const next = new Set(prev);
      allNotifications.forEach((n) => next.add(n.id));
      saveStoredReadIds(next);
      return next;
    });
    setCustomNotifs([]);
    saveStoredCustomNotifs([]);
    setRealtimeNotifs([]);

    if (firebaseUser && realtimeNotifs.length > 0) {
      const batch = writeBatch(db);
      for (const item of realtimeNotifs) {
        batch.delete(doc(db, 'notifications', item.id));
      }
      batch.commit().catch((err) => {
        console.warn('Realtime clearAll Firestore sync notice:', err);
      });
    }
  }, [allNotifications, firebaseUser, realtimeNotifs]);

  const addNotification = useCallback(
    (item: Omit<AppNotification, 'id' | 'timestamp' | 'read'> & { id?: string }) => {
      const { id: customId, ...rest } = item;
      const resolvedId =
        customId ||
        `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newNotif: AppNotification = {
        ...rest,
        id: resolvedId,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setCustomNotifs((prev) => {
        const next = [newNotif, ...prev.filter((n) => n.id !== resolvedId)];
        saveStoredCustomNotifs(next);
        return next;
      });
    },
    []
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications: allNotifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        addNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }
  return context;
}
