'use strict';

const common = require('ep_etherpad-lite/tests/backend/common');
const utils = require('../../utils');
const createPad = utils.createPad;
const createComment = utils.createComment;
const createCommentReply = utils.createCommentReply;
const commentsEndPointFor = utils.commentsEndPointFor;
const commentRepliesEndPointFor = utils.commentRepliesEndPointFor;

let api;
const apiKey = common.apiKey;

describe(__filename, function () {
  let padID;

  before(async function () { api = await common.init(); });

  beforeEach(function (done) {
    createPad((err, newPadID) => {
      padID = newPadID;
      done(err);
    });
  });

  it('removes pad comments when pad is deleted', function (done) {
    // create comment...
    createComment(padID, {}, (err, comment) => {
      if (err) throw err;
      // ... remove pad...
      deletePad(padID, () => {
        // ... and finally check if comments are returned
        const getCommentsRoute = `${commentsEndPointFor(padID)}?apikey=${apiKey}`;
        api.get(getCommentsRoute)
            .expect((res) => {
              const commentsFound = Object.keys(res.body.data.comments);
              if (commentsFound.length !== 0) {
                throw new Error('Comments from pad should had been removed. ' +
                                `Found ${commentsFound.length} comment(s)`);
              }
            })
            .end(done);
      });
    });
  });

  it('removes pad comments replies when pad is deleted', function (done) {
    // create comment...
    createComment(padID, {}, (err, comment) => {
      if (err) throw err;

      // ... create reply...
      createCommentReply(padID, comment, {}, (err, reply) => {
        if (err) throw err;

        // ... remove pad...
        deletePad(padID, () => {
          // ... and finally check if replies are returned
          const getRepliesRoute = `${commentRepliesEndPointFor(padID)}?apikey=${apiKey}`;
          api.get(getRepliesRoute)
              .expect((res) => {
                const repliesFound = Object.keys(res.body.data.replies);
                if (repliesFound.length !== 0) {
                  throw new Error('Comment replies from pad should had been removed. ' +
                                  `Found ${repliesFound.length} reply(ies)`);
                }
              })
              .end(done);
        });
      });
    });
  });
});

const deletePad = function (padID, callback) {
  const deletePadRoute = `/api/1/deletePad?apikey=${apiKey}&padID=${padID}`;
  api.get(deletePadRoute).end((err, res) => {
    if (err || res.body.code !== 0) {
      throw (err || res.body.message || `unknown error while calling API route ${deletePadRoute}`);
    }

    callback();
  });
};
