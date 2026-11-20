import React, { useCallback, useEffect, useRef, useState } from 'react';

declare const __VORTEX_BUILD_VERSION__: string;

const BUILD_VERSION = __VORTEX_BUILD_VERSION__;
const VERSION_URL = '/version.json';
const CHECK_INTERVAL_MS = 45_000;
const UPDATE_ATTEMPT_KEY = 'vortex:update-attempted-version';

const hasActiveEditor = (): boolean => {
  const active = document.activeElement;
  if (!active) return false;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) {
    return !active.disabled && !active.readOnly;
  }
  return active instanceof HTMLElement && active.isContentEditable;
};

export const VersionUpdateManager: React.FC = () => {
  const [waitingForSafeUpdate, setWaitingForSafeUpdate] = useState(false);
  const targetVersion = useRef<string | null>(null);

  const reloadWhenSafe = useCallback(() => {
    if (!targetVersion.current) return;
    if (hasActiveEditor()) {
      setWaitingForSafeUpdate(true);
      return;
    }
    window.location.reload();
  }, []);

  useEffect(() => {
    let active = true;
    let checking = false;

    const checkForUpdate = async () => {
      if (!active || checking || document.visibilityState === 'hidden') return;
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

        let attemptedVersion = '';
        try {
          attemptedVersion = window.sessionStorage.getItem(UPDATE_ATTEMPT_KEY) || '';
        } catch {
          // Session storage can be unavailable in private browsing modes.
        }
        if (attemptedVersion === latestVersion) return;

        try {
          window.sessionStorage.setItem(UPDATE_ATTEMPT_KEY, latestVersion);
        } catch {
          // The update still proceeds without session storage.
        }
        targetVersion.current = latestVersion;
        reloadWhenSafe();
      } catch {
        // A temporary network issue must never interrupt the current session.
      } finally {
        checking = false;
      }
    };

    const onFocusOut = () => {
      window.setTimeout(() => {
        if (active && targetVersion.current && !hasActiveEditor()) {
          window.location.reload();
        }
      }, 150);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    };

    void checkForUpdate();
    const interval = window.setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [reloadWhenSafe]);

  if (!waitingForSafeUpdate) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-5 inset-x-3 md:inset-x-auto md:end-5 z-[100] mx-auto md:mx-0 max-w-md rounded-xl border border-primary/30 bg-surface-elevated/95 px-4 py-3 text-sm text-fg shadow-2xl backdrop-blur-xl"
    >
      {document.documentElement.dir === 'rtl'
        ? 'تم تجهيز تحديث جديد. احفظ ما تكتبه، وبمجرد الخروج من حقل الكتابة سيتم تحديث الموقع تلقائيًا.'
        : 'A new update is ready. Finish your current typing; the site will update automatically when you leave the field.'}
    </div>
  );
};
