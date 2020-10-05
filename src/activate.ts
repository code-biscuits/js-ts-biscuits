import * as vscode from "vscode";
import {
  getLanguageService,
  Node,
  TextDocument as HtmlTextDocument,
} from "vscode-html-languageservice";
import { createActivate } from "biscuits-base";

import * as ts from "typescript";

// Needs to be genericized
const CONFIG_PREFIX_KEY = "js-ts-biscuits.annotationPrefix";
const CONFIG_COLOR_KEY = "js-ts-biscuits.annotationColor";
const CONFIG_DISTANCE_KEY = "js-ts-biscuits.annotationMinDistance";

function stringifyStatementName(statement: any, prefix: string) {
  let label = "";
  let name = statement?.name?.escapedText || "";

  switch (statement.kind) {
    case ts.SyntaxKind.ClassDeclaration:
      label = "class: ";
      break;

    case ts.SyntaxKind.MethodDeclaration:
      label = "method: ";
      break;

    case ts.SyntaxKind.PropertyDeclaration:
      label = "property: ";
      break;

    case ts.SyntaxKind.FunctionDeclaration:
      label = "function: ";
      break;

    case ts.SyntaxKind.SwitchStatement:
      label = "switch";
      break;

    case ts.SyntaxKind.IfStatement:
      label = "if";
      break;

    case ts.SyntaxKind.VariableStatement:
      label =
        "variable " +
        statement.declarationList.declarations
          .map((declaration: any) => declaration.name.escapedText)
          .join(", ");
      break;

    case ts.SyntaxKind.ExpressionStatement:
      if (statement.expression?.expression.escapedText) {
        label = statement.expression?.expression.escapedText;
      }
      break;
  }

  let type = "";
  if (statement.type) {
    if (statement.type?.name?.escapedText) {
      type = `<${statement.type.name.escapedText}> `;
    } else {
      const typeName = getTypeName(statement.type.kind);
      if (typeName) {
        type = `<${typeName}> `;
      }
    }
  }

  // if (statement?.expression?.name) {
  //   console.log("expression:", statement.expression);
  //   name = statement.expression.name.escapedText;
  // }

  return `${prefix}${label}${type}${name}`;
}

function getTypeName(propertyType: ts.SyntaxKind) {
  let label = "";

  switch (propertyType) {
    case ts.SyntaxKind.BooleanKeyword:
      label = "boolean";
      break;
  }

  return label;
}

export const activate = createActivate(
  CONFIG_COLOR_KEY,
  CONFIG_DISTANCE_KEY,
  CONFIG_PREFIX_KEY,
  {
    createDecorations(
      text: string,
      activeEditor: vscode.TextEditor,
      prefix: string,
      minDistance: number
    ) {
      const decorations: any[] = [];

      const sourceFile = ts.createSourceFile(
        "currentFile",
        text,
        ts.ScriptTarget.Latest
      );

      console.log("statements", sourceFile.statements);
      let nodes: any = sourceFile.statements;

      let children: any[] = [];
      while (nodes.length !== 0) {
        nodes.forEach((node: any) => {
          if (node?.members?.length) {
            children = [...children, ...node.members];
          }

          if (node?.body?.statements?.length) {
            console.log("body statements: ", node?.body?.statements);
            children = [...children, ...node.body.statements];
          }

          if (activeEditor) {
            console.log("node", node);
            const { line: startLine } = ts.getLineAndCharacterOfPosition(
              sourceFile,
              node.pos
            );
            const { line } = ts.getLineAndCharacterOfPosition(
              sourceFile,
              node.end
            );
            const endOfLine = activeEditor.document.lineAt(line).range.end;

            const contentText = stringifyStatementName(node, prefix);

            console.log("contentText", contentText);

            if (contentText !== prefix && line - startLine >= minDistance) {
              decorations.push({
                range: new vscode.Range(
                  activeEditor.document.positionAt(node.end),
                  endOfLine
                ),
                renderOptions: {
                  after: {
                    contentText,
                  },
                },
              });
            }
          }
        });

        console.log("children: ", children);
        nodes = [...children];
        children = [];
      }
      return decorations;
    },
  }
);
