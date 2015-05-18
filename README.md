# Comments and annotations for Etherpad

![Screen shot](http://i.imgur.com/sbiJ4xz.png)

## Installing this plugin with git.
```
npm install ep_page_view
git clone https://github.com/JohnMcLear/ep_comments.git node_modules/ep_comments_page
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

## License
Apache 2
