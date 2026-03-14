import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Subscription Enforcement Cron
 * 
 * Runs daily to:
 * 1. Check for expired subscriptions and downgrade to free
 * 2. Send payment failed emails (day 1)
 * 3. Block access after 3 days unpaid  
 * 4. Send archive warning (day 14)
 * 5. Send final notice (day 30)
 * 6. Delete excess content (day 31)
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const results: string[] = [];

    // 1. Find subscriptions that have expired (current_period_end < now) and are still active/cancelled
    const { data: expiredSubs } = await supabase
      .from('subscriptions')
      .select('user_id, tier, current_period_end, status, cancelled_at')
      .in('status', ['active', 'non-renewing', 'cancelled'])
      .not('current_period_end', 'is', null)
      .lt('current_period_end', now.toISOString());

    if (expiredSubs && expiredSubs.length > 0) {
      for (const sub of expiredSubs) {
        // Downgrade to free
        await supabase
          .from('subscriptions')
          .update({ tier: 'free', status: 'expired', updated_at: now.toISOString() })
          .eq('user_id', sub.user_id);

        await supabase
          .from('profiles')
          .update({ subscription_plan: 'free' })
          .eq('user_id', sub.user_id);

        // Immediately cleanup content when downgraded to free
        await cleanupUserContent(supabase, sub.user_id);

        results.push(`Expired subscription and cleaned up content for user ${sub.user_id}`);
      }
    }

    // 2. Find subscriptions with payment issues (status = 'attention' or 'past_due')
    const { data: failedSubs } = await supabase
      .from('subscriptions')
      .select('user_id, tier, status, updated_at')
      .in('status', ['attention', 'past_due']);

    if (failedSubs && failedSubs.length > 0) {
      for (const sub of failedSubs) {
        const updatedAt = new Date(sub.updated_at);
        const daysSinceFail = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

        // Get user email
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', sub.user_id)
          .single();

        const { data: { user } } = await supabase.auth.admin.getUserById(sub.user_id);
        const email = user?.email;
        const name = profile?.full_name || 'Student';

        if (!email) continue;

        // Day 1: Payment failed email
        if (daysSinceFail === 1) {
          await sendEmail(supabaseUrl, supabaseKey, email, 'payment-failed', name);
          results.push(`Sent payment-failed email to ${email}`);
        }

        // Day 3: Block access
        if (daysSinceFail >= 3) {
          await supabase
            .from('subscriptions')
            .update({ tier: 'free', updated_at: now.toISOString() })
            .eq('user_id', sub.user_id);

          if (daysSinceFail === 3) {
            await sendEmail(supabaseUrl, supabaseKey, email, 'access-blocked', name);
            results.push(`Blocked access and sent email to ${email}`);
          }
        }

        // Day 14: Archive warning
        if (daysSinceFail === 14) {
          await sendEmail(supabaseUrl, supabaseKey, email, 'archive-warning', name);
          results.push(`Sent archive warning to ${email}`);
        }

        // Day 30: Final notice
        if (daysSinceFail === 30) {
          await sendEmail(supabaseUrl, supabaseKey, email, 'final-notice', name);
          results.push(`Sent final notice to ${email}`);
        }

        // Day 31: Delete excess content
        if (daysSinceFail >= 31) {
          await cleanupUserContent(supabase, sub.user_id);
          results.push(`Cleaned up content for user ${sub.user_id}`);
        }
      }
    }

    console.log(`Enforcement complete. Actions: ${results.length}`, results);

    return new Response(
      JSON.stringify({ success: true, actions: results.length, details: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Enforcement error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendEmail(supabaseUrl: string, supabaseKey: string, to: string, type: string, name: string) {
  try {
    const templates: Record<string, { subject: string; html: string }> = {
      'payment-failed': {
        subject: 'Payment Failed - Action Required',
        html: buildEmailHtml(name, 'Payment Failed', 
          'We were unable to process your subscription payment. Please update your payment method to continue enjoying premium features.',
          'Update Payment', `${supabaseUrl.replace('.supabase.co', '')}/payments`),
      },
      'access-blocked': {
        subject: 'Your Premium Access Has Been Restricted',
        html: buildEmailHtml(name, 'Access Restricted',
          'Due to an unpaid subscription, your premium features have been temporarily restricted. Pay now to restore full access.',
          'Restore Access', `${supabaseUrl.replace('.supabase.co', '')}/payments`),
      },
      'archive-warning': {
        subject: 'Your Content Will Be Archived Soon',
        html: buildEmailHtml(name, 'Archive Warning',
          'Your study content will be archived in 16 days if your subscription remains unpaid. Please take action to keep your data.',
          'Resubscribe Now', `${supabaseUrl.replace('.supabase.co', '')}/payments`),
      },
      'final-notice': {
        subject: 'Final Notice - Content Deletion in 24 Hours',
        html: buildEmailHtml(name, 'Final Notice',
          'This is your final warning. Your excess study content will be permanently deleted tomorrow if payment is not received.',
          'Pay Now', `${supabaseUrl.replace('.supabase.co', '')}/payments`),
      },
    };

    const template = templates[type];
    if (!template) return;

    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ to, subject: template.subject, html: template.html }),
    });
  } catch (err) {
    console.error(`Failed to send ${type} email to ${to}:`, err);
  }
}

function buildEmailHtml(name: string, title: string, message: string, ctaText: string, ctaLink: string): string {
  return `<!DOCTYPE html><html><head><style>
    body { font-family: Arial, sans-serif; background: #f3fef7; padding: 20px; color: #1f4e3d; }
    .container { max-width: 500px; margin: auto; background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .btn { display: inline-block; padding: 12px 20px; background: #3ab26f; color: #ffffff; text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: bold; }
  </style></head><body><div class="container">
    <h2 style="color:#1f4e3d;">${title}</h2>
    <p>Hi ${name},</p>
    <p>${message}</p>
    <a href="${ctaLink}" class="btn">${ctaText}</a>
    <p style="margin-top:30px;font-size:12px;color:#666;">— Rebook Genius Team</p>
  </div></body></html>`;
}

async function cleanupUserContent(supabase: any, userId: string) {
  try {
    // Keep only 2 most recent lessons, delete YouTube-generated first
    const { data: docs } = await supabase
      .from('knowledge_base')
      .select('id, content_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (docs && docs.length > 2) {
      // Sort: YouTube lessons first for deletion, then others
      const youtubeFirst = [...docs].sort((a: any, b: any) => {
        if (a.content_type === 'youtube_lesson' && b.content_type !== 'youtube_lesson') return -1;
        if (a.content_type !== 'youtube_lesson' && b.content_type === 'youtube_lesson') return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      // Keep only the 2 most recent (by original order)
      const toKeep = new Set(docs.slice(0, 2).map((d: any) => d.id));
      const toDelete = youtubeFirst.filter((d: any) => !toKeep.has(d.id));

      for (const doc of toDelete) {
        await supabase.from('knowledge_base').delete().eq('id', doc.id);
      }
    }

    // Reset storage usage
    await supabase.from('document_usage').update({ document_count: Math.min(2, docs?.length || 0) }).eq('user_id', userId);
  } catch (err) {
    console.error(`Cleanup error for user ${userId}:`, err);
  }
}
