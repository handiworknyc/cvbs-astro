var bodyStyles = window.getComputedStyle(document.body),
	bodylineHeight = bodyStyles.fontSize.replace('px', '');


function setSliderHeightToMax(slider) {
	slider.cells.forEach(cell => cell.element.style.height = '');
		
	let heights = slider.cells.map(cell => cell.element.offsetHeight),
		max = Math.max.apply(Math, heights);
	
	
	slider.cells.forEach(cell => cell.element.style.height = (max + (bodylineHeight * 2)) + 'px');
	
	if($$('.flickity-viewport', slider.element).length > 0) {
		$$('.flickity-viewport', slider.element)[0].style.height = (max + (bodylineHeight * 2)) + 'px';		
	}
	
	//console.log(slider);
}


window.placeDots = function(flkty, module) {
			const	w           = window.innerWidth,
					textTarget  = module.querySelector('.img-cards-section-text') || module.querySelector('.image-cards-section-text'),
					titleTarget = module.querySelector('.img-cards-title-nav'),
					dotsTarget  = (w < 700 && textTarget) ? textTarget : titleTarget;
	
			// Ensure pageDots object exists (edge case if options changed post-init)
			if (!flkty.pageDots) {
				flkty.options.pageDots = true;
				if (typeof flkty.activateUI === 'function') flkty.activateUI();
			}
	
			let dots = module.querySelector('.flickity-page-dots');
			if (!dots || !dotsTarget) return;

			// Preserve any existing counter so we can reinsert it after moving
			const existingCounter = dots.querySelector('.hw-slide-counter');

			// Clean up any prior placements from BOTH potential targets, but don't remove the dots (we'll move them)
			[titleTarget, textTarget].forEach(t => {
				if (!t) return;
				t.querySelectorAll('.flickity-page-dots, .hw-slides--ar').forEach(el => {
					// remove arrows if present
					if (el.classList.contains('hw-slides--ar')) el.remove();
					// keep dots; single node will be moved below
				});
			});
	
			// Move the (same) dots node to the chosen target
			dotsTarget.appendChild(dots);
	
			// Rebuild "next" arrow each time (first remove any old one inside dots)
			dots.querySelectorAll('.hw-slides--ar').forEach(el => el.remove());
			const nextBtn = document.createElement('button');
			nextBtn.type = 'button';
			nextBtn.className = 'icon-arrow-right delta-alt delta hw-slides--ar hw-slides--next';
			nextBtn.setAttribute('aria-label', 'Next slide');
			dots.appendChild(nextBtn);
			nextBtn.addEventListener('click', () => flkty.next(true));

			// If a counter existed before moving, reinsert it just before the next arrow
			if (existingCounter && !dots.contains(existingCounter)) {
				dots.insertBefore(existingCounter, nextBtn);
			}
	
			// Ensure/refresh counter (adds gt8 class and binds updater)
			ensureSlideCounter(flkty, dots);
		}

/* ===========================
   NEW: slide counter helper
   =========================== */
function ensureSlideCounter(flkty, dots){
	if (!flkty || !dots) return;

	const total = (flkty.slides && flkty.slides.length) || 0;

	// remove / reset if <= 8
	if (total <= 8) {
		dots.classList.remove('gt8');
		const old = dots.querySelector('.hw-slide-counter');
		if (old) old.remove();
		// unbind updater if we had one
		if (flkty._hwUpdateCounter) {
			flkty.off('select', flkty._hwUpdateCounter);
			flkty._hwUpdateCounter = null;
		}
		return;
	}

	// mark dots
	dots.classList.add('gt8');

	// build (or reuse) the counter node
	let counter = dots.querySelector('.hw-slide-counter');
	if (!counter) {
		counter = document.createElement('span');
		counter.className = 'hw-slide-counter';
		counter.setAttribute('aria-live', 'polite');
		// insert before the right arrow if present, otherwise append
		const rightArrow = dots.querySelector('.hw-slides--next');
		if (rightArrow && rightArrow.parentNode === dots) {
			dots.insertBefore(counter, rightArrow);
		} else {
			dots.appendChild(counter);
		}
	}

	// updater (store on instance so we can off() before rebinding)
	const update = () => {
		const current = (typeof flkty.selectedIndex === 'number' ? flkty.selectedIndex : 0) + 1;
		counter.textContent = current + ' / ' + total;
	};
	// (Re)bind once
	if (flkty._hwUpdateCounter) flkty.off('select', flkty._hwUpdateCounter);
	flkty._hwUpdateCounter = update;
	flkty.on('select', update);

	// initial paint
	update();
}


	

HW.theHwFlick = function($hwflick){
	if(typeof $hwflick == 'undefined' || $hwflick == null) {
		return;
	}
	
	if($hwflick.length < 1) {
		return;
	}

	var hwFlickOpts = {
			"wrapAround": true,
			"pageDots" : true,
			"contain" : true,
			"prevNextButtons" : false,
			"autoPlay" : false,
			"resize" : true,
			"cellAlign" : "left",
			selectedAttraction: 0.055,
			friction: 0.35
		};
	
	hwFlickOpts.cellAlign = 'left';

	var dataflick = JSON.parse($hwflick.getAttribute('data-hw-flickity'));
	
	if(typeof dataflick == 'object') {
		for (var key in dataflick ) {
			hwFlickOpts[key] = dataflick[key];
		}
	}

	var mypar = $hwflick.parentNode.parentNode;
	
	if (mypar && mypar.closest('.image_cards-module')) {
		const	module = mypar.closest('.image_cards-module');
	
		hwFlickOpts.pageDots = true;
		hwFlickOpts.prevNextButtons = false;
	
		hwFlickOpts.on = Object.assign({}, hwFlickOpts.on, {
			ready: function () {
				window.placeDots(this, module);
			}
		});
	}
	
	const flkty = HW.tempVars.$hwflick[$hwflick.id] = new Flickity($hwflick, hwFlickOpts);

	if (mypar && mypar.closest('.image_cards-module')) {
        var module = mypar.closest('.image_cards-module');

		// Define handler once so we can reference it in both off() and on()
		function onResize() {
			window.placeDots(this, module);
		}
	
		// Remove any previous handler (safe even if none was bound yet)
		flkty.off('resize', onResize);
	
		// Attach fresh handler
		flkty.on('resize', onResize);
	} else {
		var $mydots = $$('.flickity-page-dots', mypar);

		if($mydots.length > 0) {

			$mydots = $mydots[0];
		
			//$mydots.classList.add('container-fluid');
		
			if($$('.hw-slides--next', mypar).length == 0) {
				$mydots.insertAdjacentHTML('afterbegin', '<button aria-label="Click to go to the previous slide" class="icon-arrow-left delta-alt delta hw-slides--ar hw-slides--prev"></button>');			
		
				$mydots.insertAdjacentHTML('beforeend', '<button aria-label="Click to go to the next slide" class="icon-arrow-right delta-alt delta hw-slides--ar hw-slides--next"></button>');
			}
		}

		// Ensure/refresh counter for non-module sliders too
		if ($mydots) {
			ensureSlideCounter(flkty, $mydots);
		}
	}

	// Also ensure counter on ready (covers edge cases)
	flkty.on('ready', function(){
		const scope = mypar && mypar.closest('.image_cards-module') ? mypar.closest('.image_cards-module') : mypar || flkty.element.parentNode;
		const dots = scope && scope.querySelector('.flickity-page-dots');
		if (dots) ensureSlideCounter(flkty, dots);
	});

	var next = $$('.hw-slides--next', mypar),
		prev = $$('.hw-slides--prev', mypar);

	if(next.length > 0 && !next[0].classList.contains('listened')) {
		next[0].classList.add('listened');
		
		next[0].addEventListener('click', function(){
			HW.tempVars.$hwflick[$hwflick.id].next();					
		});
	}

	// wire once
	var changeMe = function(index){
		setNeighborhoodClasses(index);
	};
	
	HW.tempVars.$hwflick[$hwflick.id].off('change', changeMe);
	HW.tempVars.$hwflick[$hwflick.id].on('change', changeMe);
	
	// run immediately for initial state
	setNeighborhoodClasses(HW.tempVars.$hwflick[$hwflick.id].selectedIndex);
	
	function setNeighborhoodClasses(index){
		const n = HW.tempVars.$hwflick[$hwflick.id].slides.length;
		const root = $hwflick;
	
		// clear all previously applied neighbor classes
		root.querySelectorAll('.prev-slide, .prev-slide1, .next-slide, .next-slide1, .next-slide2')
			.forEach(el => {
				el.classList.remove('prev-slide', 'prev-slide1', 'next-slide', 'next-slide1', 'next-slide2');
			});
	
		// nothing to do for single slide
		if (n < 2) return;
	
		// decide how many neighbors to tag based on total slides:
		// n<=4: only one prev/next
		// n==5: prev, prev1, next, next1
		// n>=6: prev, prev1, next, next1, next2
		const prevDepth = (n >= 5) ? 2 : 1;
		const nextDepth = (n >= 6) ? 3 : (n >= 5 ? 2 : 1);
	
		// map offset -> class
		const classByOffset = {
			[-1]: 'prev-slide',
			[-2]: 'prev-slide1',
			[ 1]: 'next-slide',
			[ 2]: 'next-slide1',
			[ 3]: 'next-slide2'
		};
	
		// build the offsets we intend to apply
		const offsets = [-1, 1];
		if (prevDepth >= 2) offsets.push(-2);
		if (nextDepth >= 2) offsets.push(2);
		if (nextDepth >= 3) offsets.push(3);
	
		const usedTargets = new Set(); // avoid double-tagging same slide (e.g., small n wraparounds)
	
		// helper: get the DOM element for a slide index
		const getCellEl = (i) => {
			const s = HW.tempVars.$hwflick[$hwflick.id].slides[i];
			return s && s.cells && s.cells[0] && s.cells[0].element ? s.cells[0].element : null;
		};
	
		for (const off of offsets) {
			// normalized wrap-around index
			const t = ((index + off) % n + n) % n;
	
			// never tag the current slide; skip duplicates from modulo collisions
			if (t === index || usedTargets.has(t)) continue;
	
			const el = getCellEl(t);
			if (!el) continue;
	
			// guard: if modulo caused prev/next to collapse onto same slide for small n, skip silently
			const cls = classByOffset[off];
			if (!cls) continue;
	
			el.classList.add(cls);
			usedTargets.add(t);
		}
	}

	setNeighborhoodClasses(HW.tempVars.$hwflick[$hwflick.id].selectedIndex);

	if(prev.length > 0 && !prev[0].classList.contains('listened')) {
		prev[0].classList.add('listened');
		
		prev[0].addEventListener('click', function(){
			HW.tempVars.$hwflick[$hwflick.id].previous();
		});
	}

	var flickNavClick = function(){
		var myi = HW.indexInParent(this, '.acc-card');
		HW.tempVars.$hwflick[$hwflick.id].select(myi);
	};
	
	if ($hwflick.closest('.services_areas_slider-module')) {
		var navBtns = mypar.querySelectorAll(".service-area-nav-btn");
		var flktyInst = HW.tempVars.$hwflick[$hwflick.id]; // your Flickity instance
	
		// Button clicks: move Flickity and update selected class
		navBtns.forEach(function (btn, index) {
			btn.addEventListener("click", function () {
				flktyInst.select(index);
	
				navBtns.forEach(function (b) {
					b.classList.remove("selected");
				});
				btn.classList.add("selected");
			});
		});
	
		// Keep buttons in sync when Flickity changes slides (e.g., drag, arrows, autoplay)
		var flickNavSelect = function () {
			var theIndex = flktyInst && typeof flktyInst.selectedIndex === "number"
				? flktyInst.selectedIndex
				: 0;
	
			navBtns.forEach(function (b) {
				b.classList.remove("selected");
			});
	
			if (navBtns[theIndex]) {
				navBtns[theIndex].classList.add("selected");
			}
		};
	
		// Bind to Flickity select event
		flktyInst.on('select', flickNavSelect);
	
		// Optional: sync once on init so the correct button is highlighted on load
		flickNavSelect();
	}

	/* --------------------------
	 *  GSAP STAT ANIMATION HOOKS
	 * -------------------------- */
	 function hwNumberWithCommas(n) {
		 var s = n.toString();
		 var parts = s.split(".");
		 var head = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		 return parts.length > 1 ? head + "." + parts[1] : head;
	 }
	 
	 function hwAnimateStat(stat, index) {
		 if (stat.dataset.animated === "1") return; // animate once
	 
		 var val = parseFloat(stat.getAttribute('data-num'));
		 if (isNaN(val)) return;
	 
		 var split = (val + "").split(".");
		 var decimals = split.length > 1 ? split[1].length : 0;
		 var nocomma = stat.classList.contains('no-comma');
	 
		 // timing & stagger
		 var baseDelay = 0.3;   // when FIRST stat starts
		 var delayStep = 0.45;  // gap between stats
		 var mydelay   = baseDelay + (index * delayStep);
	 
		 // set up container fade; starts exactly when number starts
		 var container = stat.closest('.project-slide-stat') || stat.closest('.card-inner') || stat.closest('.stat-card');
		 if (container) {
			 gsap.set(container, { opacity: 0, y: '10%' });
			 gsap.to(container, { opacity: 1, y: 0, delay: mydelay, duration: 1.0, ease: 'power2.out' });
		 }
	 
		 // avoid showing 0 before/at start
		 stat.textContent = "";
	 
		 var common = {
			 duration: .45,          // make the count visible
			 ease: 'power1.out',
			 delay: mydelay,
			 overwrite: 'auto',
			 immediateRender: false
		 };
	 
		 if (decimals === 0) {
			 // integers: start just above zero, round to whole numbers
			 gsap.to(stat, Object.assign({}, common, {
				 startAt: { innerText: 1 },   // no "0" flash
				 innerText: val,
				 snap: { innerText: 1 },
				 onUpdate: function () {
					 var v = gsap.getProperty(stat, "innerText");
					 stat.textContent = nocomma ? v : hwNumberWithCommas(v);
				 }
			 }));
		 } else {
			 // decimals: start from a tiny epsilon so first visible frame > 0
			 var proxy = { x: Math.pow(10, -decimals) };
			 gsap.to(proxy, Object.assign({}, common, {
				 x: val,
				 onUpdate: function () {
					 var raw = proxy.x.toFixed(decimals);
					 if (nocomma) {
						 stat.textContent = raw;
					 } else {
						 var parts = raw.split('.');
						 var head = hwNumberWithCommas(parts[0]);
						 stat.textContent = parts[1] ? head + '.' + parts[1] : head;
					 }
				 }
			 }));
		 }
	 
		 stat.dataset.animated = "1";
	 }
	 
	 // run for the currently selected Flickity cell
	 function hwAnimateProjectSlideStatsInCell(cellElem) {
		 if (!cellElem) return;
		 var groups = cellElem.querySelectorAll('.project-slide-stat');
		 groups.forEach(function(group, i){
			 var stat = group.querySelector('.stat-num');
			 if (stat) hwAnimateStat(stat, i); // stagger by group index
		 });
	 }

	 
	 function hwAnimateProjectSlideStatsInCell(cellElem) {
		 if (!cellElem) return;
		 var groups = cellElem.querySelectorAll('.project-slide-stat');
		 groups.forEach(function(group, i){
			 var stat = group.querySelector('.stat-num');
			 if (stat) hwAnimateStat(stat, i); // stagger by group index
		 });
	 }

	 
	 
	 flkty.on('select', function(){
		 if(flkty.selectedIndex !== 0){
		 	hwAnimateProjectSlideStatsInCell(flkty.selectedElement);			 
		 }
	 });

};



HW.hwFlick = function() {
	HW.tempVars.$hwflick = {};
	 
	 var $hwflick = $$('.hw-slides');
	 
	 if($hwflick.length < 1) {
		 return;
	 }


	 var doEqualHeight = function(){
		loop($$('.equal-height-cells'), function(el){
			var myid = el.id,
				myflick = HW.tempVars.$hwflick[myid];	
			
			if(typeof myflick !== 'undefined') {
				setSliderHeightToMax(myflick);				
			}
		});	
	 };

	 var hwFlickInit = function(){
		 for (var i = 0; i < $hwflick.length; i++) {
			 // ensure each element has a stable id
			 if (!$hwflick[i].id) {
				 $hwflick[i].id = 'flickity-' + Math.random().toString(36).substr(2, 9);
			 }
	 
			 const el  = $hwflick[i];
			 const w   = HW.getWinDims().width;
			 const isL4 = el.matches('.layout-4.img-card-slider');
			 const isL2 = el.matches('.layout-2.img-card-slider');
	 
			 // ENABLE when below thresholds; DISABLE/UNWRAP otherwise
			 if ((!isL4 && !isL2) || ((isL4 && w < 1520) || (isL2 && w < 700))) {
				 HW.theHwFlick(el); // your initializer
			 } else {
				 const inst = HW.tempVars.$hwflick[el.id];
				 if (inst) {
					 try { inst.off('change'); } catch(e){}
					 inst.destroy(); // stop observers & restore child cells
				 }
				 HW.flickUnwrap(el); // pass the element directly
			 }
		 }
 
		

/*
		if(typeof ScrollTrigger !== 'undefined') {
			ScrollTrigger.refresh();			
		}
*/

		HW.requestTimeout(function(){
			doEqualHeight();

			HW.oldWidth = window.innerWidth;
			
			if(typeof ScrollTrigger !== 'undefined') {
				var Alltrigger = ScrollTrigger.getAll();
		
				for (let i = 0; i < Alltrigger.length; i++) {
					Alltrigger[i].refresh();
				}		    
			}			

			if(typeof HW.locoscroll !== 'undefined') {
				window.HW.locoscroll.update();
			}

		}, 250);	
		
	 };

	 hwFlickInit();
	 

	 
	window.addEventListener('resize', function(){
		hwFlickInit();
	});	
};


	// safe unwrap: move children out, then remove wrapper
function unwrap(node){
	if (!node || !node.parentNode) return;
	const parent = node.parentNode;
	while (node.firstChild) parent.insertBefore(node.firstChild, node);
	parent.removeChild(node);
}

// normalize input to an array of elements
function normalizeToArray(input){
	if (!input) return [];
	if (input instanceof Element) return [input];
	if (typeof input.length === 'number') return Array.from(input);
	return [];
}

HW.flickUnwrap = function(flicks){
	const list = normalizeToArray(flicks);
	if (!list.length) return;

	list.forEach(function(me){
		// if this is a cell wrapper inside module, work from the slider root
		let root = me;
		// if called on a ".flickity-viewport/.flickity-slider" child, jump to slider element
		const sliderRoot = me.closest('[data-flickity]') || me.closest('.img-card-slider') || me;
		root = sliderRoot;

		// remove marker classes from root
		root.classList.remove('flickity-enabled', 'is-draggable', 'is-pointer-down');

		// unwrap Flickity containers if present
		const viewport = root.querySelector(':scope > .flickity-viewport');
		const slider   = viewport ? viewport.querySelector(':scope > .flickity-slider') : null;

		// unwrap inner slider first, then viewport
		if (slider)   unwrap(slider);
		if (viewport) unwrap(viewport);

		// remove UI (dots/buttons) within the relevant module scope
		const moduleScope = root.closest('.image_cards-module') || root;
		moduleScope.querySelectorAll('.flickity-page-dots, .flickity-button').forEach(el => {
			if (el && el.parentNode) el.parentNode.removeChild(el);
		});

		// also nuke any prev/next tagging you add during runtime
		moduleScope.querySelectorAll('.prev-slide, .prev-slide1, .next-slide, .next-slide1, .next-slide2')
			.forEach(el => el.classList.remove('prev-slide','prev-slide1','next-slide','next-slide1','next-slide2'));
	});
};

HW.hwFlickInit = function(){
	var $flicks = $$('.flickity-enabled');	

	if($flicks.length > 0) {
		HW.flickUnwrap($flicks);
	}

	
	HW.hwFlick();
	
	
	var flickme = function(){

		var $flicks = $$('.flickity-enabled');	
	
		if($flicks.length > 0) {
			for(var i = 0; i < $flicks.length; i++) {
				var $me = $flicks[i];
				
				if(HW.tempVars.$hwflick[$me.id] !== null && typeof HW.tempVars.$hwflick[$me.id] !== 'undefined') {
					//console.log($me.id);
					HW.tempVars.$hwflick[$me.id].resize();					
				}
			}
		}
		
		window.dispatchEvent(HW.flickityReady);

	};

	
	HW.requestTimeout(flickme, 100);	
}

//if(HW.isPostLoadDone == true) {
	HW.hwFlickInit();	
//} else {
	//window.addEventListener('load', HW.hwFlickInit);
//}
