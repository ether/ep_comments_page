describe("Comment settings", function() {
  describe("when user unchecks 'Show Comments'", function() {
    // create a new pad and check "Show Comments" checkbox
    before(function(cb){
      helper.newPad(function() {
        chooseToShowComments(false, cb);
      });
      this.timeout(60000);
    });

    it("sidebar comments should not be visible when opening a new pad", function(done) {
      // force to create a new pad, so validation would be on brand new pads
      helper.newPad(function() {
        var outer$ = helper.padOuter$;
        expect(outer$.find("#comments:visible").length).to.be(0);
        done();
      });
    });

    it("sidebar comments should not be visible when adding a new comment to a new pad", function(done) {
      // force to create a new pad, so validation would be on brand new pads
      helper.newPad(function() {
        createComment(function() {
          var inner$ = helper.padInner$;
          var outer$ = helper.padOuter$;
          var chrome$ = helper.padChrome$;

          // get the first text element out of the inner iframe
          var $firstTextElement = inner$("div").first();
          $firstTextElement.sendkeys('{selectall}'); // needs to select content to add comment to

          // get the comment button and click it
          var $commentButton = chrome$(".addComment");
          $commentButton.click();

          expect(outer$.find("#comments:visible").length).to.be(0);
          done();
        });
      });
    });
  });

  /* ********** Helper functions ********** */

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

  var createComment = function(callback) {
    var inner$ = helper.padInner$;
    var outer$ = helper.padOuter$;
    var chrome$ = helper.padChrome$;

    // get the first text element out of the inner iframe
    var $firstTextElement = inner$("div").first();

    // simulate key presses to delete content
    $firstTextElement.sendkeys('{selectall}'); // select all
    $firstTextElement.sendkeys('{del}'); // clear the first line
    $firstTextElement.sendkeys('This content will receive a comment'); // insert text

    // get the comment button and click it
    $firstTextElement.sendkeys('{selectall}'); // needs to select content to add comment to
    var $commentButton = chrome$(".addComment");
    $commentButton.click();

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
     })
    .done(callback);
  }

  var getCommentId = function() {
    var inner$ = helper.padInner$;
    var comment = inner$(".comment").first();
    var cls = comment.attr('class');
    var classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    var commentId = (classCommentId) ? classCommentId[1] : null;

    return commentId;
  }
});