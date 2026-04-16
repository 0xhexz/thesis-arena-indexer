import { publicClient } from "./viem";

export const normalizeAddress = (address: string) => address.toLowerCase();

const blockTimestampCache = new Map<string, Date>();

export async function getBlockTimestamp(blockNumber: bigint): Promise<Date> {
  const key = blockNumber.toString();

  if (blockTimestampCache.has(key)) {
    return blockTimestampCache.get(key)!;
  }

  const block = await publicClient.getBlock({ blockNumber });
  const timestamp = new Date(Number(block.timestamp) * 1000);

  if (blockTimestampCache.size > 1000) {
    blockTimestampCache.clear();
  }

  blockTimestampCache.set(key, timestamp);
  return timestamp;
}