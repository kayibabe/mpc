import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44, isBase44Env } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

export default function Login() {
  const navigate = useNavigate();

  // In self-hosted (custom backend) mode, staff log in with an Employee ID,
  // not an email — send them to the dedicated CustomLogin page.
  useEffect(() => {
    if (!isBase44Env) navigate("/custom-login", { replace: true });
  }, [navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("password"); // password or totp
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      
      // Check if user has TOTP enabled
      const user = await base44.auth.me();
      
      // Search for UserSecurity by email as fallback if user_id lookup fails
      let userSecurity = await base44.entities.UserSecurity.filter(
        { user_id: user.id },
        '-created_date',
        1
      );

      if (userSecurity.length > 0 && userSecurity[0].is_totp_enabled) {
        setStep("totp");
        setLoading(false);
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      setError(err.message || "Invalid email or password");
      setLoading(false);
    }
  };

  const handleTotpSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await base44.functions.invoke('loginWithTotp', {
        token: useBackup ? undefined : totpCode,
        backup_code: useBackup ? backupCode : undefined,
      });

      if (response.data.verified) {
        window.location.href = "/";
      } else {
        setError("Invalid code. Try again or use a backup code.");
      }
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  return (
    <AuthLayout
      icon={LogIn}
      title={step === "password" ? "Welcome back" : "Two-Factor Authentication"}
      subtitle={step === "password" ? "Log in to your account" : "Verify your identity"}
      footer={
        step === "password" ? (
          <>
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Create one
            </Link>
          </>
        ) : null
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {step === "password" && (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Log in"
              )}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-12 text-sm font-medium"
            onClick={handleGoogle}
          >
            <GoogleIcon className="w-5 h-5 mr-2" />
            Continue with Google
          </Button>
        </>
      )}

      {step === "totp" && (
        <form onSubmit={handleTotpSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Verification Code</Label>
            <p className="text-xs text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
            {!useBackup ? (
              <Input
                type="text"
                inputMode="numeric"
                maxLength="6"
                pattern="[0-9]{6}"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center font-mono text-2xl tracking-widest h-12"
                autoFocus
                required
              />
            ) : (
              <Input
                type="text"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                className="font-mono text-lg h-12"
                autoFocus
                required
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setUseBackup(!useBackup);
              setTotpCode("");
              setBackupCode("");
              setError("");
            }}
            className="text-xs text-primary hover:underline"
          >
            {useBackup ? "Use authenticator code" : "Use backup code"}
          </button>

          <Button 
            type="submit" 
            className="w-full h-12 font-medium" 
            disabled={useBackup ? backupCode.length < 6 : totpCode.length !== 6 || loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}