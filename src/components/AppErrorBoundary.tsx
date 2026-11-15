import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import type { AppLanguage } from '../types';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  variant?: 'app' | 'inline';
  lang?: AppLanguage;
  fallbackTitleBn?: string;
  fallbackTitleEn?: string;
  fallbackMessageBn?: string;
  fallbackMessageEn?: string;
  onReset?: () => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Unexpected rendering error';
    return {
      hasError: true,
      errorMessage: message,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('UI ErrorBoundary caught an error:', error, info?.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    this.props.onReset?.();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, errorMessage: '' });
    try {
      if (window.location.pathname !== '/') {
        window.history.replaceState(null, '', '/');
      }
      window.location.reload();
    } catch {
      // Fallback no-op
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const lang = this.props.lang || 'bn';
    const isInline = this.props.variant === 'inline';

    if (isInline) {
      const title =
        lang === 'bn'
          ? this.props.fallbackTitleBn || 'এই অংশটি সাময়িকভাবে লোড করা যায়নি'
          : this.props.fallbackTitleEn || 'This section could not be loaded';
      const desc =
        lang === 'bn'
          ? this.props.fallbackMessageBn ||
            'নেটওয়ার্ক বা ডিভাইস সীমাবদ্ধতার কারণে এটি প্রদর্শনে সমস্যা হয়েছে। আপনি নিচের তালিকা ও অন্যান্য ফিচার স্বাভাবিকভাবে ব্যবহার করতে পারবেন।'
          : this.props.fallbackMessageEn ||
            'A temporary display or network restriction occurred here. All other features and donor lists remain fully usable.';

      return (
        <div
          role="alert"
          className="w-full h-full min-h-[240px] flex flex-col items-center justify-center p-6 text-center bg-[#FAF8F9] text-[#1F242D] space-y-3"
        >
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">{desc}</p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="min-h-[38px] px-4 py-1.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'আবার চেষ্টা করুন' : 'Retry'}</span>
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen w-full bg-[#FAF8F9] text-[#1F242D] flex items-center justify-center p-5">
        <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 p-6 sm:p-7 shadow-xl space-y-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#FDF2F4] border border-[#FADCE2] text-[#C80828] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-lg font-bold text-[#1F242D]">
              {lang === 'bn'
                ? 'অ্যাপ প্রদর্শনে সাময়িক ত্রুটি হয়েছে'
                : 'Something went wrong'}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              {lang === 'bn'
                ? 'সাদা স্ক্রিন এড়াতে রক্তদেই নিরাপত্তা ব্যবস্থা চালু হয়েছে। নিচের বাটনে ট্যাপ করে অ্যাপটি পুনরায় চালু করুন।'
                : 'Rokto Dei prevented a blank screen crash. Tap below to reload cleanly.'}
            </p>
          </div>

          {this.state.errorMessage && (
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-[11px] font-mono text-neutral-600 break-words text-left max-h-24 overflow-y-auto">
              {this.state.errorMessage.slice(0, 220)}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex-1 min-h-[46px] px-4 py-2.5 bg-[#C80828] hover:bg-[#A3051E] text-white text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{lang === 'bn' ? 'পুনরায় চেষ্টা করুন' : 'Try Again'}</span>
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="flex-1 min-h-[46px] px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>{lang === 'bn' ? 'হোম পেজে যান' : 'Reload App'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
