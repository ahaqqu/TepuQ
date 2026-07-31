import { describe, it, expect } from 'vitest';

// Minimal in-memory JSZip mock for testing exportZip logic
function makeJSZip() {
  const files = {};
  return {
    folder(name) {
      return {
        file(path, blob) {
          files[`${name}/${path}`] = blob;
        },
      };
    },
    file(name, data) {
      files[name] = data;
    },
    async generateAsync() {
      return { files };
    },
  };
}

async function runExportZip(objects, settings) {
  const JSZip = makeJSZip();
  const customObjects = objects.filter((o) => o.source === 'custom');
  const config = {
    version: '3.0',
    partial: true,
    settings: { ...settings },
    objects: customObjects.map((o) => ({
      id: o.id,
      name: o.name,
      ttsText: o.ttsText,
      color: o.color,
      animation: o.animation,
      image: o.imageBlob ? `images/${o.id}.png` : '',
      audio: o.audioBlob ? `audio/${o.id}.webm` : '',
      useRecording: !!o.useRecording,
      audioType: o.useRecording && o.audioBlob ? 'recording' : 'tts',
      active: o.active,
      order: o.order,
      keyBindings: o.keyBindings || [],
    })),
  };
  JSZip.file('config.json', JSON.stringify(config, null, 2));
  const imgFolder = JSZip.folder('images');
  const audioFolder = JSZip.folder('audio');
  for (const o of customObjects) {
    if (o.imageBlob) imgFolder.file(`${o.id}.png`, o.imageBlob);
    if (o.audioBlob) audioFolder.file(`${o.id}.webm`, o.audioBlob);
  }
  const result = await JSZip.generateAsync();
  return { config: JSON.parse(result.files['config.json']), files: result.files };
}

describe('export/import behavior', () => {
  it('exports only objects with custom images or recordings', async () => {
    const objects = [
      { id: 'a', name: 'A', source: 'starter', imageBlob: null, audioBlob: null },
      { id: 'b', name: 'B', source: 'starter', imageBlob: new Blob(['img']), audioBlob: null },
      { id: 'c', name: 'C', source: 'custom', imageBlob: null, audioBlob: new Blob(['audio']) },
    ];
    const { config, files } = await runExportZip(objects, { volume: 0.8 });

    expect(config.partial).toBe(true);
    expect(config.objects).toHaveLength(1);
    expect(config.objects.map((o) => o.id)).toContain('c');
    expect(files['audio/c.webm']).toBeDefined();
    expect(files['images/b.png']).toBeUndefined();
    expect(files['images/a.png']).toBeUndefined();
  });

  it('merges imported custom objects with default objects', () => {
    const defaults = [
      { id: 'a', name: 'Papa', source: 'starter', imageBlob: new Blob(['default']), audioBlob: null, useRecording: false, audioType: 'tts' },
      { id: 'b', name: 'Mama', source: 'starter', imageBlob: null, audioBlob: null, useRecording: false, audioType: 'tts' },
    ];
    const imported = [
      { id: 'a', name: 'Papa', source: 'custom', imageBlob: new Blob(['custom']), audioBlob: null, useRecording: false, audioType: 'tts' },
      { id: 'x', name: 'Custom Object', source: 'custom', imageBlob: new Blob(['new']), audioBlob: null, useRecording: false, audioType: 'tts' },
    ];

    const merged = defaults.map((o) => {
      const custom = imported.find((i) => i.id === o.id);
      return custom ? { ...o, imageBlob: custom.imageBlob || o.imageBlob } : o;
    });
    for (const i of imported) {
      if (!defaults.find((o) => o.id === i.id)) merged.push(i);
    }

    expect(merged).toHaveLength(3);
    const papa = merged.find((o) => o.id === 'a');
    expect(papa.imageBlob.size).toBe(6); // 'custom' length
  });
});
