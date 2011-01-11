/* -*- Mode: C; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
#include <string.h>
#include <errno.h>
#include <stdarg.h>
#include <stdlib.h>

#include "jsapi.h"
#include "jsprf.h"
#include "jshydra_funcs.h"
#include "jshydra_bridge.h"

JSBool require_version(JSContext *cx, jsval val) {
  JSString *version_str = JS_ValueToString(cx, val);
  if (!version_str) return JS_FALSE;
  char *version_cstr = JS_EncodeString(cx, version_str);
  JSVersion version = JS_StringToVersion(version_cstr);
  JSBool retval;
  if (version == JSVERSION_UNKNOWN) {
    JS_ReportError(cx, "Invalid version '%s'", version_cstr);
    retval = JS_FALSE;
  } else {
    JS_SetVersion(cx, version);
    retval = JS_TRUE;
  }
  JS_free(cx, version_cstr);
  return retval;
}

JSBool require_option(JSContext *cx, jsval val, uint32 option) {
  JSBool flag;
  if (!JS_ValueToBoolean(cx, val, &flag)) return JS_FALSE;
  if (flag) {
    JS_SetOptions(cx, JS_GetOptions(cx) | option);
  } else {
    JS_SetOptions(cx, JS_GetOptions(cx) & ~option);
  }
  return JS_TRUE;
}

JSBool dispatch_require(JSContext *cx, const char *prop_name, jsval prop_val) {
  if (strcmp(prop_name, "version") == 0) {
    return require_version(cx, prop_val);
  } else if (strcmp(prop_name, "strict") == 0) {
    return require_option(cx, prop_val, JSOPTION_STRICT);
  } else if (strcmp(prop_name, "werror") == 0) {
    return require_option(cx, prop_val, JSOPTION_WERROR);
  } else if (strcmp(prop_name, "gczeal") == 0) {
#ifdef JS_GC_ZEAL
    uintN zeal;
    if (!JS_ValueToECMAUint32(cx, prop_val, &zeal))
        return JS_FALSE;
    JS_SetGCZeal(cx, zeal);
#else
#ifdef DEBUG
    JS_ReportWarning(cx, "gczeal not available: xhydra built with a SpiderMonkey version"
                     " lacking JS_SetGCZeal");
#else
    JS_ReportWarning(cx, "gczeal not available: xhydra built without -DDEBUG");
#endif //DEBUG
#endif //JS_GC_ZEAL
    return JS_TRUE;
  } else {
    JS_ReportWarning(cx, "Unrecognized require keyword '%s'", prop_name);
    return JS_TRUE;
  }
}

/* Helper to return the current version as a JS string. */
jsval get_version(JSContext *cx)
{
  const char *version_cstr = JS_VersionToString(JS_GetVersion(cx));
  if (version_cstr == NULL) {
    return JSVAL_VOID;
  }
  JSString *version_str = JS_NewStringCopyZ(cx, version_cstr);
  return STRING_TO_JSVAL(version_str);
}

JSBool Require(JSContext *cx, uintN argc, jsval *vp)
{
  JSObject *args;
  if (!JS_ConvertArguments(cx, argc, JS_ARGV(cx, vp), "o", &args)) return JS_FALSE;
  JSIdArray *prop_ids = JS_Enumerate(cx, args);
  if (!prop_ids) return JS_FALSE;

  /* Apply the options. */
  JSBool retval = JS_TRUE;
  int i;
  for (i = 0; i < prop_ids->length; ++i) {
    xassert(JS_EnterLocalRootScope(cx));
    jsval prop;
    JSBool rv = JS_IdToValue(cx, prop_ids->vector[i], &prop);
    xassert(rv);
    JSString *prop_str = JSVAL_TO_STRING(prop);
    char *prop_name = JS_EncodeString(cx, prop_str);
    xassert(prop_name);
    jsval prop_val;
    rv = JS_GetProperty(cx, args, prop_name, &prop_val);
    xassert(rv);

    rv = dispatch_require(cx, prop_name, prop_val);
    if (rv == JS_FALSE) retval = JS_FALSE;
    JS_free(cx, prop_name);
    JS_LeaveLocalRootScope(cx);
  }
  JS_DestroyIdArray(cx, prop_ids);
  if (!retval) return retval;

  /* Report the now-current options. */
  JSObject *rvalo = JS_NewObject(cx, NULL, NULL, NULL);
  if (!rvalo) return JS_FALSE;
  JS_SET_RVAL(cx, vp, OBJECT_TO_JSVAL(rvalo));
  JS_DefineProperty(
      cx, rvalo, "version", get_version(cx), NULL, NULL, JSPROP_ENUMERATE);
  uint32 options = JS_GetOptions(cx);
  JS_DefineProperty(
      cx, rvalo, "strict", 
     (options | JSOPTION_STRICT) ? JSVAL_TRUE : JSVAL_FALSE, 
      NULL, NULL, JSPROP_ENUMERATE);
  JS_DefineProperty(
      cx, rvalo, "werror", 
     (options | JSOPTION_WERROR) ? JSVAL_TRUE : JSVAL_FALSE, 
      NULL, NULL, JSPROP_ENUMERATE);
  return JS_TRUE;
}

/* Load and run the named script. The last argument is the object to use
   as "this" when evaluating the script, which is effectively a namespace
   for the script. */
static JSBool jshydra_loadScript (JSContext *cx, const char *filename, 
                                  JSObject *ns) {
  /* Read the file. There's a JS function for reading scripts, but Dehydra
     wants to search for the file in different dirs. */
  long size = 0;
  char *realname;
  FILE *f = jshydra_searchPath(cx, filename, &realname);
  if (!f) {
    REPORT_ERROR_1(cx, "Cannot find include file '%s'", filename);
    return JS_FALSE;
  }
  char *content = readEntireFile(f, &size);
  if (!content) {
    REPORT_ERROR_1(cx, "Cannot read include file '%s'", realname);
    free(realname);
    return JS_FALSE;
  }

  JSScript *script = JS_CompileScript(cx, ns,
                                      content, size, realname, 1);
  free(realname);
  if (script == NULL) {
    xassert(JS_IsExceptionPending(cx));
    return JS_FALSE;
  }

  JSObject *sobj = JS_NewScriptObject(cx, script);
  JS_AddNamedObjectRoot(cx, &sobj, filename);
  jsval rval;
  JSBool rv = JS_ExecuteScript(cx, ns, script, &rval);
  JS_RemoveObjectRoot(cx, &sobj);
  if (!rv) {
    xassert(JS_IsExceptionPending(cx));
    return JS_FALSE;
  }
  return JS_TRUE;
}

/* should use this function to load all objects to avoid possibity of objects including themselves */
JSBool Include(JSContext *cx, uintN argc, jsval *vp)
{
  jsval *argv = JS_ARGV(cx, vp);
  if (!JSVAL_IS_STRING(argv[0]))
    return JS_FALSE;

  char *filename = JS_EncodeString(cx, JSVAL_TO_STRING(argv[0]));
  xassert(filename);

  JSObject *ns = globalObj;
  if (!JS_ConvertArguments(cx, argc, argv, "*/o", &filename, &ns))
    return JS_FALSE;

  JS_SET_RVAL(cx, vp, OBJECT_TO_JSVAL(ns));
 
  JSObject *includedArray = NULL;
  jsval val;
  JS_GetProperty(cx, ns, "_includedArray", &val);
  if (!JSVAL_IS_OBJECT (val)) {
    includedArray = JS_NewArrayObject (cx, 0, NULL);
    jshydra_defineProperty (cx, ns, "_includedArray",
                            OBJECT_TO_JSVAL (includedArray));
  } else {
    includedArray = JSVAL_TO_OBJECT (val);
    xassert (JS_CallFunctionName (cx, includedArray, "lastIndexOf",
                                  1, argv, &val));
    /* Return if file was already included in this namespace. */
    if (JSVAL_TO_INT (val) != -1) return JS_TRUE;
  }

  JS_CallFunctionName (cx, includedArray, "push", 1, argv, &JS_RVAL(cx,vp));
  JSBool rv = jshydra_loadScript (cx, filename, ns);
  JS_free(cx, filename);
  return rv;
}

JSBool Diagnostic(JSContext *cx, uintN argc, jsval *vp)
{
  jsval *argv = JS_ARGV(cx, vp);
  JSBool is_error;
  const char *msg, *error_string;
  char *file;
  jsint line;
  JSObject *loc_obj = NULL;

  if (!JS_ConvertArguments(cx, argc, argv, "b*/o", &is_error, &msg, &loc_obj))
    return JS_FALSE;
  JS_SET_RVAL(cx, vp, JSVAL_VOID);
  error_string = is_error ? "error" : "warning";
  if (loc_obj) {
    jsval jsfile, jsline;
    if (JS_GetProperty(cx, loc_obj, "file", &jsfile) &&
        JS_GetProperty(cx, loc_obj, "line", &jsline)) {
      file = JS_EncodeString(cx, JSVAL_TO_STRING(jsfile));
      line = JSVAL_TO_INT(jsline);
      printf("%s:%d: %s: %s\n", file, line, error_string, msg);
      JS_free(cx, file);
      return JS_TRUE;
    }
  }

  printf("%s: %s\n", error_string, msg);
  return JS_TRUE;
}

JSBool Print(JSContext *cx, uintN argc, jsval *vp)
{
  uintN i;
  jsval *argv = JS_ARGV(cx, vp);
  for (i = 0; i < argc; i++) {
    JSString *str = JS_ValueToString(cx, argv[i]);
    if (!str)
      return JS_FALSE;
    char *c_str = JS_EncodeString(cx, str);
    printf("%s", c_str);
    JS_free(cx, c_str);
  }
  printf("\n");
  JS_SET_RVAL(cx, vp, JSVAL_VOID);
  return JS_TRUE;
}

JSBool WriteFile(JSContext *cx, uintN argc, jsval *vp)
{
  jsval *argv = JS_ARGV(cx, vp);
  JSString *str;
  if (!JS_ConvertArguments(cx, argc, argv, "*S", &str))
    return JS_FALSE;
  if (!JSVAL_IS_STRING(argv[0]))
    return JS_FALSE;

  char *filename = JS_EncodeString(cx, JSVAL_TO_STRING(argv[0]));
  xassert(filename);

  JSBool rv = JS_FALSE;
  FILE *f = fopen (filename, "w");
  if (!f) {
    REPORT_ERROR_2(cx, "write_file: error opening file '%s': %s",
                   filename, strerror(errno));
  } else {
    char *bytes = JS_EncodeString(cx, str);
    xassert(bytes);
    fwrite (bytes, 1, JS_GetStringLength(str), f);
    fclose (f);
    JS_free(cx, bytes);
    JS_SET_RVAL(cx, vp, JSVAL_VOID);
    rv = JS_TRUE;
  }
  JS_free(cx, filename);
  return rv;
}

JSBool ReadFile(JSContext *cx, uintN argc, jsval *vp)
{
  jsval *argv = JS_ARGV(cx, vp);
  if (!JSVAL_IS_STRING(argv[0]))
    return JS_FALSE;
  char *filename = JS_EncodeString(cx, JSVAL_TO_STRING(argv[0]));
  xassert(filename);
  long size = 0;
  char *buf = readFile (filename, &size);
  JSBool rv = JS_FALSE;
  if(!buf) {
    REPORT_ERROR_2(cx, "read_file: error opening file '%s': %s",
                   filename, strerror(errno));
  } else {
    JS_SET_RVAL(cx, vp, STRING_TO_JSVAL(JS_NewStringCopyN(cx, buf, size)));
    rv = JS_TRUE;
  }
  free(buf);
  JS_free(cx, filename);
  return rv;
}

/* author: tglek
   Return the primitive if it's a primitive, otherwise compute a seq #
   The ES4 spec says that it shouldn't be a pointer(with good reason).
   A counter is morally wrong because in theory it could loop around and bite me,
   but I lack in moral values and don't enjoy abusing pointers any further */
JSBool Hashcode(JSContext *cx, uintN argc, jsval *vp)
{
  if (!argc)
    return JS_FALSE;
  jsval o = *JS_ARGV(cx, vp);
  if (!JSVAL_IS_OBJECT (o)) {
    JS_SET_RVAL(cx, vp, o);
    return JS_TRUE;
  }
  JSObject *obj = JSVAL_TO_OBJECT (o);
  JSBool has_prop;
  /* Need to check for property first to keep treehydra from getting angry */
  if (JS_AlreadyHasOwnProperty(cx, obj, "_hashcode", &has_prop) && has_prop) {
    jsval rval;
    JS_GetProperty(cx, obj, "_hashcode", &rval);
    JS_SET_RVAL(cx, vp, rval);
  } else {
    static int counter = 0;
    char str[256];
    jsval val;
    snprintf (str, sizeof (str), "%x", ++counter);
    val = STRING_TO_JSVAL (JS_NewStringCopyZ (cx, str));
    JS_DefineProperty (cx, obj, "_hashcode", val,
                       NULL, NULL, JSPROP_PERMANENT | JSPROP_READONLY);
    JS_SET_RVAL(cx, vp, val);
  }
  return JS_TRUE;
}

/* Read the entire contents of a file.
 *      path   path of the file to read
 *      size   (out) number of bytes of file data read
 *    return   null-terminated file contents, or NULL on error. Caller
 *             should free when done. */
char *readFile(const char *path, long *size) {
  FILE *f = fopen(path, "r");
  if (!f) return NULL;
  return readEntireFile(f, size);
}

/* Find a file, searching another dir if necessary.  If the file is
 * found, return a file handle open for reading and store the malloc'd
 * name where the file was found in realname. Otherwise, return
 * NULL. */
FILE *findFile(const char *filename, const char *dir, char **realname) {
  FILE *f = fopen(filename, "r");
  if (f) {
    *realname = strdup(filename);
    return f;
  }
  if (dir && dir[0] && filename[0] && filename[0] != '/') {
    char *buf = static_cast<char *>(malloc(strlen(dir) + strlen(filename) + 2));
    /* Doing a little extra work here to get rid of unneeded '/'. */
    const char *sep = dir[strlen(dir)-1] == '/' ? "" : "/";
    sprintf(buf, "%s%s%s", dir, sep, filename);
    f = fopen(buf, "r");
    if (f) {
      *realname = buf;
      return f;
    } else {
      free(buf);
    }
  }
  return NULL;
}

char *readEntireFile(FILE *f, long *size) {
  xassert(f);
  if (fseek(f, 0, SEEK_END)) return NULL;
  *size = ftell(f);
  if (fseek(f, 0, SEEK_SET)) return NULL;
  char *buf = static_cast<char *>(malloc(*size + 1));
  xassert(*size == fread(buf, 1, *size, f));
  buf[*size] = 0;
  fclose(f);
  return buf;
}

/* Report an error.
 * If we are currently inside JS, we'll report an error to JS. But
 * otherwise, we'll report it to the user and then exit. */
void reportError(JSContext *cx, const char *file, int line, 
                 const char *fmt, ...) 
{
  char msg[1024];
  const int size = sizeof(msg) / sizeof(msg[0]);
  va_list ap;
  va_start(ap, fmt);
  int nw = vsnprintf(msg, size, fmt, ap);
  va_end(ap);
  if (nw >= size) msg[size-1] = '\0';
  
  if (JS_IsRunning(cx)) {
    JS_ReportError(cx, "%s (from %s:%d)", msg, file, line);
  } else {
    fflush(stdout);
    fprintf(stderr, "%s:%d: Error: %s\n", file, line, msg);
    exit(1);
  }
}

void
ErrorReporter(JSContext *cx, const char *message, JSErrorReport *report)
{
  int error = JSREPORT_IS_EXCEPTION(report->flags);
  jsval exn;
  fflush(stdout);
  fprintf(stderr, "%s:%d: ", (report->filename ? report->filename : "NULL"),
          report->lineno);
  if (JSREPORT_IS_WARNING(report->flags)) fprintf(stderr, "JS Warning");
  if (JSREPORT_IS_STRICT(report->flags)) fprintf(stderr, "JS STRICT");
  if (error) fprintf(stderr, "JS Exception");
 
  fprintf(stderr, ": %s\n", message);
  if (report->linebuf) {
    fprintf(stderr, "%s\n", report->linebuf);
  }
  if (error && JS_GetPendingException(cx, &exn)
      && JS_TypeOfValue (cx, exn) == JSTYPE_OBJECT) {
    jsval stack;
    /* reformat the spidermonkey stack */
    JS_GetProperty(cx, JSVAL_TO_OBJECT (exn), "stack", &stack);
    if (JS_TypeOfValue (cx, stack) == JSTYPE_STRING) {
      char *str = JS_EncodeString(cx, JSVAL_TO_STRING (stack));
      int counter = 0;
      do {
        char *eol = strchr (str, '\n');
        if (eol)
          *eol = 0;
        char *at = strrchr (str, '@');
        if (!at) break;
        *at = 0;
        if (!*str) break;
        fprintf (stderr, "%s:\t#%d: %s\n", at+1, counter++, str);
        *at = '@';
        if (eol) {
          *eol = '\n';
          str = eol + 1;
        } else {
          break;
        }
      } while (*str);
      JS_free(cx, str);
    }
  }
  fflush(stderr);
  
  if (!JSREPORT_IS_WARNING(report->flags))
    exit(1);
}
