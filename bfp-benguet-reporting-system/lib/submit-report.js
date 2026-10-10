import axios from 'axios';

// Vercel caps a function request body at 4.5MB, so sending attachments through POST /api/reports
// fails as soon as a report has a couple of phone photos. Files are uploaded straight to Supabase
// Storage via signed URLs instead, and the report itself is posted as small JSON.
//
// If the direct upload can't be used (signing fails, or the storage PUT is refused), this falls
// back to the original multipart submission so small reports still go through exactly as before.

const putToSignedUrl = async (signedUrl, file) => {
  // Mirrors @supabase/storage-js uploadToSignedUrl for a browser Blob.
  const body = new FormData();
  body.append('cacheControl', '3600');
  body.append('', file);
  const res = await fetch(signedUrl, { method: 'PUT', body, headers: { 'x-upsert': 'false' } });
  if (!res.ok) throw new Error(`Upload of "${file.name}" failed (${res.status})`);
};

async function uploadDirect(files, headers) {
  const { data } = await axios.post(
    '/api/uploads',
    { files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })) },
    { headers }
  );
  await Promise.all(data.uploads.map((upload, index) => putToSignedUrl(upload.signedUrl, files[index])));
  return data.uploads.map((upload) => upload.attachment);
}

// `fields` holds every non-file form field (strings); `files` the File objects to attach.
export async function submitReport({ fields, files }) {
  const headers = { Authorization: `Bearer ${sessionStorage.getItem('token')}` };

  let attachments = null;
  try {
    attachments = await uploadDirect(files, headers);
  } catch (error) {
    // A 4xx from /api/uploads is a real validation error (bad type, too large, too many files) —
    // show it rather than retrying the same files a different way.
    const status = error.response?.status;
    if (status && status < 500) throw error;
    console.warn('Direct upload unavailable, falling back to multipart submit:', error);
  }

  if (attachments) {
    return axios.post('/api/reports', { ...fields, attachments }, { headers });
  }

  const payload = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') payload.append(key, value);
  });
  files.forEach((file) => payload.append('attachments', file));
  try {
    return await axios.post('/api/reports', payload, { headers });
  } catch (error) {
    if (error.response?.status === 413) {
      error.response.data = { error: 'Attachments are too large to upload together. Try fewer or smaller files.' };
    }
    throw error;
  }
}
