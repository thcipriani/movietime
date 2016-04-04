var readTorrent = require('read-torrent'),
  bodyParser = require('body-parser'),
  cheerio = require('cheerio'),
  tempDir = require('os').tmpdir(),
  peerflix = require('peerflix'),
  uuid = require('node-uuid'),
  app = require('express')(),
  omx = require('omxctrl'),
  path = require('path'),
  fs = require('fs'),
  request = require('request'),
  engine;

var PORT = process.argv[2] || 9090;

var magnetRegex = /(magnet:\?xt=urn:btih:(.{40}).*)/

app.use(bodyParser());

var stop = function() {
  if (!engine) return;
  engine.destroy();
  engine = null;
};

var createTempFilename = function() {
  return path.join(tempDir, 'torrentcast_' + uuid.v4());
};

var buildBookmarklet = function(req, res) {
    var body = [
        '<!doctype html>',
        '<head>',
        '<title>MovieTime</title>',
        '</head><body>',
        '<h1>MovieTime Bookmarklet</h1>',
        '<textarea>',
        "javascript:location.href='http://",
        req.headers.host,
        "/play?page='",
        '+encodeURIComponent(location.href)',
        '</textarea></body></html>'
    ];
    return body.join('');
};

var findMagnet = function(get, callback) {
    var page = get.req.query.page,
        requestSettings = {
           method: 'GET',
           url: page,
           gzip: true
        };

    if (page.substring(0, 'http'.length) !== 'http')
        get.res.send(400, { error: 'not a page' });

    request.get(requestSettings, function(error, res, html) {
        var match, $;
        if (error) get.res.send(400, { error: 'Couldn\'t grab page ' + page });
        console.log('Grabbed HTML');

        $ = cheerio.load(html);
        $('a').each(function(i, elem) {
            var str = $(this).attr('href');
            if (match) return false;
            if (!str) return;
            match = str.match(magnetRegex)
        });

        if (match) {
            console.log('Found Magnetlink: ' + match[1]);
            playTorrent(get.req, get.res, match[1]);
        } else {
            get.res.send(400, { error: 'Couldn\'t grab magnet' + page });
        }
    });
};

var playTorrent = function(req, res, torrent) {
    readTorrent(torrent, function(err, torrent) {
      if (err) return res.send(400, { error: 'torrent link could not be parsed' });
      if (engine) stop();

      engine = peerflix(torrent, {
        connections: 100,
        path: createTempFilename(),
        buffer: (3 * 1024 * 1024).toString()
      });

      engine.server.on('listening', function() {
        omx.play('http://127.0.0.1:' + engine.server.address().port + '/');
        res.send(200);
      });
    });
};

app.get('/play', function(req, res) {
    findMagnet({'req': req, 'res': res}, playTorrent)
});

app.get('/bookmarklet', function(req, res) {
    res.setHeader('content-type', 'text/html');
    res.send(200, buildBookmarklet(req, res));
});

/**
 * Listen for keys, want to be able to use the keyboard
 *
 * http://stackoverflow.com/a/30687420
 */
var keyListen = function() {
    var stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', function(key) {
        process.stdout.write('Sending "' + key + '" to omxplayer\n');
        omx.send(key);
        if (key == '\u0003') { process.exit(); } //ctrl-c
    });
};

module.exports = function() {
  console.log('movietime running on port', PORT);
  app.listen(PORT);
  keyListen();
};
