import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Application, Job, Profile } from "@prisma/client";
import { env } from "../env";
import { logger } from "../log";
import { classifyField, profileValues, type FieldKey } from "./fieldMap";

const log = logger("submit");

export type SubmitOutcome =
  | { status: "submitted"; receiptPath: string; filled: FieldKey[] }
  | { status: "needs_you"; reason: string; receiptPath?: string; filled: FieldKey[] }
  | { status: "failed"; reason: string };

/** Signals of an anti-bot / human-verification wall. Sento never solves these. */
const CAPTCHA_SELECTORS = [
  'iframe[src*="recaptcha"]',
  'iframe[src*="hcaptcha"]',
  'iframe[src*="challenges.cloudflare.com"]',
  'iframe[title*="captcha" i]',
  ".g-recaptcha",
  ".h-captcha",
  ".cf-turnstile",
  "#challenge-form",
];

interface FieldDescriptor {
  tag: string;
  type: string;
  descriptor: string;
  required: boolean;
}

/**
 * Drive one application form with a real browser. The submit click is gated by
 * SENTO_REQUIRE_APPROVAL, and any CAPTCHA / anti-bot wall or unrecognized
 * required field hands off to a human (NEEDS_YOU) rather than being bypassed.
 */
export async function submitApplication(
  application: Application,
  job: Job,
  profile: Profile,
): Promise<SubmitOutcome> {
  if (!job.url) return { status: "failed", reason: "job has no application URL" };

  // Dynamic import keeps Playwright out of the Next.js bundle.
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: !env.headful });
  const filled: FieldKey[] = [];
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; Sento-JobAgent/0.1; job-seeker automation; +https://github.com/)",
    });
    const page = await context.newPage();
    await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1500);

    const receiptPath = await captureReceipt(page, application.id, "pre-submit");

    // Hard stop on anti-bot walls.
    for (const sel of CAPTCHA_SELECTORS) {
      if ((await page.locator(sel).count()) > 0) {
        log.warn("captcha wall detected; handing off", { app: application.id, sel });
        return {
          status: "needs_you",
          reason:
            "A CAPTCHA / human-verification step is present. Sento does not bypass these — please complete it and submit.",
          receiptPath,
          filled,
        };
      }
    }

    const values = profileValues(profile, application.coverLetterText);
    const unknownRequired: string[] = [];

    const elements = await page.$$("input, textarea, select");
    for (const el of elements) {
      const d = (await el.evaluate((node) => {
        const e = node as HTMLInputElement;
        const label =
          (e.labels && e.labels.length ? e.labels[0]?.textContent : "") ||
          e.getAttribute("aria-label") ||
          "";
        return {
          tag: e.tagName.toLowerCase(),
          type: (e.getAttribute("type") || "text").toLowerCase(),
          descriptor: [e.name, e.id, e.getAttribute("placeholder"), label]
            .filter(Boolean)
            .join(" "),
          required: e.required || e.getAttribute("aria-required") === "true",
        };
      })) as FieldDescriptor;

      if (["hidden", "submit", "button", "checkbox", "radio"].includes(d.type)) continue;

      if (d.type === "file") {
        if (/resume|cv|cover/i.test(d.descriptor)) {
          const path = await materializeResume(application);
          await el.setInputFiles(path).catch(() => {});
          filled.push("coverLetter");
        }
        continue;
      }

      const key = classifyField(d.descriptor);
      if (!key) {
        if (d.required) unknownRequired.push(d.descriptor || `${d.tag}/${d.type}`);
        continue;
      }
      const value = values[key];
      if (value === undefined) {
        if (d.required) unknownRequired.push(d.descriptor);
        continue;
      }
      try {
        if (d.tag === "select") {
          await el.selectOption({ label: value }).catch(async () => {
            await el.selectOption(value).catch(() => {});
          });
        } else {
          await el.fill(value);
        }
        filled.push(key);
      } catch {
        // leave as unknown; a human can finish it
      }
    }

    if (unknownRequired.length > 0) {
      return {
        status: "needs_you",
        reason: `Unrecognized required question(s): ${unknownRequired.slice(0, 5).join(" | ")}`,
        receiptPath,
        filled,
      };
    }

    if (env.requireApproval) {
      return {
        status: "needs_you",
        reason: "Form is pre-filled and awaiting your approval before submit (SENTO_REQUIRE_APPROVAL=1).",
        receiptPath,
        filled,
      };
    }

    // Auto-submit path.
    const submitBtn = page
      .locator(
        'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply")',
      )
      .first();
    if ((await submitBtn.count()) === 0) {
      return { status: "needs_you", reason: "No submit button found", receiptPath, filled };
    }
    await submitBtn.click({ timeout: 15_000 });
    await page.waitForTimeout(2500);
    const confirmPath = await captureReceipt(page, application.id, "submitted");
    return { status: "submitted", receiptPath: confirmPath, filled };
  } catch (err) {
    return { status: "failed", reason: err instanceof Error ? err.message : String(err) };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function receiptsDir(): Promise<string> {
  const dir = join(process.cwd(), "receipts");
  await mkdir(dir, { recursive: true });
  return dir;
}

async function captureReceipt(
  page: import("playwright").Page,
  appId: string,
  stage: string,
): Promise<string> {
  const dir = await receiptsDir();
  const path = join(dir, `${appId}-${stage}-${Date.now()}.png`);
  await page.screenshot({ path, fullPage: true }).catch(() => {});
  return path;
}

/** Write the tailored résumé to a text file Playwright can upload. */
async function materializeResume(application: Application): Promise<string> {
  const dir = await receiptsDir();
  const path = join(dir, `${application.id}-resume.txt`);
  await writeFile(path, application.tailoredResumeText ?? "", "utf8");
  return path;
}
