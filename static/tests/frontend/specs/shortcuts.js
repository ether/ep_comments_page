describe('ep_comments_page - Shortcuts', function() {
  var utils = ep_comments_page_test_helper.utils;

  before(function(done) {
    utils.createPad(this, done);
    this.timeout(60000);
  });

  it('opens dialog to add comment when user presses Cmd + Ctrl + C', function(done) {
    utils.pressShortcutToAddCommentToLine(0, function() {
      var $saveButton = helper.padOuter$('.comment-button--save').first();
      expect($saveButton.is(':visible')).to.be(true);
      done();
    });
  });

  context('when user submits the form', function() {
    before(function() {
      // fill the comment form and submit it
      var $commentField = helper.padOuter$('textarea.comment-content');
      $commentField.val('My comment');
      var $submittButton = helper.padOuter$('input[type=submit]');
      $submittButton.click();
    });

    it('saves the comment on original selection', function(done) {
      // wait until comment is created
      helper.waitFor(function() {
        return helper.padInner$('.comment').length > 0;
      }).done(function() {
        var firstLineText = utils.getLine(0).text();
        var $commentedText = helper.padInner$('.comment');
        expect($commentedText.text()).to.be(firstLineText);
        done();
      });
    });

    it('unmarks text', function(done) {
      var inner$ = helper.padInner$;

      // verify if there is no text marked with pre-comment class
      var $preCommentTextMarked = inner$('.pre-selected-comment');
      expect($preCommentTextMarked.length).to.be(0);

      done();
    });
  });
});
