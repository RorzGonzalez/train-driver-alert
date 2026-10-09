import { successFactors } from './successfactors.js';

// GXO's sites within 50 miles of Coventry. The distance search only works with
// coordinates; a bare town name is a text match on the location.
export const gxo = successFactors({
  host: 'jobs.gxo.com',
  search: 'q=&searchby=distance&d=50&lat=52.4068&lon=-1.5197&geolocation=Coventry',
});
