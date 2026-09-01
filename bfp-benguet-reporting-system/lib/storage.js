import { createClient } from '@supabase/supabase-js';

// Created lazily on first actual use, not at module load — Next.js's build imports route modules
// to collect page data, and constructing the client eagerly threw "supabaseUrl is required"
// during the build whenever the env vars weren't available at build time (same class of issue as
// the JWT_SECRET fail-fast check; see lib/auth.js).
let _supabase = null;
function getSupabaseClient() {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required but not set.');
    }
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _supabase;
}

const BUCKET = 'report-attachments';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — matches the bucket's own configured limit
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
  'application/pdf',
];

const sanitizeFileName = (fileName) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');

// Uploads to Supabase Storage instead of local disk — Render's filesystem is ephemeral and wipes
// on every deploy/restart, which was silently deleting every previously-uploaded attachment.
export async function saveAttachments(files, folder) {
  const validFiles = files.filter((file) => file && file.size > 0);
  if (!validFiles.length) return [];

  const oversized = validFiles.find((file) => file.size > MAX_FILE_SIZE);
  if (oversized) {
    throw new Error(`"${oversized.name}" exceeds the 10MB attachment size limit.`);
  }

  const disallowed = validFiles.find((file) => !ALLOWED_MIME_TYPES.includes(file.type));
  if (disallowed) {
    throw new Error(`"${disallowed.name}" has an unsupported file type. Only images and PDFs are allowed.`);
  }

  const supabase = getSupabaseClient();

  return Promise.all(
    validFiles.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const storedName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizeFileName(file.name)}`;

      const { error } = await supabase.storage.from(BUCKET).upload(storedName, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (error) throw new Error(`Failed to upload "${file.name}": ${error.message}`);

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(storedName);

      return {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        url: data.publicUrl,
      };
    })
  );
}
