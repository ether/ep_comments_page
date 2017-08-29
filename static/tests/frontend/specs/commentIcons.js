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
      }, 2000).done(done);
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
      helper.waitFor(function() {
        // check icon is not visible
        var $commentIcons = helper.padOuter$('#commentIcons #icon-' + commentId + ':visible');
        return $commentIcons.length === 0;
      }, 2000).done(done);
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

      // icon might take some time to go to the correct position
      helper.waitFor(function() {
        return $commentIcon.offset().top === expectedTop;
      }).done(done);
    });
  });

  context('when user clicks on comment icon', function() {
    var nonHighlighted;

    before(function(done) {
      // get original value for future comparison on the tests
      nonHighlighted = utils.getBackgroundColorOf(commentId);

      // place caret out of line with commented text
      ep_script_elements_test_helper.utils.placeCaretOnLine(LINE_WITH_ANOTHER_COMMENT, function() {
        utils.clickOnCommentIcon(commentId);
        done();
      });
    });

    it('sends the comment id on the API', function(done) {
      var activatedComment = apiUtils.getLastActivatedComment();
      expect(activatedComment).to.be(commentId);
      done();
    });

    it('places the caret at beginning of commented text', function(done) {
      var $lineWithComment = utils.getLine(LINE_WITH_COMMENT);
      var $lineWithCaret = ep_script_elements_test_helper.utils.getLineWhereCaretIs();

      expect($lineWithCaret.get(0)).to.be($lineWithComment.get(0));

      done();
    });

    it('highlights the comment on editor', function(done) {
      var commentTextStyle = utils.getBackgroundColorOf(commentId);
      expect(commentTextStyle).to.not.be(nonHighlighted);
      done();
    });

    context('and user clicks again on the icon', function() {
      before(function() {
        utils.clickOnCommentIcon(commentId);
      });
      after(function() {
        // activate comment again, as on before() we've deactivated it
        utils.clickOnCommentIcon(commentId);
      });

      it('sends an undefined comment id on the API', function(done) {
        var activatedComment = apiUtils.getLastActivatedComment();
        expect(activatedComment).to.be(undefined);
        done();
      });

      it('removes the highlight of the comment on editor', function(done) {
        var commentTextStyle = utils.getBackgroundColorOf(commentId);
        expect(commentTextStyle).to.be(nonHighlighted);
        done();
      });
    });

    context('and user clicks outside of comment box', function() {
      before(function() {
        helper.padOuter$('#outerdocbody').click();
      });
      after(function() {
        // activate comment again, as on before() we've deactivated it
        utils.clickOnCommentIcon(commentId);
      });

      it('sends an undefined comment id on the API', function(done) {
        var activatedComment = apiUtils.getLastActivatedComment();
        expect(activatedComment).to.be(undefined);
        done();
      });

      it('removes the highlight of the comment on editor', function(done) {
        var commentTextStyle = utils.getBackgroundColorOf(commentId);
        expect(commentTextStyle).to.be(nonHighlighted);
        done();
      });
    });

    context('and user clicks on another comment icon', function() {
      before(function() {
        utils.clickOnCommentIcon(anotherCommentId);
      });
      after(function() {
        // activate original comment again, as on before() we've deactivated it
        utils.clickOnCommentIcon(commentId);
      });

      it('sends the id of the last comment clicked on the API', function(done) {
        var activatedComment = apiUtils.getLastActivatedComment();
        expect(activatedComment).to.be(anotherCommentId);
        done();
      });

      it('removes the highlight of the comment on editor', function(done) {
        var commentTextStyle = utils.getBackgroundColorOf(commentId);
        expect(commentTextStyle).to.be(nonHighlighted);
        done();
      });
    });
  });
});
