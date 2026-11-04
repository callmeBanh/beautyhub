import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const stylesheetPath = fileURLToPath(
  new URL("../src/styles.css", import.meta.url),
);
export const contrastChecks = [
  ["light", "body text", "default", "--color-text", "--color-white", 4.5],
  ["light", "muted text", "default", "--color-text-muted", "--color-white", 4.5],
  ["blush", "body text", "default", "--color-text", "--color-blush", 4.5],
  ["blush", "muted text", "default", "--color-text-muted", "--color-blush", 4.5],
  ["light", "link", "default", "--color-link", "--color-white", 4.5],
  ["blush", "link", "default", "--color-link", "--color-blush", 4.5],
  ["light", "link", "hover", "--color-link-hover", "--color-white", 4.5],
  ["blush", "link", "hover", "--color-link-hover", "--color-blush-hover", 4.5],
  ["primary", "button label", "default", "--color-on-dark", "--color-rose-gold-strong", 4.5],
  ["primary", "button label", "hover", "--color-on-dark", "--color-primary-hover", 4.5],
  ["primary", "button label", "active", "--color-on-dark", "--color-primary-active", 4.5],
  ["secondary", "button label/border", "default", "--color-rose-gold-strong", "--color-white", 4.5],
  ["secondary", "button label/border", "hover", "--color-ink", "--color-blush-hover", 4.5],
  ["ghost", "button label/icon", "hover", "--color-ink", "--color-blush-hover", 4.5],
  ["disabled", "button label", "disabled", "--color-disabled-text", "--color-disabled-bg", 3],
  ["disabled", "button border", "disabled", "--color-disabled-border", "--color-disabled-bg", 3],
  ["dark", "primary text/icon", "default", "--color-on-dark", "--color-ink", 4.5],
  ["dark", "muted text", "default", "--color-on-dark-muted", "--color-ink", 4.5],
  ["dark", "accent text/link", "default", "--color-accent-on-dark", "--color-ink", 4.5],
  ["dark", "menu text/icon", "hover", "--color-on-dark", "--color-on-dark-hover-composite", 4.5],
  ["dark", "menu active", "active", "--color-ink", "--color-on-dark-active-bg", 4.5],
  ["dark", "focus outline", "focus-visible", "--color-focus-on-dark", "--color-ink", 3],
  ["light", "focus outline", "focus-visible", "--color-focus-on-light", "--color-white", 3],
  ["blush", "focus outline", "focus-visible", "--color-focus-on-light", "--color-blush", 3],
  ["hero image", "headline/scrim", "default, hover, active", "--color-on-dark", "--color-hero-worst-case", 4.5],
  ["hero image", "accent heading/scrim", "default, hover, active", "--color-accent-on-dark", "--color-hero-worst-case", 4.5],
  ["input", "placeholder", "default", "--color-text-muted", "--color-white", 4.5],
  ["input", "border", "default", "--color-line", "--color-white", 3],
  ["input", "border", "blush parent", "--color-line", "--color-blush", 3],
  ["input", "focus border", "focus-visible", "--color-focus-on-light", "--color-white", 3],
  ["success", "status text/icon", "default", "--color-success", "--color-success-surface", 4.5],
  ["success dark", "status text/icon", "default", "--color-success-on-dark", "--color-ink", 4.5],
  ["warning", "status text/icon", "default", "--color-warning", "--color-warning-surface", 4.5],
  ["warning dark", "status text/icon", "default", "--color-warning-on-dark", "--color-ink", 4.5],
  ["danger", "status text/icon", "default", "--color-danger", "--color-danger-surface", 4.5],
  ["danger dark", "status text/icon", "default", "--color-danger-on-dark", "--color-ink", 4.5],
  ["info", "status text/icon", "default", "--color-info", "--color-info-surface", 4.5],
  ["info dark", "status text/icon", "default", "--color-info-on-dark", "--color-ink", 4.5],
  ["neutral", "status text/icon", "default", "--color-neutral", "--color-neutral-surface", 4.5],
  ["dark", "footer link", "hover", "--color-on-dark", "--color-ink", 4.5],
  ["dark", "focus outline", "focus-visible", "--color-focus-on-dark", "--color-ink", 3],
  ["hero pill", "text", "default", "--color-ink", "--color-hero-pill-worst-case", 4.5],
  ["hero pill", "border", "default", "--color-line", "--color-hero-pill-worst-case", 3],
  ["gallery image", "caption", "hover", "--color-on-dark", "--color-gallery-worst-case", 4.5],
  ["gallery image", "caption", "active", "--color-on-dark", "--color-gallery-worst-case", 4.5],
  ["client CTA", "body text", "default", "--color-accent-on-dark", "--color-primary-hover", 4.5],
  ["lightbox", "caption", "default", "--color-on-dark", "--color-ink", 4.5],
  ["footer", "divider", "default", "--color-line", "--color-ink", 3],
  ["support button", "label/icon", "default and hover", "--color-support-fg", "--color-support-bg", 4.5],
  ["support button", "focus outline", "focus-visible", "--color-support-focus", "--color-white", 3],
  ["support button", "status dot", "default", "--color-support-dot", "--color-support-bg", 3],
  ["card", "hover border", "hover", "--color-rose-gold", "--color-white", 3],
  ["blush card", "border", "default", "--color-line", "--color-blush", 3],
  ["lightbox", "navigation icon", "hover and active", "--color-ink", "--color-on-dark-active-bg", 4.5],
  ["modal", "body text", "default", "--color-text", "--color-white", 4.5],
  ["toast", "body text", "default", "--color-on-dark", "--color-ink", 4.5],
  ["cookie", "body text", "default", "--color-text", "--color-white", 4.5],
];

function parseVariables(css) {
  const root = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
  if (!root) throw new Error("Could not find :root design tokens in styles.css");
  return new Map(
    [...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, key, value]) => [
      key,
      value.trim(),
    ]),
  );
}

function resolve(value, variables, seen = new Set()) {
  let current = value;
  for (let i = 0; i < 12; i++) {
    const match = current.match(/var\((--[\w-]+)\)/);
    if (!match) return current;
    if (seen.has(match[1])) throw new Error(`CSS variable cycle at ${match[1]}`);
    seen.add(match[1]);
    const replacement = variables.get(match[1]);
    if (!replacement) throw new Error(`Undefined CSS variable ${match[1]}`);
    current = current.replace(match[0], replacement);
  }
  throw new Error(`Too many nested CSS variables in ${value}`);
}

function parseColor(value, variables) {
  const resolved = resolve(value, variables);
  const hex = resolved.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map((x) => x + x).join("") : hex;
    if (expanded.length < 6) throw new Error(`Unsupported hex color: ${resolved}`);
    return [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16) / 255);
  }
  const rgba = resolved.match(/^rgba?\(([^)]+)\)$/i)?.[1];
  if (rgba) {
    const values = rgba.split(",").map((part) => Number.parseFloat(part.trim()));
    if (values.length < 3 || values.slice(0, 3).some(Number.isNaN)) {
      throw new Error(`Unsupported CSS color: ${resolved}`);
    }
    return values.slice(0, 3).map((value) => value / 255);
  }
  throw new Error(`Unsupported CSS color value: ${resolved}`);
}

function ratio(foreground, background, variables) {
  const fg = parseColor(foreground, variables);
  const bg = parseColor(background, variables);
  const luminanceOf = (channels) => {
    const linear = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return linear.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  };
  const a = luminanceOf(fg);
  const b = luminanceOf(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function composite(foreground, background, alpha) {
  const fg = foreground.map((channel) => channel * alpha);
  const bg = background.map((channel) => channel * (1 - alpha));
  return `#${fg.map((channel, index) => Math.round((channel + bg[index]) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function auditContrast(css) {
  const variables = parseVariables(css);
  variables.set(
    "--color-on-dark-hover-composite",
    composite(
      parseColor("var(--color-on-dark)", variables),
      parseColor("var(--color-ink)", variables),
      0.14,
    ),
  );
  variables.set(
    "--color-hero-worst-case",
    composite(
      parseColor("var(--color-ink)", variables),
      [1, 1, 1],
      0.94,
    ),
  );
  variables.set(
    "--color-hero-pill-worst-case",
    composite(parseColor("var(--color-white)", variables), [0, 0, 0], 0.9),
  );
  variables.set(
    "--color-gallery-worst-case",
    composite(parseColor("var(--color-ink)", variables), [1, 1, 1], 0.9),
  );

  return contrastChecks.map(([surface, component, state, foreground, background, minimum]) => {
    const foregroundColor = resolve(`var(${foreground})`, variables);
    const backgroundColor = resolve(`var(${background})`, variables);
    const contrast = ratio(foregroundColor, backgroundColor, variables);
    return {
      surface,
      component,
      state,
      foreground: foregroundColor,
      background: backgroundColor,
      ratio: Number(contrast.toFixed(2)),
      minimum,
      pass: contrast >= minimum,
    };
  });
}

export function runContrastCheck(css = readFileSync(stylesheetPath, "utf8")) {
  const results = auditContrast(css);
  console.log("| Surface | Thành phần | Trạng thái | Chữ/icon | Nền | Tỉ lệ | Ngưỡng | Kết quả |");
  console.log("|---|---|---|---|---|---:|---:|---|");
  for (const result of results) {
    console.log(
      `| ${result.surface} | ${result.component} | ${result.state} | ${result.foreground} | ${result.background} | ${result.ratio}:1 | ${result.minimum}:1 | ${result.pass ? "Đạt" : "KHÔNG ĐẠT"} |`,
    );
  }
  const failures = results.filter((result) => !result.pass);
  console.log(`\n${results.length - failures.length}/${results.length} cặp màu đạt ngưỡng.`);
  if (failures.length) process.exitCode = 1;
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1])) {
  runContrastCheck();
}
