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

describe('padCopy hook', function() {
  var padID;

  beforeEach(function(done) {
    createPad(function(err, newPadID) {
      padID = newPadID;
      done(err);
    });
  });

  it('creates copies of pad comments when pad is duplicated', function(done) {
    // create comment...
    createComment(padID, {}, function(err, comment) {
      if (err) throw err;
      // ... duplicate pad...
      var copiedPadID = padID+'-copy';
      copyPad(padID, copiedPadID, function() {
        // ... and finally check if comments are returned
        var getCommentsRoute = commentsEndPointFor(copiedPadID)+'?apikey='+apiKey;
        api.get(getCommentsRoute)
        .expect(function(res) {
          var commentsFound = Object.keys(res.body.data.comments);
          if(commentsFound.length !== 1) {
            throw new Error('Comments from pad should had been copied.');
          }
        })
        .end(done);
      });
    });
  });

  it('creates copies of pad comment replies when pad is duplicated', function(done) {
    // create comment...
    createComment(padID, {}, function(err, comment) {
      if (err) throw err;

      // ... create reply...
      createCommentReply(padID, comment, {}, function(err, reply) {
        if (err) throw err;

        // ... duplicate pad...
        var copiedPadID = padID+'-copy';
        copyPad(padID, copiedPadID, function() {
          // ... and finally check if replies are returned
          var getRepliesRoute = commentRepliesEndPointFor(copiedPadID)+'?apikey='+apiKey;
          api.get(getRepliesRoute)
          .expect(function(res) {
            var repliesFound = Object.keys(res.body.data.replies);
            if(repliesFound.length !== 1) {
              throw new Error('Comment replies from pad should had been copied.');
            }
          })
          .end(done);
        });
      });
    });
  });
});

var copyPad = function(originalPadID, copiedPadID, callback) {
  var copyPadRoute = '/api/1.2.9/copyPad?apikey='+apiKey+'&sourceID='+originalPadID+'&destinationID='+copiedPadID;
  api.get(copyPadRoute).end(function(err, res) {
    if (err || res.body.code !== 0) {
      throw (err || res.body.message || 'unknown error while calling API route ' + copyPadRoute);
    }

    callback();
  });
}