// This is a simple test to test global magic

include("../scripts/cleanast.js");

var glob = this;
const LS = "foobar";

function process_js(ast) {
	let toplevel = clean_ast(ast);
	_print("Global variables:");
	for each (let v in toplevel.variables) {
		_print("\t" + v.name + " at " + v.loc.line + ":" + v.loc.column);
	}
	_print("Global constants:");
	for each (let v in toplevel.constants) {
		_print("\t" + v.name + " at " + v.loc.line + ":" + v.loc.column);
		_print(uneval(v));
	}
	_print("Global functions:");
	for each (let v in toplevel.functions) {
		_print("\t" + v.name + " at " + v.loc.line + ":" + v.loc.column);
		_print(v.body.kids[0].column);
	}
}
