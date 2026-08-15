// Merge imported/synced Kata words into existing words, by id then by word text.
// Mirrors src/admin/merge-objects.js: starter words are preserved, imported
// custom words override matching existing ones, and brand-new words are added.
// Pure function so it can be unit tested directly.

export function normalizeWordText(word) {
  return (word || '').toLowerCase().trim();
}

export function mergeImportedWords(existing, imported) {
  const existingById = Object.fromEntries(existing.map((w) => [w.id, w]));
  const existingByText = Object.fromEntries(existing.map((w) => [normalizeWordText(w.word), w]));
  const importedById = Object.fromEntries(imported.map((w) => [w.id, w]));
  const importedByText = Object.fromEntries(imported.map((w) => [normalizeWordText(w.word), w]));

  const merged = [];
  for (const w of existing) {
    const custom = importedById[w.id] || importedByText[normalizeWordText(w.word)];
    if (custom && custom.source !== 'starter') {
      merged.push({
        ...w,
        word: custom.word,
        display: custom.display || custom.word,
        category: custom.category || w.category,
        audioBlob: custom.audioBlob || w.audioBlob,
        useRecording: custom.audioBlob ? custom.useRecording : (w.audioBlob ? w.useRecording : false),
        audioType: custom.audioBlob ? (custom.useRecording ? 'recording' : 'tts') : w.audioType,
        enabled: custom.enabled,
        order: typeof custom.order === 'number' ? custom.order : w.order,
        source: 'custom',
      });
    } else {
      merged.push(w);
    }
  }

  for (const i of imported) {
    if (!existingById[i.id] && !existingByText[normalizeWordText(i.word)]) {
      merged.push({ ...i, source: 'custom' });
    }
  }

  return merged;
}