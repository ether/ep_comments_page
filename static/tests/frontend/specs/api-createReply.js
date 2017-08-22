describe('ep_comments_page - api - create comment reply', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var COMMENT_TEXT = 'I am the original comment';
  var REPLY_TEXT = 'I am the reply';

  before(function (done) {
    utils.createPad(this, function() {
      utils.addCommentToLine(0, COMMENT_TEXT, function() {
        apiUtils.waitForDataToBeSent(function() {
          var comments = apiUtils.getLastDataSent();

          apiUtils.resetData();
          apiUtils.simulateCallToCreateReply(comments[0].commentId, REPLY_TEXT);
          done();
        });
      });
    });
  });

  it('sends the reply data inside its comment data', function(done) {
    apiUtils.waitForDataToBeSent(function() {
      var comments = apiUtils.getLastDataSent();
      expect(comments.length).to.be(1);
      expect(comments[0].replies.length).to.be(1);
      expect(comments[0].replies[0].text).to.be(REPLY_TEXT);

      done();
    });
  });

  it('sets the other reply values', function(done) {
    apiUtils.waitForDataToBeSent(function() {
      var comments = apiUtils.getLastDataSent();
      var reply = comments[0].replies[0];

      expect(reply.author).to.not.be(undefined);
      expect(reply.name).to.not.be(undefined);
      expect(reply.timestamp).to.not.be(undefined);
      expect(reply.replyId).to.not.be(undefined);

      done();
    });
  });

  it('changes the comment icon to have replies', function(done) {
    apiUtils.waitForDataToBeSent(function() {
      var comment = apiUtils.getLastDataSent()[0];
      var $commentIcon = helper.padOuter$('#commentIcons #icon-' + comment.commentId);

      expect($commentIcon.hasClass('withReply')).to.be(true);

      done();
    });
  });
});
