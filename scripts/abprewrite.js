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

function UnaryExpression(operator, operand)
{
  var operators = {
    __proto__: null,
    "yield": 4,
    "+": 4,
    "-": 4,
    "!": 4,
    "~": 4,
    "typeof": 4,
    "void": 4,
    "delete": 4,
    "++": 3,
    "--": 3,
    "()": 2
  };

  if (!(operator in operators))
    throw "Unknown operator";

  if (typeof operand != "object")
    operand = new LiteralExpression(operand);

  Node.call(this, {
    operator: operator,
    precedence: operators[operator],
    operand: operand
  });
}
UnaryExpression.prototype =
{
  __proto__: Node.prototype,
  type: "UnaryExpression"
};

function BinaryExpression(operator, lhs, rhs)
{
  var operators = {
    __proto__: null,
    ",": 17,
    "||": 14,
    "&&": 13,
    "|": 12,
    "^": 11,
    "&": 10,
    "==": 9,
    "!=": 9,
    "===": 9,
    "!==": 9,
    "<": 8,
    "<=": 8,
    ">": 8,
    ">=": 8,
    "in": 8,
    "instanceof": 8,
    "<<": 7,
    ">>": 7,
    ">>>": 7,
    "+": 6,
    "-": 6,
    "*": 5,
    "/": 5,
    "%": 5
  };

  if (!(operator in operators))
    throw "Unknown operator";

  if (typeof lhs != "object")
    lhs = new LiteralExpression(lhs);
  if (typeof rhs != "object")
    rhs = new LiteralExpression(rhs);

  Node.call(this, {
    operator: operator,
    precedence: operators[operator],
    lhs: lhs,
    rhs: rhs
  });
}
BinaryExpression.prototype =
{
  __proto__: Node.prototype,
  type: "BinaryExpression"
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

function ExpressionStatement(expression)
{
  Node.call(this, {
    expr: expression
  });
}
ExpressionStatement.prototype =
{
  __proto__: Node.prototype,
  type: "ExpressionStatement"
};

let modifier =
{
  _filename: null,
  _tempVarCount: 0,
  _extendFunctionName: null,
  _exportedSymbols: null,

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
      {
        // Store exported symbols for later
        let array = stmt.variables[0].initializer;
        if (!array || array.type != "ArrayLiteral")
          throw "Unexpected: EXPORTED_SYMBOLS isn't initialized with an array literal";
        for each (let member in array.members)
        {
          if (member.type != "LiteralExpression" || member.objtype != "string")
            throw "Unexpected value in EXPORTED_SYMBOLS array";
          this._exportedSymbols.push(member.value);
        }
        return true;
      }

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
        result.push(new ExpressionStatement(new Node({
          type: "AssignmentExpression",
          precedence: 16,
          operator: "",
          lhs: stmt.expr.lhs.members[i],
          rhs: new MemberExpression(tempVar, i)
        })));
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

      if (stmt.body.type != "BlockStatement")
      {
        let oldBody = stmt.body;
        stmt.body = new Node({
          type: "BlockStatement",
          statements: []
        });
        if (oldBody)
          stmt.body.statements.push(oldBody);
      }
      stmt.body.statements.unshift(new VarStatement(loopVar, new MemberExpression(stmt.iterrange, new IdentifierExpression(loopIndex))));

      return [new Node({
        type: "ForStatement",
        init: new VarStatement(loopIndex, 0),
        cond: new BinaryExpression("<", new IdentifierExpression(loopIndex), new MemberExpression(stmt.iterrange, "length", true)),
        inc: new UnaryExpression("++", new IdentifierExpression(loopIndex)),
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
    this._extendFunctionName = null;
    this._exportedSymbols = [];
    this._checkStatements(stmt.sourceElements);
  },

  postvisitProgram: function(stmt)
  {
    // Insert _extend44() function declaration at the beginning of the module:
    // function _extend44(baseClass, props) {
    //   var dummyConstructor = function() {};
    //   dummyConstructor.prototype = baseClass.prototype;
    //   var result = new dummyConstructor();
    //   for (var k in props)
    //     result[k] = props[k];
    //   return result;
    // }
    if (this._extendFunctionName != null)
    {
      // Would be nice to decompile the source code of the _extend() function
      // but that isn't supported, have to build the AST for it
      stmt.sourceElements.unshift(new Node({
        type: "FunctionDeclaration",
        precedence: Infinity,
        name: this._extendFunctionName,
        arguments: [new IdentifierExpression("baseClass"), new IdentifierExpression("props")],
        body: new Node({
          type: "BlockStatement",
          statements: [
            new VarStatement("dummyConstructor", new Node({
              type: "FunctionDeclaration",
              precedence: Infinity,
              name: "",
              arguments: [],
              body: new Node({type: "EmptyStatement"})
            })),
            new ExpressionStatement(new Node({
              type: "AssignmentExpression",
              precedence: 16,
              operator: "",
              lhs: new MemberExpression("dummyConstructor", "prototype", true),
              rhs: new MemberExpression("baseClass", "prototype", true)
            })),
            new VarStatement("result", new Node({
              type: "NewExpression",
              precedence: 1,
              constructor: new IdentifierExpression("dummyConstructor"),
              arguments: []
            })),
            new Node({
              type: "ForInStatement",
              itertype: "for",
              itervar: new VarStatement("k"),
              iterrange: new IdentifierExpression("props"),
              body: new ExpressionStatement(new Node({
                type: "AssignmentExpression",
                precedence: 16,
                operator: "",
                lhs: new MemberExpression("result", new IdentifierExpression("k")),
                rhs: new MemberExpression("props", new IdentifierExpression("k")),
              }))
            }),
            new Node({
              type: "ReturnStatement",
              expr: new IdentifierExpression("result")
            })
          ]
        })
      }));
    }

    // Add patch function call at the end of the module:
    // if (typeof _patchFunc44 != "undefined")
    //   (eval("(" + _patchFunc44.toString()) + ")()");
    let patchFuncName = "_patchFunc" + this._tempVarCount++;
    stmt.sourceElements.push(new Node({
      type: "IfStatement",
      cond: new BinaryExpression("!=", new UnaryExpression("typeof", new IdentifierExpression(patchFuncName)), "undefined"),
      body: new ExpressionStatement(new Node({
        type: "CallExpression",
        precedence: 2,
        func: new IdentifierExpression("eval"),
        arguments: [new BinaryExpression("+", new BinaryExpression("+", "(", new Node({
          type: "CallExpression",
          precedence: 2,
          arguments: [],
          func: new MemberExpression(patchFuncName, "toString", true),
        })), ")()")],
      }))
    }));

    // Add exported symbols at the end of the module:
    // window.exportedSymbol1 = exportedSymbol1;
    // window.exportedSymbol2 = exportedSymbol2;
    // window.exportedSymbol3 = exportedSymbol3;
    if (this._exportedSymbols.length > 0)
    {
      for each (let symbol in this._exportedSymbols)
      {
        stmt.sourceElements.push(new ExpressionStatement(new Node({
          type: "AssignmentExpression",
          precedence: 16,
          operator: "",
          lhs: new MemberExpression("window", symbol, true),
          rhs: new IdentifierExpression(symbol),
        })));
      }
    }

    // Wrap the entire module into a function to give it an independent scope:
    // (function(_patchFunc44) {
    //   ...
    // })(window.ModuleNamePatch);
    stmt.sourceElements = [new ExpressionStatement(new Node({
      type: "CallExpression",
      precedence: 2,
      arguments: [new MemberExpression("window", this._filename + "Patch", true)],
      func: new Node({
        type: "FunctionDeclaration",
        precedence: Infinity,
        name: "",
        arguments: [new IdentifierExpression(patchFuncName)],
        body: new Node({
          type: "BlockStatement",
          statements: stmt.sourceElements
        })
      })
    }))];
  },

  visitVarStatement: function(stmt)
  {
    // Change let variables into "regular" variables
    if (stmt.vartype == "let")
      stmt.vartype = "var";
  },

  visitAssignmentExpression: function(stmt)
  {
    if (stmt.rhs && stmt.rhs.type == "ObjectLiteral" && stmt.rhs.setters)
    {
      // Convert prototype chains:
      // Foo.prototype = {
      //   __proto__: Bar.prototype,
      //   ...
      // };
      //
      // Change into:
      // Foo.prototype = _extend44(Bar, {
      //   ...
      // });
      //
      // Any __proto__ entries not pointing to a function (__proto__: null) are
      // removed.
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
          this._extendFunctionName = "_extend" + this._tempVarCount++;

        let call = new Node({
          type: "CallExpression",
          precedence: 2,
          func: new IdentifierExpression(this._extendFunctionName),
          arguments: [parent, stmt.rhs]
        });
        stmt.rhs = call;
      }
    }
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

process_js = function(ast, filename)
{
  if (!ast)
    return;

  filename = filename.replace(/.*[\\\/]/, "");
  filename = filename.replace(/\.jsm?$/, "");
  modifier._filename = filename;

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
  _print(' * Portions created by the Initial Developer are Copyright (C) 2006-2011');
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

  ast = makeAST(ast);
  walkAST(ast, modifier);
  walkAST(ast, visitor);
}
