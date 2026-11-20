import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, AtSign, Eye, EyeOff, ArrowRight, Globe, Sun, Moon } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';

export const SignUpPage: React.FC = () => {
  const { register, login, setPendingVerificationEmail, resendVerificationEmail } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !email || !password) {
      setError(t('errRequiredFields'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('errPasswordMismatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('errPasswordTooShort'));
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const newUser = await register(email, password, name, username);
      showToast(t('authSuccessRegister'));
      navigate(newUser.emailVerified === false ? '/auth/verify' : '/feed');
    } catch (signupError) {
      const message = signupError instanceof Error ? signupError.message : '';
      if (message.includes('An account with this email already exists')) {
        const normalizedEmail = email.trim().toLowerCase();

        // First distinguish an already-confirmed account from an unverified one.
        // Supabase can return HTTP 200 for resend without sending anything when
        // the address is already confirmed, so do not show a false success.
        try {
          const existingUser = await login(normalizedEmail, password);
          showToast(t('authSuccessLogin'));
          navigate(existingUser.emailVerified === false ? '/auth/verify' : '/feed', { replace: true });
          return;
        } catch (loginError) {
          const loginMessage = loginError instanceof Error ? loginError.message : '';
          if (/email not confirmed/i.test(loginMessage)) {
            try {
              await resendVerificationEmail(normalizedEmail);
              setPendingVerificationEmail(normalizedEmail);
              showToast(t('verificationEmailSent'));
              navigate('/auth/verify');
            } catch (resendError) {
              const resendMessage = resendError instanceof Error
                ? resendError.message
                : t('verificationSendFailed');
              setError(resendMessage);
            }
            return;
          }

          if (/invalid login credentials|invalid email or password/i.test(loginMessage)) {
            setError(language === 'ar'
              ? 'هذا البريد مسجل بالفعل. سجّل الدخول أو استخدم خيار استعادة كلمة المرور.'
              : 'An account with this email already exists. Sign in or use password recovery.');
          } else {
            setError(loginMessage || (language === 'ar'
              ? 'هذا البريد مسجل بالفعل. سجّل الدخول أو استخدم خيار استعادة كلمة المرور.'
              : 'An account with this email already exists. Sign in or use password recovery.'));
          }
        }
        return;
      }
      setError(message || t('errCreateAccountFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-bg text-fg flex flex-col justify-center items-center p-4 selection:bg-violet-600 selection:text-white relative">
      {/* Top right language & theme toggle */}
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
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Logo size="lg" showTagline />
          </div>
          <h1 className="text-2xl font-black text-fg tracking-tight">{t('signUpTitle')}</h1>
          <p className="text-xs sm:text-sm text-fg-muted">{t('signUpSubtitle')}</p>
        </div>

        <form onSubmit={handleSignUp} className="p-6 rounded-3xl bg-surface border border-border shadow-card space-y-3.5">
          <Input
            label={t('displayName')}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('signUpNamePlaceholder')}
            leftIcon={<User className="w-4 h-4" />}
            required
          />

          <Input
            label={t('usernameLabel')}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="tariq_m"
            leftIcon={<AtSign className="w-4 h-4" />}
            required
          />

          <Input
            label={t('emailLabel')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tariq@example.com"
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <div className="space-y-1.5 text-start">
            <label className="text-xs font-semibold text-fg-muted">{t('passwordLabel')}</label>
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

          <Input
            label={t('confirmPasswordLabel')}
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />

          {error && <p className="text-xs text-danger-text font-semibold">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            rightIcon={<ArrowRight className="w-4 h-4 rtl:rotate-180" />}
            className="shadow-vortex-glow mt-2"
          >
            {t('signup')}
          </Button>
        </form>

        <p className="text-center text-xs text-fg-muted">
          {t('alreadyHaveAccount')}{' '}
          <Link to="/auth/signin" className="font-bold text-primary-text hover:underline">
            {t('login')}
          </Link>
        </p>
      </div>
    </div>
  );
};
