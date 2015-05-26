var localizable = typeof html10n !== "undefined";

l10nKeys = {
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

var time_formats = [
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
  /*
  var time = ('' + date_str).replace(/-/g,"/").replace(/[TZ]/g," ").replace(/^\s\s*/   /*rappel   , '').replace(/\s\s*$/, '');
  if(time.substr(time.length-4,1)==".") time =time.substr(0,time.length-4);
  */
  var seconds = (new Date - new Date(time)) / 1000;
  var     token = 'ago',
    list_choice = 1,
  l10n_appendix = '.past';

  if (seconds < 0) {
    seconds = Math.abs(seconds);
    token = 'from now';
    l10n_appendix = '.future';
    list_choice = 2;
  }

  var i = 0, format;
  while (format = time_formats[i++])
    if (seconds < format[0]) {
      var count = Math.floor(seconds / format[2]);
      var formatted_time;
      if (localizable) {
        var key = l10nKeys[format[1]] + l10n_appendix;
        formatted_time = html10n.get(key, { count: count });
      }

      // Wasn't able to localize properly the date, so use the default:
      if (formatted_time === undefined) {
        if (typeof format[2] == 'string')
          formatted_time =  format[list_choice];
        else
          formatted_time = count + ' ' + format[1] + ' ' + token;
      }
      return formatted_time;
    }
  return time;
};

// TODO I could not find a way to access the prttyDate on client-side (used
// for the tests), I'm sure there's a better way to avoid errors than this:
if (typeof exports === 'undefined') exports = {};

exports.prettyDate = prettyDate;
