var             supertest = require('ep_etherpad-lite/node_modules/supertest'),
                       io = require('socket.io-client'),
                  request = require('request'),
                    utils = require('../../../utils'),
                createPad = utils.createPad,
               readOnlyId = utils.readOnlyId,
            createComment = utils.createComment,
       createCommentReply = utils.createCommentReply,
commentRepliesEndPointFor = utils.commentRepliesEndPointFor,
                   apiKey = utils.apiKey,
                   appUrl = utils.appUrl,
                codeToBe0 = utils.codeToBe0,
                codeToBe1 = utils.codeToBe1,
                codeToBe4 = utils.codeToBe4,
                      api = supertest(appUrl);


describe('get comments replies', function(){
  var padID;
  //create a new pad before each test run
  beforeEach(function(done){
    padID = createPad(done);
  });

  it('return code 4 if apikey is missing', function(done){
    api.get(listCommentRepliesEndPointFor(padID))
    .expect(codeToBe4)
    .expect('Content-Type',/json/)
    .expect(401, done)
  });

  it('returns code 4 if apikey is wrong', function(done){
    api.get(listCommentRepliesEndPointFor(padID,"wrongApiKey"))
    .expect(codeToBe4)
    .expect('Content-Type',/json/)
    .expect(401, done)
  })

  it ('returns code 0 if apiKey is right', function(done){
    api.get(listCommentRepliesEndPointFor(padID, apiKey))
    .expect(codeToBe0)
    .expect('Content-Type',/json/)
    .expect(200, done)
  })

  it('returns a list of comment replies', function(done){
    // add a comment to a pad
    createComment(pad, {}, function(err, comment) {
      createCommentReply(pad, comment, {}, function(err, replyId){
        api.get(listCommentRepliesEndPointFor(padID, apiKey))
        .expect(function(res){
          if(res.body.data.replies === undefined) throw new Error("Response expected to have a list of comment replies")
          var replies = Object.keys(res.body.data.replies);
          if(replies.length !==1) throw new Error("Response expected to have one reply")
        }).end(done);
      })
    });
  })

  it('returns comment replies data', function(done){
    createComment(pad, {}, function(err, comment){
      var text       = "text";
      var changeTo   = "changeTo";
      var changeFrom = "changeFrom";
      var name       = "name";
      var timestamp  = 1440671727068;
      var data = {
        commentId: comment,
        reply: text,
        changeTo: changeTo,
        changeFrom: changeFrom,
        name: name,
        timestamp: timestamp,
      };
      createCommentReply(pad, comment, data, function(err, replyId){
        api.get(listCommentRepliesEndPointFor(padID, apiKey))
        .expect(function(res){
          var comment_reply_data = res.body.data.replies[replyId];
          if(comment_reply_data.commentId  != comment   )  throw new Error("Wrong commentId. Expected: "  + comment    + ", got: " + comment_reply_data.commentId)
          if(comment_reply_data.text       != text )       throw new Error("Wrong text. Expected: "       + text       + ", got: " + comment_reply_data.text)
          if(comment_reply_data.changeTo   != changeTo )   throw new Error("Wrong changeTo. Expected: "   + changeTo   + ", got: " + comment_reply_data.changeTo)
          if(comment_reply_data.changeFrom != changeFrom ) throw new Error("Wrong changeFrom. Expected: " + changeFrom + ", got: " + comment_reply_data.changeFrom)
          if(comment_reply_data.name       != name )       throw new Error("Wrong name. Expected: "       + name       + ", got: " + comment_reply_data.name)
          if(comment_reply_data.timestamp  != timestamp )  throw new Error("Wrong timestamp. Expected: "  + timestamp  + ", got: " + comment_reply_data.timestamp)
        }).end(done);
      })
    })
  });

  it('returns same data for read-write and read-only pad ids', function(done){
    // create comment
    createComment(pad, {}, function(err, comment){
      // create reply
      createCommentReply(pad, comment, {}, function(err, commentId){
        // get r-w data
        api.get(listCommentRepliesEndPointFor(padID, apiKey))
        .end(function(err, res) {
          var rwData = JSON.stringify(res.body.data);
          // get read-only pad id
          readOnlyId(pad, function(err, roPadId) {
            // get r-o data
            api.get(listCommentRepliesEndPointFor(roPadId, apiKey))
            .expect(function(res){
              var roData = JSON.stringify(res.body.data);
              if(roData != rwData) throw new Error("Read-only and read-write data don't match. Read-only data: " + roData + ", read-write data: " + rwData);
            })
            .end(done);
          });
        });
      });
    });
  });
})

describe('create comment replies API', function() {
  var padID;
  var commentID;

  beforeEach(function(done){
    // creates a new pad...
    padID = createPad(function(err, pad) {
      // ... and a comment before each test run
      createComment(pad, {}, function(err, comment) {
        commentID = comment;
        done(err);
      });
    });
  });

  it('returns code 1 if data is missing', function(done) {
    api.post(commentRepliesEndPointFor(padID))
    .field('apikey', apiKey)
    .expect(codeToBe1)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns code 1 if data is not a JSON', function(done) {
    api.post(commentRepliesEndPointFor(padID))
    .field('apikey', apiKey)
    .field('data', 'not a JSON')
    .expect(codeToBe1)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns code 4 if API key is missing', function(done) {
    api.post(commentRepliesEndPointFor(padID))
    .expect(codeToBe4)
    .expect('Content-Type', /json/)
    .expect(401, done)
  });

  it('returns code 4 if API key is wrong', function(done) {
    api.post(commentRepliesEndPointFor(padID))
    .field('apikey', 'wrongApiKey')
    .expect(codeToBe4)
    .expect('Content-Type', /json/)
    .expect(401, done)
  });

  it('returns code 0 when reply is successfully added', function(done) {
    api.post(commentRepliesEndPointFor(padID))
    .field('apikey', apiKey)
    .field('data', repliesData(commentID))
    .expect(codeToBe0)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns reply ids when replies are successfully added', function(done) {
    var twoReplies = repliesData([replyData(), replyData()]);
    api.post(commentRepliesEndPointFor(padID))
    .field('apikey', apiKey)
    .field('data', twoReplies)
    .expect(function(res){
      if(res.body.replyIds === undefined) throw new Error("Response should have replyIds.");
      if(res.body.replyIds.length !== 2) throw new Error("Response should have two reply ids.");
    })
    .end(done)
  });

  context('when pad already have replies', function() {
    it('returns only the new reply ids', function(done) {
      createCommentReply(padID, commentID, {}, function(err, touch) {
        var twoReplies = repliesData([replyData(), replyData()]);
        api.post(commentRepliesEndPointFor(padID))
        .field('apikey', apiKey)
        .field('data', twoReplies)
        .expect(function(res) {
          if(res.body.replyIds === undefined) throw new Error("Response should have replyIds.");
          if(res.body.replyIds.length !== 2) throw new Error("Response should have two reply ids.");
        })
        .end(done)
      });
    });
  });
});

describe('create comment reply API broadcast', function() {
  var padID;
  var timesMessageWasReceived;

  // NOTE: this hook will timeout if you don't run your Etherpad in
  // loadTest mode. Be sure to adjust your settings.json when running
  // this test suite
  beforeEach(function(done){
    timesMessageWasReceived = 0;

    // creates a new pad...
    padID = createPad(function(err, pad) {
      // ... and a comment before each test run, then...
      createComment(pad, {},function(err, comment) {
        commentID = comment;

        // ... listens to the broadcast message:
        var socket = io.connect(appUrl + "/comment");
        var req = { padId: pad };
        // needs to get comments to be able to join the pad room, where the messages will be broadcast to:
        socket.emit('getComments', req, function (res){
          socket.on('pushAddCommentReply', function(data) {
            ++timesMessageWasReceived;
          });

          done();
        });
      });
    });
  });

  it('broadcasts comment reply creation to other clients of same pad', function(done) {
    // create first reply...
    createCommentReply(padID, commentID, {}, function(err, replyId) {
      if(err) throw err;
      if(!replyId) throw new Error("Reply should had been created");

      // ... create second reply...
      createCommentReply(padID, commentID, {}, function(err, replyId) {
        if(err) throw err;
        if(!replyId) throw new Error("Reply should had been created");

        // ... then check if both messages were received
        setTimeout(function() { //give it some time to process the message on the client
          if(timesMessageWasReceived !== 2) throw new Error("Message should had been received");
          done();
        }, 100);
      });
    });
  });

  it('does not broadcast comment reply creation to clients of different pad', function(done) {
    // creates another pad...
    createPad(function(err, otherPadId) {
      // ... and another comment...
      createComment(otherPadId, {},function(err, otherCommentId) {
        if(err) throw err;
        if(!otherCommentId) throw new Error("Comment should had been created");

        // ... and adds comment reply to it:
        createCommentReply(otherPadId, otherCommentId, {}, function(err, replyId) {
          if(err) throw err;
          if(!replyId) throw new Error("Reply should had been created");

          setTimeout(function() { //give it some time to process the message on the client
            if(timesMessageWasReceived !== 0) throw new Error("Message should had been received only for pad " + padID);
            done();
          }, 100);
        });
      });
    });
  });
});

var listCommentRepliesEndPointFor = function(padID, apiKey) {
  var extraParams = "";
  if(apiKey) {
    extraParams = "?apikey=" + apiKey;
  }
  return commentRepliesEndPointFor(padID) + extraParams;
}

var repliesData = function(replies) {
  if (!replies) replies = [replyData()];

  return JSON.stringify(replies);
}

var replyData = function(commentId) {
  return { commentId: commentId, name: 'The Author', text: 'The Comment Text' };
}