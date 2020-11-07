/* global after, before, describe, expect, helper, it */

let moment;

describe('ep_comments_page - Time Formatting', function() {
  for (const [lang, description] of
       Object.entries({'en': 'English', 'af': 'a language not localized yet'})) {
    describe('in ' + description, function() {
      before(async function() {
        this.timeout(60000);
        await loadMoment();
        await changeLanguageTo(lang);
      });

      // ensure we go back to English to avoid breaking other tests:
      after(async function() {
        await changeLanguageTo('en');
      });

      it('returns "12 seconds ago" when time is 12 seconds in the past', function() {
        expect(moment(secondsInThePast(12)).fromNow()).to.be('12 seconds ago');
      });

      it('returns "in 12 seconds" when time is 12 seconds in the future', function() {
        expect(moment(secondsInTheFuture(12)).fromNow()).to.be('in 12 seconds');
      });

      it('returns "a minute ago" when time is 75 seconds in the past', function() {
        expect(moment(secondsInThePast(75)).fromNow()).to.be('a minute ago');
      });

      it('returns "in a minute" when time is 75 seconds in the future', function() {
        expect(moment(secondsInTheFuture(75)).fromNow()).to.be('in a minute');
      });

      it('returns "17 minutes ago" when time is some seconds before 17 minutes in the past', function() {
        expect(moment(secondsInThePast(minutes(17) + 2)).fromNow()).to.be('17 minutes ago');
      });

      it('returns "in 17 minutes" when time is some seconds after 17 minutes in the future', function() {
        expect(moment(secondsInTheFuture(minutes(17) + 2)).fromNow()).to.be('in 17 minutes');
      });

      it('returns "an hour ago" when time is some seconds before 1 hour in the past', function() {
        expect(moment(secondsInThePast(hours(1) + 3)).fromNow()).to.be('an hour ago');
      });

      it('returns "in an hour" when time is some seconds after 1 hour in the future', function() {
        expect(moment(secondsInTheFuture(hours(1) + 3)).fromNow()).to.be('in an hour');
      });

      it('returns "2 hours ago" when time is some seconds before 2 hours in the past', function() {
        expect(moment(secondsInThePast(hours(2) + 4)).fromNow()).to.be('2 hours ago');
      });

      it('returns "in 2 hours" when time is some seconds after 2 hours in the future', function() {
        expect(moment(secondsInTheFuture(hours(2) + 4)).fromNow()).to.be('in 2 hours');
      });

      it('returns "a day ago" when time is some seconds before 24 hours in the past', function() {
        expect(moment(secondsInThePast(hours(24) + 5)).fromNow()).to.be('a day ago');
      });

      it('returns "in a day" when time is some seconds after 24 hours in the future', function() {
        expect(moment(secondsInTheFuture(hours(24) + 5)).fromNow()).to.be('in a day');
      });

      it('returns "6 days ago" when time is some seconds before 6 days in the past', function() {
        expect(moment(secondsInThePast(days(6) + 6)).fromNow()).to.be('6 days ago');
      });

      it('returns "in 6 days" when time is some seconds after 6 days in the future', function() {
        expect(moment(secondsInTheFuture(days(6) + 6)).fromNow()).to.be('in 6 days');
      });

      it('returns "7 days ago" when time is some seconds before 7 days in the past', function() {
        expect(moment(secondsInThePast(days(7) + 7)).fromNow()).to.be('7 days ago');
      });

      it('returns "in 7 days" when time is some seconds after 7 days in the future', function() {
        expect(moment(secondsInTheFuture(days(7) + 7)).fromNow()).to.be('in 7 days');
      });

      it('returns "14 days ago" when time is some seconds before 2 weeks in the past', function() {
        expect(moment(secondsInThePast(weeks(2) + 8)).fromNow()).to.be('14 days ago');
      });

      it('returns "in 14 days" when time is some seconds after 2 weeks in the future', function() {
        expect(moment(secondsInTheFuture(weeks(2) + 8)).fromNow()).to.be('in 14 days');
      });

      it('returns "a month ago" when time is some seconds before 4 weeks in the past', function() {
        expect(moment(secondsInThePast(weeks(4) + 9)).fromNow()).to.be('a month ago');
      });

      it('returns "in a month" when time is some seconds after 4 weeks in the future', function() {
        expect(moment(secondsInTheFuture(weeks(4) + 9)).fromNow()).to.be('in a month');
      });

      it('returns "8 months ago" when time is some seconds before 9 months in the past', function() {
        expect(moment(secondsInThePast(months(9) + 10)).fromNow()).to.be('8 months ago');
      });

      it('returns "in 8 months" when time is some seconds after 9 months in the future', function() {
        expect(moment(secondsInTheFuture(months(9) + 10)).fromNow()).to.be('in 8 months');
      });

      it('returns "a year ago" when time is some seconds before 12 months in the past', function() {
        expect(moment(secondsInThePast(months(12) + 11)).fromNow()).to.be('a year ago');
      });

      it('returns "in a year" when time is some seconds after 12 months in the future', function() {
        expect(moment(secondsInTheFuture(months(12) + 11)).fromNow()).to.be('in a year');
      });

      it('returns "14 years ago" when time is some seconds before 15 years in the past', function() {
        expect(moment(secondsInThePast(years(15) + 12)).fromNow()).to.be('14 years ago');
      });

      it('returns " in 14 years" when time is some seconds after 15 years in the future', function() {
        expect(moment(secondsInTheFuture(years(15) + 12)).fromNow()).to.be('in 14 years');
      });
    });
  }

  describe('in Portuguese', function() {
    before(async function() {
      this.timeout(60000);
      await loadMoment();
      await changeLanguageTo('pt-br');
      moment.locale('pt-br');
    });

    it('returns "há 12 segundos" when time is 12 seconds in the past', function() {
      expect(moment(secondsInThePast(12)).fromNow()).to.be('há 12 segundos');
    });

    it('returns "em 12 segundos" when time is 12 seconds in the future', function() {
      expect(moment(secondsInTheFuture(12)).fromNow()).to.be('em 12 segundos');
    });

    it('returns "há um minuto" when time is 75 seconds in the past', function() {
      expect(moment(secondsInThePast(75)).fromNow()).to.be('há um minuto');
    });

    it('returns "em um minuto" when time is 75 seconds in the future', function() {
      expect(moment(secondsInTheFuture(75)).fromNow()).to.be('em um minuto');
    });

    it('returns "há 17 minutos" when time is some seconds before 17 minutes in the past', function() {
      expect(moment(secondsInThePast(minutes(17) + 2)).fromNow()).to.be('há 17 minutos');
    });

    it('returns "em 17 minutos" when time is some seconds after 17 minutes in the future', function() {
      expect(moment(secondsInTheFuture(minutes(17) + 2)).fromNow()).to.be('em 17 minutos');
    });

    it('returns "há uma hora" when time is some seconds before 1 hour in the past', function() {
      expect(moment(secondsInThePast(hours(1) + 3)).fromNow()).to.be('há uma hora');
    });

    it('returns "em uma hora" when time is some seconds after 1 hour in the future', function() {
      expect(moment(secondsInTheFuture(hours(1) + 3)).fromNow()).to.be('em uma hora');
    });

    it('returns "há 2 horas" when time is some seconds before 2 hours in the past', function() {
      expect(moment(secondsInThePast(hours(2) + 4)).fromNow()).to.be('há 2 horas');
    });

    it('returns "em 2 horas" when time is some seconds after 2 hours in the future', function() {
      expect(moment(secondsInTheFuture(hours(2) + 4)).fromNow()).to.be('em 2 horas');
    });

    it('returns "há um dia" when time is some seconds before 24 hours in the past', function() {
      expect(moment(secondsInThePast(hours(24) + 5)).fromNow()).to.be('há um dia');
    });

    it('returns "em um dia" when time is some seconds after 24 hours in the future', function() {
      expect(moment(secondsInTheFuture(hours(24) + 5)).fromNow()).to.be('em um dia');
    });

    it('returns "há 6 dias" when time is some seconds before 6 days in the past', function() {
      expect(moment(secondsInThePast(days(6) + 6)).fromNow()).to.be('há 6 dias');
    });

    it('returns "em 6 dias" when time is some seconds after 6 days in the future', function() {
      expect(moment(secondsInTheFuture(days(6) + 6)).fromNow()).to.be('em 6 dias');
    });

    it('returns "há 7 dias" when time is some seconds before 7 days in the past', function() {
      expect(moment(secondsInThePast(days(7) + 7)).fromNow()).to.be('há 7 dias');
    });

    it('returns "em 7 dias" when time is some seconds after 7 days in the future', function() {
      expect(moment(secondsInTheFuture(days(7) + 7)).fromNow()).to.be('em 7 dias');
    });

    it('returns "há 14 dias" when time is some seconds before 2 weeks in the past', function() {
      expect(moment(secondsInThePast(weeks(2) + 8)).fromNow()).to.be('há 14 dias');
    });

    it('returns "em 14 dias" when time is some seconds after 2 weeks in the future', function() {
      expect(moment(secondsInTheFuture(weeks(2) + 8)).fromNow()).to.be('em 14 dias');
    });

    it('returns "há um mês" when time is some seconds before 4 weeks in the past', function() {
      expect(moment(secondsInThePast(weeks(4) + 9)).fromNow()).to.be('há um mês');
    });

    it('returns "em um mês" when time is some seconds after 4 weeks in the future', function() {
      expect(moment(secondsInTheFuture(weeks(4) + 9)).fromNow()).to.be('em um mês');
    });

    it('returns "há 8 meses" when time is some seconds before 9 months in the past', function() {
      expect(moment(secondsInThePast(months(9) + 10)).fromNow()).to.be('há 8 meses');
    });

    it('returns "em 8 meses" when time is some seconds after 9 months in the future', function() {
      expect(moment(secondsInTheFuture(months(9) + 10)).fromNow()).to.be('em 8 meses');
    });

    it('returns "há um ano" when time is some seconds before 12 months in the past', function() {
      expect(moment(secondsInThePast(months(12) + 11)).fromNow()).to.be('há um ano');
    });

    it('returns "em um ano" when time is some seconds after 12 months in the future', function() {
      expect(moment(secondsInTheFuture(months(12) + 11)).fromNow()).to.be('em um ano');
    });

    it('returns "há 14 anos" when time is some seconds before 15 years in the past', function() {
      expect(moment(secondsInThePast(years(15) + 12)).fromNow()).to.be('há 14 anos');
    });

    it('returns "em 14 anos" when time is some seconds after 15 years in the future', function() {
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

  const loadMoment = async () => {
    await new Promise((resolve) => helper.newPad(resolve));
    const chrome$ = helper.padChrome$;
    const code = await chrome$.getScript(
        '/static/plugins/ep_comments_page/static/js/moment-with-locales.min.js');
    chrome$.window.eval(code);
    moment = chrome$.window.moment;
    moment.relativeTimeThreshold('ss', 0);
  };

  const changeLanguageTo = async (lang) => {
    const boldTitles = {
      'en': 'Bold (Ctrl+B)',
      'pt-br': 'Negrito (Ctrl-B)',
      'af': 'Vet (Ctrl-B)',
    };
    const chrome$ = helper.padChrome$;

    // click on the settings button to make settings visible
    const $settingsButton = chrome$('.buttonicon-settings');
    $settingsButton.click();

    // select the language
    const $language = chrome$('#languagemenu');
    $language.val(lang);
    $language.change();

    // hide settings again
    $settingsButton.click();

    await helper.waitForPromise(
        () => chrome$('.buttonicon-bold').parent()[0]['title'] == boldTitles[lang]);
  };
});
