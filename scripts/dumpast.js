/**
 * Dumps the tree of the ast rooted at the given point.
 */
function dump_ast(ast, prefix) {
	if (ast == null)
		return;
	if (!prefix)
		prefix = "";
	let str = prefix + "+ ";
	for (let key in ast) {
		if (key == 'column' || key == 'line' || key == 'kids')
			continue;
		let val = (key == 'op' ? decode_op(ast[key]) : ast[key]);
		str += key + ": " + val + "; ";
	}
	str += ast.line + ":" + ast.column;
	_print(str);
	prefix += " ";
	for each (let kid in ast.kids) {
		dump_ast(kid, prefix);
	}
}

var global = this;
var table = null;
function decode_op(opcode) {
	if (!table) {
		table = [];
		for (let key in global) {
			if (key.indexOf("JSOP_") == 0) {
				table[global[key]] = key;
			}
		}
	}
	if (opcode in table)
		return table[opcode];
	return opcode;
}
