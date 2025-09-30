import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin);


(window as any).gsap = gsap;
(window as any).ScrollTrigger = ScrollTrigger;
(window as any).Draggable = Draggable;
(window as any).InertiaPlugin = InertiaPlugin;
(window as any).SplitText = SplitText;
