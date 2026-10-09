export interface RawVacancy {
  /** Stable id from the careers platform. */
  externalId: string;
  title: string;
  locationText: string | null;
  url: string;
  /** ISO date or datetime, or null when the site gives none. */
  closingDate: string | null;
  /** Pay as the site shows it, when the listing carries it. */
  salary?: string | null;
}

export interface Company {
  slug: string;
  name: string;
  /** Lower-case place-name fragments for depots and stations within range of CV31/CV1. */
  inRange: string[];
  fetch: () => Promise<RawVacancy[]>;
  /** Factory and warehouse floor roles, judged with the factory title rules instead of the rail ones. */
  category?: 'factory';
  /** Titles this company uses for drivers that the generic classifier would not recognise. */
  driverTitles?: RegExp;
  /** A news feed rather than a job board: a frontline word in a headline proves nothing, so only driver posts count. */
  driverOnly?: boolean;
  /** Fills in fields that need a second request, called only for vacancies about to be sent. */
  enrich?: (vacancy: RawVacancy) => Promise<Partial<RawVacancy>>;
  /** Poll less often than the run interval, for sites that are expensive to fetch. */
  pollEveryMinutes?: number;
}
