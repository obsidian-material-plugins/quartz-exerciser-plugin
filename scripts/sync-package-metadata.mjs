import { readFile, writeFile } from "node:fs/promises";

const packageUrl = new URL("../package.json", import.meta.url);
const lockfileUrl = new URL("../package-lock.json", import.meta.url);
const expectedRepositoryUrl =
  "git+https://github.com/obsidian-material-plugins/quartz-exerciser-plugin.git";

const packageManifest = JSON.parse(await readFile(packageUrl, "utf8"));
const lockfile = JSON.parse(await readFile(lockfileUrl, "utf8"));
const packageVersion = packageManifest.version;

if (typeof packageVersion !== "string" || packageVersion.length === 0) {
  throw new Error("package.json must contain a non-empty version");
}

if (packageManifest.quartz === null || typeof packageManifest.quartz !== "object") {
  throw new Error("package.json must contain Quartz plugin metadata");
}

if (lockfile.packages?.[""] === undefined) {
  throw new Error("package-lock.json must contain the root package entry");
}

const mismatches = [
  ["package.json quartz.version", packageManifest.quartz.version, packageVersion],
  ["package.json repository.url", packageManifest.repository?.url, expectedRepositoryUrl],
  ["package-lock.json version", lockfile.version, packageVersion],
  ["package-lock.json root version", lockfile.packages[""].version, packageVersion],
].filter(([, actual, expected]) => actual !== expected);

if (process.argv.includes("--check")) {
  if (mismatches.length > 0) {
    const details = mismatches
      .map(([label, actual, expected]) => `${label}: expected ${expected}, received ${actual}`)
      .join("\n");
    throw new Error(`Package metadata is out of sync:\n${details}`);
  }

  console.log(`Package metadata is aligned at version ${packageVersion}`);
  process.exit(0);
}

packageManifest.quartz.version = packageVersion;
packageManifest.repository.url = expectedRepositoryUrl;
lockfile.version = packageVersion;
lockfile.packages[""].version = packageVersion;

await Promise.all([
  writeFile(packageUrl, `${JSON.stringify(packageManifest, null, 2)}\n`),
  writeFile(lockfileUrl, `${JSON.stringify(lockfile, null, 2)}\n`),
]);

console.log(`Synchronized package metadata at version ${packageVersion}`);
