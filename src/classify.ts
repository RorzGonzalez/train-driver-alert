// Title classification is biased toward recall: we only drop a vacancy when
// its title clearly names a different job. Anything else goes on to the
// advert-body check in run.ts.

const DRIVER_WORDS =
  /\bdrivers?\b|\bdriving\b|\btrain\s?crew\b|\btrain\s+operat(?:or|ive)s?\b|\blocomotive\b|\bloco\b/;

// "driver" but not a train: bus, lorry, forklift, yard shunter and so on.
const NON_RAIL_DRIVER =
  /\b(?:bus|coach|hgv|lgv|lorry|truck|van|delivery|deliveries|forklift|fork-lift|flt|plant|shunt\w*|taxi|minibus|pcv|class\s?[12])\b/;

// A driver or frontline word in the title, but the job is managing, training
// or rostering the people who do it.
const SUPPORT_ROLE =
  /\b(?:manager|management|head\s+of|director|standards|resourc\w*|roster\w*|instructor|assessor|trainer|planner|planning|analyst|co-?ordinator|administrator|administration|supervisor|team\s+leader|recruit\w*)\b/;

// Frontline: entry-level rail work on the train, the platform, the gateline or
// in the yard. "Train manager" is the guard at the passenger operators; GB
// Railfreight, where it means the driver, has a title override in companies.ts.
const FRONTLINE_WORDS =
  /\b(?:conductors?|guards?|train\s+managers?|(?:customer|passenger|service|onboard|on-board|train)\s+hosts?|hostess|gateline|platforms?|dispatch\w*|revenue|ticket\s+(?:examiner|inspector|office)|customer\s+service\s+(?:inspector|assistant|officer)|customer\s+assistant|travel\s+advis[eo]r|station\s+(?:assistant|attendant|staff|team|operative|colleague)|train\s+presentation|presentation|cleaners?|cleaning|cet|shunters?|shunting|ground\s?staff|rail\s+operat(?:or|ive)s?|train\s?persons?|operatives?|cargo\s+handlers?|onboard|on-board|stewards?)\b/;

const APPRENTICE = /\bapprentice(?:ship)?s?\b/;

// Desk jobs that borrow a frontline word ("Platform Software Engineer",
// "Revenue Systems Analyst") and desk apprenticeships.
const DESK_WORDS =
  /\b(?:finance|financial|accounting|accounts|payroll|hr|human\s+resources|people|marketing|communications|legal|it|software|digital|data|business|admin\w*|procurement|project|commercial|systems?|strategy|cyber)\b/;

// Skilled trades: hands-on, but not entry level unless it is an apprenticeship.
const TRADE_WORDS = /\b(?:engineer\w*|technician|fitter|electrician|mechanic\w*|maintainer|welder)\b/;

// Titles with no driver or frontline word that clearly name another job.
const OTHER_ROLE =
  /\b(?:engineer\w*|technician|fitter|electrician|mechanic\w*|maintainer|customer|retail|catering|hospitality|barista|chef|kitchen|finance|financial|accountant|accounts|payroll|hr|human\s+resources|people|marketing|communications|legal|counsel|solicitor|it|software|developer|data|analyst|station|signaller|controller|control|administrator|administration|assistant|officer|advisor|adviser|executive|manager|management|co-?ordinator|specialist|lead|head\s+of|director|graduate|intern|internship|placement|project|programme|program|safety|security|procurement|buyer|supply|logistics|warehouse|yard|caterer|sales|commercial|strategy|compliance|audit|auditor|insurance|claims|property|estates|facilities|fleet|rolling\s+stock|performance|timetable|scheduler|rostering|resourcing|recruiter|recruitment|trainer|instructor|assessor|designer|architect|surveyor|inspector|welder|labourer|driver\s+manager)\b/;

export type RoleDecision =
  | { role: 'driver' }
  | { role: 'frontline' }
  | { role: 'unclassified' }
  | { role: null; reason: string };

export function classifyTitle(rawTitle: string): RoleDecision {
  const title = rawTitle.toLowerCase().replace(/\s+/g, ' ').trim();
  if (DRIVER_WORDS.test(title)) {
    if (NON_RAIL_DRIVER.test(title)) return { role: null, reason: 'non-rail driver' };
    if (SUPPORT_ROLE.test(title)) return { role: null, reason: 'driver support role' };
    return { role: 'driver' };
  }
  if (APPRENTICE.test(title)) {
    return DESK_WORDS.test(title) ? { role: null, reason: 'office apprenticeship' } : { role: 'frontline' };
  }
  if (FRONTLINE_WORDS.test(title)) {
    const rest = title.replace(/\btrain managers?\b/g, '');
    if (SUPPORT_ROLE.test(rest)) return { role: null, reason: 'frontline support role' };
    if (DESK_WORDS.test(rest) || TRADE_WORDS.test(rest)) return { role: null, reason: 'other role' };
    return { role: 'frontline' };
  }
  if (OTHER_ROLE.test(title)) return { role: null, reason: 'other role' };
  return { role: 'unclassified' };
}

export type LocationDecision = 'in-range' | 'unclear' | 'out-of-range';

const VAGUE_LOCATION =
  /\b(?:various|multiple|numerous|several|nationwide|national|network|across|region\w*|midlands|uk|england|tbc|to be confirmed|not specified|unspecified|flexible|locations)\b/;

// The title is checked too because many sites put the depot there and leave the
// location field as a region or an office.
export function classifyLocation(locationText: string | null, inRange: string[], title = ''): LocationDecision {
  const loc = (locationText ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const haystack = `${loc} ${title.toLowerCase()}`;
  if (inRange.some((place) => haystack.includes(place))) return 'in-range';
  if (!loc) return 'unclear';
  if (VAGUE_LOCATION.test(loc)) return 'unclear';
  return 'out-of-range';
}

// Used on the advert body for titles that did not settle the question.
// A train driver advert always says one of these somewhere.
const DRIVER_BODY =
  /\b(?:train|trainee|locomotive|loco|freight|passenger)\s+driv(?:er|ers|ing)\b|\bdriver\s+training\b|\bdriving\s+(?:trains|duties|a train|locomotives)\b|\bdriving\s+cab\b|\btrain\s?crew\b|\btrain\s+operat(?:or|ive)s?\b/i;

export function bodyMentionsDriving(bodyText: string): boolean {
  return DRIVER_BODY.test(bodyText);
}
