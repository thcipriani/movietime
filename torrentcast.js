var readTorrent = require('read-torrent'),
  bodyParser = require('body-parser'),
  tempDir = require('os').tmpdir(),
  peerflix = require('peerflix'),
  uuid = require('node-uuid'),
  app = require('express')(),
  omx = require('omxctrl'),
  path = require('path'),
  fs = require('fs'),
  request = require('request'),
  engine;

var STATES = ['PLAYING', 'PAUSED', 'IDLE'];
var PORT = process.argv[2] || 9090;

var mappings = {
  '/pause': 'pause',
  '/speedup': 'increaseSpeed',
  '/speeddown': 'decreaseSpeed',
  '/nextaudio': 'nextAudioStream',
  '/prevaudio': 'previousAudioStream',
  '/nextsubtitle': 'nextSubtitleStream',
  '/prevsubtitle': 'previousSubtitleStream',
  '/togglesubtitle': 'toggleSubtitles',
  '/volumeup': 'increaseVolume',
  '/volumedown': 'decreaseVolume',
  '/forward': 'seekForward',
  '/backward': 'seekBackward',
  '/fastforward': 'seekFastForward',
  '/fastbackward': 'seekFastBackward'
};

var magnetRegex = /href="(magnet:\?xt=urn:btih:(.{40})[^"]*)"/m

app.use(bodyParser());

var stop = function() {
  if (!engine) return;
  engine.destroy();
  engine = null;
};

var createTempFilename = function() {
  return path.join(tempDir, 'torrentcast_' + uuid.v4());
};

var clearTempFiles = function() {
  fs.readdir(tempDir, function(err, files) {
    if (err) return;
    files.forEach(function(file) {
      if (file.substr(0, 11) === 'torrentcast') {
        fs.rmdir(path.join(tempDir, file));
      }
    });
  });
};

var buildBookmarklet = function(req, res) {
    var body = [
        "javascript:location.href='http://",
        req.headers.host,
        "/bmplay?page='",
        '+encodeURIComponent(location.href)'
    ];
    return body.join('');
};

var findMagnet = function(get, callback) {
    var page = get.req.query.page;

    if (page.substring(0, 'http'.length) !== 'http')
        get.res.send(400, { error: 'not a page' });

    request.get(page, function(error, res, html) {
        var match;
        if (error) get.res.send(400, { error: 'Couldn\'t grab page ' + page });

        match = html.match(magnetRegex);

        if (match) {
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
      clearTempFiles();

      engine = peerflix(torrent, {
        connections: 100,
        path: createTempFilename(),
        buffer: (1.5 * 1024 * 1024).toString()
      });

      engine.server.on('listening', function() {
        omx.play('http://127.0.0.1:' + engine.server.address().port + '/');
        res.send(200);
      });
    });
};

app.post('/play', function(req, res) {
  if (!req.body.url) return res.send(400, { error: 'torrent url missung' });
  playTorrent(req, res, req.body.url);
});

app.get('/bmplay', function(req, res) {
    findMagnet({'req': req, 'res': res}, playTorrent)
});

app.post('/stop', function(req, res) {
  stop();
  res.send(200);
});

app.get('/state', function(req, res) {
  res.send(200, STATES[omx.getState()]);
});

app.get('/bookmarklet', function(req, res) {
  res.send(200, buildBookmarklet(req, res));
});

for (var route in mappings) {
  (function(method) {
    app.post(route, function(req, res) {
      omx[method]();
      res.send(200);
    });
  })(mappings[route]);
}

module.exports = function() {
  console.log('torrentcast running on port', PORT);
  app.listen(PORT);
};
