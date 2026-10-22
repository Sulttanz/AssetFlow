import { ArrowUpRight, BookOpen, BriefcaseBusiness, Check, ClipboardList, FileCheck2, LifeBuoy, Package, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import type { UserWithDetails } from "@shared/schema";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { useModules } from "@/hooks/use-modules";
import { dashboardWorkspace } from "@/lib/dashboard-workspace";

const linkIcons = [ClipboardList, LifeBuoy, Package, BookOpen, ShieldCheck, FileCheck2, BriefcaseBusiness];

export function PersonaDashboard({ user }: { user: UserWithDetails }) {
  const workspace = dashboardWorkspace(user);
  const { isModuleEnabled } = useModules();
  const links = workspace.links.filter(
    (link) => !link.moduleKey || isModuleEnabled(link.moduleKey),
  );

  return (
    <div className="min-h-[100dvh] flex-1 overflow-y-auto bg-[#f1f5f2]">
      <Header
        title="Dashboard"
        description={workspace.description}
        showAddButton={false}
        showSearch={false}
      />

      <main className="space-y-6 p-4 pb-10 md:p-6" aria-label="Dashboard workspace">
        <section className="relative overflow-hidden rounded-2xl bg-[#18383b] px-5 py-6 text-[#f4f5ee] shadow-sm md:px-7 md:py-7">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-3 -top-14 h-52 w-52 rounded-full border border-white/10" />
          <div className="relative max-w-2xl">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a7c9bd]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#91c6a9]" />
              Enterprise workspace
            </p>
            <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.035em] md:text-[32px]">
              Good to have you here.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#c2d1ca]">
              {workspace.description} Choose a workspace below to continue.
            </p>
          </div>
        </section>

        <section aria-labelledby="workspace-links-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#66817f]">Your workspace</p>
              <h2 id="workspace-links-heading" className="mt-1 text-lg font-semibold tracking-tight text-[#1b3438]">
                Where would you like to start?
              </h2>
            </div>
            {links.length > 0 && (
              <span className="shrink-0 text-xs font-medium text-[#728487]">
                {links.length} {links.length === 1 ? "destination" : "destinations"}
              </span>
            )}
          </div>

          {links.length === 0 ? (
            <Card className="border-dashed border-[#cbd9d4] bg-[#f8faf8] shadow-none">
              <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e8f1ed] text-[#43846e]">
                  <Check className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-[#365852]">No workspaces are available</h3>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#80908d]">
                  The modules for your available workspaces are currently disabled. Contact your administrator if you need access.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {links.map((link, index) => {
                const Icon = linkIcons[index % linkIcons.length];
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-label={`${link.title}: ${link.description}`}
                    className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34766c] focus-visible:ring-offset-2"
                  >
                    <Card className="h-full border-[#dce6e4] bg-[#fbfcfa] shadow-sm transition-colors duration-150 group-hover:border-[#b7cfca] group-hover:bg-white">
                      <CardContent className="flex min-h-[124px] items-start gap-4 p-4 md:p-5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7f1ef] text-[#23665d] transition-colors group-hover:bg-[#dcece7]">
                          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[#294448] group-hover:text-[#1c6c61]">{link.title}</span>
                            <ArrowUpRight className="h-4 w-4 shrink-0 text-[#9aabaa] transition-colors group-hover:text-[#34766c]" aria-hidden="true" />
                          </span>
                          <span className="mt-1.5 block text-xs leading-relaxed text-[#718184]">{link.description}</span>
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
