For a **1000+ sprite, transform-heavy particle effect on mobile**, the biggest win is usually **not to keep pushing Canvas 2D harder**: if you truly need per-particle scale/rotation/opacity at 60 fps, **WebGL is often the better rendering path**, and even on Stack Overflow the top advice for high-volume particle rendering is to use WebGL and, ideally, move simulation to the GPU too.[1] If you stay on Canvas 2D, the best results come from aggressively reducing per-frame work, minimizing pixels touched, and caching anything that can be pre-rendered.[10][17]

The highest-impact techniques are:

- **Switch to WebGL/WebGPU if possible** for the actual render path, especially when every particle needs its own transform and alpha blend.[1]
- **Pre-render particle chunks** into offscreen canvases when the source image or chunk appearance is reusable, then draw those cached bitmaps instead of re-running the expensive generation steps every frame.[10][17]
- **Use multiple offscreen canvases/layers** so static or semi-static content is drawn once and reused, rather than redrawn with every frame.[7][10][11]
- **Round coordinates to integers** for `drawImage()` when subpixel smoothing is not essential, because integer positions are faster than fractional ones on Canvas 2D.[10][11][18]
- **Draw at lower resolution** and scale up if your visual design allows it; reducing pixels processed per frame is one of the most reliable mobile wins.[11][13]
- **Disable alpha on the context** if you do not need transparency behind the canvas, using `getContext('2d', { alpha: false })` to reduce compositing cost.[10]
- **Use `requestAnimationFrame`** and keep the frame loop tight; avoid timers for animation.[11][18]
- **Keep allocations out of the hot loop**; pre-allocate particle data and reuse objects to reduce garbage collection pauses.[9][13]
- **Separate simulation from rendering** so physics/update work can be optimized independently, and consider moving heavier computation to a worker where appropriate.[9][13]
- **Profile first, then optimize the real bottleneck** with DevTools Performance; don’t guess.[13]

For your specific effect, the most practical bleeding-edge Canvas 2D approach is usually this:

- **Pre-bake the image into chunk sprites once** on load, not every frame.[10][17]
- Store particle state in **parallel typed arrays** rather than arrays of objects for better cache locality and less GC pressure.[13]
- Update transforms in JS, but keep drawing minimal:
  - `ctx.setTransform(...)` only if needed, otherwise use simpler translate/rotate/scale sequences sparingly.
  - Batch state changes where possible.
- **Cull aggressively**: skip particles outside the viewport or below a visible alpha threshold.
- If particles are visually similar, **group them into a few prerendered atlas variants** instead of unique per-particle bitmap generation.[5][7][10]
- **Render only dirty regions** if the effect is localized; avoid clearing and repainting the full canvas every frame when you can.[11][17]
- Prefer **one bitmap draw per particle** over complex per-particle path work, and avoid expensive blend/composite modes unless they are essential.[8][11]

A useful rule of thumb from mobile canvas guidance is that the best gains come from **drawing less**, **touching fewer pixels**, and **reusing already-rendered content** rather than trying to micro-optimize JavaScript alone.[8][10][17]

If you want the **best chance at 60 fps on mid-range phones**, the strongest stack is:

1. **WebGL** for rendering.[1]
2. If staying on Canvas 2D, **offscreen prerendered chunks + typed arrays + integer positions + low-resolution backing store**.[10][11][13]
3. **Alpha disabled** when possible and **no unnecessary full-canvas clears**.[10][11]
4. **Profile the actual bottleneck** before adding complexity.[13]

If you want, I can turn this into a **concrete Canvas 2D optimization checklist** or a **WebGL migration plan** for your fly-in image assembly effect.

Citations:
[1] https://stackoverflow.com/questions/13405063/maximixing-the-speed-of-particle-rendering-on-html5-canvas
[2] https://sachinsharma.dev/blogs/high-performance-canvas-rendering-particles
[3] https://stackoverflow.com/questions/43498923/html5-canvas-particle-explosion
[4] https://www.youtube.com/watch?v=VfmTi4k51aQ
[5] https://stackoverflow.com/questions/27630126/increase-performance-for-10-000-particles-in-html5-canvas
[6] https://terrellflautt.com/blog/design/particle-effects.html
[7] https://about.flipboard.com/engineering/60-fps-on-the-mobile-web/
[8] https://gamedev.stackexchange.com/questions/5314/how-does-one-optimize-an-html5-canvas-and-javascript-web-application-for-mobile
[9] https://www.tutorialspoint.com/article/improve-performance-of-a-html5-canvas-with-particles-bouncing-around
[10] https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
[11] https://gist.github.com/jaredwilli/5469626
[12] https://www.reddit.com/r/javascript/comments/hucn8/is_smooth_60fps_canvas_animation_really_possible/
[13] https://www.mysimulator.uk/blog/tip-60fps-canvas.html
[14] https://community.adobe.com/questions-540/poor-performance-on-mobile-browsers-html5-canvas-solved-100945
[15] https://timothypoon.com/blog/2011/01/19/html5-canvas-particle-animation/
[16] https://stackoverflow.com/questions/30509778/how-to-get-better-performance-with-a-lot-of-particles-canvas
[17] https://web.dev/articles/canvas-performance
[18] https://web.dev/articles/canvas-performance?hl=ja
[19] https://stackoverflow.com/questions/68733355/how-to-improve-html5-canvas-performance
[20] https://www.facebook.com/qt/videos/qt-canvas-painter-enables-hardware-accelerated-2d-rendering-that-balances-high-p/1466241222175628/
