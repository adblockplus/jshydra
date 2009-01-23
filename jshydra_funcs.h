/* -*- Mode: C; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
#ifndef JSHYDRA_FUNCS_H
#define JSHYDRA_FUNCS_H

/* JS Natives */

#define DH_JSNATIVE(fname) JSBool fname(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval);
 
DH_JSNATIVE(Require);
DH_JSNATIVE(Include);
 
DH_JSNATIVE(Diagnostic);
DH_JSNATIVE(Print);
 
DH_JSNATIVE(WriteFile);
DH_JSNATIVE(ReadFile);
DH_JSNATIVE(Hashcode);

void ErrorReporter(JSContext *cx, const char *message, JSErrorReport *report);

/* Related C functions */

char *readFile(const char *path, long *size);
FILE *findFile(const char *filename, const char *dir, char **realname);
char *readEntireFile(FILE *f, long *size);
void  reportError(JSContext *cx, const char *file, int line, 
                  const char *fmt, ...);

#define REPORT_ERROR_0(cx, fmt) reportError(cx, __FILE__, __LINE__, fmt);
#define REPORT_ERROR_1(cx, fmt, arg1) reportError(cx, __FILE__, __LINE__, fmt, arg1);
#define REPORT_ERROR_2(cx, fmt, arg1, arg2) reportError(cx, __FILE__, __LINE__, fmt, arg1, arg1);

#define xassert(cond) \
  if (!(cond)) { \
    fprintf(stderr, "%s:%d: Assertion failed:" #cond "\n", __FILE__, __LINE__);\
    exit(1); \
  }

#endif
