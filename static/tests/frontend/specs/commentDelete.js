describe("Comment Delete", function(){
  //create a new pad with comment before each test run
  beforeEach(function(cb){
    helper.newPad(function() {
      createComment(function() {
        // ensure we can delete a comment
        cb();
      });
    });
    this.timeout(60000);
  });

  it("Ensures a comment can be deleted", function(done) {
    deleteComment(function(){
      var chrome$ = helper.padChrome$;
      var outer$ = helper.padOuter$;
      var commentId = getCommentId();
      expect(chrome$(".sidebar-comment").is(":visible")).to.be(false);
      done();
    });
  });

});

function createComment(callback) {
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

function deleteComment(callback){
  var chrome$ = helper.padChrome$;
  var outer$ = helper.padOuter$;

  //click on the settings button to make settings visible
  var $deleteButton = outer$(".comment-delete");
  $deleteButton.click();

  helper.waitFor(function() {
    return chrome$(".sidebar-comment").is(":visible") === false;
  })
  .done(callback);
}

function getCommentId() {
  var inner$ = helper.padInner$;
  var comment = inner$(".comment").first();
  var cls = comment.attr('class');
  var classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
  var commentId = (classCommentId) ? classCommentId[1] : null;

  return commentId;
}
