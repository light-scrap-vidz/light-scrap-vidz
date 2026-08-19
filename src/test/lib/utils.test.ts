import { describe, it, expect } from 'vitest';
import { cn, formatDuration, formatBytes } from '@/lib/utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, '', 'b')).toBe('a b');
  });

  it('lets the last conflicting Tailwind utility win', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('accepts arrays and conditional objects', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
  });
});

describe('formatDuration', () => {
  it('formats under a minute with a zero minute field', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(59)).toBe('0:59');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(212)).toBe('3:32');
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('adds an hour field past 3600 seconds, zero-padding minutes', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(36000)).toBe('10:00:00');
  });

  it('truncates fractional seconds', () => {
    expect(formatDuration(90.9)).toBe('1:30');
  });
});

describe('formatBytes', () => {
  it('short-circuits on zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('keeps small values in bytes', () => {
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('steps up through the units at each power of 1024', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 ** 2)).toBe('1 MB');
    expect(formatBytes(1024 ** 3)).toBe('1 GB');
  });

  it('rounds to a single decimal and trims a trailing zero', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024 * 2.25)).toBe('2.3 MB');
    expect(formatBytes(2048)).toBe('2 KB');
  });
});
