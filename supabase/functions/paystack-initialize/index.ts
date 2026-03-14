import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");

// Pre-created plan codes on Paystack dashboard
const PLAN_CODES: Record<string, string> = {
  tier1: "PLN_cvwhsqa7cyk1570", // Pro
  tier2: "PLN_rh3snaiqlwdl7gx", // Premium
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

    if (!tier || !PLAN_CODES[tier]) {
      return new Response(JSON.stringify({ error: "Invalid tier. Use 'tier1' or 'tier2'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const planCode = PLAN_CODES[tier];
    const userEmail = user.email;

    // First, fetch the plan from Paystack to get its amount
    console.log(`[paystack-initialize] Fetching plan ${planCode} from Paystack...`);
    const planResponse = await fetch(`https://api.paystack.co/plan/${planCode}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const planData = await planResponse.json();
    console.log(`[paystack-initialize] Plan response:`, JSON.stringify(planData));

    const planAmount = planData.data?.amount;
    if (!planAmount) {
      throw new Error(`Could not fetch plan amount for ${planCode}`);
    }

    console.log(`[paystack-initialize] Creating subscription for user ${user.id}, tier: ${tier}, plan: ${planCode}, amount: ${planAmount}`);

    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/[^/]*$/, "") || "https://h-plain-and-simple.lovable.app";

    // Initialize transaction with plan code and the plan's own amount
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userEmail,
        amount: planAmount,
        plan: planCode,
        callback_url: `${origin}/payment-success`,
        metadata: {
          user_id: user.id,
          tier,
          plan_code: planCode,
          custom_fields: [
            { display_name: "Tier", variable_name: "tier", value: tier },
            { display_name: "User ID", variable_name: "user_id", value: user.id },
          ],
        },
      }),
    });

    const paystackData = await paystackResponse.json();
    console.log(`[paystack-initialize] Paystack response:`, JSON.stringify(paystackData));

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
    console.error("Error initializing payment:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
