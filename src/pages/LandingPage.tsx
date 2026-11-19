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
    <div className="min-h-screen bg-vortex-dark-bg text-slate-100 flex flex-col selection:bg-violet-600 selection:text-white">
      {/* Top Marketing Navbar matching reference image */}
      <header className="sticky top-0 z-40 bg-slate-950/70 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-4 flex items-center justify-between">
        <Logo size="md" showTagline />

        {/* Center links on desktop */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
          <Link to="/feed" className="hover:text-white transition-colors">
            {t('home')}
          </Link>
          <Link to="/explore" className="hover:text-white transition-colors">
            {t('explore')}
          </Link>
          <Link to="/communities" className="hover:text-white transition-colors">
            {t('communities')}
          </Link>
        </nav>

        {/* Right action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <Globe className="w-4 h-4 text-violet-400" />
            <span>{language === 'en' ? 'العربية' : 'English'}</span>
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          {user ? (
            <Button
              onClick={() => navigate('/feed')}
              variant="primary"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Open App
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

      {/* Hero Section matching reference image */}
      <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 px-4 sm:px-8 max-w-7xl mx-auto w-full flex flex-col items-center text-center overflow-hidden">
        {/* Subtle Ambient Violet/Blue Backlight glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-violet-600/20 to-blue-600/20 blur-[130px] rounded-full pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-violet-500/30 text-xs font-semibold text-violet-300 shadow-vortex-glow mb-6">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Modern Social Networking Platform</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.1]">
          Connect. <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">Share</span>, Discover.
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl leading-relaxed font-normal">
          {t('landingHeroSubtitle')}
        </p>

        {/* Hero CTAs matching reference image */}
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

        {/* Social Proof avatars row matching reference image */}
        <div className="mt-8 flex items-center gap-3">
          <div className="flex -space-x-2">
            <img
              className="w-8 h-8 rounded-full border-2 border-slate-900 object-cover"
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
              alt="User 1"
            />
            <img
              className="w-8 h-8 rounded-full border-2 border-slate-900 object-cover"
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80"
              alt="User 2"
            />
            <img
              className="w-8 h-8 rounded-full border-2 border-slate-900 object-cover"
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"
              alt="User 3"
            />
            <img
              className="w-8 h-8 rounded-full border-2 border-slate-900 object-cover"
              src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80"
              alt="User 4"
            />
          </div>
          <span className="text-xs sm:text-sm font-semibold text-slate-400">
            {t('activeUsersCount')}
          </span>
        </div>

        {/* Fan of Tilted Preview Cards matching the reference image */}
        <div className="mt-14 relative w-full max-w-4xl flex items-center justify-center pt-8">
          <div className="relative flex items-center justify-center -space-x-8 sm:-space-x-12">
            {/* Left Card: Portrait */}
            <div className="w-40 sm:w-56 h-60 sm:h-80 rounded-2xl overflow-hidden shadow-2xl border border-slate-700/80 transform -rotate-12 hover:-rotate-6 transition-all duration-300 z-10 bg-slate-900">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80"
                alt="Portrait preview"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Center Card: High-rise City Skyline Sunset */}
            <div className="w-52 sm:w-72 h-72 sm:h-96 rounded-2xl overflow-hidden shadow-2xl border-2 border-violet-500/60 transform z-20 hover:scale-105 transition-all duration-300 bg-slate-900 shadow-vortex-glow">
              <img
                src="https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=800&q=80"
                alt="Cityscape preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 inset-x-3 p-3 bg-slate-950/80 backdrop-blur-md rounded-xl text-start">
                <span className="text-xs font-bold text-white block">Ahmed Mohamed</span>
                <span className="text-[11px] text-violet-300">أحب هذا المكان فعلا! ❤️</span>
              </div>
            </div>

            {/* Right Card: Scenic Mountains / Skyline */}
            <div className="w-40 sm:w-56 h-60 sm:h-80 rounded-2xl overflow-hidden shadow-2xl border border-slate-700/80 transform rotate-12 hover:rotate-6 transition-all duration-300 z-10 bg-slate-900">
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
      <section id="features" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto w-full border-t border-slate-800/80">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-violet-400">Engineered for Excellence</span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">
            A New Standard for Social Platforms
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mt-3">
            Designed from the ground up for speed, visual clarity, and authentic human interaction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Feature 1 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-violet-500/40 transition-all text-start flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-violet-600/15 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-5">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('feature1Title')}</h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                {t('feature1Desc')}
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-violet-500/40 transition-all text-start flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-600/15 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-5">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('feature2Title')}</h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                {t('feature2Desc')}
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-violet-500/40 transition-all text-start flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-600/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('feature3Title')}</h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                {t('feature3Desc')}
              </p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-violet-500/40 transition-all text-start flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-600/15 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('feature4Title')}</h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                {t('feature4Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive CTA Banner */}
      <section className="py-16 px-4 sm:px-8 max-w-5xl mx-auto w-full text-center">
        <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-r from-violet-950/70 via-slate-900 to-blue-950/70 border border-violet-500/30 shadow-2xl relative overflow-hidden">
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            {t('readyToJoin')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
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
      <footer className="mt-auto border-t border-slate-800/80 py-8 px-4 sm:px-8 max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <Logo size="sm" />
        <div className="flex items-center gap-6">
          <Link to="/feed" className="hover:text-slate-300">Feed</Link>
          <Link to="/explore" className="hover:text-slate-300">Explore</Link>
          <Link to="/communities" className="hover:text-slate-300">Communities</Link>
          <Link to="/admin" className="hover:text-slate-300">Admin</Link>
        </div>
        <span>{t('footerRights')}</span>
      </footer>
    </div>
  );
};
