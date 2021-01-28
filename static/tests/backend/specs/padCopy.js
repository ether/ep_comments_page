'use strict';

const supertest = require('supertest');
const utils = require('../../utils');
const createPad = utils.createPad;
const createComment = utils.createComment;
const createCommentReply = utils.createCommentReply;
const commentsEndPointFor = utils.commentsEndPointFor;
const commentRepliesEndPointFor = utils.commentRepliesEndPointFor;
const appUrl = utils.appUrl;
const apiKey = utils.apiKey;
const api = supertest(appUrl);

describe('padCopy hook', function () {
  let padID;

  beforeEach(function (done) {
    createPad((err, newPadID) => {
      padID = newPadID;
      done(err);
    });
  });

  it('creates copies of pad comments when pad is duplicated', function (done) {
    // create comment...
    createComment(padID, {}, (err, comment) => {
      if (err) throw err;
      // ... duplicate pad...
      const copiedPadID = `${padID}-copy`;
      copyPad(padID, copiedPadID, () => {
        // ... and finally check if comments are returned
        const getCommentsRoute = `${commentsEndPointFor(copiedPadID)}?apikey=${apiKey}`;
        api.get(getCommentsRoute)
            .expect((res) => {
              const commentsFound = Object.keys(res.body.data.comments);
              if (commentsFound.length !== 1) {
                throw new Error('Comments from pad should had been copied.');
              }
            })
            .end(done);
      });
    });
  });

  it('creates copies of pad comment replies when pad is duplicated', function (done) {
    // create comment...
    createComment(padID, {}, (err, comment) => {
      if (err) throw err;

      // ... create reply...
      createCommentReply(padID, comment, {}, (err, reply) => {
        if (err) throw err;

        // ... duplicate pad...
        const copiedPadID = `${padID}-copy`;
        copyPad(padID, copiedPadID, () => {
          // ... and finally check if replies are returned
          const getRepliesRoute = `${commentRepliesEndPointFor(copiedPadID)}?apikey=${apiKey}`;
          api.get(getRepliesRoute)
              .expect((res) => {
                const repliesFound = Object.keys(res.body.data.replies);
                if (repliesFound.length !== 1) {
                  throw new Error('Comment replies from pad should had been copied.');
                }
              })
              .end(done);
        });
      });
    });
  });
});

const copyPad = function (originalPadID, copiedPadID, callback) {
  const copyPadRoute =
    `/api/1.2.9/copyPad?apikey=${apiKey}&sourceID=${originalPadID}&destinationID=${copiedPadID}`;
  api.get(copyPadRoute).end((err, res) => {
    if (err || res.body.code !== 0) {
      throw (err || res.body.message || `unknown error while calling API route ${copyPadRoute}`);
    }

    callback();
  });
};
