/** JSON-serialisable slice of `CountrySummary` handed from the server page to client components. */
export interface CountryLite {
  code: string;
  name: string;
  population: number;
  areaKm2: number;
  continent: string;
}
