"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics-events";

export function LandingView() {
  useEffect(() => track("landing_view"), []);
  return null;
}
