import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");

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

    // Get user's subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("paystack_subscription_code, paystack_customer_code, tier, status")
      .eq("user_id", user.id)
      .single();

    if (!subscription || subscription.tier === 'free') {
      return new Response(JSON.stringify({ error: "No active paid subscription" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let subCode = subscription.paystack_subscription_code;

    // If we don't have the subscription code stored, look it up via Paystack customer API
    if (!subCode) {
      const customerCode = subscription.paystack_customer_code;
      console.log(`[paystack-manage-card] No sub code stored. Customer code: ${customerCode}, email: ${user.email}`);
      
      // Try fetching customer details which includes subscriptions
      if (customerCode) {
        const custRes = await fetch(`https://api.paystack.co/customer/${customerCode}`, {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        });
        const custData = await custRes.json();
        console.log(`[paystack-manage-card] Customer lookup result:`, JSON.stringify(custData?.data?.subscriptions?.length ?? 0), 'subscriptions');

        const subs = custData?.data?.subscriptions;
        if (subs?.length > 0) {
          const activeSub = subs.find((s: any) => s.status === 'active') || subs[0];
          subCode = activeSub.subscription_code;
          
          await supabase.from("subscriptions").update({
            paystack_subscription_code: subCode,
            paystack_email_token: activeSub.email_token || null,
          }).eq("user_id", user.id);
          
          console.log(`[paystack-manage-card] Found and stored sub code: ${subCode}`);
        }
      }

      // Fallback: list all subscriptions filtering by email
      if (!subCode) {
        const listRes = await fetch(`https://api.paystack.co/subscription?customer=${encodeURIComponent(user.email!)}`, {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        });
        const listData = await listRes.json();
        console.log(`[paystack-manage-card] Email fallback:`, listData.data?.length ?? 0, 'subscriptions');

        if (listData.status && listData.data?.length > 0) {
          const activeSub = listData.data.find((s: any) => s.status === 'active') || listData.data[0];
          subCode = activeSub.subscription_code;
          
          await supabase.from("subscriptions").update({
            paystack_subscription_code: subCode,
            paystack_customer_code: activeSub.customer?.customer_code || null,
            paystack_email_token: activeSub.email_token || null,
          }).eq("user_id", user.id);
        }
      }
    }

    if (!subCode) {
      return new Response(JSON.stringify({ error: "No Paystack subscription found. Your plan may have been activated manually or via a one-time payment." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[paystack-manage-card] Generating manage link for subscription ${subCode}`);

    const paystackResponse = await fetch(`https://api.paystack.co/subscription/${subCode}/manage/link`, {
      method: "GET",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      throw new Error(paystackData.message || "Failed to generate manage link");
    }

    return new Response(
      JSON.stringify({ success: true, link: paystackData.data.link }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating manage link:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
