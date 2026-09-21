import { sha256Hex } from "../hash";

/**
 * Client-side beneficiary fingerprint (FR-IDN-03, SPDD 17.2). The organizer or field agent types an
 * identifying fragment (a national ID, or name plus date of birth plus village); the browser turns it
 * into an irreversible hash and only that hash is ever sent, so the platform never receives or
 * stores who the person is.
 *
 * The hash is the same wherever it is computed for the same campaign, which is the whole point:
 * registering the same person twice yields the same value, so the duplicate is caught. It is salted
 * per campaign ("program") so a fingerprint from one campaign cannot be matched against another's.
 */

/**
 * Makes trivially different spellings of the same fragment identical: Unicode-compatible form (so the
 * same Devanagari or accented text typed on different keyboards, and full-width digits, match),
 * lower case, and trimmed with inner whitespace collapsed to single spaces.
 */
export function normalizeIdentityFragment(raw: string): string {
  return raw.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * The bytes32 fingerprint sent to the API and the BeneficiaryRegistry: `0x` plus 64 hex characters.
 * Throws when there is nothing to hash (an empty fragment or no salt), because hashing "" would give
 * every blank entry the same fingerprint and make them all look like duplicates of each other.
 */
export async function hashIdentityFragment(rawInput: string, programSalt: string): Promise<string> {
  const fragment = normalizeIdentityFragment(rawInput);
  if (!fragment) throw new Error("Enter an identifying detail for the beneficiary.");
  if (!programSalt) throw new Error("This campaign has no program salt yet, so the beneficiary cannot be fingerprinted.");
  // A NUL between salt and fragment means no salt/fragment split can produce the same input as another.
  return `0x${await sha256Hex(`${programSalt}\u0000${fragment}`)}`;
}
