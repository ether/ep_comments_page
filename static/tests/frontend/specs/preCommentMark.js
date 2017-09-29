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

    // make sure we re-open the form for the following tests
    after(function(done) {
      selectLineAndOpenCommentForm(0, done);
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

    // make sure we re-open the form for the following tests
    after(function(done) {
      utils.undo(); // remove added comment
      selectLineAndOpenCommentForm(0, done);
    });

    it('unmarks text', function(done) {
      var inner$ = helper.padInner$;

      // verify if there is no text marked with pre-comment class
      var $preCommentTextMarked = inner$('.pre-selected-comment');
      expect($preCommentTextMarked.length).to.be(0);

      done();
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

  context('when user selects another text range and opens New Comment form for it', function() {
    before(function(done) {
      selectLineAndOpenCommentForm(1, done, true);
    });
    after(function(done) {
      selectLineAndOpenCommentForm(0, done);
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

  context('when user opens the form then performs UNDO operation', function() {
    before(function(done) {
      var test = this;
      this.timeout(10000);

      // wait for changes to be saved as a revision before reloading the pad, otherwise
      // it won't have the text that we created on before after reload
      setTimeout(function() {
        utils.reloadPad(test, function() {
          // make some changes on the pad
          utils.getLine(1).sendkeys(' -- changed! --');

          // marks text
          selectLineAndOpenCommentForm(0, function() {
            utils.undo();
            done();
          });
        });
      }, 1000);
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

  /* ********** Helper functions ********** */
  var selectLineAndOpenCommentForm = function(lineNumber, callback, doNotCloseOpenedForm) {
    var inner$ = helper.padInner$;
    var outer$ = helper.padOuter$;
    var chrome$ = helper.padChrome$;

    if (!doNotCloseOpenedForm) {
      // make sure for is closed before we start
      var $closeButton = outer$('.ui-dialog-titlebar-close');
      $closeButton.click();
    }

    // select first line to add comment to
    var $targetLine = utils.getLine(lineNumber);
    $targetLine.sendkeys('{selectall}');

    // get the comment button and click it
    var $commentButton = chrome$('.addComment');
    $commentButton.click();

    callback();
  }

});
