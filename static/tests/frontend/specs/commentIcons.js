describe('ep_comments_page - Comment icons', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var LINE_WITH_COMMENT = 0;
  var LINE_WITH_ANOTHER_COMMENT = 1;
  var commentId, anotherCommentId;

  before(function(done) {
    utils.createPad(this, function() {
      if (helper.padOuter$('#commentIcons').length === 0) {
        done('Comment icons are disabled, cannot test icons feature. '
          + 'Please enable it on settings.json by adding the config: '
          + '"ep_comments_page": { "displayCommentAsIcon": true }');
      }

      utils.addCommentToLine(LINE_WITH_COMMENT, 'One comment', function() {
        commentId = utils.getCommentIdOfLine(LINE_WITH_COMMENT);

        utils.addCommentToLine(LINE_WITH_ANOTHER_COMMENT, 'Another comment', function() {
          anotherCommentId = utils.getCommentIdOfLine(LINE_WITH_ANOTHER_COMMENT);
          done();
        });
      });
    });

    this.timeout(60000);
  });

  after(function() {
    // undo frame resize that was done on before()
    utils.resetScreenSize();
  });

  it('adds a comment icon on the same height of commented text', function(done) {
    var $commentIcon = helper.padOuter$('#commentIcons #icon-' + commentId);

    // check icon exists
    expect($commentIcon.length).to.be(1);

    // check height is the same
    var $commentedText = helper.padInner$('.' + commentId);
    var expectedTop = $commentedText.offset().top + 5; // all icons are +5px down to adjust position
    expect($commentIcon.offset().top).to.be(expectedTop);

    done();
  });

  context('when commented text is removed', function() {
    before(function() {
      var $commentedLine = helper.padInner$('div .comment').first().parent();
      $commentedLine.sendkeys('{selectall}'); // select all
      $commentedLine.sendkeys('{del}'); // clear the line
    });

    after(function() {
      utils.undo();
    });

    it('does not show comment icon', function(done) {
      helper.waitFor(function() {
        // check icon is not visible
        var $commentIcons = helper.padOuter$('#commentIcons #icon-' + commentId + ':visible');
        return $commentIcons.length === 0;
      }).done(done);
    });
  });

  context('when comment is deleted', function() {
    before(function(done) {
      apiUtils.simulateCallToDeleteComment(commentId);

      helper.waitFor(function() {
        return utils.getCommentIdOfLine(LINE_WITH_COMMENT) === null;
      }).done(done);
    });

    after(function() {
      utils.undo();
    });

    it('does not show comment icon', function(done) {
      // check icon is not visible
      var $commentIcons = helper.padOuter$('#commentIcons #icon-' + commentId + ':visible');
      expect($commentIcons.length).to.be(0);

      done();
    });
  });

  context('when commented text is moved to another line', function() {
    before(function(done) {
      // adds some new lines on the beginning of the text
      var $firstTextElement = helper.padInner$('div').first();
      $firstTextElement.sendkeys('{selectall}{leftarrow}{enter}{enter}');

      // wait until the new lines are split into separated .ace-line's
      helper.waitFor(function() {
        return helper.padInner$('div').length > 2;
      }).done(function() {
        // wait until comment is visible again
        helper.waitFor(function() {
          var $commentIcons = helper.padOuter$('#commentIcons .comment-icon:visible');
          return $commentIcons.length !== 0;
        }).done(done);
      });
    });

    after(function() {
      utils.undo();
    });

    it('updates comment icon height', function(done) {
      // check height is the same
      var $commentIcon = helper.padOuter$('#commentIcons #icon-' + commentId);
      var $commentedText = helper.padInner$('.' + commentId);
      var expectedTop = $commentedText.offset().top + 5; // all icons are +5px down to adjust position
      expect($commentIcon.offset().top).to.be(expectedTop);

      done();
    });
  });

  context('when user clicks on comment icon - api - activate comment', function() {
    before(function() {
      clickOnCommentIcon(commentId);
    });

    it('sends the comment id on the API', function(done) {
      var activatedComment = apiUtils.getLastActivatedComment();
      expect(activatedComment).to.be(commentId);
      done();
    });

    context('and user clicks again on the icon', function() {
      before(function() {
        clickOnCommentIcon(commentId);
      });
      after(function() {
        // activate comment again, as on before() we've deactivated it
        clickOnCommentIcon(commentId);
      });

      it('sends an undefined comment id on the API', function(done) {
        var activatedComment = apiUtils.getLastActivatedComment();
        expect(activatedComment).to.be(undefined);
        done();
      });
    });

    context('and user clicks outside of comment box', function() {
      before(function() {
        helper.padOuter$('#outerdocbody').click();
      });
      after(function() {
        // activate comment again, as on before() we've deactivated it
        clickOnCommentIcon(commentId);
      });

      it('sends an undefined comment id on the API', function(done) {
        var activatedComment = apiUtils.getLastActivatedComment();
        expect(activatedComment).to.be(undefined);
        done();
      });
    });

    context('and user clicks on another comment icon', function() {
      before(function() {
        clickOnCommentIcon(anotherCommentId);
      });
      after(function() {
        // activate original comment again, as on before() we've deactivated it
        clickOnCommentIcon(commentId);
      });

      it('sends the id of the last comment clicked on the API', function(done) {
        var activatedComment = apiUtils.getLastActivatedComment();
        expect(activatedComment).to.be(anotherCommentId);
        done();
      });
    });
  });

  var clickOnCommentIcon = function(commentId) {
    var $commentIcon = helper.padOuter$('#commentIcons #icon-' + commentId).first();
    $commentIcon.click();
  }
});
