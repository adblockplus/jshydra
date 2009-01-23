/* -*- Mode: C; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
#ifndef JSHYDRA_BRIDGE_H
#define JSHYDRA_BRIDGE_H

extern JSContext *cx;
extern JSObject *globalObj;

extern JSClass js_node_class;

void jshydra_init(const char *file);
FILE *jshydra_searchPath(JSContext *cx, const char *filename, char **realname);
void jshydra_appendToPath (JSContext *cx, const char *dir);
int jshydra_includeScript(JSContext *cx, const char *filename);

/* Drop-in replacement for JS_DefineObject, required as a workaround
 * because JS_DefineObject always sets the parent property. */
JSObject *definePropertyObject (JSContext *cx, JSObject *obj,
                               const char *name, JSClass *clasp,
                               JSObject *proto, uintN flags);
JSObject *jshydra_defineArrayProperty (JSContext *cx, JSObject *obj,
                                       char const *name, int length);
JSObject *jshydra_defineObjectProperty (JSContext *cx, JSObject *obj,
                                        char const *name);
void jshydra_defineProperty(JSContext *cx, JSObject *obj,
                            char const *name, jsval value);

jsuint jshydra_getArrayLength(JSContext *cx, JSObject *array);
jsval jshydra_getToplevelFunction(JSContext *cx, char const *name);

#endif
