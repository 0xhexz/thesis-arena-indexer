import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { resolveBasenameAndAvatar } from "./basenames";
import { supabase } from "../lib/supabase";

export const authRouter = Router();

const baseSepoliaClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_RPC_URL || "https://sepolia.base.org"),
});

const nonceCache = new Map<string, { nonce: string; expires: number }>();

authRouter.get("/nonce", (req, res) => {
  const address = req.query.address as string;

  if (!address) {
    return res.status(400).json({ error: "Address required" });
  }

  const normalizedAddress = address.toLowerCase();
  const nonce = crypto.randomBytes(16).toString("hex");

  nonceCache.set(normalizedAddress, {
    nonce,
    expires: Date.now() + 5 * 60 * 1000,
  });

  return res.json({ nonce });
});

authRouter.post("/verify", async (req, res) => {
  const { address, message, signature } = req.body as {
    address?: string;
    message?: string;
    signature?: `0x${string}`;
  };

  if (!address || !message || !signature) {
    return res.status(400).json({ error: "Missing required payload" });
  }

  const normalizedAddress = address.toLowerCase();

  try {
    const cached = nonceCache.get(normalizedAddress);

    if (!cached || Date.now() > cached.expires || !message.includes(cached.nonce)) {
      return res.status(401).json({ error: "Invalid or expired nonce" });
    }

    const isValid = await baseSepoliaClient.verifyMessage({
      address: address as `0x${string}`,
      message,
      signature,
    });

    if (!isValid) {
      return res.status(401).json({ error: "Verification failed" });
    }

    nonceCache.delete(normalizedAddress);

    const { basename, avatar } = await resolveBasenameAndAvatar(
      address as `0x${string}`
    );

    const profilePayload: Record<string, string> = {
      wallet_address: normalizedAddress,
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (basename) profilePayload.basename = basename;
    if (avatar) profilePayload.avatar_url = avatar;

    const { error: dbError } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "wallet_address" });

    if (dbError) {
      throw dbError;
    }

    const token = jwt.sign(
      { address: normalizedAddress },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      profile: profilePayload,
    });
  } catch (error) {
    console.error("[Auth] Verification error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
