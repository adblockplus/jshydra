let global = this;
function decompileAST(ast) {
  let func = global["decompile" + ast.type];
  if (!func)
    throw "Unknown type " + ast.type;
  return func(ast);
}

function decompileProgram(ast) {
  return ast.body.map(decompileAST).join('\n');
}

/* Statements */
function decompileEmptyStatement(ast) {
  return ";"
}
function decompileBlockStatement(ast) {
  return '{\n' + ast.body.map(decompileAST).join('\n') + '\n}\n';
}

function decompileExpressionStatement(ast) {
  return decompileAST(ast.expression) + ";";
}

function decompileIfStatement(ast) {
  let str = "if (" + decompileAST(ast.test) + ")\n";
  str += decompileAST(ast.consequent);
  if (ast.alternate)
    str += " else\n" + decompileAST(ast.alternate);
  return str;
}

function decompileLabeledStatement(ast) {
  return ast.label.name + ": " + decompileAST(ast.body);
}

function decompileBreakStatement(ast) {
  return "break" + (ast.label ? " " + ast.label.name : "") + ";";
}

function decompileContinueStatement(ast) {
  return "continue" + (ast.label ? " " + ast.label.name : "") + ";";
}

function decompileWithStatement(ast) {
  return "with (" + decompileAST(ast.object) + ") " + decompileAST(ast.body);
}

function decompileSwitchStatement(ast) {
  let str = "switch (" + decompileAST(ast.discriminant) + ") {\n";
  let cases = [];
  for (let scase of ast.cases) {
    let casestr = scase.test ? "case " + decompileAST(scase.test) : "default";
    casestr += ":\n";
    casestr += scase.consequent.map(decompileAST).join('\n');
    cases.push(casestr);
  }
  str += cases.join('\n') + '\n}\n';
  return str;
}

function decompileReturnStatement(ast) {
  return "return" + (ast.argument ? " " + decompileAST(ast.argument) :
      "") + ";";
}

function decompileThrowStatement(ast) {
  return "throw " + decompileAST(ast.argument) + ";";
}

function decompileTryStatement(ast) {
  let str = "try " + decompileAST(ast.block);

  let handlers = [];
  if (ast.handler && "type" in ast.handler)
    handlers.push(ast.handler);
  else if (ast.handlers)
    handlers = ast.handlers;

  let handler_strs = [];
  for (let handler of handlers) {
    let handler_str = "catch (" + decompileAST(handler.param);
    if (handler.guard)
      handler_str += " if " + decompileAST(handler.guard);
    handler_str += ") " + decompileAST(handler.body);
    handler_strs.push(handler_str);
  }
  str += handler_strs.join("");
  if (ast.finalizer)
    str += " finally " + decompileAST(ast.finalizer);
  return str;
}

function decompileWhileStatement(ast) {
  return "while (" + decompileAST(ast.test) + ") " + decompileAST(ast.body);
}

function decompileDoWhileStatement(ast) {
  return "do " + decompileAST(ast.body) + " while (" + decompileAST(ast.test) + ");";
}

function decompileForStatement(ast) {
  let str = "for (";
  if (ast.init) {
    if (ast.init.type == "VariableDeclaration")
      str += decompileAST(ast.init);
    else
      str += decompileAST(ast.init) + ";";
  } else {
    str += ";";
  }
  if (ast.test)
    str += decompileAST(ast.test);
  str += ";";
  if (ast.update)
    str += decompileAST(ast.update);
  str += ") ";
  return str + decompileAST(ast.body);
}

function decompileForInStatement(ast) {
  let str = "for";
  if (ast.each)
      str += " each";
  str += "(";
  if (ast.left.type == "VariableDeclaration")
      str += decompileVariableDeclaration(ast.left, true);
  else
      str += decompileAST(ast.left);
  str += " in " + decompileExpr(ast.right, ast) + ") ";
  str += decompileAST(ast.body);
  return str;
}

function decompileForOfStatement(ast) {
  let str = "for (";
  if (ast.left.type == "VariableDeclaration")
      str += decompileVariableDeclaration(ast.left, true);
  else
      str += decompileAST(ast.left);
  str += " of " + decompileExpr(ast.right, ast) + ") ";
  str += decompileAST(ast.body);
  return str;
}

function decompileLetStatement(ast) {
  let str = "let (";
  str += ast.head.map(d => d ? decompileAST(d) : ' ').join(', ');
  str += ") " + decompileAST(ast.body);
  return str;
}

function decompileDebuggerStatement(ast) {
  return "debugger;";
}

function decompileFunctionDeclaration(ast, init, name_ast) {
  let str = (init ? init : "function") + " ";
  if (ast.id)
    str += ast.id.name;
  else if (name_ast)
    str += decompileAST(name_ast);
  str += "(";
  str += ast.params.map(decompileAST).join(', ');
  str += ") " + decompileAST(ast.body);
  return str;
}

function decompileVariableDeclaration(ast, excludeSemi) {
  let inits = [];
  for (let initializer of ast.declarations) {
    inits.push(decompileAST(initializer));
  }
  return ast.kind + " " + inits.join(', ') + (excludeSemi ? "" : ";");
}

function decompileVariableDeclarator(ast) {
  if (ast.init)
    return decompileAST(ast.id) + " = " + decompileAST(ast.init);
  return decompileAST(ast.id);
}

/* Expressions */
let precedence = {
  "SequenceExpression": 0,
  "AssignmentExpression": 1,
  "YieldExpression": 2,
  "ConditionalExpression": 3,
  "||": 4,
  "&&": 5,
  "|": 6,
  "^": 7,
  "&": 8,
  "==": 9, "!=": 9, "===": 9, "!==": 9,
  "<=": 10, ">=": 10, "<": 10, ">": 10, "in": 10, "instanceof": 10, "ForInStatement": 10,
  "<<": 11, ">>": 11, ">>>": 11,
  "+": 12, "-": 12,
  "*": 13, "/": 13, "%": 13,
  "UnaryExpression": 14,
  "UpdateExpression": 15,
  "NewExpression": 16,
  "CallExpression": 17, "MemberExpression": 17,
  "FunctionExpression": 18
  /* Everything else is 19 */
};

function getPrecedence(expr) {
  if (expr.type in precedence)
    return precedence[expr.type];
  else if (expr.operator && expr.operator in precedence)
    return precedence[expr.operator];
  return 19;
}

function decompileExpr(expr, par, forceParen) {
  if (getPrecedence(expr) < getPrecedence(par) || (forceParen && getPrecedence(expr) == getPrecedence(par)) || (expr.type == "FunctionExpression" && par.type == "CallExpression"))
    return "(" + decompileAST(expr) + ")";
  else
    return decompileAST(expr);
}

function decompileThisExpression(ast) {
    return "this";
}

function decompileArrayExpression(ast) {
  if (ast.elements)
    return "[" + ast.elements.map(el => el ? decompileAST(el) : "").
      join(", ") + "]";
  return "[]";
}

function decompileObjectExpression(ast) {
  let props = [];
  for (let prop of ast.properties) {
    if (prop.kind == "init")
      props.push(decompileAST(prop.key) + ": " + decompileAST(prop.value));
    else if (prop.kind == "get" || prop.kind == "set")
      props.push(decompileFunctionDeclaration(prop.value, prop.kind, prop.key));
    else
      throw "Unknown kind " + prop.kind;
  }
  return "{\n" + props.join(",\n") + "}";
}

function decompileFunctionExpression(ast) {
  return decompileFunctionDeclaration(ast);
}

function decompileArrowFunctionExpression(ast) {
  let str = "(" + ast.params.map(decompileAST).join(", ") + ")";
  str += " => " + decompileAST(ast.body);
  return str;
}

function decompileSequenceExpression(ast) {
  return "(" + ast.expressions.map(e => decompileExpr(e, ast)).join(", ") + ")";
}

function decompileUnaryExpression(ast) {
  if (ast.prefix)
    return ast.operator + " " + decompileExpr(ast.argument, ast);
  throw "ER, wtf?";
}

function decompileBinaryExpression(ast) {
  return decompileExpr(ast.left, ast) + " " + ast.operator +
    " " + decompileExpr(ast.right, ast, true);
}

function decompileAssignmentExpression(ast) {
  return decompileExpr(ast.left, ast, true) + " " + ast.operator +
    " " + decompileExpr(ast.right, ast);
}

function decompileUpdateExpression(ast) {
  let before = "", after = ast.operator;
  if (ast.prefix) {
      before = after;
      after = "";
  }
  return before + decompileExpr(ast.argument, ast) + after;
}

function decompileLogicalExpression(ast) {
  return decompileExpr(ast.left, ast) + " " + ast.operator +
    " " + decompileExpr(ast.right, ast, true);
}

function decompileConditionalExpression(ast) {
  return decompileExpr(ast.test, ast) + " ? " +
    decompileExpr(ast.consequent, ast) + " : " +
    decompileExpr(ast.alternate, ast);
}

function decompileNewExpression(ast) {
  let str = "new " + decompileAST(ast.callee, ast) + "(";
  if (ast.arguments)
    str += ast.arguments.map(decompileAST).join(", ");
  str += ")";
  return str;
}

function decompileCallExpression(ast) {
  return decompileExpr(ast.callee, ast) + "(" +
    ast.arguments.map(decompileAST) + ")";
}

function decompileMemberExpression(ast) {
  function isIdentifier(ast2) {
    let val = decompileAST(ast2);
    if (val.length == 0) return false;
    if (!(val[0] == '_' || val[0] == '$' ||
          (val[0] >= 'a' && val[0] <= 'z') || (val[0] >= 'A' && val[0] <= 'Z')))
        return false;
    for (let i = 1; i < val.length; i++) {
      if (!(val[i] == '_' || val[i] == '$' ||
          (val[i] >= 'a' && val[i] <= 'z') ||
          (val[i] >= 'A' && val[i] <= 'Z') ||
          (val[i] >= '0' && val[i] <= '9')))
        return false;
    }
    return true;
  }
  return decompileExpr(ast.object, ast) +
    (ast.computed ? '[' + decompileAST(ast.property) + ']' :
     !isIdentifier(ast.property) ?
       '["' + sanitize(decompileAST(ast.property), '"') + '"]' :
       '.' + ast.property.name);
}

function decompileYieldExpression(ast) {
  return "yield" + (ast.argument ? " " + decompileAST(ast.argument) : "");
}

function decompileComprehensionExpression(ast, paren) {
  let str = (paren ? paren.l : "[") + decompileAST(ast.body);
  for (let block of ast.blocks) {
    str += (block.each ? " for each " : " for ");
    str += "(" + decompileAST(block.left) + " in ";
    str += decompileAST(block.right) + ")";
  }
  if (ast.filter)
    str += " if (" + decompileAST(ast.filter) + ")";
  return str + (paren ? paren.r : "]");
}

function decompileGeneratorExpression(ast) {
  return decompileComprehensionExpression(ast, {l: "(", r: ")"});
}

function decompileGraphExpression(ast) {
  return "#" + ast.index + "=" + decompileAST(ast.expression);
}

function decompileGraphIndexExpression(ast) {
  return "#" + ast.index;
}

function decompileLetExpression(ast) {
  return decompileLetStatement(ast);
}

/* Patterns */

function decompileObjectPattern(ast) {
  let str = "{";
  str += ast.properties.map(p => decompileAST(p.key) + ": " +
                                 decompileAST(p.value)).join(', ');
  return str + "}";
}

function decompileArrayPattern(ast) {
  return "[" + ast.elements.map(e => e ? decompileAST(e) : ' ').join(', ') + "]";
}

function decompileIdentifier(ast) { return ast.name; }

function sanitize(str, q) {
  function replace(x) {
    if (x == q) return '\\' + q;
    if (x == '\\') return '\\\\';
    if (x == '\b') return '\\b';
    if (x == '\f') return '\\f';
    if (x == '\n') return '\\n';
    if (x == '\r') return '\\r';
    if (x == '\t') return '\\t';
    if (x == '\v') return '\\v';
    let val = x.charCodeAt(0);
    if (x < ' ') return '\\x' + (val - val % 16) / 16 + (val % 16);
    return x;
  }
  let result = "";
  for (let char of str)
    result += replace(char);
  return result;
}

function decompileLiteral(ast) {
  if (typeof ast.value == "string")
    return '"' + sanitize(ast.value, '"') + '"';
  if (ast.value === null)
      return "null";
  return ast.value;
}

function process_js(ast) {
    _print(decompileAST(ast));
}
