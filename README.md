[![Publish Status](https://github.com/ether/ep_comments_page/workflows/Node.js%20Package/badge.svg)](https://github.com/ether/ep_comments_page/actions/workflows/test-and-release.yml)
[![Backend Tests Status](https://github.com/ether/ep_comments_page/actions/workflows/test-and-release.yml/badge.svg)](https://github.com/ether/ep_comments_page/actions/workflows/test-and-release.yml)

# Comments and annotations for Etherpad

![Screen shot](https://user-images.githubusercontent.com/220864/98013526-617ff900-1df2-11eb-88b6-cf259372f6ca.PNG)

## Installing this plugin with npm.
```
pnpm run plugins install ep_comments_page
```

## Extra settings
This plugin has some extra features that can be enabled by changing values on `settings.json` of your Etherpad instance.

### Alternative comment display
There is an alternative way to display comments. Instead of having all comments visible on the right of the page, you can have just an icon on the right margin of the page. Comment details are displayed when user clicks on the comment icon:

![Screen shot](http://i.imgur.com/cEo7PdL.png)

To use this way of displaying comments, add the following to your `settings.json`:
```
// Display comments as icons, not boxes
"ep_comments_page": {
  "displayCommentAsIcon": true
},
```

### Highlight selected text when creating a comment
It is also possible to mark the text originally selected when user adds a comment:
![Screen shot](http://i.imgur.com/AhaVgRZ.png)

To enable this feature, add the following code to your `settings.json`:
```
// Highlight selected text when adding comment
"ep_comments_page": {
  "highlightSelectedText": true
},
```

**Warning**: there is a side effect when you enable this feature: a revision is created everytime the text is highlighted, resulting on apparently "empty" changes when you check your pad on the timeslider. If that is an issue for you, we don't recommend you to use this feature.

### Disable HTML export
By default comments are exported to HTML, but if you don't wish to do that then you can disable it by adding the following to your `settings.json`:
```
"ep_comments_page": {
  "exportHtml": false
},
```

## How comments are exported

Comments are embedded in the exported document as **endnote-style annotations**,
not as native review comments. For each commented passage a superscript marker
(`*`) is placed inline, and the full comment text is listed in a `comments`
section at the end of the document. This is how comments appear in **HTML, DOCX,
ODT and PDF** exports alike — the other formats are produced by converting the
HTML export (via LibreOffice/soffice, or the built-in `html-to-docx` converter
when soffice is not configured).

In particular, **DOCX export does _not_ use Microsoft Word's native comment
feature**: exported comments are document text, so they do not appear in Word's
*Review* pane, cannot be replied to or resolved there, and do not carry author
or timestamp metadata. Set `"exportHtml": false` (above) to omit comments from
exports entirely.

The same applies on **import**: when an existing `.docx` is imported into a pad,
its native Word comments are dropped rather than converted into Etherpad
comments.

### Native Word comments — not yet supported (contributions/funding welcome)

Round-tripping real Word comments is technically feasible and would be a great
addition; it simply isn't implemented yet:

- **Import.** Etherpad's DOCX import uses [`mammoth`](https://www.npmjs.com/package/mammoth),
  which ignores Word comments by default but can extract them by passing a style
  mapping for `comment-reference` — mammoth then appends the comments to the end
  of the generated HTML and links them. That HTML could be mapped onto real
  Etherpad comments.
- **Export.** Producing native Word comments requires emitting the DOCX comment
  parts (`word/comments.xml`, `commentRangeStart`/`commentRangeEnd` and
  `commentReference` runs), which neither LibreOffice nor `html-to-docx`
  generate from the current HTML.

If your organisation would benefit from native Word-comment import/export,
[sponsorship of this work is welcome](https://etherpad.org/).

## Creating comment via API
If you need to add comments to a pad:

* Call this route to create the comments on Etherpad and get the comment ids:
  ```
  curl -X POST http://localhost:9001/p/THE_PAD_ID/comments -d "apikey=YOUR_API_KEY" -d 'data=[{"name":"AUTHOR","text":"COMMENT"}, {"name":"ANOTHER_AUTHOR","text":"ANOTHER_COMMENT"}]'
  ```

  The response will be:
  ```
  {"code":0,"commentIds":["c-VEtzKolgD5krJOVU","c-B8MEmAT0NJ9usUwc"]}
  ```

* Use the returned comment ids to set the pad HTML [via API](http://etherpad.org/doc/v1.5.6/#index_sethtml_padid_html):
  ```
  My comment goes <span class="comment c-VEtzKolgD5krJOVU">here<span>.
  ```

  Result:
  ![Screen shot](http://i.imgur.com/KM4lPJx.png)

NOTE: Adding a comment to a pad via API will make the other editors with that pad to be alerted, but this feature is only active if your Etherpad is run in `loadTest` mode. Read [the Etherpad Guide](https://github.com/ether/etherpad-lite/wiki/Load-Testing-Etherpad) for how to enable load testing.

## License
Apache 2
