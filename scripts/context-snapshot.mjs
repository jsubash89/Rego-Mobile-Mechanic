#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    return (error.stdout?.toString() || error.stderr?.toString() || error.message).trim();
  }
}

function section(title, body) {
  console.log(`\n## ${title}`);
  console.log(body || "(empty)");
}

const root = process.cwd();
const pkgPath = path.join(root, "package.json");
const briefPath = path.join(root, "docs/PROJECT_BRIEF.md");
const planPath = path.join(root, "docs/plans/assistme-build-plan.md");

console.log(`# AssistMe Context Snapshot`);
console.log(`root: ${root}`);
console.log(`generatedAt: ${new Date().toISOString()}`);

if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  section("Package", `${pkg.name}@${pkg.version}\nscripts: ${Object.keys(pkg.scripts || {}).join(", ")}\ndependencies: ${JSON.stringify(pkg.dependencies || {})}`);
}

section("Git status", run("git status --short"));
section("Recent commits", run("git --no-pager log --oneline -5"));
section("Tracked source files", run("git ls-files | sed 's#^#- #'"));
section("Build command", "npm run build");

if (existsSync(briefPath)) {
  const brief = readFileSync(briefPath, "utf8").split("\n").slice(0, 80).join("\n");
  section("Project brief excerpt", brief);
}

if (existsSync(planPath)) {
  const plan = readFileSync(planPath, "utf8").split("\n").filter((line) => line.startsWith("## Task") || line.startsWith("Status:")).join("\n");
  section("Plan task index", plan);
}
