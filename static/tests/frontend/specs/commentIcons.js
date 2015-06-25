describe("Comment icons", function() {
  //create a new pad with comment before each test run
  beforeEach(function(cb){
    helper.newPad(function() {
      // make sure Etherpad has enough space to display comment icons
      enlargeScreen(function() {
        // force sidebar comments to be shown
        chooseToShowComments(true, function() {
          createComment(cb);
        });
      });
    });
    this.timeout(60000);
  });

  after(function(cb) {
    // undo frame resize that was done on before()
    $('#iframe-container iframe').css("max-width", "");
    cb();
  });

  it("adds a comment icon on the same height of commented text", function(done) {
    // we only run test if icons are enabled
    finishTestIfIconsAreNotEnabled(done, function(){
      var inner$ = helper.padInner$;
      var outer$ = helper.padOuter$;
      var commentId = getCommentId();
      var $commentIcon = outer$("#commentIcons #icon-"+commentId);

      // check icon exists
      expect($commentIcon.length).to.be(1);

      // check height is the same
      var $commentedText = inner$("."+commentId);
      var expectedTop = $commentedText.offset().top + 5; // all icons are +5px down to adjust position
      expect($commentIcon.offset().top).to.be(expectedTop);

      done();
    });
  });

  it("does not show comment icon when commented text is removed", function(done) {
    // we only run test if icons are enabled
    finishTestIfIconsAreNotEnabled(done, function(){
      var inner$ = helper.padInner$;
      var outer$ = helper.padOuter$;

      // remove commented text
      var $commentedLine = inner$("div .comment").parent();
      $commentedLine.sendkeys('{selectall}'); // select all
      $commentedLine.sendkeys('{del}'); // clear the first line
      // wait until comment deletion is done
      helper.waitFor(function() {
        // check icon is not visible
        var $commentIcons = outer$("#commentIcons .comment-icon:visible");
        return $commentIcons.length === 0;
      })
      .done(done);
    });
  });

  it("does not show comment icon when comment is deleted", function(done) {
    // we only run test if icons are enabled
    finishTestIfIconsAreNotEnabled(done, function(){
      var inner$ = helper.padInner$;
      var outer$ = helper.padOuter$;

      deleteComment(function() {
        // check icon is not visible
        var $commentIcons = outer$("#commentIcons .comment-icon:visible");
        expect($commentIcons.length).to.be(0);

        done();
      });
    });
  });

  it("updates comment icon height when commented text is moved to another line", function(done) {
    // we only run test if icons are enabled
    finishTestIfIconsAreNotEnabled(done, function(){
      var inner$ = helper.padInner$;
      var outer$ = helper.padOuter$;
      var commentId = getCommentId();

      // adds some new lines on the beginning of the text
      var $firstTextElement = inner$("div").first();
      $firstTextElement.sendkeys('{leftarrow}{enter}{enter}');

      // wait until the new lines are split into separated .ace-line's
      helper.waitFor(function() {
        return inner$("div").length > 2;
      })
      .done(function() {
        // wait until comment is visible again
        helper.waitFor(function() {
          var $commentIcons = outer$("#commentIcons .comment-icon:visible");
          return $commentIcons.length !== 0;
        })
        .done(function() {
          // check height is the same
          var $commentIcon = outer$("#commentIcons #icon-"+commentId);
          var $commentedText = inner$("."+commentId);
          var expectedTop = $commentedText.offset().top + 5; // all icons are +5px down to adjust position
          expect($commentIcon.offset().top).to.be(expectedTop);

          done();
        });
      });
    });
  });

  it("shows comment when user clicks on comment icon", function(done) {
    // we only run test if icons are enabled
    finishTestIfIconsAreNotEnabled(done, function(){
      var outer$ = helper.padOuter$;
      var commentId = getCommentId();

      // click on the icon
      var $commentIcon = outer$("#commentIcons #icon-"+commentId).first();
      $commentIcon.click();

      // check sidebar comment is visible
      var $openedSidebarComments = outer$("#comments .sidebar-comment:visible");
      expect($openedSidebarComments.length).to.be(1);

      done();
    });
  });

  it("hides comment when user clicks on comment icon twice", function(done) {
    // we only run test if icons are enabled
    finishTestIfIconsAreNotEnabled(done, function(){
      var outer$ = helper.padOuter$;
      var commentId = getCommentId();

      // click on the icon to open, then click again to close
      var $commentIcon = outer$("#commentIcons #icon-"+commentId).first();
      $commentIcon.click();
      $commentIcon.click();

      // check sidebar comment is not visible
      var $openedSidebarComments = outer$("#comments .sidebar-comment:visible");
      expect($openedSidebarComments.length).to.be(0);

      done();
    });
  });

  it("hides comment when user clicks outside of comment box", function(done) {
    // we only run test if icons are enabled
    finishTestIfIconsAreNotEnabled(done, function(){
      var outer$ = helper.padOuter$;
      var commentId = getCommentId();

      // click on the icon to open
      var $commentIcon = outer$("#commentIcons #icon-"+commentId).first();
      $commentIcon.click();

      // click outside the comment to hide it
      outer$("#outerdocbody").click();

      // check sidebar comment is not visible
      var $openedSidebarComments = outer$("#comments .sidebar-comment:visible");
      expect($openedSidebarComments.length).to.be(0);

      done();
    });
  });

  it("hides first comment and shows second comment when user clicks on one icon then on another icon", function(done) {
    // we only run test if icons are enabled
    finishTestIfIconsAreNotEnabled(done, function(){
      var inner$ = helper.padInner$;
      var outer$ = helper.padOuter$;

      // add a second line...
      var $lastTextElement = inner$("div").last();
      $lastTextElement.sendkeys('Second line{enter}');

      // wait until the new line is split into a separated .ace-line
      helper.waitFor(function() {
        return inner$("div").length > 2;
      })
      .done(function() {
        // ... then add a comment to second line
        var $secondLine = inner$("div").eq(1);
        $secondLine.sendkeys('{selectall}');
        addComment("Second Comment", function() {
          // click on the icon of first comment...
          var $firstCommentIcon = outer$("#commentIcons #icon-"+getCommentId(0)).first();
          $firstCommentIcon.click();
          // ... then click on the icon of last comment
          var $secondCommentIcon = outer$("#commentIcons #icon-"+getCommentId(1)).first();
          $secondCommentIcon.click();

          // check modal is visible
          var $commentText = outer$("#comments .sidebar-comment:visible .comment-text").text();
          expect($commentText).to.be("Second Comment");

          done();

        });
      });
    });
  });

  /* ********** Helper functions ********** */

  var createComment = function(callback) {
    var inner$ = helper.padInner$;

    // get the first text element out of the inner iframe
    var $firstTextElement = inner$("div").first();

    // simulate key presses to delete content
    $firstTextElement.sendkeys('{selectall}'); // select all
    $firstTextElement.sendkeys('{del}'); // clear the first line
    $firstTextElement.sendkeys('This content will receive a comment{enter}'); // insert text
    // wait until the two lines are split into two .ace-line's
    helper.waitFor(function() {
      return inner$("div").length > 1;
    })
    .done(function() {
      // add comment to last line of the text
      var $lastTextElement = inner$("div").first();
      $lastTextElement.sendkeys('{selectall}'); // need to select content to add comment to

      addComment("My comment", callback);
    });
  }

  // Assumes text is already selected, then add comment to the selected text
  var addComment = function(commentText, callback) {
    var inner$ = helper.padInner$;
    var outer$ = helper.padOuter$;
    var chrome$ = helper.padChrome$;

    // get original number of comments, so can check if a new comment was created
    var numberOfComments = inner$(".comment:visible").length;

    // get the comment button and click it
    var $commentButton = chrome$(".addComment");
    $commentButton.click();

    // fill the comment form and submit it
    var $commentField = outer$("textarea.comment-content");
    $commentField.val(commentText);
    // we don't need comment suggestion to be filled for these tests, but here's how to do it:
    // var $hasSuggestion = outer$("#suggestion-checkbox");
    // $hasSuggestion.click();
    // var $suggestionField = outer$("textarea.comment-suggest-to");
    // $suggestionField.val("Change to this suggestion");
    var $submittButton = outer$("input[type=submit]");
    $submittButton.click();

    // wait until comment is created and comment id is set
    helper.waitFor(function() {
      return getCommentId(numberOfComments) !== null;
    })
    .done(callback);
  }

  var deleteComment = function(callback) {
    var chrome$ = helper.padChrome$;
    var outer$ = helper.padOuter$;

    // click on the delete button
    var $deleteButton = outer$(".comment-delete");
    $deleteButton.click();

    helper.waitFor(function() {
      return chrome$(".sidebar-comment").is(":visible") === false;
    })
    .done(callback);
  }


  var getCommentId = function(numberOfComments) {
    var nthComment = numberOfComments || 0;
    var inner$ = helper.padInner$;
    var comment = inner$(".comment").eq(nthComment);
    var cls = comment.attr('class');
    var classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    var commentId = (classCommentId) ? classCommentId[1] : null;

    return commentId;
  }

  var finishTestIfIconsAreNotEnabled = function(done, theTest) {
    // #commentIcons will only be inserted if icons are enabled
    if (helper.padOuter$("#commentIcons").length === 0) done();
    else theTest(done);
  }

  var chooseToShowComments = function(shouldShowComments, callback) {
    var chrome$ = helper.padChrome$;

    //click on the settings button to make settings visible
    var $settingsButton = chrome$(".buttonicon-settings");
    $settingsButton.click();

    //check "Show Comments"
    var $showComments = chrome$('#options-comments')
    if ($showComments.is(':checked') !== shouldShowComments) $showComments.click();

    // hide settings again
    $settingsButton.click();

    callback();
  }

  var enlargeScreen = function(callback) {
    $('#iframe-container iframe').css("max-width", "1000px");
    callback();
  }

});