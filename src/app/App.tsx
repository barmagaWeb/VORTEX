import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ThemeProvider } from '../context/ThemeContext';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { isSupabaseConfigured } from '../services';


class AppErrorBoundary extends React.Component<
  { children: React.ReactNode; language: 'ar' | 'en' },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Keep diagnostics local; never expose stack traces or session data in the UI.
    console.error('VORTEX application rendering failed:', error.message);
  }

  render() {
    if (this.state.hasError) {
      const isArabic = this.props.language === 'ar';
      return (
        <main className="min-h-screen bg-vortex-dark-bg text-slate-100 flex items-center justify-center p-6">
          <section role="alert" className="w-full max-w-xl rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl">
            <h1 className="text-xl font-bold">{isArabic ? 'حدث خطأ غير متوقع' : 'Something went wrong'}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {isArabic ? 'تعذر عرض الصفحة. أعد تحميل التطبيق للمتابعة.' : 'The page could not be rendered. Reload the app to continue.'}
            </p>
            <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500">
              {isArabic ? 'إعادة تحميل التطبيق' : 'Reload app'}
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const Application: React.FC = () => {
  const { language } = useLanguage();
  if (import.meta.env.PROD && !isSupabaseConfigured()) {
    const isArabic = language === 'ar';
    return (
      <main className="min-h-screen bg-vortex-dark-bg text-slate-100 flex items-center justify-center p-6">
        <section role="alert" className="w-full max-w-xl rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl">
          <h1 className="text-xl font-bold">{isArabic ? 'إعدادات VORTEX غير مكتملة' : 'VORTEX is not configured'}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {isArabic
              ? 'أضف VITE_SUPABASE_URL وVITE_SUPABASE_ANON_KEY إلى إعدادات البناء ثم أعد النشر. لم يتم تشغيل وضع البيانات التجريبية.'
              : 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your build environment, then redeploy. Demo data mode is disabled in production.'}
          </p>
        </section>
      </main>
    );
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <AppErrorBoundary language={language}>
          <RouterProvider router={router} />
        </AppErrorBoundary>
      </ToastProvider>
    </AuthProvider>
  );
};

export const App: React.FC = () => (
  <ThemeProvider>
    <LanguageProvider>
      <Application />
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
