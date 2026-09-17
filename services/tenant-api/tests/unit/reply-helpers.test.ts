import { parseOptionalInt, isUuid } from '../../src/interfaces/http/reply.js';
import { ValidationError } from '../../src/domain/errors.js';

describe('parseOptionalInt', () => {
  it('returns undefined for undefined/empty', () => {
    expect(parseOptionalInt(undefined, 'limit')).toBeUndefined();
    expect(parseOptionalInt('', 'limit')).toBeUndefined();
  });

  it('parses valid non-negative integers', () => {
    expect(parseOptionalInt('0', 'limit')).toBe(0);
    expect(parseOptionalInt('50', 'limit')).toBe(50);
  });

  it('throws ValidationError for non-numeric input (was a 500 via NaN → Prisma)', () => {
    expect(() => parseOptionalInt('abc', 'limit')).toThrow(ValidationError);
  });

  it('throws for negative, decimal, or overflow-ish garbage', () => {
    expect(() => parseOptionalInt('-1', 'limit')).toThrow(ValidationError);
    expect(() => parseOptionalInt('1.5', 'limit')).toThrow(ValidationError);
    expect(() => parseOptionalInt('1e999', 'limit')).toThrow(ValidationError);
  });
});

describe('isUuid', () => {
  it('accepts a canonical uuid', () => {
    expect(isUuid('d6dfb9f7-93a3-4d21-a8fd-f651c12ff483')).toBe(true);
  });

  it('rejects malformed ids (was a 500 on a Postgres uuid column)', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('123')).toBe(false);
    expect(isUuid('')).toBe(false);
  });
});
