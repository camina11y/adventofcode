import { NodeHtmlMarkdown } from "npm:node-html-markdown";
import { parse } from "npm:node-html-parser";

const now = new Date();

const day = Deno.args.at(0) ??
  now.getDate();
const year = Deno.args.at(1) ??
    now.getMonth() === 11
  ? now.getFullYear()
  : now.getFullYear() - 1;

const url = `https://adventofcode.com/${year}/day/${day}`;

const res = await fetch(url);

if (!res.ok) {
  throw Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
}

console.info(`Fetched ${url}`);

const article = parse(await res.text()).querySelector("article")!;

{
  const title = article.querySelector("h2")!;
  title.tagName = "h1";
  title.innerHTML = title.innerHTML
    .replaceAll("---", "")
    .replace(/Day \d+/, `<a href="${url}">Day ${day}</a>`)
    .trim();
}

for (const link of article.querySelectorAll("a")) {
  const href = link.getAttribute("href");
  if (href?.startsWith("/")) {
    link.setAttribute("href", new URL(href, url).href);
  }
}

const readme = new URL(
  `../${year}/${day.toString().padStart(2, "0")}/README.md`,
  import.meta.url,
);
await Deno.mkdir(new URL(".", readme), { recursive: true });

const p = Deno.run({
  cmd: [Deno.execPath(), "fmt", "--ext=md", "-"],
  stdin: "piped",
  stdout: "piped",
});

{
  const te = new TextEncoder();
  const md = new NodeHtmlMarkdown({ codeBlockStyle: "indented" });
  const markdown = md.translate(article.innerHTML)
    // fix emphasized code like <code><em>...</em></code>
    .replace(/`_([^`_]+)_`/g, "_`$1`_");

  await p.stdin.write(te.encode(markdown));
  p.stdin.close();
}

await Deno.writeFile(readme, await p.output());
p.close();

console.info(`Wrote ${readme}`);

await writeMissing(
  new URL("lib.ts", readme),
  `export function* parse(input: string): IterableIterator<string> {
  for (const [token] of input.matchAll(/\\S+/g)) {
    yield token;
  }
}
`,
);

await writeMissing(
  new URL("test.ts", readme),
  `import { assertEquals } from "testing/asserts.ts";
import { parse } from "./lib.ts";

const input = Deno.readTextFileSync(new URL("input.txt", import.meta.url));

Deno.test("parse", () => {
  assertEquals([...parse("")], []);
});
`,
);

await writeMissing(new URL("input.txt", readme), "");

if (confirm("Show input?")) {
  await Deno.run({ cmd: ["open", `${url}/input`] }).status();
}

async function writeMissing(path: URL, data: string): Promise<void> {
  try {
    await Deno.stat(path);
    console.info(`Exists ${path}`);
    return;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      // continue
    } else {
      throw e;
    }
  }
  await Deno.writeTextFile(path, data);
  console.info(`Wrote ${path}`);
}
