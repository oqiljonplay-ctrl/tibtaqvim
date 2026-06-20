import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const SHOWCASE_BUCKET = "clinic-showcase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let _client: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (!_client) {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error(
        "Supabase storage sozlanmagan: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yo'q"
      );
    }
    _client = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

/** Public URL (bucket public bo'lgani uchun signed emas). */
export function showcasePublicUrl(path: string): string {
  return admin().storage.from(SHOWCASE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Fayl yuklash (service_role). Public URL qaytaradi. */
export async function uploadShowcaseFile(
  path: string,
  body: Buffer | Uint8Array | Blob,
  contentType: string
): Promise<{ path: string; url: string }> {
  const { error } = await admin()
    .storage.from(SHOWCASE_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`Showcase upload xato: ${error.message}`);
  return { path, url: showcasePublicUrl(path) };
}

/** Fayllarni o'chirish (orphan bo'lmasligi uchun). */
export async function deleteShowcaseFiles(paths: string[]): Promise<void> {
  const clean = paths.filter(Boolean);
  if (clean.length === 0) return;
  const { error } = await admin().storage.from(SHOWCASE_BUCKET).remove(clean);
  if (error) throw new Error(`Showcase delete xato: ${error.message}`);
}

/** Yo'l shabloni: clinic/<clinicId>/<blockId>/<mediaId>.<ext> */
export function showcasePath(
  clinicId: string,
  blockId: string,
  mediaId: string,
  ext: string
): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `clinic/${clinicId}/${blockId}/${mediaId}.${safeExt}`;
}
