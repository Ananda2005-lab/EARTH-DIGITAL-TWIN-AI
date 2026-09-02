import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface CitySeedData {
  name: string;
  countryCode: string;
  population: number;
  lng: number;
  lat: number;
  isCapital: boolean;
  timezone: string;
  metroPopulation?: number;
  areaKm2?: number;
  elevationM?: number;
}

function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function seedCities() {
  console.log('🌍 Starting cities seed...');

  // Read the cities seed data
  const citiesPath = join(__dirname, 'cities-seed.json');
  const citiesData: CitySeedData[] = JSON.parse(readFileSync(citiesPath, 'utf-8'));

  console.log(`📊 Found ${citiesData.length} cities to seed`);

  let seeded = 0;
  let skipped = 0;

  for (const cityData of citiesData) {
    try {
      // Find the country by code
      const country = await prisma.country.findUnique({
        where: { code: cityData.countryCode },
      });

      if (!country) {
        console.warn(`⚠️  Country ${cityData.countryCode} not found, skipping ${cityData.name}`);
        skipped++;
        continue;
      }

      const slug = slugify(cityData.name);

      // Check if city already exists
      const existing = await prisma.city.findUnique({
        where: {
          countryCode_slug: {
            countryCode: cityData.countryCode,
            slug,
          },
        },
      });

      if (existing) {
        console.log(`⏭️  City ${cityData.name} already exists, skipping`);
        skipped++;
        continue;
      }

      // Create the city
      await prisma.city.create({
        data: {
          countryId: country.id,
          countryCode: cityData.countryCode,
          name: cityData.name,
          asciiName: cityData.name,
          slug,
          population: cityData.population,
          lng: cityData.lng,
          lat: cityData.lat,
          timezone: cityData.timezone,
          isCapital: cityData.isCapital,
          metroPopulation: cityData.metroPopulation,
          areaKm2: cityData.areaKm2,
          elevationM: cityData.elevationM,
        },
      });

      seeded++;
      console.log(`✅ Seeded: ${cityData.name}, ${cityData.countryCode}`);
    } catch (error) {
      console.error(`❌ Error seeding ${cityData.name}:`, error);
      skipped++;
    }
  }

  console.log(`\n🎉 Cities seed complete!`);
  console.log(`   ✅ Seeded: ${seeded}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   📊 Total: ${citiesData.length}`);
}

async function main() {
  try {
    await seedCities();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
