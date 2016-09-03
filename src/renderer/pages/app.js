const colors = require('material-ui/styles/colors')
const React = require('react')

const darkBaseTheme = require('material-ui/styles/baseThemes/darkBaseTheme').default
const lightBaseTheme = require('material-ui/styles/baseThemes/lightBaseTheme').default
const getMuiTheme = require('material-ui/styles/getMuiTheme').default
const MuiThemeProvider = require('material-ui/styles/MuiThemeProvider').default

const Header = require('../components/header')

const Views = {
  'home': require('./torrent-list-page'),
  'player': require('./player-page'),
  'create-torrent': require('./create-torrent-page'),
  'preferences': require('./preferences-page')
}

const Modals = {
  'open-torrent-address-modal': require('../components/open-torrent-address-modal'),
  'remove-torrent-modal': require('../components/remove-torrent-modal'),
  'update-available-modal': require('../components/update-available-modal'),
  'unsupported-media-modal': require('../components/unsupported-media-modal')
}

const fontFamily = process.platform === 'win32'
  ? '"Segoe UI", sans-serif'
  : 'BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif'
lightBaseTheme.fontFamily = fontFamily
darkBaseTheme.fontFamily = fontFamily
darkBaseTheme.palette.primary1Color = colors.cyan500
darkBaseTheme.palette.primary2Color = colors.cyan500
darkBaseTheme.palette.primary3Color = colors.grey600
darkBaseTheme.palette.accent1Color = colors.redA200
darkBaseTheme.palette.accent2Color = colors.redA400
darkBaseTheme.palette.accent3Color = colors.redA100

class App extends React.Component {
  render () {
    const state = this.props.state

    // Hide player controls while playing video, if the mouse stays still for a while
    // Never hide the controls when:
    // * The mouse is over the controls or we're scrubbing (see CSS)
    // * The video is paused
    // * The video is playing remotely on Chromecast or Airplay
    const hideControls = state.location.url() === 'player' &&
      state.playing.mouseStationarySince !== 0 &&
      new Date().getTime() - state.playing.mouseStationarySince > 2000 &&
      !state.playing.isPaused &&
      state.playing.location === 'local' &&
      state.playing.playbackRate === 1

    const cls = [
      'view-' + state.location.url(), /* e.g. view-home, view-player */
      'is-' + process.platform /* e.g. is-darwin, is-win32, is-linux */
    ]
    if (state.window.isFullScreen) cls.push('is-fullscreen')
    if (state.window.isFocused) cls.push('is-focused')
    if (hideControls) cls.push('hide-video-controls')

    const vdom = (
      <MuiThemeProvider muiTheme={getMuiTheme(darkBaseTheme)}>
        <div className={'app ' + cls.join(' ')}>
          <Header state={state} />
          {this.getErrorPopover()}
          <div key='content' className='content'>{this.getView()}</div>
          {this.getModal()}
        </div>
      </MuiThemeProvider>
    )

    return vdom
  }

  getErrorPopover () {
    const state = this.props.state
    const now = new Date().getTime()
    const recentErrors = state.errors.filter((x) => now - x.time < 5000)
    const hasErrors = recentErrors.length > 0

    const errorElems = recentErrors.map(function (error, i) {
      return (<div key={i} className='error'>{error.message}</div>)
    })
    return (
      <div key='errors'
        className={'error-popover ' + (hasErrors ? 'visible' : 'hidden')}>
        <div key='title' className='title'>Error</div>
        {errorElems}
      </div>
    )
  }

  getModal () {
    const state = this.props.state
    if (!state.modal) return
    const ModalContents = Modals[state.modal.id]
    return (
      <MuiThemeProvider muiTheme={getMuiTheme(lightBaseTheme)}>
        <div key='modal' className='modal'>
          <div key='modal-background' className='modal-background' />
          <div key='modal-content' className='modal-content'>
            <ModalContents state={state} />
          </div>
        </div>
      </MuiThemeProvider>
    )
  }

  getView () {
    const state = this.props.state
    const View = Views[state.location.url()]
    return (<View state={state} />)
  }
}

module.exports = App
