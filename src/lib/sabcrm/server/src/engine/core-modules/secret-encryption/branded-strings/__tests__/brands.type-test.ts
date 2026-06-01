// Compile-time brand invariant assertions.
// If the brand contract is violated, tsc fails. There are no runtime expectations.

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
  ? 1
  : 2
  ? true
  : false;
type Expect<T extends true> = T;

import { type EncryptedString } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type";
import { type PlaintextString } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type";

// Raw `string` is NOT assignable to either brand (the structural anchor
// of the hard brand). A failure here means the brand became soft.
type RawStringIsNotAssignableToEncrypted = Expect<
  Equal<string extends EncryptedString ? true : false, false>
>;

type RawStringIsNotAssignableToPlaintext = Expect<
  Equal<string extends PlaintextString ? true : false, false>
>;

// Both brands erase to `string` for read-only consumers (logging, DB
// writes, GraphQL responses). A failure here means the brand became a
// disjoint type and would force unnecessary coercion across the codebase.
type EncryptedErasesToString = Expect<
  Equal<EncryptedString extends string ? true : false, true>
>;

type PlaintextErasesToString = Expect<
  Equal<PlaintextString extends string ? true : false, true>
>;

// The two brands are not interchangeable: passing ciphertext where
// plaintext is expected (or vice versa) must be a type error.
type EncryptedIsNotAssignableToPlaintext = Expect<
  Equal<EncryptedString extends PlaintextString ? true : false, false>
>;

type PlaintextIsNotAssignableToEncrypted = Expect<
  Equal<PlaintextString extends EncryptedString ? true : false, false>
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type BrandInvariants = [
  RawStringIsNotAssignableToEncrypted,
  RawStringIsNotAssignableToPlaintext,
  EncryptedErasesToString,
  PlaintextErasesToString,
  EncryptedIsNotAssignableToPlaintext,
  PlaintextIsNotAssignableToEncrypted,
];
