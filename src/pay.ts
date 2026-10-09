/** First sterling amount in free text, with any range and unit that follow it:
 *  "£15.91 - £18.26 ph", "£35,000 and £42,000 pa", "£29,245.85". */
const PAY =
  /£\s?\d+(?:,\d{3})*(?:\.\d\d?)?(?:\s?(?:-|–|to|and)\s?£?\s?\d+(?:,\d{3})*(?:\.\d\d?)?)?(?:\s?(?:per\s+hour|an\s+hour|p\/hr?|ph|\/hr|per\s+annum|pa|per\s+year))?(?![\w.]\w)/i;

export function extractPay(text: string): string | null {
  const m = text.match(PAY);
  return m ? m[0].replace(/\s+/g, ' ').trim() : null;
}

/** Stated pay a factory role must reach to be sent. Unstated pay is not judged. */
export const FACTORY_PAY_FLOOR = { perHour: 15, perYear: 28_000 };

/** True when the first figure in the pay text is under the floor: hourly below
 *  perHour, or annual (weekly and monthly figures scaled up) below perYear. */
export function belowPayFloor(salary: string | null | undefined, floor = FACTORY_PAY_FLOOR): boolean {
  const m = salary?.match(/£\s?(\d+(?:,\d{3})*(?:\.\d+)?)/);
  if (!m) return false;
  const amount = Number(m[1].replace(/,/g, ''));
  if (amount < 100) return amount < floor.perHour;
  const perYear = /\bweek/i.test(salary!) ? amount * 52 : /\bmonth/i.test(salary!) ? amount * 12 : amount;
  return perYear < floor.perYear;
}
