"use client";

import { useEffect } from "react";

const ENABLE_IN_DEV = process.env.NEXT_PUBLIC_ENABLE_SW === "true";
const SHOULD_ENABLE_SW =
  process.env.NODE_ENV === "production" || ENABLE_IN_DEV;
const SW_PATH = "/sw.js";

async function unregisterLinketServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  const linketRegistrations = registrations.filter((registration) =>
    registration.active?.scriptURL?.endsWith(SW_PATH) ||
    registration.waiting?.scriptURL?.endsWith(SW_PATH) ||
    registration.installing?.scriptURL?.endsWith(SW_PATH)
  );
  if (!linketRegistrations.length) return false;

  await Promise.all(
    linketRegistrations.map((registration) =>
      registration.unregister().catch(() => false)
    )
  );

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("linket-"))
        .map((key) => caches.delete(key))
    );
  }

  return true;
}

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let didReloadForUpdate = false;
    const onControllerChange = () => {
      if (didReloadForUpdate) return;
      didReloadForUpdate = true;
      window.location.reload();
    };

    if (!SHOULD_ENABLE_SW) {
      void (async () => {
        const hadController = Boolean(navigator.serviceWorker.controller);
        const removed = await unregisterLinketServiceWorkers();
        if ((hadController || removed) && !didReloadForUpdate) {
          didReloadForUpdate = true;
          window.location.reload();
        }
      })();
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SW_PATH);
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
