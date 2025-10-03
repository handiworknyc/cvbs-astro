
function horizontalLoop(items, config) {
  let timeline;
  items = gsap.utils.toArray(items);
  config = config || {};
  gsap.context(() => { // use a context so that if this is called from within another context or a gsap.matchMedia(), we can perform proper cleanup like the "resize" event handler on the window
	let onChange = config.onChange,
	  lastIndex = 0,
	  tl = gsap.timeline({repeat: config.repeat, onUpdate: onChange && function() {
		  let i = tl.closestIndex();
		  if (lastIndex !== i) {
			lastIndex = i;
			onChange(items[i], i);
		  }
		}, paused: config.paused, defaults: {ease: "none"}, onReverseComplete: () => tl.totalTime(tl.rawTime() + tl.duration() * 100)}),
	  length = items.length,
	  startX = items[0].offsetLeft,
	  times = [],
	  widths = [],
	  spaceBefore = [],
	  xPercents = [],
	  curIndex = 0,
	  indexIsDirty = false,
	  center = config.center,
	  pixelsPerSecond = (config.speed || .29) * 100,
	  snap = config.snap === false ? v => v : gsap.utils.snap(config.snap || 1), // some browsers shift by a pixel to accommodate flex layouts, so for example if width is 20% the first element's width might be 242px, and the next 243px, alternating back and forth. So we snap to 5 percentage points to make things look more natural
	  timeOffset = 0,
	  container = center === true ? items[0].parentNode : gsap.utils.toArray(center)[0] || items[0].parentNode,
	  totalWidth,
	  getTotalWidth = () => items[length-1].offsetLeft + xPercents[length-1] / 100 * widths[length-1] - startX + spaceBefore[0] + items[length-1].offsetWidth * gsap.getProperty(items[length-1], "scaleX") + (parseFloat(config.paddingRight) || 0),
	  populateWidths = () =>  {
		const containerBox = container.getBoundingClientRect();
	  
		// reset so refresh() doesn't accumulate a bogus extra entry
		spaceBefore.length = 0;
	  
		let lastRight = null;
	  
		items.forEach((el, i) => {
		  const box = el.getBoundingClientRect();
		  widths[i] = box.width;
	  
		  xPercents[i] = snap(
			parseFloat(gsap.getProperty(el, "x", "px")) / widths[i] * 100 +
			gsap.getProperty(el, "xPercent")
		  );
	  
		  if (i > 0) {
			// normal gaps between consecutive items
			spaceBefore[i] = box.left - lastRight;
		  }
		  lastRight = box.right;
		});
	  
		// --- fix the seam gap: LAST → FIRST ---
		const firstBox = items[0].getBoundingClientRect();
		const lastBox  = items[items.length - 1].getBoundingClientRect();
	  
 	 	const style = getComputedStyle(container);
		  // returns e.g. "24px"
		  const gap = parseFloat(style.columnGap || style.gap || 0);

	  	
		spaceBefore[0] = gap; // <-- critical change
	  
		gsap.set(items, { xPercent: i => xPercents[i] });
		totalWidth = getTotalWidth();
	  },
	  timeWrap,
	  populateOffsets = () => {
		timeOffset = center ? tl.duration() * (container.offsetWidth / 2) / totalWidth : 0;
		center && times.forEach((t, i) => {
		  times[i] = timeWrap(tl.labels["label" + i] + tl.duration() * widths[i] / 2 / totalWidth - timeOffset);
		});
	  },
	  getClosest = (values, value, wrap) => {
		let i = values.length,
		  closest = 1e10,
		  index = 0, d;
		while (i--) {
		  d = Math.abs(values[i] - value);
		  if (d > wrap / 2) {
			d = wrap - d;
		  }
		  if (d < closest) {
			closest = d;
			index = i;
		  }
		}
		return index;
	  },
	  populateTimeline = () => {
		let i, item, curX, distanceToStart, distanceToLoop;
		tl.clear();
		for (i = 0; i < length; i++) {
		  item = items[i];
		  curX = xPercents[i] / 100 * widths[i];
		  distanceToStart = item.offsetLeft + curX - startX + spaceBefore[0];
		  distanceToLoop = distanceToStart + widths[i] * gsap.getProperty(item, "scaleX");
		  
		  tl.to(item, {xPercent: snap((curX - distanceToLoop) / widths[i] * 100), duration: distanceToLoop / pixelsPerSecond}, 0)
			.fromTo(item, {xPercent: snap((curX - distanceToLoop + totalWidth) / widths[i] * 100)}, {xPercent: xPercents[i], duration: (curX - distanceToLoop + totalWidth - curX) / pixelsPerSecond, immediateRender: false}, distanceToLoop / pixelsPerSecond)
			.add("label" + i, distanceToStart / pixelsPerSecond);
		  times[i] = distanceToStart / pixelsPerSecond;
		}
		timeWrap = gsap.utils.wrap(0, tl.duration());
	  },
	  refresh = (deep) => {
		let progress = tl.progress();
		tl.progress(0, true);
		gsap.set(items, { xPercent: 0, x: 0 }); 
		populateWidths();
		deep && populateTimeline();
		populateOffsets();
		deep && tl.draggable && tl.paused() ? tl.time(times[curIndex], true) : tl.progress(progress, true);
	  },
	  onResize = () => refresh(true),
	  proxy;
	gsap.set(items, {x: 0});
	
	populateWidths();
	populateTimeline();
	populateOffsets();
	
	window.addEventListener("resize", onResize);
	function toIndex(index, vars) {
	  vars = vars || {};
	  (Math.abs(index - curIndex) > length / 2) && (index += index > curIndex ? -length : length); // always go in the shortest direction
	  let newIndex = gsap.utils.wrap(0, length, index),
		time = times[newIndex];
	  if (time > tl.time() !== index > curIndex && index !== curIndex) { // if we're wrapping the timeline's playhead, make the proper adjustments
		time += tl.duration() * (index > curIndex ? 1 : -1);
	  }
	  if (time < 0 || time > tl.duration()) {
		vars.modifiers = {time: timeWrap};
	  }
	  curIndex = newIndex;
	  vars.overwrite = true;
	  gsap.killTweensOf(proxy);    
	  return vars.duration === 0 ? tl.time(timeWrap(time)) : tl.tweenTo(time, vars);
	}
	tl.toIndex = (index, vars) => toIndex(index, vars);
	tl.closestIndex = setCurrent => {
	  let index = getClosest(times, tl.time(), tl.duration());
	  if (setCurrent) {
		curIndex = index;
		indexIsDirty = false;
	  }
	  return index;
	};
	tl.current = () => indexIsDirty ? tl.closestIndex(true) : curIndex;
	tl.next = vars => toIndex(tl.current()+1, vars);
	tl.previous = vars => toIndex(tl.current()-1, vars);
	tl.times = times;
	tl.progress(1, true).progress(0, true); // pre-render for performance
	if (config.reversed) {
	  tl.vars.onReverseComplete();
	  tl.reverse();
	}
	if (config.draggable && typeof(Draggable) === "function") {
	  proxy = document.createElement("div")
	  let wrap = gsap.utils.wrap(0, 1),
		ratio, startProgress, draggable, dragSnap, lastSnap, initChangeX, wasPlaying,
		align = () => tl.progress(wrap(startProgress + (draggable.startX - draggable.x) * ratio)),
		syncIndex = () => tl.closestIndex(true);
	  typeof(InertiaPlugin) === "undefined" && console.warn("InertiaPlugin required for momentum-based scrolling and snapping. https://greensock.com/club");
	  draggable = Draggable.create(proxy, {
		trigger: items[0].parentNode,
		type: "x",
		onPressInit() {
		  let x = this.x;
		  gsap.killTweensOf(tl);
		  wasPlaying = !tl.paused();
		  tl.pause();
		  startProgress = tl.progress();
		  refresh();
		  ratio = 1 / totalWidth;
		  initChangeX = (startProgress / -ratio) - x;
		  gsap.set(proxy, {x: startProgress / -ratio});
		 // console.log('Press'); 

		},
		onDrag: align,
		onThrowUpdate: align,
		overshootTolerance: 0,
		inertia: true,
		snap: config.snap === false ? null : function(value) {
		  if (Math.abs(startProgress / -ratio - this.x) < 10) {
			return lastSnap + initChangeX;
		  }
		  let time = -(value * ratio) * tl.duration(),
			  wrappedTime = timeWrap(time),
			  snapTime = times[getClosest(times, wrappedTime, tl.duration())],
			  dif = snapTime - wrappedTime;
		  Math.abs(dif) > tl.duration() / 2 && (dif += dif < 0 ? tl.duration() : -tl.duration());
		  lastSnap = (time + dif) / tl.duration() / -ratio;
		  return lastSnap;
		},
		onRelease() {
		  syncIndex();
		  draggable.isThrowing && (indexIsDirty = true);		 
		 // console.log('RELEASE'); 
		   tl.play();
		},
		onThrowComplete: () => {
		  syncIndex();
		//  console.log('THROW COMPLETE'); 

		  tl.play();
		}
	  })[0];
	  tl.draggable = draggable;
	}
	tl.closestIndex(true);
	lastIndex = curIndex;
	onChange && onChange(items[curIndex], curIndex);
	timeline = tl;
	return () => window.removeEventListener("resize", onResize); // cleanup
  });
  return timeline;
}

HW._mqWrapCache	= HW._mqWrapCache || new Map();	// key: el.id, value: sanitized HTML string
	HW.mqTls		= HW.mqTls || {};					// key: el.id, value: gsap timeline
	HW.mqSts		= HW.mqSts || {};					// key: el.id, value: ScrollTrigger
	HW.didMqCache	= !!HW.didMqCache;
	
	const $mqsInit = () => document.querySelectorAll('.mq-wrap');
	
	// sanitize & cache once per element
	function cacheMqOuterHTML(me) {
		if (!me.id) me.id = 'mq-' + Math.random().toString(36).slice(2, 11);
		if (HW._mqWrapCache.has(me.id)) return;
	
		// Clone light, mutate clone, serialize once
		const tmp = me.cloneNode(true);
		tmp.querySelectorAll('.video-js').forEach(el => el.remove());
		tmp.querySelectorAll('.has-vid').forEach(el => el.classList.remove('has-vid'));
		HW._mqWrapCache.set(me.id, tmp.outerHTML);
	}
	
	function restoreFromCache(id) {
		const html = HW._mqWrapCache.get(id);
		if (!html) return;
		const currentEl = document.getElementById(id);
		if (!currentEl) return;
		const parent = currentEl.parentNode;
		currentEl.remove();
		parent.insertAdjacentHTML('beforeend', html);
	}
	
	function killAllTimelines() {
		if (!HW.mqTls) return;
		Object.values(HW.mqTls).forEach(tl => tl && tl.kill());
		HW.mqTls = {};
		// also kill any STs we created
		if (HW.mqSts) {
			Object.values(HW.mqSts).forEach(st => st && st.kill());
			HW.mqSts = {};
		}
	}
	
	// Single measurement pass per marquee (separating reads & writes)
	function measureItems(me, items) {
		// READS ONLY
		let totalX = 0;
		let tallest = 0;
		const widths = new Array(items.length);
		const heights = new Array(items.length);
	
		for (let i = 0; i < items.length; i++) {
			const it = items[i];
			const w = it.offsetWidth;	// forces layout once per item
			const h = it.offsetHeight;
			widths[i] = w;
			heights[i] = h;
			totalX += w;
			if (h > tallest) tallest = h;
		}
		return { widths, heights, totalX, tallest };
	}
	
	function writeItemLayout(me, items, widths, tallest) {
		// WRITES ONLY (use quickSetter to avoid per-call overhead)
		const setX	= gsap.quickSetter(items, 'x', 'px');
		const setW	= gsap.quickSetter(items, 'width', 'px');
		const setH	= gsap.quickSetter(items, 'height', 'px');
	
		let cursor = 0;
		for (let i = 0; i < items.length; i++) {
			setX(cursor);
			setW(widths[i]);
			setH(tallest);
			cursor += widths[i];
		}
	}

	// Helper: allow overriding ScrollTrigger start/end via data attributes with sensible defaults
function parseSTBounds(el, defStart, defEnd) {
	const DEF_START = defStart || 'top bottom-=30%';
	const DEF_END   = defEnd   || 'bottom top+=35%';

	// prefer explicit attributes
	let start = el.getAttribute('data-st-start') ?? el.dataset?.stStart ?? '';
	let end   = el.getAttribute('data-st-end')   ?? el.dataset?.stEnd   ?? '';

	// allow a single combined attribute: data-st="START | END" or "START, END"
	const combined = el.getAttribute('data-st') ?? '';
	if ((!start || !start.trim()) || (!end || !end.trim())) {
		if (combined && combined.trim()) {
			let parts = combined.split('|');
			if (parts.length < 2) parts = combined.split(',');
			if (parts.length >= 2) {
				start = start && start.trim() ? start : parts[0].trim();
				end   = end   && end.trim()   ? end   : parts[1].trim();
			}
		}
	}

	start = (start && start.trim()) ? start.trim() : DEF_START;
	end   = (end   && end.trim())   ? end.trim()   : DEF_END;

	return { start, end };
}

function executeMarqueeLogic(me) {
	const myid = me.id || (me.id = 'mq-' + Math.random().toString(36).slice(2, 11));
	const items = me.querySelectorAll('.mq-item');
	const itemCount = items.length;
	if (!itemCount) return;

	console.log(me);
	console.log('1231312asdassd');
	let mydur = parseFloat(me.getAttribute('data-dur') || '45.25');

	// clear any previous inline styles via GSAP
	gsap.set(me, { clearProps: true });
	gsap.set(items, { clearProps: true });

	// ---- MEASURE (reads) ----
	const { widths, heights, totalX, tallest } = measureItems(me, items);

	// ---- early exit: not enough width to marquee ----
	const outerPar = me.closest('.mq-outer') || me.parentElement;
	const containerWidth = outerPar ? outerPar.clientWidth : window.innerWidth;
	if (totalX <= (containerWidth - 100) && !me.classList.contains('always-mq')) {
		me.classList.remove('has-slider');
		me.classList.add('no-slider');
		outerPar && outerPar.classList.add('no-slider');
		// clean any previous timeline/trigger
		if (HW.mqTls[myid]) { HW.mqTls[myid].kill(); delete HW.mqTls[myid]; }
		if (HW.mqSts[myid]) { HW.mqSts[myid].kill(); delete HW.mqSts[myid]; }
		return;
	}

	// ---- WRITES ----
	// item placement
	writeItemLayout(me, items, widths, tallest);

	// outer height (use computed paddings once)
	const cs = getComputedStyle(me);
	const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
	const totalH = tallest + pad;
	outerPar && gsap.set(outerPar, { height: totalH > 0 ? totalH : 'auto' });

	// ensure classes
	me.classList.remove('no-slider');
	me.classList.add('has-slider');
	outerPar && outerPar.classList.remove('no-slider');

	// kill previous TL / ST for this id (if any)
	if (HW.mqTls[myid]) { HW.mqTls[myid].kill(); delete HW.mqTls[myid]; }
	if (HW.mqSts[myid]) { HW.mqSts[myid].kill(); delete HW.mqSts[myid]; }

	// build loop timeline (paused; draggable true)
	HW.mqTls[myid] = horizontalLoop(items, {
		paused: true,
		draggable: true,
		snap: false
	});

	// optional: primer seek to avoid identical start
	HW.mqTls[myid].seek(6);

	// resolve start/end from data-* (with defaults)
	const { start, end } = parseSTBounds(me, 'top bottom-=30%', 'bottom top+=35%');

	// build a single ST tied to this marquee
	HW.mqSts[myid] = ScrollTrigger.create({
		id: 'st-' + myid,
		trigger: me,
		start,
		end,
		onEnter:     () => HW.mqTls[myid] && HW.mqTls[myid].play(),
		onEnterBack: () => HW.mqTls[myid] && HW.mqTls[myid].play(),
		onLeave:     () => HW.mqTls[myid] && HW.mqTls[myid].pause(),
		onLeaveBack: () => HW.mqTls[myid] && HW.mqTls[myid].pause()
	});
}

// Utility: check min/max classes once
function passesBreakpoint(me, ww) {
	const cls = me.className;
	const min = cls.match(/mq-wrap-min-(\d+)/);
	if (min && ww >= parseInt(min[1], 10)) return true;
	const max = cls.match(/mq-wrap-max-(\d+)/);
	if (max && ww <= parseInt(max[1], 10)) return true;
	if (!min && !max) return true;
	return false;
}

HW.mqInit = function() {
	const doIt = function() {
		// Kill previous timelines & triggers in O(n)
		killAllTimelines();

		const ww = window.innerWidth;
		let $mqs = $mqsInit();

		if (!$mqs.length) return;

		// first-run sanitize/cache (once per element lifetime)
		if (!HW.didMqCache) {
			$mqs.forEach(me => cacheMqOuterHTML(me));
			HW.didMqCache = true;
		} else {
			// fast restore from cache (only if element still mounted)
			HW._mqWrapCache.forEach((_, id) => restoreFromCache(id));
			$mqs = $mqsInit(); // re-query after restore
			// any dependent inline inits
			HW.hwIntchInit && HW.hwIntchInit();
		}

		// Loop marquees once, minimal reads/writes inside execute
		$mqs.forEach(me => {
			const outerPar = me.closest('.mq-outer') || me.parentElement;

			if (passesBreakpoint(me, ww)) {
				me.classList.remove('no-slider');
				outerPar && outerPar.classList.remove('no-slider');
				executeMarqueeLogic(me);
			} else {
				me.classList.add('no-slider');
				outerPar && outerPar.classList.add('no-slider');
				gsap.set(me, { clearProps: true });
				gsap.set(me.querySelectorAll('.mq-item'), { clearProps: true });
			}

			me.classList.remove('first-load');
		});
	};

	// tiny debounce to allow layout settle (fonts/images)
	HW.requestTimeout ? HW.requestTimeout(doIt, 100) : setTimeout(doIt, 100);
};

// Initial run
HW.mqInit();
















HW.theWrappedLines = false;

HW.wrapChars = function(){
		if(HW.theWrappedLines !== false) {
			HW.theWrappedLines.revert();
		}

		// if (window.innerWidth <= 1199) {
		// 	document.querySelectorAll(".wrap-lines br").forEach(br => {
		// 		let space = document.createTextNode(" &nbsp;");
		// 		br.replaceWith(space);
		// 	});
		// }

		
		HW.theWrappedLines = new SplitText(".wrap-chars", { type: "chars, words", charsClass: "charParent", preserveWhitespace: true });


		// loop($$('.lineParent'), function(me){
		// 	var theid = [...Array(10)].map(() => Math.random().toString(36)[2]).join('');
		// 	me.id = 'linepar-' + theid;
		// 	gsap.set(me, {'--lineProg' : 0})
		// })
		
		var $thywrapped = $$('.wrap-chars');
		
		HW.lineOpacAnim = function() {
			
			var doIt = function() {
				if (typeof HW.lineOpacAnimTls !== 'undefined' && Object.keys(HW.lineOpacAnimTls).length > 0) {
					loop(Object.keys(HW.lineOpacAnimTls), function(el) {
						for (const key in HW.lineOpacAnimTls) {
							if (HW.lineOpacAnimTls.hasOwnProperty(key)) {
								HW.lineOpacAnimTls[key].kill();
							}
						}
					});
				}
				HW.lineOpacAnimTls = {};
		
				var windowWidth = window.innerWidth;
		
				if ($thywrapped.length > 0) {
					loop($thywrapped, function(me) {
						var myid = me.id,
							lines = $$('.charParent', me);

						// Create a GSAP timeline
						HW.lineOpacAnimTls[myid] = gsap.timeline({
							scrollTrigger: {
								trigger: me,
								start: "top bottom-=5%", // Adjust trigger point
								end: "bottom top+=70%", // Adjust end point
								scrub: true, // Smooth animation tied to scroll
							},
						});
						
						// Animate each lineParent with stagger
						HW.lineOpacAnimTls[myid].to(lines, {
							ease: 'power1.inOut',
							"--charProg": 1, // CSS variable update
							duration: 2.5, // Adjust duration
							stagger: 0.15, // Adjust stagger effect
						});						

					});
				}
			}
			
			HW.requestTimeout(doIt, 100);
		}
		
		HW.lineOpacAnim();
};



HW.wrapChars();








function initAreaCardImages(containerSelector = '.area-card-inner') {
	const cards = document.querySelectorAll(containerSelector);
	if (!cards.length) return;

	cards.forEach(card => {
		const imgLayers = Array.from(card.querySelectorAll('.area-cart-img-inner'));
		if (!imgLayers.length) return;

		// Ensure first image is visible by default
		let active = imgLayers.findIndex(el => el.classList.contains('is-active'));
		if (active < 0) {
			active = 0;
			imgLayers[0].classList.add('is-active');
		}

		let raf = 0;
		let nextIndex = active;

		function onEnter(e) {
			const item = e.target.closest('.area-card-list-item');
			if (!item || !card.contains(item)) return;

			const index = [...item.parentNode.children].indexOf(item);
			if (index < 0 || index === nextIndex) return;

			nextIndex = index;

			if (!raf) {
				raf = requestAnimationFrame(() => {
					raf = 0;
					if (nextIndex === active) return;
					imgLayers[active]?.classList.remove('is-active');
					imgLayers[nextIndex]?.classList.add('is-active');
					active = nextIndex;
				});
			}
		}

		function preload(imgEl) {
			if (!imgEl || imgEl.dataset.predecoded) return;
			imgEl.decode?.()
				.catch(() => {})
				.finally(() => {
					imgEl.dataset.predecoded = '1';
				});
		}

		card.addEventListener('mouseenter', onEnter, { passive: true });
		card.addEventListener('mousemove', onEnter, { passive: true });

		card.addEventListener('mouseenter', () => {
			const img = imgLayers[nextIndex]?.querySelector('img');
			preload(img);
		}, { passive: true });
	});
}

// usage:
initAreaCardImages();


















var statcount = 0;

var curpar = false;

function numberWithCommas(n) {
	var parts=n.toString().split(".");
	return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

loop($$(".stat-section"), function(el){
	
	if(el.closest('.hw-slides') && HW.indexInParent(el, '.stat-section') > 1 ) {
		return;
	}
	var $nums = $$('.stat-num', el);
	
	if($nums.length > 0) {
		
		loop($nums, function(stat){
			var	zero = {val:0},
				num = parseFloat(stat.getAttribute('data-num')),
				split = (num + "").split("."),
				decimals = split.length > 1 ? split[1].length : 0,
				del = .05,
				mypar = stat.closest('.stat-outer'),
				$mycard = stat.closest('.card-inner'),
				nocomma = stat.classList.contains('no-comma');
			//console.log(num);

			if($mycard == null) {
				$mycard = stat.closest('.stat-card');
			}
			
			$mycard.classList.add('has-stat');
		
/*
		if(curpar !== false && mypar.isSameNode(curpar)) {
			del = .15;
		}
			
*/
		var mydelay = (statcount + 1) * del,
			mystarty = "bottom bottom+=5%";						
		
		if(el.closest('.rowindex-1')) {
			mystarty = "top center";
		}

		var $mycard = stat.closest('.card-inner');
		
		
		if($mycard == null) {
			$mycard = stat.closest('.stat-card');
		}
		
		gsap.set($mycard, {opacity: 0})
		
		var statOpts = {
				duration: 1,
				ease: "Power4.easeOut",
				delay: mydelay,
				scrollTrigger: {
					//scroller: '#smooth-content',
					trigger: el,
					start: mystarty,
				},
				onStart: function(){
					gsap.to($mycard, {opacity: 1, delay: mydelay, duration: 1, ease: 'power2.out'})
				}
			};

			if(num >= 1000) {
				statOpts.innerText = 0;
				statOpts.roundProps = "innerText";
				

				statOpts.onUpdate = function() {
					var myval = gsap.getProperty(stat, "innerText");
					
					if(nocomma) {
						stat.innerText = myval;
					} else {
						stat.innerText = numberWithCommas(myval);
					}
				}
			
				gsap.from(stat, statOpts, '<');	
			} else {
				statOpts.val = num;
				statOpts.onUpdate = function() {
					stat.innerText = zero.val.toFixed(decimals);
				};

				gsap.to(zero, statOpts);
			}
			
			
			statcount++;	
			
			curpar = mypar;					
		});

	}
});
			


















		HW.vertMqCache = HW.vertMqCache || [];
		HW.vertMqTimelines = HW.vertMqTimelines || [];
		HW.vertMqTriggers = HW.vertMqTriggers || [];
		HW.vertMqWrapper = HW.vertMqWrapper || null;
		
		function debounce(func, wait) {
			let timeout;
			return function () {
				const context = this, args = arguments;
				clearTimeout(timeout);
				timeout = setTimeout(function () {
					func.apply(context, args);
				}, wait);
			};
		}
		
		HW.vertMq = function () {
			if (!HW.vertMqCache.length) {
				document.querySelectorAll('.vert-mq-container').forEach(container => {
					const clone = container.cloneNode(true);
					clone.querySelectorAll('[data-src]').forEach(img => {
						img.setAttribute('src', img.getAttribute('data-src'));
						img.removeAttribute('data-src');
					});
					HW.vertMqCache.push(clone);
					if (!HW.vertMqWrapper) {
						HW.vertMqWrapper = container.parentNode;
					}
				});
			} else {
				HW.vertMqWrapper.querySelectorAll('.vert-mq-container').forEach(el => el.remove());
				HW.vertMqCache.forEach(clone => {
					HW.vertMqWrapper.insertBefore(clone.cloneNode(true), HW.vertMqWrapper.firstChild);
				});
			}
		
			if (window.innerWidth < 775) {
				HW.vertMqTimelines.forEach(tl => tl.kill());
				HW.vertMqTimelines = [];
				HW.vertMqTriggers.forEach(st => st.kill());
				HW.vertMqTriggers = [];
				document.querySelectorAll('.vert-mq-container').forEach(c => c.classList.remove('active'));
				return;
			}
		
			HW.vertMqTimelines.forEach(tl => tl.kill());
			HW.vertMqTimelines = [];
			HW.vertMqTriggers.forEach(st => st.kill());
			HW.vertMqTriggers = [];
			document.querySelectorAll('.vert-mq-container').forEach(c => c.classList.remove('active'));
		
			document.querySelectorAll('.vert-mq-container').forEach(container => {
				const tracks = container.querySelectorAll('.vert-mq-track');
				const tls = [];
				tracks.forEach((track, i) => {
					const speed = 40;
					const items = track.querySelectorAll('.vert-mq-item');
					const tl = verticalLoop(items, i % 2 ? speed : -speed);
					tl.pause();
					HW.vertMqTimelines.push(tl);
					tls.push(tl);
				});
				const st = ScrollTrigger.create({
					trigger: container,
					start: 'top bottom',
					end: 'bottom top',
					onEnter: () => { container.classList.add('active'); tls.forEach(t => t.play()); },
					onEnterBack: () => { container.classList.add('active'); tls.forEach(t => t.play()); },
					onLeave: () => { container.classList.remove('active'); tls.forEach(t => t.pause()); },
					onLeaveBack: () => { container.classList.remove('active'); tls.forEach(t => t.pause()); },
					invalidateOnRefresh: true
				});
				HW.vertMqTriggers.push(st);
			});
		
			function verticalLoop(elements, speed) {
				elements = gsap.utils.toArray(elements);
				elements.forEach(el => {
					const clone = el.cloneNode(true);
					el.parentNode.appendChild(clone);
				});
				elements = gsap.utils.toArray(elements[0].parentNode.children);
				const firstBounds = elements[0].getBoundingClientRect(),
					lastBounds = elements[elements.length - 1].getBoundingClientRect();
				const gap = parseFloat(getComputedStyle(elements[0]).marginBottom) || 0;
				const top = firstBounds.top,
					bottom = lastBounds.bottom + gap,
					distance = bottom - top,
					duration = Math.abs(distance / speed),
					tl = gsap.timeline({ repeat: -1 }),
					plus = speed < 0 ? "-=" : "+=",
					minus = speed < 0 ? "+=" : "-=";
				elements.forEach(el => {
					let bounds = el.getBoundingClientRect(),
						ratio = Math.abs((bottom - (bounds.bottom + gap)) / distance);
					if (speed < 0) ratio = 1 - ratio;
					tl.to(el, {
						y: plus + distance * ratio,
						duration: duration * ratio,
						ease: 'none'
					}, 0);
					tl.fromTo(el, { y: minus + distance }, {
						y: plus + (1 - ratio) * distance,
						duration: (1 - ratio) * duration,
						ease: 'none',
						immediateRender: false
					}, duration * ratio);
				});
				return tl;
			}
		};
		
		HW.vertMq();
			
			




















HW.oldWidth = window.innerWidth;

var resizedonce = false;

HW.globalResize = function(){		
	if ((HW.isMobile == true || HW.isIpad == true) && window.innerWidth == HW.oldWidth) {
		return;
	}
	
	if(resizedonce == false) {
		resizedonce = true;
	}

	HW.$html.classList.add('hw-global-resizing');

	//HW.mobClass(window.innerWidth, HW.oldWidth);
	//HW.headerHeightPad();

	if(HW.isMobile == false && HW.isIpad == false) {
		
		HW.windowHeight = HW.getWinDims().height;
		HW.windowWidth = HW.getWinDims().width;
		
		HW.setVhUnits();
		HW.roundVwProps();
		//HW.wrapChars();
	} 


/*
	if ((window.innerWidth >= 1200 && HW.oldWidth < 1200) || (window.innerWidth < 1200 && HW.oldWidth >= 1200) || (window.innerheight >= 700 && HW.oldheight < 700) || (window.innerheight < 700 && HW.oldheight >= 700)) {		
		location.reload();
	}
*/

	if ((window.innerWidth != HW.oldWidth && (HW.isMobile == true || HW.isIpad == true)) || (HW.isMobile !== true && HW.isIpad !== true)) {	
		//HW.setHeaderVar();
		//HW.setElementHeightVar('.service-area-banner-title-half');
		
		if(typeof HW.setProjectSliderVar !== 'undefined') {
			HW.setProjectSliderVar();		
		}

		HW.vertMq();
		//HW.doTlTimeline();
		//HW.appendCharsToElements();
		HW.mqInit();
		//HW.mqHome2Init();
		
		
		if(typeof HW.fullbleedEls !== 'undefined') {
			var mydims = HW.setFullBleedDims(null, null, {w: 15, h: 10});
			
			loop(HW.fullbleedEls, function(el){
				HW[el].style.height = (mydims.height/12) + 'rem';
				HW[el].style.width = (mydims.width/12) + 'rem';
			});					
		}
		

		if(HW.oldWidth <= 1024 && window.innerWidth >= 1024) { 
			var $shown = document.querySelectorAll('#main-nav.show');
		
			
			if($shown.length > 0) {
				HW.isClosing = true;
				HW.triggerEvent($navtoggle, 'click');				
			}
		}
		
		if(HW.isMobile == true || HW.isIpad == true) {
			HW.setVhUnits();
			HW.roundVwProps();
			//HW.wrapChars();
		}
		
		
		if(window.innerWidth < 1100 && (HW.$html.classList.contains('multi-modal-open-nav-menu-item-15610-modal') || HW.$html.classList.contains('multi-modal-open-nav-menu-item-18287-modal'))) {
			$$('.multi-modal-tog')[0].classList.remove('active');	
		
			loop($$('.sub-menu-modal.show'), function(el){

/*
				if(typeof HW.tempVars[el.id] == 'undefined') {
					HW.tempVars[el.id] = new BSN.Modal(el);
				}
*/

				//HW.tempVars[el.id].hide();					
			});
		}		

			HW.createMarqueeSlider(); 

			HW.oldWidth = window.innerWidth;
		
			var Alltrigger = ScrollTrigger.getAll();
	
			for (let i = 0; i < Alltrigger.length; i++) {
				Alltrigger[i].refresh();				
			}		    
		//}, 500);	
	}
	
	var winwidth = HW.windowWidth;

	HW.requestTimeout(function(){
		HW.$html.classList.remove('hw-global-resizing');
	}, 2000);
	
	if(winwidth < 992) {

	}
};
// Resize Event
window.addEventListener("resize", debounce(HW.globalResize, 500));
