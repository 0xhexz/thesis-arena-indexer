import { supabase } from "../lib/supabase";
import { normalizeAddress } from "../lib/utils";

export async function handlePostCreated(log: any) {
  const { postId, creator, postType, metadataURI, createdAt, expiresAt } = log.args;
  const creatorAddress = normalizeAddress(creator);
  const isPoll = postType === 1;

  let metadata: any;

  try {
    const res = await fetch(metadataURI);
    if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
    metadata = await res.json();

    if (!metadata || typeof metadata.caption !== "string") {
      throw new Error("Missing or invalid caption");
    }

    if (isPoll) {
      if (!Array.isArray(metadata.options) || metadata.options.length < 2) {
        throw new Error("Invalid poll options");
      }
    }
  } catch (error) {
    console.error(`[PostCreated] Metadata error for post ${postId}:`, error);
    return;
  }

  await supabase
    .from("profiles")
    .upsert({ wallet_address: creatorAddress }, { onConflict: "wallet_address" });

  const { error: postError } = await supabase.from("posts").insert({
    contract_post_id: postId.toString(),
    creator_address: creatorAddress,
    type: isPoll ? "poll" : "thesis",
    caption: metadata.caption,
    metadata_uri: metadataURI,
    created_at: new Date(Number(createdAt) * 1000).toISOString(),
    expires_at: new Date(Number(expiresAt) * 1000).toISOString(),
    tx_hash: log.transactionHash,
    block_number: log.blockNumber.toString(),
    log_index: log.logIndex
  });

  if (postError && postError.code === "23505") return;
  if (postError) throw postError;

  if (isPoll) {
    const optionsToInsert = metadata.options.map((text: string, index: number) => ({
      contract_post_id: postId.toString(),
      option_index: index,
      option_text: text
    }));

    const { error: optionsError } = await supabase
      .from("poll_options")
      .insert(optionsToInsert);

    if (optionsError) throw optionsError;
  }

  await supabase.rpc("increment_post_count", {
    user_wallet: creatorAddress
  });
}