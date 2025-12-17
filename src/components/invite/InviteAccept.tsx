import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/useAuthHook";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Mail, Users, List, AlertCircle, CheckCircle } from "lucide-react";

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

  // Check if logged-in user matches invite email
  useEffect(() => {
    if (!authLoading && isAuthenticated && user && inviteDetails?.email) {
      const userEmail = user.email?.toLowerCase();
      const inviteEmail = inviteDetails.email.toLowerCase();

      if (userEmail !== inviteEmail) {
        // User is logged in with different email - show warning
        toast({
          title: "⚠️ Email Mismatch",
          description: `This invite was sent to ${inviteDetails.email}. You're logged in as ${user.email}. Please log out and sign in with the correct account.`,
          variant: "destructive",
          duration: 10000,
        });
      }
    }
  }, [authLoading, isAuthenticated, user, inviteDetails, toast]);

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle>
              {inviteDetails.expired ? "Invite Expired" : "Invite Already Used"}
            </CardTitle>
            <CardDescription>
              {inviteDetails.expired
                ? "This invite has expired. Please ask the sender for a new invite."
                : "This invite has already been accepted."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(isAuthenticated ? "/dashboard" : "/")} className="w-full">
              {isAuthenticated ? "Go to Dashboard" : "Go to Home"}
            </Button>
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
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Email mismatch:</strong> This invite was sent to{" "}
                    <strong>{inviteDetails.email}</strong>, but you're logged in as{" "}
                    <strong>{user.email}</strong>.
                  </p>
                </div>
                <Button onClick={handleLogout} variant="outline" className="w-full">
                  Log out and use correct account
                </Button>
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
              <Label htmlFor="password">Password</Label>
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
    </div>
  );
}
