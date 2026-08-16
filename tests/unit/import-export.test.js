import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportZip } from '../../src/admin/import-export.js';
import { mergeImportedObjects } from '../../src/admin/merge-objects.js';

const instances = [];

function makeJSZip() {
  class JSZip {
    constructor() {
      this.files = {};
      instances.push(this);
    }
    folder(name) {
      return {
        file: (path, blob) => {
          this.files[`${name}/${path}`] = blob;
        },
      };
    }
    file(name, data) {
      this.files[name] = data;
    }
    async generateAsync({ type } = {}) {
      return type === 'blob' ? new Blob([JSON.stringify(this.files)], { type: 'application/zip' }) : this.files;
    }
  }
  return JSZip;
}

describe('export/import behavior', () => {
  beforeEach(() => {
    instances.length = 0;
    window.JSZip = makeJSZip();
    window.saveAs = vi.fn();
  });

  it('exports only custom objects with images or recordings', async () => {
    const objects = [
      { id: 'a', name: 'A', source: 'starter', imageBlob: null, audioBlob: null, useRecording: false },
      { id: 'b', name: 'B', source: 'starter', imageBlob: new Blob(['img'], { type: 'image/png' }), audioBlob: null, useRecording: false },
      { id: 'c', name: 'C', source: 'custom', imageBlob: null, audioBlob: new Blob(['audio'], { type: 'audio/webm' }), useRecording: true, kataEnabled: true },
    ];
    await exportZip(objects, { volume: 0.8 });

    expect(window.saveAs).toHaveBeenCalledOnce();
    expect(window.saveAs.mock.calls[0][1]).toBe('tepuq-data.zip');
    const zipInstance = instances[0];
    const config = JSON.parse(zipInstance.files['config.json']);
    expect(config.partial).toBe(true);
    expect(config.objects).toHaveLength(1);
    expect(config.objects[0].id).toBe('c');
    expect(config.objects[0].kataEnabled).toBe(true);
    expect(zipInstance.files['audio/c.webm']).toBeDefined();
    expect(zipInstance.files['images/b.png']).toBeUndefined();
  });

  it('merges imported custom objects with default objects by id', () => {
    const defaults = [
      { id: 'a', name: 'Papa', source: 'starter', imageBlob: new Blob(['default'], { type: 'image/png' }), audioBlob: null, useRecording: false, audioType: 'tts' },
      { id: 'b', name: 'Mama', source: 'starter', imageBlob: null, audioBlob: null, useRecording: false, audioType: 'tts' },
    ];
    const imported = [
      { id: 'a', name: 'Papa', source: 'custom', imageBlob: new Blob(['custom'], { type: 'image/png' }), audioBlob: null, useRecording: false, audioType: 'tts', kataEnabled: false },
      { id: 'x', name: 'Custom Object', source: 'custom', imageBlob: new Blob(['new'], { type: 'image/png' }), audioBlob: null, useRecording: false, audioType: 'tts', kataEnabled: true },
    ];

    const merged = mergeImportedObjects(defaults, imported);
    expect(merged).toHaveLength(3);
    const papa = merged.find((o) => o.id === 'a');
    expect(papa.source).toBe('custom');
    expect(papa.imageBlob.size).toBe(6); // 'custom' length
    expect(papa.kataEnabled).toBe(false); // imported toggle wins
  });

  it('merges imported custom objects by normalized name', () => {
    const defaults = [
      { id: 'a', name: 'Papa', source: 'starter', imageBlob: null, audioBlob: null, useRecording: false, audioType: 'tts' },
    ];
    const imported = [
      { id: 'new-papa', name: '  papa  ', source: 'custom', imageBlob: new Blob(['custom'], { type: 'image/png' }), audioBlob: null, useRecording: false, audioType: 'tts' },
    ];

    const merged = mergeImportedObjects(defaults, imported);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('a');
    expect(merged[0].source).toBe('custom');
    expect(merged[0].imageBlob).toBeDefined();
  });
});
