/* -----------------------------------------
   THEME CORE + HELPERS (unchanged behavior)
----------------------------------------- */

function horizontalLoop(items, config) {
  let timeline;
  items = gsap.utils.toArray(items);
  config = config || {};
  gsap.context(() => {
    let onChange = config.onChange,
      lastIndex = 0,
      tl = gsap.timeline({
        repeat: config.repeat,
        onUpdate: onChange && function () {
          let i = tl.closestIndex();
          if (lastIndex !== i) {
            lastIndex = i;
            onChange(items[i], i);
          }
        },
        paused: config.paused,
        defaults: { ease: "none" },
        onReverseComplete: () => tl.totalTime(tl.rawTime() + tl.duration() * 100),
      }),
      length = items.length,
      startX = items[0].offsetLeft,
      times = [],
      widths = [],
      spaceBefore = [],
      xPercents = [],
      curIndex = 0,
      indexIsDirty = false,
      center = config.center,
      pixelsPerSecond = (config.speed || 0.29) * 100,
      snap =
        config.snap === false
          ? (v) => v
          : gsap.utils.snap(config.snap || 1),
      timeOffset = 0,
      container =
        center === true
          ? items[0].parentNode
          : gsap.utils.toArray(center)[0] || items[0].parentNode,
      totalWidth,
      getTotalWidth = () =>
        items[items.length - 1].offsetLeft +
        (xPercents[items.length - 1] / 100) * widths[items.length - 1] -
        startX +
        spaceBefore[0] +
        items[items.length - 1].offsetWidth * gsap.getProperty(items[items.length - 1], "scaleX") +
        (parseFloat(config.paddingRight) || 0),
      populateWidths = () => {
        const containerBox = container.getBoundingClientRect();

        spaceBefore.length = 0;

        let lastRight = null;

        items.forEach((el, i) => {
          const box = el.getBoundingClientRect();
          widths[i] = box.width;

          xPercents[i] = snap(
            (parseFloat(gsap.getProperty(el, "x", "px")) / widths[i]) * 100 +
              gsap.getProperty(el, "xPercent"),
          );

          if (i > 0) {
            spaceBefore[i] = box.left - lastRight;
          }
          lastRight = box.right;
        });

        const style = getComputedStyle(container);
        const gap = parseFloat(style.columnGap || style.gap || 0);
        spaceBefore[0] = gap;

        gsap.set(items, { xPercent: (i) => xPercents[i] });
        totalWidth = getTotalWidth();
      },
      timeWrap,
      populateOffsets = () => {
        timeOffset = center
          ? (tl.duration() * (container.offsetWidth / 2)) / totalWidth
          : 0;
        center &&
          times.forEach((t, i) => {
            times[i] = timeWrap(
              tl.labels["label" + i] +
                (tl.duration() * widths[i]) / 2 / totalWidth -
                timeOffset,
            );
          });
      },
      getClosest = (values, value, wrap) => {
        let i = values.length,
          closest = 1e10,
          index = 0,
          d;
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
          curX = (xPercents[i] / 100) * widths[i];
          distanceToStart = item.offsetLeft + curX - startX + spaceBefore[0];
          distanceToLoop =
            distanceToStart + widths[i] * gsap.getProperty(item, "scaleX");

          tl.to(
            item,
            {
              xPercent: snap(((curX - distanceToLoop) / widths[i]) * 100),
              duration: distanceToLoop / pixelsPerSecond,
            },
            0,
          )
            .fromTo(
              item,
              {
                xPercent: snap(
                  ((curX - distanceToLoop + totalWidth) / widths[i]) * 100,
                ),
              },
              {
                xPercent: xPercents[i],
                duration:
                  ((curX - distanceToLoop + totalWidth - curX) /
                    pixelsPerSecond),
                immediateRender: false,
              },
              distanceToLoop / pixelsPerSecond,
            )
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
        deep && tl.draggable && tl.paused()
          ? tl.time(times[curIndex], true)
          : tl.progress(progress, true);
      },
      onResize = () => refresh(true),
      proxy;

    gsap.set(items, { x: 0 });

    populateWidths();
    populateTimeline();
    populateOffsets();

    window.addEventListener("resize", onResize);

    function toIndex(index, vars) {
      vars = vars || {};
      Math.abs(index - curIndex) > length / 2 &&
        (index += index > curIndex ? -length : length);
      let newIndex = gsap.utils.wrap(0, length, index),
        time = times[newIndex];
      if ((time > tl.time()) !== index > curIndex && index !== curIndex) {
        time += tl.duration() * (index > curIndex ? 1 : -1);
      }
      if (time < 0 || time > tl.duration()) {
        vars.modifiers = { time: timeWrap };
      }
      curIndex = newIndex;
      vars.overwrite = true;
      gsap.killTweensOf(proxy);
      return vars.duration === 0
        ? tl.time(timeWrap(time))
        : tl.tweenTo(time, vars);
    }

    tl.toIndex = (index, vars) => toIndex(index, vars);
    tl.closestIndex = (setCurrent) => {
      let index = getClosest(times, tl.time(), tl.duration());
      if (setCurrent) {
        curIndex = index;
        indexIsDirty = false;
      }
      return index;
    };
    tl.current = () => (indexIsDirty ? tl.closestIndex(true) : curIndex);
    tl.next = (vars) => toIndex(tl.current() + 1, vars);
    tl.previous = (vars) => toIndex(tl.current() - 1, vars);
    tl.times = times;
    tl.progress(1, true).progress(0, true);
    if (config.reversed) {
      tl.vars.onReverseComplete();
      tl.reverse();
    }
    if (config.draggable && typeof Draggable === "function") {
      proxy = document.createElement("div");
      let wrap = gsap.utils.wrap(0, 1),
        ratio,
        startProgress,
        draggable,
        lastSnap,
        initChangeX,
        wasPlaying,
        align = () =>
          tl.progress(wrap(startProgress + (draggable.startX - draggable.x) * ratio)),
        syncIndex = () => tl.closestIndex(true);

      typeof InertiaPlugin === "undefined" &&
        console.warn(
          "InertiaPlugin required for momentum-based scrolling and snapping. https://greensock.com/club",
        );

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
          initChangeX = startProgress / -ratio - x;
          gsap.set(proxy, { x: startProgress / -ratio });
        },
        onDrag: align,
        onThrowUpdate: align,
        overshootTolerance: 0,
        inertia: true,
        snap: config.snap === false ? null : function (value) {
          if (Math.abs(startProgress / -ratio - this.x) < 10) {
            return lastSnap + initChangeX;
          }
          let time = -(value * ratio) * tl.duration(),
            wrappedTime = timeWrap(time),
            snapTime = times[getClosest(times, wrappedTime, tl.duration())],
            dif = snapTime - wrappedTime;
          Math.abs(dif) > tl.duration() / 2 &&
            (dif += dif < 0 ? tl.duration() : -tl.duration());
          lastSnap = (time + dif) / tl.duration() / -ratio;
          return lastSnap;
        },
        onRelease() {
          syncIndex();
          draggable.isThrowing && (indexIsDirty = true);
          tl.play();
        },
        onThrowComplete: () => {
          syncIndex();
          tl.play();
        },
      })[0];
      tl.draggable = draggable;
    }
    tl.closestIndex(true);
    lastIndex = curIndex;
    onChange && onChange(items[curIndex], curIndex);
    timeline = tl;
    return () => window.removeEventListener("resize", onResize);
  });
  return timeline;
}

/* ---------- marquee infra (unchanged) ---------- */
HW._mqWrapCache = HW._mqWrapCache || new Map();
HW.mqTls = HW.mqTls || {};
HW.mqSts = HW.mqSts || {};
HW.didMqCache = !!HW.didMqCache;

const $mqsInit = () => document.querySelectorAll(".mq-wrap");

function cacheMqOuterHTML(me) {
  if (!me.id) me.id = "mq-" + Math.random().toString(36).slice(2, 11);
  if (HW._mqWrapCache.has(me.id)) return;
  const tmp = me.cloneNode(true);
  tmp.querySelectorAll(".video-js").forEach((el) => el.remove());
  tmp.querySelectorAll(".has-vid").forEach((el) => el.classList.remove("has-vid"));
  HW._mqWrapCache.set(me.id, tmp.outerHTML);
}

function restoreFromCache(id) {
  const html = HW._mqWrapCache.get(id);
  if (!html) return;
  const currentEl = document.getElementById(id);
  if (!currentEl) return;
  const parent = currentEl.parentNode;
  currentEl.remove();
  parent.insertAdjacentHTML("beforeend", html);
}

function killAllTimelines() {
  if (!HW.mqTls) return;
  Object.values(HW.mqTls).forEach((tl) => tl && tl.kill());
  HW.mqTls = {};
  if (HW.mqSts) {
    Object.values(HW.mqSts).forEach((st) => st && st.kill());
    HW.mqSts = {};
  }
}

function measureItems(me, items) {
  let totalX = 0;
  let tallest = 0;
  const widths = new Array(items.length);
  const heights = new Array(items.length);

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const w = it.offsetWidth;
    const h = it.offsetHeight;
    widths[i] = w;
    heights[i] = h;
    totalX += w;
    if (h > tallest) tallest = h;
  }
  return { widths, heights, totalX, tallest };
}

function writeItemLayout(me, items, widths, tallest) {
  const setX = gsap.quickSetter(items, "x", "px");
  const setW = gsap.quickSetter(items, "width", "px");
  const setH = gsap.quickSetter(items, "height", "px");

  let cursor = 0;
  for (let i = 0; i < items.length; i++) {
    setX(cursor);
    setW(widths[i]);
    setH(tallest);
    cursor += widths[i];
  }
}

function executeMarqueeLogic(me) {
  const myid = me.id || (me.id = "mq-" + Math.random().toString(36).slice(2, 11));
  const items = me.querySelectorAll(".mq-item");
  const itemCount = items.length;
  if (!itemCount) return;

  let mydur = parseFloat(me.getAttribute("data-dur") || "45.25");

  gsap.set(me, { clearProps: true });
  gsap.set(items, { clearProps: true });

  const { widths, heights, totalX, tallest } = measureItems(me, items);

  const outerPar = me.closest(".mq-outer") || me.parentElement;
  const containerWidth = outerPar ? outerPar.clientWidth : window.innerWidth;
  if (totalX <= containerWidth - 100 && !me.classList.contains("always-mq")) {
    me.classList.remove("has-slider");
    me.classList.add("no-slider");
    outerPar && outerPar.classList.add("no-slider");
    if (HW.mqTls[myid]) {
      HW.mqTls[myid].kill();
      delete HW.mqTls[myid];
    }
    if (HW.mqSts[myid]) {
      HW.mqSts[myid].kill();
      delete HW.mqSts[myid];
    }
    return;
  }

  writeItemLayout(me, items, widths, tallest);

  const cs = getComputedStyle(me);
  const pad =
    (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const totalH = tallest + pad;
  outerPar && gsap.set(outerPar, { height: totalH > 0 ? totalH : "auto" });

  me.classList.remove("no-slider");
  me.classList.add("has-slider");
  outerPar && outerPar.classList.remove("no-slider");

  if (HW.mqTls[myid]) {
    HW.mqTls[myid].kill();
    delete HW.mqTls[myid];
  }
  if (HW.mqSts[myid]) {
    HW.mqSts[myid].kill();
    delete HW.mqSts[myid];
  }

  HW.mqTls[myid] = horizontalLoop(items, {
    paused: true,
    draggable: true,
    snap: false,
  });

  HW.mqTls[myid].seek(6);

  HW.mqSts[myid] = ScrollTrigger.create({
    id: "st-" + myid,
    trigger: me,
    start: "top bottom-=30%",
    end: "bottom top+=35%",
    onEnter: () => HW.mqTls[myid] && HW.mqTls[myid].play(),
    onEnterBack: () => HW.mqTls[myid] && HW.mqTls[myid].play(),
    onLeave: () => HW.mqTls[myid] && HW.mqTls[myid].pause(),
    onLeaveBack: () => HW.mqTls[myid] && HW.mqTls[myid].pause(),
  });
}

function passesBreakpoint(me, ww) {
  const cls = me.className;
  const min = cls.match(/mq-wrap-min-(\d+)/);
  if (min && ww >= parseInt(min[1], 10)) return true;
  const max = cls.match(/mq-wrap-max-(\d+)/);
  if (max && ww <= parseInt(max[1], 10)) return true;
  if (!min && !max) return true;
  return false;
}

HW.mqInit = function () {
  const doIt = function () {
    killAllTimelines();

    const ww = window.innerWidth;
    let $mqs = $mqsInit();

    if (!$mqs.length) return;

    if (!HW.didMqCache) {
      $mqs.forEach((me) => cacheMqOuterHTML(me));
      HW.didMqCache = true;
    } else {
      HW._mqWrapCache.forEach((_, id) => restoreFromCache(id));
      $mqs = $mqsInit();
      HW.hwIntchInit && HW.hwIntchInit();
    }

    $mqs.forEach((me) => {
      const outerPar = me.closest(".mq-outer") || me.parentElement;

      if (passesBreakpoint(me, ww)) {
        me.classList.remove("no-slider");
        outerPar && outerPar.classList.remove("no-slider");
        executeMarqueeLogic(me);
      } else {
        me.classList.add("no-slider");
        outerPar && outerPar.classList.add("no-slider");
        gsap.set(me, { clearProps: true });
        gsap.set(me.querySelectorAll(".mq-item"), { clearProps: true });
      }

      me.classList.remove("first-load");
    });
  };

  HW.requestTimeout ? HW.requestTimeout(doIt, 100) : setTimeout(doIt, 100);
};

/* ---------- SplitText / char wrapping ---------- */
HW.theWrappedLines = false;

HW.wrapChars = function () {
  if (HW.theWrappedLines !== false) {
    HW.theWrappedLines.revert();
  }

  HW.theWrappedLines = new SplitText(".wrap-chars", {
    type: "chars, words",
    charsClass: "charParent",
    preserveWhitespace: true,
  });

  var $thywrapped = $$(".wrap-chars");

  HW.lineOpacAnim = function () {
    var doIt = function () {
      if (typeof HW.lineOpacAnimTls !== "undefined" && Object.keys(HW.lineOpacAnimTls).length > 0) {
        loop(Object.keys(HW.lineOpacAnimTls), function (el) {
          for (const key in HW.lineOpacAnimTls) {
            if (HW.lineOpacAnimTls.hasOwnProperty(key)) {
              HW.lineOpacAnimTls[key].kill();
            }
          }
        });
      }
      HW.lineOpacAnimTls = {};

      if ($thywrapped.length > 0) {
        loop($thywrapped, function (me) {
          var myid = me.id,
            lines = $$(".charParent", me);

          HW.lineOpacAnimTls[myid] = gsap.timeline({
            scrollTrigger: {
              trigger: me,
              start: "top bottom-=5%",
              end: "bottom top+=70%",
              scrub: true,
            },
          });

          HW.lineOpacAnimTls[myid].to(lines, {
            ease: "power1.inOut",
            "--charProg": 1,
            duration: 2.5,
            stagger: 0.15,
          });
        });
      }
    };

    HW.requestTimeout(doIt, 100);
  };

  HW.lineOpacAnim();
};

/* ---------- Area card hover images (with teardown) ---------- */
function initAreaCardImagesWithTeardown(containerSelector = ".area-card-inner") {
  const cards = Array.from(document.querySelectorAll(containerSelector));
  if (!cards.length) return () => {};

  const listeners = [];

  const add = (el, type, fn, opts) => {
    el.addEventListener(type, fn, opts);
    listeners.push(() => el.removeEventListener(type, fn, opts));
  };

  cards.forEach((card) => {
    const imgLayers = Array.from(card.querySelectorAll(".area-cart-img-inner"));
    if (!imgLayers.length) return;

    let active = imgLayers.findIndex((el) => el.classList.contains("is-active"));
    if (active < 0) {
      active = 0;
      imgLayers[0].classList.add("is-active");
    }

    let raf = 0;
    let nextIndex = active;

    function onEnter(e) {
      const item = e.target.closest(".area-card-list-item");
      if (!item || !card.contains(item)) return;

      const index = [...item.parentNode.children].indexOf(item);
      if (index < 0 || index === nextIndex) return;

      nextIndex = index;

      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (nextIndex === active) return;
          imgLayers[active]?.classList.remove("is-active");
          imgLayers[nextIndex]?.classList.add("is-active");
          active = nextIndex;
        });
      }
    }

    function preload(imgEl) {
      if (!imgEl || imgEl.dataset.predecoded) return;
      imgEl
        .decode?.()
        .catch(() => {})
        .finally(() => {
          imgEl.dataset.predecoded = "1";
        });
    }

    function onMouseEnter() {
      const img = imgLayers[nextIndex]?.querySelector("img");
      preload(img);
    }

    add(card, "mouseenter", onEnter, { passive: true });
    add(card, "mousemove", onEnter, { passive: true });
    add(card, "mouseenter", onMouseEnter, { passive: true });
  });

  return () => {
    listeners.forEach((off) => {
      try {
        off();
      } catch {}
    });
  };
}

















/* -----------------------------------------
   THEME INIT / TEARDOWN WRAPPER (modified w/ MutationObserver)
----------------------------------------- */
window.HW = window.HW || {};

(function () {
  const GS = window.gsap;
  const ST = window.ScrollTrigger;
  const safe = (fn, ...args) => {
    try {
      return fn && fn(...args);
    } catch (_) {}
  };

  HW.__themeBootstrapped = HW.__themeBootstrapped || false;
  HW.__teardownFns = HW.__teardownFns || [];

  HW.themeTeardown = function () {
    // stop watcher first to avoid firing during teardown
    stopThemeObserver();

    // marquees
    safe(() => {
      if (HW.mqTls) {
        Object.values(HW.mqTls).forEach((tl) => tl && tl.kill());
        HW.mqTls = {};
      }
      if (HW.mqSts) {
        Object.values(HW.mqSts).forEach((st) => st && st.kill());
        HW.mqSts = {};
      }
    });

    // split text
    safe(() => {
      if (HW.theWrappedLines && typeof HW.theWrappedLines.revert === "function") {
        HW.theWrappedLines.revert();
        HW.theWrappedLines = false;
      }
      if (HW.lineOpacAnimTls) {
        Object.values(HW.lineOpacAnimTls).forEach((tl) => tl && tl.kill());
        HW.lineOpacAnimTls = {};
      }
    });

    // custom listeners
    safe(() => {
      if (HW.__teardownFns.length) {
        HW.__teardownFns.forEach((fn) => safe(fn));
        HW.__teardownFns = [];
      }
    });

    // optional global kill
    safe(() => ST && ST.killAll());
  };

  HW.themeInit = function () {
    HW.themeTeardown();

    if (typeof HW.theSal !== 'undefined') {
      HW.theSal.reset({
        selector: '[data-sal]',
        threshold: .225,
        once: true,
      });
    } else {
      HW.theSal = sal({
        selector: '[data-sal]',
        threshold: .15,
        once: true,
      });
    }











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
			










    // reset width baseline so first resize after swap isn't ignored
    HW.oldWidth = window.innerWidth;

    // A) marquees
    safe(HW.mqInit);

    // B) split text
    safe(HW.wrapChars);

    // C) area cards with teardown
    const areaTeardown = initAreaCardImagesWithTeardown(".area-card-inner");
    if (typeof areaTeardown === "function") HW.__teardownFns.push(areaTeardown);
  };

  /* ---------- MutationObserver-backed scheduler ---------- */
  var THEME_TARGETS = ['.hw-slides', '.mq-wrap']; // add more selectors if needed

  window.HW.__themeWatch = window.HW.__themeWatch || {
    obs: null,
    timer: null,
    scheduled: false,
    running: false
  };

  function hasThemeTargets() {
    for (var i = 0; i < THEME_TARGETS.length; i++) {
      if (document.querySelector(THEME_TARGETS[i])) return true;
    }
    return false;
  }

  function stopThemeObserver() {
    var W = HW.__themeWatch;
    if (W.obs) { try { W.obs.disconnect(); } catch(_){} W.obs = null; }
    if (W.timer) { clearTimeout(W.timer); W.timer = null; }
  }

  function flushThemeInit() {
    var W = HW.__themeWatch;
    if (W.running) return;
    W.running = true;
    // double-RAF so DOM is stable after swaps/hydration
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        try { HW.themeInit(); }
        catch(e){ console.error('[HW] themeInit error:', e); }
        finally {
          // short cooldown to absorb stacked events
          setTimeout(function(){ W.running = false; }, 80);
        }
      });
    });
  }

  function startThemeObserver() {
    var W = HW.__themeWatch;
    stopThemeObserver(); // reset any previous

    // Safety timeout so we don't observe forever (in case target never appears)
    W.timer = setTimeout(stopThemeObserver, 6000);

    W.obs = new MutationObserver(function () {
      if (hasThemeTargets()) {
        stopThemeObserver();
        flushThemeInit();
      }
    });

    W.obs.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });
  }

  function scheduleThemeInit() {
	console.log('asdasdsad YASH');
    var W = HW.__themeWatch;
    if (W.scheduled || W.running) return;
    W.scheduled = true;
    // microtask collapse
    setTimeout(function(){
      W.scheduled = false;
      if (hasThemeTargets()) {
        stopThemeObserver();
        flushThemeInit();
      } else {
        startThemeObserver();
      }
    }, 0);
  }

  /* ---------- Bootstrap once ---------- */
  if (!HW.__themeBootstrapped) {
    HW.__themeBootstrapped = true;

    // single global resize listener
    const onResize = debounce(HW.globalResize, 500);
    window.addEventListener("resize", onResize);
    HW.__teardownFns.push(() => window.removeEventListener("resize", onResize));

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", scheduleThemeInit, { once: true });
    } else {
      scheduleThemeInit();
    }

   // document.addEventListener("astro:before-swap", HW.themeTeardown);

    document.addEventListener("astro:after-swap", function () {
      // allow the new DOM to land
      setTimeout(scheduleThemeInit, 0);
    });

    window.addEventListener("popstate", function () {
      HW.themeTeardown();
      setTimeout(scheduleThemeInit, 0);
    });

    document.addEventListener("astro:page-load", scheduleThemeInit);
  }
})();

/* -----------------------------------------
   GLOBAL RESIZE (kept; now attached once)
----------------------------------------- */

HW.oldWidth = window.innerWidth;

var resizedonce = false;

HW.globalResize = function () {
  if ((HW.isMobile == true || HW.isIpad == true) && window.innerWidth == HW.oldWidth) {
    return;
  }

  if (resizedonce == false) {
    resizedonce = true;
  }

  HW.$html.classList.add("hw-global-resizing");

  if (HW.isMobile == false && HW.isIpad == false) {
    HW.windowHeight = HW.getWinDims().height;
    HW.windowWidth = HW.getWinDims().width;

    HW.setVhUnits();
    HW.roundVwProps();
    // HW.wrapChars();
  }

  if (
    (window.innerWidth != HW.oldWidth && (HW.isMobile == true || HW.isIpad == true)) ||
    (HW.isMobile !== true && HW.isIpad !== true)
  ) {
    if (typeof HW.setProjectSliderVar !== "undefined") {
      HW.setProjectSliderVar();
    }

    HW.mqInit();

    if (typeof HW.fullbleedEls !== "undefined") {
      var mydims = HW.setFullBleedDims(null, null, { w: 15, h: 10 });

      loop(HW.fullbleedEls, function (el) {
        HW[el].style.height = mydims.height / 12 + "rem";
        HW[el].style.width = mydims.width / 12 + "rem";
      });
    }

    if (HW.oldWidth <= 1024 && window.innerWidth >= 1024) {
      var $shown = document.querySelectorAll("#main-nav.show");

      if ($shown.length > 0) {
        HW.isClosing = true;
        HW.triggerEvent($navtoggle, "click");
      }
    }

    if (HW.isMobile == true || HW.isIpad == true) {
      HW.setVhUnits();
      HW.roundVwProps();
      // HW.wrapChars();
    }

    HW.createMarqueeSlider?.();

    HW.oldWidth = window.innerWidth;

    var Alltrigger = ScrollTrigger.getAll();
    for (let i = 0; i < Alltrigger.length; i++) {
      Alltrigger[i].refresh();
    }
  }

  var winwidth = HW.windowWidth;

  HW.requestTimeout(function () {
    HW.$html.classList.remove("hw-global-resizing");
  }, 2000);
};

// NOTE: the resize listener is now installed ONCE in the bootstrapping block above.
// window.addEventListener("resize", debounce(HW.globalResize, 500)); // <-- removed duplicate binding
