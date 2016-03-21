module.exports = {
  init: init,
  onToggleFullScreen: onToggleFullScreen,
  onWindowHide: onWindowHide,
  onWindowShow: onWindowShow,
  showOpenTorrentFile: showOpenTorrentFile,
  showCreateTorrent: showCreateTorrent,
  toggleFullScreen: toggleFullScreen
}

var debug = require('debug')('webtorrent-app:menu')
var electron = require('electron')

var app = electron.app

var config = require('../config')
var windows = require('./windows')

var appMenu, dockMenu

function init () {
  appMenu = electron.Menu.buildFromTemplate(getAppMenuTemplate())
  electron.Menu.setApplicationMenu(appMenu)

  dockMenu = electron.Menu.buildFromTemplate(getDockMenuTemplate())
  if (app.dock) app.dock.setMenu(dockMenu)
}

function toggleFullScreen (flag) {
  debug('toggleFullScreen %s', flag)
  if (windows.main && windows.main.isVisible()) {
    flag = flag != null ? flag : !windows.main.isFullScreen()
    windows.main.setFullScreen(flag)
  }
}

// Sets whether the window should always show on top of other windows
function toggleFloatOnTop (flag) {
  debug('toggleFloatOnTop %s', flag)
  if (windows.main) {
    flag = flag != null ? flag : !windows.main.isAlwaysOnTop()
    windows.main.setAlwaysOnTop(flag)
    getMenuItem('Float on Top').checked = flag
  }
}

function toggleDevTools () {
  debug('toggleDevTools')
  if (windows.main) {
    windows.main.toggleDevTools()
  }
}

function reloadWindow () {
  debug('reloadWindow')
  if (windows.main) {
    windows.main.webContents.reloadIgnoringCache()
  }
}

function addFakeDevice (device) {
  debug('addFakeDevice %s', device)
  windows.main.send('addFakeDevice', device)
}

function onWindowShow () {
  debug('onWindowShow')
  getMenuItem('Full Screen').enabled = true
  getMenuItem('Float on Top').enabled = true
}

function onWindowHide () {
  debug('onWindowHide')
  getMenuItem('Full Screen').enabled = false
  getMenuItem('Float on Top').enabled = false
}

function onToggleFullScreen (isFullScreen) {
  isFullScreen = isFullScreen != null ? isFullScreen : windows.main.isFullScreen()
  windows.main.setMenuBarVisibility(!isFullScreen)
  getMenuItem('Full Screen').checked = isFullScreen
  windows.main.send('fullscreenChanged', isFullScreen)
}

function getMenuItem (label) {
  for (var i = 0; i < appMenu.items.length; i++) {
    var menuItem = appMenu.items[i].submenu.items.find(function (item) {
      return item.label === label
    })
    if (menuItem) return menuItem
  }
}

// Prompts the user for a file or folder, then makes a torrent out of the data
function showCreateTorrent () {
  electron.dialog.showOpenDialog({
    title: 'Select a file or folder for the torrent file.',
    properties: [ 'openFile', 'openDirectory', 'multiSelections' ]
  }, function (filenames) {
    if (!Array.isArray(filenames)) return
    windows.main.send('dispatch', 'seed', filenames)
  })
}

// Prompts the user to choose a torrent file, then adds it to the app
function showOpenTorrentFile () {
  electron.dialog.showOpenDialog(windows.main, {
    title: 'Select a .torrent file to open.',
    properties: [ 'openFile', 'multiSelections' ]
  }, function (filenames) {
    if (!Array.isArray(filenames)) return
    filenames.forEach(function (filename) {
      windows.main.send('dispatch', 'addTorrent', filename)
    })
  })
}

// Prompts the user for the URL of a torrent file, then downloads and adds it
function showOpenTorrentAddress () {
  windows.main.send('showOpenTorrentAddress')
}

function getAppMenuTemplate () {
  var template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Create New Torrent...',
          accelerator: 'CmdOrCtrl+N',
          click: showCreateTorrent
        },
        {
          label: 'Open Torrent File...',
          accelerator: 'CmdOrCtrl+O',
          click: showOpenTorrentFile
        },
        {
          label: 'Open Torrent Address...',
          accelerator: 'CmdOrCtrl+U',
          click: showOpenTorrentAddress
        },
        {
          type: 'separator'
        },
        {
          label: process.platform === 'darwin'
            ? 'Close Window'
            : 'Close',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut'
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy'
        },
        {
          label: 'Paste Torrent Address',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste'
        },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectall'
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Full Screen',
          type: 'checkbox',
          accelerator: process.platform === 'darwin'
            ? 'Ctrl+Command+F'
            : 'F11',
          click: () => toggleFullScreen()
        },
        {
          label: 'Float on Top',
          type: 'checkbox',
          click: () => toggleFloatOnTop()
        },
        {
          type: 'separator'
        },
        {
          label: 'Developer',
          submenu: [
            {
              label: 'Reload',
              accelerator: 'CmdOrCtrl+R',
              click: reloadWindow
            },
            {
              label: 'Developer Tools',
              accelerator: process.platform === 'darwin'
                ? 'Alt+Command+I'
                : 'Ctrl+Shift+I',
              click: toggleDevTools
            },
            {
              type: 'separator'
            },
            {
              label: 'Add Fake Airplay',
              click: () => addFakeDevice('airplay')
            },
            {
              label: 'Add Fake Chromecast',
              click: () => addFakeDevice('chromecast')
            }
          ]
        }
      ]
    },
    {
      label: 'Window',
      role: 'window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        }
      ]
    },
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Learn more about ' + config.APP_NAME,
          click: () => electron.shell.openExternal('https://webtorrent.io')
        },
        {
          label: 'Contribute on GitHub',
          click: () => electron.shell.openExternal('https://github.com/feross/webtorrent-app')
        },
        {
          type: 'separator'
        },
        {
          label: 'Report an Issue...',
          click: () => electron.shell.openExternal('https://github.com/feross/webtorrent-app/issues')
        }
      ]
    }
  ]

  if (process.platform === 'darwin') {
    var name = app.getName()
    template.unshift({
      label: name,
      submenu: [
        {
          label: 'About ' + name,
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          label: 'Services',
          role: 'services',
          submenu: []
        },
        {
          type: 'separator'
        },
        {
          label: 'Hide ' + name,
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Alt+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        {
          type: 'separator'
        },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: function () { app.quit() }
        }
      ]
    })

    // Window menu
    template[4].submenu.push(
      {
        type: 'separator'
      },
      {
        label: 'Bring All to Front',
        role: 'front'
      }
    )
  }

  return template
}

function getDockMenuTemplate () {
  return [
    {
      label: 'Create New Torrent...',
      accelerator: 'CmdOrCtrl+N',
      click: showCreateTorrent
    },
    {
      label: 'Open Torrent File...',
      accelerator: 'CmdOrCtrl+O',
      click: showOpenTorrentFile
    },
    {
      label: 'Open Torrent Address...',
      accelerator: 'CmdOrCtrl+U',
      click: showOpenTorrentAddress
    }
  ]
}
