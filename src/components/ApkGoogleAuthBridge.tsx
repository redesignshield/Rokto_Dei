import React, { useCallback, useEffect, useState } from 'react';
import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  type UserCredential,
} from 'firebase/auth';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../firebase';

const APK_BRIDGE_NONCE_KEY = 'roktodei_apk_bridge_nonce';
const APK_BRIDGE_SCHEME_KEY = 'roktodei_apk_bridge_scheme';
const SAFE_SCHEME_REGEX = /^[a-z][a-z0-9.]{2,64}$/i;
const SAFE_NONCE_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;

interface BridgeParams {
  isBridge: boolean;
  nonce: string;
  scheme: string;
}

export function getApkGoogleAuthBridgeParams(): BridgeParams {
  if (typeof window === 'undefined') {
    return { isBridge: false, nonce: '', scheme: 'com.roktodei.app' };
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const isBridge = params.get('apk_google_auth') === '1';
    const rawNonce = params.get('nonce')?.trim() || '';
    const rawScheme = params.get('scheme')?.trim() || 'com.roktodei.app';
    const nonce = SAFE_NONCE_REGEX.test(rawNonce) ? rawNonce : '';
    const scheme = SAFE_SCHEME_REGEX.test(rawScheme)
      ? rawScheme
      : 'com.roktodei.app';
    return { isBridge, nonce, scheme };
  } catch {
    return { isBridge: false, nonce: '', scheme: 'com.roktodei.app' };
  }
}

function buildAppReturnUri(
  scheme: string,
  nonce: string,
  idToken?: string | null,
  accessToken?: string | null
): string {
  const hashParams = new URLSearchParams();
  if (idToken) hashParams.set('id_token', idToken);
  if (accessToken) hashParams.set('access_token', accessToken);
  if (nonce) hashParams.set('nonce', nonce);
  return `${scheme}://auth#${hashParams.toString()}`;
}

export function ApkGoogleAuthBridge() {
  const [{ nonce, scheme }] = useState(() => getApkGoogleAuthBridgeParams());
  const [status, setStatus] = useState<
    'ready' | 'authenticating' | 'returning' | 'error'
  >('ready');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [returnUri, setReturnUri] = useState<string>('');

  const completeWithCredentialResult = useCallback(
    (result: UserCredential, activeNonce: string, activeScheme: string) => {
      const oauthCred = GoogleAuthProvider.credentialFromResult(result);
      const idToken = oauthCred?.idToken || null;
      const accessToken = oauthCred?.accessToken || null;

      if (!idToken && !accessToken) {
        setStatus('error');
        setErrorMsg(
          'Google থেকে ওথেনটিকেশন টোকেন পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'
        );
        return;
      }

      const uri = buildAppReturnUri(activeScheme, activeNonce, idToken, accessToken);
      setReturnUri(uri);
      setStatus('returning');

      try {
        window.sessionStorage.removeItem(APK_BRIDGE_NONCE_KEY);
        window.sessionStorage.removeItem(APK_BRIDGE_SCHEME_KEY);
      } catch {
        // ignore storage errors
      }

      window.location.replace(uri);
    },
    []
  );

  // Resume redirect result if Chrome Custom Tab used redirect flow
  useEffect(() => {
    let active = true;
    getRedirectResult(auth)
      .then((res) => {
        if (!active || !res) return;
        let activeNonce = nonce;
        let activeScheme = scheme;
        try {
          activeNonce =
            activeNonce ||
            window.sessionStorage.getItem(APK_BRIDGE_NONCE_KEY) ||
            '';
          activeScheme =
            window.sessionStorage.getItem(APK_BRIDGE_SCHEME_KEY) || activeScheme;
        } catch {
          // ignore
        }
        completeWithCredentialResult(res, activeNonce, activeScheme);
      })
      .catch((err) => {
        if (!active) return;
        setStatus('error');
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Google লগইন সম্পন্ন করা যায়নি।'
        );
      });

    return () => {
      active = false;
    };
  }, [completeWithCredentialResult, nonce, scheme]);

  const startGoogleSignIn = useCallback(async () => {
    setErrorMsg(null);
    setStatus('authenticating');

    try {
      if (nonce) {
        window.sessionStorage.setItem(APK_BRIDGE_NONCE_KEY, nonce);
      }
      window.sessionStorage.setItem(APK_BRIDGE_SCHEME_KEY, scheme);
    } catch {
      // ignore storage errors
    }

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      completeWithCredentialResult(cred, nonce, scheme);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      setStatus('error');
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Google লগইন বাতিল হয়েছে বা সম্পন্ন করা যায়নি।'
      );
    }
  }, [completeWithCredentialResult, nonce, scheme]);

  return (
    <div className="min-h-screen w-full bg-[#FAF8F9] text-[#1F242D] flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 shadow-xl overflow-hidden">
        <div className="bg-[#C80828] text-white px-6 py-6 text-center space-y-2">
          <img
            src="/logo.png"
            alt="রক্তদেই"
            className="w-14 h-14 object-contain rounded-2xl bg-white p-1 mx-auto shadow-md"
          />
          <h1 className="text-lg font-bold">রক্তদেই Google লগইন</h1>
          <p className="text-xs text-white/90">
            অ্যান্ড্রয়েড অ্যাপের জন্য নিরাপদ Chrome যাচাইকরণ
          </p>
        </div>

        <div className="p-6 space-y-4 text-center">
          {status === 'returning' && returnUri ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-neutral-900">
                  Google লগইন সফল হয়েছে!
                </h2>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  স্বয়ংক্রিয়ভাবে রক্তদেই অ্যাপে ফিরে না গেলে নিচের বাটনে ট্যাপ করুন।
                </p>
              </div>
              <a
                href={returnUri}
                className="w-full min-h-[48px] px-4 py-2.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>রক্তদেই অ্যাপে ফিরে যান</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </>
          ) : (
            <>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                আপনার Google অ্যাকাউন্ট নির্বাচন করে নিরাপদে লগইন করুন। লগইন শেষ হলেই স্বয়ংক্রিয়ভাবে আপনি অ্যাপে ফিরে আসবেন।
              </p>

              {errorMsg && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 text-left leading-relaxed"
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                disabled={status === 'authenticating'}
                onClick={() => void startGoogleSignIn()}
                className="w-full min-h-[48px] px-4 py-2.5 bg-[#1F242D] hover:bg-neutral-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {status === 'authenticating' && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <span>
                  {status === 'authenticating'
                    ? 'Google যাচাই চলছে...'
                    : 'Google দিয়ে চালিয়ে যান'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
