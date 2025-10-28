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
import { ListChecks } from "lucide-react";
import { Loader2 } from "lucide-react";
import { validateEmail, validatePassword } from "@/lib/validation";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email
    const emailValidation = validateEmail(loginEmail);
    if (!emailValidation.valid) {
      alert(emailValidation.error);
      return;
    }

    setLoading(true);
    try {
      await login(emailValidation.value!, loginPassword);
    } catch (error: any) {
      console.error("Login failed:", error);
      alert(
        error.message ||
          "Hmm, we couldn't log you in. Check your email and password and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email
    const emailValidation = validateEmail(registerEmail);
    if (!emailValidation.valid) {
      alert(emailValidation.error);
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(registerPassword);
    if (!passwordValidation.valid) {
      alert(passwordValidation.error);
      return;
    }

    // Validate name
    if (!registerName || registerName.trim().length === 0) {
      alert("Name is required");
      return;
    }

    if (registerName.length > 100) {
      alert("Name must be 100 characters or less");
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
      console.error("Registration failed:", error);
      alert(
        error.message ||
          "Something went wrong. Try again, or contact support if this keeps happening.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <ListChecks className="w-8 h-8 text-primary-foreground" />
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
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Create an account</CardTitle>
                <CardDescription>
                  Get started with your list management journey
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
                  <Button
                    type="submit"
                    className="w-full min-h-[44px]"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Create Account
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
