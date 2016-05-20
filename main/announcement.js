module.exports = {
  init
}

var electron = require('electron')
var get = require('simple-get')

var config = require('../config')
var log = require('./log')

var ANNOUNCEMENT_URL = config.ANNOUNCEMENT_URL +
  '?version=' + config.APP_VERSION +
  '&platform=' + process.platform

function init () {
  get.concat(ANNOUNCEMENT_URL, function (err, res, data) {
    if (err) return log('failed to retrieve remote message')
    if (res.statusCode !== 200) return log('no remote message')

    electron.dialog.showMessageBox({
      type: 'info',
      buttons: ['OK'],
      title: 'WebTorrent Desktop Announcement',
      message: data.toString()
    })
  })
}
