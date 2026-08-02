export function normalizeImportKey(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function mergeImportedObjects(existing, imported) {
  const existingById = Object.fromEntries(existing.map((o) => [o.id, o]));
  const existingByName = Object.fromEntries(existing.map((o) => [normalizeImportKey(o.name), o]));
  const importedById = Object.fromEntries(imported.map((o) => [o.id, o]));
  const importedByName = Object.fromEntries(imported.map((o) => [normalizeImportKey(o.name), o]));

  const merged = [];
  for (const o of existing) {
    const custom = importedById[o.id] || importedByName[normalizeImportKey(o.name)];
    if (custom) {
      merged.push({
        ...o,
        name: custom.name,
        ttsText: custom.ttsText,
        color: custom.color,
        animation: custom.animation,
        imageUrl: custom.imageBlob ? null : o.imageUrl,
        imageBlob: custom.imageBlob || o.imageBlob,
        imageSource: custom.imageBlob || o.imageBlob ? 'custom' : 'starter',
        audioBlob: custom.audioBlob || o.audioBlob,
        useRecording: custom.audioBlob ? custom.useRecording : (o.audioBlob ? o.useRecording : false),
        audioType: custom.audioBlob ? (custom.useRecording ? 'recording' : 'tts') : o.audioType,
        active: custom.active,
        order: typeof custom.order === 'number' ? custom.order : o.order,
        keyBindings: custom.keyBindings?.length ? custom.keyBindings : o.keyBindings,
        source: 'custom',
      });
    } else {
      merged.push(o);
    }
  }

  for (const i of imported) {
    if (!existingById[i.id] && !existingByName[normalizeImportKey(i.name)]) {
      merged.push({ ...i, source: 'custom' });
    }
  }

  return merged;
}
