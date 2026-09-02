'use client';

import { Loader2, LocateFixed, MapPin, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface GeoResult {
  id: number;
  name: string;
  country_code?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  population?: number;
}

const POPULAR_CITIES = [
  { id: 'tokyo-jp', name: 'Tokyo', countryCode: 'JP' },
  { id: 'delhi-in', name: 'Delhi', countryCode: 'IN' },
  { id: 'shanghai-cn', name: 'Shanghai', countryCode: 'CN' },
  { id: 'new-york-us', name: 'New York', countryCode: 'US' },
  { id: 'london-gb', name: 'London', countryCode: 'GB' },
  { id: 'paris-fr', name: 'Paris', countryCode: 'FR' },
  { id: 'singapore-sg', name: 'Singapore', countryCode: 'SG' },
  { id: 'sydney-au', name: 'Sydney', countryCode: 'AU' },
  { id: 'dubai-ae', name: 'Dubai', countryCode: 'AE' },
  { id: 'mumbai-in', name: 'Mumbai', countryCode: 'IN' },
  { id: 'bangkok-th', name: 'Bangkok', countryCode: 'TH' },
  { id: 'hong-kong-hk', name: 'Hong Kong', countryCode: 'HK' },
];

function slugify(name: string, countryCode: string): string {
  const namePart = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${namePart}-${countryCode.toLowerCase()}`;
}

/**
 * Location picker for the weather page. Quick chips cover popular cities;
 * the search box queries the key-less Open-Meteo geocoding API, so any
 * settlement on Earth can be selected — not just the vendored list.
 */
export function CitySelector({ currentCity }: { currentCity?: string }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<GeoResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [locating, setLocating] = React.useState(false);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setFailed(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=8&language=en&format=json`,
        );
        const json = (await res.json()) as { results?: GeoResult[] };
        setResults(json.results ?? []);
        setFailed(false);
      } catch {
        setResults([]);
        setFailed(true);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const goTo = (params: URLSearchParams) => router.push(`/weather?${params.toString()}`);

  const useMyLocation = () => {
    if (!('geolocation' in navigator) || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let name = 'My location';
        let cc = 'UN';
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          );
          const json = (await res.json()) as { city?: string; locality?: string; countryCode?: string };
          name = json.city || json.locality || name;
          cc = json.countryCode || cc;
        } catch {
          // Offline reverse geocode — keep the generic label.
        }
        setLocating(false);
        goTo(
          new URLSearchParams({
            city: slugify(name, cc),
            lat: String(latitude),
            lng: String(longitude),
            name,
            cc,
          }),
        );
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  };

  const selectPopular = (city: (typeof POPULAR_CITIES)[number]) => {
    goTo(new URLSearchParams({ city: city.id }));
  };

  const selectGeo = (place: GeoResult) => {
    const cc = (place.country_code ?? 'UN').toUpperCase();
    const params = new URLSearchParams({
      city: slugify(place.name, cc),
      lat: String(place.latitude),
      lng: String(place.longitude),
      name: place.name,
      cc,
    });
    if (place.timezone) params.set('tz', place.timezone);
    setQuery('');
    goTo(params);
  };

  return (
    <Card className="z-overlay mb-8 p-5">
      <div className="mb-4 flex items-center gap-3">
        <MapPin className="text-primary size-5" />
        <h3 className="font-semibold">Select Location</h3>
        <button
          type="button"
          onClick={useMyLocation}
          className="border-border hover:border-primary/40 text-muted-foreground ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
        >
          {locating ? <Loader2 className="animate-spin size-3.5" /> : <LocateFixed className="size-3.5" />}
          Use my location
        </button>
      </div>

      <div className="relative mb-4">
        <Input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          leading={searching ? <Loader2 className="animate-spin" /> : <Search />}
          placeholder="Search any city or town worldwide…"
          aria-label="Search cities worldwide"
        />
        {query.trim().length >= 2 && (
          <div className="border-border bg-background absolute inset-x-0 top-full z-overlay mt-1 overflow-hidden rounded-lg border shadow-xl">
            {results.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => selectGeo(place)}
                className="hover:bg-surface-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              >
                <MapPin className="text-muted-foreground size-4 shrink-0" />
                <span className="truncate font-medium">{place.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {place.admin1 ? `${place.admin1}, ` : ''}
                  {place.country_code}
                </span>
              </button>
            ))}
            {!searching && results.length === 0 && (
              <p className="text-muted-foreground px-3 py-2 text-sm">
                {failed ? 'Geocoding service unreachable — try a popular city below.' : 'No places found.'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {POPULAR_CITIES.map((city) => (
          <button
            key={city.id}
            type="button"
            onClick={() => selectPopular(city)}
            className={
              currentCity === city.id
                ? 'bg-primary/15 border-primary/40 text-primary rounded-full border px-3 py-1 text-xs font-medium'
                : 'border-border hover:border-primary/40 rounded-full border px-3 py-1 text-xs'
            }
          >
            {city.name}, {city.countryCode}
          </button>
        ))}
      </div>
    </Card>
  );
}
