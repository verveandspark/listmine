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
  signupUrl?: string;
  context?: 'guest' | 'team';
  accountId?: string;
  inviteId?: string; // UUID of the pending invite row
  // isExistingUser is now ALWAYS determined server-side, frontend should NOT send this
}

// Server-side check for existing user using RPC with service role (bypasses RLS)
async function checkUserExists(email: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[checkUserExists] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return false;
  }
  
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  // Use the SECURITY DEFINER RPC function that returns a boolean
  const { data, error } = await supabaseAdmin.rpc('check_user_exists_by_email', { 
    p_email: email 
  });
  
  if (error) {
    console.error('[checkUserExists] RPC error:', error.message);
    return false;
  }
  
  const userExists = data === true;
  console.log(`[checkUserExists] email: ${email}, rpcResult: ${data}, userExists: ${userExists}`);
  return userExists;
}

// Explicit auth check - immune to dashboard toggle resets
async function verifyAuth(authHeader: string | null): Promise<{ valid: boolean; userId?: string; email?: string; error?: string }> {
  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  if (!token || token === authHeader) {
    return { valid: false, error: 'Invalid Authorization header format (expected Bearer token)' };
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!supabaseUrl || !anonKey) {
    console.error('[verifyAuth] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return { valid: false, error: 'Server configuration error' };
  }
  
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  });
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error) {
    console.error('[verifyAuth] auth.getUser error:', error.message);
    return { valid: false, error: `Token validation failed: ${error.message}` };
  }
  
  if (!user) {
    return { valid: false, error: 'No user found for token' };
  }
  
  console.log('[verifyAuth] Auth check passed:', { userId: user.id, email: user.email });
  return { valid: true, userId: user.id, email: user.email || undefined };
}

serve(async (req) => {
  // Debug: log authorization headers
  const authHeader = req.headers.get('authorization');
  const apiKeyHeader = req.headers.get('apikey');
  
  console.log('[send-invite-email] Incoming request:', {
    method: req.method,
    url: req.url,
    hasAuthHeader: !!authHeader,
    authHeaderPrefix: authHeader ? authHeader.substring(0, 20) + '...' : null,
    hasApiKey: !!apiKeyHeader,
    apiKeyPrefix: apiKeyHeader ? apiKeyHeader.substring(0, 10) + '...' : null,
  });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Explicit auth check - does not rely on dashboard JWT toggle
  const authResult = await verifyAuth(authHeader);
  console.log('[send-invite-email] Auth verification result:', {
    valid: authResult.valid,
    userId: authResult.userId,
    error: authResult.error,
  });
  
  if (!authResult.valid) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', details: authResult.error }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const payload = await req.json();
    const { guestEmail, inviterName, listName, signupUrl, context = 'guest', accountId, inviteId }: InviteEmailRequest = payload;

    console.log("[send-invite-email] Received payload:", {
      recipientEmail: guestEmail,
      inviterName,
      listName,
      context,
      accountId,
      inviteId,
    });

    if (!guestEmail || !inviterName || !listName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ALWAYS check user existence server-side using service role (bypasses RLS)
    const isExistingUser = await checkUserExists(guestEmail);
    const chosenTemplate = isExistingUser ? 'EXISTING_USER' : 'NEW_USER';
    
    console.log("[send-invite-email] User existence check:", {
      recipientEmail: guestEmail,
      isExistingUser,
      chosenTemplate,
      context,
    });

    const baseUrl = 'https://app.listmine.com';
    
    console.log("[send-invite-email] About to check inviteId:", {
      inviteId,
      hasInviteId: !!inviteId,
      inviteIdType: typeof inviteId,
      isExistingUser,
      context,
    });
    
    // For existing users who are directly added (no pending invite), inviteId is optional
    // They just get a notification email with a link to the dashboard
    // For new users who need to sign up, inviteId is required for the invite acceptance flow
    let actionUrl: string;
    
    if (inviteId) {
      // Has invite ID - use invite acceptance flow
      const inviteType = context === 'team' ? 'team' : 'guest';
      actionUrl = `${baseUrl}/invite?type=${inviteType}&id=${inviteId}`;
      console.log("[send-invite-email] Using invite acceptance URL:", actionUrl);
    } else if (isExistingUser) {
      // Existing user directly added - just link to dashboard
      actionUrl = `${baseUrl}/dashboard`;
      console.log("[send-invite-email] Existing user without inviteId - using dashboard URL:", actionUrl);
    } else {
      // New user needs inviteId for proper signup flow
      console.error("[send-invite-email] ERROR: Missing inviteId for new user - returning 400");
      return new Response(
        JSON.stringify({ error: 'Missing inviteId - required for new user invite emails' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("[send-invite-email] About to check context:", {
      context,
      isTeam: context === 'team',
    });

    // Team invite templates
    if (context === 'team') {
      console.log("[send-invite-email] TEAM: *** ENTERING TEAM EMAIL BLOCK ***");
      
      try {
      const teamEmailHtml = isExistingUser ? `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1F628E 0%, #298585 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>👥 You've Been Added to a Team!</h1>
              </div>
              <div class="content">
                <p>Hi there,</p>
                <p><strong>${inviterName}</strong> has added you to their team <strong>"${listName}"</strong> in ListMine.</p>
                <p>As a team member, you now have access to all their lists. Click the button below to open ListMine:</p>
                <div style="text-align: center;">
                  <a href="${actionUrl}" style="display: inline-block; background: #298585; color: #ffffff !important; padding: 14px 36px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; font-size: 16px;">Open ListMine</a>
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
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>👥 You've Been Invited to Join a Team!</h1>
              </div>
              <div class="content">
                <p>Hi there,</p>
                <p><strong>${inviterName}</strong> has invited you to join their team <strong>"${listName}"</strong> in ListMine.</p>
                <p>ListMine helps you create and manage lists for everything - tasks, groceries, ideas, and more!</p>
                <p>Create your free account to join the team and start collaborating:</p>
                <div style="text-align: center;">
                  <a href="${actionUrl}" style="display: inline-block; background: #298585; color: #ffffff !important; padding: 14px 36px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; font-size: 16px;">Create Free Account</a>
                </div>
                <p>Once you sign up with this email address (${guestEmail}), you'll automatically be added to the team.</p>
              </div>
              <div class="footer">
                <p>The ListMine Team</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const teamSubject = isExistingUser 
        ? `You've been added to "${listName}" team on ListMine`
        : `You've Been Invited to Join "${listName}" Team`;

      const resendApiKeyForTeam = Deno.env.get('RESEND_API_KEY');
      console.log('[send-invite-email] TEAM: Pre-send check:', {
        to: guestEmail,
        subject: teamSubject,
        isExistingUser,
        hasResendApiKey: !!resendApiKeyForTeam,
        resendKeyPrefix: resendApiKeyForTeam ? resendApiKeyForTeam.substring(0, 10) + '...' : 'MISSING',
      });

      if (!resendApiKeyForTeam) {
        console.error('[send-invite-email] TEAM: RESEND_API_KEY is missing!');
        return new Response(
          JSON.stringify({ error: 'Email service not configured', hint: 'RESEND_API_KEY secret is missing' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[send-invite-email] TEAM: Calling Resend API...');
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKeyForTeam}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'ListMine <invite@notifications.listmine.com>',
          to: [guestEmail],
          subject: teamSubject,
          html: teamEmailHtml,
        }),
      });

      console.log('[send-invite-email] TEAM: Resend API response status:', {
        status: emailResponse.status,
        statusText: emailResponse.statusText,
        ok: emailResponse.ok,
      });

      const responseText = await emailResponse.text();
      console.log('[send-invite-email] TEAM: Resend API raw response:', responseText);

      if (!emailResponse.ok) {
        console.error('[send-invite-email] TEAM: Resend API error:', responseText);
        return new Response(
          JSON.stringify({ error: 'Failed to send email', details: responseText }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let emailData;
      try {
        emailData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[send-invite-email] TEAM: Failed to parse Resend response:', parseError);
        return new Response(
          JSON.stringify({ error: 'Invalid response from email service', raw: responseText }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('[send-invite-email] TEAM: Email sent successfully!', { 
        emailId: emailData.id, 
        to: guestEmail,
        resendResponse: emailData 
      });

      return new Response(
        JSON.stringify({ success: true, emailId: emailData.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
      } catch (teamError) {
        console.error('[send-invite-email] TEAM: CAUGHT ERROR IN TEAM BLOCK:', teamError);
        console.error('[send-invite-email] TEAM: Error name:', teamError?.name);
        console.error('[send-invite-email] TEAM: Error message:', teamError?.message);
        console.error('[send-invite-email] TEAM: Error stack:', teamError?.stack);
        return new Response(
          JSON.stringify({ 
            error: 'Team email failed', 
            details: teamError?.message || String(teamError),
            errorName: teamError?.name,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Guest invite templates (original)

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
            .button:hover { background: #174a6b; }
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
                <a href="${actionUrl}" class="button" style="display: inline-block; background: #298585; color: #ffffff !important; padding: 14px 36px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; font-size: 16px;">View List</a>
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
            .button:hover { background: #174a6b; }
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
                <a href="${actionUrl}" class="button" style="display: inline-block; background: #298585; color: #ffffff !important; padding: 14px 36px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; font-size: 16px;">Create Free Account</a>
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
    
    console.log('[send-invite-email] GUEST: Pre-send check:', {
      hasResendApiKey: !!resendApiKey,
      resendKeyPrefix: resendApiKey ? resendApiKey.substring(0, 10) + '...' : 'MISSING',
      availableEnvVars: Object.keys(Deno.env.toObject()).filter(k => !k.includes('SECRET') && !k.includes('KEY')),
    });
    
    if (!resendApiKey) {
      console.error('[send-invite-email] GUEST: RESEND_API_KEY not configured!');
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

    console.log('[send-invite-email] GUEST: Calling Resend API...', { 
      to: guestEmail, 
      subject, 
      isExistingUser,
      from: 'ListMine <invite@notifications.listmine.com>',
    });

    const requestBody = {
      from: 'ListMine <invite@notifications.listmine.com>',
      to: [guestEmail],
      subject,
      html: emailHtml,
    };
    
    console.log('[send-invite-email] GUEST: Resend request body (without html):', {
      from: requestBody.from,
      to: requestBody.to,
      subject: requestBody.subject,
      htmlLength: requestBody.html.length,
    });

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[send-invite-email] GUEST: Resend API response status:', {
      status: emailResponse.status,
      statusText: emailResponse.statusText,
      ok: emailResponse.ok,
    });

    const responseText = await emailResponse.text();
    console.log('[send-invite-email] GUEST: Resend API raw response:', responseText);

    if (!emailResponse.ok) {
      console.error('[send-invite-email] GUEST: Resend API error:', responseText);
      throw new Error(`Failed to send email: ${responseText}`);
    }

    let emailData;
    try {
      emailData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[send-invite-email] GUEST: Failed to parse Resend response:', parseError);
      throw new Error(`Invalid response from email service: ${responseText}`);
    }
    
    console.log('[send-invite-email] GUEST: Email sent successfully!', { 
      emailId: emailData.id, 
      to: guestEmail,
      resendResponse: emailData 
    });

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
