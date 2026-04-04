"use client";

import { useEffect } from "react";

export function MouseGlow() {
  useEffect(() => {
    const glow = document.createElement("div");
    glow.style.cssText = `
      position: fixed;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.07) 0%, rgba(16, 185, 129, 0.02) 40%, transparent 70%);
      transform: translate(-50%, -50%);
      transition: left 0.15s ease-out, top 0.15s ease-out;
      will-change: left, top;
    `;
    document.body.appendChild(glow);

    function onMove(e: MouseEvent) {
      glow.style.left = e.clientX + "px";
      glow.style.top = e.clientY + "px";
    }

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      glow.remove();
    };
  }, []);

  return null;
}
