import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getPersonaHomePath } from "@shared/personas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Redirect, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, Check, ChevronRight, CircleHelp, CreditCard, Eye, EyeOff,
  HardDrive, LifeBuoy, Lock, Network, Server,
  ShieldCheck, UserRound, Users, Loader2,
  type LucideIcon,
} from "lucide-react";
import "@/components/auth/auth-page.css";
import { useLanguage } from "@/hooks/use-language";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type SystemStatus = { initialized: boolean; userCount: number; needsSetup: boolean };
type ModuleStatus = { key: string; name: string; core: boolean; enabled: boolean };
type Highlight = {
  icon: LucideIcon;
  title: string;
  description: string;
  module: "asset_management" | "itsm";
};

const HIGHLIGHTS: Highlight[] = [
  {
    icon: Server,
    title: "Data Center & CMDB",
    description: "Full lifecycle management for servers, racks, cloud infrastructure, and network topology.",
    module: "asset_management",
  },
  {
    icon: HardDrive,
    title: "IT Asset Lifecycle",
    description: "Complete hardware, endpoint, component, software, and license tracking.",
    module: "asset_management",
  },
  {
    icon: LifeBuoy,
    title: "ITSM & Service Desk",
    description: "Automated incident resolution, change workflows, problem management, and SLA tracking.",
    module: "itsm",
  },
  {
    icon: ShieldCheck,
    title: "Governance, Risk & Compliance",
    description: "Audit-ready IT component registers, configuration baselines, and policy mappings.",
    module: "asset_management",
  },
  {
    icon: CreditCard,
    title: "Financials & Procurement",
    description: "Vendor management, purchase order tracking, budget planning, and depreciation analysis.",
    module: "asset_management",
  },
  {
    icon: Users,
    title: "Employee Self-Service",
    description: "Streamlined asset handovers, service requests, offboarding clearances, and approvals.",
    module: "itsm",
  },
];

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const { t } = useLanguage();
  const search = useSearch();
  const signedOutForInactivity = new URLSearchParams(search).get("reason") === "idle";
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { data: systemStatus, isLoading: statusLoading } = useQuery<SystemStatus>({
    queryKey: ["/api/system/status"],
    retry: false,
  });
  const { data: moduleStatus } = useQuery<ModuleStatus[]>({
    queryKey: ["/api/module-status"],
    retry: false,
  });

  // Keep the existing conservative fallback when module status is unavailable.
  const enabledModuleKeys = moduleStatus?.filter((module) => module.enabled).map((module) => module.key) ?? ["asset_management"];
  const highlights = HIGHLIGHTS.filter((highlight) => enabledModuleKeys.includes(highlight.module));
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  if (user) return <Redirect to={getPersonaHomePath(
    user.roles?.map(role => role.name) ?? [],
    user.permissions ?? [],
  )} />;

  if (systemStatus && !systemStatus.initialized) return <Redirect to="/initialize" />;

  const onSubmit = (data: LoginFormData) => {
    if (loginMutation.isPending) return;
    loginMutation.mutate({ username: data.username, password: data.password });
  };

  return (
    <main className="auth-shell">
      <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-two" aria-hidden="true" />
      <div className="auth-grain" aria-hidden="true" />

      <div className="auth-layout">
        <section className="auth-access" aria-labelledby="sign-in-title">
          <div className="auth-brand">
            <div className="auth-brand-mark" aria-hidden="true">
              <Network className="auth-brand-network" />
              <span />
            </div>
            <div>
              <div className="auth-brand-name">YOUR ORGANIZATION</div>
              <div className="auth-brand-caption">ENTERPRISE OPERATIONS PLATFORM</div>
            </div>
          </div>

          <div className="auth-card">
            <div className="auth-card-heading">
              <div className="auth-card-emblem"><Lock aria-hidden="true" /></div>
              <div>
                <h2 id="sign-in-title">Sign in</h2>
                <p>Use your organization credentials to continue.</p>
              </div>
            </div>

            {statusLoading && (
              <p className="auth-status-note" role="status">
                Checking sign-in availability…
              </p>
            )}
            {signedOutForInactivity && (
              <p className="auth-status-note" role="status" data-testid="idle-logout-notice">
                {t("You were signed out due to 10 minutes of inactivity.")}
              </p>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="auth-form"
                aria-busy={loginMutation.isPending}
              >
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem className="auth-field">
                      <label htmlFor="auth-username" className="auth-label">Username or Email</label>
                        <div className="auth-input-wrap">
                          <UserRound className="auth-input-icon" aria-hidden="true" />
                          <FormControl>
                            <Input
                              {...field}
                              id="auth-username"
                              type="text"
                              autoComplete="username"
                              placeholder="Username or email"
                              disabled={loginMutation.isPending}
                              data-testid="input-username"
                              className="auth-input"
                            />
                          </FormControl>
                        </div>
                      <FormMessage className="auth-validation" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="auth-field">
                      <label htmlFor="auth-password" className="auth-label">Password</label>
                        <div className="auth-input-wrap">
                          <Lock className="auth-input-icon" aria-hidden="true" />
                          <FormControl>
                            <Input
                              {...field}
                              id="auth-password"
                              type={passwordVisible ? "text" : "password"}
                              autoComplete="current-password"
                              placeholder="Your password"
                              disabled={loginMutation.isPending}
                              data-testid="input-password"
                              className="auth-input auth-password-input"
                            />
                          </FormControl>
                          <button
                            type="button"
                            className="auth-password-toggle"
                            aria-label={passwordVisible ? "Hide password" : "Show password"}
                            aria-pressed={passwordVisible}
                            aria-controls="auth-password"
                            disabled={loginMutation.isPending}
                            onClick={() => setPasswordVisible((visible) => !visible)}
                          >
                            {passwordVisible
                              ? <EyeOff aria-hidden="true" />
                              : <Eye aria-hidden="true" />}
                          </button>
                        </div>
                      <FormMessage className="auth-validation" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="auth-submit"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="auth-submit-spinner" aria-hidden="true" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <ChevronRight className="auth-submit-arrow" aria-hidden="true" />
                    </>
                  )}
                </Button>
                <span className="auth-sr-only" role="status" aria-live="polite">
                  {loginMutation.isPending ? "Signing in. Please wait." : ""}
                </span>
              </form>
            </Form>

            {loginMutation.error && (
              <Alert variant="destructive" className="auth-error" role="alert">
                <CircleHelp className="auth-error-icon" aria-hidden="true" />
                <AlertDescription>{loginMutation.error.message}</AlertDescription>
              </Alert>
            )}

            <div className="auth-security-notice">
              <div className="auth-security-icon"><Lock aria-hidden="true" /></div>
              <p><strong>Secure Enterprise Portal</strong><br />Access restricted to authorized personnel. Contact IT Administration for provisioning.</p>
            </div>
          </div>
          <p className="auth-access-footnote"><Check aria-hidden="true" /> Protected access · Session activity is monitored</p>
        </section>

        <section className="auth-overview" aria-labelledby="platform-title">
          <h1 id="platform-title">Enterprise IT Service Management <em>&amp;</em> Asset Governance Platform</h1>
          <p className="auth-subheading">
            Unified ITSM, CMDB, Network Topology, and Governance framework engineered for end-to-end IT operations and compliance auditing.
          </p>

          <div className="auth-capabilities-head">
            <span>PLATFORM CAPABILITIES</span>
          </div>
          <div className="auth-feature-grid">
            {highlights.map(({ icon: Icon, title, description }) => (
              <article className="auth-feature-card" key={title}>
                <div className="auth-feature-card-top">
                  <div className="auth-feature-icon"><Icon aria-hidden="true" /></div>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="auth-feature-accent" aria-hidden="true" />
              </article>
            ))}
          </div>

          <div className="auth-overview-footer">
            <div className="auth-footer-mark"><Activity aria-hidden="true" /></div>
            <span>Operational clarity, from infrastructure to governance.</span>
            <div className="auth-footer-line" />
          </div>
        </section>
      </div>
    </main>
  );
}
