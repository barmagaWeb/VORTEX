import React, { useEffect, useRef, useState } from 'react';

declare const __VORTEX_BUILD_VERSION__: string;

const BUILD_VERSION = __VORTEX_BUILD_VERSION__;
const VERSION_URL = `${import.meta.env.BASE_URL}version.json`;
const CHECK_INTERVAL_MS = 45_000;

export const VersionUpdateManager: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const detectedVersion = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let checking = false;

    const checkForUpdate = async () => {
      if (!active || checking || document.visibilityState === 'hidden' || detectedVersion.current) return;
      checking = true;
      try {
        const response = await fetch(`${VERSION_URL}?_=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { version?: string };
        const latestVersion = typeof payload.version === 'string' ? payload.version : '';
        if (!latestVersion || latestVersion === BUILD_VERSION) return;

        // Never reload while the user is working. Only offer a manual update.
        detectedVersion.current = latestVersion;
        setUpdateAvailable(true);
      } catch {
        // A temporary network issue must never interrupt the current session.
      } finally {
        checking = false;
      }
    };

    void checkForUpdate();
    const interval = window.setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  if (!updateAvailable) return null;

  const isArabic = document.documentElement.dir === 'rtl';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-5 inset-x-3 md:inset-x-auto md:end-5 z-[100] mx-auto md:mx-0 max-w-md rounded-xl border border-primary/30 bg-surface-elevated/95 px-4 py-3 text-sm text-fg shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-3">
        <span>
          {isArabic ? 'يوجد تحديث جديد للموقع. يمكنك تثبيته عندما تنتهي.' : 'A new site update is available. Apply it when you are ready.'}
        </span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          {isArabic ? 'تحديث' : 'Update'}
        </button>
      </div>
    </div>
  );
};
