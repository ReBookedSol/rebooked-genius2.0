import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Code is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedCode = code.trim().toUpperCase();

    // Look up the code
    const { data: codeData, error: codeError } = await supabase
      .from("coupon_codes")
      .select("*")
      .eq("code", trimmedCode)
      .eq("is_active", true)
      .single();

    if (codeError || !codeData) {
      return new Response(JSON.stringify({ error: "Invalid or expired code" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check validity dates
    const now = new Date();
    if (codeData.valid_from && new Date(codeData.valid_from) > now) {
      return new Response(JSON.stringify({ error: "This code is not yet active" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (codeData.valid_until && new Date(codeData.valid_until) < now) {
      return new Response(JSON.stringify({ error: "This code has expired" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check max uses
    if (codeData.max_uses && codeData.current_uses >= codeData.max_uses) {
      return new Response(JSON.stringify({ error: "This code has reached its maximum uses" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already redeemed this code
    const { data: existing } = await supabase
      .from("code_redemptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("code_id", codeData.id)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ error: "You have already redeemed this code" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isTrialCode = codeData.trial_days && codeData.trial_days > 0;

    if (isTrialCode) {
      // --- TRIAL CODE FLOW ---
      const trialTier = codeData.trial_tier || "tier2";
      const trialDays = codeData.trial_days;
      const trialStart = new Date();
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + trialDays);

      // Record redemption
      await supabase.from("code_redemptions").insert({
        user_id: user.id,
        code_id: codeData.id,
        code: trimmedCode,
        redemption_type: "trial",
        trial_tier: trialTier,
        trial_starts_at: trialStart.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        status: "active",
      });

      // Update subscription to trial tier
      await supabase
        .from("subscriptions")
        .update({
          tier: trialTier,
          status: "active",
          current_period_start: trialStart.toISOString(),
          current_period_end: trialEnd.toISOString(),
        })
        .eq("user_id", user.id);

      // Increment usage count
      await supabase
        .from("coupon_codes")
        .update({ current_uses: codeData.current_uses + 1 })
        .eq("id", codeData.id);

      return new Response(JSON.stringify({
        success: true,
        type: "trial",
        message: `${trialDays}-day free trial of ${trialTier === "tier2" ? "Premium" : "Pro"} activated!`,
        trial_ends_at: trialEnd.toISOString(),
        tier: trialTier,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // --- DISCOUNT CODE FLOW ---
      // Record redemption
      await supabase.from("code_redemptions").insert({
        user_id: user.id,
        code_id: codeData.id,
        code: trimmedCode,
        redemption_type: "discount",
        discount_type: codeData.discount_type,
        discount_value: codeData.discount_value,
        status: "active",
      });

      // Increment usage count
      await supabase
        .from("coupon_codes")
        .update({ current_uses: codeData.current_uses + 1 })
        .eq("id", codeData.id);

      return new Response(JSON.stringify({
        success: true,
        type: "discount",
        message: `Code applied! ${codeData.discount_type === "percentage" ? `${codeData.discount_value}% off` : `R${codeData.discount_value} off`} your next subscription.`,
        discount_type: codeData.discount_type,
        discount_value: codeData.discount_value,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error redeeming code:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
