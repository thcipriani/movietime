Mostly a fork of [torrentcast](https://github.com/xat/torrentcast)

*Except*

1. It gets rid of most of the REST api since I hate controlling things
   with my phone, and just passes stdin to oxmplayer.

2. Allows you to send a URL via a `GET` request to `/play` that contains a
   magnet link to stream that link.

3. It adds a `/bookmarklet` path that displays a chunk of javascript that
   can be bookmarked to send the current page to `/play`

It _can_ be run as a daemon, but the workflow is really meant to be:

1. Run `./bin/movietime` on a raspberry pi directly in the framebuffer
2. Navigate to a torrent indexer that uses magnet links
3. Find the torrent you want to stream, use the bookmarklet to send the
   link to the torrent indexer page to movietime on your pi
4. Use the normal `omxplayer` controls via keyboard to change volume or
   pause.

## License
Copyright (c) 2014 Simon Kusterer
Copyright (c) 2016 Tyler Cipriani
Licensed under the MIT license.
