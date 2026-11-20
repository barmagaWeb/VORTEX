import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail, RefreshCw, Globe, Sun, Moon } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';

export const VerifyEmailPage: React.FC = () => {
  const {
    user,
    pendingEmail,
    setPendingVerificationEmail,
    resendVerificationEmail,
    refreshCurrentUser,
  } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState(pendingEmail || user?.email || '');
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (pendingEmail) setEmail(pendingEmail);
    else if (user?.email) setEmail(user.email);
  }, [pendingEmail, user?.email]);

  const handleResend = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError(t('verificationEmailRequired'));
      return;
    }

    setError('');
    setIsSending(true);
    try {
      await resendVerificationEmail(normalizedEmail);
      setPendingVerificationEmail(normalizedEmail);
      setSent(true);
      showToast(t('verificationEmailSent'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('verificationSendFailed'));
    } finally {
      setIsSending(false);
    }
  };

  const handleCheckVerification = async () => {
    setError('');
    setIsChecking(true);
    try {
      const refreshedUser = await refreshCurrentUser();
      if (refreshedUser && refreshedUser.emailVerified !== false) {
        showToast(t('authSuccessLogin'));
        navigate('/feed', { replace: true });
      } else {
        setError(t('verificationStillPending'));
      }
    } catch {
      setError(t('verificationStillPending'));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-bg text-fg flex flex-col justify-center items-center p-4 selection:bg-violet-600 selection:text-white relative">
      <div className="absolute top-4 end-4 flex items-center gap-2">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
          aria-label={t('toggleLanguage')}
        >
          <Globe className="w-4 h-4 text-primary" />
          <span>{language === 'en' ? 'العربية' : 'English'}</span>
        </button>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
          title={t('toggleTheme')}
          aria-label={t('toggleTheme')}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
        </button>
      </div>

      <div className="w-full max-w-md space-y-6 my-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <Logo size="lg" showTagline />
          </div>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-fg tracking-tight">{t('verifyEmailTitle')}</h1>
          <p className="text-xs sm:text-sm text-fg-muted">{t('verifyEmailSubtitle')}</p>
        </div>

        <div className="p-6 rounded-3xl bg-surface border border-border shadow-card space-y-4">
          {sent && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{t('verificationEmailSent')}</span>
            </div>
          )}

          <form onSubmit={handleResend} className="space-y-4">
            <Input
              label={t('emailLabel')}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@domain.com"
              leftIcon={<Mail className="h-4 w-4" />}
              required
            />
            {error && <p role="alert" className="text-xs font-semibold text-danger-text">{error}</p>}
            <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isSending} className="shadow-vortex-glow">
              <RefreshCw className="me-2 h-4 w-4" />
              {t('resendVerificationEmail')}
            </Button>
          </form>

          <div className="border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              isLoading={isChecking}
              onClick={handleCheckVerification}
            >
              {t('verificationCheckAgain')}
            </Button>
          </div>
        </div>

        <div className="text-center">
          <Link to="/auth/signin" className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted hover:text-fg transition-colors">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            <span>{t('verificationBackToSignIn')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
