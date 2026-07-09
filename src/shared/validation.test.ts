import { describe, it, expect } from 'vitest';

const VALID_TYPES = ['ramp', 'bumper', 'gravity_well', 'slide', 'block'] as const;
const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 600;

function validatePlacePiece(body: Record<string, unknown>): string | null {
  if (typeof body.type !== 'string' || !(VALID_TYPES as readonly string[]).includes(body.type)) {
    return 'Invalid piece type';
  }
  if (typeof body.x !== 'number' || !Number.isFinite(body.x) || body.x < 0 || body.x > BOARD_WIDTH) {
    return 'Invalid piece position';
  }
  if (typeof body.y !== 'number' || !Number.isFinite(body.y) || body.y < 0 || body.y > BOARD_HEIGHT) {
    return 'Invalid piece position';
  }
  if (typeof body.rotation !== 'number' || !Number.isFinite(body.rotation)) {
    return 'Invalid piece rotation';
  }
  return null;
}

function validateScore(body: Record<string, unknown>): string | null {
  if (typeof body.score !== 'number' || !Number.isFinite(body.score) || body.score < 0 || body.score > 10000) {
    return 'Invalid score';
  }
  return null;
}

function sanitizeUsername(raw: string | null, postId: string): string {
  if (raw) {
    return raw.replace(/[^a-zA-Z0-9_-]/g, '');
  }
  return `anonymous_${postId.slice(-6)}`;
}

describe('validatePlacePiece', () => {
  it('accepts valid placement', () => {
    expect(validatePlacePiece({ type: 'ramp', x: 400, y: 300, rotation: 0 })).toBeNull();
  });

  it('rejects invalid type', () => {
    expect(validatePlacePiece({ type: 'invalid', x: 400, y: 300, rotation: 0 })).toBe('Invalid piece type');
  });

  it('rejects out of bounds x', () => {
    expect(validatePlacePiece({ type: 'ramp', x: -1, y: 300, rotation: 0 })).toBe('Invalid piece position');
    expect(validatePlacePiece({ type: 'ramp', x: 801, y: 300, rotation: 0 })).toBe('Invalid piece position');
  });

  it('rejects out of bounds y', () => {
    expect(validatePlacePiece({ type: 'ramp', x: 400, y: -1, rotation: 0 })).toBe('Invalid piece position');
    expect(validatePlacePiece({ type: 'ramp', x: 400, y: 601, rotation: 0 })).toBe('Invalid piece position');
  });

  it('rejects NaN rotation', () => {
    expect(validatePlacePiece({ type: 'ramp', x: 400, y: 300, rotation: NaN })).toBe('Invalid piece rotation');
  });

  it('rejects missing fields', () => {
    expect(validatePlacePiece({})).toBe('Invalid piece type');
  });
});

describe('validateScore', () => {
  it('accepts valid score', () => {
    expect(validateScore({ score: 500 })).toBeNull();
  });

  it('accepts zero', () => {
    expect(validateScore({ score: 0 })).toBeNull();
  });

  it('accepts 10000', () => {
    expect(validateScore({ score: 10000 })).toBeNull();
  });

  it('rejects negative', () => {
    expect(validateScore({ score: -1 })).toBe('Invalid score');
  });

  it('rejects over 10000', () => {
    expect(validateScore({ score: 10001 })).toBe('Invalid score');
  });

  it('rejects NaN', () => {
    expect(validateScore({ score: NaN })).toBe('Invalid score');
  });

  it('rejects non-number', () => {
    expect(validateScore({ score: 'abc' })).toBe('Invalid score');
  });
});

describe('sanitizeUsername', () => {
  it('preserves alphanumeric', () => {
    expect(sanitizeUsername('testUser123', 'post_abc')).toBe('testUser123');
  });

  it('strips special chars', () => {
    expect(sanitizeUsername('user<script>', 'post_abc')).toBe('userscript');
  });

  it('preserves underscore and hyphen', () => {
    expect(sanitizeUsername('test_user-name', 'post_abc')).toBe('test_user-name');
  });

  it('provides anonymous fallback with postId suffix', () => {
    expect(sanitizeUsername(null, 'abcdef123456')).toBe('anonymous_123456');
  });

  it('handles empty string as anonymous', () => {
    expect(sanitizeUsername('', 'post_abc').startsWith('anonymous_')).toBe(true);
  });
});
