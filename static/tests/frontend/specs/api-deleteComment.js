describe('ep_comments_page - api - delete comment', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var COMMENT_LINE = 0;
  var textOfCommentNotRemoved = 'I will NOT be removed';

  before(function(done) {
    utils.createPad(this, function() {
      utils.addCommentToLine(COMMENT_LINE, 'I will be deleted', function() {
        utils.addCommentToLine(COMMENT_LINE + 1, textOfCommentNotRemoved, done);
      });
    });
    this.timeout(60000);
  });

  context('when comment is deleted via API', function() {
    before(function() {
      apiUtils.resetData();
      var commentId = utils.getCommentIdOfLine(COMMENT_LINE);
      apiUtils.simulateCallToDeleteComment(commentId);
    });

    it('sends the data without the deleted comment', function(done) {
      apiUtils.waitForDataToBeSent(function() {
        var comments = apiUtils.getLastDataSent();
        expect(comments.length).to.be(1);
        expect(comments[0].text).to.be(textOfCommentNotRemoved);
        done();
      });
    });

    it('removes the comment from pad text', function(done) {
      helper.waitFor(function() {
        return utils.getCommentIdOfLine(COMMENT_LINE) === null;
      }).done(done);
    });

    context('and user reloads the pad', function() {
      before(function(done) {
        apiUtils.resetData();
        utils.reloadPad(this, done);
      });

      it('sends the data without the deleted comment', function(done) {
        apiUtils.waitForDataToBeSent(function() {
          var comments = apiUtils.getLastDataSent();
          expect(comments.length).to.be(1);
          expect(comments[0].text).to.be(textOfCommentNotRemoved);
          done();
        });
      });
    });
  });
});
