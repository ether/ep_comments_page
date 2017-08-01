describe('ep_comments_page - api - "data changed" event', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var textOfComment = 'original comment';
  var textOfReply = 'original reply';
  var FIRST_LINE = 0;

  before(function (done) {
    utils.createPad(this, done);
  });

  context('when user creates a comment', function() {
    before(function(done) {
      utils.addCommentToLine(FIRST_LINE, textOfComment, done);
    });

    it('sends the data of created comment', function(done) {
      var comments = apiUtils.getLastDataSent();

      expect(comments.length).to.be(1);
      expect(comments[0].text).to.be(textOfComment);
      expect(comments[0].author).to.not.be(undefined);
      expect(comments[0].commentId).to.not.be(undefined);
      expect(comments[0].name).to.not.be(undefined);
      expect(comments[0].timestamp).to.not.be(undefined);

      done();
    });

    context('and user reloads the pad', function() {
      before(function(done) {
        apiUtils.resetData();
        utils.reloadPad(this, done);
      });

      it('sends the data of existing comment when pad finishes loading', function(done) {
        apiUtils.waitForDataToBeSent(function() {
          var comments = apiUtils.getLastDataSent();

          expect(comments.length).to.be(1);
          expect(comments[0].text).to.be(textOfComment);

          done();
        });
      });
    });
  });
});
