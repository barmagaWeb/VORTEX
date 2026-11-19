import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, AtSign, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

export const SignUpPage: React.FC = () => {
  const { register } = useAuth();
  const { t } = useLanguage();
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
      setError('Please fill in all required fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const newUser = await register(email, password, name, username);
      showToast(t('authSuccessRegister'));
      navigate(newUser.emailVerified === false ? '/auth/verify' : '/feed');
    } catch {
      setError('Failed to create account');
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
          <h1 className="text-2xl font-black text-white tracking-tight">{t('signUpTitle')}</h1>
          <p className="text-xs sm:text-sm text-slate-400">{t('signUpSubtitle')}</p>
        </div>

        <form onSubmit={handleSignUp} className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl space-y-3.5">
          <Input
            label={t('displayName')}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tariq Mansoor"
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
            <label className="text-xs font-semibold text-slate-300">{t('passwordLabel')}</label>
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

          <Input
            label={t('confirmPasswordLabel')}
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />

          {error && <p className="text-xs text-rose-400 font-semibold">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="shadow-vortex-glow mt-2"
          >
            {t('signup')}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400">
          {t('alreadyHaveAccount')}{' '}
          <Link to="/auth/signin" className="font-bold text-violet-400 hover:underline">
            {t('login')}
          </Link>
        </p>
      </div>
    </div>
  );
};
