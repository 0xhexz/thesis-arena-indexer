import { supabase } from "../lib/supabase";
import { normalizeAddress, getBlockTimestamp } from "../lib/utils";

export async function handleThesisBacked(log: any) {
  const { postId, user, newBackCount } = log.args;
  const userAddress = normalizeAddress(user);
  const blockTimestamp = await getBlockTimestamp(log.blockNumber);

  await supabase
    .from("profiles")
    .upsert({ wallet_address: userAddress }, { onConflict: "wallet_address" });

  const { error: eventError } = await supabase.from("interaction_events").insert({
    contract_post_id: postId.toString(),
    user_address: userAddress,
    type: "back",
    created_at: blockTimestamp.toISOString(),
    tx_hash: log.transactionHash,
    block_number: log.blockNumber.toString(),
    log_index: log.logIndex
  });

  if (eventError && eventError.code === "23505") return;
  if (eventError) throw eventError;

  await supabase
    .from("posts")
    .update({
      backs_count: newBackCount.toString(),
      updated_at: new Date().toISOString()
    })
    .eq("contract_post_id", postId.toString());

  await supabase.rpc("increment_engagement_count", {
    user_wallet: userAddress
  });
}