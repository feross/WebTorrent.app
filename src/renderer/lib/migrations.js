/* eslint-disable camelcase */

module.exports = {
  run
}

var semver = require('semver')
var config = require('../../config')

// Change `state.saved` (which will be saved back to config.json on exit) as
// needed, for example to deal with config.json format changes across versions
function run (state) {
  // Replace '{ version: 1 }' with app version (semver)
  if (!semver.valid(state.saved.version)) {
    state.saved.version = '0.0.0' // Pre-0.7.0 version, so run all migrations
  }

  var version = state.saved.version

  if (semver.lt(version, '0.7.0')) {
    migrate_0_7_0(state.saved)
  }

  if (semver.lt(version, '0.7.2')) {
    migrate_0_7_2(state.saved)
  }

  // Config is now on the new version
  state.saved.version = config.APP_VERSION
}

function migrate_0_7_0 (saved) {
  console.log('migrate to 0.7.0')

  var fs = require('fs-extra')
  var path = require('path')

  saved.torrents.forEach(function (ts) {
    var infoHash = ts.infoHash

    // Replace torrentPath with torrentFileName
    // There are a number of cases to handle here:
    // * Originally we used absolute paths
    // * Then, relative paths for the default torrents, eg '../static/sintel.torrent'
    // * Then, paths computed at runtime for default torrents, eg 'sintel.torrent'
    // * Finally, now we're getting rid of torrentPath altogether
    var src, dst
    if (ts.torrentPath) {
      console.log('replacing torrentPath %s', ts.torrentPath)
      if (path.isAbsolute(ts.torrentPath) || ts.torrentPath.startsWith('..')) {
        src = ts.torrentPath
      } else {
        src = path.join(config.STATIC_PATH, ts.torrentPath)
      }
      dst = path.join(config.TORRENT_PATH, infoHash + '.torrent')
      // Synchronous FS calls aren't ideal, but probably OK in a migration
      // that only runs once
      if (src !== dst) fs.copySync(src, dst)

      delete ts.torrentPath
      ts.torrentFileName = infoHash + '.torrent'
    }

    // Replace posterURL with posterFileName
    if (ts.posterURL) {
      console.log('replacing posterURL %s', ts.posterURL)
      var extension = path.extname(ts.posterURL)
      src = path.isAbsolute(ts.posterURL)
        ? ts.posterURL
        : path.join(config.STATIC_PATH, ts.posterURL)
      dst = path.join(config.POSTER_PATH, infoHash + extension)
      // Synchronous FS calls aren't ideal, but probably OK in a migration
      // that only runs once
      if (src !== dst) fs.copySync(src, dst)

      delete ts.posterURL
      ts.posterFileName = infoHash + extension
    }

    // Fix exception caused by incorrect file ordering.
    // https://github.com/feross/webtorrent-desktop/pull/604#issuecomment-222805214
    delete ts.defaultPlayFileIndex
    delete ts.files
    delete ts.selections
    delete ts.fileModtimes
  })
}

function migrate_0_7_2 (saved) {
  if (!saved.prefs) {
    saved.prefs = {
      downloadPath: config.DEFAULT_DOWNLOAD_PATH
    }
  }
}
