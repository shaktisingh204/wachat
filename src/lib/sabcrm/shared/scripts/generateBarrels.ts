// PORT-NOTE: This script is a Twenty/Nx-specific barrel-generation tool used at
// build time in the Twenty monorepo. It reads the twenty-shared source tree,
// extracts TypeScript exports using the TypeScript compiler API, and generates
// index.ts barrel files, updates package.json exports, and updates nx project.json.
// In SabNode this file is reference-only; barrel exports are managed manually or
// via the Next.js module resolution. No migration of this script to SabNode is
// needed — it has no Mongo/Next analogue.

import prettier from '@prettier/sync';
import * as fs from 'fs';
import { globSync } from 'glob';
import path from 'path';
import { type Options } from 'prettier';
import slash from 'slash';
import ts from 'typescript';

const INDEX_FILENAME = 'index';
const PACKAGE_JSON_FILENAME = 'package.json';
const NX_PROJECT_CONFIGURATION_FILENAME = 'project.json';
const PACKAGE_PATH = path.resolve('packages/twenty-shared');
const SRC_PATH = path.resolve(`${PACKAGE_PATH}/src`);
const PACKAGE_JSON_PATH = path.join(PACKAGE_PATH, PACKAGE_JSON_FILENAME);
const NX_PROJECT_CONFIGURATION_PATH = path.join(
  PACKAGE_PATH,
  NX_PROJECT_CONFIGURATION_FILENAME,
);

const prettierConfigFile = prettier.resolveConfigFile();
if (prettierConfigFile == null) {
  throw new Error('Prettier config file not found');
}
const prettierConfiguration = prettier.resolveConfig(prettierConfigFile);
const prettierFormat = (str: string, parser: Options['parser']) =>
  prettier.format(str, {
    ...prettierConfiguration,
    parser,
  });

type CreateTypeScriptFileArgs = {
  path: string;
  content: string;
  filename: string;
};

const createTypeScriptFile = ({
  content,
  path: filePath,
  filename,
}: CreateTypeScriptFileArgs) => {
  const header = `
/*
 * _____                    _
 *|_   _|_      _____ _ __ | |_ _   _
 *  | | \\ \\ /\\ / / _ \\ '_ \\| __| | | | Auto-generated file
 *  | |  \\ V  V /  __/ | | | |_| |_| | Any edits to this will be overridden
 *  |_|   \\_/\\_/ \\___|_| |_|\\__|\\__, |
 *                              |___/
 */
`;
  const formattedContent = prettierFormat(
    `${header}\n${content}\n`,
    'typescript',
  );
  fs.writeFileSync(
    path.join(filePath, `${filename}.ts`),
    formattedContent,
    'utf-8',
  );
};

const getLastPathFolder = (pathStr: string) => path.basename(pathStr);

const getSubDirectoryPaths = (directoryPath: string): string[] => {
  const pattern = slash(path.join(directoryPath, '*/'));
  return globSync(pattern, {
    ignore: [...EXCLUDED_DIRECTORIES],
    cwd: SRC_PATH,
    nodir: false,
    maxDepth: 1,
  }).sort((a, b) => a.localeCompare(b));
};

const partitionFileExportsByType = (declarations: DeclarationOccurrence[]) => {
  return declarations.reduce<{
    typeAndInterfaceDeclarations: DeclarationOccurrence[];
    otherDeclarations: DeclarationOccurrence[];
  }>(
    (acc, { kind, name }) => {
      if (kind === 'type' || kind === 'interface') {
        return {
          ...acc,
          typeAndInterfaceDeclarations: [
            ...acc.typeAndInterfaceDeclarations,
            { kind, name },
          ],
        };
      }

      return {
        ...acc,
        otherDeclarations: [...acc.otherDeclarations, { kind, name }],
      };
    },
    {
      typeAndInterfaceDeclarations: [],
      otherDeclarations: [],
    },
  );
};

const generateModuleIndexFiles = (exportByBarrel: ExportByBarrel[]) => {
  return exportByBarrel.map<CreateTypeScriptFileArgs>(
    ({ barrel: { moduleDirectory }, allFileExports }) => {
      const content = allFileExports
        .sort((a, b) => a.file.localeCompare(b.file))
        .map(({ exports, file }) => {
          const { otherDeclarations, typeAndInterfaceDeclarations } =
            partitionFileExportsByType(exports);

          const fileWithoutExtension = path.parse(file).name;
          const pathToImport = slash(
            path.relative(
              moduleDirectory,
              path.join(path.dirname(file), fileWithoutExtension),
            ),
          );
          const mapDeclarationNameAndJoin = (
            declarations: DeclarationOccurrence[],
          ) => declarations.map(({ name }) => name).join(', ');

          const typeExport =
            typeAndInterfaceDeclarations.length > 0
              ? `export type { ${mapDeclarationNameAndJoin(typeAndInterfaceDeclarations)} } from "./${pathToImport}"`
              : '';
          const othersExport =
            otherDeclarations.length > 0
              ? `export { ${mapDeclarationNameAndJoin(otherDeclarations)} } from "./${pathToImport}"`
              : '';

          return [typeExport, othersExport]
            .filter((el) => el !== '')
            .join('\n');
        })
        .join('\n');

      return {
        content,
        path: moduleDirectory,
        filename: INDEX_FILENAME,
      };
    },
  );
};

type JsonUpdate = Record<string, unknown>;
type WriteInJsonFileArgs = {
  content: JsonUpdate;
  file: string;
};
const updateJsonFile = ({ content, file }: WriteInJsonFileArgs) => {
  const updatedJsonFile = JSON.stringify(content);
  const formattedContent = prettier.format(updatedJsonFile, {
    ...prettierConfiguration,
    filepath: file,
  });
  fs.writeFileSync(file, formattedContent, 'utf-8');
};

const writeInPackageJson = (update: JsonUpdate) => {
  const rawJsonFile = fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8');
  const initialJsonFile = JSON.parse(rawJsonFile) as JsonUpdate;

  updateJsonFile({
    file: PACKAGE_JSON_PATH,
    content: {
      ...initialJsonFile,
      ...update,
    },
  });
};

const updateNxProjectConfigurationBuildOutputs = (outputs: JsonUpdate) => {
  const rawJsonFile = fs.readFileSync(NX_PROJECT_CONFIGURATION_PATH, 'utf-8');
  const initialJsonFile = JSON.parse(rawJsonFile) as {
    targets: { build: { outputs: JsonUpdate } };
    [key: string]: unknown;
  };

  updateJsonFile({
    file: NX_PROJECT_CONFIGURATION_PATH,
    content: {
      ...initialJsonFile,
      targets: {
        ...initialJsonFile.targets,
        build: {
          ...initialJsonFile.targets.build,
          outputs,
        },
      },
    },
  });
};

type ExportOccurrence = {
  types: string;
  import: string;
  require: string;
};
type ExportsConfig = Record<string, ExportOccurrence | string>;

const generateModulePackageExports = (moduleDirectories: string[]) => {
  return moduleDirectories.reduce<ExportsConfig>((acc, moduleDirectory) => {
    const moduleName = getLastPathFolder(moduleDirectory);
    if (moduleName === undefined) {
      throw new Error(
        `Should never occur, moduleName is undefined ${moduleDirectory}`,
      );
    }

    return {
      ...acc,
      [`./${moduleName}`]: {
        types: `./dist/${moduleName}/index.d.ts`,
        import: `./dist/${moduleName}.mjs`,
        require: `./dist/${moduleName}.cjs`,
      },
    };
  }, {});
};

const computePackageJsonFilesAndExportsConfig = (
  moduleDirectories: string[],
) => {
  const entrypoints = moduleDirectories.map(getLastPathFolder);
  const exports = {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.mjs',
      require: './dist/index.cjs',
    },
    ...generateModulePackageExports(moduleDirectories),
  } satisfies ExportsConfig;

  const typesVersionsEntries = entrypoints.reduce<Record<string, string[]>>(
    (acc, moduleName) => ({
      ...acc,
      [`${moduleName}`]: [`dist/${moduleName}/index.d.ts`],
    }),
    {},
  );

  return {
    exports,
    typesVersions: { '*': typesVersionsEntries },
    files: ['dist', ...entrypoints],
  };
};

const computeProjectNxBuildOutputsPath = (moduleDirectories: string[]) => {
  const dynamicOutputsPath = moduleDirectories
    .map(getLastPathFolder)
    .flatMap((barrelName) =>
      ['package.json', 'dist'].map(
        (subPath) => `{projectRoot}/${barrelName}/${subPath}`,
      ),
    );

  return ['{projectRoot}/dist', ...dynamicOutputsPath];
};

const EXCLUDED_EXTENSIONS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.stories.ts',
  '**/*.stories.tsx',
] as const;
const EXCLUDED_DIRECTORIES = [
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/__stories__/**',
  '**/internal/**',
] as const;
const EXCLUDED_FILES = ['**/get-function-input-schema.ts'] as const;

const getTypeScriptFiles = (
  directoryPath: string,
  includeIndex: boolean = false,
): string[] => {
  const pattern = slash(path.join(directoryPath, '**', '*.{ts,tsx}'));
  const files = globSync(pattern, {
    cwd: SRC_PATH,
    nodir: true,
    ignore: [
      ...EXCLUDED_EXTENSIONS,
      ...EXCLUDED_DIRECTORIES,
      ...EXCLUDED_FILES,
    ],
  });

  return files.filter(
    (file) =>
      !file.endsWith('.d.ts') &&
      (includeIndex ? true : !file.endsWith('index.ts')),
  );
};

const getKind = (
  node: ts.VariableStatement,
): Extract<ExportKind, 'const' | 'let' | 'var'> => {
  const isConst = (node.declarationList.flags & ts.NodeFlags.Const) !== 0;
  if (isConst) {
    return 'const';
  }

  const isLet = (node.declarationList.flags & ts.NodeFlags.Let) !== 0;
  if (isLet) {
    return 'let';
  }

  return 'var';
};

const extractExportsFromSourceFile = (sourceFile: ts.SourceFile) => {
  const exports: DeclarationOccurrence[] = [];

  const visit = (node: ts.Node): void => {
    if (!ts.canHaveModifiers(node)) {
      return ts.forEachChild(node, visit);
    }
    const modifiers = ts.getModifiers(node);
    const isExport = modifiers?.some(
      (mod) => mod.kind === ts.SyntaxKind.ExportKeyword,
    );

    if (!isExport && !ts.isExportDeclaration(node)) {
      return ts.forEachChild(node, visit);
    }

    switch (true) {
      case ts.isTypeAliasDeclaration(node):
        exports.push({ kind: 'type', name: node.name.text });
        break;

      case ts.isInterfaceDeclaration(node):
        exports.push({ kind: 'interface', name: node.name.text });
        break;

      case ts.isEnumDeclaration(node):
        exports.push({ kind: 'enum', name: node.name.text });
        break;

      case ts.isFunctionDeclaration(node) && node.name !== undefined:
        exports.push({ kind: 'function', name: node.name.text });
        break;

      case ts.isVariableStatement(node):
        node.declarationList.declarations.forEach((decl) => {
          const kind = getKind(node);

          if (ts.isIdentifier(decl.name)) {
            exports.push({ kind, name: decl.name.text });
          } else if (ts.isObjectBindingPattern(decl.name)) {
            decl.name.elements.forEach((element) => {
              if (
                !ts.isBindingElement(element) ||
                !ts.isIdentifier(element.name)
              ) {
                return;
              }
              exports.push({ kind, name: element.name.text });
            });
          }
        });
        break;

      case ts.isClassDeclaration(node) && node.name !== undefined:
        exports.push({ kind: 'class', name: node.name.text });
        break;

      case ts.isExportDeclaration(node):
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          node.exportClause.elements.forEach((element) => {
            const exportName = element.name.text;
            const isTypeExport =
              node.isTypeOnly || ts.isTypeOnlyExportDeclaration(node);
            if (isTypeExport) {
              exports.push({ kind: 'type', name: exportName });
              return;
            }
            exports.push({ kind: 'const', name: exportName });
          });
        }
        break;
    }
    return ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return exports;
};

type ExportKind =
  | 'type'
  | 'interface'
  | 'enum'
  | 'function'
  | 'const'
  | 'let'
  | 'var'
  | 'class';
type DeclarationOccurrence = { kind: ExportKind; name: string };
type FileExports = Array<{
  file: string;
  exports: DeclarationOccurrence[];
}>;

const findAllExports = (directoryPath: string): FileExports => {
  const results: FileExports = [];

  const files = getTypeScriptFiles(directoryPath);

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );

    const exports = extractExportsFromSourceFile(sourceFile);
    if (exports.length > 0) {
      results.push({ file, exports });
    }
  }

  return results;
};

type ExportByBarrel = {
  barrel: {
    moduleName: string;
    moduleDirectory: string;
  };
  allFileExports: FileExports;
};

const retrieveExportsByBarrel = (barrelDirectories: string[]) => {
  return barrelDirectories.map<ExportByBarrel>((moduleDirectory) => {
    const moduleExportsPerFile = findAllExports(moduleDirectory);
    const moduleName = getLastPathFolder(moduleDirectory);
    if (!moduleName) {
      throw new Error(
        `Should never occur moduleName not found ${moduleDirectory}`,
      );
    }

    return {
      barrel: { moduleName, moduleDirectory },
      allFileExports: moduleExportsPerFile,
    };
  });
};

const main = () => {
  const moduleDirectories = getSubDirectoryPaths(SRC_PATH);
  const exportsByBarrel = retrieveExportsByBarrel(moduleDirectories);
  const moduleIndexFiles = generateModuleIndexFiles(exportsByBarrel);
  const packageJsonConfig =
    computePackageJsonFilesAndExportsConfig(moduleDirectories);
  const nxBuildOutputsPath =
    computeProjectNxBuildOutputsPath(moduleDirectories);

  updateNxProjectConfigurationBuildOutputs(
    nxBuildOutputsPath as unknown as JsonUpdate,
  );
  writeInPackageJson(packageJsonConfig as unknown as JsonUpdate);
  moduleIndexFiles.forEach(createTypeScriptFile);
};

main();
