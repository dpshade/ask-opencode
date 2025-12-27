import { useState, useEffect } from "react";
import { readdirSync, statSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";

interface UsePathAutocompleteResult {
  suggestions: string[];
  isActive: boolean;
  pathPrefix: string;
}

export function usePathAutocomplete(query: string): UsePathAutocompleteResult {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const match = query.match(/@([\w/~.-]*)$/);
  const pathPrefix = match ? match[1] : "";
  const isActive =
    match !== null &&
    (pathPrefix.startsWith("/") ||
      pathPrefix.startsWith("~/") ||
      pathPrefix.startsWith("./") ||
      pathPrefix === "~" ||
      pathPrefix === ".");

  useEffect(() => {
    if (!isActive || !pathPrefix) {
      setSuggestions([]);
      return;
    }

    try {
      const expandedPath = pathPrefix.replace(/^~/, homedir());
      const isAbsolute = expandedPath.startsWith("/");

      if (!isAbsolute && !pathPrefix.startsWith("~")) {
        setSuggestions([]);
        return;
      }

      const dir = path.dirname(expandedPath) || "/";
      const prefix = path.basename(expandedPath);

      if (!existsSync(dir)) {
        setSuggestions([]);
        return;
      }

      const entries = readdirSync(dir)
        .filter((name) => {
          if (name.startsWith(".")) return false;
          if (!name.toLowerCase().startsWith(prefix.toLowerCase()))
            return false;

          try {
            const fullPath = path.join(dir, name);
            return statSync(fullPath).isDirectory();
          } catch {
            return false;
          }
        })
        .slice(0, 8)
        .map((name) => {
          const fullPath = path.join(dir, name);
          return fullPath.replace(homedir(), "~");
        });

      setSuggestions(entries);
    } catch {
      setSuggestions([]);
    }
  }, [isActive, pathPrefix]);

  return {
    suggestions,
    isActive,
    pathPrefix,
  };
}

export function extractPathFromQuery(query: string): {
  cleanQuery: string;
  directory: string | null;
} {
  const match = query.match(/@([\w/~.-]+)/);
  if (!match) {
    return { cleanQuery: query, directory: null };
  }

  const pathPart = match[1].replace(/^~/, homedir());
  const cleanQuery = query.replace(/@[\w/~.-]+\s*/, "").trim();

  if (existsSync(pathPart) && statSync(pathPart).isDirectory()) {
    return { cleanQuery, directory: pathPart };
  }

  return { cleanQuery: query, directory: null };
}
