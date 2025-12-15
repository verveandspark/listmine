// ListMine invite email edge function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteEmailRequest {
  guestEmail: string;
  inviterName: string;
  listName: string;
  signupUrl: string;
}

async function checkUserExists(email: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return false;
  }
  
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  
  if (error) {
    console.error('Error checking user existence:', error.message);
    return false;
  }
  
  const userExists = data.users.some(user => user.email?.toLowerCase() === email.toLowerCase());
  return userExists;
}

serve(async (req) => {
  console.log('Incoming request:', {
    method: req.method,
    url: req.url,
  });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { guestEmail, inviterName, listName, signupUrl }: InviteEmailRequest = await req.json();

    if (!guestEmail || !inviterName || !listName || !signupUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side check for existing user
    const isExistingUser = await checkUserExists(guestEmail);
    console.log(`Email path: ${isExistingUser ? 'EXISTING_USER' : 'NEW_USER'}, recipient: ${guestEmail}`);

    // Different email templates for new vs existing users
    const emailHtml = isExistingUser ? `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1F628E 0%, #298585 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #1F628E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 New List Shared With You!</h1>
            </div>
            <div class="content">
              <p>Hi there,</p>
              <p><strong>${inviterName}</strong> has given you access to their list <strong>"${listName}"</strong> in ListMine.</p>
              <p>You can now view and edit this list. Click the button below to open it:</p>
              <div style="text-align: center;">
                <a href="${signupUrl}" class="button">View List</a>
              </div>
              <p>Happy collaborating!</p>
            </div>
            <div class="footer">
              <p>The ListMine Team</p>
            </div>
          </div>
        </body>
      </html>
    ` : `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1F628E 0%, #298585 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #1F628E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 You've Been Invited!</h1>
            </div>
            <div class="content">
              <p>Hi there,</p>
              <p><strong>${inviterName}</strong> has invited you to collaborate on their list <strong>"${listName}"</strong> in ListMine.</p>
              <p>To accept the invitation and access the list, please sign up for a free ListMine account using the button below:</p>
              <div style="text-align: center;">
                <a href="${signupUrl}" class="button">Create Free Account</a>
              </div>
              <p>Once you've created your account with this email address (<strong>${guestEmail}</strong>), you'll automatically get access to the shared list.</p>
              <p>ListMine makes it easy to organize and share lists with friends, family, and colleagues.</p>
            </div>
            <div class="footer">
              <p>See you soon!<br>The ListMine Team</p>
              <p style="font-size: 12px; color: #999;">This invitation will expire in 30 days.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    console.log('Environment check - RESEND_API_KEY exists:', !!resendApiKey);
    console.log('Available env vars:', Object.keys(Deno.env.toObject()).filter(k => !k.includes('SECRET')));
    
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured. Please add it as a secret in Supabase Dashboard > Edge Functions > Secrets');
      return new Response(
        JSON.stringify({ 
          error: 'Email service not configured',
          hint: 'RESEND_API_KEY secret needs to be added in Supabase Dashboard > Edge Functions > Secrets'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subject = isExistingUser 
      ? `You've been given access to "${listName}" on ListMine`
      : `You've Been Invited to Collaborate on "${listName}"`;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ListMine <invite@notifications.listmine.com>',
        to: [guestEmail],
        subject,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Resend API error:', errorData);
      throw new Error('Failed to send email');
    }

    const emailData = await emailResponse.json();

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending invite email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send invite email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
