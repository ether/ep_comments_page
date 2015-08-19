describe("Comment Localization", function(){
  //create a new pad with comment before each test run
  beforeEach(function(cb){
    helper.newPad(function() {
      createComment(function() {
        // ensure we start on the default language
        changeEtherpadLanguageTo('en', cb)
      });
    });
    this.timeout(60000);
  });

  // ensure we go back to English to avoid breaking other tests:
  after(function(cb){
    changeEtherpadLanguageTo('en', cb);
  });

  it("uses default values when language was not localized yet", function(done) {
    changeEtherpadLanguageTo('oc', function(){
      var chrome$ = helper.padChrome$;
      var outer$ = helper.padOuter$;
      var commentId = getCommentId();

      //get the title of the comment
      var $changeToLabel = outer$(".comment-changeTo-label").first();
      expect($changeToLabel.text()).to.be("Suggested Change:");

      done();
    });
  });

  it("localizes comment when Etherpad language is changed", function(done) {
    changeEtherpadLanguageTo('pt-br', function(){
      var chrome$ = helper.padChrome$;
      var outer$ = helper.padOuter$;
      var commentId = getCommentId();

      //get the 'Suggested Change' label
      var $changeToLabel = outer$("#" + commentId + " .comment-changeTo-label").first();
      expect($changeToLabel.text()).to.be("Alteração Sugerida:");

      done();
    });
  });

  it("localizes 'new comment' form when Etherpad language is changed", function(done) {
    // make sure form was created before changing the language
    var inner$ = helper.padInner$;
    var outer$ = helper.padOuter$;
    var chrome$ = helper.padChrome$;

    // get the first text element out of the inner iframe
    var $firstTextElement = inner$("div").first();

    // get the comment button and click it
    $firstTextElement.sendkeys('{selectall}'); // needs to select content to add comment to
    var $commentButton = chrome$(".addComment");
    $commentButton.click();

    changeEtherpadLanguageTo('pt-br', function(){
      //get the 'Include suggested change' label
      var $changeToLabel = outer$('#newComment label[for=suggestion-checkbox]').first();
      expect($changeToLabel.text()).to.be("Incluir alteração sugerida");

      done();
    });
  });

  /* ********** Helper functions ********** */

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

  var changeEtherpadLanguageTo = function(lang, callback) {
    var boldTitles = {
      'en' : 'Bold (Ctrl+B)',
      'pt-br' : 'Negrito (Ctrl-B)',
      'oc' : 'Gras (Ctrl-B)'
    };
    var chrome$ = helper.padChrome$;

    //click on the settings button to make settings visible
    var $settingsButton = chrome$(".buttonicon-settings");
    $settingsButton.click();

    //select the language
    var $language = chrome$("#languagemenu");
    $language.val(lang);
    $language.change();

    // hide settings again
    $settingsButton.click();

    helper.waitFor(function() {
      return chrome$(".buttonicon-bold").parent()[0]["title"] == boldTitles[lang];
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
