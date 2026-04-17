import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const UNIVERSAL_RESOLVER = "0xC8df368b5774a38F3A2A82936aD676bC81333B39";

const baseMainnetClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org"),
});

export async function resolveBasenameAndAvatar(address: `0x${string}`) {
  try {
    const basename = await baseMainnetClient.getEnsName({
      address,
      universalResolverAddress: UNIVERSAL_RESOLVER,
    });

    let avatar: string | null = null;

    if (basename) {
      avatar = await baseMainnetClient.getEnsAvatar({
        name: basename,
        universalResolverAddress: UNIVERSAL_RESOLVER,
      });
    }

    return { basename, avatar };
  } catch (error) {
    console.error(`[Basename] Lookup failed for ${address}:`, error);
    return { basename: null, avatar: null };
  }
}
