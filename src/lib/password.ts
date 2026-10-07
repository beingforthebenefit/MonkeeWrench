import {randomBytes, randomInt, scrypt, timingSafeEqual} from 'crypto'

/**
 * Passwords for band members. Admins generate them; nobody picks a weak one
 * unless they change it themselves (minimum length enforced).
 *
 * Hash format: scrypt$<N>$<r>$<p>$<salt b64>$<hash b64>
 */

const N = 16384
const R = 8
const P = 1
const KEYLEN = 32

function scryptAsync(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      KEYLEN,
      {N: n, r, p, maxmem: 64 * 1024 * 1024},
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  )
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password.normalize('NFKC'), salt, N, R, P)
  return [
    'scrypt',
    N,
    R,
    P,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$')
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
) {
  if (!stored) return false
  const [alg, n, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await scryptAsync(
    password.normalize('NFKC'),
    Buffer.from(salt, 'base64'),
    Number(n),
    Number(r),
    Number(p),
  )
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// No 0/o, 1/l/i: these get read aloud and typed on phones
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

/** e.g. "k7mq-x2vd-9rta-hp3e": ~79 bits, easy to type on a phone. */
export function generatePassword(groups = 4, size = 4) {
  return Array.from({length: groups}, () =>
    Array.from({length: size}, () => ALPHABET[randomInt(ALPHABET.length)]).join(
      '',
    ),
  ).join('-')
}

export const MIN_PASSWORD_LENGTH = 10
