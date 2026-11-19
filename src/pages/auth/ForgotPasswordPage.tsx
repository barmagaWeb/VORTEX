import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { authService } from '../../services';
import { useLanguage } from '../../context/LanguageContext';

export const ForgotPasswordPage: React.FC = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    try {
      await authService.requestPasswordReset(email);
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-vortex-dark-bg text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-violet-600 selection:text-white">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Logo size="lg" showTagline />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{t('forgotPasswordTitle')}</h1>
          <p className="text-xs sm:text-sm text-slate-400">{t('forgotPasswordSubtitle')}</p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl space-y-4">
          {isSubmitted ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Instructions Dispatched</h3>
              <p className="text-xs text-slate-300">
                We sent password recovery instructions to <span className="font-semibold text-violet-300">{email}</span>.
              </p>
              <div className="pt-2">
                <Link to="/auth/reset">
                  <Button variant="primary" size="sm" fullWidth>
                    Proceed to Reset Password Screen (Demo)
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label={t('emailLabel')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
                className="shadow-vortex-glow"
              >
                {t('sendResetLink')}
              </Button>
            </form>
          )}
        </div>

        <div className="text-center">
          <Link
            to="/auth/signin"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to sign in</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await authService.resetPassword(password);
      setIsSuccess(true);
    } catch {
      setError('Could not update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-vortex-dark-bg text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-violet-600 selection:text-white">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Logo size="lg" showTagline />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{t('resetPasswordTitle')}</h1>
          <p className="text-xs sm:text-sm text-slate-400">{t('resetPasswordSubtitle')}</p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl space-y-4">
          {isSuccess ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Password Updated!</h3>
              <p className="text-xs text-slate-300">{t('passwordResetSuccess')}</p>
              <div className="pt-2">
                <Link to="/auth/signin">
                  <Button variant="primary" size="md" fullWidth>
                    {t('login')}
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <Input
                label={t('passwordLabel')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (min 6 characters)"
                required
              />
              <Input
                label={t('confirmPasswordLabel')}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
              {error && <p className="text-xs text-rose-400 font-semibold">{error}</p>}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
                className="shadow-vortex-glow"
              >
                {t('resetPasswordBtn')}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
