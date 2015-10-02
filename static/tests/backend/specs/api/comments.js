var       supertest = require('ep_etherpad-lite/node_modules/supertest'),
                 io = require('socket.io-client'),
              utils = require('../../../utils'),
          createPad = utils.createPad,
         readOnlyId = utils.readOnlyId,
      createComment = utils.createComment,
             appUrl = utils.appUrl,
             apiKey = utils.apiKey,
          codeToBe0 = utils.codeToBe0,
          codeToBe1 = utils.codeToBe1,
          codeToBe4 = utils.codeToBe4,
commentsEndPointFor = utils.commentsEndPointFor,
                api = supertest(appUrl);

describe('get comments API', function() {
  var padID;

  //create a new pad before each test run
  beforeEach(function(done){
    padID = createPad(done);
  });

  it('returns code 4 if API key is missing', function(done) {
    api.get(listCommentsEndPointFor(padID))
    .expect(codeToBe4)
    .expect('Content-Type', /json/)
    .expect(401, done)
  });

  it('returns code 4 if API key is wrong', function(done) {
    api.get(listCommentsEndPointFor(padID, 'wrongApiKey'))
    .expect(codeToBe4)
    .expect('Content-Type', /json/)
    .expect(401, done)
  });

  it('returns code 0 when API key is provided', function(done) {
    api.get(listCommentsEndPointFor(padID, apiKey))
    .expect(codeToBe0)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns comment list when API key is provided', function(done) {
    // creates first comment...
    createComment(pad, {},function(err, comment) {
      // ... creates second comment...
      createComment(pad, {},function(err, comment) {
        // ... and finally checks if comments are returned
        api.get(listCommentsEndPointFor(padID, apiKey))
        .expect(function(res){
          if(res.body.data.comments === undefined) throw new Error("Response should have list of comments.");
          var commentIds = Object.keys(res.body.data.comments);
          if(commentIds.length !== 2) throw new Error("Response should have two comments.");
        })
        .end(done);
      });
    });
  });

  it('returns comment data', function(done){
    var name       = "name";
    var text       = "text";
    var timestamp  = 1440671727068;
    var changeTo   = "changeTo";
    var changeFrom = "changeFrom";
    var data = {
      name: name,
      text: text,
      timestamp: timestamp,
      changeTo: changeTo,
      changeFrom: changeFrom,
    };
    createComment(pad, data, function(err, commentId){
      api.get(listCommentsEndPointFor(padID, apiKey))
      .expect(function(res){
        var comment_data = res.body.data.comments[commentId];
        if(comment_data.name != name)             throw new Error("Wrong name. Expected: "       + name       + ", got: " + comment_data.name);
        if(comment_data.text != text)             throw new Error("Wrong text. Expected: "       + text       + ", got: " + comment_data.text);
        if(comment_data.timestamp != timestamp)   throw new Error("Wrong timestamp. Expected: "  + timestamp  + ", got: " + comment_data.timestamp);
        if(comment_data.changeTo != changeTo)     throw new Error("Wrong changeTo. Expected: "   + changeTo   + ", got: " + comment_data.changeTo);
        if(comment_data.changeFrom != changeFrom) throw new Error("Wrong changeFrom. Expected: " + changeFrom + ", got: " + comment_data.changeFrom);
      })
      .end(done);
    })
  });

  it('returns same data for read-write and read-only pad ids', function(done){
    createComment(pad, {}, function(err, commentId){
      api.get(listCommentsEndPointFor(padID, apiKey))
      .end(function(err, res) {
        var rwData = JSON.stringify(res.body.data);
        readOnlyId(pad, function(err, roPadId) {
          api.get(listCommentsEndPointFor(roPadId, apiKey))
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

describe('create comments API', function(){
  var padID;

  //create a new pad before each test run
  beforeEach(function(done){
    padID = createPad(done);
  });

  it('returns code 1 if data is missing', function(done) {
    api.post(commentsEndPointFor(padID))
    .field('apikey', apiKey)
    .expect(codeToBe1)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns code 1 if data is not a JSON', function(done) {
    api.post(commentsEndPointFor(padID))
    .field('apikey', apiKey)
    .field('data', 'not a JSON')
    .expect(codeToBe1)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns code 4 if API key is missing', function(done) {
    api.post(commentsEndPointFor(padID))
    .field('data', commentsData())
    .expect(codeToBe4)
    .expect('Content-Type', /json/)
    .expect(401, done)
  });

  it('returns code 4 if API key is wrong', function(done) {
    api.post(commentsEndPointFor(padID))
    .field('apikey', 'wrongApiKey')
    .field('data', commentsData())
    .expect(codeToBe4)
    .expect('Content-Type', /json/)
    .expect(401, done)
  });

  it('returns code 0 when comment is successfully added', function(done) {
    api.post(commentsEndPointFor(padID))
    .field('apikey', apiKey)
    .field('data', commentsData())
    .expect(codeToBe0)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns comment ids when comment is successfully added', function(done) {
    var twoComments = commentsData([commentData(), commentData()]);
    api.post(commentsEndPointFor(padID))
    .field('apikey', apiKey)
    .field('data', twoComments)
    .expect(function(res){
      if(res.body.commentIds === undefined) throw new Error("Response should have commentIds.");
      if(res.body.commentIds.length !== 2) throw new Error("Response should have two comment ids.");
    })
    .end(done)
  });

  context('when pad already have comments', function() {
    it('returns only the new comment ids', function(done) {
      createComment(padID, {}, function(err, touch) {
        var twoComments = commentsData([commentData(), commentData()]);
        api.post(commentsEndPointFor(padID))
        .field('apikey', apiKey)
        .field('data', twoComments)
        .expect(function(res) {
          if(res.body.commentIds === undefined) throw new Error("Response should have commentIds.");
          if(res.body.commentIds.length !== 2) throw new Error("Response should have two comment ids.");
        })
        .end(done)
      });
    });
  });
})

describe('create comment API broadcast', function(){
  var padID;
  var timesMessageWasReceived;

  // NOTE: this hook will timeout if you don't run your Etherpad in
  // loadTest mode. Be sure to adjust your settings.json when running
  // this test suite
  beforeEach(function(done){
    timesMessageWasReceived = 0;

    //create a new pad before each test run...
    padID = createPad(function(err, pad) {
      // ... and listens to the broadcast message:
      var socket = io.connect(appUrl + "/comment");
      var req = { padId: pad };
      // needs to get comments to be able to join the pad room, where the messages will be broadcast to:
      socket.emit('getComments', req, function (res){
        socket.on('pushAddComment', function(data) {
          ++timesMessageWasReceived;
        });

        done();
      });
    });
  });

  it('broadcasts comment creation to other clients of same pad', function(done) {
    // create first comment...
    createComment(padID,{}, function(err, commentId) {
      if(err) throw err;
      if(!commentId) throw new Error("Comment should had been created");

      // ... create second comment...
      createComment(padID,{}, function(err, commentId) {
        if(err) throw err;
        if(!commentId) throw new Error("Comment should had been created");

        // ... then check if both messages were received
        setTimeout(function() { //give it some time to process the messages on the client
          if(timesMessageWasReceived !== 2) throw new Error("Message should had been received");
          done();
        }, 100);
      });
    });
  });

  it('does not broadcast comment creation to clients of different pad', function(done) {
    // creates another pad...
    createPad(function(err, otherPadId) {
      // ... and add comment to it:
      createComment(otherPadId, {}, function(err, commentId) {
        if(err) throw err;
        if(!commentId) throw new Error("Comment should had been created");

        setTimeout(function() { //give it some time to process the message on the client
          if(timesMessageWasReceived !== 0) throw new Error("Message should had been received only for pad " + padID);
          done();
        }, 100);
      });
    });
  });

})

var listCommentsEndPointFor = function(padID, apiKey) {
  var extraParams = "";
  if (apiKey) {
    extraParams = "?apikey=" + apiKey;
  }
  return commentsEndPointFor(padID) + extraParams;
}

var commentsData = function(comments) {
  if (!comments) comments = [commentData()];

  return JSON.stringify(comments);
}

var commentData = function() {
  return { name: 'The Author', text: 'The Comment Text' };
}