import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight, ShieldCheck, Globe, Sun, Moon } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { isSupabaseConfigured } from '../../services';

export const SignInPage: React.FC = () => {
  const { login, setPendingVerificationEmail } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError(t('errEmailOrUsernameRequired'));
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const loggedUser = await login(email, password);
      if (loggedUser.emailVerified === false) {
        navigate('/auth/verify');
      } else {
        showToast(t('authSuccessLogin'));
        navigate('/feed');
      }
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : '';
      if (message.toLowerCase().includes('email not confirmed') || message.toLowerCase().includes('email not verified')) {
        setPendingVerificationEmail(email);
        navigate('/auth/verify');
      } else {
        const isInvalidCredentials = /invalid login credentials|invalid credentials/i.test(message);
        setError(isInvalidCredentials
          ? t('errInvalidCredentials')
          : (message || t('errSignInFailed')));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSignIn = async (type: 'user' | 'admin') => {
    setIsLoading(true);
    try {
      const loggedUser = type === 'admin'
        ? await login('elena_admin@vortex.social')
        : await login('ahmedmohamed@vortex.social');
      if (loggedUser.emailVerified === false) {
        navigate('/auth/verify');
      } else {
        showToast(type === 'admin' ? t('toastSignedInAdmin') : t('toastSignedInUser'));
        navigate('/feed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-bg text-fg flex flex-col justify-center items-center p-4 selection:bg-violet-600 selection:text-white relative">
      {/* Top right language & theme toggle for logged-out views */}
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
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Logo size="lg" showTagline />
          </div>
          <h1 className="text-2xl font-black text-fg tracking-tight">{t('signInTitle')}</h1>
          <p className="text-xs sm:text-sm text-fg-muted">{t('signInSubtitle')}</p>
        </div>

        {/* Demo Fast Track Pill */}
        {!isSupabaseConfigured() && (
          <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-primary-text font-semibold">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{t('demoNotice')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleQuickSignIn('user')}
                className="text-xs"
              >
                {t('quickSignInUser')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSignIn('admin')}
                leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-primary" />}
                className="text-xs text-primary-text border-primary/30"
              >
                {t('quickSignInAdmin')}
              </Button>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSignIn} className="p-6 rounded-3xl bg-surface border border-border shadow-card space-y-4">
          <Input
            label={t('emailLabel')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <div className="space-y-1.5 text-start">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-fg-muted">{t('passwordLabel')}</label>
              <Link to="/auth/forgot" className="text-xs font-semibold text-primary-text hover:underline">
                {t('forgotPasswordLink')}
              </Link>
            </div>
            <div className="relative flex items-center">
              <div className="absolute start-3.5 text-fg-subtle pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface text-fg placeholder:text-fg-subtle text-sm rounded-xl border border-border hover:border-fg-subtle/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 ps-10 pe-10 py-2.5 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3.5 text-fg-subtle hover:text-fg p-1"
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-danger-text font-semibold">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            rightIcon={<ArrowRight className="w-4 h-4 rtl:rotate-180" />}
            className="shadow-vortex-glow mt-1"
          >
            {t('login')}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-fg-muted">
          {t('dontHaveAccount')}{' '}
          <Link to="/auth/signup" className="font-bold text-primary-text hover:underline">
            {t('signup')}
          </Link>
        </p>
      </div>
    </div>
  );
};
