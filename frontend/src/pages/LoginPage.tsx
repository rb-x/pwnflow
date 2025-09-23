import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      className="-translate-y-1/2 absolute top-1/2 right-2 h-7 w-7 p-0 transition-colors hover:bg-muted/80"
      onClick={onToggle}
      size="sm"
      type="button"
      variant="ghost"
    >
      {isVisible ? (
        <EyeOff className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Eye className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}

function BrandHeader() {
  return (
    <div className="mb-8 text-center">
      <div className="space-y-2">
        <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text font-bold text-4xl tracking-tight">
          Pwnflow
        </h1>
        <p className="text-muted-foreground">
          Cybersecurity Mind Mapping Platform
        </p>
      </div>
    </div>
  );
}

function LoginFormCard({
  onSubmit,
  isLoading,
  error,
  showPassword,
  setShowPassword,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
}) {
  return (
    <div className="relative">
      <Card className="relative z-10 overflow-hidden rounded-2xl border border-border transition-all duration-300">
        <CardContent className="relative z-20 pt-6">
          {error && (
            <div className="slide-in-from-top-2 mb-4 animate-in rounded-lg border border-destructive/20 bg-destructive/5 p-3 duration-300">
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          )}
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-3">
              <Label className="font-medium text-sm" htmlFor="username">
                Username
              </Label>
              <div className="relative">
                <User className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  autoComplete="username"
                  className="h-11 pl-10 transition-colors focus:ring-2 focus:ring-ring focus:ring-offset-0"
                  id="username"
                  name="username"
                  placeholder="Enter your username"
                  required
                  type="text"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-medium text-sm" htmlFor="password">
                Password
              </Label>
              <div className="relative">
                <Lock className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  autoComplete="current-password"
                  className="h-11 pr-10 pl-10 transition-colors focus:ring-2 focus:ring-ring focus:ring-offset-0"
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  required
                  type={showPassword ? "text" : "password"}
                />
                <PasswordToggleButton
                  isVisible={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                className="vertical-align-middle relative inline-flex h-11 w-full cursor-pointer touch-manipulation select-none appearance-none items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-b from-primary to-primary/90 px-4 py-2 font-medium text-sm text-primary-foreground leading-5 shadow-sm transition-all duration-200 ease-out hover:from-primary/90 hover:to-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:from-primary/80 active:to-primary/70 disabled:pointer-events-none disabled:cursor-default disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
                disabled={isLoading}
                type="submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Bottom section with terms */}
      <div className="-mt-4 relative z-0 flex flex-col items-center gap-2 rounded-b-2xl border border-border bg-muted/50 p-4 pt-8 shadow-sm">
        <div className="space-y-3 text-center">
          <p className="text-muted-foreground text-xs">
            Don&apos;t have an account?{" "}
            <Link
              to="/register"
              className="text-primary hover:text-primary/80 font-medium transition-colors underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
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
    <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center rounded-lg border bg-background shadow-xs">
      <div className="w-full max-w-md space-y-8">
        <BrandHeader />

        <LoginFormCard
          error={formError || error}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          setShowPassword={setShowPassword}
          showPassword={showPassword}
        />
      </div>
    </div>
  );
}
