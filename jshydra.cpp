#include "jsapi.h"
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
	FUNCTION, LIST, TERNARY, BINARY, UNARY, NAME, LEXICAL, APAIR, OBJLITERAL, DOUBLELITERAL, NULLARY, ERROR
} TokenValue;

TokenValue tokens[] = {
    NULLARY, /*TOK_EOF*/
    ERROR, /*TOK_EOL*/
    UNARY, /*TOK_SEMI*/
    LIST, /*TOK_COMMA*/
    BINARY, /*TOK_ASSIGN*/
    BINARY, /*TOK_HOOK*/
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
    NAME, /*TOK_REGEXP*/
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
    ERROR, /*TOK_DELETE*/
    UNARY, /*TOK_DEFSHARP*/
    NULLARY, /*TOK_USESHARP (use pn_num)*/
    TERNARY, /*TOK_TRY*/
    TERNARY, /*TOK_CATCH*/
    ERROR, /*TOK_FINALLY*/
    UNARY, /*TOK_THROW*/
    ERROR, /*TOK_INSTANCEOF*/
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
    NAME, /*TOK_LEXICALSCOPE*/
    LIST, /*TOK_LET*/
    ERROR, /*TOK_SEQ*/
    TERNARY, /*TOK_FORHEAD*/
    LIST, /*TOK_RESERVED [I don't understand this...] */
    //TOK_LIMIT
	ERROR
};

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
	switch (tokens[node->pn_type]) {
	case FUNCTION: {
		setIntProperty(object, "flags", node->pn_flags);
		JSFunction *func = (JSFunction *) node->pn_funpob->object;
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
		for (node = node->pn_head; node; node = node->pn_next) {
			setArrayElement(array, i++, makeNode(node));
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
		JSObject *array = JS_NewArrayObject(cx, 0, NULL);
		setArrayElement(array, 0, makeNode(node->pn_expr));
		setObjectProperty(object, "kids", array);
		break;
	}
	//case LEXICAL:
	//case APAIR:
	//case OBJLITERAL:
	case DOUBLELITERAL:
		jshydra_defineProperty(cx, object, "value", DOUBLE_TO_JSVAL(&node->pn_dval));
		break;
	case NULLARY:
		break;
	case ERROR:
	default:
		fprintf(stderr, "Unexpected type: %d (arity %d)\n", node->pn_type, node->pn_arity);
		break;
	}
	JS_LeaveLocalRootScope(cx);
	return object;
}

void parseFile(FILE *file, char *filename) {
	JSParseContext pc;
	if (!js_InitParseContext(cx, &pc, NULL, NULL, NULL, 0, file, filename, 1))
		return;
	JSParseNode *root = js_ParseScript(cx, globalObj, &pc);
	JSObject *ast = makeNode(root);
	jsval func = jshydra_getToplevelFunction(cx, "process_js");
	if (JS_TypeOfValue(cx, func) != JSTYPE_FUNCTION) {
		fprintf(stderr, "No function process_js!\n");
  		JS_LeaveLocalRootScope(cx);
		return;
	}
	jsval rval, argv[1];
	argv[0] = OBJECT_TO_JSVAL(ast);
	JS_CallFunctionValue(cx, globalObj, func, 1, argv, &rval);
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
	do {
		argc--;
		argv++;
		FILE *input = fopen(argv[0], "r");
		if (!input) {
			fprintf(stderr, "No such file %s\n", argv[0]);
			continue;
		}
		parseFile(input, argv[0]);
	} while (argc > 1);

	return 0;
}
