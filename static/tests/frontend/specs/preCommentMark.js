describe('ep_comments_page - Pre-comment text mark', function() {
  var utils = ep_comments_page_test_helper.utils;
  var firstLineText, secondLineText;

  before(function(done) {
    utils.createPad(this, function() {
      firstLineText = utils.getLine(0).text();
      secondLineText = utils.getLine(1).text();

      selectLineAndOpenCommentForm(0, done);
    });
  });

  it('marks selected text when New Comment form is opened', function(done) {
    var inner$ = helper.padInner$;

    // verify if text was marked with pre-comment class
    var $preCommentTextMarked = inner$('.pre-selected-comment');
    expect($preCommentTextMarked.length).to.be(1);
    expect($preCommentTextMarked.text()).to.be(firstLineText);

    done();
  });

  context('when user reloads pad', function() {
    before(function(done) {
      this.timeout(10000);

      // wait for changes to be saved as a revision before reloading the pad, otherwise
      // it won't have the text that we created on before after reload
      var test = this;
      setTimeout(function() {
        utils.reloadPad(test, done);
      }, 1000);
    });

    it('does not have any marked text after pad is fully loaded', function(done) {
      var inner$ = helper.padInner$;

      // it takes some time for marks to be removed, so wait for it
      helper.waitFor(function() {
        var $preCommentTextMarked = inner$('.pre-selected-comment');
        return $preCommentTextMarked.length === 0;
      }).done(done);
    });
  });

  context('when user performs UNDO operation', function() {
    before(function(done) {
      this.timeout(10000);

      // wait for changes to be saved as a revision and reload pad, otherwise
      // UNDO will remove the text that we created on before
      var test = this;
      setTimeout(function() {
        utils.reloadPad(test, done);
      }, 1000);
    });

    it('keeps marked text', function(done) {
      var chrome$ = helper.padChrome$;
      var inner$ = helper.padInner$;

      // marks text
      selectLineAndOpenCommentForm(0, function() {
        // perform UNDO
        var $undoButton = chrome$('.buttonicon-undo');
        $undoButton.click();

        // verify if text was marked with pre-comment class
        var $preCommentTextMarked = inner$('.pre-selected-comment');
        expect($preCommentTextMarked.length).to.be(1);
        expect($preCommentTextMarked.text()).to.be(firstLineText);

        done();
      });
    });
  });

  context('when user changes selected text', function() {
    before(function(done) {
      var inner$ = helper.padInner$;

      // select second line of text
      var $secondLine = inner$('div').first().next();
      $secondLine.sendkeys('{selectall}');

      done();
    });

    it('keeps marked text', function(done) {
      var inner$ = helper.padInner$;

      // verify if text was marked with pre-comment class
      var $preCommentTextMarked = inner$('.pre-selected-comment');
      expect($preCommentTextMarked.length).to.be(1);
      expect($preCommentTextMarked.text()).to.be(firstLineText);

      done();
    });
  });

  context('when user closes the New Comment form', function() {
    before(function(done) {
      var outer$ = helper.padOuter$;

      helper.waitFor(function() {
        return outer$('.ui-dialog-titlebar-close').length > 0;
      }).done(function() {
        var $closeButton = outer$('.ui-dialog-titlebar-close');
        $closeButton.click();

        done();
      });
    });

    it('unmarks text', function(done) {
      var inner$ = helper.padInner$;

      // it takes some time for marks to be removed, so wait for it
      helper.waitFor(function() {
        var $preCommentTextMarked = inner$('.pre-selected-comment');
        return $preCommentTextMarked.length === 0;
      }).done(done);
    });
  });

  context('when user submits the comment', function() {
    before(function(done) {
      var outer$ = helper.padOuter$;
      var inner$ = helper.padInner$;

      // fill the comment form and submit it
      var $commentField = outer$('textarea.comment-content');
      $commentField.val('My comment');
      var $submittButton = outer$('input[type=submit]');
      $submittButton.click();

      // wait until comment is created and comment id is set
      helper.waitFor(function() {
        return inner$('.comment').length > 0;
      }).done(done);
    });

    it('unmarks text', function(done) {
      var inner$ = helper.padInner$;

      // verify if there is no text marked with pre-comment class
      var $preCommentTextMarked = inner$('.pre-selected-comment');
      expect($preCommentTextMarked.length).to.be(0);

      done();
    });
  });

  context('when user selects another text range and opens New Comment form for it', function() {
    before(function(done) {
      selectLineAndOpenCommentForm(1, done);
    });

    it('changes the marked text', function(done) {
      var inner$ = helper.padInner$;

      // verify if text was marked with pre-comment class
      var $preCommentTextMarked = inner$('.pre-selected-comment');
      expect($preCommentTextMarked.length).to.be(1);
      expect($preCommentTextMarked.text()).to.be(secondLineText);

      done();
    });
  });

  /* ********** Helper functions ********** */
  var selectLineAndOpenCommentForm = function(lineNumber, callback) {
    var inner$ = helper.padInner$;
    var chrome$ = helper.padChrome$;

    // select first line to add comment to
    var $targetLine = utils.getLine(lineNumber);
    $targetLine.sendkeys('{selectall}');

    // get the comment button and click it
    var $commentButton = chrome$('.addComment');
    $commentButton.click();

    callback();
  }

});
