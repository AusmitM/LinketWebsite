"use client";

import { useEffect } from "react";

const ENABLE_IN_DEV = process.env.NEXT_PUBLIC_ENABLE_SW === "true";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (!ENABLE_IN_DEV && process.env.NODE_ENV !== "production") return;

    let didReloadForUpdate = false;
    const onControllerChange = () => {
      if (didReloadForUpdate) return;
      didReloadForUpdate = true;
      window.location.reload();
    };

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await registration.update().catch(() => undefined);

        const activateWaitingWorker = () => {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        };

        activateWaitingWorker();

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              activateWaitingWorker();
            }
          });
        });
      } catch {
        // Ignore registration errors and continue without SW support.
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    if (document.readyState === "complete") {
      void register();
      return () => {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange
        );
      };
    }

    const onLoad = () => {
      void register();
    };
    window.addEventListener("load", onLoad);
    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  return null;
}
