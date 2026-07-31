import { describe, it, expect } from 'vitest';
import { chooseNext, findBoundObject } from '@/game/logic.js';

const objects = [
  { id: 'a', name: 'Apple', active: true },
  { id: 'b', name: 'Ball', active: true },
  { id: 'c', name: 'Cat', active: true },
];

const one = [{ id: 'a', name: 'Apple', active: true }];

describe('chooseNext', () => {
  it('sequential cycles through active objects', () => {
    expect(chooseNext(objects, objects[0], 'sequential').id).toBe('b');
    expect(chooseNext(objects, objects[1], 'sequential').id).toBe('c');
    expect(chooseNext(objects, objects[2], 'sequential').id).toBe('a');
  });

  it('round-robin shuffles remaining objects', () => {
    const first = chooseNext(objects, objects[0], 'round-robin', []);
    expect(first.next.id).not.toBe('a');
    expect(first.pool.length).toBe(1);
  });

  it('returns only object when list has one item', () => {
    expect(chooseNext(one, one[0], 'random').id).toBe('a');
  });

  it('random never repeats the current object', () => {
    for (let i = 0; i < 50; i++) {
      const next = chooseNext(objects, objects[1], 'random');
      expect(next.id).not.toBe('b');
    }
  });
});

describe('findBoundObject', () => {
  it('matches lowercase key binding', () => {
    const active = [{ id: 'p', name: 'Papa', active: true, keyBindings: ['p'] }];
    expect(findBoundObject(active, 'P')?.id).toBe('p');
    expect(findBoundObject(active, 'p')?.id).toBe('p');
  });

  it('returns null for unbound key', () => {
    const active = [{ id: 'p', name: 'Papa', active: true, keyBindings: ['p'] }];
    expect(findBoundObject(active, 'z')).toBeNull();
  });
});
