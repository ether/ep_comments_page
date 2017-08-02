describe('ep_comments_page - api - "data changed" event', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var textOfFirstCreatedComment = 'I was created first';
  var textOfLastCreatedComment = 'I was created later';

  before(function (done) {
    utils.createPad(this, done);
  });

  context('when user creates a comment', function() {
    before(function(done) {
      utils.addCommentToLine(1, textOfFirstCreatedComment, done);
    });

    it('sends the data of created comment', function(done) {
      var comments = apiUtils.getLastDataSent();

      expect(comments.length).to.be(1);
      expect(comments[0].text).to.be(textOfFirstCreatedComment);
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
          expect(comments[0].text).to.be(textOfFirstCreatedComment);

          done();
        });
      });
    });

    context('and user creates another comment before the first one', function() {
      before(function(done) {
        utils.addCommentToLine(0, textOfLastCreatedComment, done);
      });

      it('sends the comments on the order they appear on the pad text', function(done) {
        var comments = apiUtils.getLastDataSent();

        expect(comments.length).to.be(2);
        expect(comments[0].text).to.be(textOfLastCreatedComment);
        expect(comments[1].text).to.be(textOfFirstCreatedComment);

        done();
      });
    });
  });
});
