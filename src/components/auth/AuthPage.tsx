import { useState } from "react";
import { useAuth } from "@/contexts/useAuthHook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { validateEmail, validatePassword } from "@/lib/validation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

export default function AuthPage() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email
    const emailValidation = validateEmail(loginEmail);
    if (!emailValidation.valid) {
      toast({
        title: "❌ Invalid Email",
        description: emailValidation.error,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await login(emailValidation.value!, loginPassword);
    } catch (error: any) {
      console.error("[Auth] Login failed:", error);
      toast({
        title: "❌ Login Failed",
        description: error.message || "Hmm, we couldn't log you in. Check your email and password and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email
    const emailValidation = validateEmail(registerEmail);
    if (!emailValidation.valid) {
      toast({
        title: "❌ Invalid Email",
        description: emailValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(registerPassword);
    if (!passwordValidation.valid) {
      toast({
        title: "❌ Invalid Password",
        description: passwordValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Validate name
    if (!registerName || registerName.trim().length === 0) {
      toast({
        title: "❌ Name Required",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }

    if (registerName.length > 100) {
      toast({
        title: "❌ Name Too Long",
        description: "Name must be 100 characters or less",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await register(
        emailValidation.value!,
        passwordValidation.value!,
        registerName.trim(),
      );
    } catch (error: any) {
      console.error("[Auth] Registration failed:", error);
      toast({
        title: "❌ Registration Failed",
        description: error.message || "Something went wrong. Try again, or contact support if this keeps happening.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email
    const emailValidation = validateEmail(resetEmail);
    if (!emailValidation.valid) {
      toast({
        title: "⚠️ Invalid Email",
        description: emailValidation.error,
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
    } catch (error: any) {
      console.error("Password reset failed:", error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to send reset link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <svg className="w-8 h-8 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">ListMine</h1>
          <p className="text-gray-600 mt-2">
            Organize your life, one list at a time
          </p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>
                  Enter your credentials to access your lists
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="your@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="min-h-[44px] mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      We'll never share your email
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="min-h-[44px] mt-2"
                    />
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => setIsForgotPasswordOpen(true)}
                        className="text-sm text-primary underline hover:text-primary/80"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full min-h-[44px]"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Sign In
                  </Button>
                  <p className="text-center text-sm text-gray-600 mt-4">
                    New to ListMine?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        const registerTab = document.querySelector('[value="register"]') as HTMLElement;
                        registerTab?.click();
                      }}
                      className="text-primary font-semibold underline hover:text-primary/80"
                    >
                      Create a free account
                    </button>
                  </p>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Create an account</CardTitle>
                <CardDescription>
                  Start with a Free account - no credit card required
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label htmlFor="register-name">Name</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Your name"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      required
                      className="min-h-[44px] mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="your@email.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      required
                      className="min-h-[44px] mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      We'll never share your email
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      required
                      className="min-h-[44px] mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Must be at least 8 characters
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900 font-medium mb-1">
                      ✨ Free Tier Includes:
                    </p>
                    <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                      <li>Create up to 5 lists</li>
                      <li>Unlimited items per list</li>
                      <li>Share lists with others</li>
                    </ul>
                    <p className="text-xs text-blue-700 mt-2">
                      Upgrade anytime from inside the app for more features!
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full min-h-[44px]"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Create Free Account
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Forgot Password Modal */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
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
                placeholder="your@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                className="min-h-[44px] mt-2"
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
                className="flex-1 min-h-[44px]"
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Send Reset Link
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}