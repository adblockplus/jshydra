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
      // for each (var [foo, bar] in fooList)
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
      // for (var _loopIndex55 = 0; _loopIndex55 < fooList.length; _loopIndex44++)
      // {
      //   var foo = fooList[_loopIndex55][0];
      //   var bar = fooList[_loopIndex55][1];
      //   ...
      // }
      if (!stmt.itervar || stmt.itervar.type != "VarStatement" || !stmt.itervar.variables ||
          stmt.itervar.variables.length != 1)
      {
        throw "Loop variable isn't a variable statement?";
      }
      let loopVar = stmt.itervar.variables[0];
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

      if (loopVar.type == "VarDeclaration" && loopVar.name)
      {
        stmt.body.statements.unshift(new VarStatement(loopVar.name, new MemberExpression(stmt.iterrange, new IdentifierExpression(loopIndex))));
      }
      else if (loopVar.type == "ArrayLiteral")
      {
        for (let i = 0; i < loopVar.members.length; i++)
        {
          if (loopVar.members[i].type != "IdentifierExpression")
            throw "Expected member of destructuring assignment in loop variable";
          stmt.body.statements.splice(i, 0, new VarStatement(loopVar.members[i].name, new MemberExpression(new MemberExpression(stmt.iterrange, new IdentifierExpression(loopIndex)), i)));
        }
      }
      else
        throw "Unexpected loop variable in for each statement";

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
    this._exportedSymbols = [];
    this._checkStatements(stmt.sourceElements);
  },

  postvisitProgram: function(stmt)
  {
    if (typeof isModule == "boolean" && isModule)
    {
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
    }
  },

  visitVarStatement: function(stmt)
  {
    // Change let variables into "regular" variables
    if (stmt.vartype == "let")
      stmt.vartype = "var";
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
  _print('/*');
  _print(' * This Source Code is subject to the terms of the Mozilla Public License');
  _print(' * version 2.0 (the "License"). You can obtain a copy of the License at');
  _print(' * http://mozilla.org/MPL/2.0/.');
  _print(' */');
  _print();
  _print('//');
  _print('// This file has been generated automatically from Adblock Plus source code');
  _print('//');
  _print();

  ast = makeAST(ast);
  walkAST(ast, modifier);
  walkAST(ast, visitor);
}
