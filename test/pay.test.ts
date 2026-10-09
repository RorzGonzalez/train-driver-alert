import { expect, it } from 'vitest';
import { belowPayFloor, extractPay } from '../src/pay.js';

it.each([
  ['EXCELLENT SALARY PACKAGE £47,929 inclusive of shift allowance plus annual bonus', '£47,929'],
  ['An annual salary of £32,834.51 (inclusive of night shift allowance)', '£32,834.51'],
  ['Pay Rate: £29,245.85. Grade: P. Contract Type: Permanent', '£29,245.85'],
  ['Annual salary: £38,951.30 (including a 23.5% shift premium)', '£38,951.30'],
  ['Hourly rate: between £15.91 - £18.26 ph DOE', '£15.91 - £18.26 ph'],
  ['Salary: between £35,000 and £42,000 pa DOE', '£35,000 and £42,000 pa'],
  ['Hourly rate: £8.66 (£16,741 per year)', '£8.66'],
  ['Earn £14.14 per hour, Monday to Friday', '£14.14 per hour'],
  ['The rate is £1500 a month', '£1500'],
  ['Competitive salary and benefits', null],
])('"%s" -> %s', (text, pay) => {
  expect(extractPay(text)).toBe(pay);
});

it.each([
  ['£12.71', true],
  ['£13.48', true],
  ['£8.66', true],
  ['£14.14 per hour', true],
  ['£15.73', false],
  ['£16 per hour', false],
  ['£15.91 - £18.26 ph', false],
  ['£25,572.84', true],
  ['£26,806.00', true],
  ['£28,711.09 per annum', false],
  ['£29,245.85', false],
  ['£31,153.49 and £5,053.76', false],
  ['£600 per week', false],
  ['£500 per week', true],
  ['£1,500 a month', true],
  ['Competitive', false],
  [null, false],
])('belowPayFloor(%s) is %s', (salary, below) => {
  expect(belowPayFloor(salary)).toBe(below);
});
