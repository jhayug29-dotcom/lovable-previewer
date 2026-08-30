import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * SilkWave — the flowing lavender ribbon background, rendered live.
 *
 * The reference is a silk sheet caught mid-motion: a black field with one broad
 * band sweeping diagonally across it, folding into near-white highlights and a
 * warm crease where the fold turns. That look is a *warped* field, not a stack of
 * CSS gradients — the folds have to bend with the band — so it is drawn in a
 * fragment shader on a `<canvas>` instead.
 *
 * The band is built in a normalised across-band coordinate (0 on the centre line,
 * ±1 at the edges) so its light can be described the way satin actually behaves:
 * a broad lit face, a bright crease, a hairline specular crest, and a thin warm
 * line where the sheet turns over into shadow. Describing it that way — rather
 * than as brightness bands carved out of an envelope — is what keeps it crisp;
 * earlier passes read as a soft purple haze because the light had no structure.
 *
 * Nothing here fades its own edges: callers that drop it between two black
 * sections should mask the wrapper vertically (see the CTA in `routes/index.tsx`),
 * which is cheaper than a uniform and keeps the component geometry-agnostic.
 *
 * Everything about it is defensive, because it is decoration:
 *  - nothing runs during SSR; the canvas paints only after the effect mounts,
 *  - if WebGL is unavailable the canvas simply stays transparent and the host's
 *    own CSS fallback shows through,
 *  - it only animates while it is actually on screen (IntersectionObserver),
 *  - under `prefers-reduced-motion: reduce` it paints one still frame and stops.
 */
export interface SilkWaveProps {
  /** Seconds per full drift cycle, loosely. Lower = faster. @default 1 */
  speed?: number;
  className?: string;
}

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),                hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  uv.y = 1.0 - uv.y;                       // top-down, like CSS
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_time;

  // --- two slow domain warps. These are what make the ribbon *bend* rather than
  //     slide, and they are the only thing moving fast enough to read as motion.
  float w1 = fbm(vec2(p.x * 0.90 - t * 0.055, p.y * 1.40 + t * 0.035));
  float w2 = fbm(vec2(p.x * 2.20 + t * 0.045, p.y * 2.60 - t * 0.028));

  // --- the ribbon's centre line, climbing to the right as in the reference.
  float centre =
      0.55
    - 0.34 * (uv.x - 0.5)
    + 0.075 * sin(p.x * 1.55 - t * 0.150)
    + 0.032 * sin(p.x * 3.10 + t * 0.110)
    + 0.060 * (w1 - 0.5);

  // --- across-band coordinate: 0 on the centre line, ±1 at the ribbon's edges.
  //     Working in this normalised space is what lets the sheen be described as
  //     "a hard core inside a wide falloff" independently of the band's width.
  float halfW = 0.150 + 0.028 * sin(p.x * 1.20 + t * 0.090);
  float n = (uv.y - centre) / halfW;

  // --- how much satin exists at this pixel. The high exponent keeps the edges
  //     tight, so the field around the ribbon stays properly black instead of
  //     hazing out — that haze is what made the earlier pass look soft.
  float body = exp(-pow(abs(n), 3.4));

  // --- the folds. One dominant crease travels along the ribbon and a second,
  //     shallower one crosses it faster; d is signed distance across the main
  //     crease, so light can be built the way satin actually catches it: a broad
  //     lit face, a bright crease, and a hairline specular crest.
  float crease = 0.34 * sin(p.x * 1.30 - t * 0.125) + 0.24 * (w2 - 0.5);
  float d = n - crease;
  float d2 = n - (0.72 + 0.30 * sin(p.x * 2.35 + t * 0.19) + 0.20 * (w1 - 0.5));

  float face = exp(-d * d * 2.4);          // the lit face of the fold
  float core = exp(-d * d * 22.0);         // the crease itself
  float crest = exp(-d * d * 190.0);       // the specular line along its top
  float fold2 = exp(-d2 * d2 * 30.0);      // the shallower second fold

  float lum = clamp(body * (0.14 + 0.58 * face + 0.62 * core + 0.26 * fold2), 0.0, 1.4);

  // --- palette: black → deep violet → lavender → near-white. Five stops rather
  //     than four: the extra one at the top keeps the crease reading as white
  //     highlight instead of blowing the whole lit face out to pale grey.
  vec3 col = vec3(0.0);
  col = mix(col, vec3(0.085, 0.035, 0.200), smoothstep(0.010, 0.14, lum));
  col = mix(col, vec3(0.360, 0.215, 0.800), smoothstep(0.13,  0.40, lum));
  col = mix(col, vec3(0.660, 0.580, 0.960), smoothstep(0.38,  0.68, lum));
  col = mix(col, vec3(0.885, 0.865, 0.995), smoothstep(0.66,  0.92, lum));
  col = mix(col, vec3(1.000, 0.995, 1.000), smoothstep(0.92,  1.15, lum));

  col += vec3(1.0, 0.99, 1.0) * body * crest * 0.40;

  // --- the warm crease, where the sheet turns over into shadow. Deliberately a
  //     thin line just inside the lower edge (and a fainter one up top), not a
  //     rim traced around the whole shape — that outline read as highlighter.
  float turn = exp(-pow((n - 0.88) * 7.4, 2.0)) * body;
  float turnTop = exp(-pow((n + 0.92) * 9.0, 2.0)) * body;
  col += vec3(0.72, 0.32, 0.06) * (turn * 0.42 + turnTop * 0.18);

  // --- a second, much fainter sheet further down, purely for depth.
  float n2 = (uv.y - (centre + 0.46 + 0.05 * sin(p.x * 2.4 + t * 0.18))) / 0.10;
  col += vec3(0.20, 0.14, 0.46) * exp(-n2 * n2) * 0.30;

  // --- film grain (light, it only needs to break up the gradients), then a wide
  //     vignette so the corners sit back into the black.
  col += (hash(gl_FragCoord.xy + fract(t) * 91.7) - 0.5) * 0.014;
  float vig = smoothstep(1.30, 0.35, length((uv - 0.5) * vec2(1.05, 1.25)));
  col *= 0.55 + 0.45 * vig;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function SilkWave({ speed = 1, className }: SilkWaveProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;

    const gl =
      (canvas.getContext("webgl", {
        antialias: false,
        alpha: false,
      }) as WebGLRenderingContext | null) ?? null;
    if (!gl) return undefined; // no WebGL: the host's CSS fallback shows instead

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return undefined;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return undefined;
    gl.useProgram(prog);

    // One full-screen triangle pair.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");

    // Render at the device's own pixel ratio (capped at 2 so a 3x phone doesn't
    // pay for a decoration). The earlier 1.25 cap was cheap but it softened the
    // crease — the specular crest is a hairline, and hairlines need the pixels.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };

    const draw = (seconds: number) => {
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (still) {
      // One frame, mid-cycle, then nothing else runs.
      draw(12);
      const ro = new ResizeObserver(() => draw(12));
      ro.observe(canvas);
      return () => ro.disconnect();
    }

    let raf = 0;
    let running = false;
    const start = performance.now();

    const frame = (now: number) => {
      draw(((now - start) / 1000) * speed);
      raf = requestAnimationFrame(frame);
    };

    // Only burn GPU while the section is actually on screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry?.isIntersecting ?? false;
        if (visible && !running) {
          running = true;
          raf = requestAnimationFrame(frame);
        } else if (!visible && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(canvas);

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [speed]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      // The CSS gradient is the fallback: it is what shows if WebGL is missing or
      // the context is lost, and it is what paints on the server-rendered HTML
      // before the first frame lands.
      className={cn(
        "block size-full bg-[radial-gradient(120%_80%_at_20%_60%,rgba(150,110,240,0.45),transparent_60%),radial-gradient(90%_70%_at_80%_40%,rgba(90,60,180,0.35),transparent_65%)]",
        className,
      )}
    />
  );
}
