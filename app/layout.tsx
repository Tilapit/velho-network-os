import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Logo } from "@/components/ui";
import { asOf, isDemo, loadModel } from "@/lib/engine.ts";
import { thisWeek } from "@/lib/score.ts";
import { claudeAvailable } from "@/lib/claude.ts";

export const metadata: Metadata = { title: "Velho Network OS", description: "Who should I talk to this week, why now, and what should I say?" };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { model, ranked } = loadModel();
  const demo = isDemo();
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <div className="shell">
          <aside className="side">
            <div className="brand">
              <Logo />
              Velho Network OS
            </div>
            <Nav
              counts={{
                overview: thisWeek(ranked).length,
                network: model.people.filter((p) => p.connected).length,
                engagement: model.posts.length,
                opportunities: ranked.filter((o) => o.status === "recommend").length,
                intelligence: model.signals.length,
              }}
            />
            <div className="side-foot">
              {demo ? <span className="pill warning" style={{ justifySelf: "start" }}>Synthetic demo data</span> : null}
              <span>Data as of {asOf()}</span>
              <span>{claudeAvailable() ? "Drafts: Claude" : "Drafts: templates (no API key)"}</span>
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
