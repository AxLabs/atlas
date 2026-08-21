import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";

import ts from "typescript";

export interface StaticModuleSpecifier {
  specifier: string;
  line: number;
  column: number;
}

function resolveScriptKind(sourceFilePath: string): ts.ScriptKind {
  if (sourceFilePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }

  if (sourceFilePath.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }

  return ts.ScriptKind.TS;
}

export function extractStaticModuleSpecifiers(
  sourceFilePath: string,
  sourceText?: string
): StaticModuleSpecifier[] {
  const text = sourceText ?? readFileSync(sourceFilePath, "utf8");
  const scriptKind = resolveScriptKind(sourceFilePath);

  const sourceFile = ts.createSourceFile(
    sourceFilePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );

  const results: StaticModuleSpecifier[] = [];

  function addSpecifier(literal: ts.StringLiteralLike): void {
    const position = sourceFile.getLineAndCharacterOfPosition(literal.getStart(sourceFile, false));
    results.push({
      specifier: literal.text,
      line: position.line + 1,
      column: position.character + 1,
    });
  }

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      addSpecifier(node.moduleSpecifier);
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      addSpecifier(node.moduleSpecifier);
    }

    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const [argument] = node.arguments;
        if (argument && ts.isStringLiteral(argument)) {
          addSpecifier(argument);
        }
      }

      if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
        const [argument] = node.arguments;
        if (argument && ts.isStringLiteral(argument)) {
          addSpecifier(argument);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return results;
}

export function packageRootFromSpecifier(specifier: string): string | undefined {
  if (
    specifier.startsWith(".") ||
    specifier.startsWith("@/") ||
    specifier.startsWith("~/") ||
    specifier.startsWith("#")
  ) {
    return undefined;
  }

  const normalized = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
  if (builtinModules.includes(normalized) || builtinModules.includes(`node:${normalized}`)) {
    return undefined;
  }

  if (specifier.startsWith("@")) {
    const segments = specifier.split("/");
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : segments[0];
  }

  return specifier.split("/")[0];
}
