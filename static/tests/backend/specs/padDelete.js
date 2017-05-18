var             supertest = require('ep_etherpad-lite/node_modules/supertest'),
                    utils = require('../../utils'),
                createPad = utils.createPad,
            createComment = utils.createComment,
       createCommentReply = utils.createCommentReply,
      commentsEndPointFor = utils.commentsEndPointFor,
commentRepliesEndPointFor = utils.commentRepliesEndPointFor,
                   appUrl = utils.appUrl,
                   apiKey = utils.apiKey,
                      api = supertest(appUrl);

describe('padRemove hook', function() {
  var padID;

  beforeEach(function(done) {
    createPad(function(err, newPadID) {
      padID = newPadID;
      done(err);
    });
  });

  it('removes pad comments when pad is deleted', function(done) {
    // create comment...
    createComment(padID, {}, function(err, comment) {
      if (err) throw err;
      // ... remove pad...
      deletePad(padID, function() {
        // ... and finally check if comments are returned
        var getCommentsRoute = commentsEndPointFor(padID)+'?apikey='+apiKey;
        api.get(getCommentsRoute)
        .expect(function(res) {
          var commentsFound = Object.keys(res.body.data.comments);
          if(commentsFound.length !== 0) {
            throw new Error('Comments from pad should had been removed. Found ' + commentsFound.length + ' comment(s)');
          }
        })
        .end(done);
      });
    });
  });

  it('removes pad comments replies when pad is deleted', function(done) {
    // create comment...
    createComment(padID, {}, function(err, comment) {
      if (err) throw err;

      // ... create reply...
      createCommentReply(padID, comment, {}, function(err, reply) {
        if (err) throw err;

        // ... remove pad...
        deletePad(padID, function() {
          // ... and finally check if replies are returned
          var getRepliesRoute = commentRepliesEndPointFor(padID)+'?apikey='+apiKey;
          api.get(getRepliesRoute)
          .expect(function(res) {
            var repliesFound = Object.keys(res.body.data.replies);
            if(repliesFound.length !== 0) {
              throw new Error('Comment replies from pad should had been removed. Found ' + repliesFound.length + ' reply(ies)');
            }
          })
          .end(done);
        });
      });
    });
  });
});

var deletePad = function(padID, callback) {
  var deletePadRoute = '/api/1/deletePad?apikey='+apiKey+'&padID='+padID;
  api.get(deletePadRoute).end(function(err, res) {
    if (err || res.body.code !== 0) {
      throw (err || res.body.message || 'unknown error while calling API route ' + deletePadRoute);
    }

    callback();
  });
}