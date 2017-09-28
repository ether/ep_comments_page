describe('ep_comments_page - Comment Localization', function() {
  var utils = ep_comments_page_test_helper.utils;

  before(function(done) {
    utils.createPad(this, function() {
      // ensure we start on the default language
      utils.changeEtherpadLanguageTo('en', done);
    });
    this.timeout(60000);
  });

  // ensure we go back to English to avoid breaking other tests:
  after(function(done) {
    utils.changeEtherpadLanguageTo('en', done);
  });

  it('uses default values when language was not localized yet', function(done) {
    utils.changeEtherpadLanguageTo('oc', function() {
      var $saveButton = helper.padOuter$('.comment-button--save').first();
      expect($saveButton.attr('value')).to.be('save');
      done();
    });
  });

  it('localizes New Comment form when Etherpad language is changed', function(done) {
    // make sure form was created before changing the language
    var inner$ = helper.padInner$;
    var outer$ = helper.padOuter$;
    var chrome$ = helper.padChrome$;

    // get the first text element out of the inner iframe
    var $firstTextElement = inner$('div').first();

    // get the comment button and click it
    $firstTextElement.sendkeys('{selectall}'); // needs to select content to add comment to
    var $commentButton = chrome$('.addComment');
    $commentButton.click();

    utils.changeEtherpadLanguageTo('pt-br', function() {
      var $saveButton = helper.padOuter$('.comment-button--save').first();
      expect($saveButton.attr('value')).to.be('salvar');
      done();
    });
  });
});
