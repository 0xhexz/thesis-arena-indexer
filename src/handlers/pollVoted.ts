import { supabase } from "../lib/supabase";
import { normalizeAddress, getBlockTimestamp } from "../lib/utils";

export async function handlePollVoted(log: any) {
  const { postId, user, optionIndex, optionVoteCount, totalVotes } = log.args;
  const userAddress = normalizeAddress(user);
  const blockTimestamp = await getBlockTimestamp(log.blockNumber);

  await supabase
    .from("profiles")
    .upsert({ wallet_address: userAddress }, { onConflict: "wallet_address" });

  const { error: eventError } = await supabase.from("interaction_events").insert({
    contract_post_id: postId.toString(),
    user_address: userAddress,
    type: "vote",
    created_at: blockTimestamp.toISOString(),
    tx_hash: log.transactionHash,
    block_number: log.blockNumber.toString(),
    log_index: log.logIndex
  });

  if (eventError && eventError.code === "23505") return;
  if (eventError) throw eventError;

  const { error: userVoteError } = await supabase.from("user_poll_votes").insert({
    contract_post_id: postId.toString(),
    user_address: userAddress,
    option_index: optionIndex,
    created_at: blockTimestamp.toISOString(),
    tx_hash: log.transactionHash,
    block_number: log.blockNumber.toString(),
    log_index: log.logIndex
  });

  if (userVoteError && userVoteError.code !== "23505") throw userVoteError;

  await supabase
    .from("poll_options")
    .update({
      vote_count: optionVoteCount.toString()
    })
    .eq("contract_post_id", postId.toString())
    .eq("option_index", optionIndex);

  await supabase
    .from("posts")
    .update({
      total_votes_count: totalVotes.toString(),
      updated_at: new Date().toISOString()
    })
    .eq("contract_post_id", postId.toString());

  await supabase.rpc("increment_engagement_count", {
    user_wallet: userAddress
  });
}