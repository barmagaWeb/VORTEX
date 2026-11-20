export type VortexNotificationType = 'like' | 'comment' | 'reply' | 'follow' | 'repost' | 'message' | 'community' | 'mention';

export interface NotificationPreferences {
  soundEnabled: boolean;
  soundVolume: number;
  categories: Record<VortexNotificationType, boolean>;
}

export interface ChatPreferences {
  enterToSend: boolean;
  compactMode: boolean;
  incomingSound: boolean;
}

const NOTIFICATION_KEY = 'vortex_notification_preferences_v1';
const CHAT_KEY = 'vortex_chat_preferences_v1';

const defaultNotifications: NotificationPreferences = {
  soundEnabled: true,
  soundVolume: 0.55,
  categories: {
    like: true, comment: true, reply: true, follow: true,
    repost: true, message: true, community: true, mention: true,
  },
};

const defaultChat: ChatPreferences = {
  enterToSend: true,
  compactMode: false,
  incomingSound: false,
};

function readPreferences<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } as T : fallback;
  } catch {
    return fallback;
  }
}

export function getNotificationPreferences(): NotificationPreferences {
  const saved = readPreferences(NOTIFICATION_KEY, defaultNotifications);
  return {
    ...defaultNotifications,
    ...saved,
    categories: { ...defaultNotifications.categories, ...(saved.categories || {}) },
    soundVolume: Math.max(0, Math.min(1, Number(saved.soundVolume ?? defaultNotifications.soundVolume))),
  };
}

export function saveNotificationPreferences(value: NotificationPreferences): void {
  try { window.localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(value)); } catch { /* Storage may be disabled. */ }
}

export function getChatPreferences(): ChatPreferences {
  return { ...defaultChat, ...readPreferences(CHAT_KEY, defaultChat) };
}

export function saveChatPreferences(value: ChatPreferences): void {
  try { window.localStorage.setItem(CHAT_KEY, JSON.stringify(value)); } catch { /* Storage may be disabled. */ }
}

let audioContext: AudioContext | null = null;

export function playVortexNotificationSound(volume = getNotificationPreferences().soundVolume): void {
  if (typeof window === 'undefined' || volume <= 0) return;
  try {
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;
    audioContext ||= new AudioContextConstructor();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)) * 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    gain.connect(audioContext.destination);
    [660, 880].forEach((frequency, index) => {
      const oscillator = audioContext!.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.12);
      oscillator.connect(gain);
      oscillator.start(now + index * 0.12);
      oscillator.stop(now + index * 0.12 + 0.18);
    });
  } catch {
    // Audio is optional and must never interrupt notifications or messaging.
  }
}
