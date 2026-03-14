import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");

// Annual one-time payment amounts in kobo (cents)
const ANNUAL_AMOUNTS: Record<string, number> = {
  tier1: 79 * 12 * 100, // R79 * 12 = R948 = 94800 kobo
  tier2: 129 * 12 * 100, // R129 * 12 = R1548 = 154800 kobo
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

    const { tier } = await req.json();

    if (!tier || !ANNUAL_AMOUNTS[tier]) {
      return new Response(JSON.stringify({ error: "Invalid tier. Use 'tier1' or 'tier2'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const amount = ANNUAL_AMOUNTS[tier];
    const userEmail = user.email;

    console.log(`[paystack-annual] Creating annual payment for user ${user.id}, tier: ${tier}, amount: ${amount}`);

    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/[^/]*$/, "") || "https://h-plain-and-simple.lovable.app";

    // One-time transaction (no plan code = no recurring subscription)
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userEmail,
        amount,
        currency: "ZAR",
        callback_url: `${origin}/payment-success`,
        metadata: {
          user_id: user.id,
          tier,
          payment_type: "annual",
          custom_fields: [
            { display_name: "Tier", variable_name: "tier", value: tier },
            { display_name: "Payment Type", variable_name: "payment_type", value: "annual" },
            { display_name: "User ID", variable_name: "user_id", value: user.id },
          ],
        },
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      throw new Error(paystackData.message || "Failed to initialize transaction");
    }

    return new Response(
      JSON.stringify({
        success: true,
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error initializing annual payment:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
