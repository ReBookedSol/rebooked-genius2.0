import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");

const PLAN_TO_TIER: Record<string, string> = {
  PLN_cvwhsqa7cyk1570: "tier1",
  PLN_rh3snaiqlwdl7gx: "tier2",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { reference } = await req.json();
    if (!reference) {
      return new Response(JSON.stringify({ error: "Reference is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[paystack-verify] Verifying transaction: ${reference} for user ${user.id}`);

    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });

    if (!paystackResponse.ok) {
      return new Response(JSON.stringify({ success: false, error: "Failed to verify payment with Paystack" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const paystackData = await paystackResponse.json();

    if (!paystackData.status || paystackData.data?.status !== "success") {
      return new Response(JSON.stringify({ success: false, error: "Payment not verified", status: paystackData.data?.status }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const txData = paystackData.data;

    // Determine tier from plan code in metadata or from the plan object
    const planCode = txData.metadata?.plan_code || txData.plan?.plan_code;
    const tier = planCode ? (PLAN_TO_TIER[planCode] || txData.metadata?.tier || "free") : (txData.metadata?.tier || "free");

    // Security check
    if (txData.metadata?.user_id && txData.metadata.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "User mismatch" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idempotency check
    const { data: existingTx } = await supabase.from("paystack_transactions").select("id, status").eq("reference", txData.reference).maybeSingle();
    if (existingTx?.status === "success") {
      return new Response(JSON.stringify({ success: true, tier, already_processed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Save transaction
    await supabase.from("paystack_transactions").upsert({
      reference: txData.reference,
      user_id: user.id,
      amount: txData.amount,
      currency: txData.currency,
      status: txData.status,
      channel: txData.channel,
      paid_at: txData.paid_at,
      metadata: txData.metadata,
    }, { onConflict: "reference" });

    // Cancel any existing active subscription on Paystack before activating the new one
    try {
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("paystack_subscription_code, tier, status")
        .eq("user_id", user.id)
        .in("status", ["active", "non-renewing"])
        .single();

      if (existingSub?.paystack_subscription_code && existingSub.tier !== tier && existingSub.tier !== "free") {
        console.log(`[paystack-verify] Cancelling old ${existingSub.tier} subscription before activating ${tier}`);
        const cancelResponse = await fetch("https://api.paystack.co/subscription/disable", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: existingSub.paystack_subscription_code,
            token: existingSub.paystack_subscription_code,
          }),
        });
        const cancelData = await cancelResponse.json();
        console.log(`[paystack-verify] Cancel old subscription response:`, JSON.stringify(cancelData));
      }
    } catch (cancelErr) {
      console.warn("[paystack-verify] Could not cancel old subscription (may not exist):", cancelErr);
    }

    // Activate subscription - check if annual
    const isAnnual = txData.metadata?.payment_type === "annual";
    const periodEnd = new Date();
    if (isAnnual) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    await supabase.from("subscriptions").upsert({
      user_id: user.id,
      tier,
      status: "active",
      paystack_plan_code: planCode || null,
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    console.log(`[paystack-verify] Activated ${tier} for user ${user.id}`);

    return new Response(JSON.stringify({ success: true, tier }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
