import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import {
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile,
  verifyPasswordResetCode,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_SUPER_ADMIN_EMAIL,
  googleProvider,
} from '../firebase';
import {
  clearVerifiedProfileCache,
  ensureUserProfile,
  getAdminRoleForUser,
  getOwnDonorBundle,
} from '../services/roktoService';
import { isOfflineError } from '../lib/firestoreError';
import { isNativeCapacitorShell } from '../lib/platform';
import type {
  AdminRoleType,
  AppLanguage,
  DonorProfile,
  UserProfile,
} from '../types';

export const APK_GOOGLE_BRIDGE_UNAVAILABLE_CODE =
  'APK_GOOGLE_BRIDGE_UNAVAILABLE';

function resolveApkAuthBridgeOrigin(): string {
  const raw = (
    (import.meta as { env?: Record<string, string | undefined> }).env
      ?.VITE_API_BASE_URL || ''
  )
    .trim()
    .replace(/\/+$/, '');
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    if (/^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

function generateAuthNonce(): string {
  try {
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Fallback below
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  ownDonor: DonorProfile | null;
  ownDonorPhone: string;
  isAuthReady: boolean;
  isEmailVerified: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminRole: AdminRoleType | null;
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  loginWithGoogle: () => Promise<void>;
  registerWithEmail: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshVerificationState: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<void>;
  verifyResetCode: (oobCode: string) => Promise<string>;
  confirmResetPassword: (oobCode: string, newPassword: string) => Promise<void>;
  applyEmailVerificationCode: (oobCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshOwnProfileAndDonor: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function formatFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Firebase Console-এ এখনো Email/Password প্রোভাইডার চালু করা হয়নি। Firebase Console → Authentication → Sign-in method থেকে Email/Password চালু করুন।';
    case 'auth/email-already-in-use':
      return 'এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট খোলা আছে। অনুগ্রহ করে লগইন করুন অথবা পাসওয়ার্ড ভুলে গেলে রিসেট করুন।';
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'সঠিক ইমেইল ঠিকানা লিখুন।';
    case 'auth/weak-password':
      return 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।';
    case 'auth/user-disabled':
      return 'এই অ্যাকাউন্টটি সাময়িকভাবে নিষ্ক্রিয় করা হয়েছে।';
    case 'auth/too-many-requests':
      return 'অতিরিক্তবার চেষ্টার কারণে সাময়িকভাবে ব্লক হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
    case 'auth/network-request-failed':
      return 'ইন্টারনেট সংযোগে সমস্যা হয়েছে। নেটওয়ার্ক যাচাই করে আবার চেষ্টা করুন।';
    case 'auth/expired-action-code':
      return 'রিসেট বা ভেরিফিকেশন লিংকটির মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে নতুন লিংক পাঠান।';
    case 'auth/invalid-action-code':
      return 'এই লিংকটি সঠিক নয় অথবা ইতিমধ্যে ব্যবহৃত হয়েছে। অনুগ্রহ করে নতুন লিংক অনুরোধ করুন।';
    case 'auth/popup-closed-by-user':
      return 'Google লগইন পপআপটি বন্ধ করা হয়েছে। আবার চেষ্টা করুন।';
    case 'auth/unauthorized-domain':
      return 'এই ডোমেইনটি Firebase Authentication → Authorized domains তালিকায় যুক্ত নেই।';
    case 'auth/operation-not-supported-in-this-environment':
      return 'এই অ্যাপ ব্রাউজার/WebView-তে Google পপআপ সাপোর্ট করছে না। অনুগ্রহ করে ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।';
    default:
      return error instanceof Error
        ? error.message
        : 'প্রমাণীকরণে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [ownDonor, setOwnDonor] = useState<DonorProfile | null>(null);
  const [ownDonorPhone, setOwnDonorPhone] = useState<string>('');
  const [adminRole, setAdminRole] = useState<AdminRoleType | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [lang, setLang] = useState<AppLanguage>('bn');
  const [verificationTick, setVerificationTick] = useState(0);

  const syncInFlightRef = useRef<{
    uid: string;
    promise: Promise<void>;
  } | null>(null);

  const pendingApkGoogleAuthRef = useRef<{
    nonce: string;
    resolve: () => void;
    reject: (err: Error) => void;
    timeoutId: number;
  } | null>(null);

  const syncUserRecords = useCallback(async (user: User | null) => {
    if (!user) {
      clearVerifiedProfileCache();
      syncInFlightRef.current = null;
      setUserProfile(null);
      setOwnDonor(null);
      setOwnDonorPhone('');
      setAdminRole(null);
      return;
    }

    if (!user.emailVerified) {
      syncInFlightRef.current = null;
      setUserProfile(null);
      setOwnDonor(null);
      setOwnDonorPhone('');
      setAdminRole(null);
      return;
    }

    if (syncInFlightRef.current?.uid === user.uid) {
      return syncInFlightRef.current.promise;
    }

    const resolvedEmail = user.email || user.providerData[0]?.email || '';

    const runSync = (async () => {
      try {
        const isBootstrapped =
          resolvedEmail.toLowerCase() ===
          BOOTSTRAPPED_SUPER_ADMIN_EMAIL.toLowerCase();

        if (isBootstrapped) {
          setAdminRole('admin');
        }

        const profilePromise = ensureUserProfile({
          uid: user.uid,
          email: resolvedEmail,
          displayName: user.displayName || '',
        });

        const [profile, donorBundle, roleDoc] = await Promise.all([
          profilePromise,
          getOwnDonorBundle(user.uid),
          isBootstrapped ? Promise.resolve(null) : getAdminRoleForUser(user.uid),
        ]);

        setUserProfile(profile);
        if (profile.preferredLanguage) {
          setLang(profile.preferredLanguage);
        }

        setOwnDonor(donorBundle.donor);
        setOwnDonorPhone(donorBundle.phoneNumber);

        if (isBootstrapped) {
          setAdminRole('admin');
        } else if (roleDoc) {
          setAdminRole(roleDoc.role);
        } else {
          setAdminRole(null);
        }
      } catch (err) {
        if (!isOfflineError(err)) {
          console.error('Profile synchronization error:', err);
        } else {
          console.warn('Profile synchronization notice (offline / initial connection):', err);
        }
        setUserProfile((prev) => prev || {
          uid: user.uid,
          fullName: user.displayName || (resolvedEmail ? resolvedEmail.split('@')[0] : 'ব্যবহারকারী'),
          email: resolvedEmail,
          accountStatus: 'active',
          preferredLanguage: 'bn',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        if (resolvedEmail.toLowerCase() === BOOTSTRAPPED_SUPER_ADMIN_EMAIL.toLowerCase()) {
          setAdminRole('admin');
        }
      }
    })();

    const trackedPromise = runSync.finally(() => {
      if (syncInFlightRef.current?.promise === trackedPromise) {
        syncInFlightRef.current = null;
      }
    });

    syncInFlightRef.current = { uid: user.uid, promise: trackedPromise };
    return trackedPromise;
  }, []);

  useEffect(() => {
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          setFirebaseUser(res.user);
          setVerificationTick((v) => v + 1);
          void syncUserRecords(res.user);
        }
      })
      .catch((err) => {
        console.warn('OAuth redirect completion notice:', err);
      });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);
      void syncUserRecords(user);
    });
    return () => unsubscribe();
  }, [syncUserRecords]);

  // Listen for Chrome Custom Tab OAuth deep-link callback inside Capacitor APK (com.roktodei.app://auth#...)
  useEffect(() => {
    if (!isNativeCapacitorShell()) return;

    let cancelled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    const clearPending = () => {
      const pending = pendingApkGoogleAuthRef.current;
      if (pending) {
        window.clearTimeout(pending.timeoutId);
        pendingApkGoogleAuthRef.current = null;
      }
      return pending;
    };

    const setupListeners = async () => {
      try {
        const urlHandle = await CapacitorApp.addListener(
          'appUrlOpen',
          async ({ url }) => {
            if (!url || !url.includes('://auth')) return;
            await Browser.close().catch(() => {});

            const hashIdx = url.indexOf('#');
            const queryIdx = url.indexOf('?');
            const rawParams =
              hashIdx >= 0
                ? url.slice(hashIdx + 1)
                : queryIdx >= 0
                ? url.slice(queryIdx + 1)
                : '';
            const params = new URLSearchParams(rawParams);
            const idToken = params.get('id_token');
            const accessToken = params.get('access_token');
            const returnedNonce = params.get('nonce') || '';

            const pending = clearPending();
            if (pending && pending.nonce && returnedNonce !== pending.nonce) {
              pending.reject(
                new Error('নিরাপত্তা যাচাই ব্যর্থ হয়েছে। অনুগ্রহ করে আবার Google লগইন করুন।')
              );
              return;
            }

            if (!idToken && !accessToken) {
              pending?.reject(
                new Error('Google লগইন টোকেন পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।')
              );
              return;
            }

            try {
              const credential = GoogleAuthProvider.credential(
                idToken || null,
                accessToken || null
              );
              const cred = await signInWithCredential(auth, credential);
              setFirebaseUser(cred.user);
              setVerificationTick((v) => v + 1);
              void syncUserRecords(cred.user);
              pending?.resolve();
            } catch (err) {
              pending?.reject(new Error(formatFirebaseAuthError(err)));
            }
          }
        );
        if (cancelled) {
          void urlHandle.remove();
        } else {
          handles.push(urlHandle);
        }

        const browserHandle = await Browser.addListener(
          'browserFinished',
          () => {
            window.setTimeout(() => {
              const pending = pendingApkGoogleAuthRef.current;
              if (pending) {
                clearPending();
                pending.reject(
                  new Error('Google লগইন সম্পন্ন করার আগেই ব্রাউজার বন্ধ করা হয়েছে।')
                );
              }
            }, 750);
          }
        );
        if (cancelled) {
          void browserHandle.remove();
        } else {
          handles.push(browserHandle);
        }
      } catch (err) {
        console.warn('Capacitor OAuth deep-link listener setup notice:', err);
      }
    };

    void setupListeners();

    return () => {
      cancelled = true;
      clearPending();
      for (const h of handles) {
        void h.remove().catch(() => {});
      }
    };
  }, [syncUserRecords]);

  const loginWithGoogle = useCallback(async () => {
    // Native Android Capacitor WebView path: NEVER run signInWithRedirect inside WebView (403 disallowed_useragent)
    if (isNativeCapacitorShell()) {
      const capPlugins = (
        window as unknown as {
          Capacitor?: {
            Plugins?: {
              FirebaseAuthentication?: {
                signInWithGoogle?: () => Promise<{
                  credential?: { idToken?: string; accessToken?: string };
                }>;
              };
            };
          };
        }
      ).Capacitor?.Plugins;

      if (capPlugins?.FirebaseAuthentication?.signInWithGoogle) {
        try {
          const nativeRes =
            await capPlugins.FirebaseAuthentication.signInWithGoogle();
          const idToken = nativeRes?.credential?.idToken || null;
          const accessToken = nativeRes?.credential?.accessToken || null;
          if (idToken || accessToken) {
            const cred = await signInWithCredential(
              auth,
              GoogleAuthProvider.credential(idToken, accessToken)
            );
            setFirebaseUser(cred.user);
            setVerificationTick((v) => v + 1);
            void syncUserRecords(cred.user);
            return;
          }
        } catch (nativeErr) {
          console.warn('Native FirebaseAuthentication fallback notice:', nativeErr);
        }
      }

      const bridgeOrigin = resolveApkAuthBridgeOrigin();
      if (!bridgeOrigin) {
        const bridgeErr = new Error(
          'এই স্বতন্ত্র APK বিল্ডে সরাসরি Google ব্রিজ সার্ভার (APP_URL) যুক্ত না থাকায় Android WebView থেকে Google লগইন ব্লক করা হয়েছে। অনুগ্রহ করে ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন—অথবা নিচের বাটনে ট্যাপ করে আপনার Google ইমেইলের জন্য পাসওয়ার্ড সেট করুন।'
        ) as Error & { code?: string };
        bridgeErr.code = APK_GOOGLE_BRIDGE_UNAVAILABLE_CODE;
        throw bridgeErr;
      }

      const nonce = generateAuthNonce();
      const targetUrl = `${bridgeOrigin}/?apk_google_auth=1&nonce=${encodeURIComponent(
        nonce
      )}&scheme=${encodeURIComponent('com.roktodei.app')}`;

      if (pendingApkGoogleAuthRef.current) {
        window.clearTimeout(pendingApkGoogleAuthRef.current.timeoutId);
        pendingApkGoogleAuthRef.current = null;
      }

      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          if (pendingApkGoogleAuthRef.current?.nonce === nonce) {
            pendingApkGoogleAuthRef.current = null;
            reject(
              new Error('Google লগইনের সময়সীমা শেষ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।')
            );
          }
        }, 180_000);

        pendingApkGoogleAuthRef.current = {
          nonce,
          resolve,
          reject,
          timeoutId,
        };

        Browser.open({ url: targetUrl, presentationStyle: 'popover' }).catch(
          (openErr) => {
            if (pendingApkGoogleAuthRef.current?.nonce === nonce) {
              window.clearTimeout(timeoutId);
              pendingApkGoogleAuthRef.current = null;
            }
            reject(
              new Error(
                openErr instanceof Error
                  ? openErr.message
                  : 'Chrome ব্রাউজার চালু করা যায়নি।'
              )
            );
          }
        );
      });
      return;
    }

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      setFirebaseUser(cred.user);
      setVerificationTick((v) => v + 1);
      await syncUserRecords(cred.user);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw new Error(formatFirebaseAuthError(error));
    }
  }, [syncUserRecords]);

  const registerWithEmail = useCallback(
    async (fullName: string, email: string, password: string) => {
      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        if (fullName.trim()) {
          await updateProfile(cred.user, { displayName: fullName.trim() });
        }
        await sendEmailVerification(cred.user);
        setFirebaseUser(cred.user);
        setVerificationTick((v) => v + 1);
      } catch (error) {
        throw new Error(formatFirebaseAuthError(error));
      }
    },
    []
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      try {
        const cred = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        try {
          await Promise.race([
            (async () => {
              await cred.user.reload();
              if (cred.user.emailVerified) {
                await cred.user.getIdToken(true);
              }
            })(),
            new Promise<void>((resolve) => window.setTimeout(resolve, 4500)),
          ]);
        } catch {
          // Non-fatal on slow mobile connections right after sign-in
        }
        const activeUser = auth.currentUser || cred.user;
        setFirebaseUser(activeUser);
        setVerificationTick((v) => v + 1);
        void syncUserRecords(activeUser);
      } catch (error) {
        throw new Error(formatFirebaseAuthError(error));
      }
    },
    [syncUserRecords]
  );

  const resendVerification = useCallback(async () => {
    if (!auth.currentUser) {
      throw new Error('কোনো লগইনকৃত ব্যবহারকারী পাওয়া যায়নি।');
    }
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (error) {
      throw new Error(formatFirebaseAuthError(error));
    }
  }, []);

  const refreshVerificationState = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    const updated = auth.currentUser;
    // Keep the live Firebase User instance (with prototype methods) and bump verificationTick
    setFirebaseUser(updated);
    setVerificationTick((v) => v + 1);
    if (updated?.emailVerified) {
      await syncUserRecords(updated);
      return true;
    }
    return false;
  }, [syncUserRecords]);

  const resetPassword = useCallback(
    async (email: string) => {
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        throw new Error('আপনার অ্যাকাউন্টের ইমেইল ঠিকানা লিখুন।');
      }
      auth.languageCode = lang === 'bn' ? 'bn' : 'en';
      const isPublicWebOrigin =
        typeof window !== 'undefined' &&
        /^https?:\/\//i.test(window.location.origin) &&
        !/localhost|127\.0\.0\.1/i.test(window.location.hostname);

      try {
        if (isPublicWebOrigin) {
          try {
            await sendPasswordResetEmail(auth, cleanEmail, {
              url: window.location.origin,
              handleCodeInApp: false,
            });
            return;
          } catch (innerErr) {
            const innerCode =
              typeof innerErr === 'object' && innerErr !== null && 'code' in innerErr
                ? String((innerErr as { code?: string }).code)
                : '';
            // Fallback to default Firebase hosted action page if continueUrl is rejected
            if (
              innerCode !== 'auth/invalid-continue-uri' &&
              innerCode !== 'auth/unauthorized-continue-uri' &&
              innerCode !== 'auth/missing-continue-uri'
            ) {
              throw innerErr;
            }
          }
        }
        await sendPasswordResetEmail(auth, cleanEmail);
      } catch (error) {
        throw new Error(formatFirebaseAuthError(error));
      }
    },
    [lang]
  );

  const verifyResetCode = useCallback(async (oobCode: string): Promise<string> => {
    try {
      return await verifyPasswordResetCode(auth, oobCode);
    } catch (error) {
      throw new Error(formatFirebaseAuthError(error));
    }
  }, []);

  const confirmResetPassword = useCallback(
    async (oobCode: string, newPassword: string): Promise<void> => {
      try {
        await confirmPasswordReset(auth, oobCode, newPassword);
      } catch (error) {
        throw new Error(formatFirebaseAuthError(error));
      }
    },
    []
  );

  const applyEmailVerificationCode = useCallback(
    async (oobCode: string): Promise<void> => {
      try {
        await applyActionCode(auth, oobCode);
        if (auth.currentUser) {
          await auth.currentUser.reload();
          await auth.currentUser.getIdToken(true);
          setFirebaseUser(auth.currentUser);
          setVerificationTick((v) => v + 1);
          if (auth.currentUser.emailVerified) {
            await syncUserRecords(auth.currentUser);
          }
        }
      } catch (error) {
        throw new Error(formatFirebaseAuthError(error));
      }
    },
    [syncUserRecords]
  );

  const logout = useCallback(async () => {
    clearVerifiedProfileCache();
    syncInFlightRef.current = null;
    await firebaseSignOut(auth);
    setFirebaseUser(null);
    setUserProfile(null);
    setOwnDonor(null);
    setOwnDonorPhone('');
    setAdminRole(null);
  }, []);

  const refreshOwnProfileAndDonor = useCallback(async () => {
    if (auth.currentUser) {
      await syncUserRecords(auth.currentUser);
    }
  }, [syncUserRecords]);

  const isEmailVerified = Boolean(firebaseUser?.emailVerified);
  const isSuperAdmin = Boolean(
    isEmailVerified &&
      firebaseUser?.email?.toLowerCase() ===
        BOOTSTRAPPED_SUPER_ADMIN_EMAIL.toLowerCase()
  );
  const isAdmin = Boolean(isEmailVerified && (isSuperAdmin || adminRole !== null));

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      userProfile,
      ownDonor,
      ownDonorPhone,
      isAuthReady,
      isEmailVerified,
      isAdmin,
      isSuperAdmin,
      adminRole,
      lang,
      setLang,
      loginWithGoogle,
      registerWithEmail,
      loginWithEmail,
      resendVerification,
      refreshVerificationState,
      resetPassword,
      verifyResetCode,
      confirmResetPassword,
      applyEmailVerificationCode,
      logout,
      refreshOwnProfileAndDonor,
    }),
    [
      firebaseUser,
      userProfile,
      ownDonor,
      ownDonorPhone,
      isAuthReady,
      isEmailVerified,
      isAdmin,
      isSuperAdmin,
      adminRole,
      lang,
      verificationTick,
      loginWithGoogle,
      registerWithEmail,
      loginWithEmail,
      resendVerification,
      refreshVerificationState,
      resetPassword,
      verifyResetCode,
      confirmResetPassword,
      applyEmailVerificationCode,
      logout,
      refreshOwnProfileAndDonor,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
