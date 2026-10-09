import { enrichAvanti, fetchAvanti } from './adapters/avanti.js';
import { fetchChiltern } from './adapters/chiltern.js';
import { fetchColas } from './adapters/colas.js';
import { crossCountry } from './adapters/crosscountry.js';
import { fetchDbCargo } from './adapters/db-cargo.js';
import { fetchDrs } from './adapters/drs.js';
import { fetchEmr } from './adapters/emr.js';
import { freightliner } from './adapters/freightliner.js';
import { fetchGbrf } from './adapters/gbrf.js';
import { fetchGtr } from './adapters/gtr.js';
import { enrichGwr, fetchGwr } from './adapters/gwr.js';
import { enrichHeavyHaul, fetchHeavyHaul } from './adapters/heavy-haul.js';
import { fetchPreMetro } from './adapters/pre-metro.js';
import { fetchWmt } from './adapters/wmt.js';
import type { Company } from './types.js';

// inRange: lower-case fragments of places within about an hour of CV31 / CV1,
// matched as substrings of the advert's location text and title.
const LOCAL = ['leamington', 'coventry', 'rugby', 'nuneaton'];
const BIRMINGHAM = ['birmingham', 'new street', 'snow hill', 'moor street', 'tyseley', 'landor street', 'lawley street'];
const BESCOT = ['bescot', 'walsall', 'wednesbury', 'west midlands'];
// Stations and depots the passenger operators staff within the hour.
const STATIONS = [
  'kenilworth', 'warwick', 'bedworth', 'atherstone', 'polesworth', 'canley', 'tile hill', 'berkswell', 'hampton-in-arden', 'hampton in arden',
  'marston green', 'stechford', 'solihull', 'dorridge', 'shirley', 'stratford-upon-avon', 'stratford upon avon', 'henley-in-arden',
  'hatton', 'lapworth', 'tamworth', 'lichfield', 'sutton coldfield', 'walsall', 'wolverhampton', 'redditch', 'bromsgrove', 'kidderminster',
  'stourbridge', 'worcester', 'evesham', 'moreton-in-marsh', 'kingham', 'charlbury', 'hanborough', 'oxford', 'bicester', 'banbury',
  'cheltenham', 'northampton', 'long buckby', 'milton keynes', 'bletchley', 'hinckley', 'leicester', 'market harborough', 'kettering',
  'loughborough', 'derby', 'burton', 'stafford',
];
// Freight yards and intermodal terminals within the hour.
const TERMINALS = ['hams hall', 'birch coppice', 'coleshill', 'tamworth', 'daventry', 'dirft'];
const PASSENGER = [...LOCAL, ...BIRMINGHAM, ...STATIONS];
const FREIGHT = [...LOCAL, ...BIRMINGHAM, ...BESCOT, ...TERMINALS];

export const companies: Company[] = [
  {
    slug: 'wmt',
    name: 'West Midlands Trains',
    inRange: PASSENGER,
    fetch: fetchWmt,
  },
  {
    slug: 'chiltern',
    name: 'Chiltern Railways',
    inRange: PASSENGER,
    fetch: fetchChiltern,
  },
  {
    slug: 'crosscountry',
    name: 'CrossCountry',
    inRange: PASSENGER,
    fetch: crossCountry.fetch,
    enrich: crossCountry.enrich,
  },
  {
    slug: 'avanti',
    name: 'Avanti West Coast',
    inRange: PASSENGER,
    fetch: fetchAvanti,
    enrich: enrichAvanti,
  },
  {
    slug: 'gwr',
    name: 'Great Western Railway',
    inRange: PASSENGER,
    fetch: fetchGwr,
    enrich: enrichGwr,
  },
  {
    slug: 'emr',
    name: 'East Midlands Railway',
    inRange: PASSENGER,
    fetch: fetchEmr,
  },
  {
    slug: 'gtr',
    name: 'Great Northern Thameslink',
    inRange: ['bedford'],
    fetch: fetchGtr,
  },
  {
    slug: 'pre-metro',
    name: 'Pre-Metro Operations',
    inRange: ['stourbridge'],
    driverOnly: true,
    fetch: fetchPreMetro,
  },
  {
    slug: 'gbrf',
    name: 'GB Railfreight',
    inRange: [...FREIGHT, 'northampton'],
    fetch: fetchGbrf,
    driverTitles: /\btrain manager\b/i, // GBRf's name for a train driver
  },
  {
    slug: 'db-cargo',
    name: 'DB Cargo UK',
    inRange: [...FREIGHT, 'toton'],
    fetch: fetchDbCargo,
  },
  {
    slug: 'freightliner',
    name: 'Freightliner',
    inRange: FREIGHT,
    fetch: freightliner.fetch,
    enrich: freightliner.enrich,
  },
  {
    slug: 'heavy-haul',
    name: 'Heavy Haul Rail',
    inRange: FREIGHT,
    fetch: fetchHeavyHaul,
    enrich: enrichHeavyHaul,
  },
  {
    slug: 'drs',
    name: 'Direct Rail Services',
    inRange: FREIGHT,
    fetch: fetchDrs,
  },
  {
    slug: 'colas',
    name: 'Colas Rail',
    inRange: [...FREIGHT, 'derby'],
    fetch: fetchColas,
    pollEveryMinutes: 60,
  },
];
