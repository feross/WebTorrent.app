module.exports = Player

var h = require('virtual-dom/h')
var hyperx = require('hyperx')
var hx = hyperx(h)

var prettyBytes = require('prettier-bytes')

var util = require('../util')
var {dispatch, dispatcher} = require('../lib/dispatcher')

// Shows a streaming video player. Standard features + Chromecast + Airplay
function Player (state) {
  // Show the video as large as will fit in the window, play immediately
  // If the video is on Chromecast or Airplay, show a title screen instead
  var showVideo = state.playing.location === 'local'
  return hx`
    <div
      class='player'
      onmousemove=${dispatcher('mediaMouseMoved')}>
      ${showVideo ? renderMedia(state) : renderCastScreen(state)}
      ${renderPlayerControls(state)}
    </div>
  `
}

function renderMedia (state) {
  if (!state.server) return

  // Unfortunately, play/pause can't be done just by modifying HTML.
  // Instead, grab the DOM node and play/pause it if necessary
  var mediaType = state.playing.type /* 'audio' or 'video' */
  var mediaElement = document.querySelector(mediaType) /* get the <video> or <audio> tag */
  if (mediaElement !== null) {
    if (state.playing.isPaused && !mediaElement.paused) {
      mediaElement.pause()
    } else if (!state.playing.isPaused && mediaElement.paused) {
      mediaElement.play()
    }
    // When the user clicks or drags on the progress bar, jump to that position
    if (state.playing.jumpToTime) {
      mediaElement.currentTime = state.playing.jumpToTime
      state.playing.jumpToTime = null
    }    
    
    var newRate = ((100 + state.playing.playbackRate)/100);
    if (newRate !== mediaElement.playbackRate) {
      mediaElement.playbackRate = newRate;
    }
    // Set volume
    if (state.playing.setVolume !== null && isFinite(state.playing.setVolume)) {
      mediaElement.volume = state.playing.setVolume
      state.playing.setVolume = null
    }

    state.playing.currentTime = mediaElement.currentTime
    state.playing.duration = mediaElement.duration
    state.playing.volume = mediaElement.volume
  }

  // Create the <audio> or <video> tag
  var mediaTag = hx`
    <div
      src='${state.server.localURL}'
      ondblclick=${dispatcher('toggleFullScreen')}
      onloadedmetadata=${onLoadedMetadata}
      onended=${onEnded}
      onplay=${dispatcher('mediaPlaying')}
      onpause=${dispatcher('mediaPaused')}
      onstalling=${dispatcher('mediaStalled')}
      ontimeupdate=${dispatcher('mediaTimeUpdate')}
      autoplay>
    </div>
  `
  mediaTag.tagName = mediaType

  // Show the media.
  return hx`
    <div
      class='letterbox'
      onmousemove=${dispatcher('mediaMouseMoved')}>
      ${mediaTag}
      ${renderOverlay(state)}
    </div>
  `

  // As soon as the video loads enough to know the video dimensions, resize the window
  function onLoadedMetadata (e) {
    if (mediaType !== 'video') return
    var video = e.target
    var dimensions = {
      width: video.videoWidth,
      height: video.videoHeight
    }
    dispatch('setDimensions', dimensions)
  }

  // When the video completes, pause the video instead of looping
  function onEnded (e) {
    state.playing.isPaused = true
  }
}

function renderOverlay (state) {
  var elems = []
  var audioMetadataElem = renderAudioMetadata(state)
  var spinnerElem = renderLoadingSpinner(state)
  if (audioMetadataElem) elems.push(audioMetadataElem)
  if (spinnerElem) elems.push(spinnerElem)

  // Video fills the window, centered with black bars if necessary
  // Audio gets a static poster image and a summary of the file metadata.
  var style
  if (state.playing.type === 'audio') {
    style = { backgroundImage: cssBackgroundImagePoster(state) }
  } else if (elems.length !== 0) {
    style = { backgroundImage: cssBackgroundImageDarkGradient() }
  } else {
    return /* Video, not audio, and it isn't stalled, so no spinner. No overlay needed. */
  }

  return hx`
    <div class='media-overlay-background' style=${style}>
      <div class='media-overlay'>${elems}</div>
    </div>
  `
}

function renderAudioMetadata (state) {
  var torrentSummary = getPlayingTorrentSummary(state)
  var fileSummary = torrentSummary.files[state.playing.fileIndex]
  if (!fileSummary.audioInfo) return
  var info = fileSummary.audioInfo

  // Get audio track info
  var title = info.title
  if (!title) {
    title = fileSummary.name
  }
  var artist = info.artist && info.artist[0]
  var album = info.album
  if (album && info.year && !album.includes(info.year)) {
    album += ' (' + info.year + ')'
  }
  var track
  if (info.track && info.track.no && info.track.of) {
    track = info.track.no + ' of ' + info.track.of
  }

  // Show a small info box in the middle of the screen with title/album/artist/etc
  var elems = []
  if (artist) elems.push(hx`<div class='audio-artist'><label>Artist</label>${artist}</div>`)
  if (album) elems.push(hx`<div class='audio-album'><label>Album</label>${album}</div>`)
  if (track) elems.push(hx`<div class='audio-track'><label>Track</label>${track}</div>`)

  // Align the title with the artist/etc info, if available. Otherwise, center the title
  var emptyLabel = hx`<label></label>`
  elems.unshift(hx`<div class='audio-title'>${elems.length ? emptyLabel : undefined}${title}</div>`)

  return hx`<div class='audio-metadata'>${elems}</div>`
}

function renderLoadingSpinner (state) {
  if (state.playing.isPaused) return
  var isProbablyStalled = state.playing.isStalled ||
    (new Date().getTime() - state.playing.lastTimeUpdate > 2000)
  if (!isProbablyStalled) return

  var torrentSummary = getPlayingTorrentSummary(state)
  var torrent = state.client.get(torrentSummary.infoHash)
  var file = torrentSummary.files[state.playing.fileIndex]
  var progress = Math.floor(100 * file.numPiecesPresent / file.numPieces)

  return hx`
    <div class='media-stalled'>
      <div class='loading-spinner'>&nbsp;</div>
      <div class='loading-status ellipsis'>
        <span class='progress'>${progress}%</span> downloaded,
        <span>↓ ${prettyBytes(torrent.downloadSpeed || 0)}/s</span>
        <span>↑ ${prettyBytes(torrent.uploadSpeed || 0)}/s</span>
      </div>
    </div>
  `
}

function renderCastScreen (state) {
  var isChromecast = state.playing.location.startsWith('chromecast')
  var isAirplay = state.playing.location.startsWith('airplay')
  var isStarting = state.playing.location.endsWith('-pending')
  if (!isChromecast && !isAirplay) throw new Error('Unimplemented cast type')

  // Show a nice title image, if possible
  var style = {
    backgroundImage: cssBackgroundImagePoster(state)
  }

  // Show whether we're connected to Chromecast / Airplay
  var castStatus = isStarting ? 'Connecting...' : 'Connected'
  return hx`
    <div class='letterbox' style=${style}>
      <div class='cast-screen'>
        <i class='icon'>${isAirplay ? 'airplay' : 'cast'}</i>
        <div class='cast-type'>${isAirplay ? 'AirPlay' : 'Chromecast'}</div>
        <div class='cast-status'>${castStatus}</div>
      </div>
    </div>
  `
}

// Returns the CSS background-image string for a poster image + dark vignette
function cssBackgroundImagePoster (state) {
  var torrentSummary = getPlayingTorrentSummary(state)
  if (!torrentSummary || !torrentSummary.posterURL) return ''
  var posterURL = util.getAbsoluteStaticPath(torrentSummary.posterURL)
  var cleanURL = posterURL.replace(/\\/g, '/')
  return cssBackgroundImageDarkGradient() + `, url(${cleanURL})`
}

function cssBackgroundImageDarkGradient () {
  return 'radial-gradient(circle at center, ' +
    'rgba(0,0,0,0.4) 0%, rgba(0,0,0,1) 100%)'
}

function getPlayingTorrentSummary (state) {
  var infoHash = state.playing.infoHash
  return state.saved.torrents.find((x) => x.infoHash === infoHash)
}

function renderPlayerControls (state) {
  var positionPercent = 100 * state.playing.currentTime / state.playing.duration
  var playbackCursorStyle = { left: 'calc(' + positionPercent + '% - 8px)' }

  var elements = [
    hx`
      <div class='playback-bar'>
        ${renderLoadingBar(state)}
        <div class='playback-cursor' style=${playbackCursorStyle}></div>
        <div class='scrub-bar'
          draggable='true'
          onclick=${handleScrub},
          ondrag=${handleScrub}></div>
      </div>
    `,
    hx`
      <i class='icon fullscreen'
        onclick=${dispatcher('toggleFullScreen')}>
        ${state.window.isFullScreen ? 'fullscreen_exit' : 'fullscreen'}
      </i>
    `
  ]

  // If we've detected a Chromecast or AppleTV, the user can play video there
  var isOnChromecast = state.playing.location.startsWith('chromecast')
  var isOnAirplay = state.playing.location.startsWith('airplay')
  var chromecastClass, chromecastHandler, airplayClass, airplayHandler
  if (isOnChromecast) {
    chromecastClass = 'active'
    airplayClass = 'disabled'
    chromecastHandler = dispatcher('stopCasting')
    airplayHandler = undefined
  } else if (isOnAirplay) {
    chromecastClass = 'disabled'
    airplayClass = 'active'
    chromecastHandler = undefined
    airplayHandler = dispatcher('stopCasting')
  } else {
    chromecastClass = ''
    airplayClass = ''
    chromecastHandler = dispatcher('openChromecast')
    airplayHandler = dispatcher('openAirplay')
  }
  if (state.devices.chromecast || isOnChromecast) {
    elements.push(hx`
      <i.icon.chromecast
        class=${chromecastClass}
        onclick=${chromecastHandler}>
        cast
      </i>
    `)
  }
  if (state.devices.airplay || isOnAirplay) {
    elements.push(hx`
      <i.icon.airplay
        class=${airplayClass}
        onclick=${airplayHandler}>
        airplay
      </i>
    `)
  }

  // On OSX, the back button is in the title bar of the window; see app.js
  // On other platforms, we render one over the video on mouseover
  if (process.platform !== 'darwin') {
    elements.push(hx`
      <i.icon.back
        onclick=${dispatcher('back')}>
        chevron_left
      </i>
    `)
  }

  if(state.playing.playbackRate !== 0){
    elements.push(hx`
     <span class="rate">speed: ${state.playing.playbackRate > 0 ? "+" : ""}${state.playing.playbackRate}%</span>
    `)
  }

  // Finally, the big button in the center plays or pauses the video
  elements.push(hx`
    <i class='icon play-pause' onclick=${dispatcher('playPause')}>
      ${state.playing.isPaused ? 'play_arrow' : 'pause'}
    </i>
  `)

  return hx`<div class='player-controls'>${elements}</div>`

  // Handles a click or drag to scrub (jump to another position in the video)
  function handleScrub (e) {
    dispatch('mediaMouseMoved')
    var windowWidth = document.querySelector('body').clientWidth
    var fraction = e.clientX / windowWidth
    var position = fraction * state.playing.duration /* seconds */
    dispatch('playbackJump', position)
  }
}

// Renders the loading bar. Shows which parts of the torrent are loaded, which
// can be "spongey" / non-contiguous
function renderLoadingBar (state) {
  var torrent = state.client.get(state.playing.infoHash)
  if (torrent === null) {
    return []
  }
  var file = torrent.files[state.playing.fileIndex]

  // Find all contiguous parts of the torrent which are loaded
  var parts = []
  var lastPartPresent = false
  var numParts = file._endPiece - file._startPiece + 1
  for (var i = file._startPiece; i <= file._endPiece; i++) {
    var partPresent = torrent.bitfield.get(i)
    if (partPresent && !lastPartPresent) {
      parts.push({start: i - file._startPiece, count: 1})
    } else if (partPresent) {
      parts[parts.length - 1].count++
    }
    lastPartPresent = partPresent
  }

  // Output some bars to show which parts of the file are loaded
  return hx`
    <div class='loading-bar'>
      ${parts.map(function (part) {
        var style = {
          left: (100 * part.start / numParts) + '%',
          width: (100 * part.count / numParts) + '%'
        }

        return hx`<div class='loading-bar-part' style=${style}></div>`
      })}
    </div>
  `
}
