import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { isSupabaseConfigured } from '../../services';

export const SignInPage: React.FC = () => {
  const { login, setPendingVerificationEmail } = useAuth();
  const { t } = useLanguage();
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
      setError('Please provide an email or username');
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
          ? 'Invalid email or password.'
          : (message || 'Unable to sign in. Check your connection and try again.'));
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
        showToast(type === 'admin' ? 'Signed in as Admin Lead (Elena Rostova)' : 'Signed in as Ahmed Mohamed');
        navigate('/feed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-vortex-dark-bg text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-violet-600 selection:text-white">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Logo size="lg" showTagline />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{t('signInTitle')}</h1>
          <p className="text-xs sm:text-sm text-slate-400">{t('signInSubtitle')}</p>
        </div>

        {/* Demo Fast Track Pill */}
        {!isSupabaseConfigured() && <div className="p-3 rounded-2xl bg-violet-950/40 border border-violet-500/30 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-violet-300 font-semibold">
            <Sparkles className="w-4 h-4 text-amber-400" />
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
              leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-violet-400" />}
              className="text-xs text-violet-300 border-violet-500/40"
            >
              {t('quickSignInAdmin')}
            </Button>
          </div>
        </div>}

        {/* Form */}
        <form onSubmit={handleSignIn} className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl space-y-4">
          <Input
            label={t('emailLabel')}
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com or username"
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <div className="space-y-1.5 text-start">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-300">{t('passwordLabel')}</label>
              <Link to="/auth/forgot" className="text-xs font-semibold text-violet-400 hover:text-violet-300">
                {t('forgotPasswordLink')}
              </Link>
            </div>
            <div className="relative flex items-center">
              <div className="absolute start-3.5 text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/90 text-slate-100 text-sm rounded-xl border border-slate-700/80 hover:border-slate-600 focus:border-violet-500 ps-10 pe-10 py-2.5 outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3.5 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-rose-400 font-semibold">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="shadow-vortex-glow"
          >
            {t('login')}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400">
          {t('dontHaveAccount')}{' '}
          <Link to="/auth/signup" className="font-bold text-violet-400 hover:underline">
            {t('signup')}
          </Link>
        </p>
      </div>
    </div>
  );
};
