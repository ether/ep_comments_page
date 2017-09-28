describe('ep_comments_page - api - edit reply', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var COMMENT_LINE = 0;
  var ORIGINAL_REPLY_TEXT = 'I will be edited';
  var EDITED_REPLY_TEXT = 'I was changed';

  var commentId;

  before(function (done) {
    utils.createPad(this, function() {
      utils.addCommentToLine(COMMENT_LINE, 'My reply will be edited', function() {
        commentId = utils.getCommentIdOfLine(COMMENT_LINE);
        apiUtils.simulateCallToCreateReply(commentId, ORIGINAL_REPLY_TEXT);
        // wait for reply to be created
        helper.waitFor(function() {
          return apiUtils.getNumberOfRepliesOfComment(commentId) === 1;
        }).done(function() {
          var reply = apiUtils.getReplyDataOnPosition(0, commentId);
          apiUtils.resetData();
          apiUtils.simulateCallToEditReply(reply.replyId, commentId, EDITED_REPLY_TEXT);
          done();
        });
      });
    });
  });

  it('sends the reply data with the new text', function(done) {
    apiUtils.waitForDataToBeSent(function() {
      var comments = apiUtils.getLastDataSent();

      expect(comments.length).to.be(1);
      expect(apiUtils.getNumberOfRepliesOfComment(commentId)).to.be(1);

      var reply = apiUtils.getReplyDataOnPosition(0, commentId);
      expect(reply.text).to.be(EDITED_REPLY_TEXT);

      done();
    });
  });
});
