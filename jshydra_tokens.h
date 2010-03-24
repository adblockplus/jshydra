TOK(TOK_EOF, NULLARY)
TOK(TOK_EOL, ERROR) /* (not present) */
TOK(TOK_SEMI, UNARY)
TOK(TOK_COMMA, LIST)
TOK(TOK_ASSIGN, BINARY)
TOK(TOK_HOOK, TERNARY)
TOK(TOK_COLON, NAME)
TOK(TOK_OR, BINARY)
TOK(TOK_AND, BINARY)
TOK(TOK_BITOR, BINARY)
TOK(TOK_BITXOR, BINARY)
TOK(TOK_BITAND, BINARY)
TOK(TOK_EQOP, BINARY)
TOK(TOK_RELOP, BINARY)
TOK(TOK_SHOP, BINARY)
TOK(TOK_PLUS, BINARY)
TOK(TOK_MINUS, BINARY)
TOK(TOK_STAR, BINARY)
TOK(TOK_DIVOP, BINARY)
TOK(TOK_UNARYOP, UNARY)
TOK(TOK_INC, UNARY)
TOK(TOK_DEC, UNARY)
TOK(TOK_DOT, NAME)
TOK(TOK_LB, BINARY)
TOK(TOK_RB, LIST)
TOK(TOK_LC, LIST)
TOK(TOK_RC, LIST)
TOK(TOK_LP, LIST)
TOK(TOK_RP, UNARY)
TOK(TOK_NAME, NAME)
TOK(TOK_NUMBER, DOUBLELITERAL)
TOK(TOK_STRING, NAME)
TOK(TOK_REGEXP, OBJLITERAL)
TOK(TOK_PRIMARY, NULLARY)
TOK(TOK_FUNCTION, FUNCTION)
TOK(TOK_IF, TERNARY)
TOK(TOK_ELSE, ERROR) /* (not present) */
TOK(TOK_SWITCH, BINARY)
TOK(TOK_CASE, BINARY)
TOK(TOK_DEFAULT, BINARY)
TOK(TOK_WHILE, BINARY)
TOK(TOK_DO, BINARY)
TOK(TOK_FOR, BINARY)
TOK(TOK_BREAK, NAME)
TOK(TOK_CONTINUE, NAME)
TOK(TOK_IN, BINARY)
TOK(TOK_VAR, LIST)
TOK(TOK_WITH, BINARY)
TOK(TOK_RETURN, UNARY)
TOK(TOK_NEW, LIST)
TOK(TOK_DELETE, UNARY)
TOK(TOK_DEFSHARP, UNARY)
TOK(TOK_USESHARP, NULLARY)
TOK(TOK_TRY, TERNARY)
TOK(TOK_CATCH, TERNARY)
TOK(TOK_FINALLY, ERROR) /* (not present) */
TOK(TOK_THROW, UNARY)
TOK(TOK_INSTANCEOF, BINARY)
TOK(TOK_DEBUGGER, NULLARY)
// We don't support E4X yet.
TOK(TOK_XMLSTAGO, ERROR)
TOK(TOK_XMLETAGO, ERROR)
TOK(TOK_XMLPTAGC, ERROR)
TOK(TOK_XMLTAGC, ERROR)
TOK(TOK_XMLNAME, ERROR)
TOK(TOK_XMLATTR, ERROR)
TOK(TOK_XMLSPACE, ERROR)
TOK(TOK_XMLTEXT, NAME)
TOK(TOK_XMLCOMMENT, ERROR)
TOK(TOK_XMLCDATA, ERROR)
TOK(TOK_XMLPI, ERROR)
TOK(TOK_AT, ERROR)
TOK(TOK_DBLCOLON, ERROR)
TOK(TOK_ANYNAME, ERROR)
TOK(TOK_DBLDOT, NAME)
TOK(TOK_FILTER, ERROR)
TOK(TOK_XMLELEM, LIST)
TOK(TOK_XMLLIST, ERROR)
TOK(TOK_YIELD, UNARY)
TOK(TOK_ARRAYCOMP, LIST)
TOK(TOK_ARRAYPUSH, UNARY)
TOK(TOK_LEXICALSCOPE, LEXICAL) // XXX: I don't think this is right?
TOK(TOK_LET, LIST)
TOK(TOK_SEQ, ERROR) /* (not present) */
TOK(TOK_FORHEAD, TERNARY)
TOK(TOK_ARGSBODY, LIST)
TOK(TOK_UPVARS,	NAMESET)
TOK(TOK_RESERVED, LIST) /*[I don't understand this...]*/
