// Serialize local custom objects + settings into a JSON-safe compressed string,
// and restore it back into the same shape expected by importZip.

import { extFromBlob } from '../utils.js';

export async function buildSyncPayload(objects, settings) {
  const customObjects = objects.filter((o) => o.source === 'custom');

  const config = {
    version: '3.0',
    partial: true,
    exportMode: 'custom-only',
    settings: { ...settings },
    objects: await Promise.all(
      customObjects.map(async (o) => ({
        id: o.id,
        name: o.name,
        ttsText: o.ttsText,
        color: o.color,
        animation: o.animation,
        image: o.imageBlob ? `images/${o.id}.${extFromBlob(o.imageBlob) || 'png'}` : '',
        audio: o.audioBlob ? `audio/${o.id}.${extFromBlob(o.audioBlob) || 'webm'}` : '',
        imageData: o.imageBlob ? await blobToBase64(o.imageBlob) : '',
        audioData: o.audioBlob ? await blobToBase64(o.audioBlob) : '',
        useRecording: !!o.useRecording,
        audioType: o.useRecording && o.audioBlob ? 'recording' : 'tts',
        active: o.active,
        order: o.order,
        keyBindings: o.keyBindings || [],
        source: o.source || 'custom',
      }))
    ),
  };

  const json = JSON.stringify(config);
  const compressed = await compressString(json);
  return compressed;
}

export async function parseSyncPayload(compressedString) {
  const json = await decompressString(compressedString);
  const config = JSON.parse(json);

  const imported = [];
  for (const o of config.objects || []) {
    imported.push({
      id: o.id,
      name: o.name,
      ttsText: o.ttsText || o.name,
      color: o.color || '#4A90D9',
      animation: o.animation || 'random',
      imageUrl: null,
      imageBlob: o.imageData ? base64ToBlob(o.imageData, mimeFromExt(o.image)) : null,
      imageSource: 'custom',
      audioBlob: o.audioData ? base64ToBlob(o.audioData, mimeFromExt(o.audio)) : null,
      useRecording: !!o.useRecording,
      audioType: o.audioType || 'tts',
      active: o.active !== false,
      order: typeof o.order === 'number' ? o.order : imported.length,
      keyBindings: (o.keyBindings || []).map((k) => k.toString().toLowerCase()),
      source: o.source || 'custom',
    });
  }

  return {
    version: config.version || '3.0',
    settings: config.settings || {},
    objects: imported,
    config,
  };
}

// Pretty-print a sync config for the admin log. The raw config contains
// base64 image/audio data, so replace those fields with size placeholders
// to keep the log readable.
export function configToLogString(config) {
  const copy = JSON.parse(JSON.stringify(config || {}));
  for (const o of copy.objects || []) {
    if (typeof o.imageData === 'string' && o.imageData) {
      o.imageData = `[base64 ${o.imageData.length} chars]`;
    }
    if (typeof o.audioData === 'string' && o.audioData) {
      o.audioData = `[base64 ${o.audioData.length} chars]`;
    }
  }
  return JSON.stringify(copy, null, 2);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: type || 'application/octet-stream' });
}

function mimeFromExt(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  const map = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    mp4: 'audio/mp4',
  };
  return map[ext] || 'application/octet-stream';
}

async function compressString(str) {
  if (typeof CompressionStream === 'undefined') {
    // Fallback for environments without CompressionStream (e.g. some tests).
    return 'raw:' + btoa(unescape(encodeURIComponent(str)));
  }
  const encoder = new TextEncoder();
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(encoder.encode(str));
  writer.close();
  const chunks = [];
  const reader = stream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const merged = mergeUint8Arrays(chunks);
  return 'gz:' + uint8ToBase64(merged);
}

async function decompressString(compressed) {
  if (compressed.startsWith('raw:')) {
    return decodeURIComponent(escape(atob(compressed.slice(4))));
  }
  if (!compressed.startsWith('gz:')) {
    // Legacy plain JSON fallback.
    return compressed;
  }
  const bytes = base64ToUint8(compressed.slice(3));
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const chunks = [];
  const reader = stream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const decoder = new TextDecoder();
  return decoder.decode(mergeUint8Arrays(chunks));
}

function mergeUint8Arrays(arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    merged.set(a, offset);
    offset += a.length;
  }
  return merged;
}

function uint8ToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
