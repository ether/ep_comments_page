'use strict';

describe('ep_comments_page - Pre-comment text mark', function () {
  let padId;

  // create a new pad before each test run
  beforeEach(function (cb) {
    padId = helper.newPad(() => {
      createPadWithTwoLines(() => {
        selectLineAndOpenCommentForm(0, cb);
      });
    });
    this.timeout(60000);
  });

  it('marks selected text when New Comment form is opened', function (done) {
    if (textHighlightIsDisabled()) {
      return done();
    }
    const inner$ = helper.padInner$;

    // verify if text was marked with pre-comment class
    const $preCommentTextMarked = inner$('.pre-selected-comment');
    expect($preCommentTextMarked.length).to.be(1);
    expect($preCommentTextMarked.text()).to.be('Line 1');

    done();
  });

  context('when user reloads pad', function () {
    beforeEach(function (cb) {
      this.timeout(20000);

      // wait for changes to be saved as a revision before reloading the pad, otherwise
      // it won't have the text that we created on beforeEach after reload
      setTimeout(() => {
        helper.newPad(cb, padId);
      }, 5000);
    });

    it('does not have any marked text after pad is fully loaded', function (done) {
      if (textHighlightIsDisabled()) {
        return done();
      }
      const inner$ = helper.padInner$;

      // it takes some time for marks to be removed, so wait for it
      helper.waitFor(() => {
        const $preCommentTextMarked = inner$('.pre-selected-comment');
        return $preCommentTextMarked.length === 0;
      }).done(done);
    });
  });

  context('when user performs UNDO operation', function () {
    beforeEach(function (cb) {
      this.timeout(20000);

      // wait for changes to be saved as a revision and reload pad, otherwise
      // UNDO will remove the text that we created on beforeEach
      setTimeout(() => {
        helper.newPad(cb, padId);
      }, 5000);
    });

    it('keeps marked text', function (done) {
      if (textHighlightIsDisabled()) {
        return done();
      }
      const chrome$ = helper.padChrome$;
      const inner$ = helper.padInner$;

      // marks text
      selectLineAndOpenCommentForm(0, () => {
        // perform UNDO
        const $undoButton = chrome$('.buttonicon-undo');
        $undoButton.click();

        // verify if text was marked with pre-comment class
        const $preCommentTextMarked = inner$('.pre-selected-comment');
        expect($preCommentTextMarked.length).to.be(1);
        expect($preCommentTextMarked.text()).to.be('Line 1');

        done();
      });
    });
  });

  context('when user changes selected text', function () {
    beforeEach(function (cb) {
      const inner$ = helper.padInner$;

      // select second line of text
      const $secondLine = inner$('div').first().next();
      $secondLine.sendkeys('{selectall}');

      cb();
    });

    it('keeps marked text', function (done) {
      if (textHighlightIsDisabled()) {
        return done();
      }
      const inner$ = helper.padInner$;

      // verify if text was marked with pre-comment class
      const $preCommentTextMarked = inner$('.pre-selected-comment');
      expect($preCommentTextMarked.length).to.be(1);
      expect($preCommentTextMarked.text()).to.be('Line 1');

      done();
    });
  });

  context('when user closes the New Comment form', function () {
    beforeEach(function (cb) {
      const outer$ = helper.padOuter$;

      const $cancelButton = outer$('#comment-reset');
      $cancelButton.click();

      cb();
    });

    it('unmarks text', function (done) {
      if (textHighlightIsDisabled()) {
        return done();
      }
      const inner$ = helper.padInner$;

      // verify if there is no text marked with pre-comment class
      const $preCommentTextMarked = inner$('.pre-selected-comment');
      expect($preCommentTextMarked.length).to.be(0);

      done();
    });
  });

  context('when user submits the comment', function () {
    beforeEach(function (cb) {
      const outer$ = helper.padOuter$;
      const chrome$ = helper.padChrome$;

      // fill the comment form and submit it
      const $commentField = chrome$('textarea.comment-content');
      $commentField.val('My comment');
      const $hasSuggestion = outer$('.suggestion-checkbox');
      $hasSuggestion.click();
      const $suggestionField = outer$('textarea.to-value');
      $suggestionField.val('Change to this suggestion');
      const $submittButton = chrome$('.comment-buttons input[type=submit]');
      $submittButton.click();

      // wait until comment is created and comment id is set
      helper.waitFor(() => getCommentId() != null).done(cb);
    });

    it('unmarks text', function (done) {
      if (textHighlightIsDisabled()) {
        return done();
      }
      const inner$ = helper.padInner$;

      // verify if there is no text marked with pre-comment class
      const $preCommentTextMarked = inner$('.pre-selected-comment');
      expect($preCommentTextMarked.length).to.be(0);

      done();
    });
  });

  context('when user selects another text range and opens New Comment form for it', function () {
    beforeEach(function (cb) {
      selectLineAndOpenCommentForm(1, cb);
    });

    it('changes the marked text', function (done) {
      if (textHighlightIsDisabled()) {
        return done();
      }
      const inner$ = helper.padInner$;

      // verify if text was marked with pre-comment class
      const $preCommentTextMarked = inner$('.pre-selected-comment');
      expect($preCommentTextMarked.length).to.be(1);
      expect($preCommentTextMarked.text()).to.be('Line 2');

      done();
    });
  });

  /* ********** Helper functions ********** */
  const createPadWithTwoLines = (callback) => {
    const inner$ = helper.padInner$;

    // replace the first text element of pad with two lines
    const $firstLine = inner$('div').first();
    $firstLine.html('Line 1<br/>Line 2<br/>');

    // wait until the two lines are split into two divs
    helper.waitFor(() => {
      const $secondLine = inner$('div').first().next();
      return $secondLine.text() === 'Line 2';
    }).done(callback);
  };

  const selectLineAndOpenCommentForm = (lineNumber, callback) => {
    const chrome$ = helper.padChrome$;

    // select first line to add comment to
    const $targetLine = getLine(lineNumber);
    $targetLine.sendkeys('{selectall}');

    // get the comment button and click it
    const $commentButton = chrome$('.addComment');
    $commentButton.click();

    callback();
  };

  const getCommentId = () => {
    const inner$ = helper.padInner$;
    const comment = inner$('.comment').first();
    const cls = comment.attr('class');
    const classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    const commentId = (classCommentId) ? classCommentId[1] : null;

    return commentId;
  };

  const getLine = (lineNumber) => {
    const inner$ = helper.padInner$;
    let line = inner$('div').first();
    for (let i = lineNumber - 1; i >= 0; i--) {
      line = line.next();
    }
    return line;
  };

  const textHighlightIsDisabled = () => !helper.padChrome$.window.clientVars.highlightSelectedText;
});
