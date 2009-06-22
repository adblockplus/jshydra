#include <string.h> // Needed for jsparse.h
#include "jsapi.h"
#include "jsbit.h" // jsparse.h
#include "jsscript.h" // jsparse.h
#include "jsinterp.h" // jsparse.h
#include "jsparse.h"
#include "jscntxt.h"
#include <stdio.h>

#include "jshydra_bridge.h"

void setIntProperty(JSObject *obj, const char *name, int value) {
	jshydra_defineProperty(cx, obj, name, INT_TO_JSVAL(value));
}
void setObjectProperty(JSObject *obj, const char *name, JSObject *value) {
	jshydra_defineProperty(cx, obj, name, OBJECT_TO_JSVAL(value));
}
void setArrayElement(JSObject *array, jsint index, JSObject *value) {
	jsval argv[1];
	if (value)
		argv[0] = OBJECT_TO_JSVAL(value);
	else
		argv[0] = JSVAL_NULL;
	JS_SetElement(cx, array, index, argv);
}

typedef enum TokenValue {
	FUNCTION, LIST, TERNARY, BINARY, UNARY, NAME, LEXICAL, APAIR, OBJLITERAL, DOUBLELITERAL, NULLARY, NAMESET, ERROR
} TokenValue;

TokenValue tokens[] = {
    NULLARY, /*TOK_EOF*/
    ERROR, /*TOK_EOL*/
    UNARY, /*TOK_SEMI*/
    LIST, /*TOK_COMMA*/
    BINARY, /*TOK_ASSIGN*/
    TERNARY, /*TOK_HOOK*/
	NAME, /*TOK_COLON*/
    BINARY, /*TOK_OR*/
    BINARY, /*TOK_AND*/
    BINARY, /*TOK_BITOR*/
    BINARY, /*TOK_BITXOR*/
    BINARY, /*TOK_BITAND*/
    BINARY, /*TOK_EQOP*/
    BINARY, /*TOK_RELOP*/
    BINARY, /*TOK_SHOP*/
    BINARY, /*TOK_PLUS*/
    BINARY, /*TOK_MINUS*/
    BINARY, /*TOK_STAR*/
	BINARY, /*TOK_DIVOP*/
    UNARY, /*TOK_UNARYOP*/
    UNARY, /*TOK_INC*/
	UNARY, /*TOK_DEC*/
    NAME, /*TOK_DOT*/
    BINARY, /*TOK_LB*/
	LIST, /*TOK_RB*/
    LIST, /*TOK_LC*/
	LIST, /*TOK_RC*/
    LIST, /*TOK_LP*/
	UNARY, /*TOK_RP*/
    NAME, /*TOK_NAME*/
    DOUBLELITERAL, /*TOK_NUMBER*/
    NAME, /*TOK_STRING*/
    OBJLITERAL, /*TOK_REGEXP*/
    NULLARY, /*TOK_PRIMARY*/
    FUNCTION, /*TOK_FUNCTION*/
    TERNARY, /*TOK_IF*/
    ERROR, /*TOK_ELSE (not present) */
    BINARY, /*TOK_SWITCH*/
    BINARY, /*TOK_CASE*/
    BINARY, /*TOK_DEFAULT*/
    BINARY, /*TOK_WHILE*/
    BINARY, /*TOK_DO*/
    BINARY, /*TOK_FOR*/
    NAME, /*TOK_BREAK*/
    NAME, /*TOK_CONTINUE*/
    BINARY, /*TOK_IN*/
    LIST, /*TOK_VAR*/
    BINARY, /*TOK_WITH*/
    UNARY, /*TOK_RETURN*/
    LIST, /*TOK_NEW*/
    UNARY, /*TOK_DELETE*/
    UNARY, /*TOK_DEFSHARP*/
    NULLARY, /*TOK_USESHARP (use pn_num)*/
    TERNARY, /*TOK_TRY*/
    TERNARY, /*TOK_CATCH*/
    ERROR, /*TOK_FINALLY*/
    UNARY, /*TOK_THROW*/
    BINARY, /*TOK_INSTANCEOF*/
    ERROR, /*TOK_DEBUGGER*/
    ERROR, /*TOK_XMLSTAGO*/
    ERROR, /*TOK_XMLETAGO*/
    ERROR, /*TOK_XMLPTAGC*/
    ERROR, /*TOK_XMLTAGC*/
    ERROR, /*TOK_XMLNAME*/
    ERROR, /*TOK_XMLATTR*/
    ERROR, /*TOK_XMLSPACE*/
    ERROR, /*TOK_XMLTEXT*/
    ERROR, /*TOK_XMLCOMMENT*/
    ERROR, /*TOK_XMLCDATA*/
    ERROR, /*TOK_XMLPI*/
    ERROR, /*TOK_AT*/
    ERROR, /*TOK_DBLCOLON*/
    ERROR, /*TOK_ANYNAME*/
    NAME, /*TOK_DBLDOT*/
    ERROR, /*TOK_FILTER*/
    ERROR, /*TOK_XMLELEM*/
    ERROR, /*TOK_XMLLIST*/
    ERROR, /*TOK_YIELD*/
    LIST, /*TOK_ARRAYCOMP*/
    UNARY, /*TOK_ARRAYPUSH*/
    LEXICAL, /*TOK_LEXICALSCOPE*/
    LIST, /*TOK_LET*/
    ERROR, /*TOK_SEQ*/
    TERNARY, /*TOK_FORHEAD*/
	LIST, /*TOK_ARGSBODY */
	NAMESET, /*TOK_UPVARS */
    LIST, /*TOK_RESERVED [I don't understand this...] */
    //TOK_LIMIT
	ERROR
};

TokenValue arityFix[] = {NULLARY, UNARY, BINARY, TERNARY, FUNCTION, LIST, NAME};

JSObject *makeNode(JSParseNode *node) {
	if (!node)
		return NULL;
	if (!JS_EnterLocalRootScope(cx))
		return NULL;
	JSObject *object = JS_NewObject(cx, &js_node_class, NULL, NULL);
	setIntProperty(object, "line", node->pn_pos.begin.lineno);
	setIntProperty(object, "column", node->pn_pos.begin.index);
	setIntProperty(object, "op", node->pn_op);
	setIntProperty(object, "type", node->pn_type);

	// Some of our nodes actually need the arity to work right.
	TokenValue value = tokens[node->pn_type];
	if (node->pn_type == TOK_COLON ||
      (node->pn_type >= TOK_OR && node->pn_type <= TOK_DIVOP))
		value = arityFix[node->pn_arity];

	switch (value) {
	case FUNCTION: {
		setIntProperty(object, "flags", node->pn_dflags);
		JSFunction *func = (JSFunction *) node->pn_funbox->object;
		if (func->atom)
			jshydra_defineProperty(cx, object, "name", ATOM_KEY(func->atom));

		JSObject *array = JS_NewArrayObject(cx, 0, NULL);
		setArrayElement(array, 0, makeNode(node->pn_body));
		setObjectProperty(object, "kids", array);
		break;
	}
	case LIST: {
		JSObject *array = JS_NewArrayObject(cx, 0, NULL);
		int i = 0;
		JSParseNode *element = node->pn_head;
		for (; element; element = element->pn_next) {
			setArrayElement(array, i++, makeNode(element));
		}
		setObjectProperty(object, "kids", array);
		break;
	}
	case TERNARY: {
		JSObject *array = JS_NewArrayObject(cx, 0, NULL);
		setArrayElement(array, 0, makeNode(node->pn_kid1));
		setArrayElement(array, 1, makeNode(node->pn_kid2));
		setArrayElement(array, 2, makeNode(node->pn_kid3));
		setObjectProperty(object, "kids", array);
		break;
	}
	case BINARY: {
		jshydra_defineProperty(cx, object, "value", node->pn_val);
		JSObject *array = JS_NewArrayObject(cx, 0, NULL);
		setArrayElement(array, 0, makeNode(node->pn_left));
		setArrayElement(array, 1, makeNode(node->pn_right));
		setObjectProperty(object, "kids", array);
		break;
	}
	case UNARY: {
		JSObject *array = JS_NewArrayObject(cx, 0, NULL);
		setArrayElement(array, 0, makeNode(node->pn_kid));
		setObjectProperty(object, "kids", array);
		break;
	}
	case NAME: {
		JS_DefineProperty(cx, object, "atom", ATOM_KEY(node->pn_atom), NULL, NULL, JSPROP_READONLY | JSPROP_ENUMERATE);
		setIntProperty(object, "flags", node->pn_dflags);
		JSObject *array = JS_NewArrayObject(cx, 0, NULL);
		// This is only valid for PN_NAME objects--some are not quite PN_NAME.
		if (!node->pn_used && node->pn_arity == PN_NAME)
			setArrayElement(array, 0, makeNode(node->pn_expr));
		setObjectProperty(object, "kids", array);
		break;
	}
	case NAMESET: {
		JSObject *array = JS_NewArrayObject(cx, 0, NULL);
		setArrayElement(array, 0, makeNode(node->pn_tree));
		setObjectProperty(object, "kids", array);
		break;
	}
	case LEXICAL: {
		JSObject *array = JS_NewArrayObject(cx, 0, NULL);
		setArrayElement(array, 0, makeNode(node->pn_expr));
		setObjectProperty(object, "kids", array);
		break;
	}
	//case APAIR:
	case OBJLITERAL: {
    setObjectProperty(object, "value", node->pn_objbox->object);
		JSObject *array = JS_NewArrayObject(cx, 0, NULL);
		setArrayElement(array, 0, makeNode(node->pn_expr));
		setObjectProperty(object, "kids", array);
  }
	case DOUBLELITERAL: {
		jsval dval;
		if (!JS_NewDoubleValue(cx, node->pn_dval, &dval)) {
			fprintf(stderr, "I think I ran out of memory...\n");
			return NULL;
		}
		jshydra_defineProperty(cx, object, "value", dval);
		break;
	}
	case NULLARY:
		break;
	case ERROR:
	default:
		fprintf(stderr, "Unexpected type: %d (arity %d)\n", node->pn_type, node->pn_arity);
		break;
	}
	JS_LeaveLocalRootScopeWithResult(cx, OBJECT_TO_JSVAL(object));
	return object;
}

void parseFile(FILE *file, char *filename, char *argstr) {
	JSCompiler compiler(cx, NULL, NULL);
	if (!compiler.init(NULL, 0, file, filename, 1))
		return;
	JSParseNode *root = compiler.parse(globalObj);
	JSObject *ast = makeNode(root);
	jshydra_rootObject(cx, ast);
	jsval func = jshydra_getToplevelFunction(cx, "process_js");
	if (JS_TypeOfValue(cx, func) != JSTYPE_FUNCTION) {
		fprintf(stderr, "No function process_js!\n");
		return;
	}
	jsval rval, argv[3];
	argv[0] = OBJECT_TO_JSVAL(ast);
	JSString *newfname = JS_NewStringCopyZ(cx, filename);
	argv[1] = STRING_TO_JSVAL(newfname);
	JSString *jsArgStr = JS_NewStringCopyZ(cx, argstr);
	argv[2] = STRING_TO_JSVAL(jsArgStr);
	JS_CallFunctionValue(cx, globalObj, func, 3, argv, &rval);
}

int main(int argc, char **argv) {
	if (argc < 2) {
		fprintf(stderr, "Usage: %s script filename...\n", argv[0]);
		return -1;
	}
	jshydra_init(argv[1]);
	jshydra_includeScript(cx, argv[1]);
	argc--;
	argv++;
	char *argstr = NULL;
	do {
		argc--;
		argv++;
		if (!strcmp(argv[0], "--arg")) {
			argc--;
			argv++;
			argstr = argv[0];
			continue;
		}
		FILE *input = fopen(argv[0], "r");
		if (!input) {
			fprintf(stderr, "No such file %s\n", argv[0]);
			continue;
		}
		parseFile(input, argv[0], argstr);
	} while (argc > 1);

	return 0;
}
