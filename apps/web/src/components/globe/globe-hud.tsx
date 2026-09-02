'use client';

import {
  countryCodeToFlagEmoji,
  formatCompact,
  formatRelativeTime,
  type BasemapDefinition,
  type HazardEvent,
  type LngLat,
} from '@edt/shared';
import { Compass, Layers, Pause, Play, Search, SlidersHorizontal, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { SeverityBadge } from '@/components/data/severity-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { countryByCode, findCountries } from '@/lib/data/countries';
import { cn } from '@/lib/utils';

import type { CountryOutline } from './country-geometry';
import { LayerPanel } from './layer-panel';

export function GlobeHud({
  basemap,
  basemaps,
  onBasemapChange,
  hoveredCountry,
  selectedCountry,
  selectedHazard,
  hazardCount,
  autoRotate,
  onToggleAutoRotate,
  onFlyTo,
  layerIds,
  onToggleLayer,
  onCloseInfo,
}: {
  basemap: string;
  basemaps: readonly BasemapDefinition[];
  onBasemapChange: (id: string) => void;
  hoveredCountry: CountryOutline | null;
  selectedCountry: CountryOutline | null;
  selectedHazard: HazardEvent | null;
  hazardCount: number;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  onFlyTo: (center: LngLat, distance?: number) => void;
  layerIds: string[];
  onToggleLayer: (id: string) => void;
  onCloseInfo: () => void;
}) {
  const [layersOpen, setLayersOpen] = React.useState(false);

  return (
    <>
      <div className="z-overlay pointer-events-none absolute inset-x-0 top-0 flex justify-center px-4 pt-4">
        <div className="pointer-events-auto">
          <GlobeSearch onFlyTo={onFlyTo} />
        </div>
      </div>

      {hoveredCountry ? (
        <div className="z-overlay pointer-events-none absolute bottom-4 left-4">
          <span className="glass-sm rounded-lg px-3 py-1.5 text-xs font-medium">
            {hoveredCountry.name}
          </span>
        </div>
      ) : null}

      <div className="z-overlay absolute right-4 top-4 flex flex-col items-end gap-2">
        <BasemapMenu basemap={basemap} basemaps={basemaps} onChange={onBasemapChange} />
        <Button
          variant="glass"
          size="sm"
          onClick={() => setLayersOpen((value) => !value)}
          aria-expanded={layersOpen}
        >
          <SlidersHorizontal />
          Layers
        </Button>
        <Button
          variant="glass"
          size="icon-sm"
          onClick={onToggleAutoRotate}
          aria-label={autoRotate ? 'Pause rotation' : 'Resume rotation'}
        >
          {autoRotate ? <Pause /> : <Play />}
        </Button>
        <Badge variant="danger" className="glass-sm border-none">
          <TriangleAlert />
          {formatCompact(hazardCount)} active hazards
        </Badge>
      </div>

      {layersOpen ? <LayerPanel enabledIds={layerIds} onToggle={onToggleLayer} /> : null}

      {selectedCountry ? (
        <CountryInfoPanel country={selectedCountry} onClose={onCloseInfo} />
      ) : selectedHazard ? (
        <HazardInfoPanel event={selectedHazard} onClose={onCloseInfo} />
      ) : null}

      <div className="text-muted-foreground/70 z-overlay pointer-events-none absolute bottom-3 right-4 text-[10px]">
        Esri, Maxar · USGS · NASA EONET/FIRMS · GDACS
      </div>
    </>
  );
}

function GlobeSearch({ onFlyTo }: { onFlyTo: (center: LngLat, distance?: number) => void }) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);

  const results = React.useMemo(() => (query.trim() ? findCountries(query, 6) : []), [query]);

  return (
    <div className="relative w-72 sm:w-96">
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        leading={<Search />}
        placeholder="Search for a country…"
        className="glass border-white/10"
      />
      {open && results.length > 0 ? (
        <Card className="absolute left-0 top-full mt-2 w-full overflow-hidden p-1">
          {results.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => {
                onFlyTo(country.center, 175);
                setQuery(country.name);
                setOpen(false);
              }}
              className="hover:bg-surface-muted flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors"
            >
              <span className="text-base leading-none" aria-hidden>
                {country.flagEmoji}
              </span>
              <span className="min-w-0 flex-1 truncate">{country.name}</span>
              <span className="text-muted-foreground text-xs">{country.code}</span>
            </button>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

function BasemapMenu({
  basemap,
  basemaps,
  onChange,
}: {
  basemap: string;
  basemaps: readonly BasemapDefinition[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const active = basemaps.find((entry) => entry.id === basemap);

  return (
    <div className="relative">
      <Button variant="glass" size="sm" onClick={() => setOpen((value) => !value)}>
        <Layers />
        {active?.label ?? 'Basemap'}
      </Button>
      {open ? (
        <Card className="absolute right-0 top-full mt-2 w-64 overflow-hidden p-1">
          {basemaps.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                onChange(entry.id);
                setOpen(false);
              }}
              className={cn(
                'flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                entry.id === basemap ? 'bg-primary/12 text-primary' : 'hover:bg-surface-muted',
              )}
            >
              <span className="font-medium">{entry.label}</span>
              <span className="text-muted-foreground text-xs">{entry.description}</span>
            </button>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

function InfoPanelFrame({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <Card className="animate-fade-in-up z-overlay absolute bottom-4 left-4 w-80 max-w-[calc(100vw-2rem)] p-0 sm:w-96">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="text-muted-foreground hover:text-foreground hover:bg-surface-muted absolute right-3 top-3 rounded-lg p-1 transition-colors"
      >
        <X className="size-4" />
      </button>
      {children}
    </Card>
  );
}

function CountryInfoPanel({ country, onClose }: { country: CountryOutline; onClose: () => void }) {
  const reference = countryByCode(country.code);

  return (
    <InfoPanelFrame onClose={onClose}>
      <div className="p-5">
        <div className="flex items-center gap-2.5 pr-6">
          {reference ? (
            <span className="text-2xl leading-none" aria-hidden>
              {reference.flagEmoji}
            </span>
          ) : null}
          <h3 className="display-tight truncate text-base">{country.name}</h3>
        </div>

        {reference ? (
          <>
            <p className="text-muted-foreground mt-1 text-xs">{reference.officialName}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="stat-label">Capital</dt>
                <dd className="mt-0.5 text-sm">{reference.capital ?? '—'}</dd>
              </div>
              <div>
                <dt className="stat-label">Population</dt>
                <dd className="numeric mt-0.5 text-sm">{formatCompact(reference.population)}</dd>
              </div>
              <div>
                <dt className="stat-label">Continent</dt>
                <dd className="mt-0.5 text-sm">{reference.continent}</dd>
              </div>
              <div>
                <dt className="stat-label">Region</dt>
                <dd className="mt-0.5 truncate text-sm">{reference.subregion ?? '—'}</dd>
              </div>
            </dl>
            <Button size="sm" className="mt-4 w-full" asChild>
              <Link href={`/countries/${reference.code.toLowerCase()}`}>
                <Compass />
                Full profile
              </Link>
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground mt-3 text-sm">No reference data available.</p>
        )}
      </div>
    </InfoPanelFrame>
  );
}

function HazardInfoPanel({ event, onClose }: { event: HazardEvent; onClose: () => void }) {
  return (
    <InfoPanelFrame onClose={onClose}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 pr-6">
          <h3 className="display-tight text-base leading-snug">{event.title}</h3>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <SeverityBadge severity={event.severity} />
          <span className="text-muted-foreground text-xs">
            {formatRelativeTime(event.startedAt)}
          </span>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          {event.place ?? `${event.location.lat.toFixed(2)}, ${event.location.lng.toFixed(2)}`}
        </p>
        <p className="text-muted-foreground/80 mt-3 text-[11px]">Source: {event.source}</p>
        {event.sourceUrl ? (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary mt-2 inline-block text-xs underline-offset-4 hover:underline"
          >
            View source report
          </a>
        ) : null}
      </div>
    </InfoPanelFrame>
  );
}
