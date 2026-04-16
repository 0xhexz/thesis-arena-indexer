import { supabase } from "../lib/supabase";

export async function handlePostFinalized(log: any) {
  const { postId, finalizedAt } = log.args;

  const { error } = await supabase
    .from("posts")
    .update({
      is_finalized: true,
      finalized_at: new Date(Number(finalizedAt) * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("contract_post_id", postId.toString());

  if (error) throw error;
}