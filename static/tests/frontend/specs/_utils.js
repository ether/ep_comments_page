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

    self.pressShortcutToAddCommentToLine(line, function() {
      // wait for form to be displayed
      var $commentForm = outer$('#newComment');
      helper.waitFor(function() {
        return $commentForm.is(':visible');
      }).done(function() {
        // fill the comment form and submit it
        var $commentField = $commentForm.find('textarea.comment-content');
        $commentField.val(textOfComment);
        var $submittButton = $commentForm.find('input[type=submit]');
        $submittButton.click();

        // wait until comment is created and comment id is set
        self.waitForCommentToBeCreatedOnLine(line, done);
      });
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

  // store data into a simple object, indexed by format
  _createMockedClipboard: function() {
    return {
      data: {},
      setData: function(format, value) {
        this.data[format] = value;
      },
      getData: function(format) {
        return this.data[format];
      }
    };
  },

  copySelection: function() {
    this.clipboardData = this.clipboardData || this._createMockedClipboard();
    this._triggerEvent('copy');
  },

  pasteOnLine: function(line, done) {
    var event = this._triggerEvent('paste');

    // as we can't trigger the paste on browser(chrome) natively using execCommand, we firstly trigger
    // the event and then insert the html.
    this.placeCaretOnLine(line, function() {
      var copiedHTML = event.originalEvent.clipboardData.getData('text/html');
      helper.padInner$.document.execCommand('insertHTML', false, copiedHTML);
      done();
    });
  },

  _triggerEvent: function(eventName) {
    var event = jQuery.Event(eventName);
    event.originalEvent = { clipboardData: this.clipboardData };

    // Hack: we need to use the same jQuery instance that is registering the main window,
    // so we use 'chrome$(inner$('div')[0])' instead of simply 'inner$('div)'
    helper.padChrome$(helper.padInner$('div')[0]).trigger(event);

    return event;
  },

  // from https://stackoverflow.com/a/22480938/7884942
  isVisibleOnViewport: function(el) {
    var elemTop = el.getBoundingClientRect().top;
    var elemBottom = el.getBoundingClientRect().bottom;

    var isVisible = (elemTop >= 0) && (elemBottom <= helper.padOuter$.window.innerHeight);
    return isVisible;
  },

  getCloseButton: function(modalSelector) {
    var $modal = helper.padOuter$('.ui-dialog:has(' + modalSelector + ')');
    var $closeButton = $modal.find('.ui-dialog-titlebar-close');
    return $closeButton;
  },

  closeModal: function(modalSelector, done) {
    var utils = ep_comments_page_test_helper.utils;
    var $closeButton = utils.getCloseButton(modalSelector);
    $closeButton.click();

    var $modal = helper.padOuter$('.ui-dialog:has(' + modalSelector + ')');
    helper.waitFor(function() {
      return !$modal.is(':visible');
    }).done(done);
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
    ep_script_elements_test_helper.utils.placeCaretAtTheEndOfLine(lineNum, done);
  },

  getLineWhereCaretIs: function() {
    var inner$ = helper.padInner$;
    var nodeWhereCaretIs = inner$.document.getSelection().anchorNode;
    var $lineWhereCaretIs = $(nodeWhereCaretIs).closest("div");
    return $lineWhereCaretIs;
  },
  getSelectedText: function() {
    return helper.padInner$.document.getSelection().toString();
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
