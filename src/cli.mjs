#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const usage = `
Usage:
  postpress-next init [--force]

Scaffolds:
  - postpress.config.ts
  - app/api/postpress/[...slug]/route.ts
`;

function normalizeNewline(text) {
  return text.replace(/\r\n/g, "\n");
}

async function ensureFile(filePath, content, force) {
  try {
    if (!force) {
      await readFile(filePath, "utf8");
      return { action: "skipped", filePath };
    }
  } catch {}

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, normalizeNewline(content), "utf8");
  return { action: "written", filePath };
}

const catchAllRouteTemplate = `import { createPostpressRouter } from '@postpress/next'
import type { NextRequest } from 'next/server'

import { getPostpressConfig } from '@/postpress.config'

export const runtime = 'edge'

type RouteContext = {
  params: Promise<{ slug: string[] }>
}

async function handle(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params
  return createPostpressRouter(getPostpressConfig()).handle(request, slug || [])
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handle(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handle(request, context)
}
`;

const postpressConfigTemplate = `import { definePostpressConfig } from '@postpress/next'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value || !value.trim()) throw new Error(\`Missing \${name}\`)
  return value.trim()
}

async function buildBlocksManifest(): Promise<never> {
  throw new Error('Implement buildBlocksManifest() for your site')
}

async function buildSiteManifest(): Promise<never> {
  throw new Error('Implement buildSiteManifest() for your site')
}

export function getPostpressConfig() {
  return definePostpressConfig({
    siteId: requiredEnv('POSTPRESS_SITE_ID'),
    publicKeyPem: requiredEnv('POSTPRESS_CMS_PUBLIC_KEY_PEM'),
    issuer: (process.env.POSTPRESS_ALLOWED_ISS || 'postpress_cms').trim(),
    buildBlocksManifest,
    buildSiteManifest,
  })
}
`;

async function runInit(force) {
  const root = process.cwd();
  const targets = [
    {
      filePath: path.join(root, "postpress.config.ts"),
      content: postpressConfigTemplate,
    },
    {
      filePath: path.join(root, "app/api/postpress/[...slug]/route.ts"),
      content: catchAllRouteTemplate,
    },
  ];

  const results = [];
  for (const target of targets) {
    results.push(await ensureFile(target.filePath, target.content, force));
  }

  for (const result of results) {
    console.log(`${result.action === "written" ? "write" : "skip "} ${path.relative(root, result.filePath)}`);
  }
}

const args = process.argv.slice(2);
const cmd = args[0];
const force = args.includes("--force");

if (cmd === "init") {
  await runInit(force);
  process.exit(0);
}

console.error(usage.trim());
process.exit(1);
