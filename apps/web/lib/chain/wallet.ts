import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export interface GeneratedWallet {
  address: `0x${string}`;
  privateKey: `0x${string}`;
}

/**
 * Creates a fresh testnet wallet for a donor who has no crypto knowledge (FR-IDN-01: no seed
 * phrase in the primary flow). The private key must be encrypted before it is stored.
 */
export function generateWallet(): GeneratedWallet {
  const privateKey = generatePrivateKey();
  return { address: privateKeyToAccount(privateKey).address, privateKey };
}
