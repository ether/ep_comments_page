describe('ep_comments_page - api - delete comment', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var COMMENT_LINE = 0;

  before(function(done) {
    utils.createPad(this, function() {
      utils.addCommentToLine(COMMENT_LINE, 'I will be deleted', done);
    });
    this.timeout(60000);
  });

  it('removes the comment from pad when message is received by API', function(done) {
    var commentId = utils.getCommentIdOfLine(COMMENT_LINE);
    apiUtils.simulateCallToDeleteComment(commentId);

    helper.waitFor(function() {
      return utils.getCommentIdOfLine(COMMENT_LINE) === null;
    }).done(done);
  });
});
