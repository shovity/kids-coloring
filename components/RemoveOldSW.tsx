"use client";

import { useEffect } from "react";

/** Gỡ service worker và cache của bản cũ (từng có chế độ tải offline). */
export default function RemoveOldSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()));
    if ("caches" in window) void caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k)));
  }, []);
  return null;
}
