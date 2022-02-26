'use strict';

const utils = require('../utils');

let moment;
let originalLanguage = null;

before(async function () {
  this.timeout(60000);
  await utils.aNewPad();
  moment = helper.padChrome$.window.require('ep_comments_page/static/js/moment-with-locales.min');
  moment.relativeTimeThreshold('ss', 0);
});

after(async function () {
  // Restore the language to avoid breaking other tests.
  if (originalLanguage != null) await changeLanguageTo(originalLanguage);
});

for (const [lang, description] of Object.entries({
  en: 'English',
  // See https://translatewiki.net/wiki/FAQ#Special_private_language_codes_qqq,_qqx.
  qqq: 'a language that moment.js does not support',
})) {
  describe(`in ${description}`, function () {
    before(async function () {
      // First switch to a supported language that is not 'en' so that we know when the language
      // change has taken effect. (This is important because using an unsupported language will
      // cause moment.js to fall back to 'en'.)
      await changeLanguageTo('pt-br');
      await changeLanguageTo(lang);
    });

    it('returns "12 seconds ago" when time is 12 seconds in the past', async function () {
      expect(moment(secondsInThePast(12)).fromNow()).to.be('12 seconds ago');
    });

    it('returns "in 12 seconds" when time is 12 seconds in the future', async function () {
      expect(moment(secondsInTheFuture(12)).fromNow()).to.be('in 12 seconds');
    });

    it('returns "a minute ago" when time is 75 seconds in the past', async function () {
      expect(moment(secondsInThePast(75)).fromNow()).to.be('a minute ago');
    });

    it('returns "in a minute" when time is 75 seconds in the future', async function () {
      expect(moment(secondsInTheFuture(75)).fromNow()).to.be('in a minute');
    });

    it('returns "17 minutes ago" when time is 17+ε minutes in the past', async function () {
      expect(moment(secondsInThePast(minutes(17) + 2)).fromNow()).to.be('17 minutes ago');
    });

    it('returns "in 17 minutes" when time is 17+ε minutes in the future', async function () {
      expect(moment(secondsInTheFuture(minutes(17) + 2)).fromNow()).to.be('in 17 minutes');
    });

    it('returns "an hour ago" when time is 1+ε hour in the past', async function () {
      expect(moment(secondsInThePast(hours(1) + 3)).fromNow()).to.be('an hour ago');
    });

    it('returns "in an hour" when time is 1+ε hour in the future', async function () {
      expect(moment(secondsInTheFuture(hours(1) + 3)).fromNow()).to.be('in an hour');
    });

    it('returns "2 hours ago" when time is 2+ε hours in the past', async function () {
      expect(moment(secondsInThePast(hours(2) + 4)).fromNow()).to.be('2 hours ago');
    });

    it('returns "in 2 hours" when time is 2+ε hours in the future', async function () {
      expect(moment(secondsInTheFuture(hours(2) + 4)).fromNow()).to.be('in 2 hours');
    });

    it('returns "a day ago" when time is 24+ε hours in the past', async function () {
      expect(moment(secondsInThePast(hours(24) + 5)).fromNow()).to.be('a day ago');
    });

    it('returns "in a day" when time is 24+ε hours in the future', async function () {
      expect(moment(secondsInTheFuture(hours(24) + 5)).fromNow()).to.be('in a day');
    });

    it('returns "6 days ago" when time is 6+ε days in the past', async function () {
      expect(moment(secondsInThePast(days(6) + 6)).fromNow()).to.be('6 days ago');
    });

    it('returns "in 6 days" when time is 6+ε days in the future', async function () {
      expect(moment(secondsInTheFuture(days(6) + 6)).fromNow()).to.be('in 6 days');
    });

    it('returns "7 days ago" when time is 7+ε days in the past', async function () {
      expect(moment(secondsInThePast(days(7) + 7)).fromNow()).to.be('7 days ago');
    });

    it('returns "in 7 days" when time is 7+ε days in the future', async function () {
      expect(moment(secondsInTheFuture(days(7) + 7)).fromNow()).to.be('in 7 days');
    });

    it('returns "14 days ago" when time is 2+ε weeks in the past', async function () {
      expect(moment(secondsInThePast(weeks(2) + 8)).fromNow()).to.be('14 days ago');
    });

    it('returns "in 14 days" when time is 2+ε weeks in the future', async function () {
      expect(moment(secondsInTheFuture(weeks(2) + 8)).fromNow()).to.be('in 14 days');
    });

    it('returns "a month ago" when time is 4+ε weeks in the past', async function () {
      expect(moment(secondsInThePast(weeks(4) + 9)).fromNow()).to.be('a month ago');
    });

    it('returns "in a month" when time is 4+ε weeks in the future', async function () {
      expect(moment(secondsInTheFuture(weeks(4) + 9)).fromNow()).to.be('in a month');
    });

    it('returns "8 months ago" when time is 9+ε months in the past', async function () {
      expect(moment(secondsInThePast(months(9) + 10)).fromNow()).to.be('8 months ago');
    });

    it('returns "in 8 months" when time is 9+ε months in the future', async function () {
      expect(moment(secondsInTheFuture(months(9) + 10)).fromNow()).to.be('in 8 months');
    });

    it('returns "a year ago" when time is 12+ε months in the past', async function () {
      expect(moment(secondsInThePast(months(12) + 11)).fromNow()).to.be('a year ago');
    });

    it('returns "in a year" when time is 12+ε months in the future', async function () {
      expect(moment(secondsInTheFuture(months(12) + 11)).fromNow()).to.be('in a year');
    });

    it('returns "14 years ago" when time is 15+ε years in the past', async function () {
      expect(moment(secondsInThePast(years(15) + 12)).fromNow()).to.be('14 years ago');
    });

    it('returns " in 14 years" when time is 15+ε years in the future', async function () {
      expect(moment(secondsInTheFuture(years(15) + 12)).fromNow()).to.be('in 14 years');
    });
  });
}

describe('in Portuguese', function () {
  before(async function () {
    await changeLanguageTo('pt-br');
  });

  it('returns "há 12 segundos" when time is 12 seconds in the past', async function () {
    expect(moment(secondsInThePast(12)).fromNow()).to.be('há 12 segundos');
  });

  it('returns "em 12 segundos" when time is 12 seconds in the future', async function () {
    expect(moment(secondsInTheFuture(12)).fromNow()).to.be('em 12 segundos');
  });

  it('returns "há um minuto" when time is 75 seconds in the past', async function () {
    expect(moment(secondsInThePast(75)).fromNow()).to.be('há um minuto');
  });

  it('returns "em um minuto" when time is 75 seconds in the future', async function () {
    expect(moment(secondsInTheFuture(75)).fromNow()).to.be('em um minuto');
  });

  it('returns "há 17 minutos" when time is 17+ε minutes in the past', async function () {
    expect(moment(secondsInThePast(minutes(17) + 2)).fromNow()).to.be('há 17 minutos');
  });

  it('returns "em 17 minutos" when time is 17+ε minutes in the future', async function () {
    expect(moment(secondsInTheFuture(minutes(17) + 2)).fromNow()).to.be('em 17 minutos');
  });

  it('returns "há uma hora" when time is 1+ε hour in the past', async function () {
    expect(moment(secondsInThePast(hours(1) + 3)).fromNow()).to.be('há uma hora');
  });

  it('returns "em uma hora" when time is 1+ε hour in the future', async function () {
    expect(moment(secondsInTheFuture(hours(1) + 3)).fromNow()).to.be('em uma hora');
  });

  it('returns "há 2 horas" when time is 2+ε hours in the past', async function () {
    expect(moment(secondsInThePast(hours(2) + 4)).fromNow()).to.be('há 2 horas');
  });

  it('returns "em 2 horas" when time is 2+ε hours in the future', async function () {
    expect(moment(secondsInTheFuture(hours(2) + 4)).fromNow()).to.be('em 2 horas');
  });

  it('returns "há um dia" when time is 24+ε hours in the past', async function () {
    expect(moment(secondsInThePast(hours(24) + 5)).fromNow()).to.be('há um dia');
  });

  it('returns "em um dia" when time is 24+ε hours in the future', async function () {
    expect(moment(secondsInTheFuture(hours(24) + 5)).fromNow()).to.be('em um dia');
  });

  it('returns "há 6 dias" when time is 6+ε days in the past', async function () {
    expect(moment(secondsInThePast(days(6) + 6)).fromNow()).to.be('há 6 dias');
  });

  it('returns "em 6 dias" when time is 6+ε days in the future', async function () {
    expect(moment(secondsInTheFuture(days(6) + 6)).fromNow()).to.be('em 6 dias');
  });

  it('returns "há 7 dias" when time is 7+ε days in the past', async function () {
    expect(moment(secondsInThePast(days(7) + 7)).fromNow()).to.be('há 7 dias');
  });

  it('returns "em 7 dias" when time is 7+ε days in the future', async function () {
    expect(moment(secondsInTheFuture(days(7) + 7)).fromNow()).to.be('em 7 dias');
  });

  it('returns "há 14 dias" when time is 2+ε weeks in the past', async function () {
    expect(moment(secondsInThePast(weeks(2) + 8)).fromNow()).to.be('há 14 dias');
  });

  it('returns "em 14 dias" when time is 2+ε weeks in the future', async function () {
    expect(moment(secondsInTheFuture(weeks(2) + 8)).fromNow()).to.be('em 14 dias');
  });

  it('returns "há um mês" when time is 4+ε weeks in the past', async function () {
    expect(moment(secondsInThePast(weeks(4) + 9)).fromNow()).to.be('há um mês');
  });

  it('returns "em um mês" when time is 4+ε weeks in the future', async function () {
    expect(moment(secondsInTheFuture(weeks(4) + 9)).fromNow()).to.be('em um mês');
  });

  it('returns "há 8 meses" when time is 9+ε months in the past', async function () {
    expect(moment(secondsInThePast(months(9) + 10)).fromNow()).to.be('há 8 meses');
  });

  it('returns "em 8 meses" when time is 9+ε months in the future', async function () {
    expect(moment(secondsInTheFuture(months(9) + 10)).fromNow()).to.be('em 8 meses');
  });

  it('returns "há um ano" when time is 12+ε months in the past', async function () {
    expect(moment(secondsInThePast(months(12) + 11)).fromNow()).to.be('há um ano');
  });

  it('returns "em um ano" when time is 12+ε months in the future', async function () {
    expect(moment(secondsInTheFuture(months(12) + 11)).fromNow()).to.be('em um ano');
  });

  it('returns "há 14 anos" when time is 15+ε years in the past', async function () {
    expect(moment(secondsInThePast(years(15) + 12)).fromNow()).to.be('há 14 anos');
  });

  it('returns "em 14 anos" when time is 15+ε years in the future', async function () {
    expect(moment(secondsInTheFuture(years(15) + 12)).fromNow()).to.be('em 14 anos');
  });
});

/* ********** Helper functions ********** */

const secondsInThePast = (seconds) => Date.now() - seconds * 1000;
const secondsInTheFuture = (seconds) => Date.now() + seconds * 1000;
const minutes = (count) => 60 * count;
const hours = (count) => 60 * minutes(count);
const days = (count) => 24 * hours(count);
const weeks = (count) => 7 * days(count);
const months = (count) => 4 * weeks(count);
const years = (count) => 12 * months(count);

const changeLanguageTo = async (lang) => {
  if (originalLanguage == null) originalLanguage = helper.padChrome$.window.html10n.getLanguage();
  expect(helper.padChrome$(`#languagemenu [value=${lang}]`).length).to.be(1);
  helper.padChrome$('#languagemenu').val(lang).trigger('change');
  await helper.waitForPromise(() => moment.locale() === (lang === 'qqq' ? 'en' : lang));
};
