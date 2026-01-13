import { type Options, globby } from 'globby';
import { template } from 'lodash-es';
import { join } from 'path';

/**
 * A file matched by {@link listFilesAndFormat}.
 */
export type FormattedMatchedFile = {
  /**
   * The string rendered using the template and the {@link FormattedMatchedFile.formatParts}.
   */
  rendered: string;

  /**
   * The groups captured in the (relative) file path using the regular expression.
   */
  formatParts: Record<string, string>;

  /**
   * The path for the matched file, including the root path.
   */
  filePath: string;
};

/**
 * Lists files using the given globs, extracts information from the paths, and renders a string using the provided
 * template.
 * It does not follow symbolic links by default.
 *
 * @param globs The glob pattern used to find the files.
 * @param regExp The regular expression matched against the found file paths.
 * @param format The template string used to generate the rendered string from the groups captured in the regular
 *   expression.
 * @param rootPath The path from which files should be found using glob patterns.
 * @param options Options when listing and matching files, including `globby` {@link Options}.
 * @returns The list of matched files, along with the corresponding rendered string.
 */
export async function listFilesAndFormat(
  globs: string[],
  regExp: string | RegExp,
  format: string,
  rootPath: string,
  options: {
    /**
     * A function called when a path found using glob patterns does not match the regular expression.
     */
    nonMatchingPathHandler?: (path: string) => void;
  } & Options = {},
): Promise<FormattedMatchedFile[]> {
  const { nonMatchingPathHandler, ...globbyOptions } = options;

  const render = template(format);

  const paths = await globby(globs, {
    gitignore: true,
    followSymbolicLinks: false,
    ...globbyOptions,
    cwd: rootPath,
  });

  return paths.sort().flatMap((path) => {
    const match = path.match(regExp);
    if (!match) {
      if (nonMatchingPathHandler) nonMatchingPathHandler(path);
      return [];
    }

    const formatParts = match.groups ?? {};
    const filePath = join(rootPath, path);
    const rendered = render(formatParts);

    return { rendered, formatParts, filePath };
  });
}
