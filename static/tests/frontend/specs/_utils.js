var ep_comments_page_test_helper = ep_comments_page_test_helper || {};
ep_comments_page_test_helper.utils = {
  padId: undefined,

  undo: function() { ep_script_elements_test_helper.utils.undo() },
  redo: function() { ep_script_elements_test_helper.utils.redo() },

  _loadPad: function(test, done) {
    var self = this;

    test.timeout(60000);

    this.padId = helper.newPad(function() {
      ep_comments_page_test_helper.apiUtils.startListeningToApiEvents();
      self._enlargeScreen();
      self._chooseToShowComments();

      // wait for all helper libs to be loaded
      helper.waitFor(function() {
        return helper.padOuter$.window.scrollIntoView;
      }).done(done);
    }, this.padId);
  },

  createPad: function(test, done) {
    var self = this;
    this.padId = undefined;

    self._loadPad(test, function() {
      self._createOrResetPadText(done);
    });
  },

  reloadPad: function(test, done) {
    var self = this;
    setTimeout(function() {
      self._loadPad(test, done);
    }, 1000);
  },

  _createOrResetPadText: function(done) {
    var self = this;
    self._cleanPad(function() {
      self.getLine(0).html('something<br>anything');
      helper.waitFor(function() {
        var secondLineText = self.getLine(1).text();
        return secondLineText === 'anything';
      }, 2000).done(done);
    });
  },

  _cleanPad: function(done) {
    var inner$ = helper.padInner$;
    var $padContent = inner$('#innerdocbody');
    $padContent.html('');

    // wait for Etherpad to re-create first line
    helper.waitFor(function() {
      var lineNumber = inner$('div').length;
      return lineNumber === 1;
    }, 2000).done(done);
  },

  _enlargeScreen: function() {
    $('#iframe-container iframe').css('max-width', '3000px');
  },
  resetScreenSize: function() {
    $('#iframe-container iframe').css('max-width', '');
  },

  cleanText: function(text) {
    return text.replace(/\s/gi, ' ');
  },

  _chooseToShowComments: function() {
    var chrome$ = helper.padChrome$;

    // click on the settings button to make settings visible
    var $settingsButton = chrome$('.buttonicon-settings');
    $settingsButton.click();

    // check 'Show Comments'
    var $showComments = chrome$('#options-comments')
    if (!$showComments.is(':checked')) $showComments.click();

    // hide settings again
    $settingsButton.click();
  },

  clickOnCommentIcon: function(commentId) {
    var $commentIcon = helper.padOuter$('#commentIcons #icon-' + commentId).first();
    $commentIcon.click();
  },

  addCommentAndReplyToLine: function(line, textOfComment, textOfReply, done) {
    var self = this;
    this.addCommentToLine(line, textOfComment, function() {
      self.addCommentReplyToLine(line, textOfReply, done);
    });
  },

  addCommentToLine: function(line, textOfComment, done) {
    var self = this;
    var outer$ = helper.padOuter$;
    var chrome$ = helper.padChrome$;

    var $line = this.getLine(line);
    $line.sendkeys('{selectall}'); // needs to select content to add comment to
    var $commentButton = chrome$('.addComment');
    $commentButton.click();

    // wait for form to be displayed
    helper.waitFor(function() {
      return outer$('textarea:visible').length > 0;
    }).done(function() {
      // fill the comment form and submit it
      var $commentField = outer$('textarea.comment-content');
      $commentField.val(textOfComment);
      var $submittButton = outer$('input[type=submit]');
      $submittButton.click();

      // wait until comment is created and comment id is set
      self.waitForCommentToBeCreatedOnLine(line, done);
    });
  },

  addCommentReplyToLine: function(line, textOfReply, done) {
    var apiUtils = ep_comments_page_test_helper.apiUtils;

    var commentId = this.getCommentIdOfLine(line);
    var originalNumberOfRepliesOfComment = apiUtils.getNumberOfRepliesOfComment(commentId);
    apiUtils.simulateCallToCreateReply(commentId, textOfReply);

    // wait for the reply to be saved
    helper.waitFor(function() {
      var newNumberOfRepliesOfComment = apiUtils.getNumberOfRepliesOfComment(commentId);
      var replyWasCreated = newNumberOfRepliesOfComment === originalNumberOfRepliesOfComment + 1;
      return replyWasCreated;
    }).done(done);
  },

  getLine: function(lineNum) {
    return helper.padInner$('div:eq(' + lineNum + ')');
  },

  getBackgroundColorOf: function(commentId) {
    var $commentedText = helper.padInner$('.' + commentId);
    var style = helper.padInner$.window.getComputedStyle($commentedText.get(0), '');
    return style.getPropertyValue('background-color');
  },

  waitForCommentToBeCreatedOnLine: function(line, done) {
    var self = this;
    var apiUtils = ep_comments_page_test_helper.apiUtils;

    helper.waitFor(function() {
      var idOfCreatedComment = self.getCommentIdOfLine(line);
      var commentIdsSentOnAPI = (apiUtils.getLastDataSent() || []).map(function(commentData) {
        return commentData.commentId;
      });

      return idOfCreatedComment !== null && commentIdsSentOnAPI.includes(idOfCreatedComment);
    }).done(done);
  },

  getCommentDataOfLine: function(lineNumber) {
    var apiUtils = ep_comments_page_test_helper.apiUtils;

    var commentIdOfTargetLine = this.getCommentIdOfLine(lineNumber);
    var comments = apiUtils.getLastDataSent();
    var commentData = _(comments || []).find(function(commentData) {
      return commentData.commentId === commentIdOfTargetLine;
    });

    return commentData;
  },
  getCommentIdOfLine: function(lineNumber) {
    return this._getCommentOrReplyIdOfLine(lineNumber, /(?:^| )(c-[A-Za-z0-9]*)/);
  },
  getReplyIdOfLine: function(lineNumber) {
    return this._getCommentOrReplyIdOfLine(lineNumber, /(?:^| )(cr-[A-Za-z0-9]*)/);
  },
  _getCommentOrReplyIdOfLine: function(lineNumber, regex) {
    var $line = this.getLine(lineNumber);
    var commentOrReply = $line.find('.comment, .comment-reply');
    var cls = commentOrReply.attr('class');
    var classId = regex.exec(cls);
    var commentOrReplyId = (classId) ? classId[1] : null;

    return commentOrReplyId;
  },

  commentIconsEnabled: function() {
    return helper.padOuter$('#commentIcons').length > 0;
  },

  clickEditCommentButton: function () {
    var outer$ = helper.padOuter$;
    var $editButton = outer$('.comment-edit').first();
    $editButton.click();
  },

  clickEditCommentReplyButton: function () {
    var outer$ = helper.padOuter$;
    var $threeDots = outer$('.comment-options-button').last();
    $threeDots.click();
    var $editButton = outer$('.comment-edit').last();
    $editButton.click();
  },

  changeEtherpadLanguageTo: function(lang, callback) {
    var boldTitles = {
      'en' : 'Bold (Ctrl+B)',
      'pt-br' : 'Negrito (Ctrl-B)',
      'oc' : 'Gras (Ctrl-B)'
    };
    var chrome$ = helper.padChrome$;

    // click on the settings button to make settings visible
    var $settingsButton = chrome$('.buttonicon-settings');
    $settingsButton.click();

    // select the language
    var $language = chrome$('#languagemenu');
    $language.val(lang);
    $language.change();

    // hide settings again
    $settingsButton.click();

    helper.waitFor(function() {
      return chrome$('.buttonicon-bold').parent()[0]['title'] == boldTitles[lang];
    }).done(callback);
  },

  placeCaretOnLine: function(lineNum, done) {
    var self = this;
    var $targetLine = this.getLine(lineNum);
    $targetLine.sendkeys("{selectall}");

    helper.waitFor(function() {
     var $targetLine = self.getLine(lineNum);
     var $lineWhereCaretIs = self.getLineWhereCaretIs();

     return $targetLine.get(0) === $lineWhereCaretIs.get(0);
    }).done(done);
  },
  getLineWhereCaretIs: function() {
    var inner$ = helper.padInner$;
    var nodeWhereCaretIs = inner$.document.getSelection().anchorNode;
    var $lineWhereCaretIs = $(nodeWhereCaretIs).closest("div");
    return $lineWhereCaretIs;
  },

  C_KEY_CODE: 67, // shortcut is Cmd + Ctrl + C
  // based on similar method of smUtils
  pressShortcutToAddCommentToLine(line, done) {
    var self = this;
    var smUtils = ep_script_scene_marks_test_helper.utils;

    var bowser = helper.padInner$(window)[0].bowser;
    var os = bowser.mac ? 'mac' : 'windows';
    var modifierKeys = smUtils.shortcuts.KEYS_MODIFIER_ADD_SCENE_MARK[os];

    var $line = this.getLine(line);
    $line.sendkeys('{selectall}'); // needs to select content to add comment to

    setTimeout(function() {
      smUtils.shortcuts.pressKeyWithModifier(self.C_KEY_CODE, modifierKeys);
      done();
    }, 1000);
  },
}
