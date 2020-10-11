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

const operatorMap: any = {
  [ts.SyntaxKind.AmpersandAmpersandToken]: "&&",
  [ts.SyntaxKind.BarBarToken]: "||",
  [ts.SyntaxKind.EqualsEqualsToken]: "==",
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: "===",
  [ts.SyntaxKind.GreaterThanEqualsToken]: ">=",
  [ts.SyntaxKind.LessThanEqualsToken]: "<=",
  [ts.SyntaxKind.LessThanToken]: "<",
  [ts.SyntaxKind.GreaterThanToken]: ">",
  [ts.SyntaxKind.LessThanToken]: "<",
  [ts.SyntaxKind.DotToken]: ".",
  [ts.SyntaxKind.EqualsGreaterThanToken]: "=>",
  [ts.SyntaxKind.PercentToken]: "%",
  [ts.SyntaxKind.AsteriskToken]: "*",
  [ts.SyntaxKind.PlusToken]: "+",
  [ts.SyntaxKind.PlusPlusToken]: "++",
  [ts.SyntaxKind.MinusToken]: "-",
  [ts.SyntaxKind.MinusMinusToken]: "--",
  [ts.SyntaxKind.PlusEqualsToken]: "+=",
  [ts.SyntaxKind.MinusEqualsToken]: "-=",
  "": "",
};

const operatorValues: any = {};
Object.values(operatorMap).forEach((value: any) => {
  operatorValues[value] = true;
});

const statementMap: any = {
  [ts.SyntaxKind.IfStatement]: "if",
  [ts.SyntaxKind.ForStatement]: "for",
  [ts.SyntaxKind.SwitchStatement]: "switch",
  [ts.SyntaxKind.WhileStatement]: "while",
  [ts.SyntaxKind.CaseClause]: "case",
  [ts.SyntaxKind.CaseBlock]: "case",
};

function getOperatorString(kind: ts.SyntaxKind, kindMap: any = operatorMap) {
  return kindMap[kind] || "";
}

function getStatementString(
  node: any,
  kind: ts.SyntaxKind,
  kindMap: any = statementMap
): any {
  if (kind === ts.SyntaxKind.ExpressionStatement) {
    return getStatementString(node.expression, node.expression.kind);
  }
  return kindMap[kind] || "";
}

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

    case ts.SyntaxKind.IfStatement:
    case ts.SyntaxKind.SwitchStatement:
    case ts.SyntaxKind.WhileStatement:
    case ts.SyntaxKind.ForStatement: {
      let description = recursivelyGetStatementString(statement.expression);
      if (operatorValues[description.trim()]) {
        description = `¯\\_(ツ)_/¯`;
      }
      const statementString = getStatementString(statement, statement.kind);
      label = `${statementString} (${description})`;
      break;
    }

    case ts.SyntaxKind.CaseBlock:
    case ts.SyntaxKind.ExpressionStatement:
    case ts.SyntaxKind.CaseClause: {
      let description = recursivelyGetStatementString(statement.expression);
      if (operatorValues[description.trim()]) {
        description = `¯\\_(ツ)_/¯`;
      }
      const statementString = getStatementString(statement, statement.kind);
      label = `${statementString} ${description}`;
      break;
    }

    case ts.SyntaxKind.VariableStatement:
      label =
        "variable " +
        statement.declarationList.declarations
          .map(
            (declaration: any) =>
              `${
                declaration?.name?.escapedText
              } = ${recursivelyGetStatementString(declaration)}`
          )
          .join(", ");
      break;
  }

  let type = "";
  if (statement.type) {
    if (statement.type?.name?.escapedText) {
      type = `<${statement.type?.name?.escapedText}> `;
    } else {
      const typeName = getTypeName(statement.type.kind);
      if (typeName) {
        type = `<${typeName}> `;
      }
    }
  }

  // handle edge cases
  if (statement.kind === ts.SyntaxKind.Constructor) {
    name = "constructor";
  }

  if (statement.kind === ts.SyntaxKind.CaseBlock) {
    name = "case";
  }

  return `${prefix || ""}${label || ""}${type || ""}${name || ""}`;
}

function recursivelyGetStatementString(
  statement: any,
  currentString = ""
): string {
  if (!statement) {
    return currentString;
  }

  let newString = currentString;

  if (statement?.escapedText) {
    return statement?.escapedText;
  }

  if (statement.text && statement.kind === ts.SyntaxKind.StringLiteral) {
    return `"${statement.text}"`;
  } else if (statement.text) {
    return statement.text;
  }

  if (statement.expression) {
    if (statement.kind === ts.SyntaxKind.ParenthesizedExpression) {
      return `(${recursivelyGetStatementString(
        statement.expression,
        newString
      )})`;
    } else if (statement.kind === ts.SyntaxKind.CallExpression) {
      return `${recursivelyGetStatementString(
        statement.expression,
        newString
      )}(${statement.arguments
        .map((argument: any) => recursivelyGetStatementString(argument))
        .join(", ")})`;
    } else if (statement.kind === ts.SyntaxKind.PropertyAccessExpression) {
      return `${recursivelyGetStatementString(statement.expression) || '""'}.${
        recursivelyGetStatementString(statement.name) || '""'
      }`;
    } else {
      return recursivelyGetStatementString(statement.expression, newString);
    }
  }

  if (statement.left || statement.operatorToken || statement.right) {
    newString += `${recursivelyGetStatementString(
      statement.left,
      newString
    )} ${getOperatorString(
      statement.operatorToken.kind
    )} ${recursivelyGetStatementString(statement.right, newString)}`;
  }

  if (statement.initializer) {
    return recursivelyGetStatementString(statement.initializer, newString);
  }

  return newString;
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
      // We bail on a script tag to prevent Vue and Svelte file usage
      if (text.indexOf("<script") > -1) {
        return [];
      }

      const decorations: any[] = [];

      const sourceFile = ts.createSourceFile(
        "currentFile",
        text,
        ts.ScriptTarget.Latest
      );

      let nodes: any = sourceFile.statements;

      let children: any[] = [];
      while (nodes.length !== 0) {
        nodes.forEach((node: any) => {
          // add node lists to children
          [
            "members",
            "arguments",
            "statements",
            "clauses",
            "declarations",
            "properties",
            "expressions",
          ].forEach((propName: string) => {
            if (node[propName]?.length) {
              children = [...children, ...node[propName]];
            }
          });

          // add nodes with nodelists as children
          [
            "statement",
            "body",
            "thenStatement",
            "caseBlock",
            "declarationList",
            "initializer",
            "expression",
          ].forEach((propName: string) => {
            if (node[propName]) {
              children.push(node[propName]);
            }
          });

          if (activeEditor) {
            const { line: startLine } = ts.getLineAndCharacterOfPosition(
              sourceFile,
              node.pos
            );
            const { line } = ts.getLineAndCharacterOfPosition(
              sourceFile,
              node.end
            );
            const endOfLine = activeEditor.document.lineAt(line).range.end;

            let contentText = stringifyStatementName(node, prefix);

            console.log("CONTENT TEXT: ", contentText, node);

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

        nodes = [...children];
        children = [];
      }
      return decorations;
    },
  }
);
