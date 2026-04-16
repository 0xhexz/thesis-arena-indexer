import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const rpcUrl = process.env.BASE_RPC_URL;

if (!rpcUrl) {
  throw new Error("Missing BASE_RPC_URL");
}

export const publicClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl)
});