import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';

export const NotFoundPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-[100dvh] bg-bg text-fg flex flex-col items-center justify-center p-6">
      <div className="mb-8">
        <Logo size="lg" />
      </div>

      <div className="max-w-md w-full text-center space-y-4 bg-surface border border-border rounded-2xl p-8 shadow-card">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-2xl">
          404
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-fg">
          {t('notFoundTitle')}
        </h1>
        <p className="text-sm text-fg-muted leading-relaxed">
          {t('notFoundDescription')}
        </p>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/" className="w-full sm:w-auto">
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              leftIcon={<Home className="w-4 h-4" />}
            >
              {t('goHome')}
            </Button>
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-border bg-surface-elevated hover:bg-surface-hover text-fg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            <span>{t('goBack')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
