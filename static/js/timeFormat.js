/* global exports, html10n */

const localizable = typeof html10n !== 'undefined';

const time_formats = [
  [60, 'seconds', 1], // 60
  [3600, 'minutes', 60], // 60*60, 60
  [86400, 'hours', 3600], // 60*60*24, 60*60
  [604800, 'days', 86400], // 60*60*24*7, 60*60*24
  [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
  [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
  [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
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
      if (localizable) {
        return html10n.get(`ep_comments_page.time.${format[1]}${l10n_appendix}`, {count});
      }
      return `${count} ${count === 1 ? format[1].slice(0, -1) : format[1]} ${token}`;
    }
  }
  return time;
}

// TODO I could not find a way to access the prttyDate on client-side (used
// for the tests), I'm sure there's a better way to avoid errors than this:
if (typeof exports === 'undefined') exports = {};

exports.prettyDate = prettyDate;
