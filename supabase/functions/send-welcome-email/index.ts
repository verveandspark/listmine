// ListMine welcome email edge function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WelcomeEmailRequest {
  email: string;
  name: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    console.log("[send-welcome-email] Starting welcome email request");

    const { email, name }: WelcomeEmailRequest = await req.json();

    console.log("[send-welcome-email] Request params:", { email, name });

    // Validate required fields
    if (!email) {
      console.error("[send-welcome-email] Missing required field: email");
      return new Response(
        JSON.stringify({ error: 'Missing required field: email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const displayName = name || 'there';
    const appUrl = 'https://app.listmine.com';

    // Build welcome email HTML with brand colors
    const welcomeEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1F628E; background: linear-gradient(135deg, #1F628E 0%, #298585 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 28px; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
            .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 8px 8px; }
            .welcome-box { background: #f0f9f9; border-left: 4px solid #298585; padding: 15px 20px; margin: 20px 0; border-radius: 0 4px 4px 0; }
            .cta-button { display: inline-block; background: #298585; color: #ffffff !important; padding: 14px 36px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; font-size: 16px; }
            .cta-button:hover { background: #1F628E; }
            .cta-button-secondary { display: inline-block; background: #f0f9f9; color: #1F628E !important; padding: 12px 28px; text-decoration: none; border-radius: 6px; margin: 15px 0; font-weight: 600; font-size: 15px; border: 2px solid #298585; }
            .cta-button-secondary:hover { background: #e0f2f2; }
            .tips-section { margin: 30px 0; }
            .tips-section h2 { color: #1F628E; font-size: 20px; margin-bottom: 15px; }
            .tip-item { display: flex; align-items: flex-start; margin: 15px 0; padding: 15px; background: #f9f9f9; border-radius: 6px; }
            .tip-icon { font-size: 24px; margin-right: 15px; flex-shrink: 0; }
            .tip-content h3 { margin: 0 0 5px 0; color: #1F628E; font-size: 16px; }
            .tip-content p { margin: 0; color: #666; font-size: 14px; }
            .divider { border: none; border-top: 1px solid #e0e0e0; margin: 30px 0; }
            .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 14px; }
            .footer a { color: #298585; text-decoration: none; }
            .social-links { margin: 15px 0; }
            .social-links a { margin: 0 10px; color: #298585; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ListMine! 🎉</h1>
              <p>Your all-in-one list management solution</p>
            </div>
            <div class="content">
              <p>Hi ${displayName},</p>
              
              <div class="welcome-box">
                <p style="margin: 0;"><strong>You're all set!</strong> Your ListMine account is ready at <strong>${email}</strong>.</p>
              </div>
              
              <p>We're thrilled to have you on board. ListMine helps you create, organize, and share all kinds of lists – from daily tasks to wishlists, groceries to gift registries.</p>
              
              <div style="text-align: center;">
                <a href="${appUrl}" class="cta-button">Log In to ListMine</a>
              </div>
              
              <div class="tips-section">
                <h2>🚀 Quick Start Tips</h2>
                
                <div class="tip-item">
                  <div class="tip-icon">📝</div>
                  <div class="tip-content">
                    <h3>Create Your First List</h3>
                    <p>Click the "New List" button on your dashboard. Choose from templates like Tasks, Shopping, Ideas, Wishlist, or create a custom list.</p>
                  </div>
                </div>
                
                <div class="tip-item">
                  <div class="tip-icon">🛒</div>
                  <div class="tip-content">
                    <h3>Import Your Wishlists</h3>
                    <p>Already have wishlists elsewhere? Import them from <strong>Amazon, Target, Bed Bath & Beyond,</strong> and <strong>The Knot</strong> with just a few clicks.</p>
                  </div>
                </div>
                
                <div class="tip-item">
                  <div class="tip-icon">👨‍👩‍👧‍👦</div>
                  <div class="tip-content">
                    <h3>Share with Friends & Family</h3>
                    <p>Share your lists with anyone. They can view, collaborate, or even mark items as purchased – perfect for gift registries and shared shopping lists.</p>
                  </div>
                </div>
                
                <div class="tip-item">
                  <div class="tip-icon">📱</div>
                  <div class="tip-content">
                    <h3>Access Anywhere</h3>
                    <p>ListMine works on any device. Access your lists from your phone, tablet, or computer – they're always in sync.</p>
                  </div>
                </div>
              </div>
              
              <hr class="divider">
              
              <div style="background: #f0f9f9; padding: 20px; border-radius: 6px; margin: 20px 0;">
                <h3 style="color: #1F628E; margin: 0 0 10px 0;">📚 Getting Started Guide</h3>
                <ul style="margin: 0; padding-left: 20px; color: #333;">
                  <li><strong>Dashboard:</strong> Your home base showing all your lists and quick stats</li>
                  <li><strong>Templates:</strong> Pre-made list structures for common use cases</li>
                  <li><strong>Sharing:</strong> Control who sees your lists with flexible privacy options</li>
                  <li><strong>Teams:</strong> Create a team account to share lists with family or colleagues</li>
                </ul>
              </div>
              
              <div style="background: #ffffff; padding: 25px; border-radius: 6px; margin: 20px 0; border: 2px solid #e0f2f2; text-align: center;">
                <h3 style="color: #1F628E; margin: 0 0 10px 0;">📖 Complete User Guide</h3>
                <p style="margin: 0 0 20px 0; color: #333;">Want all the details? Download our complete User Guide for step-by-step instructions on every feature.</p>
                <a href="https://listmine.com/user-guide" class="cta-button-secondary">Download User Guide</a>
              </div>
              
              <p>Need help? Just reply to this email or visit our <a href="${appUrl}" style="color: #298585;">app</a> – we're here to help!</p>
              
              <p>Happy list-making! ✨</p>
              <p><strong>The ListMine Team</strong></p>
            </div>
            <div class="footer">
              <p>You're receiving this email because you signed up for ListMine.</p>
              <p><a href="${appUrl}">app.listmine.com</a> | Contact: <a href="mailto:info@listmine.com">info@listmine.com</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Plain text version
    const welcomeEmailText = `
Welcome to ListMine! 🎉

Hi ${displayName},

You're all set! Your ListMine account is ready at ${email}.

We're thrilled to have you on board. ListMine helps you create, organize, and share all kinds of lists – from daily tasks to wishlists, groceries to gift registries.

Log in at: ${appUrl}

🚀 QUICK START TIPS

📝 Create Your First List
Click the "New List" button on your dashboard. Choose from templates like Tasks, Shopping, Ideas, Wishlist, or create a custom list.

🛒 Import Your Wishlists
Already have wishlists elsewhere? Import them from Amazon, Target, Bed Bath & Beyond, and The Knot with just a few clicks.

👨‍👩‍👧‍👦 Share with Friends & Family
Share your lists with anyone. They can view, collaborate, or even mark items as purchased – perfect for gift registries and shared shopping lists.

📱 Access Anywhere
ListMine works on any device. Access your lists from your phone, tablet, or computer – they're always in sync.

📚 GETTING STARTED GUIDE

• Dashboard: Your home base showing all your lists and quick stats
• Templates: Pre-made list structures for common use cases
• Sharing: Control who sees your lists with flexible privacy options
• Teams: Create a team account to share lists with family or colleagues

📖 COMPLETE USER GUIDE

Want all the details? Download our complete User Guide for step-by-step instructions on every feature.

Download User Guide: https://listmine.com/user-guide

Need help? Just reply to this email!

Happy list-making! ✨

The ListMine Team
${appUrl}
Contact: info@listmine.com
    `.trim();

    // Get Resend API key
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('[send-welcome-email] Missing RESEND_API_KEY environment variable');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("[send-welcome-email] Sending welcome email via Resend API...");

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ListMine <invite@notifications.listmine.com>',
        to: [email],
        reply_to: 'info@listmine.com',
        subject: 'Welcome to ListMine! 🎉',
        html: welcomeEmailHtml,
        text: welcomeEmailText,
      }),
    });

    const emailData = await resendResponse.json();
    console.log("[send-welcome-email] Resend API response:", JSON.stringify(emailData));

    if (!resendResponse.ok) {
      console.error('[send-welcome-email] Resend API error:', emailData);
      return new Response(
        JSON.stringify({ error: 'Failed to send welcome email', details: emailData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("[send-welcome-email] Welcome email sent successfully to:", email);

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-welcome-email] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
