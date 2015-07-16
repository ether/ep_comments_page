describe("Comment Suggestion", function(){
  //create a new pad before each test run
  beforeEach(function(cb){
    helper.newPad(cb);
    this.timeout(60000);
  });

  it("Fills suggestion Change From field when adding a comment with suggestion", function(done) {
    var outer$ = helper.padOuter$;

    openCommentFormWithSuggestion('This content will receive a comment');

    var $suggestionFrom = outer$(".comment-suggest-from");
    expect($suggestionFrom.val()).to.be('This content will receive a comment\n');
    done();
  });

  it("Fills suggestion Change From field when canceling and trying again to add comment with suggestion", function(done) {
    var outer$ = helper.padOuter$;
    var chrome$ = helper.padChrome$;

    openCommentFormWithSuggestion('This content will receive a comment');

    // cancel
    var $cancelButton = outer$("#comment-reset");
    $cancelButton.click();

    // wait for comment form to close
    helper.waitFor(function() {
      return outer$('#newComments.active').length === 0;
    })
    .done(function() {
      openCommentFormWithSuggestion('New target for comment\n');

      var $suggestionFrom = outer$(".comment-suggest-from");
      expect($suggestionFrom.val()).to.be('New target for comment\n');
      done();
    });
  });

});

function openCommentFormWithSuggestion(targetText) {
  var inner$ = helper.padInner$;
  var outer$ = helper.padOuter$;
  var chrome$ = helper.padChrome$;

  // get the first text element out of the inner iframe
  var $firstTextElement = inner$("div").first();

  // simulate key presses to delete content
  $firstTextElement.sendkeys('{selectall}'); // select all
  $firstTextElement.sendkeys('{del}'); // clear the first line
  $firstTextElement.sendkeys(targetText); // insert text

  // get the comment button and click it
  $firstTextElement.sendkeys('{selectall}'); // needs to select content to add comment to
  var $commentButton = chrome$(".addComment");
  $commentButton.click();

  // check suggestion box
  var $hasSuggestion = outer$("#suggestion-checkbox");
  $hasSuggestion.click();
}
