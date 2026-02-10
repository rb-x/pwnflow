import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import api from "@/services/api";

interface AIStatus {
  status: string;
  ai_configured: boolean;
  ai_provider: string | null;
  ai_model: string | null;
  ai_base_url: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI-Compatible",
};

const CONFIG_EXAMPLES = [
  {
    name: "Google Gemini",
    vars: ["GOOGLE_API_KEY=your-api-key", "GEMINI_MODEL=gemini-2.0-flash"],
  },
  {
    name: "OpenAI",
    vars: [
      "AI_BASE_URL=https://api.openai.com/v1",
      "AI_API_KEY=sk-...",
      "AI_MODEL=gpt-4o",
    ],
  },
  {
    name: "Ollama (local)",
    vars: ["AI_BASE_URL=http://localhost:11434/v1", "AI_MODEL=llama3"],
  },
  {
    name: "LM Studio (local)",
    vars: ["AI_BASE_URL=http://localhost:1234/v1", "AI_MODEL=your-model-name"],
  },
  {
    name: "vLLM (local)",
    vars: ["AI_BASE_URL=http://localhost:8000/v1", "AI_MODEL=your-model-name"],
  },
];

export function AISettings() {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<AIStatus>("/ai/status");
      setStatus(res.data);
    } catch {
      setError(true);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const isConnected = status?.status === "healthy" && status.ai_configured;
  const providerLabel = status?.ai_provider
    ? (PROVIDER_LABELS[status.ai_provider] ?? status.ai_provider)
    : null;

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card className="border border-white/10 bg-[#0f0f0f]">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Bot className="h-5 w-5" />
                AI Provider
              </CardTitle>
              <CardDescription>
                Current AI service connection status
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchStatus}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && !status ? (
            <div className="flex h-20 items-center justify-center text-white/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking AI service...
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <XCircle className="h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-300">
                  Unable to reach AI service
                </p>
                <p className="text-xs text-white/50">
                  Make sure the AI service container is running.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#111] px-4 py-3">
                {isConnected ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-amber-400" />
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {isConnected ? "Connected" : "Not configured"}
                    </span>
                    <Badge
                      className={`rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-medium ${
                        isConnected
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-amber-500/15 text-amber-200"
                      }`}
                    >
                      {isConnected ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {isConnected && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
                      <span>
                        Provider:{" "}
                        <span className="text-white/70">{providerLabel}</span>
                      </span>
                      <span>
                        Model:{" "}
                        <span className="text-white/70">
                          {status?.ai_model}
                        </span>
                      </span>
                      {status?.ai_base_url && (
                        <span>
                          Endpoint:{" "}
                          <span className="text-white/70">
                            {status.ai_base_url}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Reference */}
      <Card className="border border-white/10 bg-[#0f0f0f]">
        <CardHeader>
          <CardTitle className="text-white">Configuration Reference</CardTitle>
          <CardDescription>
            Set these environment variables in your{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
              .env
            </code>{" "}
            file and restart the services.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {CONFIG_EXAMPLES.map((example) => (
            <div
              key={example.name}
              className="rounded-xl border border-white/10 bg-[#111] p-4"
            >
              <p className="mb-2 text-sm font-medium text-white/80">
                {example.name}
              </p>
              <pre className="overflow-x-auto rounded-lg bg-black/60 px-3 py-2 text-xs text-white/60">
                {example.vars.join("\n")}
              </pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
