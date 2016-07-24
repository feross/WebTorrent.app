const React = require('react')
const prettyBytes = require('prettier-bytes')

const TorrentSummary = require('../lib/torrent-summary')
const TorrentPlayer = require('../lib/torrent-player')
const {dispatcher} = require('../lib/dispatcher')

module.exports = class TorrentList extends React.Component {
  render () {
    var state = this.props.state
    var torrentRows = state.saved.torrents.map(
      (torrentSummary) => this.renderTorrent(torrentSummary)
    )

    return (
      <div key='torrent-list' className='torrent-list'>
        {torrentRows}
        <div key='torrent-placeholder' className='torrent-placeholder'>
          <span className='ellipsis'>Drop a torrent file here or paste a magnet link</span>
        </div>
      </div>
    )
  }

  renderTorrent (torrentSummary) {
    var state = this.props.state
    var infoHash = torrentSummary.infoHash
    var isSelected = infoHash && state.selectedInfoHash === infoHash

    // Background image: show some nice visuals, like a frame from the movie, if possible
    var style = {}
    if (torrentSummary.posterFileName) {
      var gradient = isSelected
        ? 'linear-gradient(to bottom, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 100%)'
        : 'linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0) 100%)'
      var posterPath = TorrentSummary.getPosterPath(torrentSummary)
      style.backgroundImage = gradient + `, url('${posterPath}')`
    }

    // Foreground: name of the torrent, basic info like size, play button,
    // cast buttons if available, and delete
    var classes = ['torrent']
    //  playStatus turns the play button into a loading spinner or error icon
    if (torrentSummary.playStatus) classes.push(torrentSummary.playStatus)
    if (isSelected) classes.push('selected')
    if (!infoHash) classes.push('disabled')
    return (
      <div
        key={torrentSummary.torrentKey}
        style={style}
        className={classes.join(' ')}
        onContextMenu={infoHash && dispatcher('openTorrentContextMenu', infoHash)}
        onClick={infoHash && dispatcher('toggleSelectTorrent', infoHash)}>
        {this.renderTorrentMetadata(torrentSummary)}
        {infoHash ? this.renderTorrentButtons(torrentSummary) : null}
        {isSelected ? this.renderTorrentDetails(torrentSummary) : null}
      </div>
    )
  }

  // Show name, download status, % complete
  renderTorrentMetadata (torrentSummary) {
    var name = torrentSummary.name || 'Loading torrent...'
    var elements = [(
      <div key='name' className='name ellipsis'>{name}</div>
    )]

    // If it's downloading/seeding then show progress info
    var prog = torrentSummary.progress
    if (torrentSummary.status !== 'paused' && prog) {
      elements.push((
        <div key='progress-info' className='ellipsis'>
          {renderPercentProgress()}
          {renderTotalProgress()}
          {renderPeers()}
          {renderDownloadSpeed()}
          {renderUploadSpeed()}
          {renderEta()}
        </div>
      ))
    }

    return (<div key='metadata' className='metadata'>{elements}</div>)

    function renderPercentProgress () {
      var progress = Math.floor(100 * prog.progress)
      return (<span key='percent-progress'>{progress}%</span>)
    }

    function renderTotalProgress () {
      var downloaded = prettyBytes(prog.downloaded)
      var total = prettyBytes(prog.length || 0)
      if (downloaded === total) {
        return (<span key='total-progress'>{downloaded}</span>)
      } else {
        return (<span key='total-progress'>{downloaded} / {total}</span>)
      }
    }

    function renderPeers () {
      if (prog.numPeers === 0) return
      var count = prog.numPeers === 1 ? 'peer' : 'peers'
      return (<span key='peers'>{prog.numPeers} {count}</span>)
    }

    function renderDownloadSpeed () {
      if (prog.downloadSpeed === 0) return
      return (<span key='download'>↓ {prettyBytes(prog.downloadSpeed)}/s</span>)
    }

    function renderUploadSpeed () {
      if (prog.uploadSpeed === 0) return
      return (<span key='upload'>↑ {prettyBytes(prog.uploadSpeed)}/s</span>)
    }

    function renderEta () {
      var downloaded = prog.downloaded
      var total = prog.length || 0
      var missing = total - downloaded
      var downloadSpeed = prog.downloadSpeed
      if (downloadSpeed === 0 || missing === 0) return

      var rawEta = missing / downloadSpeed
      var hours = Math.floor(rawEta / 3600) % 24
      var minutes = Math.floor(rawEta / 60) % 60
      var seconds = Math.floor(rawEta % 60)

      // Only display hours and minutes if they are greater than 0 but always
      // display minutes if hours is being displayed
      var hoursStr = hours ? hours + 'h' : ''
      var minutesStr = (hours || minutes) ? minutes + 'm' : ''
      var secondsStr = seconds + 's'

      return (<span>ETA: {hoursStr} {minutesStr} {secondsStr}</span>)
    }
  }

  // Download button toggles between torrenting (DL/seed) and paused
  // Play button starts streaming the torrent immediately, unpausing if needed
  renderTorrentButtons (torrentSummary) {
    var infoHash = torrentSummary.infoHash

    var playIcon, playTooltip, playClass
    if (torrentSummary.playStatus === 'timeout') {
      playIcon = 'warning'
      playTooltip = 'Playback timed out. No seeds? No internet? Click to try again.'
    } else {
      playIcon = 'play_arrow'
      playTooltip = 'Start streaming'
    }

    var downloadIcon, downloadTooltip
    if (torrentSummary.status === 'seeding') {
      downloadIcon = 'file_upload'
      downloadTooltip = 'Seeding. Click to stop.'
    } else if (torrentSummary.status === 'downloading') {
      downloadIcon = 'file_download'
      downloadTooltip = 'Torrenting. Click to stop.'
    } else {
      downloadIcon = 'file_download'
      downloadTooltip = 'Click to start torrenting.'
    }

    // Do we have a saved position? Show it using a radial progress bar on top
    // of the play button, unless already showing a spinner there:
    var positionElem
    var willShowSpinner = torrentSummary.playStatus === 'requested'
    var defaultFile = torrentSummary.files &&
      torrentSummary.files[torrentSummary.defaultPlayFileIndex]
    if (defaultFile && defaultFile.currentTime && !willShowSpinner) {
      var fraction = defaultFile.currentTime / defaultFile.duration
      positionElem = this.renderRadialProgressBar(fraction, 'radial-progress-large')
      playClass = 'resume-position'
    }

    // Only show the play button for torrents that contain playable media
    var playButton
    if (TorrentPlayer.isPlayableTorrentSummary(torrentSummary)) {
      playButton = (
        <i
          key='play-button'
          title={playTooltip}
          className={'button-round icon play ' + playClass}
          onClick={dispatcher('playFile', infoHash)}>
          {playIcon}
        </i>
      )
    }

    return (
      <div key='buttons' className='buttons'>
        {positionElem}
        {playButton}
        <i
          key='download-button'
          className={'button-round icon download ' + torrentSummary.status}
          title={downloadTooltip}
          onClick={dispatcher('toggleTorrent', infoHash)}>
          {downloadIcon}
        </i>
        <i
          key='delete-button'
          className='icon delete'
          title='Remove torrent'
          onClick={dispatcher('confirmDeleteTorrent', infoHash, false)}>
          close
        </i>
      </div>
    )
  }

  // Show files, per-file download status and play buttons, and so on
  renderTorrentDetails (torrentSummary) {
    var filesElement
    if (!torrentSummary.files) {
      // We don't know what files this torrent contains
      var message = torrentSummary.status === 'paused'
        ? 'Failed to load torrent info. Click the download button to try again...'
        : 'Downloading torrent info...'
      filesElement = (<div key='files' className='files warning'>{message}</div>)
    } else {
      // We do know the files. List them and show download stats for each one
      var fileRows = torrentSummary.files
        .filter((file) => !file.path.includes('/.____padding_file/'))
        .map((file, index) => ({ file, index }))
        .sort(function (a, b) {
          if (a.file.name < b.file.name) return -1
          if (b.file.name < a.file.name) return 1
          return 0
        })
        .map((object) => this.renderFileRow(torrentSummary, object.file, object.index))

      filesElement = (
        <div key='files' className='files'>
          <table>
            <tbody>
              {fileRows}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <div key='details' className='torrent-details'>
        {filesElement}
      </div>
    )
  }

  // Show a single torrentSummary file in the details view for a single torrent
  renderFileRow (torrentSummary, file, index) {
    // First, find out how much of the file we've downloaded
    // Are we even torrenting it?
    var isSelected = torrentSummary.selections && torrentSummary.selections[index]
    var isDone = false // Are we finished torrenting it?
    var progress = ''
    if (torrentSummary.progress && torrentSummary.progress.files) {
      var fileProg = torrentSummary.progress.files[index]
      isDone = fileProg.numPiecesPresent === fileProg.numPieces
      progress = Math.round(100 * fileProg.numPiecesPresent / fileProg.numPieces) + '%'
    }

    // Second, for media files where we saved our position, show how far we got
    var positionElem
    if (file.currentTime) {
      // Radial progress bar. 0% = start from 0:00, 270% = 3/4 of the way thru
      positionElem = this.renderRadialProgressBar(file.currentTime / file.duration)
    }

    // Finally, render the file as a table row
    var isPlayable = TorrentPlayer.isPlayable(file)
    var infoHash = torrentSummary.infoHash
    var icon
    var handleClick
    if (isPlayable) {
      icon = 'play_arrow' /* playable? add option to play */
      handleClick = dispatcher('playFile', infoHash, index)
    } else {
      icon = 'description' /* file icon, opens in OS default app */
      handleClick = dispatcher('openItem', infoHash, index)
    }
    var rowClass = ''
    if (!isSelected) rowClass = 'disabled' // File deselected, not being torrented
    if (!isDone && !isPlayable) rowClass = 'disabled' // Can't open yet, can't stream
    return (
      <tr key={index} onClick={handleClick}>
        <td className={'col-icon ' + rowClass}>
          {positionElem}
          <i className='icon'>{icon}</i>
        </td>
        <td className={'col-name ' + rowClass}>
          {file.name}
        </td>
        <td className={'col-progress ' + rowClass}>
          {isSelected ? progress : ''}
        </td>
        <td className={'col-size ' + rowClass}>
          {prettyBytes(file.length)}
        </td>
        <td className='col-select'
          onClick={dispatcher('toggleTorrentFile', infoHash, index)}>
          <i className='icon'>{isSelected ? 'close' : 'add'}</i>
        </td>
      </tr>
    )
  }

  renderRadialProgressBar (fraction, cssClass) {
    var rotation = 360 * fraction
    var transformFill = {transform: 'rotate(' + (rotation / 2) + 'deg)'}
    var transformFix = {transform: 'rotate(' + rotation + 'deg)'}

    return (
      <div key='radial-progress' className={'radial-progress ' + cssClass}>
        <div key='circle' className='circle'>
          <div key='mask-full' className='mask full' style={transformFill}>
            <div key='fill' className='fill' style={transformFill}></div>
          </div>
          <div key='mask-half' className='mask half'>
            <div key='fill' className='fill' style={transformFill}></div>
            <div key='fill-fix' className='fill fix' style={transformFix}></div>
          </div>
        </div>
        <div key='inset' className='inset'></div>
      </div>
    )
  }
}
