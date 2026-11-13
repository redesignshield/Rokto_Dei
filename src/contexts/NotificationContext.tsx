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
import {
  DEMO_BLOOD_REQUESTS,
  DEMO_REQUEST_PLEDGES,
} from '../data/removableDemoData';
import type { AppView, BloodGroup, NotificationType, RequestPledge } from '../types';

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
    item: Omit<AppNotification, 'id' | 'timestamp' | 'read'>
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
  const { firebaseUser, isEmailVerified, ownDonor, demoMode } = useAuth();
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
          handleFirestoreError(error, OperationType.LIST, 'notifications');
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

    // 3. Demo / Contextual Blood Request Alerts (Only when Demo Mode is explicitly enabled)
    if (demoMode) {
      // Demo pledge on request
      const pledgeSeed = DEMO_REQUEST_PLEDGES[0];
      if (pledgeSeed) {
        list.push({
          id: 'notif_demo_pledge_01',
          type: 'pledge_received',
          titleBn: 'নতুন রক্তদাতা ১ ব্যাগ রক্ত দিতে আগ্রহী!',
          titleEn: 'Donor Offered 1 Bag of Blood!',
          messageBn: `${pledgeSeed.donorName} (${pledgeSeed.donorBloodGroup}) আপনার ৩ ব্যাগের অনুরোধে ১ ব্যাগ রক্ত দিতে সম্মতি জানিয়েছেন। ডোনারের প্রোফাইল দেখতে ক্লিক করুন।`,
          messageEn: `${pledgeSeed.donorName} (${pledgeSeed.donorBloodGroup}) offered to donate 1 bag for your request. Click to view full donor profile.`,
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          read: readIds.has('notif_demo_pledge_01'),
          targetView: 'blood_requests',
          targetId: pledgeSeed.requestId,
          targetDonorUid: pledgeSeed.donorUid || 'demo_donor_01',
          urgency: 'urgent',
          metadata: {
            donorName: pledgeSeed.donorName,
            donorUid: pledgeSeed.donorUid || 'demo_donor_01',
            bloodGroup: pledgeSeed.donorBloodGroup,
            hospitalName: pledgeSeed.hospitalName,
            requestId: pledgeSeed.requestId,
            units: 1,
            totalUnits: 3,
            pledgeMessage: pledgeSeed.message,
          },
        });
      }

      // Demo donor booked notification (Call locked)
      const bookedReq = DEMO_BLOOD_REQUESTS.find((r) => r.status === 'booked');
      if (bookedReq) {
        list.push({
          id: 'notif_demo_booked_01',
          type: 'donor_booked',
          titleBn: 'ডোনার বুকড — নতুন কল বন্ধ করা হয়েছে',
          titleEn: 'Donor Booked — Calls Locked',
          messageBn: `${bookedReq.hospitalName}-এর অনুরোধে ডোনার চূড়ান্ত হওয়ায় নতুন কল বন্ধ রাখা হয়েছে।`,
          messageEn: `A donor has been booked for the request at ${bookedReq.hospitalName}. Incoming calls are paused.`,
          timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
          read: readIds.has('notif_demo_booked_01'),
          targetView: 'blood_requests',
          targetId: bookedReq.id,
          urgency: 'info',
          metadata: {
            hospitalName: bookedReq.hospitalName,
            bloodGroup: bookedReq.bloodGroup,
            requestId: bookedReq.id,
          },
        });
      }

      // Demo Emergency Request Alert
      const emergencyReq = DEMO_BLOOD_REQUESTS.find(
        (r) => r.urgency === 'emergency' && r.status === 'open'
      );
      if (emergencyReq) {
        list.push({
          id: 'notif_demo_emergency_01',
          type: 'emergency_alert',
          titleBn: `জরুরি ${emergencyReq.bloodGroup} রক্তের প্রয়োজন!`,
          titleEn: `Emergency ${emergencyReq.bloodGroup} Blood Needed!`,
          messageBn: `${emergencyReq.hospitalName}-এ আজই ${emergencyReq.units} ব্যাগ ${emergencyReq.bloodGroup} রক্ত প্রয়োজন। যোগাযোগ করুন।`,
          messageEn: `${emergencyReq.units} bag(s) of ${emergencyReq.bloodGroup} blood needed today at ${emergencyReq.hospitalName}.`,
          timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
          read: readIds.has('notif_demo_emergency_01'),
          targetView: 'blood_requests',
          targetId: emergencyReq.id,
          urgency: 'emergency',
          metadata: {
            hospitalName: emergencyReq.hospitalName,
            bloodGroup: emergencyReq.bloodGroup,
            requestId: emergencyReq.id,
          },
        });
      }
    }

    return list;
  }, [firebaseUser, ownDonor, demoMode, readIds]);

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
    (item: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
      const newNotif: AppNotification = {
        ...item,
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setCustomNotifs((prev) => {
        const next = [newNotif, ...prev];
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
