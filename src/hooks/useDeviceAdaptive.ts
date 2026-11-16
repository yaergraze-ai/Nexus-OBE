"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

export type DeviceKind = "mobile" | "tablet" | "desktop";

export interface AdaptiveDeviceState {
  device: DeviceKind;
  isTouch: boolean;
  reducedMotion: boolean;
}

export function useDeviceAdaptive(): AdaptiveDeviceState {
  const reduced = useReducedMotion() ?? false;
  const [state, setState] = useState<{ device: DeviceKind; isTouch: boolean }>({
    device: "desktop",
    isTouch: false,
  });

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const device: DeviceKind = w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
      const isTouch = window.matchMedia("(pointer: coarse)").matches;
      setState({ device, isTouch });
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  return { ...state, reducedMotion: reduced };
}

