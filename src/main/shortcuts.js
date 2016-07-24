module.exports = {
  disable,
  enable
}

var electron = require('electron')
var windows = require('./windows')

function enable () {
  // Register play/pause media key, available on some keyboards.
  electron.globalShortcut.register(
    'MediaPlayPause',
    () => windows.main.dispatch('playPause')
  )
}

function disable () {
  // Return the media key to the OS, so other apps can use it.
  electron.globalShortcut.unregister('MediaPlayPause')
}
