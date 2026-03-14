import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  test?: boolean;
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = { maxRequests: 10, windowMs: 60 * 1000 };

function checkRateLimit(clientIP: string, to: string) {
  const key = `${clientIP}-${to}`;
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT.windowMs });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, resetTime: record.resetTime };
  }

  record.count++;
  return { allowed: true };
}

serve(async (req) => {
  console.log("📧 send-email called:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Auth check - allow service-role calls (from other edge functions) and authenticated users
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "METHOD_NOT_ALLOWED" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return new Response(
      JSON.stringify({ success: false, error: "INVALID_CONTENT_TYPE" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let emailRequest: EmailRequest;
  try {
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim() === "") throw new Error("Empty body");
    emailRequest = JSON.parse(rawBody);
  } catch (err) {
    console.error("❌ JSON parse failed:", err);
    return new Response(
      JSON.stringify({ success: false, error: "INVALID_JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!emailRequest.to || !emailRequest.subject) {
    return new Response(
      JSON.stringify({ success: false, error: "INVALID_PAYLOAD", message: "Missing to or subject" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const toArray = Array.isArray(emailRequest.to) ? emailRequest.to : [emailRequest.to];
  for (const email of toArray) {
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: "INVALID_EMAIL", message: `Invalid email format: ${email}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Validate subject/content length limits
  if (emailRequest.subject.length > 500) {
    return new Response(
      JSON.stringify({ success: false, error: "INVALID_PAYLOAD", message: "Subject too long (max 500 chars)" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (emailRequest.html && emailRequest.html.length > 100000) {
    return new Response(
      JSON.stringify({ success: false, error: "INVALID_PAYLOAD", message: "HTML content too large" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (emailRequest.test === true) {
    return new Response(
      JSON.stringify({ success: true, message: "Email service reachable" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Rate limit
  const clientIP = req.headers.get("x-forwarded-for") || "unknown";
  const toEmail = Array.isArray(emailRequest.to) ? emailRequest.to[0] : emailRequest.to;
  const rateCheck = checkRateLimit(clientIP, toEmail);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ success: false, error: "RATE_LIMIT_EXCEEDED" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  const defaultFrom = Deno.env.get("DEFAULT_FROM_EMAIL") || "info@rebookedsolutions.co.za";

  if (!brevoApiKey) {
    console.error("❌ BREVO_API_KEY missing");
    return new Response(
      JSON.stringify({ success: false, error: "EMAIL_NOT_CONFIGURED" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const recipientEmails = Array.isArray(emailRequest.to) ? emailRequest.to : [emailRequest.to];
  const recipients = recipientEmails.map((email) => ({ email }));

  const brevoPayload: Record<string, unknown> = {
    sender: { email: emailRequest.from || defaultFrom },
    to: recipients,
    subject: emailRequest.subject,
  };

  if (emailRequest.html) brevoPayload.htmlContent = emailRequest.html;
  if (emailRequest.text) brevoPayload.textContent = emailRequest.text;
  if (emailRequest.replyTo) brevoPayload.replyTo = { email: emailRequest.replyTo };

  try {
    console.log("📧 Sending via Brevo API...");
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(brevoPayload),
    });

    const responseData = await response.json();
    if (!response.ok) {
      console.error("❌ Brevo error:", responseData);
      return new Response(
        JSON.stringify({ success: false, error: "EMAIL_SEND_FAILED", message: responseData.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Email sent:", responseData);
    return new Response(
      JSON.stringify({ success: true, messageId: responseData.messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("❌ Email send failed:", err);
    return new Response(
      JSON.stringify({ success: false, error: "EMAIL_SEND_FAILED", message: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
