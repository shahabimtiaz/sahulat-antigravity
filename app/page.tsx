import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { ArrowRight, Languages, MapPin, Brain, ShieldCheck, Sparkles } from "lucide-react";

const SAMPLE_PROMPTS = [
  "AC bilkul kaam nahi kar raha, kal subah G-13 mein technician chahiye, budget zyada nahi hai.",
  "I need a female beautician for facial in F-7 tomorrow evening.",
  "Plumber chahiye abhi, bathroom mein leak hai I-8 ke andar.",
  "Bijli ka switch jal gaya hai Gulberg Lahore mein, urgent.",
  "Math tutor for O-Level, Cantt area, twice a week.",
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md sm:max-w-2xl lg:max-w-5xl px-4 py-6 sm:py-10 space-y-10">
      <header className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-brand/15 ring-1 ring-brand/30 flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Sahulat" className="w-full h-full object-cover" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Sahulat</span>
          <Badge tone="brand" className="ml-auto">Antigravity-Native</Badge>
        </div>

        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
          Book a trusted home-service pro
          <span className="text-ink-muted"> — in Urdu, English, or both.</span>
        </h1>
        <p className="text-ink-muted text-base sm:text-lg max-w-prose">
          A multi-agent orchestrator handles intent extraction, provider matching, dynamic pricing,
          and scheduling — with reasoning traces you can audit.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          <Badge tone="default"><Languages className="size-3.5" /> Urdu · Roman Urdu · English</Badge>
          <Badge tone="default"><MapPin className="size-3.5" /> Islamabad · Rawalpindi · Lahore</Badge>
          <Badge tone="default"><Brain className="size-3.5" /> 11-factor matching</Badge>
          <Badge tone="default"><ShieldCheck className="size-3.5" /> Transparent pricing</Badge>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-4">
          <Link href="/request" className="contents">
            <Button size="lg" className="w-full sm:w-auto">
              Start a request <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link href="/agents" className="contents">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
              Agent Manager
            </Button>
          </Link>
          <Link href="/provider/dashboard" className="contents">
            <Button variant="ghost" size="lg" className="w-full sm:w-auto">
              Provider dashboard
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid-bg rounded-3xl p-1">
        <Card className="rounded-[20px] p-6 sm:p-8 space-y-4 bg-bg-soft/70">
          <div className="flex items-center gap-2 text-ink-muted">
            <Brain className="size-4" />
            <span className="text-xs uppercase tracking-wider font-semibold">Try saying</span>
          </div>
          <ul className="space-y-2.5">
            {SAMPLE_PROMPTS.map((p) => (
              <li key={p}>
                <Link
                  href={`/request?q=${encodeURIComponent(p)}`}
                  className="block rounded-xl bg-bg-elev/70 border border-line px-4 py-3 text-sm hover:border-brand/40 hover:bg-bg-elev transition"
                >
                  <span className="text-ink">{p}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { title: "Intent → multi-language", body: "Roman Urdu, Urdu, English, code-switching all parsed by a Gemini agent with a confidence score.", icon: Languages },
          { title: "11-factor matching", body: "Travel time, availability, rating, on-time, specialization, price fit, capacity, cancellation, risk + more.", icon: Brain },
          { title: "Audit-grade traces", body: "Every decision is captured as an Antigravity-style artifact you can review at /traces/[booking].", icon: ShieldCheck },
        ].map(({ title, body, icon: Icon }) => (
          <Card key={title} className="space-y-2">
            <Icon className="size-5 text-brand-soft" />
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-ink-muted">{body}</p>
          </Card>
        ))}
      </section>

      <footer className="text-center text-xs text-ink-dim pt-10">
        Built with Google Antigravity skills · Gemini 2.5 · Supabase · Google Places API
      </footer>
    </main>
  );
}
