/* global __dirname, __filename, afterEach, before, beforeEach, describe, it, require */

/*
 * Import and Export tests for comments in .etherpad format
 */

const supertest = require('ep_etherpad-lite/node_modules/supertest');
const superagent = require('ep_etherpad-lite/node_modules/superagent');
const fs = require('fs');
const path = require('path');
const request = require('ep_etherpad-lite/node_modules/request');
const randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;

// test doc
const etherpadDoc = fs.readFileSync(`${__dirname}/test.etherpad`);
const apiVersion = 1;
const apiKey = require('ep_etherpad-lite/node/handler/APIHandler.js').exportedForTestingOnly.apiKey;
const testPadId = makeid();
const api = supertest('http://localhost:9001');

describe(__filename, function () {
  describe('Imports and Exports', function () {
    const backups = {};

    it('creates a new Pad, imports content to it, checks that content', async function () {
      await api.get(`${endPoint('createPad')}&padID=${testPadId}`)
          .expect(200)
          .expect('Content-Type', /json/);
    });

    it('imports .etherpad incuding a comment', function (done) {
      api.post(`/p/${testPadId}/import`)
          .attach('file', etherpadDoc, {
            filename: '/test.etherpad',
            contentType: 'application/etherpad',
          })
          .expect(200)
          .expect(/FrameCall\('true', 'ok'\);/)
          .then(() => done());
    });

    it('exports .etherpad and checks it includes comments', async function () {
      await api.get(`/p/${testPadId}/export/etherpad`)
          .buffer(true).parse(superagent.parse.text)
          .expect(200)
          .expect(/comments:/);
    });

    /*
    it('exports HTML for this Etherpad file', async function() {
      await api.get(`/p/${testPadId}/export/html`)
          .expect(200)
          .expect('content-type', 'text/html; charset=utf-8')
          .expect(/<ul class="bullet"><li><ul class="bullet"><li>hello<\/ul><\/li><\/ul>/);
    });
*/
  });
}); // End of tests.


var endPoint = function (point, version) {
  version = version || apiVersion;
  return `/api/${version}/${point}?apikey=${apiKey}`;
};

function makeid() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < 5; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
