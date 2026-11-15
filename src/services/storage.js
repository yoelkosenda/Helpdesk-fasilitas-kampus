const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

let supabaseClient = null;

function isSupabaseEnabled() {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

function getSupabase() {
  if (!supabaseClient && isSupabaseEnabled()) {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseClient;
}

function createFilename(originalname) {
  const ext = path.extname(originalname || '').toLowerCase() || '.jpg';
  return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
}

async function simpanFoto(file) {
  if (!file) return null;
  if (!isSupabaseEnabled()) return file.filename || null;

  const supabase = getSupabase();
  const filename = createFilename(file.originalname);
  const { error } = await supabase.storage
    .from(config.supabaseBucket)
    .upload(filename, file.buffer, { contentType: file.mimetype, upsert: false });

  if (error) {
    throw new Error(`Gagal mengunggah foto ke Supabase Storage: ${error.message}`);
  }
  const { data } = supabase.storage.from(config.supabaseBucket).getPublicUrl(filename);
  return data.publicUrl;
}

async function hapusFoto(fotoValue) {
  if (!fotoValue) return;
  if (/^https?:\/\//i.test(fotoValue)) {
    if (!isSupabaseEnabled()) return;
    const marker = `/object/public/${config.supabaseBucket}/`;
    const idx = fotoValue.indexOf(marker);
    if (idx === -1) return;
    const objectPath = decodeURIComponent(fotoValue.slice(idx + marker.length));
    await getSupabase().storage.from(config.supabaseBucket).remove([objectPath]).catch(() => {});
    return;
  }
  await fs.promises.unlink(path.resolve(config.uploadDir, fotoValue)).catch(() => {});
}

module.exports = { isSupabaseEnabled, createFilename, simpanFoto, hapusFoto };
