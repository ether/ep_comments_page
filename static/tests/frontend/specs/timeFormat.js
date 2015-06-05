var prettyDate;

describe("Time Formatting", function() {
  _.each({'en': 'English', 'de': 'a language not localized yet'}, function(description, lang) {
    describe("in " + description, function(){
      before(function(cb) {
        loadPrettyDate(function() {
          changeLanguageTo(lang, cb);
        });
        this.timeout(60000);
      });

      // ensure we go back to English to avoid breaking other tests:
      after(function(cb){
        changeLanguageTo('en', cb);
      });

      it("returns '12 seconds ago' when time is 12 seconds in the past", function(done) {
        expect(prettyDate(secondsInThePast(12))).to.be('12 seconds ago');
        done();
      });

      it("returns '12 seconds from now' when time is 12 seconds in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(12))).to.be('12 seconds from now');
        done();
      });

      it("returns '1 minute ago' when time is 75 seconds in the past", function(done) {
        expect(prettyDate(secondsInThePast(75))).to.be('1 minute ago');
        done();
      });

      it("returns '1 minute from now' when time is 75 seconds in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(75))).to.be('1 minute from now');
        done();
      });

      it("returns '17 minutes ago' when time is some seconds before 17 minutes in the past", function(done) {
        expect(prettyDate(secondsInThePast(minutes(17) + 2))).to.be('17 minutes ago');
        done();
      });

      it("returns '17 minutes from now' when time is some seconds after 17 minutes in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(minutes(17) + 2))).to.be('17 minutes from now');
        done();
      });

      it("returns '1 hour ago' when time is some seconds before 1 hour in the past", function(done) {
        expect(prettyDate(secondsInThePast(hours(1) + 3))).to.be('1 hour ago');
        done();
      });

      it("returns '1 hour from now' when time is some seconds after 1 hour in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(hours(1) + 3))).to.be('1 hour from now');
        done();
      });

      it("returns '2 hours ago' when time is some seconds before 2 hours in the past", function(done) {
        expect(prettyDate(secondsInThePast(hours(2) + 4))).to.be('2 hours ago');
        done();
      });

      it("returns '2 hours from now' when time is some seconds after 2 hours in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(hours(2) + 4))).to.be('2 hours from now');
        done();
      });

      it("returns 'yesterday' when time is some seconds before 24 hours in the past", function(done) {
        expect(prettyDate(secondsInThePast(hours(24) + 5))).to.be('yesterday');
        done();
      });

      it("returns 'tomorrow' when time is some seconds after 24 hours in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(hours(24) + 5))).to.be('tomorrow');
        done();
      });

      it("returns '6 days ago' when time is some seconds before 6 days in the past", function(done) {
        expect(prettyDate(secondsInThePast(days(6) + 6))).to.be('6 days ago');
        done();
      });

      it("returns '6 days from now' when time is some seconds after 6 days in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(days(6) + 6))).to.be('6 days from now');
        done();
      });

      it("returns 'last week' when time is some seconds before 7 days in the past", function(done) {
        expect(prettyDate(secondsInThePast(days(7) + 7))).to.be('last week');
        done();
      });

      it("returns 'next week' when time is some seconds after 7 days in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(days(7) + 7))).to.be('next week');
        done();
      });

      it("returns '2 weeks ago' when time is some seconds before 2 weeks in the past", function(done) {
        expect(prettyDate(secondsInThePast(weeks(2) + 8))).to.be('2 weeks ago');
        done();
      });

      it("returns '2 weeks from now' when time is some seconds after 2 weeks in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(weeks(2) + 8))).to.be('2 weeks from now');
        done();
      });

      it("returns 'last month' when time is some seconds before 4 weeks in the past", function(done) {
        expect(prettyDate(secondsInThePast(weeks(4) + 9))).to.be('last month');
        done();
      });

      it("returns 'next month' when time is some seconds after 4 weeks in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(weeks(4) + 9))).to.be('next month');
        done();
      });

      it("returns '9 months ago' when time is some seconds before 9 months in the past", function(done) {
        expect(prettyDate(secondsInThePast(months(9) + 10))).to.be('9 months ago');
        done();
      });

      it("returns '9 months from now' when time is some seconds after 9 months in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(months(9) + 10))).to.be('9 months from now');
        done();
      });

      it("returns 'last year' when time is some seconds before 12 months in the past", function(done) {
        expect(prettyDate(secondsInThePast(months(12) + 11))).to.be('last year');
        done();
      });

      it("returns 'next year' when time is some seconds after 12 months in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(months(12) + 11))).to.be('next year');
        done();
      });

      it("returns '15 years ago' when time is some seconds before 15 years in the past", function(done) {
        expect(prettyDate(secondsInThePast(years(15) + 12))).to.be('15 years ago');
        done();
      });

      it("returns '15 years from now' when time is some seconds after 15 years in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(years(15) + 12))).to.be('15 years from now');
        done();
      });

      it("returns 'last century' when time is some seconds before 100 years in the past", function(done) {
        expect(prettyDate(secondsInThePast(years(100) + 13))).to.be('last century');
        done();
      });

      it("returns 'next century' when time is some seconds after 100 years in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(years(100) + 13))).to.be('next century');
        done();
      });

      it("returns '2 centuries ago' when time is some seconds before 2 centuries in the past", function(done) {
        expect(prettyDate(secondsInThePast(centuries(2) + 14))).to.be('2 centuries ago');
        done();
      });

      it("returns '2 centuries from now' when time is some seconds after 2 centuries in the future", function(done) {
        expect(prettyDate(secondsInTheFuture(centuries(2) + 14))).to.be('2 centuries from now');
        done();
      });

    })
  });

  describe("in Portuguese", function(){
    before(function(cb) {
      loadPrettyDate(function() {
        changeLanguageTo('pt-br', cb);
      });
      this.timeout(60000);
    });

    it("returns '12 segundos atrás' when time is 12 seconds in the past", function(done) {
      expect(prettyDate(secondsInThePast(12))).to.be('12 segundos atrás');
      done();
    });

    it("returns 'daqui a 12 segundos' when time is 12 seconds in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(12))).to.be('daqui a 12 segundos');
      done();
    });

    it("returns '1 minuto atrás' when time is 75 seconds in the past", function(done) {
      expect(prettyDate(secondsInThePast(75))).to.be('1 minuto atrás');
      done();
    });

    it("returns 'daqui a 1 minuto' when time is 75 seconds in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(75))).to.be('daqui a 1 minuto');
      done();
    });

    it("returns '17 minutos atrás' when time is some seconds before 17 minutes in the past", function(done) {
      expect(prettyDate(secondsInThePast(minutes(17) + 2))).to.be('17 minutos atrás');
      done();
    });

    it("returns 'daqui a 17 minutos' when time is some seconds after 17 minutes in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(minutes(17) + 2))).to.be('daqui a 17 minutos');
      done();
    });

    it("returns '1 hora atrás' when time is some seconds before 1 hour in the past", function(done) {
      expect(prettyDate(secondsInThePast(hours(1) + 3))).to.be('1 hora atrás');
      done();
    });

    it("returns 'daqui a 1 hora' when time is some seconds after 1 hour in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(hours(1) + 3))).to.be('daqui a 1 hora');
      done();
    });

    it("returns '2 horas atrás' when time is some seconds before 2 hours in the past", function(done) {
      expect(prettyDate(secondsInThePast(hours(2) + 4))).to.be('2 horas atrás');
      done();
    });

    it("returns 'daqui a 2 horas' when time is some seconds after 2 hours in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(hours(2) + 4))).to.be('daqui a 2 horas');
      done();
    });

    it("returns 'ontem' when time is some seconds before 24 hours in the past", function(done) {
      expect(prettyDate(secondsInThePast(hours(24) + 5))).to.be('ontem');
      done();
    });

    it("returns 'amanhã' when time is some seconds after 24 hours in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(hours(24) + 5))).to.be('amanhã');
      done();
    });

    it("returns '6 dias atrás' when time is some seconds before 6 days in the past", function(done) {
      expect(prettyDate(secondsInThePast(days(6) + 6))).to.be('6 dias atrás');
      done();
    });

    it("returns 'daqui a 6 dias' when time is some seconds after 6 days in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(days(6) + 6))).to.be('daqui a 6 dias');
      done();
    });

    it("returns 'semana passada' when time is some seconds before 7 days in the past", function(done) {
      expect(prettyDate(secondsInThePast(days(7) + 7))).to.be('semana passada');
      done();
    });

    it("returns 'próxima semana' when time is some seconds after 7 days in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(days(7) + 7))).to.be('próxima semana');
      done();
    });

    it("returns '2 semanas atrás' when time is some seconds before 2 weeks in the past", function(done) {
      expect(prettyDate(secondsInThePast(weeks(2) + 8))).to.be('2 semanas atrás');
      done();
    });

    it("returns 'daqui a 2 semanas' when time is some seconds after 2 weeks in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(weeks(2) + 8))).to.be('daqui a 2 semanas');
      done();
    });

    it("returns 'mês passado' when time is some seconds before 4 weeks in the past", function(done) {
      expect(prettyDate(secondsInThePast(weeks(4) + 9))).to.be('mês passado');
      done();
    });

    it("returns 'próximo mês' when time is some seconds after 4 weeks in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(weeks(4) + 9))).to.be('próximo mês');
      done();
    });

    it("returns '9 meses atrás' when time is some seconds before 9 months in the past", function(done) {
      expect(prettyDate(secondsInThePast(months(9) + 10))).to.be('9 meses atrás');
      done();
    });

    it("returns 'daqui a 9 meses' when time is some seconds after 9 months in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(months(9) + 10))).to.be('daqui a 9 meses');
      done();
    });

    it("returns 'ano passado' when time is some seconds before 12 months in the past", function(done) {
      expect(prettyDate(secondsInThePast(months(12) + 11))).to.be('ano passado');
      done();
    });

    it("returns 'próximo ano' when time is some seconds after 12 months in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(months(12) + 11))).to.be('próximo ano');
      done();
    });

    it("returns '15 anos atrás' when time is some seconds before 15 years in the past", function(done) {
      expect(prettyDate(secondsInThePast(years(15) + 12))).to.be('15 anos atrás');
      done();
    });

    it("returns 'daqui a 15 anos' when time is some seconds after 15 years in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(years(15) + 12))).to.be('daqui a 15 anos');
      done();
    });

    it("returns 'século passado' when time is some seconds before 100 years in the past", function(done) {
      expect(prettyDate(secondsInThePast(years(100) + 13))).to.be('século passado');
      done();
    });

    it("returns 'próximo século' when time is some seconds after 100 years in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(years(100) + 13))).to.be('próximo século');
      done();
    });

    it("returns '2 séculos atrás' when time is some seconds before 2 centuries in the past", function(done) {
      expect(prettyDate(secondsInThePast(centuries(2) + 14))).to.be('2 séculos atrás');
      done();
    });

    it("returns 'daqui a 2 séculos' when time is some seconds after 2 centuries in the future", function(done) {
      expect(prettyDate(secondsInTheFuture(centuries(2) + 14))).to.be('daqui a 2 séculos');
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

  var centuries = function(count) {
    return 100 * years(count);
  }

  var loadPrettyDate = function(done) {
    helper.newPad(function() {
      var chrome$ = helper.padChrome$;

      chrome$.getScript('/static/plugins/ep_comments_page/static/js/timeFormat.js')
      .done(function(code){
        chrome$.window.eval(code);
        prettyDate = chrome$.window.prettyDate;

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
      'de' : 'Fett (Strg-B)'
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
