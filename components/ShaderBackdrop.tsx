"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const vert = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = `
  uniform float time;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(0.1031, 0.1030));
    p += dot(p, p.yx + 33.33);
    return fract((p.x + p.y) * p.x);
  }

  void main() {
    vec2 uv = vUv;
    vec2 px = gl_FragCoord.xy;

    vec3 color = vec3(0.018, 0.055, 0.84);

    float frame = floor(time * 14.0);
    float grain = hash(px + frame);
    float fine = hash(floor(px * 0.5) + frame * 3.17);
    float grit = (grain - 0.5) * 0.28 + (fine - 0.5) * 0.08;

    float edge = smoothstep(0.0, 0.22, uv.x) * smoothstep(1.0, 0.78, uv.x) * smoothstep(0.0, 0.22, uv.y) * smoothstep(1.0, 0.78, uv.y);

    color += vec3(0.0, grit * 0.24, grit * 0.96);
    color *= mix(0.82, 1.0, edge);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

export function ShaderBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    cam.position.z = 1;
    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        time: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const gl = new THREE.WebGLRenderer({ canvas: node, antialias: false, alpha: false, powerPreference: "high-performance" });
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;

    scene.add(mesh);

    const fit = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      gl.setPixelRatio(ratio);
      gl.setSize(window.innerWidth, window.innerHeight, false);
    };

    const draw = () => {
      mat.uniforms.time.value += media.matches ? 0 : 0.016;
      gl.render(scene, cam);
      if (!media.matches) raf = requestAnimationFrame(draw);
    };

    fit();
    draw();
    window.addEventListener("resize", fit);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      gl.dispose();
      mat.dispose();
      geo.dispose();
    };
  }, []);

  return <canvas ref={ref} className="shaderBackdrop" aria-hidden="true" />;
}
