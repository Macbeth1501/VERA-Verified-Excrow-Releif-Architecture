import { z } from "zod";
import { isAddress } from "viem";
import { MIN_PASSWORD_LENGTH } from "./password";

const email = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email("Enter a valid email address"));

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(128);

/**
 * Registration input. By default a wallet is generated for the donor. The advanced option lets
 * a donor bring their own address instead (no key is ever stored for it).
 */
export const registerSchema = z.object({
  email,
  password,
  walletAddress: z
    .string()
    .refine((v) => isAddress(v, { strict: false }), "Enter a valid wallet address")
    .optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
