/**
 * Email templates for ReBooked Genius
 * All emails use Brevo (via send-email edge function)
 */

const baseStyle = `
  <style>
    body { font-family: Arial, sans-serif; background: #f3fef7; padding: 20px; color: #1f4e3d; }
    .container { max-width: 500px; margin: auto; background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .btn { display: inline-block; padding: 12px 20px; background: #3ab26f; color: #ffffff; text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: bold; }
    .link { color: #3ab26f; word-break: break-all; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #999; }
    h1 { color: #1f4e3d; font-size: 24px; }
    h2 { color: #3ab26f; font-size: 18px; }
    .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .danger { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 15px 0; }
  </style>
`;

const footer = `
  <div class="footer">
    <p>📭 This is an automated email — please do not reply to this address. For support, visit <a href="https://genius-app.rebookedsolutions.co.za/support" class="link">https://genius-app.rebookedsolutions.co.za/support</a></p>
    <p>© 2026 ReBooked Solutions (Pty) Ltd. All rights reserved.</p>
    <p>By using ReBooked Genius you agree to our <a href="https://genius-app.rebookedsolutions.co.za/terms" class="link">Terms & Conditions</a> and <a href="https://genius-app.rebookedsolutions.co.za/privacy" class="link">Privacy Policy</a>.</p>
    <p>ReBooked Solutions (Pty) Ltd · Johannesburg, South Africa</p>
  </div>
`;

export function welcomeEmail(userName: string): { subject: string; html: string } {
  return {
    subject: "Welcome to ReBooked Genius! 🎓",
    html: `${baseStyle}
      <div class="container">
        <h1>Welcome, ${userName}! 🎉</h1>
        <p>We're thrilled to have you join ReBooked Genius — your AI-powered study companion.</p>
        <h2>What you can do:</h2>
        <ul>
          <li>📚 Upload documents & generate lessons</li>
          <li>🧠 Create AI-powered flashcards & quizzes</li>
          <li>📊 Track your study analytics</li>
          <li>💬 Chat with your AI tutor</li>
        </ul>
        <p>Ready to supercharge your studies?</p>
        <a href="https://genius-app.rebookedsolutions.co.za/study" class="btn">Start Learning Now</a>
        <p style="margin-top: 20px;">Want to unlock unlimited features?</p>
        <a href="https://genius-app.rebookedsolutions.co.za/payments" class="link">Upgrade to Premium →</a>
        ${footer}
      </div>`,
  };
}

export function paymentFailedEmail(userName: string): { subject: string; html: string } {
  return {
    subject: "⚠️ Payment Failed — Action Required",
    html: `${baseStyle}
      <div class="container">
        <h1>Payment Unsuccessful</h1>
        <p>Hi ${userName},</p>
        <div class="warning">
          <p><strong>Your subscription payment could not be processed.</strong></p>
          <p>Please update your payment method to avoid losing access to premium features.</p>
        </div>
        <p>If not resolved within <strong>3 days</strong>, your access to premium features will be restricted.</p>
        <a href="https://genius-app.rebookedsolutions.co.za/payments" class="btn">Update Payment Method</a>
        ${footer}
      </div>`,
  };
}

export function accessBlockedEmail(userName: string): { subject: string; html: string } {
  return {
    subject: "🔒 Your Premium Access Has Been Restricted",
    html: `${baseStyle}
      <div class="container">
        <h1>Access Restricted</h1>
        <p>Hi ${userName},</p>
        <div class="danger">
          <p><strong>Your premium access has been temporarily restricted</strong> due to 3 days of unpaid subscription.</p>
        </div>
        <p>The following are now blocked:</p>
        <ul>
          <li>❌ AI Chat</li>
          <li>❌ Study page (premium content)</li>
          <li>❌ Premium analytics</li>
          <li>❌ All premium features</li>
        </ul>
        <p>Pay now to instantly restore your access:</p>
        <a href="https://genius-app.rebookedsolutions.co.za/payments" class="btn">Restore Access</a>
        ${footer}
      </div>`,
  };
}

export function archiveWarningEmail(userName: string): { subject: string; html: string } {
  return {
    subject: "⚠️ Your Content Will Be Archived Soon",
    html: `${baseStyle}
      <div class="container">
        <h1>Archive Warning</h1>
        <p>Hi ${userName},</p>
        <div class="warning">
          <p>Your subscription has been unpaid for <strong>14 days</strong>.</p>
          <p>If payment is not received within the next 16 days, your content will be <strong>permanently archived and then deleted</strong>.</p>
        </div>
        <p>This includes all your:</p>
        <ul>
          <li>Study documents & lessons</li>
          <li>Flashcard decks</li>
          <li>Quiz history</li>
          <li>Chat conversations</li>
        </ul>
        <a href="https://genius-app.rebookedsolutions.co.za/payments" class="btn">Pay Now to Keep Your Content</a>
        ${footer}
      </div>`,
  };
}

export function finalDeletionEmail(userName: string): { subject: string; html: string } {
  return {
    subject: "🚨 FINAL NOTICE — Content Will Be Deleted Tomorrow",
    html: `${baseStyle}
      <div class="container">
        <h1>Final Warning</h1>
        <p>Hi ${userName},</p>
        <div class="danger">
          <p><strong>This is your final notice.</strong></p>
          <p>Your subscription has been unpaid for <strong>30 days</strong>. Tomorrow, your content will be <strong>permanently deleted</strong>.</p>
        </div>
        <p>Act now to save your study materials:</p>
        <a href="https://genius-app.rebookedsolutions.co.za/payments" class="btn">Pay Now — Save Everything</a>
        <p style="margin-top: 15px; font-size: 12px; color: #999;">After deletion, content cannot be recovered.</p>
        ${footer}
      </div>`,
  };
}

export function proUpgradeEmail(userName: string, tierName: string): { subject: string; html: string } {
  return {
    subject: `🎉 Welcome to ReBooked ${tierName}!`,
    html: `${baseStyle}
      <div class="container">
        <h1>Welcome to ${tierName}! 🎉</h1>
        <p>Hi ${userName},</p>
        <p>Your upgrade to <strong>ReBooked ${tierName}</strong> is now active!</p>
        <h2>You've unlocked:</h2>
        <ul>
          <li>✅ Unlimited AI messages</li>
          <li>✅ Unlimited study documents</li>
          <li>✅ Advanced AI models</li>
          <li>✅ Detailed analytics</li>
          <li>✅ Achievement rewards</li>
          ${tierName === "Premium" ? "<li>✅ Full NBT preparation access</li>" : ""}
        </ul>
        <p>Start making the most of your subscription:</p>
        <a href="https://genius-app.rebookedsolutions.co.za/study" class="btn">Go to Study</a>
        ${footer}
      </div>`,
  };
}

export function subscriptionCancelledEmail(userName: string, accessUntil: string): { subject: string; html: string } {
  return {
    subject: "We're Sorry to See You Go 😢",
    html: `${baseStyle}
      <div class="container">
        <h1>Subscription Cancelled</h1>
        <p>Hi ${userName},</p>
        <p>Your subscription has been cancelled. We're sorry to see you go.</p>
        <p>You'll still have access until <strong>${accessUntil}</strong>.</p>
        <h2>What you'll lose:</h2>
        <ul>
          <li>❌ Unlimited AI messages</li>
          <li>❌ Unlimited documents</li>
          <li>❌ Advanced analytics</li>
          <li>❌ Achievement rewards</li>
          <li>❌ Premium AI models</li>
        </ul>
        <p>Changed your mind? You can reactivate anytime:</p>
        <a href="https://genius-app.rebookedsolutions.co.za/payments" class="btn">Reactivate Subscription</a>
        <p style="margin-top: 15px; font-size: 13px; color: #666;">We'd love to have you back. Your study progress matters to us.</p>
        ${footer}
      </div>`,
  };
}
