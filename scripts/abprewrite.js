// This script rewrites AST to be compatible with JavaScript 1.5 and decompiles
// the modified tree then

include("decompile.js");

function Node(props)
{
  for (var k in props)
  {
    this[k] = props[k];
  }
}
Node.prototype =
{
  visit: function(visitor)
  {
    return walkAST(this, visitor);
  }
};

function IdentifierExpression(varname)
{
  Node.call(this, {
    name: varname
  });
}
IdentifierExpression.prototype =
{
  __proto__: Node.prototype,
  type: "IdentifierExpression",
  precedence: 0
};

function LiteralExpression(constant)
{
  Node.call(this, {
    objtype: typeof constant,
    value: constant
  });
}
LiteralExpression.prototype =
{
  __proto__: Node.prototype,
  type: "LiteralExpression",
  precedence: 0
};

function MemberExpression(object, member, isConst)
{
  if (typeof object == "string")
    object = new IdentifierExpression(object);

  if (isConst)
  {
    Node.call(this, {
      container: object,
      constmember: member
    });
  }
  else
  {
    if (typeof member != "object")
      member = new LiteralExpression(member);
    Node.call(this, {
      container: object,
      member: member
    });
  }
}
MemberExpression.prototype =
{
  __proto__: Node.prototype,
  type: "MemberExpression",
  precedence: 1
};

function VarDeclaration(varname, initializer)
{
  obj = {
    name: varname
  }
  if (typeof initializer != "undefined" && initializer != null)
  {
    if (typeof initializer == "object")
      obj.initializer = initializer;
    else
      obj.initializer = new LiteralExpression(initializer);
  }
  Node.call(this, obj);
}
VarDeclaration.prototype =
{
  __proto__: Node.prototype,
  type: "VarDeclaration"
};

function VarStatement(varname, initializer)
{
  Node.call(this, {
    variables: [new VarDeclaration(varname, initializer)]
  });
}
VarStatement.prototype =
{
  __proto__: Node.prototype,
  type: "VarStatement",
  vartype: "var"
};

let modifier =
{
  _tempVarCount: 0,
  _extendFunctionName: null,
  _extendVarName: null,
  _potentialConstructors: {},

  _shouldRemoveStatement: function(stmt)
  {
    if (stmt.type == "ExpressionStatement" && stmt.expr && stmt.expr.type == "CallExpression" && stmt.expr.func)
    {
      funcName = decompile(stmt.expr.func);

      // Remove import calls:
      // Cu.import(...);
      if (funcName == "Cu.import" || funcName == "Components.utils.import")
        return true;

      // Remove timeline calls:
      // TimeLine.foobar(...);
      if (/^TimeLine\./.test(funcName))
        return true;
    }

    if (stmt.type == "VarStatement" && stmt.variables && stmt.variables.length == 1)
    {
      // Remove export declaration:
      // var EXPORTED_SYMBOLS = [];
      if (stmt.variables[0].name == "EXPORTED_SYMBOLS")
        return true;

      // Remove base URL assignment:
      // var baseURL = ...;
      if (stmt.variables[0].name == "baseURL")
        return true;

      // Remove declarations of XPCOM shortcuts:
      // const Cc = Components.classes;
      // const Ci = Components.interfaces;
      // const Cr = Components.results;
      // const Cu = Components.utils;
      if (/^C[ciru]/.test(stmt.variables[0].name))
        return true;
    }

    return false;
  },

  _shouldReplaceStatement: function(stmt)
  {
    if (stmt.type == "ExpressionStatement" && stmt.expr && stmt.expr.type == "AssignmentExpression" && stmt.expr.lhs && stmt.expr.lhs.type == "ArrayLiteral")
    {
      // Convert destructuring assignment:
      // [foo, bar] = [1, 2];
      //
      // Change into:
      // var _tempVar44 = [1, 2];
      // foo = _tempVar44[0];
      // bar = _tempVar44[1];
      let tempVar = "_tempVar" + this._tempVarCount++;
      let result = [new VarStatement(tempVar, stmt.expr.rhs)];
      for (let i = 0; i < stmt.expr.lhs.members.length; i++)
      {
        result.push(new Node({
          type: "ExpressionStatement",
          expr: new Node({
            type: "AssignmentExpression",
            precedence: 16,
            operator: "",
            lhs: stmt.expr.lhs.members[i],
            rhs: new MemberExpression(tempVar, i)
          })
        }));
      }
      return result;
    }

    if (stmt.type == "ForInStatement" && stmt.itertype == "for each")
    {
      // Convert "for each" loops:
      // for each (var foo in fooList)
      // {
      //   ...
      // }
      //
      // Change into:
      // for (var _loopIndex44 = 0; _loopIndex44 < fooList.length; _loopIndex44++)
      // {
      //   var foo = fooList[_loopIndex44];
      //   ...
      // }
      if (!stmt.itervar || stmt.itervar.type != "VarStatement" || !stmt.itervar.variables ||
          stmt.itervar.variables.length != 1 || stmt.itervar.variables[0].type != "VarDeclaration" ||
          !stmt.itervar.variables[0].name)
      {
        throw "Unexpected loop variable in for each loop";
      }
      let loopVar = stmt.itervar.variables[0].name;
      let loopIndex = "_loopIndex" + this._tempVarCount++;

      if (!stmt.body || !stmt.body.type == "BlockStatement")
        throw "Unexpected: loop body isn't a block statement";
      if (!stmt.body.statements)
        stmt.body.statements = [];
      stmt.body.statements.unshift(new VarStatement(loopVar, new MemberExpression(stmt.iterrange, new IdentifierExpression(loopIndex))));

      return [new Node({
        type: "ForStatement",
        init: new VarStatement(loopIndex, 0),
        cond: new Node({
          type: "BinaryExpression",
          precedence: 8,
          operator: "<",
          lhs: new IdentifierExpression(loopIndex),
          rhs: new MemberExpression(stmt.iterrange, "length", true)
        }),
        inc: new Node({
          type: "UnaryExpression",
          precedence: 3,
          operator: "++",
          operand: new IdentifierExpression(loopIndex)
        }),
        body: stmt.body
      })];
    }

    return null;
  },

  _checkStatements: function(statements)
  {
    for (let i = 0; i < statements.length; i++)
    {
      if (this._shouldRemoveStatement(statements[i]))
      {
        statements.splice(i--, 1);
      }
      else
      {
        replacement = this._shouldReplaceStatement(statements[i]);
        if (replacement)
        {
          replacement.unshift(i, 1);
          statements.splice.apply(statements, replacement);
          i += replacement.length - 3;
        }
      }
    }
  },

  visitBlockStatement: function(stmt)
  {
    this._checkStatements(stmt.statements);
  },

  visitProgram: function(stmt)
  {
    this._checkStatements(stmt.sourceElements);
  },

  visitVarStatement: function(stmt)
  {
    // Change let variables into "regular" variables
    if (stmt.vartype == "let")
      stmt.vartype = "var";
  },

  visitFunctionDeclaration: function(stmt)
  {
    // This might be a constructor, store it so that visitAssignmentExpression
    // can look it up later
    this._potentialConstructors[stmt.name] = stmt;
  },

  visitAssignmentExpression: function(stmt)
  {
    if (stmt.rhs && stmt.rhs.type == "ObjectLiteral" && stmt.rhs.setters)
    {
      let parent = null;
      for (let i = 0; i < stmt.rhs.setters.length; i++)
      {
        let setter = stmt.rhs.setters[i];
        if (setter.type == "PropertyLiteral" && setter.property && setter.property.type == "IdentifierExpression" && setter.property.name == "__proto__")
        {
          stmt.rhs.setters.splice(i--, 1);
          if (setter.value && setter.value.type == "MemberExpression" && setter.value.constmember == "prototype" &&
              setter.value.container && setter.value.container.type == "IdentifierExpression")
          {
            parent = setter.value.container;
          }
        }
      }
      if (parent)
      {
        if (this._extendFunctionName == null)
        {
          this._extendVarName = "_extendInitiated" + this._tempVarCount++;
          this._extendFunctionName = "_extend" + this._tempVarCount++;
          _print("var " + this._extendVarName + " = {};");
          _print("function " + this._extendFunctionName + "(baseClass, props) {");
          _print("  var result = new baseClass(" + this._extendVarName + ");");
          _print("  for (var k in props)");
          _print("    result[k] = props[k];");
          _print("  return result;");
          _print("}");
        }

        if (parent.name in this._potentialConstructors)
        {
          var body = this._potentialConstructors[parent.name].body;
          if (body.type != "BlockStatement" || !body.statements)
            throw "Unexpected body found in function " + parent.name;
          body.statements.unshift(new Node({
            type: "IfStatement",
            cond: new Node({
              type: "BinaryExpression",
              precedence: 9,
              operator: "===",
              lhs: new MemberExpression("arguments", 0),
              rhs: new IdentifierExpression(this._extendVarName)
            }),
            body: new Node({
              type: "BlockStatement",
              statements: [new Node({
                type: "ReturnStatement"
              })]
            })
          }));
          delete this._potentialConstructors[parent.name];
        }

        let call = new Node({
          type: "CallExpression",
          precedence: 2,
          func: new IdentifierExpression(this._extendFunctionName),
          arguments: [parent, stmt.rhs]
        });
        stmt.rhs = call;
      }
    }
  },

  _disabled_visitObjectLiteral: function(stmt)
  {
    // Drop __proto__ from object initializers
    for (let i = 0; i < stmt.setters.length; i++)
      if (stmt.setters[i].type == "PropertyLiteral" && stmt.setters[i].property && decompile(stmt.setters[i].property) == "__proto__")
        stmt.setters.splice(i--, 1);
  }
};

let origOutput = output;
let origFlush = flush;
let origIndent = indent;
let decompileBuffer;
function fakeOutput(str)
{
  decompileBuffer += str;
  return global;
}
function fakeFlush()
{
  return global;
}
function fakeIndent()
{
  return global;
}
function decompile(node)
{
  decompileBuffer = "";
  [output, flush, indent] = [fakeOutput, fakeFlush, fakeIndent];
  node.visit(visitor);
  [output, flush, indent] = [origOutput, origFlush, origIndent];
  return decompileBuffer;
}

// Output license header
_print('/* ***** BEGIN LICENSE BLOCK *****');
_print(' * Version: MPL 1.1');
_print(' *');
_print(' * The contents of this file are subject to the Mozilla Public License Version');
_print(' * 1.1 (the "License"); you may not use this file except in compliance with');
_print(' * the License. You may obtain a copy of the License at');
_print(' * http://www.mozilla.org/MPL/');
_print(' *');
_print(' * Software distributed under the License is distributed on an "AS IS" basis,');
_print(' * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License');
_print(' * for the specific language governing rights and limitations under the');
_print(' * License.');
_print(' *');
_print(' * The Original Code is Adblock Plus.');
_print(' *');
_print(' * The Initial Developer of the Original Code is');
_print(' * Wladimir Palant.');
_print(' * Portions created by the Initial Developer are Copyright (C) 2006-2010');
_print(' * the Initial Developer. All Rights Reserved.');
_print(' *');
_print(' * Contributor(s):');
_print(' *');
_print(' * ***** END LICENSE BLOCK ***** */');
_print();
_print('//');
_print('// This file has been generated automatically from Adblock Plus source code');
_print('//');
_print();

process_js = function(ast)
{
  if (!ast)
    return;

  ast = makeAST(ast);
  walkAST(ast, modifier);
  walkAST(ast, visitor);
}
