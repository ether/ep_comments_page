import {expect, test} from '@playwright/test';
import {aNewCommentsPad, changeLanguageTo} from '../helper/comments';

// Time helpers (mirror legacy).
const minutes = (n: number) => 60 * n;
const hours = (n: number) => 60 * minutes(n);
const days = (n: number) => 24 * hours(n);
const weeks = (n: number) => 7 * days(n);
const months = (n: number) => 4 * weeks(n);
const years = (n: number) => 12 * months(n);

// Evaluate `moment(<offsetMs from now>).fromNow()` inside the chrome window.
// We initialise moment lazily on first call and set its 'ss' threshold to 0
// to match the legacy spec's `moment.relativeTimeThreshold('ss', 0)`.
//
// The plugin attaches its CommonJS-required moment instance to
// window.__epcpMoment for tests (see static/js/index.js). The legacy spec
// called `window.require(...)` directly, but the Playwright bundle no
// longer exposes `require` on the chrome window, so we read the
// plugin-published handle instead — sharing one instance keeps locale
// changes from changeLanguageTo() observable in the tests.
const initMoment = async (page: import('@playwright/test').Page) => {
  await expect.poll(async () =>
    page.evaluate(() => Boolean((window as any).__epcpMoment)),
  {timeout: 10_000}).toBe(true);
  await page.evaluate(() => {
    (window as any).__epcpMoment.relativeTimeThreshold('ss', 0);
  });
};

const fromNow = async (
  page: import('@playwright/test').Page, secondsOffset: number,
): Promise<string> => {
  return await page.evaluate((sec) => {
    const w = window as any;
    return w.__epcpMoment(Date.now() + sec * 1000).fromNow();
  }, secondsOffset);
};

const waitMomentLocale = async (
  page: import('@playwright/test').Page, expected: string,
) => {
  await expect.poll(async () => page.evaluate(() => (window as any).__epcpMoment.locale()))
      .toBe(expected);
};

const switchLang = async (page: import('@playwright/test').Page, lang: string) => {
  // First switch to a supported non-en language so we can detect when change took effect.
  await changeLanguageTo(page, 'pt-br');
  await waitMomentLocale(page, 'pt-br');
  await changeLanguageTo(page, lang);
  await waitMomentLocale(page, lang === 'qqq' ? 'en' : lang);
};

test.describe('ep_comments_page - Time format', () => {
  test.beforeAll(async () => {
    test.setTimeout(60_000);
  });

  for (const [lang, description] of Object.entries({
    en: 'English',
    qqq: 'a language that moment.js does not support',
  })) {
    test.describe(`in ${description}`, () => {
      test.beforeEach(async ({page}) => {
        test.setTimeout(60_000);
        await aNewCommentsPad(page);
        await initMoment(page);
        await switchLang(page, lang);
      });

      test.afterEach(async ({page}) => {
        // Restore English to avoid breaking other tests.
        await changeLanguageTo(page, 'en');
      });

      test('returns "12 seconds ago" when time is 12 seconds in the past', async ({page}) => {
        expect(await fromNow(page, -12)).toBe('12 seconds ago');
      });
      test('returns "in 12 seconds" when time is 12 seconds in the future', async ({page}) => {
        expect(await fromNow(page, 12)).toBe('in 12 seconds');
      });
      test('returns "a minute ago" when time is 75 seconds in the past', async ({page}) => {
        expect(await fromNow(page, -75)).toBe('a minute ago');
      });
      test('returns "in a minute" when time is 75 seconds in the future', async ({page}) => {
        expect(await fromNow(page, 75)).toBe('in a minute');
      });
      test('returns "17 minutes ago" when time is 17+ε minutes in the past', async ({page}) => {
        expect(await fromNow(page, -(minutes(17) + 2))).toBe('17 minutes ago');
      });
      test('returns "in 17 minutes" when time is 17+ε minutes in the future', async ({page}) => {
        expect(await fromNow(page, minutes(17) + 2)).toBe('in 17 minutes');
      });
      test('returns "an hour ago" when time is 1+ε hour in the past', async ({page}) => {
        expect(await fromNow(page, -(hours(1) + 3))).toBe('an hour ago');
      });
      test('returns "in an hour" when time is 1+ε hour in the future', async ({page}) => {
        expect(await fromNow(page, hours(1) + 3)).toBe('in an hour');
      });
      test('returns "2 hours ago" when time is 2+ε hours in the past', async ({page}) => {
        expect(await fromNow(page, -(hours(2) + 4))).toBe('2 hours ago');
      });
      test('returns "in 2 hours" when time is 2+ε hours in the future', async ({page}) => {
        expect(await fromNow(page, hours(2) + 4)).toBe('in 2 hours');
      });
      test('returns "a day ago" when time is 24+ε hours in the past', async ({page}) => {
        expect(await fromNow(page, -(hours(24) + 5))).toBe('a day ago');
      });
      test('returns "in a day" when time is 24+ε hours in the future', async ({page}) => {
        expect(await fromNow(page, hours(24) + 5)).toBe('in a day');
      });
      test('returns "6 days ago" when time is 6+ε days in the past', async ({page}) => {
        expect(await fromNow(page, -(days(6) + 6))).toBe('6 days ago');
      });
      test('returns "in 6 days" when time is 6+ε days in the future', async ({page}) => {
        expect(await fromNow(page, days(6) + 6)).toBe('in 6 days');
      });
      test('returns "7 days ago" when time is 7+ε days in the past', async ({page}) => {
        expect(await fromNow(page, -(days(7) + 7))).toBe('7 days ago');
      });
      test('returns "in 7 days" when time is 7+ε days in the future', async ({page}) => {
        expect(await fromNow(page, days(7) + 7)).toBe('in 7 days');
      });
      test('returns "14 days ago" when time is 2+ε weeks in the past', async ({page}) => {
        expect(await fromNow(page, -(weeks(2) + 8))).toBe('14 days ago');
      });
      test('returns "in 14 days" when time is 2+ε weeks in the future', async ({page}) => {
        expect(await fromNow(page, weeks(2) + 8)).toBe('in 14 days');
      });
      test('returns "a month ago" when time is 4+ε weeks in the past', async ({page}) => {
        expect(await fromNow(page, -(weeks(4) + 9))).toBe('a month ago');
      });
      test('returns "in a month" when time is 4+ε weeks in the future', async ({page}) => {
        expect(await fromNow(page, weeks(4) + 9)).toBe('in a month');
      });
      test('returns "8 months ago" when time is 9+ε months in the past', async ({page}) => {
        expect(await fromNow(page, -(months(9) + 10))).toBe('8 months ago');
      });
      test('returns "in 8 months" when time is 9+ε months in the future', async ({page}) => {
        expect(await fromNow(page, months(9) + 10)).toBe('in 8 months');
      });
      test('returns "a year ago" when time is 12+ε months in the past', async ({page}) => {
        expect(await fromNow(page, -(months(12) + 11))).toBe('a year ago');
      });
      test('returns "in a year" when time is 12+ε months in the future', async ({page}) => {
        expect(await fromNow(page, months(12) + 11)).toBe('in a year');
      });
      test('returns "14 years ago" when time is 15+ε years in the past', async ({page}) => {
        expect(await fromNow(page, -(years(15) + 12))).toBe('14 years ago');
      });
      test('returns " in 14 years" when time is 15+ε years in the future', async ({page}) => {
        expect(await fromNow(page, years(15) + 12)).toBe('in 14 years');
      });
    });
  }

  test.describe('in Portuguese', () => {
    test.beforeEach(async ({page}) => {
      test.setTimeout(60_000);
      await aNewCommentsPad(page);
      await initMoment(page);
      await changeLanguageTo(page, 'pt-br');
      await waitMomentLocale(page, 'pt-br');
    });

    test.afterEach(async ({page}) => {
      await changeLanguageTo(page, 'en');
    });

    test('returns "há 12 segundos" when time is 12 seconds in the past', async ({page}) => {
      expect(await fromNow(page, -12)).toBe('há 12 segundos');
    });
    test('returns "em 12 segundos" when time is 12 seconds in the future', async ({page}) => {
      expect(await fromNow(page, 12)).toBe('em 12 segundos');
    });
    test('returns "há um minuto" when time is 75 seconds in the past', async ({page}) => {
      expect(await fromNow(page, -75)).toBe('há um minuto');
    });
    test('returns "em um minuto" when time is 75 seconds in the future', async ({page}) => {
      expect(await fromNow(page, 75)).toBe('em um minuto');
    });
    test('returns "há 17 minutos" when time is 17+ε minutes in the past', async ({page}) => {
      expect(await fromNow(page, -(minutes(17) + 2))).toBe('há 17 minutos');
    });
    test('returns "em 17 minutos" when time is 17+ε minutes in the future', async ({page}) => {
      expect(await fromNow(page, minutes(17) + 2)).toBe('em 17 minutos');
    });
    test('returns "há uma hora" when time is 1+ε hour in the past', async ({page}) => {
      expect(await fromNow(page, -(hours(1) + 3))).toBe('há uma hora');
    });
    test('returns "em uma hora" when time is 1+ε hour in the future', async ({page}) => {
      expect(await fromNow(page, hours(1) + 3)).toBe('em uma hora');
    });
    test('returns "há 2 horas" when time is 2+ε hours in the past', async ({page}) => {
      expect(await fromNow(page, -(hours(2) + 4))).toBe('há 2 horas');
    });
    test('returns "em 2 horas" when time is 2+ε hours in the future', async ({page}) => {
      expect(await fromNow(page, hours(2) + 4)).toBe('em 2 horas');
    });
    test('returns "há um dia" when time is 24+ε hours in the past', async ({page}) => {
      expect(await fromNow(page, -(hours(24) + 5))).toBe('há um dia');
    });
    test('returns "em um dia" when time is 24+ε hours in the future', async ({page}) => {
      expect(await fromNow(page, hours(24) + 5)).toBe('em um dia');
    });
    test('returns "há 6 dias" when time is 6+ε days in the past', async ({page}) => {
      expect(await fromNow(page, -(days(6) + 6))).toBe('há 6 dias');
    });
    test('returns "em 6 dias" when time is 6+ε days in the future', async ({page}) => {
      expect(await fromNow(page, days(6) + 6)).toBe('em 6 dias');
    });
    test('returns "há 7 dias" when time is 7+ε days in the past', async ({page}) => {
      expect(await fromNow(page, -(days(7) + 7))).toBe('há 7 dias');
    });
    test('returns "em 7 dias" when time is 7+ε days in the future', async ({page}) => {
      expect(await fromNow(page, days(7) + 7)).toBe('em 7 dias');
    });
    test('returns "há 14 dias" when time is 2+ε weeks in the past', async ({page}) => {
      expect(await fromNow(page, -(weeks(2) + 8))).toBe('há 14 dias');
    });
    test('returns "em 14 dias" when time is 2+ε weeks in the future', async ({page}) => {
      expect(await fromNow(page, weeks(2) + 8)).toBe('em 14 dias');
    });
    test('returns "há um mês" when time is 4+ε weeks in the past', async ({page}) => {
      expect(await fromNow(page, -(weeks(4) + 9))).toBe('há um mês');
    });
    test('returns "em um mês" when time is 4+ε weeks in the future', async ({page}) => {
      expect(await fromNow(page, weeks(4) + 9)).toBe('em um mês');
    });
    test('returns "há 8 meses" when time is 9+ε months in the past', async ({page}) => {
      expect(await fromNow(page, -(months(9) + 10))).toBe('há 8 meses');
    });
    test('returns "em 8 meses" when time is 9+ε months in the future', async ({page}) => {
      expect(await fromNow(page, months(9) + 10)).toBe('em 8 meses');
    });
    test('returns "há um ano" when time is 12+ε months in the past', async ({page}) => {
      expect(await fromNow(page, -(months(12) + 11))).toBe('há um ano');
    });
    test('returns "em um ano" when time is 12+ε months in the future', async ({page}) => {
      expect(await fromNow(page, months(12) + 11)).toBe('em um ano');
    });
    test('returns "há 14 anos" when time is 15+ε years in the past', async ({page}) => {
      expect(await fromNow(page, -(years(15) + 12))).toBe('há 14 anos');
    });
    test('returns "em 14 anos" when time is 15+ε years in the future', async ({page}) => {
      expect(await fromNow(page, years(15) + 12)).toBe('em 14 anos');
    });
  });
});
