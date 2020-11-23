'use strict';

const appUrl = 'http://localhost:9001';
const apiVersion = 1;

const supertest = require('supertest');
const request = require('request');
const api = supertest(appUrl);
const randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;

const apiKey = require('ep_etherpad-lite/node/handler/APIHandler.js').exportedForTestingOnly.apiKey;

// Functions to validate API responses:
const codeToBe = function (expectedCode, res) {
  if (res.body.code !== expectedCode) {
    throw new Error(`Code should be ${expectedCode}, was ${res.body.code}`);
  }
};

const codeToBe0 = function (res) { codeToBe(0, res); };
const codeToBe1 = function (res) { codeToBe(1, res); };
const codeToBe4 = function (res) { codeToBe(4, res); };

// App end point to create a comment via API
const commentsEndPointFor = function (pad) {
  return `/p/${pad}/comments`;
};

// App end point to create a comment reply via API
const commentRepliesEndPointFor = function (pad) {
  return `/p/${pad}/commentReplies`;
};

// Creates a pad and returns the pad id. Calls the callback when finished.
const createPad = function (done) {
  const pad = randomString(5);

  api.get(`/api/${apiVersion}/createPad?apikey=${apiKey}&padID=${pad}`)
      .end((err, res) => {
        if (err || (res.body.code !== 0)) done(new Error('Unable to create new Pad'));
      });

  done(null, pad);
};

const readOnlyId = function (padID, callback) {
  api.get(`/api/${apiVersion}/getReadOnlyID?apikey=${apiKey}&padID=${padID}`)
      .end((err, res) => {
        if (err || (res.body.code !== 0)) callback(new Error('Unable to get read only id'));

        callback(null, res.body.data.readOnlyID);
      });
};

// Creates a comment and calls the callback when finished.
const createComment = function (pad, commentData, done) {
  let commentId;
  commentData = commentData || {};
  commentData.name = commentData.name || 'John Doe';
  commentData.text = commentData.text || 'This is a comment';

  const url = appUrl + commentsEndPointFor(pad);
  request.post(url,
      {form: {
        apikey: apiKey,
        data: JSON.stringify([commentData]),
      }},
      (error, res, body) => {
        if (error) {
          throw error;
        } else if (res.statusCode !== 200) {
          throw new Error(`Failed on calling API. Status code: ${res.statusCode}`);
        } else {
          const json = JSON.parse(body);
          if (json.code !== 0) {
            throw new Error(`Failed on calling API. Response was: ${res.body}`);
          }
          commentId = json.commentIds[0];
          done(null, commentId);
        }
      },
  );
};

// Creates a comment reply and calls the callback when finished.
const createCommentReply = function (pad, comment, replyData, done) {
  let replyId;
  replyData = replyData || {};
  replyData.commentId = comment;
  replyData.name = replyData.name || 'John Doe';
  replyData.text = replyData.text || 'This is a reply';
  const url = appUrl + commentRepliesEndPointFor(pad);
  request.post(url,
      {form: {
        apikey: apiKey,
        data: JSON.stringify([replyData]),
      }},
      (error, res, body) => {
        if (error) {
          throw error;
        } else if (res.statusCode !== 200) {
          throw new Error(`Failed on calling API. Status code: ${res.statusCode}`);
        } else {
          const json = JSON.parse(body);
          if (json.code !== 0) {
            throw new Error(`Failed on calling API. Response was: ${res.body}`);
          }
          replyId = json.replyIds[0];
          done(null, replyId);
        }
      },
  );
};

/* ********** Available functions/values: ********** */
exports.apiVersion = apiVersion;
exports.api = api;
exports.appUrl = appUrl;
exports.apiKey = apiKey;
exports.createPad = createPad;
exports.readOnlyId = readOnlyId;
exports.createComment = createComment;
exports.createCommentReply = createCommentReply;
exports.codeToBe0 = codeToBe0;
exports.codeToBe1 = codeToBe1;
exports.codeToBe4 = codeToBe4;
exports.commentsEndPointFor = commentsEndPointFor;
exports.commentRepliesEndPointFor = commentRepliesEndPointFor;
