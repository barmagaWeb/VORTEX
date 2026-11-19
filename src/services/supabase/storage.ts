import { supabase, isSupabaseConfigured } from './client';

export interface UploadResult {
  /**
   * Public buckets return a URL. Private buckets return the storage object path;
   * resolveStorageUrl() must be called when the media is displayed.
   */
  url: string;
  path: string;
}

export type StorageBucket = 'avatars' | 'covers' | 'post_media' | 'community_media' | 'attachments' | 'story_media';

const PRIVATE_BUCKETS: ReadonlySet<StorageBucket> = new Set(['post_media', 'attachments', 'story_media']);
const MAX_SIZE_BY_BUCKET: Record<StorageBucket, number> = {
  avatars: 5 * 1024 * 1024,
  covers: 10 * 1024 * 1024,
  post_media: 10 * 1024 * 1024,
  community_media: 10 * 1024 * 1024,
  attachments: 10 * 1024 * 1024,
  story_media: 10 * 1024 * 1024,
};
const ALLOWED_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);


async function hasExpectedImageSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const startsWith = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (file.type === 'image/jpeg') return startsWith([0xff, 0xd8, 0xff]);
  if (file.type === 'image/png') return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (file.type === 'image/gif') {
    const header = new TextDecoder().decode(bytes.slice(0, 6));
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (file.type === 'image/webp') {
    return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
      && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  }
  return false;
}

function isHttpsUrl(value: string): boolean {
  return /^https:\/\//i.test(value);
}

export async function uploadMediaFile(
  bucket: StorageBucket,
  file: File,
  folderPath?: string
): Promise<UploadResult> {
  const maxSize = MAX_SIZE_BY_BUCKET[bucket];
  if (file.size <= 0 || file.size > maxSize) {
    throw new Error(`File must be between 1 byte and ${Math.round(maxSize / 1024 / 1024)}MB`);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Unsupported media type');
  }
  if (!await hasExpectedImageSignature(file)) {
    throw new Error('The file contents do not match a supported image format.');
  }

  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(-120);
  const uniqueName = `${Date.now()}_${crypto.randomUUID()}_${cleanFileName}`;
  const fullPath = folderPath ? `${folderPath}/${uniqueName}` : uniqueName;

  if (!isSupabaseConfigured()) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve({ url: reader.result, path: fullPath });
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  if (PRIVATE_BUCKETS.has(bucket)) {
    if (!folderPath) throw new Error('A user-owned folder is required for private media uploads');
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    const segments = folderPath.split('/');
    if (!userId || segments[0] !== userId || segments.some((segment) => !/^[a-zA-Z0-9_-]+$/.test(segment))) {
      throw new Error('Private media must be uploaded inside the authenticated user folder.');
    }
  }

  const { data, error } = await supabase.storage.from(bucket).upload(fullPath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to upload media file to storage');
  }

  if (PRIVATE_BUCKETS.has(bucket)) {
    return { url: data.path, path: data.path };
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  if (!publicUrlData.publicUrl) {
    throw new Error('Failed to create a public media URL');
  }
  return { url: publicUrlData.publicUrl, path: data.path };
}

/** Resolve stored paths only at read/display time; signed URLs are never persisted. */
export async function resolveStorageUrl(
  bucket: StorageBucket,
  storedValue: string | null | undefined,
  expiresInSeconds = 60 * 60
): Promise<string> {
  if (!storedValue) return '';
  if (/^(data:|blob:|javascript:)/i.test(storedValue) || /^http:\/\//i.test(storedValue)) return '';
  if (isHttpsUrl(storedValue)) return PRIVATE_BUCKETS.has(bucket) ? '' : storedValue;
  if (!isSupabaseConfigured()) return storedValue;

  if (PRIVATE_BUCKETS.has(bucket)) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storedValue, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message || `Unable to sign ${bucket} media`);
    }
    return data.signedUrl;
  }

  return supabase.storage.from(bucket).getPublicUrl(storedValue).data.publicUrl;
}


/** Resolve a set of stored object paths in one Storage signing request. */
export async function resolveStorageUrls(
  bucket: StorageBucket,
  storedValues: Array<string | null | undefined>,
  expiresInSeconds = 60 * 60
): Promise<string[]> {
  const normalized = storedValues.map((value) => value || '');
  if (!isSupabaseConfigured()) return normalized;

  const pathValues = Array.from(new Set(normalized.filter((value) => {
    if (!value) return false;
    if (/^(data:|blob:|javascript:)/i.test(value) || /^http:\/\//i.test(value)) return false;
    if (isHttpsUrl(value)) return false;
    return true;
  })));

  if (PRIVATE_BUCKETS.has(bucket) && pathValues.length > 0) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(pathValues, expiresInSeconds);
    if (error) throw new Error(error.message || `Unable to sign ${bucket} media`);
    const signedByPath = new Map((data || []).map((item) => [item.path, item.signedUrl || '']));
    return normalized.map((value) => {
      if (!value || /^(data:|blob:|javascript:)/i.test(value) || /^http:\/\//i.test(value)) return '';
      if (isHttpsUrl(value)) return '';
      return signedByPath.get(value) || '';
    });
  }

  return Promise.all(normalized.map((value) => resolveStorageUrl(bucket, value, expiresInSeconds)));
}
