import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const srcRoot = path.join(projectRoot, "src");
const candidateExtensions = [".ts", ".tsx", ".js", ".mjs"];

function resolveAlias(specifier) {
  const basePath = path.join(srcRoot, specifier.slice(2));
  const directCandidates = [
    basePath,
    ...candidateExtensions.map((extension) => `${basePath}${extension}`),
    ...candidateExtensions.map((extension) =>
      path.join(basePath, `index${extension}`)
    ),
  ];

  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return pathToFileURL(candidate).href;
    }
  }

  return null;
}

function resolveRelativeSpecifier(specifier, parentURL) {
  if (!parentURL?.startsWith("file:")) {
    return null;
  }

  const parentPath = path.dirname(fileURLToPath(parentURL));
  const basePath = path.resolve(parentPath, specifier);
  const directCandidates = [
    basePath,
    ...candidateExtensions.map((extension) => `${basePath}${extension}`),
    ...candidateExtensions.map((extension) =>
      path.join(basePath, `index${extension}`)
    ),
  ];

  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return pathToFileURL(candidate).href;
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: "data:text/javascript,export default undefined;",
    };
  }

  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }

  if (specifier.startsWith("@/")) {
    const resolved = resolveAlias(specifier);
    if (!resolved) {
      throw new Error(`Unable to resolve alias import: ${specifier}`);
    }
    return nextResolve(resolved, context);
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const resolved = resolveRelativeSpecifier(specifier, context.parentURL);
    if (resolved) {
      return nextResolve(resolved, context);
    }
  }

  return nextResolve(specifier, context);
}
