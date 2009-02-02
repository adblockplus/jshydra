// This is a simple test to test global magic

include("../scripts/cleanast.js");

var glob = this;
const LS = "foobar";

function process_js(ast) {
	let toplevel = clean_ast(ast);
	_print(uneval(toplevel));
}
