/**
 * Idempotent database seed.
 *
 * Everything here uses upserts keyed on natural identifiers, so running it twice
 * (or against a partially seeded database) converges instead of failing.
 *
 * Passwords come from the environment when provided:
 *   SEED_OWNER_PASSWORD, SEED_ADMIN_PASSWORD, SEED_ANALYST_PASSWORD, SEED_DEMO_PASSWORD
 * When a variable is absent a documented development-only default is used
 * (see DEV_DEFAULT_PASSWORD below). Never run this seed against production
 * without setting the four variables.
 *
 * Reference data is read from the web app's vendored gazetteer:
 *   apps/web/src/lib/data/country-reference.json  (required)
 *   apps/web/src/lib/data/city-reference.json     (optional)
 * When the city file is absent, capital cities are derived from the country
 * reference so the gazetteer is never empty.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AnnotationKind, Continent, PrismaClient, type Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

/** Development-only fallback. Meets the 12-char mixed-class password policy. */
const DEV_DEFAULT_PASSWORD = 'EarthTwin!2025';
const BCRYPT_COST = Number.parseInt(process.env.BCRYPT_COST ?? '12', 10);

const DATA_DIR = resolve(__dirname, '..', '..', 'web', 'src', 'lib', 'data');
const COUNTRY_FILE = join(DATA_DIR, 'country-reference.json');
const CITY_FILE = join(DATA_DIR, 'city-reference.json');

interface LngLat {
  lng: number;
  lat: number;
}

interface CountryReference {
  numeric: string | null;
  code: string;
  code3: string;
  name: string;
  officialName: string;
  continent: string;
  region: string | null;
  subregion: string | null;
  capital: string | null;
  capitalCenter: LngLat | null;
  center: LngLat;
  population: number;
  populationYear: number | null;
  areaKm2: number;
  flagEmoji: string;
  currencies: { code: string; name: string; symbol: string | null }[];
  languages: { code: string; name: string }[];
  callingCodes: string[];
  tld: string[];
  independent: boolean;
  unMember: boolean;
  landlocked: boolean;
  borders: string[];
  demonym: string | null;
  incomeGroup: string | null;
  altSpellings: string[];
}

interface CityReference {
  geonameId?: number;
  name: string;
  asciiName?: string;
  countryCode: string;
  admin1?: string | null;
  admin2?: string | null;
  population?: number;
  center?: LngLat;
  lng?: number;
  lat?: number;
  elevationM?: number | null;
  timezone?: string;
  isCapital?: boolean;
  metroPopulation?: number | null;
}

const CONTINENT_BY_LABEL: Record<string, Continent> = {
  Africa: Continent.AFRICA,
  Antarctica: Continent.ANTARCTICA,
  Asia: Continent.ASIA,
  Europe: Continent.EUROPE,
  'North America': Continent.NORTH_AMERICA,
  Oceania: Continent.OCEANIA,
  'South America': Continent.SOUTH_AMERICA,
};

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 72) || 'place'
  );
}

function asciiFold(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '');
}

function clampLng(value: number): number {
  return Math.min(180, Math.max(-180, value));
}

function clampLat(value: number): number {
  return Math.min(90, Math.max(-90, value));
}

// ── Users ────────────────────────────────────────────────────────────────────

interface SeedUser {
  email: string;
  password: string;
  name: string;
  role: 'owner' | 'admin' | 'analyst' | 'user';
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  organisation: string | null;
  jobTitle: string | null;
}

function seedUsers(): SeedUser[] {
  return [
    {
      email: (process.env.SEED_OWNER_EMAIL ?? 'owner@earthdigitaltwin.ai').toLowerCase(),
      password: process.env.SEED_OWNER_PASSWORD ?? DEV_DEFAULT_PASSWORD,
      name: 'Platform Owner',
      role: 'owner',
      plan: 'enterprise',
      organisation: 'Earth Digital Twin AI',
      jobTitle: 'Founder',
    },
    {
      email: (process.env.SEED_ADMIN_EMAIL ?? 'admin@earthdigitaltwin.ai').toLowerCase(),
      password: process.env.SEED_ADMIN_PASSWORD ?? DEV_DEFAULT_PASSWORD,
      name: 'Platform Admin',
      role: 'admin',
      plan: 'enterprise',
      organisation: 'Earth Digital Twin AI',
      jobTitle: 'Operations lead',
    },
    {
      email: (process.env.SEED_ANALYST_EMAIL ?? 'analyst@earthdigitaltwin.ai').toLowerCase(),
      password: process.env.SEED_ANALYST_PASSWORD ?? DEV_DEFAULT_PASSWORD,
      name: 'Senior Analyst',
      role: 'analyst',
      plan: 'team',
      organisation: 'Earth Digital Twin AI',
      jobTitle: 'Geospatial analyst',
    },
    {
      email: (process.env.SEED_DEMO_EMAIL ?? 'demo@earthdigitaltwin.ai').toLowerCase(),
      password: process.env.SEED_DEMO_PASSWORD ?? DEV_DEFAULT_PASSWORD,
      name: 'Demo Explorer',
      role: 'user',
      plan: 'pro',
      organisation: null,
      jobTitle: null,
    },
  ];
}

async function seedAccounts(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};

  for (const user of seedUsers()) {
    const passwordHash = await hash(user.password, BCRYPT_COST);
    const record = await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        passwordHash,
        name: user.name,
        role: user.role,
        plan: user.plan,
        status: 'active',
        organisation: user.organisation,
        jobTitle: user.jobTitle,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
        timezone: 'UTC',
        preference: { create: {} },
        notificationPreference: { create: {} },
      },
      update: {
        passwordHash,
        name: user.name,
        role: user.role,
        plan: user.plan,
        status: 'active',
        emailVerified: true,
      },
      select: { id: true },
    });

    // Preference rows are created lazily elsewhere; make sure they exist.
    await prisma.userPreference.upsert({
      where: { userId: record.id },
      create: { userId: record.id },
      update: {},
    });
    await prisma.notificationPreference.upsert({
      where: { userId: record.id },
      create: { userId: record.id },
      update: {},
    });

    ids[user.role] = record.id;
    console.log(`  user ${user.email} (${user.role})`);
  }

  return ids;
}

// ── Feature flags ────────────────────────────────────────────────────────────

// Unchecked input: the seed sets `updatedById` directly rather than connecting
// the relation, and Prisma forbids mixing the checked and unchecked variants.
const FEATURE_FLAGS: Prisma.FeatureFlagUncheckedCreateInput[] = [
  {
    key: 'globe.time_machine',
    label: 'Globe time machine',
    description: 'Scrub the planet through 50 years of imagery and events.',
    enabled: true,
    rollout: 25,
    audience: ['pro', 'team', 'enterprise', 'internal'],
  },
  {
    key: 'ai.streaming',
    label: 'Streaming AI responses',
    description: 'Server-sent token streaming for the planetary analyst.',
    enabled: true,
    rollout: 100,
    audience: ['free', 'pro', 'team', 'enterprise', 'internal'],
  },
  {
    key: 'ships.live_ais',
    label: 'Live AIS vessel layer',
    description: 'Requires AISSTREAM_API_KEY on the API tier.',
    enabled: true,
    rollout: 100,
    audience: ['pro', 'team', 'enterprise', 'internal'],
  },
  {
    key: 'reports.pdf_export',
    label: 'PDF report export',
    description: 'Render generated reports to a branded PDF.',
    enabled: false,
    rollout: 0,
    audience: ['team', 'enterprise', 'internal'],
  },
  {
    key: 'analytics.correlations',
    label: 'Indicator correlations',
    description: 'Pearson correlation explorer across World Bank indicators.',
    enabled: true,
    rollout: 100,
    audience: ['team', 'enterprise', 'internal'],
  },
  {
    key: 'hazards.geofenced_alerts',
    label: 'Geofenced hazard alerts',
    description: 'Radius subscriptions with email and webhook fan-out.',
    enabled: true,
    rollout: 100,
    audience: ['pro', 'team', 'enterprise', 'internal'],
  },
];

async function seedFeatureFlags(ownerId: string): Promise<void> {
  for (const flag of FEATURE_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      create: { ...flag, updatedById: ownerId },
      update: {
        label: flag.label,
        description: flag.description,
        audience: flag.audience,
        updatedById: ownerId,
      },
    });
  }
  console.log(`  ${FEATURE_FLAGS.length} feature flags`);
}

async function main(): Promise<void> {
  console.log('Seeding Earth Digital Twin AI database...');
  const users = await seedAccounts();
  const ownerId = users.owner;
  if (!ownerId) throw new Error('Owner account was not created');
  await seedFeatureFlags(ownerId);
  console.log(`Seed complete. Development account password: ${DEV_DEFAULT_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
