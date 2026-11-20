import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  MessageSquare,
  Globe,
  ArrowRight,
  Zap,
  Users,
  Sun,
  Moon,
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { t, language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-bg text-fg flex flex-col selection:bg-violet-600 selection:text-white">
      {/* Top Marketing Navbar */}
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-border px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Logo size="md" showTagline />

        {/* Center links on desktop */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-fg-muted">
          <Link to="/feed" className="hover:text-fg transition-colors">
            {t('home')}
          </Link>
          <Link to="/explore" className="hover:text-fg transition-colors">
            {t('explore')}
          </Link>
          <Link to="/communities" className="hover:text-fg transition-colors">
            {t('communities')}
          </Link>
        </nav>

        {/* Right action buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
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

          {user ? (
            <Button
              onClick={() => navigate('/feed')}
              variant="primary"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4 rtl:rotate-180" />}
            >
              {t('openApp')}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/auth/signin">
                <Button variant="ghost" size="sm">
                  {t('login')}
                </Button>
              </Link>
              <Link to="/auth/signup">
                <Button variant="primary" size="sm">
                  {t('signup')}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 px-4 sm:px-8 max-w-7xl mx-auto w-full flex flex-col items-center text-center overflow-hidden">
        {/* Subtle Ambient Violet/Blue Backlight glow */}
        <div className="absolute top-1/4 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[320px] bg-gradient-to-tr from-violet-600/15 to-blue-600/15 blur-[120px] rounded-full pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-elevated border border-primary/30 text-xs font-semibold text-primary-text shadow-sm mb-6">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('landingBadge')}</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-fg max-w-4xl leading-[1.1]">
          {t('landingTitleConnect')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600 dark:from-violet-400 dark:to-blue-400">{t('landingTitleShare')}</span>{language === 'ar' ? '،' : ','} {t('landingTitleDiscover')}
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-6 text-base sm:text-xl text-fg-muted max-w-2xl leading-relaxed font-normal">
          {t('landingHeroSubtitle')}
        </p>

        {/* Hero CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link to="/feed">
            <Button variant="primary" size="lg" className="px-8 shadow-vortex-glow">
              {t('getStarted')}
            </Button>
          </Link>
          <a href="#features">
            <Button variant="outline" size="lg" className="px-8">
              {t('learnMore')}
            </Button>
          </a>
        </div>

        {/* Social Proof avatars */}
        <div className="mt-8 flex items-center gap-3">
          <div className="flex [&>*+*]:-ms-2">
            <img
              className="w-8 h-8 rounded-full border-2 border-surface object-cover"
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
              alt="User 1"
            />
            <img
              className="w-8 h-8 rounded-full border-2 border-surface object-cover"
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80"
              alt="User 2"
            />
            <img
              className="w-8 h-8 rounded-full border-2 border-surface object-cover"
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"
              alt="User 3"
            />
            <img
              className="w-8 h-8 rounded-full border-2 border-surface object-cover"
              src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80"
              alt="User 4"
            />
          </div>
          <span className="text-xs sm:text-sm font-semibold text-fg-muted">
            {t('activeUsersCount')}
          </span>
        </div>

        {/* Fan of Tilted Preview Cards */}
        <div className="mt-14 relative w-full max-w-4xl flex items-center justify-center pt-8">
          <div className="relative flex items-center justify-center [&>*+*]:-ms-8 sm:[&>*+*]:-ms-12">
            {/* Left Card: Portrait */}
            <div className="w-40 sm:w-56 h-60 sm:h-80 rounded-2xl overflow-hidden shadow-card border border-border transform -rotate-12 hover:-rotate-6 transition-all duration-300 z-10 bg-surface">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80"
                alt="Portrait preview"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Center Card: High-rise City Skyline */}
            <div className="w-52 sm:w-72 h-72 sm:h-96 rounded-2xl overflow-hidden shadow-2xl border-2 border-violet-500/60 transform z-20 hover:scale-105 transition-all duration-300 bg-surface">
              <img
                src="https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=800&q=80"
                alt="Cityscape preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 inset-x-3 p-3 bg-surface/90 backdrop-blur-md rounded-xl text-start border border-border/50">
                <span className="text-xs font-bold text-fg block"><bdi>Ahmed Mohamed</bdi></span>
                <span className="text-[11px] text-primary-text" dir="auto">أحب هذا المكان فعلا! ❤️</span>
              </div>
            </div>

            {/* Right Card: Scenic Nature */}
            <div className="w-40 sm:w-56 h-60 sm:h-80 rounded-2xl overflow-hidden shadow-card border border-border transform rotate-12 hover:rotate-6 transition-all duration-300 z-10 bg-surface">
              <img
                src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80"
                alt="Nature preview"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section id="features" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto w-full border-t border-border">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-primary-text">Engineered for Excellence</span>
          <h2 className="text-3xl sm:text-4xl font-black text-fg mt-2">
            A New Standard for Social Platforms
          </h2>
          <p className="text-sm sm:text-base text-fg-muted mt-3">
            Designed from the ground up for speed, visual clarity, and authentic human interaction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Feature 1 */}
          <div className="p-6 rounded-2xl bg-surface border border-border hover:border-primary/40 shadow-card transition-all text-start flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-violet-600/15 border border-violet-500/20 text-primary flex items-center justify-center mb-5">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-fg">{t('feature1Title')}</h3>
              <p className="text-xs sm:text-sm text-fg-muted mt-2 leading-relaxed">
                {t('feature1Desc')}
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="p-6 rounded-2xl bg-surface border border-border hover:border-primary/40 shadow-card transition-all text-start flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-600/15 border border-blue-500/20 text-blue-500 flex items-center justify-center mb-5">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-fg">{t('feature2Title')}</h3>
              <p className="text-xs sm:text-sm text-fg-muted mt-2 leading-relaxed">
                {t('feature2Desc')}
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="p-6 rounded-2xl bg-surface border border-border hover:border-primary/40 shadow-card transition-all text-start flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-600/15 border border-indigo-500/20 text-indigo-500 flex items-center justify-center mb-5">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-fg">{t('feature3Title')}</h3>
              <p className="text-xs sm:text-sm text-fg-muted mt-2 leading-relaxed">
                {t('feature3Desc')}
              </p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="p-6 rounded-2xl bg-surface border border-border hover:border-primary/40 shadow-card transition-all text-start flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-600/15 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mb-5">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-fg">{t('feature4Title')}</h3>
              <p className="text-xs sm:text-sm text-fg-muted mt-2 leading-relaxed">
                {t('feature4Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive CTA Banner */}
      <section className="py-16 px-4 sm:px-8 max-w-5xl mx-auto w-full text-center">
        <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-r from-violet-600/10 via-surface to-blue-600/10 border border-primary/30 shadow-card relative overflow-hidden">
          <h2 className="text-2xl sm:text-4xl font-black text-fg">
            {t('readyToJoin')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-fg-muted max-w-xl mx-auto">
            Experience the difference of a thoughtfully designed social space.
          </p>
          <div className="mt-8 flex justify-center">
            <Link to="/feed">
              <Button variant="primary" size="lg" className="px-10 shadow-vortex-glow">
                {t('exploreVortexNow')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-8 px-4 sm:px-8 max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-fg-subtle">
        <div className="flex flex-col items-center sm:items-start gap-2">
          <Logo size="sm" />
          <div className="flex items-center gap-2" title="AUREX — VORTEX creator brand">
            <img src="/aurex-logo.png" alt="AUREX" className="h-7 w-auto max-w-[112px] object-contain" />
            <span className="text-[11px] font-medium text-fg-muted">
              {language === 'ar' ? 'تطوير AUREX' : 'Created by AUREX'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/feed" className="hover:text-fg transition-colors">{t('home')}</Link>
          <Link to="/explore" className="hover:text-fg transition-colors">{t('explore')}</Link>
          <Link to="/communities" className="hover:text-fg transition-colors">{t('communities')}</Link>
          <Link to="/admin" className="hover:text-fg transition-colors">{t('admin')}</Link>
        </div>
        <span>{t('footerRights')}</span>
      </footer>
    </div>
  );
};
