import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");

// Map plan codes to tiers
const PLAN_TO_TIER: Record<string, string> = {
  PLN_cvwhsqa7cyk1570: "tier1", // Pro
  PLN_rh3snaiqlwdl7gx: "tier2", // Premium
};

function inferTierFromPlanCode(planCode: string): string {
  return PLAN_TO_TIER[planCode] || "free";
}

function inferTierFromAmount(amountInKobo: number): string {
  // Fallback: infer from amount if plan code not available
  if (amountInKobo === 9900) return "tier1";
  if (amountInKobo === 14900) return "tier2";
  return "free";
}

async function verifySignature(req: Request, body: string): Promise<boolean> {
  const signature = req.headers.get("x-paystack-signature");
  if (!signature || !PAYSTACK_SECRET_KEY) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(PAYSTACK_SECRET_KEY),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === signature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();

    const isValid = await verifySignature(req, body);
    if (!isValid) {
      console.warn("[paystack-webhook] Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const event = JSON.parse(body);
    console.log(`[paystack-webhook] Event: ${event.event}`);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    switch (event.event) {
      case "charge.success": {
        const data = event.data;
        const userId = data.metadata?.user_id;
        const planCode = data.metadata?.plan_code || data.plan?.plan_code;
        const paymentType = data.metadata?.payment_type; // "annual" for one-time annual
        const tier = planCode ? inferTierFromPlanCode(planCode) : (data.metadata?.tier || inferTierFromAmount(data.amount));

        // Store transaction
        await supabase.from("paystack_transactions").upsert({
          reference: data.reference,
          user_id: userId,
          amount: data.amount,
          currency: data.currency,
          status: data.status,
          channel: data.channel,
          paid_at: data.paid_at,
          metadata: data.metadata,
        }, { onConflict: "reference" });

        // Update subscription if user_id available
        if (userId && tier !== "free") {
          const periodEnd = new Date();
          if (paymentType === "annual") {
            // Annual one-time: grant 12 months access
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          } else {
            // Monthly subscription: Paystack handles recurring via plan
            periodEnd.setMonth(periodEnd.getMonth() + 1);
          }

          await supabase.from("subscriptions").upsert({
            user_id: userId,
            tier,
            status: "active",
            paystack_plan_code: planCode || null,
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
          console.log(`[paystack-webhook] Activated ${tier} (${paymentType || "monthly"}) for user ${userId}, expires: ${periodEnd.toISOString()}`);
        }
        break;
      }

      case "subscription.create": {
        const data = event.data;
        const userId = data.metadata?.user_id || data.customer?.metadata?.user_id;
        const planCode = data.plan?.plan_code;
        const tier = planCode ? inferTierFromPlanCode(planCode) : "free";

        if (userId) {
          await supabase.from("subscriptions").upsert({
            user_id: userId,
            paystack_subscription_code: data.subscription_code,
            paystack_customer_code: data.customer?.customer_code,
            paystack_email_token: data.email_token,
            paystack_plan_code: planCode,
            tier,
            status: "active",
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
          console.log(`[paystack-webhook] Subscription created: ${data.subscription_code} for user ${userId}, tier: ${tier}`);
        }
        break;
      }

      case "subscription.not_renew": {
        const data = event.data;
        const subCode = data.subscription_code;
        if (subCode) {
          await supabase.from("subscriptions")
            .update({
              status: "non-renewing",
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("paystack_subscription_code", subCode);
          console.log(`[paystack-webhook] Subscription not renewing: ${subCode}`);
        }
        break;
      }

      case "subscription.disable": {
        const data = event.data;
        const subCode = data.subscription_code;
        if (subCode) {
          await supabase.from("subscriptions")
            .update({
              status: "cancelled",
              tier: "free",
              updated_at: new Date().toISOString(),
            })
            .eq("paystack_subscription_code", subCode);
          console.log(`[paystack-webhook] Subscription disabled: ${subCode}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const data = event.data;
        const subCode = data.subscription?.subscription_code;
        if (subCode) {
          await supabase.from("subscriptions")
            .update({ status: "attention", updated_at: new Date().toISOString() })
            .eq("paystack_subscription_code", subCode);
          console.log(`[paystack-webhook] Invoice payment failed for subscription: ${subCode}`);
        }
        break;
      }

      case "invoice.create":
      case "invoice.update": {
        console.log(`[paystack-webhook] Invoice event: ${event.event}, status: ${event.data?.status}`);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
