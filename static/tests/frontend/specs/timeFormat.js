var moment;

describe("ep_comments_page - Time Formatting", function() {
  _.each({'en': 'English', 'af': 'a language not localized yet'}, function(description, lang) {
    describe("in " + description, function(){
      before(function(cb) {
        loadMoment(function() {
          changeLanguageTo(lang, cb);
        });
        this.timeout(60000);
      });

      // ensure we go back to English to avoid breaking other tests:
      after(function(cb){
        changeLanguageTo('en', cb);
      });

      it("returns '12 seconds ago' when time is 12 seconds in the past", function(done) {
        expect(moment(secondsInThePast(12)).fromNow()).to.be('12 seconds ago');
        done();
      });

      it("returns 'in 12 seconds' when time is 12 seconds in the future", function(done) {
        expect(moment(secondsInTheFuture(12)).fromNow()).to.be('in 12 seconds');
        done();
      });

      it("returns 'a minute ago' when time is 75 seconds in the past", function(done) {
        expect(moment(secondsInThePast(75)).fromNow()).to.be('a minute ago');
        done();
      });

      it("returns 'in a minute' when time is 75 seconds in the future", function(done) {
        expect(moment(secondsInTheFuture(75)).fromNow()).to.be('in a minute');
        done();
      });

      it("returns '17 minutes ago' when time is some seconds before 17 minutes in the past", function(done) {
        expect(moment(secondsInThePast(minutes(17) + 2)).fromNow()).to.be('17 minutes ago');
        done();
      });

      it("returns 'in 17 minutes' when time is some seconds after 17 minutes in the future", function(done) {
        expect(moment(secondsInTheFuture(minutes(17) + 2)).fromNow()).to.be('in 17 minutes');
        done();
      });

      it("returns 'an hour ago' when time is some seconds before 1 hour in the past", function(done) {
        expect(moment(secondsInThePast(hours(1) + 3)).fromNow()).to.be('an hour ago');
        done();
      });

      it("returns 'in an hour' when time is some seconds after 1 hour in the future", function(done) {
        expect(moment(secondsInTheFuture(hours(1) + 3)).fromNow()).to.be('in an hour');
        done();
      });

      it("returns '2 hours ago' when time is some seconds before 2 hours in the past", function(done) {
        expect(moment(secondsInThePast(hours(2) + 4)).fromNow()).to.be('2 hours ago');
        done();
      });

      it("returns 'in 2 hours' when time is some seconds after 2 hours in the future", function(done) {
        expect(moment(secondsInTheFuture(hours(2) + 4)).fromNow()).to.be('in 2 hours');
        done();
      });

      it("returns 'a day ago' when time is some seconds before 24 hours in the past", function(done) {
        expect(moment(secondsInThePast(hours(24) + 5)).fromNow()).to.be('a day ago');
        done();
      });

      it("returns 'in a day' when time is some seconds after 24 hours in the future", function(done) {
        expect(moment(secondsInTheFuture(hours(24) + 5)).fromNow()).to.be('in a day');
        done();
      });

      it("returns '6 days ago' when time is some seconds before 6 days in the past", function(done) {
        expect(moment(secondsInThePast(days(6) + 6)).fromNow()).to.be('6 days ago');
        done();
      });

      it("returns 'in 6 days' when time is some seconds after 6 days in the future", function(done) {
        expect(moment(secondsInTheFuture(days(6) + 6)).fromNow()).to.be('in 6 days');
        done();
      });

      it("returns '7 days ago' when time is some seconds before 7 days in the past", function(done) {
        expect(moment(secondsInThePast(days(7) + 7)).fromNow()).to.be('7 days ago');
        done();
      });

      it("returns 'in 7 days' when time is some seconds after 7 days in the future", function(done) {
        expect(moment(secondsInTheFuture(days(7) + 7)).fromNow()).to.be('in 7 days');
        done();
      });

      it("returns '14 days ago' when time is some seconds before 2 weeks in the past", function(done) {
        expect(moment(secondsInThePast(weeks(2) + 8)).fromNow()).to.be('14 days ago');
        done();
      });

      it("returns 'in 14 days' when time is some seconds after 2 weeks in the future", function(done) {
        expect(moment(secondsInTheFuture(weeks(2) + 8)).fromNow()).to.be('in 14 days');
        done();
      });

      it("returns 'a month ago' when time is some seconds before 4 weeks in the past", function(done) {
        expect(moment(secondsInThePast(weeks(4) + 9)).fromNow()).to.be('a month ago');
        done();
      });

      it("returns 'in a month' when time is some seconds after 4 weeks in the future", function(done) {
        expect(moment(secondsInTheFuture(weeks(4) + 9)).fromNow()).to.be('in a month');
        done();
      });

      it("returns '8 months ago' when time is some seconds before 9 months in the past", function(done) {
        expect(moment(secondsInThePast(months(9) + 10)).fromNow()).to.be('8 months ago');
        done();
      });

      it("returns 'in 8 months' when time is some seconds after 9 months in the future", function(done) {
        expect(moment(secondsInTheFuture(months(9) + 10)).fromNow()).to.be('in 8 months');
        done();
      });

      it("returns 'a year ago' when time is some seconds before 12 months in the past", function(done) {
        expect(moment(secondsInThePast(months(12) + 11)).fromNow()).to.be('a year ago');
        done();
      });

      it("returns 'in a year' when time is some seconds after 12 months in the future", function(done) {
        expect(moment(secondsInTheFuture(months(12) + 11)).fromNow()).to.be('in a year');
        done();
      });

      it("returns '14 years ago' when time is some seconds before 15 years in the past", function(done) {
        expect(moment(secondsInThePast(years(15) + 12)).fromNow()).to.be('14 years ago');
        done();
      });

      it("returns ' in 14 years' when time is some seconds after 15 years in the future", function(done) {
        expect(moment(secondsInTheFuture(years(15) + 12)).fromNow()).to.be('in 14 years');
        done();
      });
    })
  });

  describe("in Portuguese", function(){
    before(function(cb) {
      loadMoment(function() {
        changeLanguageTo('pt-br', cb);
        moment.locale('pt-br');
      });
      this.timeout(60000);
    });

    it("returns 'há 12 segundos' when time is 12 seconds in the past", function(done) {
      expect(moment(secondsInThePast(12)).fromNow()).to.be('há 12 segundos');
      done();
    });

    it("returns 'em 12 segundos' when time is 12 seconds in the future", function(done) {
      expect(moment(secondsInTheFuture(12)).fromNow()).to.be('em 12 segundos');
      done();
    });

    it("returns 'há um minuto' when time is 75 seconds in the past", function(done) {
      expect(moment(secondsInThePast(75)).fromNow()).to.be('há um minuto');
      done();
    });

    it("returns 'em um minuto' when time is 75 seconds in the future", function(done) {
      expect(moment(secondsInTheFuture(75)).fromNow()).to.be('em um minuto');
      done();
    });

    it("returns 'há 17 minutos' when time is some seconds before 17 minutes in the past", function(done) {
      expect(moment(secondsInThePast(minutes(17) + 2)).fromNow()).to.be('há 17 minutos');
      done();
    });

    it("returns 'em 17 minutos' when time is some seconds after 17 minutes in the future", function(done) {
      expect(moment(secondsInTheFuture(minutes(17) + 2)).fromNow()).to.be('em 17 minutos');
      done();
    });

    it("returns 'há uma hora' when time is some seconds before 1 hour in the past", function(done) {
      expect(moment(secondsInThePast(hours(1) + 3)).fromNow()).to.be('há uma hora');
      done();
    });

    it("returns 'em uma hora' when time is some seconds after 1 hour in the future", function(done) {
      expect(moment(secondsInTheFuture(hours(1) + 3)).fromNow()).to.be('em uma hora');
      done();
    });

    it("returns 'há 2 horas' when time is some seconds before 2 hours in the past", function(done) {
      expect(moment(secondsInThePast(hours(2) + 4)).fromNow()).to.be('há 2 horas');
      done();
    });

    it("returns 'em 2 horas' when time is some seconds after 2 hours in the future", function(done) {
      expect(moment(secondsInTheFuture(hours(2) + 4)).fromNow()).to.be('em 2 horas');
      done();
    });

    it("returns 'há um dia' when time is some seconds before 24 hours in the past", function(done) {
      expect(moment(secondsInThePast(hours(24) + 5)).fromNow()).to.be('há um dia');
      done();
    });

    it("returns 'em um dia' when time is some seconds after 24 hours in the future", function(done) {
      expect(moment(secondsInTheFuture(hours(24) + 5)).fromNow()).to.be('em um dia');
      done();
    });

    it("returns 'há 6 dias' when time is some seconds before 6 days in the past", function(done) {
      expect(moment(secondsInThePast(days(6) + 6)).fromNow()).to.be('há 6 dias');
      done();
    });

    it("returns 'em 6 dias' when time is some seconds after 6 days in the future", function(done) {
      expect(moment(secondsInTheFuture(days(6) + 6)).fromNow()).to.be('em 6 dias');
      done();
    });

    it("returns 'há 7 dias' when time is some seconds before 7 days in the past", function(done) {
      expect(moment(secondsInThePast(days(7) + 7)).fromNow()).to.be('há 7 dias');
      done();
    });

    it("returns 'em 7 dias' when time is some seconds after 7 days in the future", function(done) {
      expect(moment(secondsInTheFuture(days(7) + 7)).fromNow()).to.be('em 7 dias');
      done();
    });

    it("returns 'há 14 dias' when time is some seconds before 2 weeks in the past", function(done) {
      expect(moment(secondsInThePast(weeks(2) + 8)).fromNow()).to.be('há 14 dias');
      done();
    });

    it("returns 'em 14 dias' when time is some seconds after 2 weeks in the future", function(done) {
      expect(moment(secondsInTheFuture(weeks(2) + 8)).fromNow()).to.be('em 14 dias');
      done();
    });

    it("returns 'há um mês' when time is some seconds before 4 weeks in the past", function(done) {
      expect(moment(secondsInThePast(weeks(4) + 9)).fromNow()).to.be('há um mês');
      done();
    });

    it("returns 'em um mês' when time is some seconds after 4 weeks in the future", function(done) {
      expect(moment(secondsInTheFuture(weeks(4) + 9)).fromNow()).to.be('em um mês');
      done();
    });

    it("returns 'há 8 meses' when time is some seconds before 9 months in the past", function(done) {
      expect(moment(secondsInThePast(months(9) + 10)).fromNow()).to.be('há 8 meses');
      done();
    });

    it("returns 'em 8 meses' when time is some seconds after 9 months in the future", function(done) {
      expect(moment(secondsInTheFuture(months(9) + 10)).fromNow()).to.be('em 8 meses');
      done();
    });

    it("returns 'há um ano' when time is some seconds before 12 months in the past", function(done) {
      expect(moment(secondsInThePast(months(12) + 11)).fromNow()).to.be('há um ano');
      done();
    });

    it("returns 'em um ano' when time is some seconds after 12 months in the future", function(done) {
      expect(moment(secondsInTheFuture(months(12) + 11)).fromNow()).to.be('em um ano');
      done();
    });

    it("returns 'há 14 anos' when time is some seconds before 15 years in the past", function(done) {
      expect(moment(secondsInThePast(years(15) + 12)).fromNow()).to.be('há 14 anos');
      done();
    });

    it("returns 'em 14 anos' when time is some seconds after 15 years in the future", function(done) {
      expect(moment(secondsInTheFuture(years(15) + 12)).fromNow()).to.be('em 14 anos');
      done();
    });
  });

  /* ********** Helper functions ********** */

  var secondsInThePast = function(seconds) {
    return Date.now() - seconds * 1000;
  }

  var secondsInTheFuture = function(seconds) {
    return Date.now() + seconds * 1000;
  }

  var minutes = function(count) {
    return 60 * count;
  }

  var hours = function(count) {
    return 60 * minutes(count);
  }

  var days = function(count) {
    return 24 * hours(count);
  }

  var weeks = function(count) {
    return 7 * days(count);
  }

  var months = function(count) {
    return 4 * weeks(count);
  }

  var years = function(count) {
    return 12 * months(count);
  }

  var loadMoment = function(done) {
    helper.newPad(function() {
      var chrome$ = helper.padChrome$;
      chrome$.getScript('/static/plugins/ep_comments_page/static/js/moment-with-locales.min.js')
      .done(function(code){
        chrome$.window.eval(code);
        moment = chrome$.window.moment;
        moment.relativeTimeThreshold('ss', 0);
        done();
      })
      .fail(function(jqxhr, settings, exception) {
        done(exception);
      });
    });
  }

  var changeLanguageTo = function(lang, callback) {
    var boldTitles = {
      'en' : 'Bold (Ctrl+B)',
      'pt-br' : 'Negrito (Ctrl-B)',
      'af' : 'Vet (Ctrl-B)'
    };
    var chrome$ = helper.padChrome$;

    //click on the settings button to make settings visible
    var $settingsButton = chrome$(".buttonicon-settings");
    $settingsButton.click();

    //select the language
    var $language = chrome$("#languagemenu");
    $language.val(lang);
    $language.change();

    // hide settings again
    $settingsButton.click();

    helper.waitFor(function() {
      return chrome$(".buttonicon-bold").parent()[0]["title"] == boldTitles[lang];
     })
    .done(callback);
  }
});
