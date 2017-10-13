describe('ep_comments_page - api - delete comment', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var TARGET_COMMENT_LINE = 0;
  var TEXT_OF_TARGET_COMMENT = 'I will be deleted';
  var TEXT_OF_COMMENT_NOT_REMOVED = 'I will NOT be removed';
  var TEXT_OF_FIRST_REPLY = '1st reply';
  var TEXT_OF_SECOND_REPLY = '2nd reply';

  var commentId;

  var createTargetComment = function(done) {
    utils.addCommentToLine(TARGET_COMMENT_LINE, TEXT_OF_TARGET_COMMENT, function() {
      commentId = utils.getCommentIdOfLine(TARGET_COMMENT_LINE);
      createRepliesOfTargetComment(commentId, done);
    });
  }

  var createRepliesOfTargetComment = function(commentId, done) {
    apiUtils.simulateCallToCreateReply(commentId, TEXT_OF_FIRST_REPLY);
    apiUtils.simulateCallToCreateReply(commentId, TEXT_OF_SECOND_REPLY);

    helper.waitFor(function() {
      return apiUtils.getNumberOfRepliesOfComment(commentId) === 2;
    }).done(done);
  }

  before(function(done) {
    utils.createPad(this, function() {
      // create multiple tags on the line to have comment, so we can test the text selection
      // after the comment delete
      var $targetLine = utils.getLine(TARGET_COMMENT_LINE);
      helper.selectLines($targetLine, $targetLine, 1, 2);
      var $boldButton = helper.padChrome$('.buttonicon-bold');
      $boldButton.click();

      createTargetComment(function() {
        utils.addCommentToLine(TARGET_COMMENT_LINE + 1, TEXT_OF_COMMENT_NOT_REMOVED, done);
      });
    });
    this.timeout(60000);
  });

  context('when comment is deleted via API', function() {
    before(function() {
      apiUtils.resetData();
      apiUtils.simulateCallToDeleteComment(commentId);
    });

    it('sends the data without the deleted comment', function(done) {
      apiUtils.waitForDataToBeSent(function() {
        var comments = apiUtils.getLastDataSent();
        expect(comments.length).to.be(1);
        expect(comments[0].text).to.be(TEXT_OF_COMMENT_NOT_REMOVED);
        done();
      });
    });

    it('removes the comment from pad text', function(done) {
      helper.waitFor(function() {
        return utils.getCommentIdOfLine(TARGET_COMMENT_LINE) === null;
      }).done(done);
    });

    it('removes the associated replies from pad text', function(done) {
      helper.waitFor(function() {
        return utils.getReplyIdOfLine(TARGET_COMMENT_LINE) === null;
      }).done(done);
    });

    // this scenario also applies to other comment operations, like adding comment,
    // adding a reply, etc.
    it('selects the text originally commented', function(done) {
      var textWithOriginalComment = utils.getLine(TARGET_COMMENT_LINE).text();
      var selectedText = utils.getSelectedText();
      expect(selectedText).to.be(textWithOriginalComment);
      done();
    });

    context('and user reloads the pad', function() {
      before(function(done) {
        apiUtils.resetData();
        utils.reloadPad(this, done);
      });

      // re-create comment and call API to delete it, so we're back to the state before pad reload
      after(function(done) {
        createTargetComment(function() {
          apiUtils.simulateCallToDeleteComment(commentId);
          done();
        });
      });

      it('sends the data without the deleted comment', function(done) {
        apiUtils.waitForDataToBeSent(function() {
          var comments = apiUtils.getLastDataSent();
          expect(comments.length).to.be(1);
          expect(comments[0].text).to.be(TEXT_OF_COMMENT_NOT_REMOVED);
          done();
        });
      });
    });

    context('and user presses UNDO', function() {
      before(function(done) {
        // wait for delete to be completed before triggering the UNDO
        apiUtils.waitForDataToBeSent(function() {
          apiUtils.resetData();
          utils.undo();
          done();
        });
      });

      it('sends the data with the restored comment', function(done) {
        apiUtils.waitForDataToBeSent(function() {
          var comments = apiUtils.getLastDataSent();
          expect(comments.length).to.be(2);
          expect(comments[0].text).to.be(TEXT_OF_TARGET_COMMENT);
          done();
        });
      });

      it('sends the data with the restored replies', function(done) {
        apiUtils.waitForDataToBeSent(function() {
          expect(apiUtils.getNumberOfRepliesOfComment(commentId)).to.be(2);
          expect(apiUtils.getReplyDataOnPosition(0, commentId).text).to.be(TEXT_OF_FIRST_REPLY);
          expect(apiUtils.getReplyDataOnPosition(1, commentId).text).to.be(TEXT_OF_SECOND_REPLY);

          done();
        });
      });

      context('and user reloads the pad', function() {
        before(function(done) {
          apiUtils.resetData();
          utils.reloadPad(this, done);
        });

        // call API again to delete comment, so we're back to the state before pad reload
        after(function() {
          apiUtils.simulateCallToDeleteComment(commentId);
        });

        it('sends the data with the restored comment', function(done) {
          apiUtils.waitForDataToBeSent(function() {
            var comments = apiUtils.getLastDataSent();
            expect(comments.length).to.be(2);
            expect(comments[0].text).to.be(TEXT_OF_TARGET_COMMENT);
            done();
          });
        });

        it('sends the data with the restored replies', function(done) {
          apiUtils.waitForDataToBeSent(function() {
            expect(apiUtils.getNumberOfRepliesOfComment(commentId)).to.be(2);
            expect(apiUtils.getReplyDataOnPosition(0, commentId).text).to.be(TEXT_OF_FIRST_REPLY);
            expect(apiUtils.getReplyDataOnPosition(1, commentId).text).to.be(TEXT_OF_SECOND_REPLY);

            done();
          });
        });
      });
    });
  });
});
