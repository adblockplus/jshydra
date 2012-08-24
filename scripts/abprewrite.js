// This script rewrites AST to be compatible with JavaScript 1.5 and decompiles
// the modified tree then

// Output license header and warning - do this only once, not each time a file
// is being processed.
_print('/*');
_print(' * This Source Code is subject to the terms of the Mozilla Public License');
_print(' * version 2.0 (the "License"). You can obtain a copy of the License at');
_print(' * http://mozilla.org/MPL/2.0/.');
_print(' */');
_print();
_print('//');
_print('// This file has been generated automatically from Adblock Plus for Firefox');
_print('// source code. DO NOT MODIFY, change the original source code instead.');
_print('//');
_print('// Relevant repositories:');
_print('// * https://hg.adblockplus.org/adblockplus/');
_print('// * https://hg.adblockplus.org/jshydra/');
_print('//');
_print();

include("astDecompile.js");
include("../utils/beautify.js");

// See https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API for
// AST structure.

let options = {
  filename: null,
  module: false,
  varIndex: 0,
  indent_size: 2,
  preserve_newlines: false,
  brace_style: "expand-strict"
};
let global = this;

function Literal(value)
{
  return {
    type: "Literal",
    value: value
  };
}

function Identifier(varname)
{
  return {
    type: "Identifier",
    name: varname
  };
}

function Member(object, property, computed)
{
  if (typeof object == "string")
    object = Identifier(object);
  if (typeof property != "object")
    property = Identifier(property);

  return {
    type: "MemberExpression",
    object: object,
    property: property,
    computed: computed
  };
}

function VariableDeclaration(variable, value)
{
  if (typeof variable == "string")
    variable = Identifier(variable);
  if (typeof value != "object")
    value = Literal(value);

  return {
    type: "VariableDeclaration",
    declarations: [
      {
        type: "VariableDeclarator",
        id: variable,
        init: value
      }
    ],
    kind: "var"
  };
}

function Assignment(variable, value)
{
  if (typeof variable == "string")
    variable = Identifier(variable);

  return {
    type: "ExpressionStatement",
    expression: {
      type: "AssignmentExpression",
      left: variable,
      right: value,
      operator: "="
    }
  };
}

function LogicalExpression(left, operator, right)
{
  if (typeof left != "object")
    left = (typeof left == "string" ? Identifier(left) : Literal(left));
  if (typeof right != "object")
    right = Literal(right);

  return {
    type: "LogicalExpression",
    left: left,
    right: right,
    operator: operator
  };
}

function IncExpression(variable)
{
  if (typeof variable != "object")
    variable = Identifier(variable);

  return {
    type: "UpdateExpression",
    argument: variable,
    operator: "++",
    prefix: true
  };
}

function modifyAST(ast)
{
  // Do the necessary modifications
  let func = "modify" + ast.type;
  if (typeof global[func] == "function")
    ast = global[func](ast);

  // Recursive calls for any AST in properties of the current one
  if (ast)
  {
    let props = [];
    for (let prop in ast)
      props.push(prop);
    for (let i = 0; i < props.length; i++)
    {
      let value = ast[props[i]];
      if (!value || typeof value != "object")
        continue;

      if ("type" in value)
      {
        let result = modifyAST(value);
        if (result)
          ast[props[i]] = result;
        else
          delete ast[props[i]];
      }
      else if (value instanceof Array)
      {
        for (let j = 0; j < value.length; j++)
        {
          if (typeof value[j] == "object" && "type" in value[j])
          {
            let result = modifyAST(value[j]);
            if (result)
              value[j] = result;
            else
              value.splice(j--, 1);
          }
        }
      }
    }
  }

  return ast;
}

function modifyExpressionStatement(ast)
{
  if (ast.expression.type == "CallExpression")
  {
    let funcName = decompileAST(ast.expression.callee);

    // Remove import calls:
    // Cu.import(...);
    if (funcName == "Cu.import")
      return null;

    // Remove timeline calls:
    // TimeLine.foobar(...);
    if (/^TimeLine\./.test(funcName))
      return null;
  }

  if (ast.expression.type == "AssignmentExpression" && ast.expression.operator == "=" && ast.expression.left.type == "ArrayPattern")
  {
    // Convert destructuring assignment:
    // [foo, bar] = [1, 2];
    //
    // Change into:
    // var _tempVar44 = [1, 2];
    // foo = _tempVar44[0];
    // bar = _tempVar44[1];
    let vars = ast.expression.left.elements;
    let block = {type: "Program", body: []};

    let tempVar = Identifier("_tempVar" + options.varIndex++);
    block.body.push(VariableDeclaration(tempVar, ast.expression.right));

    for (let i = 0; i < vars.length; i++)
      if (vars[i])
        block.body.push(Assignment(vars[i], Member(tempVar, i, true)));
    return block;
  }
  return ast;
}

function modifyVariableDeclaration(ast)
{
  // Convert let variables:
  // let foo = bar;
  //
  // Change into:
  // var foo = bar;
  if (ast.kind == "let")
    ast.kind = "var";

  if (ast.declarations.length == 1 && ast.declarations[0].type == "VariableDeclarator")
  {
    let declarator = ast.declarations[0];

    // Remove timeline requires:
    // let {Timeline} = require("timeline");
    if (declarator.init && decompileAST(declarator.init) == 'require("timeline")')
      return null;

    // Remove declarations of XPCOM shortcuts:
    // const Cc = Components.classes;
    // const Ci = Components.interfaces;
    // const Cr = Components.results;
    // const Cu = Components.utils;
    if (/^C[ciru]$/.test(decompileAST(declarator.id)))
      return null;

    if (declarator.id.type == "ArrayPattern")
    {
      // Convert destructuring assignment:
      // var [foo, bar] = [1, 2];
      //
      // Change into:
      // var _tempVar44 = [1, 2];
      // var foo = _tempVar44[0];
      // var bar = _tempVar44[1];
      let vars = declarator.id.elements;
      let block = {type: "Program", body: []};

      let tempVar = Identifier("_tempVar" + options.varIndex++);
      block.body.push(VariableDeclaration(tempVar, declarator.init));

      for (let i = 0; i < vars.length; i++)
        if (vars[i])
          block.body.push(VariableDeclaration(vars[i], Member(tempVar, i, true)));
      return block;
    }

    if (declarator.id.type == "ObjectPattern")
    {
      // Convert destructuring assignment:
      // var {foo: bar, foo2: bar2} = {foo: 1, foo2: 2};
      //
      // Change into:
      // var _tempVar44 = {foo: 1, foo2: 2};
      // var bar = _tempVar44.foo;
      // var bar2 = _tempVar44.foo2;
      //
      // Simplified form;
      // var {foo: bar} = {foo: 1};
      //
      // Change into:
      // var bar = {foo: 1}.foo;
      let vars = declarator.id.properties;
      if (vars.length == 1)
        return VariableDeclaration(vars[0].value, Member(declarator.init, vars[0].key, false));
      else
      {
        let block = {type: "Program", body: []};

        let tempVar = Identifier("_tempVar" + options.varIndex++);
        block.body.push(VariableDeclaration(tempVar, declarator.init));

        for (let i = 0; i < vars.length; i++)
          block.body.push(VariableDeclaration(vars[i].value, Member(tempVar, vars[i].key, false)));
        return block;
      }
    }
  }

  return ast;
}

function modifyForInStatement(ast)
{
  if (ast.each)
  {
    // Convert "for each" loops:
    // for each (var foo in fooList)
    // {
    //   ...
    // }
    //
    // Change into:
    // for (var _loopIndex44 = 0; _loopIndex44 < fooList.length; ++_loopIndex44)
    // {
    //   var foo = fooList[_loopIndex44];
    //   ...
    // }
    let loopIndex = Identifier("_loopIndex" + options.varIndex++);

    let block = ast.body;
    if (block.type != "BlockStatement")
      block = {type: "BlockStatement", body: (block.type == "EmptyStatement" ? [] : [block])};
    if (ast.left.type == "VariableDeclaration")
      block.body.unshift(VariableDeclaration(ast.left.declarations[0].id, Member(ast.right, loopIndex, true)));
    else
      block.body.unshift(Assignment(ast.left, Member(ast.right, loopIndex, true)));

    return {
      type: "ForStatement",
      init: VariableDeclaration(loopIndex, 0),
      test: LogicalExpression(loopIndex, "<", Member(ast.right, "length", false)),
      update: IncExpression(loopIndex),
      body: block
    };
  }
}

process_js = function(ast, filename, args)
{
  for each (let arg in args.split(/\s+/))
  {
    let match = /^(\w+)\s*=\s*(.*)/.exec(arg);
    if (match && typeof options[match[1]] == "boolean")
      options[match[1]] = (match[2] == "true");
  }

  options.filename = filename.replace(/.*[\\\/]/, "").replace(/\.jsm?$/, "");

  // Modify AST
  if (ast)
    ast = modifyAST(ast);
  if (!ast)
    return;

  if (options.module)
  {
    // Wrap the entire module into a function to give it an independent scope.
    // Return exported symbols:
    //
    // require.scopes["foobar"] = (function() {
    //   var exports = {};
    //   ...
    //   return exports;
    // })();
    let code = 'require.scopes["' + options.filename + '"] = (function() {\n' +
               'var exports = {};\n' +
               decompileAST(ast) +
               '})();';
    _print(js_beautify(code, options));
  }
  else
    _print(js_beautify(decompileAST(ast), options));
}
