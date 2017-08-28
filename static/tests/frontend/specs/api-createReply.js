describe('ep_comments_page - api - create comment reply', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var COMMENT_TEXT = 'I am the original comment';
  var REPLY_TEXT = 'I am the reply';

  var commentId;

  before(function (done) {
    utils.createPad(this, function() {
      utils.addCommentToLine(0, COMMENT_TEXT, function() {
        commentId = utils.getCommentIdOfLine(0);
        apiUtils.waitForDataToBeSent(function() {
          apiUtils.resetData();
          apiUtils.simulateCallToCreateReply(commentId, REPLY_TEXT);
          done();
        });
      });
    });
  });

  it('sends the reply data inside its comment data', function(done) {
    apiUtils.waitForDataToBeSent(function() {
      var comments = apiUtils.getLastDataSent();
      expect(comments.length).to.be(1);
      expect(apiUtils.getNumberOfRepliesOfComment(commentId)).to.be(1);

      var reply = apiUtils.getReplyDataOnPosition(0, commentId);
      expect(reply.text).to.be(REPLY_TEXT);

      done();
    });
  });

  it('sets the other reply values', function(done) {
    apiUtils.waitForDataToBeSent(function() {
      var reply = apiUtils.getReplyDataOnPosition(0, commentId);

      expect(reply.author).to.not.be(undefined);
      expect(reply.name).to.not.be(undefined);
      expect(reply.timestamp).to.not.be(undefined);
      expect(reply.replyId).to.not.be(undefined);

      done();
    });
  });

  it('changes the comment icon to have replies', function(done) {
    apiUtils.waitForDataToBeSent(function() {
      var $commentIcon = helper.padOuter$('#commentIcons #icon-' + commentId);
      expect($commentIcon.hasClass('withReply')).to.be(true);
      done();
    });
  });
});
