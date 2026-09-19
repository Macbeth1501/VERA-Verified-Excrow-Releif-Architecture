import { createPublicClient, createWalletClient, erc20Abi, fallback, http, parseAbi, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { decryptSecret } from "../auth/crypto";
import type { DonationChain, ReceiptState, SendParams } from "../donations/chain-port";
import { getEnv, parseRpcUrls } from "../env";
import { gasPriceRefusal, topUpGas } from "./sponsor";

const mockInrAbi = parseAbi(["function mint(address to, uint256 amount)"]);
const vaultAbi = parseAbi([
  "function deposit(uint256 amount)",
  "event DonationReceived(address indexed donor, uint256 amount, uint256 newBalance)",
]);

/**
 * Gas allowance for one whole donation (mint, optional fee transfer, approve, deposit come to
 * roughly 250,000 gas). Generous on purpose: leftover POL stays in the donor's wallet for next time.
 */
const DONATION_GAS_UNITS = 500_000n;

function transport() {
  return fallback(parseRpcUrls(getEnv().RPC_URL).map((url) => http(url, { timeout: 20_000, retryCount: 1 })));
}

/** Donations need the sponsor key (donor wallets have no POL) and an indexed campaign vault. */
export function donationsConfigured(): boolean {
  return Boolean(getEnv().FACTORY_OWNER_KEY);
}

/**
 * The real donation chain: every transaction is sent from the DONOR's own generated wallet (the
 * server decrypts its key), so on-chain the donation truly comes from the donor. The platform only
 * sponsors the gas. Each method sends one transaction and returns its hash without waiting.
 */
export function createDonationChain(): DonationChain {
  const env = getEnv();
  const publicClient = createPublicClient({ chain: polygonAmoy, transport: transport() });
  const token = env.MOCK_INR_ADDRESS as `0x${string}`;

  const walletFor = (p: SendParams) =>
    createWalletClient({
      account: privateKeyToAccount(decryptSecret(p.donorKeyEnc, env.WALLET_ENCRYPTION_KEY) as `0x${string}`),
      chain: polygonAmoy,
      transport: transport(),
    });

  return {
    async fundGas(donorAddress) {
      const gasPrice = await publicClient.getGasPrice();
      const tooExpensive = gasPriceRefusal(gasPrice);
      if (tooExpensive) throw new Error(tooExpensive);
      const result = await topUpGas(donorAddress, (DONATION_GAS_UNITS * gasPrice * 15n) / 10n, { wait: false });
      if (!result.ok) throw new Error(result.error);
      return { txHash: result.txHash };
    },

    sendMint(p) {
      return walletFor(p).writeContract({ address: token, abi: mockInrAbi, functionName: "mint", args: [p.donorAddress as `0x${string}`, p.amount] });
    },

    sendFee(p) {
      if (!env.PLATFORM_FEE_ADDRESS) throw new Error("no fee address configured");
      return walletFor(p).writeContract({
        address: token, abi: erc20Abi, functionName: "transfer", args: [env.PLATFORM_FEE_ADDRESS as `0x${string}`, p.amount],
      });
    },

    sendApprove(p) {
      return walletFor(p).writeContract({
        address: token, abi: erc20Abi, functionName: "approve", args: [p.vault as `0x${string}`, p.amount],
      });
    },

    sendDeposit(p) {
      return walletFor(p).writeContract({ address: p.vault as `0x${string}`, abi: vaultAbi, functionName: "deposit", args: [p.amount] });
    },

    async receipt(txHash, waitMs): Promise<ReceiptState> {
      const hash = txHash as `0x${string}`;
      try {
        const receipt =
          waitMs > 0
            ? await publicClient.waitForTransactionReceipt({ hash, timeout: waitMs })
            : await publicClient.getTransactionReceipt({ hash });
        return receipt.status === "success" ? "success" : "reverted";
      } catch (err) {
        // Not mined yet (or the wait timed out): that is "pending", not an error.
        const name = err instanceof Error ? err.name : "";
        if (name === "TransactionReceiptNotFoundError" || name === "WaitForTransactionReceiptTimeoutError") return "pending";
        throw err;
      }
    },

    async verifyDeposit(txHash, { vault, donorAddress, amount }) {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
      if (receipt.status !== "success") return false;
      return parseEventLogs({ abi: vaultAbi, eventName: "DonationReceived", logs: receipt.logs }).some(
        (log) =>
          log.address.toLowerCase() === vault.toLowerCase() &&
          log.args.donor?.toLowerCase() === donorAddress.toLowerCase() &&
          log.args.amount === amount,
      );
    },
  };
}
