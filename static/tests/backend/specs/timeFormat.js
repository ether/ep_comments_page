var prettyDate = require("../../../js/timeFormat").prettyDate,
        expect = require("expect");

describe('time formatting', function() {
  it("returns '12 seconds ago' when time is 12 seconds in the past", function() {
    expect(prettyDate(secondsInThePast(12))).toBe('12 seconds ago');
  });

  it("returns '12 seconds from now' when time is 12 seconds in the future", function() {
    expect(prettyDate(secondsInTheFuture(12))).toBe('12 seconds from now');
  });

  it("returns '1 minute ago' when time is 75 seconds in the past", function() {
    expect(prettyDate(secondsInThePast(75))).toBe('1 minute ago');
  });

  it("returns '1 minute from now' when time is 75 seconds in the future", function() {
    expect(prettyDate(secondsInTheFuture(75))).toBe('1 minute from now');
  });

  it("returns '17 minute ago' when time is some seconds before 17 minutes in the past", function() {
    expect(prettyDate(secondsInThePast(minutes(17) + 2))).toBe('17 minutes ago');
  });

  it("returns '17 minute from now' when time is some seconds after 17 minutes in the future", function() {
    expect(prettyDate(secondsInTheFuture(minutes(17) + 2))).toBe('17 minutes from now');
  });

  it("returns '1 hour ago' when time is some seconds before 1 hour in the past", function() {
    expect(prettyDate(secondsInThePast(hours(1) + 3))).toBe('1 hour ago');
  });

  it("returns '1 hour from now' when time is some seconds after 1 hour in the future", function() {
    expect(prettyDate(secondsInTheFuture(hours(1) + 3))).toBe('1 hour from now');
  });

  it("returns '2 hours ago' when time is some seconds before 2 hours in the past", function() {
    expect(prettyDate(secondsInThePast(hours(2) + 4))).toBe('2 hours ago');
  });

  it("returns '2 hours from now' when time is some seconds after 2 hours in the future", function() {
    expect(prettyDate(secondsInTheFuture(hours(2) + 4))).toBe('2 hours from now');
  });

  it("returns 'yesterday' when time is some seconds before 24 hours in the past", function() {
    expect(prettyDate(secondsInThePast(hours(24) + 5))).toBe('yesterday');
  });

  it("returns 'tomorrow' when time is some seconds after 24 hours in the future", function() {
    expect(prettyDate(secondsInTheFuture(hours(24) + 5))).toBe('tomorrow');
  });

  it("returns '6 days ago' when time is some seconds before 6 days in the past", function() {
    expect(prettyDate(secondsInThePast(days(6) + 6))).toBe('6 days ago');
  });

  it("returns '6 days from now' when time is some seconds after 6 days in the future", function() {
    expect(prettyDate(secondsInTheFuture(days(6) + 6))).toBe('6 days from now');
  });

  it("returns 'last week' when time is some seconds before 7 days in the past", function() {
    expect(prettyDate(secondsInThePast(days(7) + 7))).toBe('last week');
  });

  it("returns 'next week' when time is some seconds after 7 days in the future", function() {
    expect(prettyDate(secondsInTheFuture(days(7) + 7))).toBe('next week');
  });

  it("returns '2 weeks ago' when time is some seconds before 2 weeks in the past", function() {
    expect(prettyDate(secondsInThePast(weeks(2) + 8))).toBe('2 weeks ago');
  });

  it("returns '2 weeks from now' when time is some seconds after 2 weeks in the future", function() {
    expect(prettyDate(secondsInTheFuture(weeks(2) + 8))).toBe('2 weeks from now');
  });

  it("returns 'last month' when time is some seconds before 4 weeks in the past", function() {
    expect(prettyDate(secondsInThePast(weeks(4) + 9))).toBe('last month');
  });

  it("returns 'next month' when time is some seconds after 4 weeks in the future", function() {
    expect(prettyDate(secondsInTheFuture(weeks(4) + 9))).toBe('next month');
  });

  it("returns '9 months ago' when time is some seconds before 9 months in the past", function() {
    expect(prettyDate(secondsInThePast(months(9) + 10))).toBe('9 months ago');
  });

  it("returns '9 months from now' when time is some seconds after 9 months in the future", function() {
    expect(prettyDate(secondsInTheFuture(months(9) + 10))).toBe('9 months from now');
  });

  it("returns 'last year' when time is some seconds before 12 months in the past", function() {
    expect(prettyDate(secondsInThePast(months(12) + 11))).toBe('last year');
  });

  it("returns 'next year' when time is some seconds after 12 months in the future", function() {
    expect(prettyDate(secondsInTheFuture(months(12) + 11))).toBe('next year');
  });

  it("returns '15 years ago' when time is some seconds before 15 years in the past", function() {
    expect(prettyDate(secondsInThePast(years(15) + 12))).toBe('15 years ago');
  });

  it("returns '15 years from now' when time is some seconds after 15 years in the future", function() {
    expect(prettyDate(secondsInTheFuture(years(15) + 12))).toBe('15 years from now');
  });

  it("returns 'last century' when time is some seconds before 100 years in the past", function() {
    expect(prettyDate(secondsInThePast(years(100) + 13))).toBe('last century');
  });

  it("returns 'next century' when time is some seconds after 100 years in the future", function() {
    expect(prettyDate(secondsInTheFuture(years(100) + 13))).toBe('next century');
  });

  it("returns '2 centuries ago' when time is some seconds before 2 centuries in the past", function() {
    expect(prettyDate(secondsInThePast(centuries(2) + 14))).toBe('2 centuries ago');
  });

  it("returns '2 centuries from now' when time is some seconds after 2 centuries in the future", function() {
    expect(prettyDate(secondsInTheFuture(centuries(2) + 14))).toBe('2 centuries from now');
  });

})

function secondsInThePast(seconds) {
  return Date.now() - seconds * 1000;
}

function secondsInTheFuture(seconds) {
  return Date.now() + seconds * 1000;
}

function minutes(count) {
  return 60 * count;
}

function hours(count) {
  return 60 * minutes(count);
}

function days(count) {
  return 24 * hours(count);
}

function weeks(count) {
  return 7 * days(count);
}

function months(count) {
  return 4 * weeks(count);
}

function years(count) {
  return 12 * months(count);
}

function centuries(count) {
  return 100 * years(count);
}
