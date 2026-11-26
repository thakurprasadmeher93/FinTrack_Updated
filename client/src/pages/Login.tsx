import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalletMinimal, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppHeader } from "@/components/AppHeader";
import { AppFooter } from "@/components/AppFooter";
import { usePlatformConfig } from "@/hooks/use-platform-config";

export default function Login() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { config } = usePlatformConfig();

  const initialMode = (): "login" | "register" => {
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "signup" ? "register" : "login";
  };

  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(initialMode);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!config.registrationEnabled && mode === "register") setMode("login");
  }, [config.registrationEnabled, mode]);
  
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    displayName: "",
    email: "",
    token: ""
  });

  // Don't auto-redirect authenticated users from login page
  // They may be here intentionally to manage their account

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await apiRequest("POST", "/api/login-custom", { username: formData.username, password: formData.password });
        toast({ title: "Success", description: "Logged in successfully" });
        window.location.href = "/dashboard-full";
        return;
      } else if (mode === "register") {
        await apiRequest("POST", "/api/register-custom", { ...formData, email: formData.username });
        toast({ title: "Success", description: `Account created! Welcome to ${config.applicationName}.` });
        window.location.href = "/dashboard-full";
        return;
      } else if (mode === "forgot") {
        const res = await apiRequest("POST", "/api/forgot-password", { email: formData.username });
        const data = await res.json();
        toast({ title: "Success", description: data.message });
        if (data.token) {
          setFormData({ ...formData, token: data.token });
          setMode("reset");
        }
      } else if (mode === "reset") {
        await apiRequest("POST", "/api/reset-password", { token: formData.token, password: formData.password });
        toast({ title: "Success", description: "Password reset successful" });
        setMode("login");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-sky-950">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-emerald-500/25 blur-[130px]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-sky-500/20 blur-[130px]" />
        <div className="absolute top-1/2 right-1/4 w-[200px] h-[200px] rounded-full bg-teal-500/15 blur-[80px]" />
      </div>
      <AppHeader showAuth={false} />
      <div className="relative flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mb-5 shadow-lg shadow-emerald-500/10">
            <WalletMinimal className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white">{config.applicationName}</h1>
          <p className="text-emerald-300/70 mt-2">Track every rupee under your control</p>
        </div>

        <Card className="border-white/10 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-xl">
              {mode === "login" && "Welcome Back"}
              {mode === "register" && "Create Account"}
              {mode === "forgot" && "Reset Password"}
              {mode === "reset" && "Enter New Password"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode !== "reset" && (
                <div className="space-y-2">
                  <Label htmlFor="username">Email Address</Label>
                  <Input 
                    id="username"
                    type="email"
                    required 
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                  />
                </div>
              )}
              
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Name</Label>
                  <Input 
                    id="displayName" 
                    required 
                    value={formData.displayName}
                    onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                  />
                </div>
              )}

              {(mode === "login" || mode === "register" || mode === "reset") && (
                <div className="space-y-2">
                  <Label htmlFor="password">{mode === "reset" ? "New Password" : "Password"}</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    required 
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              )}

              {mode === "reset" && (
                <div className="space-y-2">
                  <Label htmlFor="token">Reset Token (from email)</Label>
                  <Input 
                    id="token" 
                    required 
                    value={formData.token}
                    onChange={(e) => setFormData({...formData, token: e.target.value})}
                  />
                </div>
              )}

              <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  mode === "login" ? "Login" : 
                  mode === "register" ? "Register" : 
                  mode === "forgot" ? "Send Reset Link" : "Reset Password"
                )}
              </Button>
            </form>

            <div className="mt-6 flex flex-col gap-2 items-center text-sm">
              {mode === "login" && (
                <>
                  <div className="flex gap-1">
                    {config.registrationEnabled ? (
                      <>
                        <span className="text-muted-foreground">Don't have an account?</span>
                        <Button variant="link" className="p-0 h-auto" onClick={() => setMode("register")}>Register here</Button>
                      </>
                    ) : <span className="text-muted-foreground">New account registration is currently disabled.</span>}
                  </div>
                  <Button variant="link" className="p-0 h-auto" onClick={() => setMode("forgot")}>Forgot Password?</Button>
                </>
              )}
              {mode === "register" && (
                <div className="flex gap-1">
                  <span className="text-muted-foreground">Already have an account?</span>
                  <Button variant="link" className="p-0 h-auto" onClick={() => setMode("login")}>Login here</Button>
                </div>
              )}
              {(mode === "forgot" || mode === "reset") && (
                <Button variant="link" className="p-0 h-auto" onClick={() => setMode("login")}>Back to Login</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
      
      <AppFooter />
    </div>
  );
}
