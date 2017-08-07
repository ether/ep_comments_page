describe('ep_comments_page - api - activate comment', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var commentId;

  before(function(done) {
    utils.createPad(this, function() {
      utils.addCommentToLine(0, 'I will be activated', function() {
        utils.addCommentToLine(1, 'I will be activated too', done);
      });
    });
    this.timeout(60000);
  });

  context('when comment is not currently active', function() {
    before(function() {
      commentId = utils.getCommentIdOfLine(0);
      apiUtils.simulateCallToActivateComment(commentId);
    });

    it('activates comment icon', function(done) {
      var $commentIcon = helper.padOuter$('#commentIcons #icon-' + commentId).first();
      expect($commentIcon.is('.active')).to.be(true);
      done();
    });

    it('sends the comment id on the API', function(done) {
      var activatedComment = apiUtils.getLastActivatedComment();
      expect(activatedComment).to.be(commentId);
      done();
    });
  });

  context('when comment is currently active', function() {
    before(function(done) {
      commentId = utils.getCommentIdOfLine(1);
      apiUtils.resetData();
      utils.clickOnCommentIcon(commentId);
      // wait for previous line messages to be sent
      helper.waitFor(function() {
        return apiUtils.getLastActivatedComment() === commentId;
      }).done(function() {
        apiUtils.resetData();
        apiUtils.simulateCallToActivateComment(commentId);
        done();
      });
    });

    it('keeps comment icon active', function(done) {
      var $commentIcon = helper.padOuter$('#commentIcons #icon-' + commentId).first();
      expect($commentIcon.is('.active')).to.be(true);
      done();
    });

    it('does not send any new comment id on the API', function(done) {
      var activatedComment = apiUtils.getLastActivatedComment();
      expect(activatedComment).to.be(undefined);
      done();
    });
  });
});
