'use strict';

const utils = require('../../../utils');
const apiKey = utils.apiKey;
const codeToBe0 = utils.codeToBe0;
const api = utils.api;
const apiVersion = utils.apiVersion;
const randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;


describe('export comments to HTML', function () {
  let padID;
  let html;

  // create a new pad before each test run
  beforeEach(function (done) {
    padID = randomString(5);

    createPad(padID, () => {
      setHTML(padID, html(), done);
    });
  });

  context('when pad text has one comment', function () {
    before(function () {
      html = function () {
        return buildHTML(textWithComment('c-1234'));
      };
    });

    it('returns ok', function (done) {
      api.get(getHTMLEndPointFor(padID))
          .expect(codeToBe0)
          .expect('Content-Type', /json/)
          .expect(200, done);
    });

    it('returns HTML with comment class', function (done) {
      api.get(getHTMLEndPointFor(padID))
          .expect((res) => {
            const expectedRegex = regexWithComment('c-1234');
            const expectedComments = new RegExp(expectedRegex);
            const html = res.body.data.html;
            const foundComment = html.match(expectedComments);
            if (!foundComment) throw new Error(`Comment not exported. Regex used: ${expectedRegex}, html exported: ${html}`);
          })
          .end(done);
    });
  });
  context('when pad text has two comments in a single line', function () {
    before(function () {
      html = function () {
        return buildHTML(textWithComment('c-1234') + textWithComment('c-82a3'));
      };
    });

    it('returns HTML with two comments spans', function (done) {
      api.get(getHTMLEndPointFor(padID))
          .expect((res) => {
            const firstComment = regexWithComment('c-1234');
            const secondComment = regexWithComment('c-82a3');
            const expectedRegex = `${firstComment}.*${secondComment}`;
            const expectedComments = new RegExp(expectedRegex);

            const html = res.body.data.html;
            const foundComment = html.match(expectedComments);
            if (!foundComment) throw new Error(`Comment not exported. Regex used: ${expectedRegex}, html exported: ${html}`);
          })
          .end(done);
    });
  });

  context('when pad text has no comments', function () {
    before(function () {
      html = function () {
        return buildHTML('empty pad');
      };
    });

    it('returns HTML with no comment', function (done) {
      api.get(getHTMLEndPointFor(padID))
          .expect((res) => {
            const expectedRegex = '.*empty pad.*';
            const noComment = new RegExp(expectedRegex);

            const html = res.body.data.html;
            const foundComment = html.match(noComment);
            if (!foundComment) throw new Error(`Comment exported, should not have any. Regex used: ${expectedRegex}, html exported: ${html}`);
          })
          .end(done);
    });
  });

  context('when pad text has comment inside strong', function () {
    before(function () {
      html = function () {
        return buildHTML(`<strong>${textWithComment('c-2342', 'this is a comment and bold')}</strong>`);
      };
    });

    // Etherpad exports tags using the order they are defined on the array (bold is always inside comment)
    xit('returns HTML with strong and comment, in any order', function (done) {
      api.get(getHTMLEndPointFor(padID))
          .expect((res) => {
            const strongInsideCommentRegex = regexWithComment('c-2342', '<strong>this is a comment and bold<\/strong>');
            const commentInsideStrongRegex = `<strong>${regexWithComment('c-2342', 'this is a comment and bold')}<\/strong>`;
            const expectedStrongInsideComment = new RegExp(strongInsideCommentRegex);
            const expectedCommentInsideStrong = new RegExp(commentInsideStrongRegex);

            const html = res.body.data.html;
            const foundComment = html.match(expectedStrongInsideComment) || html.match(expectedCommentInsideStrong);
            if (!foundComment) throw new Error(`Comment not exported. Regex used: [${strongInsideCommentRegex} || ${commentInsideStrongRegex}], html exported: ${html}`);
          })
          .end(done);
    });
  });

  context('when pad text has comment in strong', function () {
    before(function () {
      html = function () {
        return buildHTML(textWithComment('c-2342', '<strong>this is a comment and bold</strong>'));
      };
    });

    // Etherpad exports tags using the order they are defined on the array (bold is always inside comment)
    it('returns HTML with strong and comment, in any order', function (done) {
      api.get(getHTMLEndPointFor(padID))
          .expect((res) => {
            const html = res.body.data.html;
            const foundComment = (html.indexOf('<strong>') !== -1);
            if (!foundComment) throw new Error(`Comment not exported. Regex used: [${strongInsideCommentRegex} || ${commentInsideStrongRegex}], html exported: ${html}`);
          })
          .end(done);
    });
  });

  context('when pad text has part with comment and part without it', function () {
    before(function () {
      html = function () {
        return buildHTML(`no comment here ${textWithComment('c-2342')}`);
      };
    });

    it('returns HTML with part with comment and part without it', function (done) {
      api.get(getHTMLEndPointFor(padID))
          .expect((res) => {
            const expectedRegex = `no comment here ${regexWithComment('c-2342')}`;
            const expectedComments = new RegExp(expectedRegex);
            const html = res.body.data.html;
            const foundComment = html.match(expectedComments);
            if (!foundComment) throw new Error(`Comment not exported. Regex used: ${expectedRegex}, html exported: ${html}`);
          })
          .end(done);
    });
  });
});


// Creates a pad and returns the pad id. Calls the callback when finished.
var createPad = function (padID, callback) {
  api.get(`/api/${apiVersion}/createPad?apikey=${apiKey}&padID=${padID}`)
      .end((err, res) => {
        if (err || (res.body.code !== 0)) callback(new Error('Unable to create new Pad'));

        callback(padID);
      });
};

var setHTML = function (padID, html, callback) {
  api.get(`/api/${apiVersion}/setHTML?apikey=${apiKey}&padID=${padID}&html=${html}`)
      .end((err, res) => {
        if (err || (res.body.code !== 0)) callback(new Error('Unable to set pad HTML'));

        callback(null, padID);
      });
};

var getHTMLEndPointFor = function (padID, callback) {
  return `/api/${apiVersion}/getHTML?apikey=${apiKey}&padID=${padID}`;
};


var buildHTML = function (body) {
  return `<html><body>${body}</body></html>`;
};

var textWithComment = function (commentId, text) {
  if (!text) text = `this is ${commentId}`;

  return `<span class='comment ${commentId}'>${text}`;
};

var regexWithComment = function (commentID, text) {
  if (!text) text = `this is ${commentID}`;

  return `<span .*class=['|"].*comment ${commentID}.*['|"].*>${text}`;
};
