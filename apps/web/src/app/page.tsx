import { LAYERS, NAV_ITEMS, PLATFORM } from '@edt/shared';
import {
  ArrowRight,
  Bot,
  Gauge,
  Globe2,
  Layers,
  Radar,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { Badge, LiveBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NavIcon } from '@/components/nav-icon';

export const metadata: Metadata = {
  title: `${PLATFORM.name} — ${PLATFORM.tagline}`,
  description:
    'A real-time digital twin of Earth. Explore any place on the planet with live weather, hazards, flights, shipping, satellites and AI-powered location intelligence.',
};

const PILLARS = [
  {
    icon: Globe2,
    title: 'Immersive 3D globe',
    body: 'A 60 fps digital twin with satellite, terrain, night-lights and hybrid basemaps. Fly anywhere, drop a pin, get answers.',
  },
  {
    icon: Layers,
    title: `${LAYERS.length} data layers`,
    body: 'Temperature, wind, precipitation, air quality, sea-surface temperature, ocean currents, forest cover, internet cables, protected areas and more.',
  },
  {
    icon: Radar,
    title: 'Live movement',
    body: 'ADS-B aircraft, AIS vessels, orbiting satellites and ISS passes, streamed and interpolated between updates.',
  },
  {
    icon: Sparkles,
    title: 'AI that reads the map',
    body: 'The assistant sees your viewport, active layers and selection, so "compare these two" just works. Reports export in one click.',
  },
  {
    icon: Gauge,
    title: 'Mission Control',
    body: 'A planetary situation room: hazard alerts, environmental telemetry, watchlists and daily AI briefings in one view.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise foundations',
    body: 'JWT with refresh rotation, OAuth, RBAC, per-key rate limits, audit logging and a full admin console.',
  },
] as const;

const SOURCES = [
  'NASA EONET',
  'NASA FIRMS',
  'USGS',
  'GDACS',
  'Open-Meteo',
  'ECMWF',
  'NOAA SWPC',
  'Copernicus CAMS',
  'OpenSky',
  'AISStream',
  'CelesTrak',
  'World Bank',
] as const;

const HIGHLIGHT_IDS = ['globe', 'hazards', 'flights', 'ships', 'weather', 'analytics'];

export default function LandingPage() {
  const highlights = HIGHLIGHT_IDS.map((id) => NAV_ITEMS.find((item) => item.id === id)).filter(
    (item): item is (typeof NAV_ITEMS)[number] => item !== undefined,
  );

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <div
        className="aurora-bg pointer-events-none absolute inset-x-0 top-0 h-[820px]"
        aria-hidden
      />
      <div
        className="grid-overlay pointer-events-none absolute inset-x-0 top-0 h-[820px]"
        aria-hidden
      />

      <header className="z-header relative mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard">
              Launch app
              <ArrowRight />
            </Link>
          </Button>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="animate-fade-in mb-6 gap-1.5">
            <Zap className="size-3" aria-hidden />
            Live planetary data, no setup required
          </Badge>

          <h1 className="animate-fade-in-up display-tight text-4xl leading-[1.05] sm:text-6xl lg:text-7xl">
            <span className="text-gradient">A living replica of</span>
            <br />
            <span className="text-gradient-brand animate-gradient-pan">planet Earth</span>
          </h1>

          <p
            className="animate-fade-in-up text-muted-foreground mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg"
            style={{ animationDelay: '120ms' }}
          >
            Google Earth&apos;s exploration, Windy&apos;s meteorology, FlightRadar&apos;s traffic
            and ArcGIS&apos;s analysis — fused into one premium surface, then handed to an AI that
            understands what you are looking at.
          </p>

          <div
            className="animate-fade-in-up mt-9 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: '220ms' }}
          >
            <Button size="lg" asChild>
              <Link href="/globe">
                <Globe2 />
                Open the globe
              </Link>
            </Button>
            <Button size="lg" variant="glass" asChild>
              <Link href="/ai">
                <Bot />
                Ask the assistant
              </Link>
            </Button>
          </div>

          <dl
            className="animate-fade-in-up mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-4"
            style={{ animationDelay: '320ms' }}
          >
            {[
              { value: `${LAYERS.length}`, label: 'Map layers' },
              { value: '250', label: 'Territories' },
              { value: '210', label: 'Cities' },
              { value: '12', label: 'Live feeds' },
            ].map((stat) => (
              <div key={stat.label} className="glass-sm px-4 py-5">
                <dt className="stat-label">{stat.label}</dt>
                <dd className="stat-value mt-1 text-xl sm:text-2xl">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Capability pillars ─────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="display-tight text-gradient text-2xl sm:text-4xl">
            Built like a mission control room
          </h2>
          <p className="text-muted-foreground mt-3 text-sm sm:text-base">
            Every screen is fed by real providers with graceful degradation — one dead upstream
            never takes the platform down.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((pillar) => (
            <Card key={pillar.title} className="hover-lift p-6">
              <span className="bg-primary/12 text-primary inline-flex size-10 items-center justify-center rounded-xl">
                <pillar.icon className="size-5" aria-hidden />
              </span>
              <h3 className="display-tight mt-4 text-base">{pillar.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{pillar.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Module showcase ───────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display-tight text-gradient text-2xl sm:text-3xl">Start anywhere</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Twenty-four modules, one shared spatial context.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              See all modules
              <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="focus-visible:ring-ring rounded-2xl outline-none focus-visible:ring-2"
            >
              <Card interactive className="h-full p-5">
                <div className="flex items-center gap-3">
                  <NavIcon name={item.icon} className="text-primary size-5 shrink-0" />
                  <span className="display-tight text-sm">{item.label}</span>
                  {item.badge === 'live' ? <LiveBadge className="ml-auto" /> : null}
                </div>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {item.description}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Provenance ────────────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <Card className="p-8 text-center sm:p-12">
          <span className="stat-label">Every number is attributed</span>
          <h2 className="display-tight text-gradient mx-auto mt-3 max-w-2xl text-2xl sm:text-3xl">
            Authoritative sources, cited on every panel
          </h2>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {SOURCES.map((source) => (
              <li
                key={source}
                className="glass-sm text-muted-foreground rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                {source}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* ── Closing CTA ───────────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-4xl px-4 py-20 text-center sm:px-6">
        <h2 className="display-tight text-gradient text-3xl sm:text-5xl">
          Open the globe. Ask a question.
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-sm sm:text-base">
          No credit card, no onboarding wizard. The planet is already loaded.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/dashboard">
              Enter Mission Control
              <ArrowRight />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/register">Create an account</Link>
          </Button>
        </div>
      </section>

      <footer className="border-border/60 relative border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-xs sm:px-6">
          <div className="flex items-center gap-3">
            <Logo showWordmark={false} />
            <span>
              {PLATFORM.name} v{PLATFORM.version}
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-4">
            <Link href="/globe" className="hover:text-foreground transition-colors">
              Globe
            </Link>
            <Link href="/analytics" className="hover:text-foreground transition-colors">
              Analytics
            </Link>
            <Link href="/settings" className="hover:text-foreground transition-colors">
              Settings
            </Link>
            <a
              href={`mailto:${PLATFORM.supportEmail}`}
              className="hover:text-foreground transition-colors"
            >
              Support
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
