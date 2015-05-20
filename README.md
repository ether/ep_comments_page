# Comments and annotations for Etherpad

![Screen shot](http://i.imgur.com/sbiJ4xz.png)

## Installing this plugin with git.
```
npm install ep_page_view
git clone https://github.com/JohnMcLear/ep_comments.git node_modules/ep_comments_page
cd node_modules/ep_comments_page
npm install
```

## Creating comment via API
If you need to add a comment to a pad:

* Call this route to create the comment on Etherpad and get the comment id:
  ```
  curl -X POST http://localhost:9001/p/THE_PAD_ID/comments -d "apikey=YOUR_API_KEY" -d "name=AUTHOR" -d "text=COMMENT"
  ```

  The response will be:
  ```
  {"code":0,"commentId":"c-VEtzKolgD5krJOVU"}
  ```

* Use the returned commentId to set the pad HTML [via API](http://etherpad.org/doc/v1.5.6/#index_sethtml_padid_html):
  ```
  My comment goes <span class="comment c-VEtzKolgD5krJOVU">here<span>.
  ```

  Result:
  ![Screen shot](http://i.imgur.com/KM4lPJx.png)

NOTE: Adding a comment to a pad via API will make the other editors with that pad to be alerted, but this feature is only active if your Etherpad is run in `loadTest` mode. Read [the Etherpad Guide](https://github.com/ether/etherpad-lite/wiki/Load-Testing-Etherpad) for how to enable load testing.

## License
Apache 2
