import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { router } from './router';
import { ThemeProvider } from '../context/ThemeContext';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { isSupabaseConfigured } from '../services';
import { VersionUpdateManager } from '../components/layout/VersionUpdateManager';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode; labels: { title: string; description: string; reload: string } },
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
      const { labels } = this.props;
      return (
        <main className="min-h-[100dvh] bg-bg text-fg flex items-center justify-center p-6">
          <section role="alert" className="w-full max-w-xl rounded-2xl border border-rose-500/30 bg-surface-elevated p-6 shadow-2xl">
            <h1 className="text-xl font-bold">{labels.title}</h1>
            <p className="mt-3 text-sm leading-7 text-fg-muted">
              {labels.description}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:from-violet-500 hover:to-blue-500 shadow-md"
            >
              {labels.reload}
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const Application: React.FC = () => {
  const { t } = useLanguage();
  if (import.meta.env.PROD && !isSupabaseConfigured()) {
    return (
      <main className="min-h-[100dvh] bg-bg text-fg flex items-center justify-center p-6">
        <section role="alert" className="w-full max-w-xl rounded-2xl border border-rose-500/30 bg-surface-elevated p-6 shadow-2xl">
          <h1 className="text-xl font-bold">{t('notConfiguredTitle')}</h1>
          <p className="mt-3 text-sm leading-7 text-fg-muted">
            {t('notConfiguredDescription')}
          </p>
        </section>
      </main>
    );
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <AppErrorBoundary labels={{ title: t('appErrorTitle'), description: t('appErrorDescription'), reload: t('reloadApp') }}>
          <MotionConfig reducedMotion="user">
            <RouterProvider router={router} />
            <VersionUpdateManager />
          </MotionConfig>
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
