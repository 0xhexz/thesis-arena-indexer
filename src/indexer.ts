import { publicClient } from "./lib/viem";
import { supabase } from "./lib/supabase";
import { thesisArenaAbi } from "./abi/ThesisArena";
import { handlePostCreated } from "./handlers/postCreated";
import { handleThesisBacked } from "./handlers/thesisBacked";
import { handleThesisChallenged } from "./handlers/thesisChallenged";
import { handlePollVoted } from "./handlers/pollVoted";
import { handlePostFinalized } from "./handlers/postFinalized";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}`;
const START_BLOCK = BigInt(process.env.START_BLOCK || "0");

if (!CONTRACT_ADDRESS) {
  throw new Error("Missing CONTRACT_ADDRESS");
}

async function updateIndexerState(blockNumber: bigint) {
  const { error } = await supabase.rpc("update_indexer_state_monotonic", {
    new_block: blockNumber.toString()
  });

  if (error) {
    throw new Error(`Failed to update indexer_state: ${error.message}`);
  }
}

async function processLog(log: any) {
  switch (log.eventName) {
    case "PostCreated":
      await handlePostCreated(log);
      break;
    case "ThesisBacked":
      await handleThesisBacked(log);
      break;
    case "ThesisChallenged":
      await handleThesisChallenged(log);
      break;
    case "PollVoted":
      await handlePollVoted(log);
      break;
    case "PostFinalized":
      await handlePostFinalized(log);
      break;
    default:
      console.warn("Unknown event:", log.eventName);
  }
}

async function runBackfill(fromBlock: bigint, toBlock: bigint) {
  if (toBlock < fromBlock) return;

  const logs = await publicClient.getContractEvents({
    address: CONTRACT_ADDRESS,
    abi: thesisArenaAbi,
    fromBlock,
    toBlock
  });

  for (const log of logs) {
    await processLog(log);
  }
}

function getHighestBlock(logs: any[]): bigint {
  let highestBlock = 0n;
  for (const log of logs) {
    if (log.blockNumber > highestBlock) highestBlock = log.blockNumber;
  }
  return highestBlock;
}

export async function startIndexer() {
  console.log("Starting Thesis Arena Indexer...");

  const { data, error } = await supabase
    .from("indexer_state")
    .select("last_synced_block")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read indexer_state: ${error.message}`);
  }

  let lastSyncedBlock =
    data && BigInt(data.last_synced_block) > 0n
      ? BigInt(data.last_synced_block)
      : START_BLOCK;

  const currentBlock = await publicClient.getBlockNumber();

  if (currentBlock > lastSyncedBlock) {
    console.log(`Backfilling from ${lastSyncedBlock + 1n} to ${currentBlock}`);
    await runBackfill(lastSyncedBlock + 1n, currentBlock);
    await updateIndexerState(currentBlock);
    lastSyncedBlock = currentBlock;
  }

  console.log("Starting watcher...");

  publicClient.watchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: thesisArenaAbi,
    onLogs: async (logs) => {
      try {
        for (const log of logs) {
          await processLog(log);
        }

        if (logs.length > 0) {
          const highestBlock = getHighestBlock(logs);
          await updateIndexerState(highestBlock);
        }
      } catch (error) {
        console.error("[FATAL] Watcher failed. Exiting.", error);
        process.exit(1);
      }
    }
  });

  const newCurrentBlock = await publicClient.getBlockNumber();
  if (newCurrentBlock > lastSyncedBlock) {
    console.log(
      `Overlap backfill from ${lastSyncedBlock + 1n} to ${newCurrentBlock}`
    );
    await runBackfill(lastSyncedBlock + 1n, newCurrentBlock);
    await updateIndexerState(newCurrentBlock);
  }

  console.log("Indexer fully synced and watching.");
}