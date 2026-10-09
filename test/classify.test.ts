import { describe, expect, it } from 'vitest';
import { bodyMentionsDriving, classifyLocation, classifyTitle } from '../src/classify.js';

describe('classifyTitle', () => {
  it.each([
    'Trainee Train Driver',
    'Train Driver',
    'Qualified Driver - Bescot',
    'Driver (Trainee) Talent Pool',
    'Apprentice Train Driver',
    'Driver Apprentice',
    'Train Driver Apprenticeship',
    'Freight Train Driver',
    'Trainee Driver - Birmingham New Street',
    'Trainee Train Operator',
    'Traincrew Trainee',
    'Train Crew - Banbury',
    'Driver Academy 2027',
    'Locomotive Driver',
    'Rail Operations Trainee (Driving)',
  ])('"%s" is a driver role', (title) => {
    expect(classifyTitle(title)).toEqual({ role: 'driver' });
  });

  it.each([
    ['Bus Driver', 'non-rail driver'],
    ['HGV Class 1 Driver', 'non-rail driver'],
    ['Delivery Driver', 'non-rail driver'],
    ['Shunter Driver', 'non-rail driver'],
    ['Forklift Driver', 'non-rail driver'],
    ['Driver Manager', 'driver support role'],
    ['Driver Team Manager - Birmingham', 'driver support role'],
    ['Driver Standards Manager', 'driver support role'],
    ['Driver Instructor', 'driver support role'],
    ['Driver Resourcing Administrator', 'driver support role'],
    ['Head of Drivers', 'driver support role'],
  ])('"%s" is excluded as %s', (title, reason) => {
    expect(classifyTitle(title)).toEqual({ role: null, reason });
  });

  it.each([
    'Conductor',
    'Trainee Senior Conductor - Crewe',
    'Trainee Guard',
    'Train Manager',
    'Customer Service Host',
    'Passenger Host',
    'Customer Host',
    'Customer Service, Gateline and Dispatch',
    'Gateline Assistant',
    'Platform Assistant / Train Dispatcher',
    'Dispatcher',
    'Revenue Protection Officer',
    'Customer Service Inspector',
    'Customer Service Assistant',
    'Customer Service Officer - Part Time',
    'Station Assistant - Coventry',
    'Travel Advisor - Part Time',
    'Train Cleaner',
    'CET Operatives/Cleaner',
    'Train Presentation Operative',
    'Shunter',
    'Ground Staff (Crewe)',
    'Rail Operator - Peterborough (Talent Pool)',
    'Train Person',
    'Rail Mobile Operative - East Midlands',
    'Multi Skilled Operative',
    'Depot Operative',
    'Cargo Handler',
    'Onboard Catering Assistant- Euston',
    'Engineering Apprentice',
    'Operations Apprentice',
    'Rolling Stock Apprenticeship',
    'Customer Service Apprentice',
  ])('"%s" is a frontline role', (title) => {
    expect(classifyTitle(title)).toEqual({ role: 'frontline' });
  });

  it.each([
    ['Carriage Cleaner Supervisor', 'frontline support role'],
    ['Revenue Team Leader - Bedford', 'frontline support role'],
    ['Team Leader- Platforms - Stafford - Talent Bank', 'frontline support role'],
    ['Revenue Management Systems Analyst', 'frontline support role'],
    ['Conductor Manager', 'frontline support role'],
    ['Train Manager Standards Lead', 'frontline support role'],
    ['Finance Apprentice', 'office apprenticeship'],
    ['Apprentice Data Analyst', 'office apprenticeship'],
    ['Platform Software Engineer', 'other role'],
    ['Rolling Stock Engineer', 'other role'],
    ['Customer Experience Manager', 'other role'],
    ['Customer Relations Duty Manager', 'other role'],
    ['Finance Business Partner', 'other role'],
    ['IT Support Analyst', 'other role'],
    ['Senior Timetable Planner', 'other role'],
    ['Shift Operations Controller', 'other role'],
    ['Station Manager', 'other role'],
    ['Welder', 'other role'],
  ])('"%s" is excluded as %s', (title, reason) => {
    expect(classifyTitle(title)).toEqual({ role: null, reason });
  });

  it.each(['Trainee Train Operations', 'Rail Operations Trainee', 'Traction Trainee Scheme', 'Pre Metro Hosts MUR Workshop'])(
    '"%s" is unclassified and goes to the body check',
    (title) => {
      expect(classifyTitle(title)).toEqual({ role: 'unclassified' });
    },
  );
});

describe('classifyLocation', () => {
  const inRange = ['leamington', 'coventry', 'birmingham', 'new street', 'tyseley', 'wolverhampton', 'northampton'];

  it('matches an in-range depot anywhere in the text', () => {
    expect(classifyLocation('Birmingham New Street', inRange)).toBe('in-range');
    expect(classifyLocation('Tyseley Depot, B11', inRange)).toBe('in-range');
    expect(classifyLocation('London Euston, Northampton, Bletchley', inRange)).toBe('in-range');
  });

  it('treats blank or vague locations as unclear', () => {
    expect(classifyLocation(null, inRange)).toBe('unclear');
    expect(classifyLocation('   ', inRange)).toBe('unclear');
    expect(classifyLocation('Various', inRange)).toBe('unclear');
    expect(classifyLocation('West Midlands', inRange)).toBe('unclear');
    expect(classifyLocation('Multiple locations', inRange)).toBe('unclear');
    expect(classifyLocation('Nationwide', inRange)).toBe('unclear');
    expect(classifyLocation('Not Specified', inRange)).toBe('unclear');
    expect(classifyLocation('Flexible', inRange)).toBe('unclear');
  });

  it('drops a named place that is not in range', () => {
    expect(classifyLocation('Plymouth', inRange)).toBe('out-of-range');
    expect(classifyLocation('London Euston', inRange)).toBe('out-of-range');
  });
});

describe('bodyMentionsDriving', () => {
  it('spots train driving language', () => {
    expect(bodyMentionsDriving('You will be trained to become a fully qualified train driver.')).toBe(true);
    expect(bodyMentionsDriving('Our Trainee Driver programme lasts 12 months')).toBe(true);
    expect(bodyMentionsDriving('driving trains across the West Midlands network')).toBe(true);
    expect(bodyMentionsDriving('join our traincrew team')).toBe(true);
  });

  it('ignores a driving licence requirement', () => {
    expect(bodyMentionsDriving('A full UK driving licence is required for this mobile role.')).toBe(false);
    expect(bodyMentionsDriving('Working closely with drivers and guards on the platform.')).toBe(false);
  });
});
