describe('ep_comments_page - api - delete reply', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var COMMENT_LINE = 0;
  var textOfReplyNotRemoved = 'I will NOT be deleted';

  before(function(done) {
    utils.createPad(this, function() {
      utils.addCommentToLine(COMMENT_LINE, 'My reply will be deleted', function() {
        var commentId = utils.getCommentIdOfLine(COMMENT_LINE);
        apiUtils.simulateCallToCreateReply(commentId, textOfReplyNotRemoved);
        apiUtils.simulateCallToCreateReply(commentId, 'I will be deleted');

        // wait for reply to be created
        helper.waitFor(function() {
          var comments = apiUtils.getLastDataSent() || [{ replies:[] }];
          var replies = comments[0].replies;
          return replies.length === 2;
        }).done(done);
      });
    });
    this.timeout(60000);
  });

  context('when reply is deleted via API', function() {
    before(function() {
      // delete last reply
      var comments = apiUtils.getLastDataSent();
      var reply = comments[0].replies[1];

      apiUtils.resetData();
      apiUtils.simulateCallToDeleteReply(reply.replyId, reply.commentId);
    });

    it('sends the data without the deleted reply', function(done) {
      apiUtils.waitForDataToBeSent(function() {
        var comments = apiUtils.getLastDataSent();
        var replies = comments[0].replies;

        // check if the reply was deleted
        expect(replies.length).to.be(1);

        // check if the reply deleted was the correct one
        expect(replies[0].text).to.be(textOfReplyNotRemoved);

        done();
      });
    });

    context('and user reloads the pad', function() {
      before(function(done) {
        apiUtils.resetData();
        utils.reloadPad(this, done);
      });

      it('sends the data without the deleted reply', function(done) {
        apiUtils.waitForDataToBeSent(function() {
          var comments = apiUtils.getLastDataSent();
          var replies = comments[0].replies;
          expect(replies.length).to.be(1);
          expect(replies[0].text).to.be(textOfReplyNotRemoved);
          done();
        });
      });
    });

    context('and there is no reply left for comment', function() {
      before(function() {
        // delete the other reply
        var comments = apiUtils.getLastDataSent();
        var reply = comments[0].replies[0];

        apiUtils.resetData();
        apiUtils.simulateCallToDeleteReply(reply.replyId, reply.commentId);
      });


      it('changes the comment icon to have no replies', function(done) {
        apiUtils.waitForDataToBeSent(function() {
          var comment = apiUtils.getLastDataSent()[0];
          var $commentIcon = helper.padOuter$('#commentIcons #icon-' + comment.commentId);

          expect($commentIcon.hasClass('withReply')).to.be(false);

          done();
        });
      });
    });
  });
});
