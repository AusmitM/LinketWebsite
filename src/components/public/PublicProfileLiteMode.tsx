"use client";

import { useEffect } from "react";

type NetworkConnection = {
  effectiveType?: string;
  saveData?: boolean;
  rtt?: number;
  downlink?: number;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

const WEAK_TYPES = new Set(["slow-2g", "2g"]);

function getConnection(): NetworkConnection | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as Navigator & {
    connection?: NetworkConnection;
    mozConnection?: NetworkConnection;
    webkitConnection?: NetworkConnection;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

function isWeakConnection(connection: NetworkConnection | undefined) {
  if (!connection) return false;
  if (connection.saveData) return true;
  if (connection.effectiveType && WEAK_TYPES.has(connection.effectiveType)) {
    return true;
  }
  if (typeof connection.downlink === "number" && connection.downlink > 0) {
    return connection.downlink < 0.9;
  }
  if (typeof connection.rtt === "number") {
    return connection.rtt > 800;
  }
  return false;
}

function readLiteOverride() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("lite");
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  return null;
}

export default function PublicProfileLiteMode() {
  useEffect(() => {
    const root = document.documentElement;
    const override = readLiteOverride();
    if (override !== null) {
      root.dataset.lite = override ? "true" : "false";
      return () => {
        delete root.dataset.lite;
      };
    }

    const connection = getConnection();
    const prefersReducedData =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-data: reduce)").matches;

    const update = () => {
      const lite = prefersReducedData || isWeakConnection(connection);
      root.dataset.lite = lite ? "true" : "false";
    };

    update();

    if (connection && typeof connection.addEventListener === "function") {
      connection.addEventListener("change", update);
      return () => {
        connection.removeEventListener?.("change", update);
        delete root.dataset.lite;
      };
    }
    return () => {
      delete root.dataset.lite;
    };
  }, []);

  return null;
}
