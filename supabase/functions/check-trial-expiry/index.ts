import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const nowIso = now.toISOString();
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Check for trials expiring in ~3 days (to send warning)
    const { data: comingSoon, error: soonError } = await supabase
      .from("code_redemptions")
      .select("id, user_id, trial_ends_at, expiry_warning_sent_at")
      .eq("redemption_type", "trial")
      .eq("status", "active")
      .lte("trial_ends_at", inThreeDays)
      .gt("trial_ends_at", nowIso)
      .is("expiry_warning_sent_at", null);

    if (soonError) console.error("Error fetching expiring soon trials:", soonError);

    if (comingSoon && comingSoon.length > 0) {
      console.log(`Sending expiry warnings to ${comingSoon.length} users`);
      for (const trial of comingSoon) {
        try {
          const { data: { user } } = await supabase.auth.admin.getUserById(trial.user_id);
          if (user?.email) {
            const endsAt = new Date(trial.trial_ends_at!);
            const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            await supabase.functions.invoke("send-email", {
              body: {
                to: user.email,
                template: "trial_expiry",
                props: { name: user.user_metadata?.first_name || "there", daysLeft: Math.max(daysLeft, 1) }
              }
            });
            await supabase.from("code_redemptions").update({ expiry_warning_sent_at: nowIso }).eq("id", trial.id);
          }
        } catch (warnErr) {
          console.error(`Failed to warn user ${trial.user_id}:`, warnErr);
        }
      }
    }

    // 2. Find all active trial redemptions that have ALREADY expired (existing logic)
    const { data: expiredTrials, error: fetchError } = await supabase
      .from("code_redemptions")
      .select("id, user_id, trial_tier, trial_ends_at")
      .eq("redemption_type", "trial")
      .eq("status", "active")
      .lte("trial_ends_at", nowIso);

    if (fetchError) {
      console.error("Error fetching expired trials:", fetchError);
      throw fetchError;
    }

    if (!expiredTrials || expiredTrials.length === 0) {
      console.log("No expired trials found");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${expiredTrials.length} expired trial(s) to process`);

    let processed = 0;

    for (const trial of expiredTrials) {
      try {
        // Check if user has a paid subscription (paystack_subscription_code present)
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("paystack_subscription_code, tier, status")
          .eq("user_id", trial.user_id)
          .single();

        // Only downgrade if they don't have a paid subscription
        if (!sub?.paystack_subscription_code) {
          await supabase
            .from("subscriptions")
            .update({
              tier: "free",
              status: "active",
              current_period_start: null,
              current_period_end: null,
            })
            .eq("user_id", trial.user_id);

          console.log(`Downgraded user ${trial.user_id} to free tier (trial expired)`);
        } else {
          console.log(`User ${trial.user_id} has paid subscription, skipping downgrade`);
        }

        // Mark redemption as expired
        await supabase
          .from("code_redemptions")
          .update({ status: "expired" })
          .eq("id", trial.id);

        processed++;
      } catch (err) {
        console.error(`Error processing trial ${trial.id}:`, err);
      }
    }

    console.log(`Processed ${processed} expired trials`);

    return new Response(JSON.stringify({ processed, total: expiredTrials.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in check-trial-expiry:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
