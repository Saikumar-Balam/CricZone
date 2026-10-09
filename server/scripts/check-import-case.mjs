
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const sourceRoot = path.join(serverRoot, "src");
const errors = [];
let checked = 0;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && /\.(js|mjs)$/.test(entry.name)) {
      checkFile(fullPath);
    }
  }
}

function checkImport(importer, specifier) {
  const target = path.resolve(
    path.dirname(importer),
    specifier
  );

  // Validate only the path below server/src.
  // Avoid checking the casing of Windows drive and parent folders.
  const relative = path.relative(sourceRoot, target);

  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    errors.push(`${importer}: import outside src: ${specifier}`);
    return;
  }

  let current = sourceRoot;

  for (const segment of relative.split(path.sep)) {
    if (!segment) continue;

    const entries = fs.readdirSync(current, {
      withFileTypes: true,
    });

    const exact = entries.find(
      (entry) => entry.name === segment
    );

    if (!exact) {
      const similar = entries.find(
        (entry) =>
          entry.name.toLowerCase() === segment.toLowerCase()
      );

      errors.push(
        `${path.relative(serverRoot, importer)}\n` +
        `  Import: ${specifier}\n` +
        `  ${similar
          ? `Case mismatch: expected "${similar.name}", found "${segment}"`
          : `Missing path segment: "${segment}"`}`
      );

      return;
    }

    current = path.join(current, exact.name);
  }

  if (!fs.statSync(current).isFile()) {
    errors.push(
      `${path.relative(serverRoot, importer)}: not a file: ${specifier}`
    );
    return;
  }

  checked++;
}

function checkFile(file) {
  const source = fs.readFileSync(file, "utf8");

  const pattern =
    /(?:import\s+(?:[\s\S]*?\s+from\s*)?|export\s+[\s\S]*?\s+from\s*|import\s*\()\s*["'](\.{1,2}\/[^"']+)["']/g;

  for (const match of source.matchAll(pattern)) {
    checkImport(file, match[1]);
  }
}

walk(sourceRoot);

if (errors.length) {
  console.error(`Found ${errors.length} import path errors:\n`);

  for (const error of errors) {
    console.error(error);
    console.error();
  }

  process.exitCode = 1;
} else {
  console.log(
    `Import check passed: ${checked} relative imports verified.`
  );
}
