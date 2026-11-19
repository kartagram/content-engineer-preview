const VERT = "attribute vec2 a_position; void main(){ gl_Position = vec4(a_position, 0.0, 1.0); }";
const FRAG = [
  "precision highp float;",
  "uniform vec2 u_resolution; uniform float u_time; uniform vec2 u_mouse;",
  "uniform vec3 u_background; uniform vec3 u_ink;",
  "uniform float u_intensity; uniform float u_cellCount;",
  "float bayer4(vec2 p){",
  "  int x=int(mod(p.x,4.0)); int y=int(mod(p.y,4.0)); int i=x+y*4; float m=0.0;",
  "  if(i==0)m=0.0; else if(i==1)m=8.0; else if(i==2)m=2.0; else if(i==3)m=10.0;",
  "  else if(i==4)m=12.0; else if(i==5)m=4.0; else if(i==6)m=14.0; else if(i==7)m=6.0;",
  "  else if(i==8)m=3.0; else if(i==9)m=11.0; else if(i==10)m=1.0; else if(i==11)m=9.0;",
  "  else if(i==12)m=15.0; else if(i==13)m=7.0; else if(i==14)m=13.0; else m=5.0;",
  "  return (m+0.5)/16.0; }",
  "vec2 hash2(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return -1.0+2.0*fract(sin(p)*43758.5453123); }",
  "float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);",
  "  return mix(mix(dot(hash2(i),f),dot(hash2(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),",
  "             mix(dot(hash2(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(hash2(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y); }",
  "float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }",
  "void main(){",
  "  float cellSize = max(2.0, floor(u_resolution.y / u_cellCount));",
  "  vec2 cell = floor(gl_FragCoord.xy / cellSize);",
  "  vec2 uv = (cell * cellSize + cellSize * 0.5) / u_resolution;",
  "  float aspect = u_resolution.x / u_resolution.y;",
  "  vec2 p = vec2(uv.x * aspect, uv.y);",
  "  vec2 mouse = vec2(u_mouse.x * aspect, u_mouse.y);",
  "  float bend = exp(-length(p - mouse) * 3.2);",
  "  vec2 flow = p * vec2(1.3, 2.1);",
  "  flow.x -= u_time * 0.08;",
  "  flow += bend * 0.28 * vec2(cos(u_time * 0.7), sin(u_time * 0.9));",
  "  float warp = fbm(flow + fbm(flow * 1.4 + u_time * 0.025) * 1.1);",
  "  float v = warp * 0.5 + 0.5;",
  "  float shade = smoothstep(0.22, 0.74, v);",
  "  shade = shade * (0.35 + shade * 0.65);",
  "  float laneY = floor(uv.y * 9.0);",
  "  float lane = fract(uv.y * 9.0);",
  "  float laneCenter = smoothstep(0.25, 0.5, lane) * smoothstep(0.75, 0.5, lane);",
  "  float pulse = smoothstep(0.62, 0.95, noise(vec2(uv.x * 2.2 - u_time * 0.38, laneY * 13.7)));",
  "  shade = max(shade, laneCenter * pulse * 0.85);",
  "  shade += bend * 0.1;",
  "  shade *= smoothstep(0.68, 0.94, uv.x);",
  "  shade *= u_intensity;",
  "  float on = step(bayer4(cell), shade);",
  "  gl_FragColor = vec4(mix(u_background, u_ink, on * (0.34 + 0.36 * smoothstep(0.2, 0.9, shade))), 1.0);",
  "}"
].join("\n");

function rgb(hex) {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}


function startField() {
 const cv = document.querySelector("canvas");
 const panel = cv.parentElement;
    const gl = cv.getContext("webgl", { antialias: false, depth: false, stencil: false });
    if (!gl) return;

    function compile(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : (console.warn(gl.getShaderInfoLog(sh)), null);
    }
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ["u_resolution", "u_time", "u_mouse", "u_background", "u_ink", "u_intensity", "u_cellCount"].forEach((n) => {
      U[n] = gl.getUniformLocation(prog, n);
    });
    const cs = getComputedStyle(document.documentElement);
    gl.uniform3fv(U.u_background, rgb(cs.getPropertyValue("--panel")));
    gl.uniform3fv(U.u_ink, rgb(cs.getPropertyValue("--panel-ink")));
    gl.uniform1f(U.u_intensity, 0.3);
    gl.uniform1f(U.u_cellCount, 260);

    const m = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const t0 = performance.now();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, stopped = false;

    function size() {
      const d = Math.min(devicePixelRatio || 1, 2);
      /* the canvas's own box (it can be a band shorter than the panel on phones) */
      const w = Math.floor(cv.clientWidth * d), h = Math.floor(cv.clientHeight * d);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
    }
    function draw(now) {
      size();
      m.x += (m.tx - m.x) * 0.08;
      m.y += (m.ty - m.y) * 0.08;
      gl.uniform2f(U.u_resolution, cv.width, cv.height);
      gl.uniform1f(U.u_time, (now - t0) / 1000);
      gl.uniform2f(U.u_mouse, m.x, 1 - m.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    /* Only animate while the canvas is on screen: off-screen frames are wasted
       GPU work that makes typing in the apply form lag on mid-range phones. */
    let onScreen = true;
    const running = () => !stopped && !reduced && !document.hidden && onScreen;
    function start() { cancelAnimationFrame(raf); if (running()) raf = requestAnimationFrame(loop); }
    function loop(now) { if (!running()) return; draw(now); raf = requestAnimationFrame(loop); }
    function onVis() { start(); }
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; start(); });
    io.observe(cv);
    function onMove(e) {
      const b = panel.getBoundingClientRect();
      m.tx = (e.clientX - b.left) / b.width;
      m.ty = (e.clientY - b.top) / b.height;
    }
    panel.addEventListener("pointermove", onMove);
    draw(performance.now());
    start();

}
startField();
