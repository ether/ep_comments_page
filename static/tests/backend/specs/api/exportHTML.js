var supertest = require('ep_etherpad-lite/node_modules/supertest'),
           fs = require('fs'),
         path = require('path'),
      request = require('request'),
        utils = require('../../../utils'),
       apiKey = utils.apiKey,
    codeToBe0 = utils.codeToBe0,
          api = utils.api,
   apiVersion = utils.apiVersion,
 randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;


describe('export comments to HTML', function(){
  var padID;
  var html;

  //create a new pad before each test run
  beforeEach(function(done){
    padID = randomString(5);

    createPad(padID, function() {
      setHTML(padID, html(), done);
    });
  });

  context('when pad text has one comment', function() {
    before(function() {
      html = function() {
        return buildHTML(textWithComment("c-1234"));
      }
    });

    it('returns ok', function(done) {
      api.get(getHTMLEndPointFor(padID))
      .expect(codeToBe0)
      .expect('Content-Type', /json/)
      .expect(200, done);
    });

    it('returns HTML with comment class', function(done) {
      api.get(getHTMLEndPointFor(padID))
      .expect(function(res){
        var expectedRegex = regexWithComment("c-1234");
        var expectedComments = new RegExp(expectedRegex);
        var html = res.body.data.html;
        var foundComment = html.match(expectedComments);
        if(!foundComment) throw new Error("Comment not exported. Regex used: " + expectedRegex + ", html exported: " + html);
      })
      .end(done);
    });
  });
  context('when pad text has two comments in a single line', function() {
    before(function() {
      html = function() {
        return buildHTML(textWithComment("c-1234") + textWithComment("c-82a3"));
      }
    });

    it('returns HTML with two comments spans', function(done) {
      api.get(getHTMLEndPointFor(padID))
      .expect(function(res){
        var firstComment = regexWithComment("c-1234");
        var secondComment = regexWithComment("c-82a3");
        var expectedRegex = firstComment + ".*" + secondComment;
        var expectedComments = new RegExp(expectedRegex);

        var html = res.body.data.html;
        var foundComment = html.match(expectedComments);
        if(!foundComment) throw new Error("Comment not exported. Regex used: " + expectedRegex + ", html exported: " + html);
      })
      .end(done);
    });
  });

  context('when pad text has no comments', function() {
    before(function() {
      html = function() {
        return buildHTML("empty pad");
      }
    });

    it('returns HTML with no comment', function(done) {
      api.get(getHTMLEndPointFor(padID))
      .expect(function(res){
        var expectedRegex = ".*empty pad.*";
        var noComment = new RegExp(expectedRegex);

        var html = res.body.data.html;
        var foundComment = html.match(noComment);
        if(!foundComment) throw new Error("Comment exported, should not have any. Regex used: " + expectedRegex + ", html exported: " + html);
      })
      .end(done);
    });
  });

  context('when pad text has comment inside strong', function() {
    before(function() {
      html = function() {
        return buildHTML("<strong>" + textWithComment("c-2342", "this is a comment and bold") + "</strong>");
      }
    });

    // Etherpad exports tags using the order they are defined on the array (bold is always inside comment)
    it('returns HTML with strong and comment, in any order', function(done) {
      api.get(getHTMLEndPointFor(padID))
      .expect(function(res){
        var strongInsideCommentRegex = regexWithComment("c-2342", "<strong>this is a comment and bold<\/strong>");
        var commentInsideStrongRegex = "<strong>" + regexWithComment("c-2342", "this is a comment and bold") + "<\/strong>";
        var expectedStrongInsideComment = new RegExp(strongInsideCommentRegex);
        var expectedCommentInsideStrong = new RegExp(commentInsideStrongRegex);

        var html = res.body.data.html;
        var foundComment = html.match(expectedStrongInsideComment) || html.match(expectedCommentInsideStrong);
        if(!foundComment) throw new Error("Comment not exported. Regex used: [" + strongInsideCommentRegex + " || " + commentInsideStrongRegex + "], html exported: " + html);
      })
      .end(done);
    });
  });

  context('when pad text has strong inside comment', function() {
    before(function() {
      html = function() {
        return buildHTML(textWithComment("c-2342", "<strong>this is a comment and bold</strong>"));
      }
    });

    // Etherpad exports tags using the order they are defined on the array (bold is always inside comment)
    it('returns HTML with strong and comment, in any order', function(done) {
      api.get(getHTMLEndPointFor(padID))
      .expect(function(res){
        var strongInsideCommentRegex = regexWithComment("c-2342", "<strong>this is a comment and bold<\/strong>");
        var commentInsideStrongRegex = "<strong>" + regexWithComment("c-2342", "this is a comment and bold") + "<\/strong>";
        var expectedStrongInsideComment = new RegExp(strongInsideCommentRegex);
        var expectedCommentInsideStrong = new RegExp(commentInsideStrongRegex);

        var html = res.body.data.html;
        var foundComment = html.match(expectedStrongInsideComment) || html.match(expectedCommentInsideStrong);
        if(!foundComment) throw new Error("Comment not exported. Regex used: [" + strongInsideCommentRegex + " || " + commentInsideStrongRegex + "], html exported: " + html);
      })
      .end(done);
    });
  });

  context('when pad text has part with comment and part without it', function() {
    before(function() {
      html = function() {
        return buildHTML("no comment here " + textWithComment("c-2342"));
      }
    });

    it('returns HTML with part with comment and part without it', function(done) {
      api.get(getHTMLEndPointFor(padID))
      .expect(function(res){
        var expectedRegex = "no comment here " + regexWithComment("c-2342");
        var expectedComments = new RegExp(expectedRegex);
        var html = res.body.data.html;
        var foundComment = html.match(expectedComments);
        if(!foundComment) throw new Error("Comment not exported. Regex used: " + expectedRegex + ", html exported: " + html);
      })
      .end(done);
    });
  });
})


// Creates a pad and returns the pad id. Calls the callback when finished.
var createPad = function(padID, callback) {
  api.get('/api/'+apiVersion+'/createPad?apikey='+apiKey+"&padID="+padID)
  .end(function(err, res){
    if(err || (res.body.code !== 0)) callback(new Error("Unable to create new Pad"));

    callback(padID);
  })
}

var setHTML = function(padID, html, callback) {
  api.get('/api/'+apiVersion+'/setHTML?apikey='+apiKey+"&padID="+padID+"&html="+html)
  .end(function(err, res){
    if(err || (res.body.code !== 0)) callback(new Error("Unable to set pad HTML"));

    callback(null, padID);
  })
}

var getHTMLEndPointFor = function(padID, callback) {
  return '/api/'+apiVersion+'/getHTML?apikey='+apiKey+"&padID="+padID;
}


var buildHTML = function(body) {
  return "<html><body>" + body + "</body></html>"
}

var textWithComment = function(commentId, text) {
  if (!text) text = "this is " + commentId;

  return "<span class='comment " + commentId + "'>" + text + "</span>";
}

var regexWithComment = function(commentID, text) {
  if (!text) text = "this is " + commentID;

  return "<span .*class=['|\"].*comment " + commentID + ".*['|\"].*>" + text + "<\/span>"
}

