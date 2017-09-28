describe('ep_comments_page - api - delete reply', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var COMMENT_LINE = 0;
  var TEXT_OF_REPLY_TO_BE_REMOVED = 'I will be deleted';
  var TEXT_OF_REPLY_NOT_REMOVED = 'I will NOT be deleted';

  var commentId, targetReplyId, otherReplyId;

  var createTargetReply = function(done) {
    apiUtils.simulateCallToCreateReply(commentId, TEXT_OF_REPLY_TO_BE_REMOVED);

    // wait for reply to be created
    helper.waitFor(function() {
      return apiUtils.getNumberOfRepliesOfComment(commentId) === 2;
    }).done(function() {
      // get replies data
      otherReplyId = apiUtils.getReplyDataOnPosition(0, commentId).replyId;
      targetReplyId = apiUtils.getReplyDataOnPosition(1, commentId).replyId;
      done();
    });
  }

  before(function(done) {
    utils.createPad(this, function() {
      utils.addCommentToLine(COMMENT_LINE, 'My reply will be deleted', function() {
        commentId = utils.getCommentIdOfLine(COMMENT_LINE);
        apiUtils.simulateCallToCreateReply(commentId, TEXT_OF_REPLY_NOT_REMOVED);
        createTargetReply(done);
      });
    });
    this.timeout(60000);
  });

  context('when reply is deleted via API', function() {
    before(function() {
      apiUtils.resetData();
      apiUtils.simulateCallToDeleteReply(targetReplyId, commentId);
    });

    it('sends the data without the deleted reply', function(done) {
      apiUtils.waitForDataToBeSent(function() {
        // check if the reply was deleted
        expect(apiUtils.getNumberOfRepliesOfComment(commentId)).to.be(1);

        // check if the reply deleted was the correct one
        var reply = apiUtils.getReplyDataOnPosition(0, commentId);
        expect(reply.text).to.be(TEXT_OF_REPLY_NOT_REMOVED);

        done();
      });
    });

    context('and user presses UNDO', function() {
      before(function() {
        apiUtils.resetData();
        utils.undo();
      });

      it('sends the data with the restored reply', function(done) {
        apiUtils.waitForDataToBeSent(function() {
          // check if the reply was restored
          expect(apiUtils.getNumberOfRepliesOfComment(commentId)).to.be(2);

          // check if the reply was restored on the correct position
          var reply = apiUtils.getReplyDataOnPosition(1, commentId);
          expect(reply.text).to.be(TEXT_OF_REPLY_TO_BE_REMOVED);

          done();
        });
      });

      context('and user reloads the pad', function() {
        before(function(done) {
          apiUtils.resetData();
          utils.reloadPad(this, done);
        });

        // call API again to delete reply, so we're back to the state before pad reload
        after(function(done) {
          apiUtils.simulateCallToDeleteReply(targetReplyId, commentId);
          // make sure there was enough time to save changes
          setTimeout(done, 1000);
        });

        it('sends the data with the restored reply', function(done) {
          apiUtils.waitForDataToBeSent(function() {
            // check if the reply was restored
            expect(apiUtils.getNumberOfRepliesOfComment(commentId)).to.be(2);

            // check if the reply was restored on the correct position
            var reply = apiUtils.getReplyDataOnPosition(1, commentId);
            expect(reply.text).to.be(TEXT_OF_REPLY_TO_BE_REMOVED);

            done();
          });
        });
      });
    });

    context('and user reloads the pad', function() {
      before(function(done) {
        apiUtils.resetData();
        utils.reloadPad(this, done);
      });

      // re-create reply and call API to delete it, so we're back to the state before pad reload
      after(function(done) {
        createTargetReply(function() {
          apiUtils.simulateCallToDeleteReply(targetReplyId, commentId);
          done();
        });
      });

      it('sends the data without the deleted reply', function(done) {
        apiUtils.waitForDataToBeSent(function() {
          // check if the reply was deleted
          expect(apiUtils.getNumberOfRepliesOfComment(commentId)).to.be(1);

          // check if the reply deleted was the correct one
          var reply = apiUtils.getReplyDataOnPosition(0, commentId);
          expect(reply.text).to.be(TEXT_OF_REPLY_NOT_REMOVED);

          done();
        });
      });
    });

    context('and there is no reply left for comment', function() {
      before(function() {
        // delete the other reply
        apiUtils.resetData();
        apiUtils.simulateCallToDeleteReply(otherReplyId, commentId);
      });


      it('changes the comment icon to have no replies', function(done) {
        apiUtils.waitForDataToBeSent(function() {
          var $commentIcon = helper.padOuter$('#commentIcons #icon-' + commentId);
          expect($commentIcon.hasClass('withReply')).to.be(false);
          done();
        });
      });
    });
  });
});
