const localizable = typeof html10n !== 'undefined';

const l10nKeys = {
  "seconds"           : "ep_comments_page.time.seconds",
  "1 minute ago"      : "ep_comments_page.time.one_minute",
  "minutes"           : "ep_comments_page.time.minutes",
  "1 hour ago"        : "ep_comments_page.time.one_hour",
  "hours"             : "ep_comments_page.time.hours",
  "yesterday"         : "ep_comments_page.time.one_day",
  "days"              : "ep_comments_page.time.days",
  "last week"         : "ep_comments_page.time.one_week",
  "weeks"             : "ep_comments_page.time.weeks",
  "last month"        : "ep_comments_page.time.one_month",
  "months"            : "ep_comments_page.time.months",
  "last year"         : "ep_comments_page.time.one_year",
  "years"             : "ep_comments_page.time.years",
  "last century"      : "ep_comments_page.time.one_century",
  "centuries"         : "ep_comments_page.time.centuries"
}

const time_formats = [
  [60, 'seconds', 1], // 60
  [120, '1 minute ago', '1 minute from now'], // 60*2
  [3600, 'minutes', 60], // 60*60, 60
  [7200, '1 hour ago', '1 hour from now'], // 60*60*2
  [86400, 'hours', 3600], // 60*60*24, 60*60
  [172800, 'yesterday', 'tomorrow'], // 60*60*24*2
  [604800, 'days', 86400], // 60*60*24*7, 60*60*24
  [1209600, 'last week', 'next week'], // 60*60*24*7*4*2
  [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
  [4838400, 'last month', 'next month'], // 60*60*24*7*4*2
  [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
  [58060800, 'last year', 'next year'], // 60*60*24*7*4*12*2
  [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
  [5806080000, 'last century', 'next century'], // 60*60*24*7*4*12*100*2
  [58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
];

function prettyDate(time){
  const now = new Date();
  const then = new Date(time);
  const seconds = Math.abs((now - then) / 1000);
  const future = now < then;
  const token = future ? 'from now' : 'ago';
  const list_choice = future ? 2 : 1;
  const l10n_appendix = future ? '.future' : '.past';

  for (const format of time_formats) {
    if (seconds < format[0]) {
      const count = Math.floor(seconds / format[2]);
      if (localizable) return html10n.get(l10nKeys[format[1]] + l10n_appendix, {count});
      if (typeof format[2] === 'string') return format[list_choice];
      return `${count} ${format[1]} ${token}`;
    }
  }
  return time;
}

// TODO I could not find a way to access the prttyDate on client-side (used
// for the tests), I'm sure there's a better way to avoid errors than this:
if (typeof exports === 'undefined') exports = {};

exports.prettyDate = prettyDate;
