import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function PasswordToggleButton({
  isVisible,
  onToggle,
}: {
  isVisible: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      aria-label={isVisible ? "Hide password" : "Show password"}
      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 transition hover:text-white"
      onClick={onToggle}
      size="icon"
      type="button"
      variant="ghost"
    >
      {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  );
}

function BrandHeader() {
  return (
    <div className="flex flex-col items-center space-y-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center">
        <svg aria-hidden="true" className="h-8 w-8" viewBox="0 0 32 32">
          <defs>
            <linearGradient id="loginLogoGradient" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
              <stop offset="100%" stopColor="rgba(180,190,255,0.7)" />
            </linearGradient>
          </defs>
          <g fill="none" stroke="url(#loginLogoGradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
            <path d="M16 2L2 8l14 6 14-6-14-6Z" />
            <path d="M2 12l14 6 14-6" />
            <path d="M2 16l14 6 14-6" />
          </g>
        </svg>
      </div>
      <h1 className="text-3xl font-semibold text-white">Login</h1>
    </div>
  );
}

function LoginForm({
  onSubmit,
  isLoading,
  showPassword,
  setShowPassword,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isLoading: boolean;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1">
        <Label className="text-sm font-medium text-white/75" htmlFor="username">
          Username
        </Label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <Input
            autoComplete="username"
            className="h-11 rounded-xl border border-white/15 bg-[#0f0f0f] pr-3 pl-10 text-white placeholder:text-white/35 focus:border-white/45 focus:outline-none focus:ring-0"
            id="username"
            name="username"
            placeholder="operator"
            required
            type="text"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-sm font-medium text-white/75" htmlFor="password">
          Password
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <Input
            autoComplete="current-password"
            className="h-11 rounded-xl border border-white/15 bg-[#0f0f0f] pr-12 pl-10 text-white placeholder:text-white/35 focus:border-white/45 focus:outline-none focus:ring-0"
            id="password"
            name="password"
            placeholder="••••••••"
            required
            type={showPassword ? "text" : "password"}
          />
          <PasswordToggleButton
            isVisible={showPassword}
            onToggle={() => setShowPassword(!showPassword)}
          />
        </div>
      </div>

        <button
          className="inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-white/90 text-sm font-medium text-black transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isLoading}
          type="submit"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            Login
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    if (!username.trim()) {
      setFormError("Username is required");
      return;
    }

    if (!password.trim()) {
      setFormError("Password is required");
      return;
    }

    try {
      await login(username, password);
      toast.success("Welcome back!", {
        description: "You have been successfully signed in.",
      });
      navigate("/");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      setFormError(errorMessage);
      toast.error("Login failed", {
        description: "Please check your credentials and try again.",
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-sm space-y-10 text-center">
        <BrandHeader />
        <div className="space-y-6 text-left">
          {formError || error ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-sm text-red-300">
              {formError || error}
            </div>
          ) : null}

          <LoginForm
            isLoading={isLoading}
            onSubmit={handleSubmit}
            setShowPassword={setShowPassword}
            showPassword={showPassword}
          />
        </div>

        <p className="text-xs text-white/60">
          Need access? Contact your workspace administrator.
        </p>
      </div>
    </div>
  );
}
