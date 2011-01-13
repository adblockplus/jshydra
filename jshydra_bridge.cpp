/* -*- Mode: C; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
#include "jsapi.h"
#ifndef XP_WIN
#include <unistd.h>
#endif // XP_WIN
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "jshydra_bridge.h"
#include "jshydra_funcs.h"

static const char *opcodes[] = {
#define OPDEF(op, val, name, image, len, use, def, prec, format) \
	#op,
#include "jsopcode.tbl"
#undef OPDEF
	NULL
};

static const char *tokens[] = {
#define TOK(name, value) #name,
#include "jshydra_tokens.h"
#undef TOK
	NULL
};

JSRuntime *rt;
JSContext *cx;
JSObject *globalObj;

JSObject *rootArray;

static JSClass global_class = {
    "global", JSCLASS_GLOBAL_FLAGS,
    JS_PropertyStub, JS_PropertyStub, JS_PropertyStub, JS_PropertyStub,
    JS_EnumerateStub, JS_ResolveStub, JS_ConvertStub, JS_FinalizeStub,
    JSCLASS_NO_OPTIONAL_MEMBERS

};

static char *my_dirname (char *path);

JSClass js_node_class = {
  "JSHydraNode",  /* name */
  JSCLASS_CONSTRUCT_PROTOTYPE, /* flags */
  JS_PropertyStub, JS_PropertyStub, JS_PropertyStub, JS_PropertyStub,
  JS_EnumerateStub,JS_ResolveStub, JS_ConvertStub, JS_FinalizeStub,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
};

extern JSObject *js_InitReflectClass(JSContext *cx, JSObject *obj);

void jshydra_init(const char *file) {
  static JSFunctionSpec shell_functions[] = {
    JS_FN("_print",          Print,          0,     0),
    JS_FN("include",         Include,        1,     0),
    JS_FN("write_file",      WriteFile,      1,     0),
    JS_FN("read_file",       ReadFile,       1,     0),
    JS_FN("diagnostic",      Diagnostic,     0,     0),
    JS_FN("require",         Require,        1,     0),
    JS_FN("hashcode",        Hashcode,       1,     0),
    {0}
  };

  //this->fndeclMap = pointer_map_create ();
  rt = JS_NewRuntime (0x9000000L);
  cx = JS_NewContext (rt, 8192);
  JS_BeginRequest(cx);
  JS_SetVersion(cx, JSVERSION_LATEST);
  //JS_SetGCZeal(cx, 2);

  //JS_SetContextPrivate (this->cx, this);
  
  globalObj = JS_NewCompartmentAndGlobalObject(cx, &global_class, NULL);
  JS_EnterCrossCompartmentCall(cx, globalObj);
  JS_InitStandardClasses (cx, globalObj);
  js_InitReflectClass(cx, globalObj);
  /* register error handler */
  JS_SetErrorReporter (cx, ErrorReporter);
  xassert (JS_DefineFunctions (cx, globalObj, shell_functions));
  if (jshydra_getToplevelFunction(cx, "include") == JSVAL_VOID) {
    fprintf (stderr, "Your version of spidermonkey has broken JS_DefineFunctions, upgrade it or ./configure with another version\n");
    exit(1);
  }
  //this->rootedArgDestArray = 
  //  JS_NewArrayObject (this->cx, 0, NULL);
  //JS_AddRoot (this->cx, &this->rootedArgDestArray);
  // this is to be added at function_decl time
  //this->rootedFreeArray = JS_NewArrayObject (this->cx, 0, NULL);
  //JS_DefineElement (this->cx, this->rootedArgDestArray, 0,
   //                 OBJECT_TO_JSVAL (this->rootedFreeArray),
  //                  NULL, NULL, JSPROP_ENUMERATE);
  JS_SetVersion (cx, (JSVersion) 170);


  /* Initialize namespace for plugin system stuff. */
  JSObject *sys = jshydra_defineObjectProperty(cx, globalObj, "sys");
  /* Set version info */
  //dehydra_defineStringProperty (this, sys, VERSION_STRING, version_string);
  //dehydra_defineStringProperty (this, sys, FRONTEND, lang_hooks.name);
  /* Initialize include path. */
  jshydra_defineArrayProperty (cx, sys, "include_path", 0);

  char *filename_copy = strdup(file);
  char *dir = my_dirname(filename_copy);
  jshydra_appendToPath(cx, dir);
  char *libdir = static_cast<char *>(malloc(strlen(dir) + strlen("libs") + 2));
  sprintf(libdir, "%s/%s", dir, "libs");
  jshydra_appendToPath(cx, libdir);
  free(libdir);
  free(filename_copy);

  /* Output filename info */
  //if (aux_base_name) {
  //  dehydra_defineStringProperty (this, sys, "aux_base_name", aux_base_name);
  //}
  xassert (JS_InitClass(cx, globalObj, NULL
                        ,&js_node_class , NULL, 0, NULL, NULL, NULL, NULL));

  /* Define the token properties. */
  const char **name = opcodes;
  jsint index = 0;
  while (*name) {
	  jshydra_defineProperty(cx, globalObj, *name++, INT_TO_JSVAL(index++));
  }
  index = 0;
  name = tokens;
  while (*name)
	  jshydra_defineProperty(cx, globalObj, *name++, INT_TO_JSVAL(index++));

  rootArray = JS_NewArrayObject(cx, 0, NULL);
  JS_AddObjectRoot(cx, &rootArray);
  jshydra_rootObject(cx, globalObj);
}

/*int dehydra_startup (Dehydra *this) {
  return dehydra_includeScript (this, "dehydra.js");
}*/

int jshydra_includeScript (JSContext *cx, const char *script) {
  jsval strval = STRING_TO_JSVAL(JS_NewStringCopyZ(cx, script));
  //int key = dehydra_rootObject (this, strval);
  if (!JS_EnterLocalRootScope(cx))
	  return -1;
  jsval rval;

  int ret = !JS_CallFunctionName(cx, globalObj, "include", 1, &strval, &rval);
  JS_LeaveLocalRootScope(cx);
  return ret;
}

JSObject *jshydra_getIncludePath (JSContext *cx)
{
  jsval sys_val, path_val;
  JS_GetProperty(cx, globalObj, "sys", &sys_val);
  JS_GetProperty(cx, JSVAL_TO_OBJECT(sys_val), "include_path", &path_val);
  return JSVAL_TO_OBJECT(path_val);
}

/* Append a directory name to the script include path. */
void jshydra_appendToPath (JSContext *cx, const char *dir) 
{
  JSObject *path = jshydra_getIncludePath(cx);
  unsigned int length = jshydra_getArrayLength(cx, path);
  JSString *dir_str = JS_NewStringCopyZ(cx, dir);
  jsval dir_val = STRING_TO_JSVAL(dir_str);
  JS_DefineElement(cx, path, length, dir_val, NULL, NULL,
                   JSPROP_ENUMERATE);
}

/* Avoiding bug 431100. Spec from man 2 dirname */
static char *my_dirname (char *path) {
  char *r = strrchr(path, '/');
  if (!r) {
    strcpy (path, ".");
    return path;
  } else if (r == path && r[1] == 0) {
    return path; // '/'
  } else if (r[1] == 0) {
    // /foo/ foo/ cases
    *r = 0;
    return my_dirname (path);
  }
  *r = 0;
  return path;
}

/* Search the include path for a file matching the given name. The current
 * directory will be searched last. */
FILE *jshydra_searchPath (JSContext *cx, const char *filename, char **realname)
{
  if (filename && filename[0] != '/') {
    JSObject *path = jshydra_getIncludePath(cx);
    int length = jshydra_getArrayLength(cx, path);
    int i;
    for (i = 0; i < length; ++i) {
      jsval val;
      JS_GetElement(cx, path, i, &val);

      JSString *dir_str = JS_ValueToString(cx, val);
      if (!dir_str) continue;
      char *dir = JS_EncodeString(cx, dir_str);

      char *buf = static_cast<char *>(malloc(strlen(dir) + strlen(filename) + 2));
      /* Doing a little extra work here to get rid of unneeded '/'. */
      const char *sep = dir[strlen(dir)-1] == '/' ? "" : "/";
      sprintf(buf, "%s%s%s", dir, sep, filename);
	  JS_free(cx, dir);
      FILE *f = fopen(buf, "r");
      if (f) {
        *realname = buf;
        return f;
      } else {
        free(buf);
      }
    }
  }
  
  FILE *f = fopen(filename, "r");
  if (f) {
    *realname = strdup(filename);
    return f;
  }

  return NULL;
}

jsuint jshydra_getArrayLength (JSContext *cx, JSObject *array) {
  jsuint length = 0;
  xassert (JS_GetArrayLength (cx, array, &length));
  return length;
}

JSObject *definePropertyObject (JSContext *cx, JSObject *obj,
                                const char *name, JSClass *clasp,
                                JSObject *proto, uintN flags) {
  JSObject *nobj = JS_NewObject (cx, clasp, proto, NULL);
  JS_DefineProperty (cx, obj, name, OBJECT_TO_JSVAL(nobj), NULL, NULL, flags);
  return nobj;
}

void jshydra_defineProperty (JSContext *cx, JSObject *obj,
                             char const *name, jsval value)
{
  JS_DefineProperty (cx, obj, name, value,
                     NULL, NULL, JSPROP_ENUMERATE);
}
/*
void dehydra_defineStringProperty (Dehydra *this, JSObject *obj,
                                   char const *name, char const *value)
{
  JSString *str = JS_NewStringCopyZ (this->cx, value);
  dehydra_defineProperty (this, obj, name, STRING_TO_JSVAL(str));
}
*/
JSObject *jshydra_defineArrayProperty (JSContext *cx, JSObject *obj,
                                       char const *name, int length) {
  JSObject *destArray = JS_NewArrayObject (cx, length, NULL);
  jshydra_defineProperty (cx, obj, name, OBJECT_TO_JSVAL (destArray));
  return destArray;  
}

JSObject *jshydra_defineObjectProperty (JSContext *cx, JSObject *obj,
                                       char const *name) {
  return definePropertyObject(
      cx, obj, name, NULL, NULL,
      JSPROP_ENUMERATE | JSPROP_READONLY | JSPROP_PERMANENT);
}

/* Load and execute a Javascript file. 
 * Return:    0 on success
 *            1 on failure if a Javascript exception is pending
 *            does not return if a Javascript error is reported
 * The general behavior of (De|Tree)hydra is to print a message and
 * exit if a JS error is reported at the top level. But if this function
 * is called from JS, then the JS_* functions will instead set an
 * exception, which will be propgated back up to the callers for
 * eventual handling or exit. */

jsval jshydra_getToplevelFunction(JSContext *cx, char const *name) {
  jsval val = JSVAL_VOID;
  return (JS_GetProperty(cx, globalObj, name, &val)
          && val != JSVAL_VOID
          && JS_TypeOfValue(cx, val) == JSTYPE_FUNCTION) ? val : JSVAL_VOID;
}

void jshydra_rootObject(JSContext *cx, JSObject *obj) {
  jsval rval, argv[1];
  argv[0] = OBJECT_TO_JSVAL(obj);
  JS_CallFunctionName(cx, rootArray, "push", 1, argv, &rval);
}

JSObject *jshydra_getRegexPrototype(JSContext *cx) {
  static JSObject *proto = NULL;
  if (proto == NULL) {
    char str[1];
    JSObject *regex = JS_NewRegExpObjectNoStatics(cx, str, 0, 0);
    proto = JS_GetPrototype(cx, regex);
  }
  return proto;
}
