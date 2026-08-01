import { describe, it, expect } from 'vitest';
import { buildSyncPayload, parseSyncPayload } from '../../src/admin/sync-serializer.js';

describe('sync serializer', () => {
  it('round-trips settings and custom objects with blobs', async () => {
    const settings = { speechRate: 0.9, cardSize: 'large' };
    const imageBlob = new Blob(['fake-image-bytes'], { type: 'image/png' });
    const audioBlob = new Blob(['fake-audio-bytes'], { type: 'audio/webm' });
    const objects = [
      {
        id: 'obj_001',
        name: 'Papa',
        ttsText: 'Papa',
        color: '#4A90D9',
        animation: 'random',
        imageUrl: null,
        imageBlob,
        imageSource: 'custom',
        audioBlob,
        useRecording: true,
        audioType: 'recording',
        active: true,
        order: 0,
        keyBindings: ['p'],
        source: 'custom',
      },
      {
        id: 'obj_002',
        name: 'Mama',
        ttsText: 'Ini Mama',
        color: '#E85D75',
        animation: 'bounce',
        imageUrl: null,
        imageBlob: null,
        imageSource: 'starter',
        audioBlob: null,
        useRecording: false,
        audioType: 'tts',
        active: true,
        order: 1,
        keyBindings: [],
        source: 'starter',
      },
    ];

    const payload = await buildSyncPayload(objects, settings);
    expect(typeof payload).toBe('string');
    expect(payload.length).toBeGreaterThan(0);

    const parsed = await parseSyncPayload(payload);
    expect(parsed.settings).toEqual(settings);
    expect(parsed.objects).toHaveLength(1);

    const restored = parsed.objects[0];
    expect(restored.id).toBe('obj_001');
    expect(restored.name).toBe('Papa');
    expect(restored.ttsText).toBe('Papa');
    expect(restored.color).toBe('#4A90D9');
    expect(restored.useRecording).toBe(true);
    expect(restored.audioType).toBe('recording');
    expect(restored.active).toBe(true);
    expect(restored.order).toBe(0);
    expect(restored.keyBindings).toEqual(['p']);
    expect(restored.imageSource).toBe('custom');
    expect(restored.source).toBe('custom');

    expect(restored.imageBlob).toBeInstanceOf(Blob);
    expect(restored.imageBlob.type).toBe('image/png');
    expect(restored.audioBlob).toBeInstanceOf(Blob);
    expect(restored.audioBlob.type).toBe('audio/webm');
  });

  it('excludes starter objects from the payload', async () => {
    const objects = [
      { id: 'obj_001', name: 'Starter', source: 'starter', imageBlob: null, audioBlob: null, active: true, order: 0, keyBindings: [] },
      { id: 'obj_002', name: 'Custom', source: 'custom', imageBlob: null, audioBlob: null, active: true, order: 1, keyBindings: [] },
    ];
    const payload = await buildSyncPayload(objects, {});
    const parsed = await parseSyncPayload(payload);
    expect(parsed.objects).toHaveLength(1);
    expect(parsed.objects[0].id).toBe('obj_002');
  });

  it('handles empty custom objects list', async () => {
    const payload = await buildSyncPayload([], { cardSize: 'small' });
    const parsed = await parseSyncPayload(payload);
    expect(parsed.objects).toHaveLength(0);
    expect(parsed.settings).toEqual({ cardSize: 'small' });
  });
});
