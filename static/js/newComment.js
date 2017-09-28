var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var utils = require('./utils');
var dialog = require('./dialog');

var newCommentDialog;

// Insert a comment node
exports.createNewCommentForm = function(textMarker) {
  var $content = $('#newCommentTemplate').tmpl(utils.getUserInfo());
  var configs = {
    $content: $('#newCommentTemplate').tmpl(utils.getUserInfo()),
    dialogTitleL10nKey: 'ep_comments_page.comments_template.comment',
    textMarker: textMarker,
    onSubmit: submitNewComment,
  }
  newCommentDialog = dialog.create(configs);
};

// Callback for new comment Submit
var submitNewComment = function($form, callback) {
  var text = $form.find('.comment-content').val();
  var commentTextIsNotEmpty = text.length !== 0;
  if (commentTextIsNotEmpty) {
    hideNewCommentForm();
    callback(text);
  }
  return false;
}

exports.showNewCommentForm = function(comment, callback) {
  comment.commentId = "";

  // Reset form to make sure it is all clear
  var $newCommentForm = utils.getPadOuter().find('#newComment');
  $newCommentForm.get(0).reset();

  newCommentDialog.open(callback);
}

var hideNewCommentForm = function() {
  newCommentDialog.close();
}
