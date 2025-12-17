import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/useAuthHook";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Mail, Users, List, AlertCircle, CheckCircle, KeyRound, LogOut } from "lucide-react";
import { validateEmail } from "@/lib/validation";

interface InviteDetails {
  found: boolean;
  error?: string;
  type?: "guest" | "team";
  email?: string;
  status?: string;
  expired?: boolean;
  inviter_name?: string;
  target_name?: string;
  permission?: string;
  role?: string;
}

export default function InviteAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading, login, register } = useAuth();
  const { toast } = useToast();

  const inviteType = searchParams.get("type") as "guest" | "team" | null;
  const inviteId = searchParams.get("id");

  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading2, setAuthLoading2] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Fetch invite details
  useEffect(() => {
    const fetchInviteDetails = async () => {
      if (!inviteType || !inviteId) {
        setInviteDetails({ found: false, error: "Invalid invite link" });
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("get_invite_details", {
          p_invite_type: inviteType,
          p_invite_id: inviteId,
        });

        if (error) {
          console.error("Error fetching invite details:", error);
          setInviteDetails({ found: false, error: error.message });
        } else {
          setInviteDetails(data as unknown as InviteDetails);
          // Pre-fill email from invite
          if (data && typeof data === 'object' && 'email' in data && typeof data.email === 'string') {
            setEmail(data.email);
          }
        }
      } catch (err) {
        console.error("Error:", err);
        setInviteDetails({ found: false, error: "Failed to load invite" });
      } finally {
        setLoading(false);
      }
    };

    fetchInviteDetails();
  }, [inviteType, inviteId]);

  // Note: Email mismatch is now handled inline in the UI, no toast needed

  // Auto-accept if user is authenticated and email matches
  useEffect(() => {
    const autoAccept = async () => {
      if (
        !authLoading &&
        isAuthenticated &&
        user &&
        inviteDetails?.found &&
        inviteDetails.status === "pending" &&
        !inviteDetails.expired
      ) {
        const userEmail = user.email?.toLowerCase();
        const inviteEmail = inviteDetails.email?.toLowerCase();

        if (userEmail === inviteEmail) {
          await handleAcceptInvite();
        }
      }
    };

    autoAccept();
  }, [authLoading, isAuthenticated, user, inviteDetails]);

  const handleAcceptInvite = async () => {
    if (!inviteType || !inviteId) return;

    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc("accept_invite", {
        p_invite_type: inviteType,
        p_invite_id: inviteId,
      });

      if (error) {
        throw error;
      }

      const result = data as { success: boolean; error?: string; redirect?: string; type?: string };

      if (result.success) {
        toast({
          title: "✅ Invite Accepted!",
          description:
            result.type === "guest"
              ? `You now have access to "${inviteDetails?.target_name}"`
              : `You've joined the team "${inviteDetails?.target_name}"`,
          className: "bg-green-50 border-green-200",
        });

        // Redirect to appropriate page
        navigate(result.redirect || "/dashboard", { replace: true });
      } else {
        toast({
          title: "❌ Failed to Accept Invite",
          description: result.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (err: unknown) {
      console.error("Error accepting invite:", err);
      toast({
        title: "❌ Error",
        description: err instanceof Error ? err.message : "Failed to accept invite",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading2(true);

    try {
      if (authMode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      // After successful auth, the useEffect will auto-accept the invite
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setAuthLoading2(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailValidation = validateEmail(resetEmail || email);
    if (!emailValidation.isValid) {
      toast({
        title: "❌ Invalid Email",
        description: emailValidation.error || "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        emailValidation.value!,
        {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }
      );

      if (error) throw error;

      toast({
        title: "✅ Reset Link Sent",
        description: "Check your email for the password reset link.",
      });
      setIsForgotPasswordOpen(false);
      setResetEmail("");
    } catch (error: unknown) {
      console.error("Password reset failed:", error);
      toast({
        title: "❌ Error",
        description: error instanceof Error ? error.message : "Failed to send reset link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#298585]" />
          <p className="text-slate-600">Loading invite...</p>
        </div>
      </div>
    );
  }

  // Invalid or missing invite
  if (!inviteType || !inviteId || !inviteDetails?.found) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Invalid Invite</CardTitle>
            <CardDescription>
              {inviteDetails?.error || "This invite link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invite expired or already accepted
  if (inviteDetails.expired || inviteDetails.status !== "pending") {
    const isAlreadyAccepted = inviteDetails.status === "accepted";
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className={`mx-auto mb-4 h-12 w-12 rounded-full flex items-center justify-center ${
              isAlreadyAccepted ? "bg-green-100" : "bg-amber-100"
            }`}>
              {isAlreadyAccepted ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-amber-600" />
              )}
            </div>
            <CardTitle>
              {inviteDetails.expired ? "Invite Expired" : "You're Already In!"}
            </CardTitle>
            <CardDescription>
              {inviteDetails.expired
                ? "This invite has expired. Please ask the sender for a new invite."
                : (
                  <>
                    This invite to <strong>"{inviteDetails.target_name}"</strong> has already been accepted.
                    {isAuthenticated && " You can access it from your dashboard."}
                  </>
                )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isAlreadyAccepted && isAuthenticated ? (
              <>
                <Button 
                  onClick={() => navigate("/dashboard")} 
                  className="w-full bg-[#298585] hover:bg-[#1F628E]"
                >
                  Go to Dashboard
                </Button>
                {inviteType === "guest" && (
                  <p className="text-xs text-center text-slate-500">
                    Look for "{inviteDetails.target_name}" in your shared lists
                  </p>
                )}
              </>
            ) : isAlreadyAccepted && !isAuthenticated ? (
              <>
                <p className="text-sm text-center text-slate-600 mb-4">
                  Log in to access the {inviteType === "guest" ? "shared list" : "team"}.
                </p>
                <Button 
                  onClick={() => navigate("/auth")} 
                  className="w-full bg-[#298585] hover:bg-[#1F628E]"
                >
                  Log In
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate(isAuthenticated ? "/dashboard" : "/")} className="w-full">
                {isAuthenticated ? "Go to Dashboard" : "Go to Home"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is authenticated
  if (isAuthenticated && user) {
    const emailMatches = user.email?.toLowerCase() === inviteDetails.email?.toLowerCase();

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-[#298585]/10 flex items-center justify-center">
              {inviteType === "guest" ? (
                <List className="h-6 w-6 text-[#298585]" />
              ) : (
                <Users className="h-6 w-6 text-[#298585]" />
              )}
            </div>
            <CardTitle>
              {inviteType === "guest" ? "List Invitation" : "Team Invitation"}
            </CardTitle>
            <CardDescription>
              <strong>{inviteDetails.inviter_name}</strong> invited you to{" "}
              {inviteType === "guest" ? "collaborate on" : "join"}{" "}
              <strong>"{inviteDetails.target_name}"</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!emailMatches ? (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        Wrong account
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        This invite was sent to <strong>{inviteDetails.email}</strong>, but you're currently logged in as <strong>{user.email}</strong>.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 font-medium">What would you like to do?</p>
                  
                  <Button 
                    onClick={handleLogout} 
                    variant="default" 
                    className="w-full bg-[#298585] hover:bg-[#1F628E]"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out & sign in as {inviteDetails.email}
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      setResetEmail(inviteDetails.email || "");
                      setIsForgotPasswordOpen(true);
                    }} 
                    variant="outline" 
                    className="w-full"
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    Reset password for {inviteDetails.email}
                  </Button>
                  
                  <Button 
                    onClick={() => navigate("/dashboard")} 
                    variant="ghost" 
                    className="w-full text-slate-500"
                  >
                    Cancel and go to dashboard
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {accepting ? (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Accepting invite...</span>
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <p className="text-sm text-green-800">
                        Logged in as <strong>{user.email}</strong>
                      </p>
                    </div>
                    <Button
                      onClick={handleAcceptInvite}
                      className="w-full bg-[#298585] hover:bg-[#1F628E]"
                    >
                      Accept Invitation
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is not authenticated - show login/signup form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-[#298585]/10 flex items-center justify-center">
            {inviteType === "guest" ? (
              <List className="h-6 w-6 text-[#298585]" />
            ) : (
              <Users className="h-6 w-6 text-[#298585]" />
            )}
          </div>
          <CardTitle>
            {inviteType === "guest" ? "List Invitation" : "Team Invitation"}
          </CardTitle>
          <CardDescription>
            <strong>{inviteDetails.inviter_name}</strong> invited{" "}
            <strong>{inviteDetails.email}</strong> to{" "}
            {inviteType === "guest" ? "collaborate on" : "join"}{" "}
            <strong>"{inviteDetails.target_name}"</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex rounded-lg border overflow-hidden">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  authMode === "login"
                    ? "bg-[#298585] text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  authMode === "signup"
                    ? "bg-[#298585] text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required={authMode === "signup"}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10"
                  required
                />
              </div>
              {email.toLowerCase() !== inviteDetails.email?.toLowerCase() && email && (
                <p className="text-xs text-amber-600">
                  Note: This invite was sent to {inviteDetails.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {authMode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setIsForgotPasswordOpen(true);
                    }}
                    className="text-xs text-[#298585] hover:text-[#1F628E] underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{authError}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#298585] hover:bg-[#1F628E]"
              disabled={authLoading2}
            >
              {authLoading2 ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {authMode === "login" ? "Logging in..." : "Creating account..."}
                </>
              ) : authMode === "login" ? (
                "Log In & Accept Invite"
              ) : (
                "Sign Up & Accept Invite"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Forgot Password Dialog */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#298585]" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsForgotPasswordOpen(false)}
                className="flex-1 min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={resetLoading}
                className="flex-1 min-h-[44px] bg-[#298585] hover:bg-[#1F628E]"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
