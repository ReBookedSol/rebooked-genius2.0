/**
 * Shared Email Templates for ReBooked Genius
 * Can be used by both Edge Functions and Frontend
 */

const baseStyle = `
  <style>
    body { font-family: Arial, sans-serif; background: #f3fef7; padding: 20px; color: #1f4e3d; margin: 0; }
    .container { max-width: 500px; margin: auto; background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { text-align: center; margin-bottom: 25px; }
    .btn { display: inline-block; padding: 14px 24px; background: #3ab26f; color: #ffffff !important; text-decoration: none; border-radius: 8px; margin-top: 20px; font-weight: bold; text-align: center; }
    .link { color: #3ab26f; word-break: break-all; text-decoration: underline; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eef2f0; text-align: center; font-size: 11px; color: #8a9c94; }
    h1 { color: #1f4e3d; font-size: 24px; margin-top: 0; }
    h2 { color: #3ab26f; font-size: 18px; margin-top: 20px; }
    p { line-height: 1.6; }
    .warning { background: #fff9db; border: 1px solid #ffec99; padding: 15px; border-radius: 8px; margin: 20px 0; color: #856404; }
    .danger { background: #fff5f5; border: 1px solid #ffc9c9; padding: 15px; border-radius: 8px; margin: 20px 0; color: #c92a2a; }
    .accent { color: #3ab26f; font-weight: bold; }
  </style>
`;

const footerHTML = `
  <div class="footer">
    <p>📭 This is an automated email — please do not reply. For support, visit <a href="https://genius-app.rebookedsolutions.co.za/support" class="link">Support Center</a></p>
    <p>© 2026 ReBooked Solutions (Pty) Ltd. Johannesburg, South Africa.</p>
    <p>Read our <a href="https://genius-app.rebookedsolutions.co.za/terms" class="link">Terms</a> & <a href="https://genius-app.rebookedsolutions.co.za/privacy" class="link">Privacy</a>.</p>
  </div>
`;

export function welcomeEmail(props: { name: string }): { subject: string; html: string } {
  return {
    subject: "Welcome to ReBooked Genius! 🎓",
    html: `${baseStyle}
      <div class="container">
        <div class="header"><h1>Welcome, ${props.name}! 🎉</h1></div>
        <p>We're thrilled to have you join ReBooked Genius — South Africa's most powerful AI study companion.</p>
        <h2>What's next?</h2>
        <ul>
          <li>📚 <strong>Upload:</strong> Put your notes or documents in.</li>
          <li>🧠 <strong>Generate:</strong> Get instant flashcards & quizzes.</li>
          <li>💬 <strong>Chat:</strong> Ask your AI tutor anything about CAPS or IEB curricula.</li>
        </ul>
        <div style="text-align: center;">
          <a href="https://genius-app.rebookedsolutions.co.za/study" class="btn">Start Your Study Session</a>
        </div>
        <p style="margin-top: 25px; font-size: 0.9em; color: #666;">Want to unlock unlimited AI messages? <a href="https://genius-app.rebookedsolutions.co.za/payments" class="link">View Pro Plans →</a></p>
        ${footerHTML}
      </div>`,
  };
}

export function paymentFailedEmail(props: { name: string }): { subject: string; html: string } {
  return {
    subject: "⚠️ Action Required: Your payment failed",
    html: `${baseStyle}
      <div class="container">
        <h1>Payment Unsuccessful</h1>
        <p>Hi ${props.name},</p>
        <div class="warning">
          <p><strong>Your recent subscription payment could not be processed.</strong></p>
        </div>
        <p>Please update your payment method to avoid any interruptions to your study tools.</p>
        <div style="text-align: center;">
          <a href="https://genius-app.rebookedsolutions.co.za/payments" class="btn">Update Payment Method</a>
        </div>
        <p style="margin-top: 15px; font-size: 0.85em; color: #888;">We'll try the payment again automatically in 24 hours.</p>
        ${footerHTML}
      </div>`,
  };
}

export function proUpgradeEmail(props: { name: string; tier: string }): { subject: string; html: string } {
  return {
    subject: `🚀 You're now a ReBooked ${props.tier} member!`,
    html: `${baseStyle}
      <div class="container">
        <div class="header"><h1>Welcome to ${props.tier}, ${props.name}! 🚀</h1></div>
        <p>Your upgrade is active! You've unlocked the full potential of ReBooked Genius.</p>
        <h2>Your new superpowers:</h2>
        <ul>
          <li>✅ <strong>Unlimited</strong> AI Tutor messages</li>
          <li>✅ <strong>Advanced</strong> Analytics & Goal Tracking</li>
          <li>✅ <strong>Priority</strong> document processing</li>
          ${props.tier === "Premium" ? "<li>✅ Full access to NBT preparation material</li>" : ""}
        </ul>
        <div style="text-align: center;">
          <a href="https://genius-app.rebookedsolutions.co.za/study" class="btn">Celebrate with a Study Session</a>
        </div>
        ${footerHTML}
      </div>`,
  };
}

export function trialExpiryEmail(props: { name: string; daysLeft: number }): { subject: string; html: string } {
  return {
    subject: `⏳ Only ${props.daysLeft} days left in your free trial`,
    html: `${baseStyle}
      <div class="container">
        <h1>Time is flying! ⏳</h1>
        <p>Hi ${props.name},</p>
        <p>Your free trial of ReBooked Genius ends in <span class="accent">${props.daysLeft} days</span>.</p>
        <p>Don't lose access to your study aids, personalized flashcards, and AI tutoring.</p>
        <div style="text-align: center;">
          <a href="https://genius-app.rebookedsolutions.co.za/payments" class="btn">Keep My Premium Access</a>
        </div>
        <p style="margin-top: 20px;">If you choose not to upgrade, you will be moved to our Free tier with limited usage.</p>
        ${footerHTML}
      </div>`,
  };
}

export function accessBlockedEmail(props: { name: string }): { subject: string; html: string } {
  return {
    subject: "🔒 Your Premium Access Has Been Restricted",
    html: `${baseStyle}
      <div class="container">
        <h1>Access Restricted 🔒</h1>
        <p>Hi ${props.name},</p>
        <div class="danger">
          <p><strong>Your premium access has been temporarily restricted</strong> due to multiple failed subscription payments.</p>
        </div>
        <p>Please update your payment method to restore full access to all your study tools instantly.</p>
        <div style="text-align: center;">
          <a href="https://genius-app.rebookedsolutions.co.za/payments" class="btn">Restore My Access</a>
        </div>
        ${footerHTML}
      </div>`,
  };
}

export function archiveWarningEmail(props: { name: string }): { subject: string; html: string } {
  return {
    subject: "⚠️ Your Content Will Be Archived Soon",
    html: `${baseStyle}
      <div class="container">
        <h1>Important Update: Archive Pending</h1>
        <p>Hi ${props.name},</p>
        <div class="warning">
          <p>Your subscription has been unpaid for 14 days. If payment is not received within the next 16 days, your study content will be <span class="accent">permanently archived</span>.</p>
        </div>
        <p>Keep your notes, flashcards, and quiz history safe by reviving your subscription today.</p>
        <div style="text-align: center;">
          <a href="https://genius-app.rebookedsolutions.co.za/payments" class="btn">Save My Content</a>
        </div>
        ${footerHTML}
      </div>`,
  };
}

export function finalDeletionEmail(props: { name: string }): { subject: string; html: string } {
  return {
    subject: "🚨 FINAL NOTICE — Content Will Be Deleted Tomorrow",
    html: `${baseStyle}
      <div class="container">
        <h1>Final Warning: Account Deletion</h1>
        <p>Hi ${props.name},</p>
        <div class="danger">
          <p><strong>This is your final notice.</strong> Your unpaid account is scheduled for deletion tomorrow. This action is irreversible.</p>
        </div>
        <div style="text-align: center;">
          <a href="https://genius-app.rebookedsolutions.co.za/payments" class="btn">Keep My Everything — Pay Now</a>
        </div>
        <p style="margin-top: 15px; font-size: 11px; color: #b1b1b1;">After deletion, all your datasets and lessons will be removed from our servers permanently.</p>
        ${footerHTML}
      </div>`,
  };
}

export function usageLimitFirstTimeEmail(props: { name: string }): { subject: string; html: string } {
  return {
    subject: "📊 You've reached your daily AI limit",
    html: `${baseStyle}
      <div class="container">
        <h1>Keep going! 🎒</h1>
        <p>Hi ${props.name},</p>
        <p>You've hit your daily limit of AI messages for today. We love seeing such dedication to your studies!</p>
        <div class="warning">
          <p>Dont let this stop you from academic success — <span class="accent">upgrade to pro today</span> to get 0 interruptions and keep studying.</p>
        </div>
        <div style="text-align: center;">
          <a href="https://genius-app.rebookedsolutions.co.za/payments" class="btn">Upgrade to Pro & Keep Studying</a>
        </div>
        <p style="margin-top: 20px; font-size: 0.9em;">Your daily limit will reset tomorrow, but Pro gives you <strong>unlimited</strong> usage every single day.</p>
        ${footerHTML}
      </div>`,
  };
}

export function fiveDayLimitEmail(props: { name: string }): { subject: string; html: string } {
  return {
    subject: "🎓 Studying so hard you forgot you're on the free version?",
    html: `${baseStyle}
      <div class="container">
        <h1>Keep that momentum! 💪</h1>
        <p>Hi ${props.name},</p>
        <p>You've been studying so hard you've reached our 5-day active limit for this month on the Free version.</p>
        <div class="warning">
          <p>No worries — <span class="accent">upgrade to Pro today</span> to get unlimited AI usage for the rest of the month and stay focused on your academic goals.</p>
        </div>
        <div style="text-align: center;">
          <a href="https://genius-app.rebookedsolutions.co.za/payments" class="btn">Upgrade to Pro Now</a>
        </div>
        <p style="margin-top: 20px;">Join thousands of South African students who never have to worry about hitting limits during peak exam prep.</p>
        ${footerHTML}
      </div>`,
  };
}

export function subscriptionCancelledEmail(props: { name: string; accessUntil: string }): { subject: string; html: string } {
  return {
    subject: "👋 Your ReBooked Genius subscription is set to cancel",
    html: `${baseStyle}
      <div class="container">
        <h1>We're sorry to see you go! 👋</h1>
        <p>Hi ${props.name},</p>
        <p>We've received your request to cancel your subscription. You will still have full access to all your Pro features until <span class="accent">${props.accessUntil}</span>.</p>
        <p>After that, your account will be moved to our Free tier. Your uploaded documents and notes will still be there, but your AI usage and advanced tools will be limited.</p>
        <p>Changed your mind?</p>
        <div style="text-align: center;">
          <a href="https://genius-app.rebookedsolutions.co.za/payments" class="btn">Re-activate Pro Access</a>
        </div>
        ${footerHTML}
      </div>`,
  };
}

export const TEMPLATES = {
  welcome: welcomeEmail,
  payment_failed: paymentFailedEmail,
  pro_upgrade: proUpgradeEmail,
  trial_expiry: trialExpiryEmail,
  usage_limit: usageLimitFirstTimeEmail,
  five_day_limit: fiveDayLimitEmail,
  subscription_cancelled: subscriptionCancelledEmail,
  access_blocked: accessBlockedEmail,
  archive_warning: archiveWarningEmail,
  final_deletion: finalDeletionEmail,
};

export type TemplateName = keyof typeof TEMPLATES;
