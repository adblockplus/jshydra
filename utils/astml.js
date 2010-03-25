// Output an JsonML codec for the AST

// Explanation of a node:
// {
//   type: The type of the node
//   location: "line:col-line:col"
// }
/**
 * Node formats:
 * Program
 *   sourceElements: Array of elements (functions, statements)
 * FunctionDeclaration
 *   name: Name of the function
 *   arguments: Array of arguments
 *   body: Array of elements in function body
 * VarStatement
 *   variables: Variables being initialized
 * VarDeclaration
 *   name: Name of variable
 *   initializer: Initial value of variable
 * CallExpression
 *   func: Name of the function being called
 *   arguments: Array of arguments
 * IdentifierExpression
 *   name: Name of identifier
 * LiteralExpression
 *   objtype: "null", "boolean", "numeric", "string", "regex"
 *   value: Value of the literal
 * BinaryExpression
 *   operator: operator (e.g., '|', '+')
 +   lhs, rhs: left-hand, right-hand expressions for the operator
 */
include("../utils/dumpast.js");
include("../utils/cleanast.js");

function getLocation(pn) {
  return pn.line + ":" + pn.column;
}
function shellNode(pn, type) {
  return {type: type, location: getLocation(pn)};
}
function binaryNode(pn, operator) {
  let ast = shellNode(pn, "BinaryExpression");
  ast.operator = operator;
  ast.lhs = parseToAst(pn.kids[0]);
  ast.rhs = parseToAst(pn.kids[1]);
  for (let i = 2; i < pn.kids.length; i++) {
    let sup = shellNode(pn.kids[i], "BinaryExpression");
    sup.operator = operator;
    sup.lhs = ast;
    sup.rhs = parseToAst(pn.kids[i]);
    ast = sup;
  }
  return ast;
}

function makeAST(pn) {
  let ast = {
   type: "Program",
   location: getLocation(pn),
   sourceElements: parseToAst(pn).statements
  };
  return ast;
}

function parseToAst(pn) {
  if (!pn)
    return pn;
  try {
    return global["convert" + decode_type(pn.type)](pn);
  } catch (e if e instanceof TypeError) {
    dump_ast(pn);
    //throw e;
    throw "Unexpected token " + decode_type(pn.type);
  }
}

// Nodes that I don't see in output
// TOK_ERROR, TOK_EOL, TOK_ELSE, TOK_FINALLY, TOK_SEQ
// TOK_XMLSTAGO - TOK_XMLLIST are XML and thus ignored

function convertTOK_SEMI(pn) {
  let ast = shellNode(pn, "ExpressionStatement");
  if (pn.kids[0])
    ast.expr = parseToAst(pn.kids[0]);
  else {
    ast.type = "EmptyStatement";
  }
  return ast;
}

function convertTOK_COMMA(pn) {
  return shellNode(pn, "EmptyExpression");
}

function convertTOK_ASSIGN(pn) {
  let ast = shellNode(pn, "AssignmentExpression");
  ast.lhs = parseToAst(pn.kids[0]);
  ast.rhs = parseToAst(pn.kids[1]);
  switch (pn.op) {
  case JSOP_NOP: break;
  case JSOP_BITOR: ast.operator = '|'; break;
  case JSOP_BITXOR: ast.operator = '^'; break;
  case JSOP_BITAND: ast.operator = '&'; break;
  case JSOP_LSH: ast.operator = '<<'; break;
  case JSOP_RSH: ast.operator = '>>'; break;
  case JSOP_URSH: ast.operator = '>>>'; break;
  case JSOP_ADD: ast.operator = '+'; break;
  case JSOP_SUB: ast.operator = '-'; break;
  case JSOP_MUL: ast.operator = '*'; break;
  case JSOP_DIV: ast.operator = '/'; break;
  case JSOP_MOD: ast.operator = '%'; break;
  default: throw "Unexpected operator " + decode_op(pn.op);
  };
  return ast;
}

function convertTOK_HOOK(pn) {
  let ast = shellNode(pn, "ConditionalExpression");
  ast.condition = parseToAst(pn.kids[0]);
  ast.iftrue = parseToAst(pn.kids[1]);
  ast.iffalse = parseToAst(pn.kids[2]);
  return ast;
}

function convertTOK_COLON(pn) {
  let ast = shellNode(pn, "PropertyLiteral");
  ast.property = parseToAst(pn.kids[0]);
  ast.value = parseToAst(pn.kids[1]);
  return ast;
}

function convertTOK_OR(pn)     { return binaryNode(pn, "||"); }
function convertTOK_AND(pn)    { return binaryNode(pn, "&&"); }
function convertTOK_BITOR(pn)  { return binaryNode(pn, "|"); }
function convertTOK_BITXOR(pn) { return binaryNode(pn, "^"); }
function convertTOK_BITAND(pn) { return binaryNode(pn, "&"); }
function convertTOK_EQOP(pn) {
  switch (pn.op) {
  case JSOP_EQ:                  return binaryNode(pn, "==");
  case JSOP_NE:                  return binaryNode(pn, "!=");
  case JSOP_STRICTEQ:            return binaryNode(pn, "===");
  case JSOP_STRICTNE:            return binaryNode(pn, "!==");
  }
  throw "Unknown operator: " + decode_op(pn.op);
}
function convertTOK_RELOP(pn) {
  switch (pn.op) {
  case JSOP_LT:                  return binaryNode(pn, "<");
  case JSOP_LE:                  return binaryNode(pn, "<=");
  case JSOP_GT:                  return binaryNode(pn, ">");
  case JSOP_GE:                  return binaryNode(pn, ">=");
  }
  throw "Unknown operator: " + decode_op(pn.op);
}
function convertTOK_SHOP(pn) {
  switch (pn.op) {
  case JSOP_LSH:                 return binaryNode(pn, "<<");
  case JSOP_RSH:                 return binaryNode(pn, ">>");
  case JSOP_URSH:                return binaryNode(pn, ">>>");
  }
  throw "Unknown operator: " + decode_op(pn.op);
}
function convertTOK_PLUS(pn)   { return binaryNode(pn, "+"); }
function convertTOK_MINUS(pn)  { return binaryNode(pn, "-"); }
function convertTOK_STAR(pn)   { return binaryNode(pn, "*"); }
function convertTOK_DIVOP(pn) {
  switch (pn.op) {
  case JSOP_MUL:                 return binaryNode(pn, "*");
  case JSOP_DIV:                 return binaryNode(pn, "/");
  case JSOP_MOD:                 return binaryNode(pn, "%");
  }
  throw "Unknown operator: " + decode_op(pn.op);
}
function convertTOK_UNARYOP(pn) {
  let ast = shellNode(pn, "UnaryExpression");
  ast.operand = parseToAst(pn.kids[0]);
  switch (pn.op) {
  case JSOP_NEG:                 ast.operator = "-"; break;
  case JSOP_POS:                 ast.operator = "+"; break;
  case JSOP_NOT:                 ast.operator = "!"; break;
  case JSOP_BITNOT:              ast.operator = "~"; break;
  case JSOP_TYPEOF:              ast.operator = "typeof"; break;
  case JSOP_VOID:                ast.operator = "void"; break;
  case JSOP_TYPEOFEXPR:          ast.operator = "typeof"; break;
  default:
    throw "Unknown operator: " + decode_op(pn.op);
  }
  return ast;
}
function convertTOK_INC(pn) { return convertPrePost(pn, '++'); }
function convertTOK_DEC(pn) { return convertPrePost(pn, '--'); }
function convertPrePost(pn, op) {
  let ast = shellNode(pn, "UnaryExpression");
  ast.operator = op;
  ast.operand = parseToAst(pn.kids[0]);
  switch (pn.op) {
  case JSOP_INCNAME:
  case JSOP_INCPROP:
  case JSOP_INCELEM:
  case JSOP_DECNAME:
  case JSOP_DECPROP:
  case JSOP_DECELEM:
    /*ast.type = "PrefixExpression";*/ break;
  case JSOP_NAMEINC:
  case JSOP_PROPINC:
  case JSOP_ELEMINC:
  case JSOP_NAMEDEC:
  case JSOP_PROPDEC:
  case JSOP_ELEMDEC:
    ast.type = "PostfixExpression"; break;
  default:
    throw "Unknown operator: " + decode_op(pn.op);
  }
  return ast;
}

function convertTOK_DOT(pn) {
  let ast = shellNode(pn, "MemberExpression");
  ast.container = parseToAst(pn.kids[0]);
  ast.member = shellNode(pn, "Literal");
  ast.member.objtype = "string";
  ast.member.value = pn.atom;
  ast.constmember = pn.atom;
  return ast;
}

function convertTOK_LB(pn) {
  let ast = shellNode(pn, "MemberExpression");
  ast.container = parseToAst(pn.kids[0]);
  ast.member = parseToAst(pn.kids[1]);
  return ast;
}

function convertTOK_RB(pn) {
  let ast = shellNode(pn, "ArrayLiteral");
  ast.members = [parseToAst(x) for each (x in pn.kids)];
  return ast;
}

/* Returns a list */
function convertTOK_LC(pn) {
  let ast = shellNode(pn, "BlockStatement");
  ast.statements = [parseToAst(x) for each (x in pn.kids)];
  if (ast.statements.length == 0) {
    return shellNode(pn, "EmptyStatement");
  }
  return ast;
}

function convertTOK_RC(pn) {
  let ast = shellNode(pn, "ObjectLiteral");
  ast.setters = [parseToAst(x) for each (x in pn.kids)];
  return ast;
}

function convertTOK_LP(pn) {
  let ast = shellNode(pn, "CallExpression");
  ast.func = parseToAst(pn.kids[0]);
  ast.arguments = [];
  for (let i = 1; i < pn.kids.length; i++)
    ast.arguments[i - 1] = parseToAst(pn.kids[i]);
  return ast;
}

function convertTOK_RP(pn) {
  let ast = shellNode(pn, "UnaryExpression");
  ast.expr = parseToAst(pn.kids[0]);
  ast.operator = "()";
  return ast;
}

function convertTOK_NAME(pn) {
  let ast = shellNode(pn, "IdentifierExpression");
  ast.name = pn.atom;
  if (pn.kids.length > 0 && pn.kids[0]) {
    ast.initializer = parseToAst(pn.kids[0]);
  }
  return ast;
}


function convertTOK_NUMBER(pn) {
  let ast = shellNode(pn, "LiteralExpression");
  ast.objtype = "number";
  ast.value = pn.value;
  return ast;
}

function convertTOK_STRING(pn) {
  let ast = shellNode(pn, "LiteralExpression");
  ast.objtype = "string";
  ast.value = pn.atom;
  return ast;
}

function convertTOK_REGEXP(pn) {
  let ast = shellNode(pn, "LiteralExpression");
  ast.objtype = "regex";
  ast.value = pn.value;
  return ast;
}

function convertTOK_PRIMARY(pn) {
  let ast = shellNode(pn, "LiteralExpression");
  switch (pn.op) {
  case JSOP_ZERO: ast.objtype = "number"; ast.value = 0; break;
  case JSOP_ONE: ast.objtype = "number"; ast.value = 1; break;
  case JSOP_NULL: ast.objtype = "null"; ast.value = null; break;
  case JSOP_FALSE: ast.objtype = "boolean"; ast.value = false; break;
  case JSOP_TRUE: ast.objtype = "boolean"; ast.value = true; break;
  case JSOP_THIS:
    return shellNode(pn, "ThisExpression");
  default:
    throw "Unknown operand: " + decode_op(pn.op);
  }
  return ast;
}

function convertTOK_FUNCTION(pn) {
  let ast = shellNode(pn, "FunctionDeclaration");
  ast.name = pn.name;
  if (pn.kids[0].type == TOK_UPVARS)
    pn = pn.kids[0];
  let args = [];
  if (pn.kids[0].type == TOK_ARGSBODY) {
    pn = pn.kids[0];
    while (pn.kids.length > 1) {
      let argNode = parseToAst(pn.kids.shift());
      argNode.type = "Parameter";
      args.push(argNode);
    }
  }
  ast.arguments = args;
  ast.body = parseToAst(pn.kids[0]);
  return ast;
}

function convertTOK_IF(pn) {
  let ast = shellNode(pn, "IfStatement");
  ast.cond = parseToAst(pn.kids[0]);
  ast.body = parseToAst(pn.kids[1]);
  if (pn.kids[1])
    ast.elsebody = parseToAst(pn.kids[2]);
  return ast;
}


function convertTOK_SWITCH(pn) {
  let ast = shellNode(pn, "SwitchStatement");
  ast.expr = parseToAst(pn.kids[0]);
  let rhs = parseToAst(pn.kids[1]);
  if (rhs instanceof Array)
    ast.cases = rhs;
  else
    throw "What if this isn't an array?";
  return ast;
}

function convertTOK_CASE(pn) {
  let ast = shellNode(pn, "SwitchCase");
  ast.expr = parseToAst(pn.kids[0]);
  ast.block = parseToAst(pn.kids[1]);
  return ast;
}
function convertTOK_DEFAULT(pn) {
  let ast = shellNode(pn, "SwitchCase");
  ast.block = parseToAst(pn.kids[1]);
  return ast;
}

function convertTOK_WHILE(pn) {
  let ast = shellNode(pn, "WhileStatement");
  ast.cond = parseToAst(pn.kids[0]);
  ast.body = parseToAst(pn.kids[1]);
  return ast;
}
function convertTOK_DO(pn) {
  let ast = shellNode(pn, "DoWhileStatement");
  ast.body = parseToAst(pn.kids[0]);
  ast.cond = parseToAst(pn.kids[1]);
  return ast;
}

function convertTOK_FOR(pn) {
  let ast = shellNode(pn, "ForStatement");
  let expr = parseToAst(pn.kids[0]);
  if (expr.type == "Forehead") {
    ast.init = expr.init;
    ast.condition = expr.condition;
    ast.increment = expr.increment;
  } else {
    ast.type = "ForInStatement";
    ast.itervar = expr.lhs;
    ast.iterrange = expr.rhs;
    ast.itertype = (pn.iflags & 0x2 ? "foreach" : "for");
  }
  ast.body = parseToAst(pn.kids[1]);
  return ast;
}

function convertTOK_BREAK(pn) {
  let ast = shellNode(pn, "BreakStatement");
  if (pn.atom)
    ast.label = pn.atom;
  return ast;
}
function convertTOK_CONTINUE(pn) {
  let ast = shellNode(pn, "ContinueStatement");
  if (pn.atom)
    ast.label = pn.atom;
  return ast;
}

function convertTOK_IN(pn) { return binaryNode(pn, "in"); }

function convertTOK_VAR(pn) {
  let ast = shellNode(pn, "VarStatement");
  if (pn.op == JSOP_DEFCONST)
    ast.constant = true;
  ast.variables = [parseToAst(x) for each (x in pn.kids)];
  for each (let x in ast.variables) {
    x.type = "VarDeclaration";
  }
  return ast;
}

function convertTOK_WITH(pn) {
  let ast = shellNode(pn, "WithStatement");
  ast.expr = parseToAst(pn.kids[0]);
  ast.block = parseToAst(pn.kids[1]);
  return ast;
}

function convertTOK_RETURN(pn) {
  let ast = shellNode(pn, "ReturnStatement");
  ast.expr = parseToAst(pn.kids[0]);
  return ast;
}

function convertTOK_NEW(pn) {
  let ast = shellNode(pn, "NewExpression");
  ast.constructor = parseToAst(pn.kids[0]);
  ast.args = [];
  for (let i = 1; i < pn.kids.length; i++)
    ast.args.push(parseToAst(pn.kids[i]));
  return ast;
}

function convertTOK_DELETE(pn) {
  let ast = shellNode(pn, "UnaryExpression");
  ast.operator = "delete";
  ast.operand = parseToAst(pn.kids[0]);
  return ast;
}

function convertTOK_DEFSHARP(pn) {
  let ast = shellNode(pn, "SharpDefinitionExpression");
  ast.expr = parseToAst(pn.kids[0]);
  ast.sharpnum = pn.number;
  return ast;
}
function convertTOK_USESHARP(pn) {
  let ast = shellNode(pn, "SharpExpression");
  ast.sharpnum = pn.number;
  return ast;
}

function convertTOK_TRY(pn) {
  let ast = shellNode(pn, "TryStatement");
  ast.body = parseToAst(pn.kids[0]);
  if (pn.kids[1])
    ast.catchers = parseToAst(pn.kids[1]);
  else
    ast.catchers = [];
  if (pn.kids[2])
    ast.fin = parseToAst(pn.kids[2]);
  return ast;
}

function convertTOK_CATCH(pn) {
  let ast = shellNode(pn, "CatchStatement");
  ast.variable = parseToAst(pn.kids[0]);
  if (pn.kids[1])
    ast.condition = parseToAst(pn.kids[1]);
  ast.block = parseToAst(pn.kids[2]);
  return ast;
}

function convertTOK_THROW(pn) {
  let ast = shellNode(pn, "ThrowStatement");
  ast.expr = parseToAst(pn.kids[0]);
  return ast;
}

function convertTOK_INSTANCEOF(pn) { return binaryNode(pn, "instanceof"); }

function convertTOK_DEBUGGER(pn) { return shellNode(pn, "DebuggerStatement"); }
// XML OPS

function convertTOK_YIELD(pn) {
  let ast = shellNode(pn, "YieldStatement");
  ast.expr = parseToAst(pn.kids[0]);
  return ast;
}

function convertTOK_ARRAYCOMP(pn) {
  let ast = parseToAst(pn.kids[0]);
  ast.type = "ArrayComprehensionExpression";
  if ("expr" in ast.body)
    ast.element = ast.body.expr;
  else {
    ast.element = ast.body.body.expr;
    ast.iterif = ast.body.cond;
  }
  delete ast.body;
  return ast;
}

function convertTOK_ARRAYPUSH(pn) {
  let ast = shellNode(pn, "ArrayPush");
  ast.expr = parseToAst(pn.kids[0]);
  return ast;
}

function convertTOK_LEXICALSCOPE(pn) {
  return parseToAst(pn.kids[0]);
}

function convertTOK_LET(pn) {
  let ast = convertTOK_VAR(pn);
  ast.type = "LetStatement";
  return ast;
}

function convertTOK_FORHEAD(pn) {
  let ast = shellNode(pn, "Forehead");
  ast.init = pn.kids[0] ? parseToAst(pn.kids[0]) :
    shellNode(pn, "EmptyStatement");
  ast.condition = pn.kids[1] ? parseToAst(pn.kids[1]) :
    shellNode(pn, "EmptyStatement");
  ast.increment = pn.kids[2] ? parseToAst(pn.kids[2]) :
    shellNode(pn, "EmptyStatement");
  return ast;
}

function convertTOK_RESERVED(pn) {
  return [parseToAst(x) for each (x in pn.kids)];
}
