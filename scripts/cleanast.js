/**
 * A brief description of some nodes.
 *
 * Scope block information:
 *  variables (Variable[]): a list of variables declared in the block
 *  functions (Function[]): a list of functions declared in the block
 *  constants (Variable[]): a list of constants declared in the block
 *  code (Statement[]): a list of statements in the block
 */

/**
 * Takes the node rooted at the AST and decomposes it into readable sections.
 */
function clean_ast(ast) {
	// TOK_LC
	assert(ast.type == 25);
	let info = {
		variables: [],
		functions: [],
		constants: [],
		code: []
	};
	for each (let statement in ast.kids) {
		if (statement.op == JSOP_DEFVAR) {
			info.variables = info.variables.concat(make_variables(statement));
		} else if (statement.op == JSOP_DEFCONST) {
			info.constants = info.constants.concat(make_variables(statement));
		} else if (statement.type == 34) { // TOK_FUNCTION
			info.functions.push(make_function(statement));
		} else {
			info.code.push(statement);
		}
	}
	return info;
}

function make_variables(var_root) {
	assert(var_root.op == JSOP_DEFVAR || var_root.op == JSOP_DEFCONST);
	let variables = [];
	for each (let name in var_root.kids) {
		let v = { name: name.atom };
		v.init = (name.kids.length > 0 ? name.kids[0] : null);
		v.loc = get_location(var_root);
		variables.push(v);
	}
	return variables;
}

function make_function(func_root) {
	assert(func_root.type == 34); // TOK_FUNCTION
	let stmts = func_root.kids[0];
	assert(stmts.type == 25); // TOK_LC
	return { name: func_root.name, body: stmts, loc: get_location(func_root)};
}

function assert(cmd) {
	if (!cmd) {
		_print("ACK! I fail!");
	}
}

function get_location(ast_node) {
	return { line: ast_node.line, column: ast_node.column };
}
