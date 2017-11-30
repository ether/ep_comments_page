describe('ep_comments_page - api - edit comment', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var COMMENT_LINE = 0;
  var ORIGINAL_COMMENT_TEXT = 'I will be edited';
  var EDITED_COMMENT_TEXT = 'I was changed';

  var originalCommentData;

  before(function (done) {
    utils.createPad(this, function() {
      utils.addCommentToLine(COMMENT_LINE, ORIGINAL_COMMENT_TEXT, function() {
        apiUtils.waitForDataToBeSent(function() {
          var comments = apiUtils.getLastDataSent();
          originalCommentData = comments[0];

          apiUtils.resetData();
          apiUtils.simulateCallToEditComment(originalCommentData.commentId, EDITED_COMMENT_TEXT);
          done();
        });
      });
    });
  });

  it('sends the comment data with the new text', function(done) {
    apiUtils.waitForDataToBeSent(function() {
      var comments = apiUtils.getLastDataSent();
      expect(comments.length).to.be(1);
      expect(comments[0].text).to.be(EDITED_COMMENT_TEXT);
      done();
    });
  });

  it('does not change the other values of the comment', function(done) {
    apiUtils.waitForDataToBeSent(function() {
      var editedCommentData = apiUtils.getLastDataSent()[0];

      expect(editedCommentData.author).to.be(originalCommentData.author);
      expect(editedCommentData.commentId).to.be(originalCommentData.commentId);
      expect(editedCommentData.name).to.be(originalCommentData.name);
      expect(editedCommentData.timestamp).to.be(originalCommentData.timestamp);

      done();
    });
  });
});
