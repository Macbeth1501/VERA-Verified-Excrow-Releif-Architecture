/** Public block explorer for Polygon Amoy: where anyone can verify the app's numbers themselves. */
export const EXPLORER_BASE_URL = "https://amoy.polygonscan.com";

/** Explorer link for an address (account or contract). */
export const explorerAddressUrl = (address: string) => `${EXPLORER_BASE_URL}/address/${address}`;
/** Explorer link for a transaction hash. */
export const explorerTxUrl = (txHash: string) => `${EXPLORER_BASE_URL}/tx/${txHash}`;
