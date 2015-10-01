# Comments and annotations for Etherpad

![Screen shot](http://i.imgur.com/sbiJ4xz.png)

## Installing this plugin with git.
```
npm install ep_page_view
git clone https://github.com/JohnMcLear/ep_comments.git node_modules/ep_comments_page
cd node_modules/ep_comments_page
npm install
```

## Alternative comment display
The plugin also provides an alternative way to display comments. Instead of having all comments visible on the right of the page, you can have just an icon on the right margin of the page. Comment details are displayed when user clicks on the comment icon:

![Screen shot](http://i.imgur.com/cEo7PdL.png)

To use this way of displaying comments, **make sure you have installed [ep_page_view](https://github.com/ether/ep_page_view)**, and add the following to your `settings.json`:
```
// Display comments as icons, not boxes
"ep_comments_page": {
  "displayCommentAsIcon": true
},
```

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
