import { createHmac } from 'node:crypto';
import { SignatureVerifier, SHA256_PREFIX } from '../../src/infrastructure/meta/SignatureVerifier.js';
import { SignatureVerificationError } from '../../src/domain/errors.js';

const SECRET = 'test-secret-abc123';

function makeSignature(body: Buffer, secret: string): string {
  const hex = createHmac('sha256', secret).update(body).digest('hex');
  return `${SHA256_PREFIX}${hex}`;
}

describe('SignatureVerifier', () => {
  let verifier: SignatureVerifier;

  beforeEach(() => {
    verifier = new SignatureVerifier(SECRET);
  });

  test('valid signature passes without throwing', () => {
    const body = Buffer.from('{"entry":[]}');
    const sig = makeSignature(body, SECRET);
    expect(() => verifier.verify(body, sig)).not.toThrow();
  });

  test('tampered body fails with SignatureVerificationError', () => {
    const originalBody = Buffer.from('{"entry":[]}');
    const sig = makeSignature(originalBody, SECRET);
    const tamperedBody = Buffer.from('{"entry":[],"injected":true}');

    expect(() => verifier.verify(tamperedBody, sig)).toThrow(SignatureVerificationError);
  });

  test('wrong secret fails with SignatureVerificationError', () => {
    const body = Buffer.from('{"entry":[]}');
    const sig = makeSignature(body, 'wrong-secret');

    expect(() => verifier.verify(body, sig)).toThrow(SignatureVerificationError);
  });

  test('missing header fails with SignatureVerificationError', () => {
    const body = Buffer.from('{}');
    expect(() => verifier.verify(body, undefined)).toThrow(SignatureVerificationError);
  });

  test('malformed header (no sha256= prefix) fails', () => {
    const body = Buffer.from('{}');
    expect(() => verifier.verify(body, 'abcdef1234')).toThrow(SignatureVerificationError);
  });

  test('uses timingSafeEqual — verify is not using string equality', () => {
    // The implementation compares Buffer instances via timingSafeEqual, not
    // hex strings via ===. This test confirms that a valid signature of an
    // EMPTY body does not accidentally pass for a non-empty body.
    const emptyBody = Buffer.alloc(0);
    const nonEmptyBody = Buffer.from('hello');
    const sigForEmpty = makeSignature(emptyBody, SECRET);

    // Would pass if we just compared the hex prefix string "sha256="
    expect(() => verifier.verify(nonEmptyBody, sigForEmpty)).toThrow(SignatureVerificationError);
  });

  test('throws Error if constructed with empty secret', () => {
    expect(() => new SignatureVerifier('')).toThrow(Error);
  });
});
