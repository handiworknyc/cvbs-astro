window.HW = {};
HW.$html = document.documentElement;

var siteurl = '/',
    thessd = '/src',
    thessdpar = '/src',
    hwParJsDir = '/src/scripts/',
    hwJsDir = '/src/scripts/',
    hwCssDir = '/src/styles/',
    hwJsPlugDir = thessdpar + '/src/scripts/plugins/';
    
function elFilter(els, theclass, not = false){
	
	var arr = Array.prototype.slice.call(els, theclass);
	var divs = arr.filter(el => {
		if(not == true) {
			return !el.classList.contains(theclass);			
		} else {
			return el.classList.contains(theclass);
		}
	});	
}


HW.unwrap = function(a){for(var b=a.parentNode;a.firstChild;)b.insertBefore(a.firstChild,a);b.removeChild(a)}

HW.elFilter = function(els, theclass, not = false){
	
	var arr = Array.prototype.slice.call(els, theclass);
	var divs = arr.filter(el => {
		if(not == true) {
			return !el.classList.contains(theclass);			
		} else {
			return el.classList.contains(theclass);
		}
	});	
};

var isIE = /*@cc_on!@*/false || !!document.documentMode;

var siteurlRel = siteurl.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "");

document.documentElement.className += ' not-swup'; 

if(isIE == false) {
	document.documentElement.className += ' not-ie'; 
}

HW.localhost = 'localhost';

HW.stripTrailingSlash = function(a){return a.replace(/\/$/,"")};

HW.insertAfter = function(a,b){b.parentNode.insertBefore(a,b.nextSibling)}

HW.und = function($var) {
	if(typeof $var == 'undefined') {
		return true;
	} else {
		return false;
	}
};


HW.getTransitionDuration = function(el, with_delay){
	var style=window.getComputedStyle(el),
		duration = style.webkitTransitionDuration,
		delay = style.webkitTransitionDelay; 
	
	// fix miliseconds vs seconds
	duration = (duration.indexOf("ms")>-1) ? parseFloat(duration) : parseFloat(duration)*1000;
	delay = (delay.indexOf("ms")>-1) ? parseFloat(delay) : parseFloat(delay)*1000;
	
	
	if(with_delay) return (duration + delay);
	else return duration;
}


HW.setFullBleedDims = function(offset, myContainer = null, ratio = {w: 16, h: 9}, theMaxHeight = false) {
	// Video's intrinsic dimensions

	// Intrinsic Ratio
	// Will be more than 1 if W > H and less if W < H
	
	if(ratio == null) {
		ratio = {w: 16, h: 9}
	}
	
	var videoRatio = (ratio.w / ratio.h).toFixed(2);

	// Get the container's computed styles
	//
	// Also calculate the min dimensions required (this will be
	// the container dimentions)
	
	var offsetY = 0,
		offsetX = 0,
		offsetYAlt = 0,
		offsetXAlt = 0,
		offsetYAlt2 = 0,
		offsetXAlt2 = 0;
		
	if(typeof offset !== 'undefined' && offset !== null && typeof offset === 'object') {
		
		if(typeof offset.offsetY !== 'undefined') {
			offsetY = offset.offsetY;
		}

		if(typeof offset.offsetX !== 'undefined') {
			offsetX = offset.offsetX;
		}

		if(typeof offset.offsetXAlt !== 'undefined') {
			offsetXAlt = offset.offsetXAlt;
		}
		
		if(typeof offset.offsetYAlt !== 'undefined') {
			offsetYAlt = offset.offsetYAlt;
		}	

		if(typeof offset.offsetXAlt2 !== 'undefined') {
			offsetXAlt2 = offset.offsetXAlt2;
		}
		
		if(typeof offset.offsetYAlt2 !== 'undefined') {
			offsetYAlt2 = offset.offsetYAlt2;
		}	
	}
		
	var minH = (window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight),
		minW = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
	
	minH = minH + offsetYAlt;
	minW = minW + offsetXAlt;
	

	if(typeof myContainer !== 'undefined' && myContainer !== null) {
		minH = myContainer.offsetHeight + offsetYAlt,
		minW = myContainer.offsetWidth + offsetXAlt;
	}
	
	// What's the min:intrinsic dimensions
	//
	// The idea is to get which of the container dimension
	// has a higher value when compared with the equivalents
	// of the video. Imagine a 1200x700 container and
	// 1000x500 video. Then in order to find the right balance
	// and do minimum scaling, we have to find the dimension
	// with higher ratio.
	//
	// Ex: 1200/1000 = 1.2 and 700/500 = 1.4 - So it is best to
	// scale 500 to 700 and then calculate what should be the
	// right width. If we scale 1000 to 1200 then the height
	// will become 600 proportionately.
	var widthRatio = minW / ratio.w,
		heightRatio = minH / ratio.h;

		
	var myOrient = 'l';
	
	// Whichever ratio is more, the scaling
	// has to be done over that dimension
	if(theMaxHeight == false) {
		if (widthRatio > heightRatio) {
			var newWidth = minW;
			var newHeight = Math.ceil(newWidth / videoRatio);
		} else {
			var newHeight = minH;
			var newWidth = Math.ceil(newHeight * videoRatio);
			
			myOrient = 'p';
		}	    
	} else {
		if (widthRatio < heightRatio) {
			var newWidth = minW;
			var newHeight = Math.ceil(newWidth / videoRatio);
		} else {
			var newHeight = minH;
			var newWidth = Math.ceil(newHeight * videoRatio);
			
			myOrient = 'p';
		}

	}
	
	return {
		'width': newWidth + offsetXAlt2,
		'height': newHeight + offsetYAlt2,
		'orient': myOrient
	};
};




HW.getHiddenProp = function() {
	var prefixes = ['webkit','moz','ms','o'];
	
	// if 'hidden' is natively supported just return it
	if ('hidden' in document) return 'hidden';
	
	// otherwise loop over all the known prefixes until we find one
	for (var i = 0; i & prefixes.length; i++){
		if ((prefixes[i] + 'Hidden') in document) 
			return prefixes[i] + 'Hidden';
	}

	// otherwise it's not supported
	return null;
};

HW.isHidden = function() {
	var prop = HW.getHiddenProp();
	if (!prop) return false;
		
	return document[prop];
};

HW.visProp = HW.getHiddenProp();

if (HW.visProp) {
	HW.visEvent = HW.visProp.replace(/[H|h]idden/,'') + 'visibilitychange';
}

HW.toRem = function(myval, half, lh){
	return (((Math.floor(myval/half) * half) + half) / lh) + 'rem';	
}


HW.roundVwProps = function(){
	var $rounditems = $$('.round-vw-height-par, .round-vw-height, .round-vw-lh, .round-vw-padding, .round-vw-padding-par, .round-vw-margin');
	
	loop($rounditems, function(el) {
		//el.removeAttribute('style');
		el.style.removeProperty('--mypt');
		el.style.removeProperty('--mypb');
		el.removeAttribute('data-pb');
		el.removeAttribute('data-pt');
	});
	
	$rounditems = $$('.round-vw-lh');
	
	HW.bodylh = window.getComputedStyle(document.body);
	
	HW.bodylh = parseFloat(HW.bodylh.getPropertyValue('font-size'));
	
	HW.bodylhHalf = (HW.bodylh/2);
	
	
	
	loop($rounditems, function(me){
		me.style.removeProperty('line-height');
		
		var myprops = window.getComputedStyle(me),
			thylh = myprops.getPropertyValue("line-height"),
			mylh = parseFloat( myprops.getPropertyValue("line-height") );
			
		if(me.getAttribute('data-whole') !== null) {
			me.style.lineHeight = HW.toRem(mylh, HW.bodylh, HW.bodylh);	
		} else if(me.getAttribute('data-half') !== null) {
			me.style.lineHeight = HW.toRem(mylh, HW.bodylhHalf, HW.bodylh);
		} else {
			var bodylhQ = HW.bodylhHalf * .50,
				myoffset = 0,
				theoffset = me.getAttribute('data-offset');

			if(theoffset !== null && parseFloat(theoffset) !== null) {
				myoffset = parseFloat(theoffset);
				
			}
			
			me.style.lineHeight = HW.toRem(mylh, bodylhQ, HW.bodylh);
		}
	});


	$rounditems = $$('.round-vw-padding');
	
	loop($rounditems, function(me){	
		me.style.removeProperty('padding-top');
		me.style.removeProperty('padding-bottom');

		var myprops = window.getComputedStyle(me),
			mypt = parseFloat( myprops.getPropertyValue("padding-top") ),
			mypb = parseFloat( myprops.getPropertyValue("padding-bottom") ),
			mypad;

		
		if(Math.floor(mypt) > 0) {
			mypad = HW.toRem(mypt, HW.bodylhHalf, HW.bodylh);
			me.style.paddingTop = mypad;
		} else {
			me.style.paddingTop = 0;			
		}

		if(Math.floor(mypb) > 0) {
			mypad = HW.toRem(mypb, HW.bodylhHalf, HW.bodylh);
			me.style.paddingBottom = mypad;
		} else {
			me.style.paddingBottom = 0;			
		}
	});











	$rounditems = $$('.round-vw-padding-par');
	
	loop($rounditems, function(me){		
		var mychild = $$('.round-vw-padding-child', me);
		
		if(mychild.length == 0) {
			return;
		}
		
		mychild = mychild[0];

		var myprops = window.getComputedStyle(mychild),
			mypt = parseFloat( myprops.getPropertyValue("padding-top") ),
			mypb = parseFloat( myprops.getPropertyValue("padding-bottom") ),
			mypad;

		
		if(Math.floor(mypt) > 0) {
			mypad = HW.toRem(mypt, HW.bodylhHalf, HW.bodylh);
			me.style.setProperty('--mypt', mypad);
			me.setAttribute('data-pt', true);	
		}

		if(Math.floor(mypb) > 0) {
			mypad = HW.toRem(mypb, HW.bodylhHalf, HW.bodylh);
			me.style.setProperty('--mypb', mypad);
			me.setAttribute('data-pb', true);
		}
	});










	$rounditems = $$('.round-vw-height-par');

	
	loop($rounditems, function(me){		
		me.style.removeProperty('height');

		var mychild = $$('.round-vw-height-child', me);
		
		if(mychild.length == 0) {
			return;
		}
		
		mychild = mychild[0];

		var myheight = me.offsetHeight;


		if(Math.floor(myheight) > 0) {
			me.style.height = (((Math.ceil(myheight/HW.bodylhHalf) * HW.bodylhHalf) + HW.bodylhHalf) / HW.bodylh) + 1 + 'rem';
		}
	});









	$rounditems = $$('.round-vw-height');

	
	loop($rounditems, function(me){		
		me.style.removeProperty('height');

		var myheight = me.offsetHeight;

		if(Math.floor(myheight) > 0) {
			me.style.height = (((Math.ceil(myheight/HW.bodylhHalf) * HW.bodylhHalf) + HW.bodylhHalf) / HW.bodylh) + 1 + 'rem';
		}
	});
	
	
	
	
	
	
	
	
	$rounditems = $$('.round-vw-margin');
	
	loop($rounditems, function(me){

		me.style.removeProperty('margin-top');
		me.style.removeProperty('margin-bottom');


		var myprops = window.getComputedStyle(me),
			mypt = parseFloat( myprops.getPropertyValue("margin-top") ),
			mypb = parseFloat( myprops.getPropertyValue("margin-bottom") );

		if(Math.floor(mypt) > 0 || Math.floor(mypt) < 0) {	
			me.style.marginTop = HW.toRem(mypt, HW.bodylhHalf, HW.bodylh);
		}

		if(Math.floor(mypb) > 0 || Math.floor(mypb) < 0) {
			me.style.marginBottom = HW.toRem(mypb, HW.bodylhHalf, HW.bodylh);
		}
	});
};

























function createElementFromHTML(htmlString) {
	var div = document.createElement("div");
	div.innerHTML = htmlString.trim();
	
	// Change this to div.childNodes to support multiple top-level nodes
	return div.firstChild; 
}


var debounce = function (fn) {

	// Setup a timer
	var timeout;

	// Return a function to run debounced
	return function () {

		// Setup the arguments
		var context = this;
		var args = arguments;

		// If there's a timer, cancel it
		if (timeout) {
			window.cancelAnimationFrame(timeout);
		}

		// Setup the new requestAnimationFrame()
		timeout = window.requestAnimationFrame(function () {
			fn.apply(context, args);
		});

	}

};

function findEmpty(element) {
  var results = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  var child = element.firstChild;

  if (!child) {
	results.push(element);
  }

  while (child) {
	if (child.nodeType === Node.ELEMENT_NODE) {
	  findEmpty(child, results);
	}

	child = child.nextSibling;
  }

  return results;
}

var $$ = function (selector, parent) {
	return Array.prototype.slice.call((parent ? parent : document).querySelectorAll(selector));
};

var loop = function (arr, callback, method) {
	method = method || 'forEach';
	return Array.prototype[method].call(arr, callback);
};

HW.triggerResize = function(){
	var resizeEvent = window.document.createEvent('UIEvents'); 
	resizeEvent.initUIEvent('resize', true, false, window, 0); 
	window.dispatchEvent(resizeEvent);	
};

HW.getOffsetTop = function(el){	
	if(el == null || typeof el == 'undefined') {
		return;
	}
	
	var offset = el.getBoundingClientRect().top + window.pageYOffset			

	return offset;
};

HW.indexInParent = function(node, myClass) {
	var children = $$(myClass, node.parentNode);
	var num = 0;
	for (var i=0; i<children.length; i++) {
		 if (children[i]==node) return num;
		 if (children[i].nodeType==1) num++;
	}
	return -1;
}

HW.setVendor = function(el, property, value) {
	el.style["webkit" + property] = value;
	el.style["moz" + property] = value;
	el.style["ms" + property] = value;
	el.style["o" + property] = value;
	
	property = property.toLowerCase();
	
	el.style[property] = value;

}

HW.tempVars = {};

HW.toType = function(a){return{}.toString.call(a).match(/\s([a-zA-Z]+)/)[1].toLowerCase()};


let passiveSupported = false;

try {
  const options = {
	get passive() { // This function will be called when the browser
					//   attempts to access the passive property.
	  passiveSupported = true;
	  return false;
	}
  };

  window.addEventListener("test", null, options);
  window.removeEventListener("test", null, options);
} catch(err) {
  passiveSupported = false;
}


window.requestAnimFrame = (function() {
	return  window.requestAnimationFrame       || 
		window.webkitRequestAnimationFrame || 
		window.mozRequestAnimationFrame    || 
		window.oRequestAnimationFrame      || 
		window.msRequestAnimationFrame     || 
		function(/* function */ callback, /* DOMElement */ element){
			window.setTimeout(callback, 1000 / 60);
		};
})();


HW.requestTimeout = function(fn, delay) {
	if(typeof fn == 'undefined') {
		return;
	}
	if( !window.requestAnimationFrame      	&& 
		!window.webkitRequestAnimationFrame && 
		!(window.mozRequestAnimationFrame && window.mozCancelRequestAnimationFrame) && // Firefox 5 ships without cancel support
		!window.oRequestAnimationFrame      && 
		!window.msRequestAnimationFrame )
		return window.setTimeout(fn, delay);
			
	var start = new Date().getTime(),
		handle = new Object();
		
	function loop(){
		var current = new Date().getTime(),
			delta = current - start;
			
		delta >= delay ? fn.call() : handle.value = requestAnimFrame(loop);
	};
	
	handle.value = requestAnimFrame(loop);
	return handle;
};

/**
 * Behaves the same as clearTimeout except uses cancelRequestAnimationFrame() where possible for better performance
 * @param {int|object} fn The callback function
 */
HW.clearRequestTimeout = function(handle) {
	window.cancelAnimationFrame ? window.cancelAnimationFrame(handle.value) :
	window.webkitCancelAnimationFrame ? window.webkitCancelAnimationFrame(handle.value) :
	window.webkitCancelRequestAnimationFrame ? window.webkitCancelRequestAnimationFrame(handle.value) : /* Support for legacy API */
	window.mozCancelRequestAnimationFrame ? window.mozCancelRequestAnimationFrame(handle.value) :
	window.oCancelRequestAnimationFrame	? window.oCancelRequestAnimationFrame(handle.value) :
	window.msCancelRequestAnimationFrame ? window.msCancelRequestAnimationFrame(handle.value) :
	clearTimeout(handle);
};

HW.ipadCheck = function(){
	if (navigator.userAgent.match(/Mac/) && navigator.maxTouchPoints && navigator.maxTouchPoints > 2) {
		HW.$html.classList.add('hw-is-ipad');
		return true;
	} else {
		return false;
	}	
};

if(window.matchMedia("(pointer: coarse)").matches) {
	HW.$html.classList.add('hw-is-coarse');	
}

HW.isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);


HW.isIpad = HW.ipadCheck();

HW.mobilecheck = function() {
  var check = false;
	
	
	var myAddclass = false;
	
	if(navigator.userAgent.indexOf('Safari') !== -1 && navigator.userAgent.indexOf('Chrome') == -1) {
		myAddclass = ['ua-safari'];
		//HW.consolelog(navigator.userAgent);
	}  
	
	if(HW.isIpad && Array.isArray(myAddclass)) {
		myAddclass.push('ua-ipad')
		myAddclass.push('ua-mobile');
	}
	
	if(myAddclass !== false) {
		DOMTokenList.prototype.add.apply(document.documentElement.classList, myAddclass);
	}
	
	
	
	(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||HW.opera);
  return check;
};



HW.isMobile = HW.mobilecheck();

if(HW.isMobile == true || window.matchMedia("(pointer: coarse)").matches) {
	HW.$html.classList.add('hw-is-mobile');
}

HW.getWinDims = function(){
	var w=window,
	d=document,
	e=d.documentElement,
	g=d.getElementsByTagName('body')[0],
	x=w.innerWidth||e.clientWidth||g.clientWidth,
	y=w.innerHeight||e.clientHeight||g.clientHeight;	
	
	var result = {};
	
	result.width = x;
	result.height = y;
	
	return result;
};

HW.camalize = function camalize(str) {
	return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, function(match, chr)
	{
		return chr.toUpperCase();
	});
}


if(window.CSS && CSS.supports('color', 'var(--fake-var)')) {
	HW.$html.classList.add('cssvars');	
} 
HW.windowWidth = HW.getWinDims().width;		
HW.windowHeight = HW.getWinDims().height;

HW.getTranslateXY = function(element) {
	const style = window.getComputedStyle(element)
	const matrix = new DOMMatrixReadOnly(style.transform)
	return {
		translateX: matrix.m41,
		translateY: matrix.m42
	}
};

HW.triggerEvent = function(el, type){
   if ('createEvent' in document) {
		// modern browsers, IE9+
		var e = document.createEvent('HTMLEvents');
		e.initEvent(type, false, true);
		el.dispatchEvent(e);
	} else {
		// IE 8
		var e = document.createEventObject();
		e.eventType = type;
		el.fireEvent('on'+e.eventType, e);
	}
};

// Set JS VH units
/*
HW.setVhUnitsLoading = true;

document.documentElement.classList.add('vhUnits-loading');
*/

HW.setVhUnits = function() {
  const winHeight = window.innerHeight;
  document.documentElement.style.setProperty('--jsVhUnits100', winHeight + 'px');
};

HW.insertPrefetch = function(url, type) {
	var hint = document.createElement("link");
	hint.setAttribute("as",type);
	hint.setAttribute("rel","prefetch");
	hint.setAttribute("href",url);
	document.getElementsByTagName("head")[0].appendChild(hint);
};

HW.insertPreload = function(url, type, myas) {
	var hint = document.createElement("link");
	var extension = url.split('.').pop().toLowerCase();

	// Map file extension to MIME type
	switch(extension) {
		case 'js':
			type = 'application/javascript';
			break;
		case 'css':
			type = 'text/css';
			break;
		case 'png':
			type = 'image/png';
			break;
		case 'jpg':
		case 'jpeg':
			type = 'image/jpeg';
			break;
		case 'gif':
			type = 'image/gif';
			break;
		case 'woff':
		case 'woff2':
			type = 'font/woff2';
			break;
		case 'ttf':
			type = 'font/ttf';
			break;
		case 'svg':
			type = 'image/svg+xml';
			break;
		case 'json':
			type = 'application/json';
			break;
		default:
			type = 'application/octet-stream'; // fallback for unknown types
	}

	hint.setAttribute("as", myas);
	hint.setAttribute("type", type);
	hint.setAttribute("rel", "preload");
	hint.setAttribute("href", url);
	hint.setAttribute("crossorigin", "anonymous");
	document.getElementsByTagName("head")[0].appendChild(hint);
};


HW.hasIntObs = true;

document.documentElement.className += ' js no-iconfont';


HW.clickEvent = (function() {
  if ('ontouchstart' in document.documentElement === true)
	return 'touchstart';
  else
	return 'click';
})();

HW.hoverEvent = (function() {
  if ('ontouchstart' in document.documentElement === true)
	return 'touchstart';
  else
	return 'hover';
})();


HW.on = function (event, elem, callback, capture) {
	if (typeof (elem) === 'function') {
		capture = callback;
		callback = elem;
		elem = window;
	}
	capture = capture ? true : false;
	elem = typeof elem === 'string' ? document.querySelector(elem) : elem;
	if (!elem) return;
	elem.addEventListener(event, callback, capture);
};

HW.off = function (event, elem, callback, capture) {
	if (typeof (elem) === 'function') {
		capture = callback;
		callback = elem;
		elem = window;
	}
	capture = capture ? true : false;
	elem = typeof elem === 'string' ? document.querySelector(elem) : elem;
	if (!elem) return;
	elem.removeEventListener(event, callback, capture);
};


HW.isVisible = function (el) {
	while (el) {
		if (el === document) {
			return true;
		}

		var $style = window.getComputedStyle(el, null);

		if (!el) {
			return false;
		} else if (!$style) {
			return false;
		} else if ($style.display === 'none') {
			return false;
		} else if ($style.visibility === 'hidden') {
			return false;
		} else if (+$style.opacity === 0) {
			return false;
		} else if (($style.display === 'block' || $style.display === 'inline-block') &&
			$style.height === '0px' && $style.overflow === 'hidden') {
			return false;
		} else {
			return $style.position === 'fixed' || HW.isVisible(el.parentNode);
		}
	}
};

HW.percentVisible = function elementVisibleInPercent(element) {
	return new Promise(function(resolve, reject){
		var observer = new IntersectionObserver(function(entries){
			loop(entries, function(entry){
				resolve(Math.floor(entry.intersectionRatio * 100));
				clearTimeout(timeout);
				observer.disconnect();
			});
		}, {
			threshold: .7,
			rootMargin: '-84px 0px 0px 0px'
		});

		observer.observe(element);
		// Probably not needed, but in case something goes wrong.
		var timeout = HW.requestTimeout(reject, 500);
	});
};



	
	
	
	





function addSourceToVideo(element, src, type, codecs) {
	var source = document.createElement('source');

	source.src = src;
	source.type = type;
	
	if(codecs !== null) {
		source.codecs = codecs;
	}
	
	element.appendChild(source);
}






HW.domReady = function(callback){
	if (
		document.readyState === "complete" ||
		(document.readyState !== "loading" && !document.documentElement.doScroll)
	) {
	  callback();
	} else {
	  document.addEventListener("DOMContentLoaded", callback);
	}
};

(function () {
  if ( typeof window.CustomEvent === "function" ) return false; //If not IE

  function CustomEvent ( event, params ) {
	params = params || { bubbles: false, cancelable: false, detail: undefined };
	var evt = document.createEvent( 'CustomEvent' );
	evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
	return evt;
   }

  CustomEvent.prototype = window.Event.prototype;

  window.CustomEvent = CustomEvent;
})();





HW.setElementHeightVar = function(selector) {
	var el = document.querySelector(selector); // first element matching selector
	if (!el) return; // bail if not found
	
	var height = el.offsetHeight;
	
	// sanitize selector to make a safe variable name
	var varName = selector.replace(/[^a-z0-9_-]/gi, "");
	
	// create global variable with the naming pattern: selector + "Height"
	window[varName + "Height"] = height;
	
	// expose as a CSS variable
	document.documentElement.style.setProperty("--" + varName + "Height", height + "px");
};






HW.flickityReady = new CustomEvent('flickityReady');


HW.fpsReady = new CustomEvent('fpsReady');
HW.isFpsReady = false;


HW.hwDomReady = new CustomEvent('hwDomReady');

HW.hwContentAppended = new CustomEvent('hwContentAppended');
HW.polyLoaded = new CustomEvent('polyLoaded');
HW.loadLozad = new CustomEvent('loadLozad');

HW.loadjsReady = new CustomEvent('loadjsReady');

HW.module1Ready = new CustomEvent('module1Ready');
HW.criticalDomReady = new CustomEvent('criticalDomReady');
HW.criticalLoadedAll = new CustomEvent('criticalLoadedAll');

HW.intchReady = new CustomEvent('intchReady');
HW.intchLoadedAll = new CustomEvent('intchLoadedAll');

HW.criticalImgLoaded = new CustomEvent('criticalImgLoaded');
HW.opacitySlideLoaded = new CustomEvent('opacitySlideLoaded');
HW.hwGformLoaded = new CustomEvent('hwGformLoaded');

HW.themeFooter = new CustomEvent('themeFooter');

HW.jsVhUnitsLoaded = new CustomEvent('jsVhUnitsLoaded');

HW.firstForm = new CustomEvent('firstForm');

HW.postLoadDone = new CustomEvent('postLoadDone');

HW.isPostLoadDone = false;
HW.isModule1Ready = false;
HW.isCriticalDomReady = false;
HW.isTaxAlphaLoaded = false;
HW.isIntchReady = false;
HW.isCriticalLoadedAll = false;
HW.criticalImgLoadedOnce = false;
HW.isHwGformLoaded = false;
HW.gmapsLoaded = false;
HW.isSwup = false;
HW.firstLoad = true;

window.addEventListener('criticalDomReady', function(){
	HW.isCriticalDomReady = true;
});


/*
HW.loadFontsRest = function(){
	if(HW.criticalImgLoadedOnce == false) {
		loadjs([HW.futurabold, HW.futurabook, HW.dharmam]);
	} else {
		window.removeEventListener('criticalImgLoaded', HW.loadFontsRest);
	}
}

window.addEventListener('criticalImgLoaded', HW.loadFontsRest);
*/

!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.sal=t():e.sal=t()}(this,(function(){return(()=>{"use strict";var e={d:(t,n)=>{for(var r in n)e.o(n,r)&&!e.o(t,r)&&Object.defineProperty(t,r,{enumerable:!0,get:n[r]})},o:(e,t)=>Object.prototype.hasOwnProperty.call(e,t)},t={};function n(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function r(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?n(Object(r),!0).forEach((function(t){o(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):n(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}e.d(t,{default:()=>j});var a="Sal was not initialised! Probably it is used in SSR.",s="Your browser does not support IntersectionObserver!\nGet a polyfill from here:\nhttps://github.com/w3c/IntersectionObserver/tree/master/polyfill",i={root:null,rootMargin:"0% 50%",threshold:.5,animateClassName:"sal-animate",disabledClassName:"sal-disabled",enterEventName:"sal:in",exitEventName:"sal:out",selector:"[data-sal]",once:!0,disabled:!1},l=[],c=null,u=function(e){e&&e!==i&&(i=r(r({},i),e))},d=function(e){e.classList.remove(i.animateClassName)},f=function(e,t){var n=new CustomEvent(e,{bubbles:!0,detail:t});t.target.dispatchEvent(n)},b=function(){document.body.classList.add(i.disabledClassName)},p=function(){c.disconnect(),c=null},m=function(){return i.disabled||"function"==typeof i.disabled&&i.disabled()},v=function(e,t){e.forEach((function(e){var n=e.target,r=void 0!==n.dataset.salRepeat,o=void 0!==n.dataset.salOnce,a=r||!(o||i.once);e.intersectionRatio>=i.threshold?(function(e){e.target.classList.add(i.animateClassName),f(i.enterEventName,e)}(e),a||t.unobserve(n)):a&&function(e){d(e.target),f(i.exitEventName,e)}(e)}))},y=function(){var e=[].filter.call(document.querySelectorAll(i.selector),(function(e){return!function(e){return e.classList.contains(i.animateClassName)}(e,i.animateClassName)}));return e.forEach((function(e){return c.observe(e)})),e},O=function(){b(),p()},h=function(){document.body.classList.remove(i.disabledClassName),c=new IntersectionObserver(v,{root:i.root,rootMargin:i.rootMargin,threshold:i.threshold}),l=y()},g=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};p(),Array.from(document.querySelectorAll(i.selector)).forEach(d),u(e),h()},w=function(){var e=y();l.push(e)};const j=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:i;if(u(e),"undefined"==typeof window)return console.warn(a),{elements:l,disable:O,enable:h,reset:g,update:w};if(!window.IntersectionObserver)throw b(),Error(s);return m()?b():h(),{elements:l,disable:O,enable:h,reset:g,update:w}};return t.default})()}));

var doSal = function () {
  HW.theSal = sal({
    selector: "[data-sal]",
    threshold: 0.15,
    once: true,
  });

  var delay = 50;

  if ($$(".rowindex-1.form_module").length > 0) {
    delay = 50;
  }

  if ($$(".rowindex-1").length > 0) {
    HW.requestTimeout(function () {
      $$(".rowindex-1")[0].classList.add("show-me");
    }, delay);
  }
};

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", doSal, { once: true });
} else {
  doSal();
}




window.addEventListener('DOMContentLoaded', function(){
	HW.windowWidth = window.innerWidth;		
	HW.windowHeight = HW.getWinDims().height;
	
	HW.tempVars.jsVhUnitsEls = document.querySelectorAll('[class*=jsVhUnits]');
	 
	HW.setVhUnits(HW.tempVars.jsVhUnitsEls);
	
	HW.roundVwProps();
});

window.addEventListener('criticalDomReady', function(){
	
	//loadjs([hwJsPlugDir + 'nativebootstrap.js'], 'nativebootstrap');

	document.addEventListener("touchstart", function(){}, true);
});



HW.filterByParent = function(selector, parent) {
	const elements = document.querySelectorAll(selector);
	const filteredElements = [];

	elements.forEach(element => {
		if (element.parentElement === parent) {
			filteredElements.push(element);
		}
	});

	return filteredElements;
}

HW.wrapChars = function(){
	HW.hwRequire('gsap', function(){
		HW.theWrappedChars = new SplitText(".type-in:not(.has-type-in) .wrap-chars", { type: "chars", charsClass: "anim-char" });
	});
};









HW.whichtrans = function(){
	var t,
	el = document.createElement("fakeelement");
	
	var transitions = {
		"transition" : "transitionend",
		"OTransition" : "oTransitionEnd",
		"MozTransition" : "transitionend",
		"WebkitTransition": "webkitTransitionEnd"
	}
	
	for (t in transitions){
		if (el.style[t] !== undefined){	        
			return transitions[t];
		}
	}	
	
	return 'transitionend';
}


HW.transEvt = HW.whichtrans();

HW.isInt = function(data){
	if(typeof data==='number' && (data%1)===0) {
		return true;
	}
	
	return false;
};





HW.simulateClick = function (elem) {
	// Create our event (with options)
	var evt = new MouseEvent('click', {
		bubbles: true,
		cancelable: true,
		view: window
	});
	// If cancelled, don't dispatch our event
	var canceled = !elem.dispatchEvent(evt);
};











HW.emptyEl = function(element) {

  // Get the element's children as an array
  var children = Array.prototype.slice.call(element.childNodes);

	// Remove each child node
	children.forEach(function (child) {

		element.removeChild(child);
	});
}

HW.strToFrag = function(strHTML) {
	return document.createRange().createContextualFragment(strHTML);
}

DOMTokenList.prototype.addMany = function(a) {
	var b = a.split(' ');
	for (var i = 0, c = b.length; i < c; i++) {
	  this.add(b[i]);
	}
}

DOMTokenList.prototype.removeMany = function(classes) {
	var b = classes.split(' ');
	for (var i = 0, c = b.length; i < c; i++) {
	  this.remove(b[i]);
	}
}

function _removeClasses(c,d){doIt=function(e){e.classList.remove(d)};-1!==d.indexOf(" ")&&(doIt=function(){a.classList.removeMany(d)});for(var b=0;b<c.length;b++){var a=c[b];"htmlcollection"==HW.toType(c[b])&&(a=a.item(0));doIt(a)}}

function _addClasses(c,d){doIt=function(e){e.classList.add(d)};-1!==d.indexOf(" ")&&(doIt=function(){a.classList.addMany(d)});for(var b=0;b<c.length;b++){var a=c[b];"htmlcollection"==HW.toType(c[b])&&(a=a.item(0));doIt(a)}};

function insertAfter(a,b){b.parentNode.insertBefore(a,b.nextSibling)}

function unwrap(a){for(var b=a.parentNode;a.firstChild;)b.insertBefore(a.firstChild,a);b.removeChild(a)}


function offset(a){a=a.getBoundingClientRect();return{top:a.top+(window.pageYOffset||document.documentElement.scrollTop),left:a.left+(window.pageXOffset||document.documentElement.scrollLeft)}};

var debounce = function (fn) {

	// Setup a timer
	var timeout;

	// Return a function to run debounced
	return function () {

		// Setup the arguments
		var context = this;
		var args = arguments;

		// If there's a timer, cancel it
		if (timeout) {
			window.cancelAnimationFrame(timeout);
		}

		if(typeof fn !== 'undefined') {
			// Setup the new requestAnimationFrame()
			timeout = window.requestAnimationFrame(function () {
				if(typeof fn !== 'undefined') {
					fn.apply(context, args);				
				}
			});
		}

	}

};









HW.cleanUrl = function(myhref){
	myhref = HW.stripTrailingSlash(myhref);
	myhref = myhref.replace(window.siteurlRel, "");
	myhref = myhref.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "");
	
	return myhref;	
};




HW.isHwDomReady = false;

function loadLozad(){			
	window.dispatchEvent(HW.loadLozad);
	
	var hasAssign = false;
	
	if(typeof Object.assign == 'function') {
		//console.log('HAS ASSIGN IS FALSE');

		hasAssign = true;
		//		loadjs([hwJsPlugDir + 'lozad.js', hwJsPlugDir + 'picturefill.js'], 'lozad');		
		// loadjs([hwJsPlugDir + 'lozad.js'], 'lozad');		
	}
		
	HW.startedApplication = false;
	
	window.startApplication = function() {
		
		//console.log('START APPLICATION HERE');

		if(hasAssign == false) {
			//console.log('HAS ASSIGN IS FALSE');

			//loadjs([hwJsPlugDir + 'lozad.js'], 'lozad');		
		}
		
		if(HW.startedApplication == true) {
			//console.log('already Started App');

			return;
		}

		HW.startedApplication = true;

		//console.log('dispatch poly event');

		window.dispatchEvent(HW.polyLoaded);


		if(!isIE) {

			//loadjs([hwJsDir + 'hw-youtube.js'], 'youtube');				
			
			// loadjs.ready('youtube', function() {
			// 	loadYt();									
			// });

		}
	};
}

loadLozad();



// loadjs([hwJsPlugDir + 'cssua.js'], 'cssua');


// loadjs.ready('videojs', function() {
// 	loadjs([hwJsDir + 'hw-cfstream.js'], 'hw-cfstream');			
// });

// loadjs(['https://unpkg.com/video.js@8.22.0/dist/video-js.min.css'], 'videojscss');
// loadjs(['https://unpkg.com/video.js@8.22.0/dist/video.min.js'], 'videojs', {async: false});