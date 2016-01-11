describe("Pre-comment text mark", function() {
  var padId;

  //create a new pad before each test run
  beforeEach(function(cb){
    padId = helper.newPad(function() {
      // can only run this suite if text highlight is enabled
      if (textHighlightIsDisabled()) {
        throw new Error("Cannot test pre-comment text mark. Feature disabled. Please change your settings.json");
      }

      createPadWithTwoLines(function() {
        selectLineAndOpenCommentForm(0, cb);
      });
    });
    this.timeout(60000);
  });

  it("marks selected text when New Comment form is opened", function(done) {
    var inner$ = helper.padInner$;

    // verify if text was marked with pre-comment class
    var $preCommentTextMarked = inner$(".pre-selected-comment");
    expect($preCommentTextMarked.length).to.be(1);
    expect($preCommentTextMarked.text()).to.be("Line 1");

    done();
  });

  context("when user reloads pad", function() {
    beforeEach(function(cb) {
      this.timeout(5000);

      // wait for changes to be saved as a revision before reloading the pad, otherwise
      // it won't have the text that we created on beforeEach after reload
      setTimeout(function() {
        helper.newPad(cb, padId);
      }, 1000);
    });

    it("does not have any marked text after pad is fully loaded", function(done) {
      var inner$ = helper.padInner$;

      // it takes some time for marks to be removed, so wait for it
      helper.waitFor(function() {
        var $preCommentTextMarked = inner$(".pre-selected-comment");
        return $preCommentTextMarked.length === 0;
      }).done(done);
    });
  });

  context("when user performs UNDO operation", function() {
    beforeEach(function(cb) {
      this.timeout(5000);

      // wait for changes to be saved as a revision and reload pad, otherwise
      // UNDO will remove the text that we created on beforeEach
      setTimeout(function() {
        helper.newPad(cb, padId);
      }, 1000);
    });

    it("keeps marked text", function(done) {
      var chrome$ = helper.padChrome$;
      var inner$ = helper.padInner$;

      // marks text
      selectLineAndOpenCommentForm(0, function() {
        // perform UNDO
        var $undoButton = chrome$(".buttonicon-undo");
        $undoButton.click();

        // verify if text was marked with pre-comment class
        var $preCommentTextMarked = inner$(".pre-selected-comment");
        expect($preCommentTextMarked.length).to.be(1);
        expect($preCommentTextMarked.text()).to.be("Line 1");

        done();
      });
    });
  });

  context("when user changes selected text", function() {
    beforeEach(function(cb) {
      var inner$ = helper.padInner$;

      // select second line of text
      var $secondLine = inner$("div").first().next();
      $secondLine.sendkeys("{selectall}");

      cb();
    });

    it("keeps marked text", function(done) {
      var inner$ = helper.padInner$;

      // verify if text was marked with pre-comment class
      var $preCommentTextMarked = inner$(".pre-selected-comment");
      expect($preCommentTextMarked.length).to.be(1);
      expect($preCommentTextMarked.text()).to.be("Line 1");

      done();
    });
  });

  context("when user closes the New Comment form", function() {
    beforeEach(function(cb) {
      var outer$ = helper.padOuter$;

      var $cancelButton = outer$("#comment-reset");
      $cancelButton.click();

      cb();
    });

    it("unmarks text", function(done) {
      var inner$ = helper.padInner$;

      // verify if there is no text marked with pre-comment class
      var $preCommentTextMarked = inner$(".pre-selected-comment");
      expect($preCommentTextMarked.length).to.be(0);

      done();
    });
  });

  context("when user submits the comment", function() {
    beforeEach(function(cb) {
      var outer$ = helper.padOuter$;

      // fill the comment form and submit it
      var $commentField = outer$("textarea.comment-content");
      $commentField.val("My comment");
      var $hasSuggestion = outer$("#suggestion-checkbox");
      $hasSuggestion.click();
      var $suggestionField = outer$("textarea.comment-suggest-to");
      $suggestionField.val("Change to this suggestion");
      var $submittButton = outer$("input[type=submit]");
      $submittButton.click();

      // wait until comment is created and comment id is set
      helper.waitFor(function() {
        return getCommentId() !== null;
      }).done(cb);
    });

    it("unmarks text", function(done) {
      var inner$ = helper.padInner$;

      // verify if there is no text marked with pre-comment class
      var $preCommentTextMarked = inner$(".pre-selected-comment");
      expect($preCommentTextMarked.length).to.be(0);

      done();
    });
  });

  context("when user selects another text range and opens New Comment form for it", function() {
    beforeEach(function(cb) {
      selectLineAndOpenCommentForm(1, cb);
    });

    it("changes the marked text", function(done) {
      var inner$ = helper.padInner$;

      // verify if text was marked with pre-comment class
      var $preCommentTextMarked = inner$(".pre-selected-comment");
      expect($preCommentTextMarked.length).to.be(1);
      expect($preCommentTextMarked.text()).to.be("Line 2");

      done();
    });
  });

  /* ********** Helper functions ********** */
  var createPadWithTwoLines = function(callback) {
    var inner$ = helper.padInner$;

    // replace the first text element of pad with two lines
    var $firstLine = inner$("div").first();
    $firstLine.html("Line 1<br/>Line 2<br/>");

    // wait until the two lines are split into two divs
    helper.waitFor(function() {
      var $secondLine = inner$("div").first().next();
      return $secondLine.text() === "Line 2";
    }).done(callback);
  }

  var selectLineAndOpenCommentForm = function(lineNumber, callback) {
    var inner$ = helper.padInner$;
    var chrome$ = helper.padChrome$;

    // select first line to add comment to
    var $targetLine = getLine(lineNumber);
    $targetLine.sendkeys("{selectall}");

    // get the comment button and click it
    var $commentButton = chrome$(".addComment");
    $commentButton.click();

    callback();
  }

  var getCommentId = function() {
    var inner$ = helper.padInner$;
    var comment = inner$(".comment").first();
    var cls = comment.attr('class');
    var classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    var commentId = (classCommentId) ? classCommentId[1] : null;

    return commentId;
  }

  var getLine = function(lineNumber) {
    var inner$ = helper.padInner$;
    var line = inner$("div").first();
    for (var i = lineNumber - 1; i >= 0; i--) {
      line = line.next();
    }
    return line;
  }

  var textHighlightIsDisabled = function() {
    return !helper.padChrome$.window.clientVars.highlightSelectedText;
  }

});