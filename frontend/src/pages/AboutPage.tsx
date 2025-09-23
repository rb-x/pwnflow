import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Github,
  Linkedin,
  ExternalLink,
  Shield,
  Brain,
  Network,
  Zap,
  Lock,
  Users,
  Mail,
} from "lucide-react";

export function AboutPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">About Pwnflow</h1>
        <p className="text-lg text-muted-foreground">
          A modern cybersecurity mind mapping platform designed for security
          professionals
        </p>
      </div>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Why Pwnflow?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Visual Thinking</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Map out complex security assessments and attack vectors visually
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Graph-Based Architecture</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Powered by Neo4j for complex relationship modeling
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Security First</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Built by security professionals for security professionals
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">AI-Powered</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Smart suggestions and automated node generation
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Pwnflow combines the power of mind mapping with cybersecurity
              workflows, enabling teams to visualize, plan, and execute security
              assessments more effectively.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Team */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Meet the Team
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Riadh */}
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold">Riadh BOUCHAHOUA</h3>
                <p className="text-sm text-muted-foreground">
                  Co-Creator / Offensive Security Expert
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://github.com/rb-x"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="h-4 w-4 " />
                    @rb-x
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://www.linkedin.com/in/riadh-bch"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Linkedin className="h-4 w-4 " />
                    LinkedIn
                  </a>
                </Button>
              </div>
            </div>

            {/* Ludovic */}
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold">Ludovic COULON</h3>
                <p className="text-sm text-muted-foreground">
                  Co-Creator / Defensive Security Expert
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://github.com/LasCC"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="h-4 w-4 " />
                    @LasCC
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://www.linkedin.com/in/ludovic-coulon"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Linkedin className="h-4 w-4 " />
                    LinkedIn
                  </a>
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Built with passion for the cybersecurity community
            </p>
            <div className="flex justify-center">
              <Button variant="outline" size="sm" asChild>
                <a href="mailto:contact@penflow.sh">
                  <Mail className="h-4 w-4 " />
                  contact@penflow.sh
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tech Stack */}
      <Card>
        <CardHeader>
          <CardTitle>Technology Stack</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">React</Badge>
            <Badge variant="secondary">TypeScript</Badge>
            <Badge variant="secondary">FastAPI</Badge>
            <Badge variant="secondary">Neo4j</Badge>
            <Badge variant="secondary">ReactFlow</Badge>
            <Badge variant="secondary">Tailwind CSS</Badge>
            <Badge variant="secondary">Docker</Badge>
            <Badge variant="secondary">OAuth2</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Links */}
      <Card>
        <CardHeader>
          <CardTitle>Resources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-start" asChild>
            <a
              href="https://github.com/rb-x/pwnflow"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4 " />
              GitHub Repository
              <ExternalLink className="h-4 w-4 ml-auto" />
            </a>
          </Button>
          <Button variant="outline" className="w-full justify-start" asChild>
            <a
              href="https://docs.pwnflow.sh"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Lock className="h-4 w-4 " />
              Documentation
              <ExternalLink className="h-4 w-4 ml-auto" />
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Version */}
      <div className="text-center text-sm text-muted-foreground">
        <p>Pwnflow v1.1.0 • Made with ❤️ for the security community</p>
      </div>
    </div>
  );
}
