describe('ep_comments_page - api - activate comment', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var LINE_OF_COMMENT_NOT_ACTIVE = 0;
  var LINE_OF_COMMENT_ACTIVE = 1;
  var LINE_OF_COMMENT_OUT_OF_VIEWPORT = 50;
  var commentId;

  before(function(done) {
    utils.createPad(this, function() {
      // create some lines, including one far down the pad
      var oneLine = 'one line<br>';
      var severalLines = oneLine.repeat(51);
      utils.getLine(0).html(severalLines);
      helper.waitFor(function() {
        var severalLinesCreated = helper.padInner$('div').length > 50;
        return severalLinesCreated;
      }, 2000).done(function() {
        // add some comments to lines
        utils.addCommentToLine(LINE_OF_COMMENT_NOT_ACTIVE, 'I will be activated', function() {
          utils.addCommentToLine(LINE_OF_COMMENT_ACTIVE, 'I will be activated', function() {
            utils.addCommentToLine(LINE_OF_COMMENT_OUT_OF_VIEWPORT, 'I am really far down the pad', done);
          });
        });
      });
    });
    this.timeout(60000);
  });

  context('when comment is not currently active', function() {
    before(function() {
      commentId = utils.getCommentIdOfLine(LINE_OF_COMMENT_NOT_ACTIVE);
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

    context('but comment is out of viewport', function() {
      before(function() {
        // make sure comment is not visible on viewport
        helper.padOuter$('#outerdocbody').scrollTop(0);

        commentId = utils.getCommentIdOfLine(LINE_OF_COMMENT_OUT_OF_VIEWPORT);
        apiUtils.simulateCallToActivateComment(commentId);
      });

      it('scrolls editor to show comment icon', function(done) {
        var $commentIcon = helper.padOuter$('#commentIcons #icon-' + commentId).first();
        helper.waitFor(function() {
          return isVisibleOnViewport($commentIcon.get(0));
        }).done(done);
      });
    });
  });

  context('when comment is currently active', function() {
    before(function(done) {
      commentId = utils.getCommentIdOfLine(LINE_OF_COMMENT_ACTIVE);
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

  // from https://stackoverflow.com/a/22480938/7884942
  var isVisibleOnViewport = function(el) {
    var elemTop = el.getBoundingClientRect().top;
    var elemBottom = el.getBoundingClientRect().bottom;

    var isVisible = (elemTop >= 0) && (elemBottom <= helper.padOuter$.window.innerHeight);
    return isVisible;
  }
});
