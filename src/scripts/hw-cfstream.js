console.log('CF INIT!!!!');
HW.vids = {};

//console.log('YT LOADED');
HW.vidsObsOpts = {
	root: null,
	threshold: .1,
	rootMargin: '-50px 0px -50px 0px',
};



function timecodeToSeconds(timecode) {
	var parts = timecode.split(':').map(Number);
	return parts.reduce((acc, time) => acc * 60 + time, 0);
}

videojs.registerPlugin('loopBetween', function(options) {
	var player = this;
	var startTime = options.startTime || 0;
	var endTime = options.endTime || player.duration();
	var looping = options.looping !== false; // Defaults to true

	player.on('loadedmetadata', function() {
		player.currentTime(startTime);

		if (options.endTime === undefined) {
			endTime = player.duration();
		}
	});

	player.on('timeupdate', function() {
		if (looping && player.currentTime() >= endTime) {
			player.currentTime(startTime);
			player.play();
		}
	});

	player.on('play', function() {
		if (player.currentTime() < startTime || player.currentTime() >= endTime) {
			player.currentTime(startTime);
		}
	});
});






function hwVidPlay($el) {
	var doIt = function(){
		if(typeof $el == 'undefined') {
			//console.log('ASDASDSD');
			return;
		}

		if(typeof $el.pauseTimeout !== 'undefined') {
			HW.clearRequestTimeout($el.pauseTimeout);				
		}	

		var mypar = $el.el_.closest('.hw-vid-player-parent');
		if(mypar) {
			mypar.classList.remove('pausing');
			mypar.classList.remove('paused');
		}
		
		$el.inView = true;
		
		$el.play();
	};
	
	if(typeof $el !== 'undefined') {
		$el.timesplayed = 0;
		
		$el.inView = true;
	}

	var thetimeout = 50;
	
	if(HW.tabBlur == true) {
		HW.requestTimeout(doIt.bind($el), 100);
	} else {
		doIt();			
	}
		
}

function hwVidPause($el, $par) {
	if($el == null || typeof $el == 'undefined' || $par == null) {
		return;
	}
	
	$par.classList.add('pausing');
	
	var doIt = function(){			
		$el.pause();
		$par.classList.add('paused');
		$par.classList.remove('playing');
		$par.classList.remove('pausing');			
	}

	$el.inView = false;
	doIt();
	$el.pauseTimeout = HW.requestTimeout(doIt, 400);
}











function handler(entries, observer) {
	for (var i=0; i<entries.length; i++) {
		var entry = entries[i],
			me = entry.target,
			mypar;
			
		
		if(me.classList.contains('wave-parallax')) {
			me = $$('.rowindex-1 .hw-vid-player-parent')[0];
		}
		//console.log(me);
		if(me.classList.contains('hw-vid-player-parent')) {
			mypar = me;
			
			me = $$('.hw-vid-player', me)[0];			
		} else {
			mypar = me.closest('.hw-vid-player-parent');
		}
		
		var myid = me.id,
			myindex = '';
			
			//myindex = me.getAttribute('data-hw-vid-index');
			
			if(me.id == 'hw-vid-player-critical') {
				myindex = 0;
			}
			
			//HW.consolelog('handler');



		
		
		if (entry.isIntersecting) {
		 //  console.log('HW YT INTERSECT');

			if(mypar !== null) {
				mypar.classList.add('intersecting');
			}
			
			console.log(myid);
			hwVidPlay(HW.vids[myid]);				

		} else {
			if(mypar !== null) {
				mypar.classList.remove('intersecting');					
			}
			//console.log('NOT intersecting');				
/*
			if(typeof HW.tempVars.yt[myid].ioTimer !== 'undefined') {
				HW.clearRequestTimeout(HW.tempVars.yt[myid].ioTimer);	
			}
*/

			//mypar.classList.remove('hide-text');
			hwVidPause(HW.vids[myid], mypar);
		}
	}
}









HW.vidParHoverFirst = function(){
	this.classList.add('hovered');
};

HW.vidParHoverOffFirst = function(){
	this.classList.remove('hovered');
};







HW.vidHoverOn = function(e){
	var me = this,
		elementId = me.id,
		vidId = me.id.split('-')[1],
		targetId = 'hw-vid-video-' + vidId;
		
	this.classList.add('hovered');
	console.log(HW.vids);
	console.log(vidId);
	HW.vids[targetId].hoverPlayTimeout = HW.requestTimeout(function(){
		hwVidPlay(HW.vids[targetId]);
	}, 50);	
};

HW.vidHoverOff = function(e){
	var me = this,
		elementId = me.id,
		vidId = me.id.split('-')[1],
		targetId = 'hw-vid-video-' + vidId;
	
	this.classList.remove('hovered');
		
	if(typeof HW.vids[targetId] !== 'undefined' && typeof HW.vids[targetId].hoverPlayTimeout !== 'undefined') {
		HW.clearRequestTimeout(HW.vids[targetId].hoverPlayTimeout);				
	} else {
		//console.log(myid);
	}
	
	hwVidPause(HW.vids[targetId], me);
};

	
HW.setVideoDims = function(el, myContainer, myDimsContainer) {	
	if(el.getAttribute('data-hw-vid-ratio') !== null) {
		var ratio = el.getAttribute('data-hw-vid-ratio').split(':');
		myratio = {w: ratio[0], h: ratio[1]};
	}
	
	//HW.consolelog(myContainer);
	
	var myDimsOffset = HW.ytDimsOffset;
	
	
	var dims = HW.setFullBleedDims(myDimsOffset, myDimsContainer, myratio);
			
	// if(el.getAttribute('id') == 'hw-vid-player-critical') {
	// 	myIndex = 0;
	// 	loadNonCritYt();
	// }
	
	el.style.width = dims.width + 'px';
	el.style.height = dims.height + 'px';	
				
	if(el.getAttribute('data-hw-vid-set-poster-dims') == 'true' && typeof myContainer !== 'undefined') {
		var $myposter = $$('.hw-vid-poster', myContainer);
		
		if($myposter.length < 1) {
			return;
		}
		
		$myposter = $myposter[0];
		
		if(myContainer !== null) {
			myContainer.classList.add('hw-vid-resized');
			myContainer.classList.remove('hw-vid-resizing');
		}
		
		var mywidth = dims.width + 'px',
			myheight = dims.height + 'px';
		
		if($myposter.tagName == 'IMG') {
			if(dims.orient == 'l') {
				myheight = 'auto';
			} else {
				mywidth = 'auto';
			}
		}
		
		$myposter.style.width = mywidth;
		$myposter.style.height = myheight;						
	}
}

HW.initVideos = function (selector = '.hw-vid-player') {
	if ($$('.hw-vid-player-parent').length > 0) {
		HW.tempVars.observerVids = new IntersectionObserver(handler, HW.vidsObsOpts);
	}
	
	const players = document.querySelectorAll(`${selector}:not(.has-vid)`);
	console.log(players);
	console.log(selector);

	for (let i = 0; i < players.length; i++) {
		var el = players[i],
			hwVidId = el.getAttribute("data-hw-vid"),
			isSelfHosted = hwVidId.startsWith("https:"),
			elementId = el.id;

		if (!hwVidId || !elementId) continue;

		const myContainer = el.closest('.hw-vid-player-parent'),
			dataContainer = el.getAttribute('data-hw-vid-container'),
			myDimsContainer = dataContainer ? $$(dataContainer)[0] || myContainer : myContainer;

		const videoEl = document.createElement("video");
		videoEl.classList.add("video-js", "vjs-default-skin");
		if (el.getAttribute('data-hw-vid-single') !== "true") videoEl.setAttribute("controls", false);
		videoEl.setAttribute("playsinline", true);

		const sourceEl = document.createElement("source");
		if (isSelfHosted) {
			myidmob = el.getAttribute('data-hw-vid-mob');
			if (window.innerWidth < 768 && myidmob) hwVidId = myidmob;
			sourceEl.setAttribute("src", hwVidId);
			sourceEl.setAttribute("type", "video/mp4");
		} else {
			let bandwidthHint = (!HW.isMobile && !HW.isIpad) ? '?clientBandwidthHint=1000' : '';
			sourceEl.setAttribute("src", `https://customer-u7ssw6pfj8oowdhj.cloudflarestream.com/${hwVidId}/manifest/video.m3u8${bandwidthHint}#t=0.1`);
			sourceEl.setAttribute("type", "application/x-mpegURL");
		}

		videoEl.appendChild(sourceEl);
		el.appendChild(videoEl);
		videoEl.setAttribute('tabindex', '-1');

		(function (elementId, el, myContainer) {
			const myOptions = {
				bigPlayButton: false,
				userActions: { doubleClick: false },
				fluid: true,
				html5: {
					hls: {
						limitRenditionByPlayerDimensions: false,
						bandwidth: 16194304,
						useDevicePixelRatio: true,
						overrideNative: true
					}
				},
				playsinline: true,
				preload: 'auto',
				loop: true,
				controls: true,
				controlBar: {
					remainingTimeDisplay: false,
					fullscreenToggle: false,
					subsCapsButton: false,
					muteToggle: false,
					pictureInPictureToggle: false,
					durationDisplay: false
				}
			};

			const controlBarSettings = el.dataset.hwVidControlbar ? JSON.parse(el.dataset.hwVidControlbar) : [];
			if (controlBarSettings.length > 0) {
				myOptions.controlBar.children = controlBarSettings;
			}

			el.classList.add('has-vid');
			
			
			const thevid = HW.vids[elementId] = videojs(videoEl, myOptions);

console.log(thevid);
			let myStart = el.getAttribute('data-hw-vid-start'),
				myEnd = el.getAttribute('data-hw-vid-end');

			if (myStart !== null && myEnd !== null) {
				thevid.loopBetween({
					startTime: timecodeToSeconds(myStart),
					endTime: timecodeToSeconds(myEnd),
					looping: true
				});
			}

			thevid.ready(function () {
				if (!myContainer.classList.contains('ready')) {
					HW.requestTimeout(function () {
						thevid.currentTime(1);
						thevid.pause();
						thevid.currentTime(0);
						myContainer.classList.add('ready');
					}, 100);
				}

				thevid.hwBufferTimeout = null;

				thevid.on('waiting', function () {
					if (myContainer) {
						if (thevid.hwBufferTimeout !== null) {
							HW.clearRequestTimeout(thevid.hwBufferTimeout);
						}
						thevid.hwBufferTimeout = HW.requestTimeout(function () {
							myContainer.classList.add('paused');
						}, 500);
					}
				});

				thevid.on('playing', function () {
					if (myContainer) {
						if (thevid.hwBufferTimeout !== null) {
							HW.clearRequestTimeout(thevid.hwBufferTimeout);
						}
						myContainer.classList.remove('paused');
					}
				});

				if (el.getAttribute('data-hw-vid-single') === "true") {
					const controlBar = thevid.controlBar.el(),
						fullscreenButton = `<button id="fullscreen-btn" class="mono caps abs" title="Fullscreen">Fullscreen</button>`;
					controlBar.insertAdjacentHTML('beforeend', fullscreenButton);
					document.getElementById('fullscreen-btn').addEventListener('click', function () {
						thevid.isFullscreen() ? thevid.exitFullscreen() : thevid.requestFullscreen();
					});

					const playPauseButton = `<button id="playPauseMob" class="mono caps pr" title="Play/Pause">Play</button>`;
					controlBar.insertAdjacentHTML('afterbegin', playPauseButton);
					const playPauseMob = document.getElementById('playPauseMob');

					function updatePlayPauseButton() {
						playPauseMob.textContent = thevid.paused() ? "Play" : "Pause";
					}
					playPauseMob.addEventListener('click', function () {
						thevid.paused() ? thevid.play() : thevid.pause();
					});
					thevid.on('play', updatePlayPauseButton);
					thevid.on('pause', updatePlayPauseButton);
				}

				const qualityLevels = thevid.qualityLevels();
				qualityLevels.on('addqualitylevel', function (event) {
					event.qualityLevel.enabled = event.qualityLevel.height >= 1000;
				});
				qualityLevels.trigger({ type: 'change', selectedIndex: 1 });

				thevid.muted(true);

				// ✅ SKIP observer & hover behavior if scrollTrigger is active
				if (el.getAttribute('data-scrolltrigger') === "true") {
					thevid.on('loadedmetadata', function () {

						HW.hwRequire('gsap', function(){
							const scrubDuration = thevid.duration();
							console.log(scrubDuration);
							gsap.to(thevid, {
								scrollTrigger: {
									trigger: myContainer,
									start: "top bottom",
									end: "bottom top",
									scrub: true,
									onUpdate: self => {
											thevid.currentTime(scrubDuration * self.progress);
											console.log(scrubDuration * self.progress);
									},
									onEnter: () => {
										thevid.pause();
										myContainer.classList.add('scrubbing');
									},
									onLeaveBack: () => {
										myContainer.classList.remove('scrubbing');
									},
									onLeave: () => {
										myContainer.classList.remove('scrubbing');
									},
									onEnterBack: () => {
										thevid.pause();
										myContainer.classList.add('scrubbing');
									}
								}
							});						
						})					
					});
					return; // 🛑 exit early, skip observer setup
				}

				// Normal observer or hover setup
				const setupPlaybackControl = () => {
					if (
						el.getAttribute('data-hw-vid-single') !== "true" &&
						el.getAttribute('data-hw-vid-hover') !== "true" &&
						HW.tempVars.observerVids
					) {
						thevid.pause();
						myContainer?.classList.remove('hw-vid-not-loaded');
						let observeEl = myContainer || el;
						if (observeEl.id.includes('wave-banner')) observeEl = $$('.wave-parallax')[0];
						HW.tempVars.observerVids.observe(observeEl, HW.vidsObsOpts);
					} else if (el.getAttribute('data-hw-vid-single') !== "true") {
						if (myContainer && !myContainer.classList.contains('hovered')) {
							thevid.pause();
							myContainer.classList.remove('hw-vid-not-loaded');
						}
						myContainer?.removeEventListener('mouseover', HW.vidParHoverFirst, true);
						myContainer?.removeEventListener('mouseout', HW.vidParHoverOffFirst, true);

						if (!el.getAttribute('data-hw-vid-controls')) {
							myContainer?.addEventListener('mouseover', HW.vidHoverOn, false);
							myContainer?.addEventListener('mouseleave', HW.vidHoverOff, false);
						}
					}
				};

				HW.requestTimeout(setupPlaybackControl, 150);
			});
		})(elementId, el, myContainer);
	}
};



// Non-critical videos: run on domReady
HW.initNonCriticalVideos = function () {
	HW.initVideos('.hw-vid-player:not(.hw-vid-critical .hw-vid-player)');
};

// Critical videos inside `.hw-vid-critical`
HW.initCriticalVideos = function () {
	HW.initVideos('.hw-vid-critical .hw-vid-player');
};

HW.domReady(HW.initNonCriticalVideos);

	HW.initCriticalVideos();

// if (HW.isModule1Ready === true) {
// 	console.log('MODULE READY');
// 	HW.initCriticalVideos();
// } else {
// 	// Listen for module1ready event
// 	window.addEventListener('module1Ready', function () {
// 		HW.initCriticalVideos();
// 	});
// }
	