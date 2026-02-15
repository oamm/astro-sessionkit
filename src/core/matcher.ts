// ============================================================================
// Route Pattern Matching
// ============================================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const regexCache = new Map<string, RegExp>();

function globToRegex(pattern: string): RegExp {
  const cached = regexCache.get(pattern);
  if (cached) return cached;

  let regex = "";
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];
    const next = pattern[i + 1];

    // Handle **
    if (char === "*" && next === "*") {
      const isAtEnd = i + 2 === pattern.length;
      const prevIsSlash = i > 0 && pattern[i - 1] === "/";

      if (prevIsSlash) {
        // Handle "/**"
        if (isAtEnd) {
          // "/**" at end matches everything from that point
          if (regex.endsWith("/")) regex = regex.slice(0, -1);
          regex += "(?:/.*)?";
        } else if (pattern[i + 2] === "/") {
          // "/**/" matches zero or more segments
          if (regex.endsWith("/")) regex = regex.slice(0, -1);
          regex += "(?:/.*)?";
          i += 1; // skip one extra for the trailing slash
        } else {
          regex += ".*";
        }
      } else {
        regex += ".*";
      }

      i += 2;
      continue;
    }

    // Handle *
    if (char === "*") {
      // one or more segments (to maintain backward compatibility with previous tests)
      regex += "[^/]+(?:/[^/]+)*";
      i += 1;
      continue;
    }

    regex += escapeRegex(char as string);
    i += 1;
  }

  const result = new RegExp(`^${regex}$`);
  regexCache.set(pattern, result);
  return result;
}

export function matchesPattern(pattern: string, path: string): boolean {
  return globToRegex(pattern).test(path);
}
