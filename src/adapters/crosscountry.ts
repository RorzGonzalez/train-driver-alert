import { workday } from './workday.js';

// CrossCountry sits on Arriva's group tenant. Two searches are merged: the
// hiring-company facet and the keyword search the official link uses.
export const crossCountry = workday({
  host: 'arriva.wd3.myworkdayjobs.com',
  tenant: 'arriva',
  site: 'Careers',
  queries: [{ appliedFacets: { hiringCompany: ['45f91f5cf8f30110d7b17c846815ee0a'] } }, { searchText: 'crosscountry' }],
});
