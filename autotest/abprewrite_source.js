const Cc = Components.classes
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;
const Cl = Components.unknown;

Cu.import("foo/bar.jsm");

let {Utils} = require("utils");
let {Filter, BlockingFilter} = require("filterClasses");

let foo;
let bar = 2;
var bas;
const FOO = "FOO";

let [a, b] = foo();
[a, b] = [1, 2];

let {x: y} = foo();
let {k1: v1, k2: v2} = foo();


for (let v of fooList)
  alert(v);

for (let [a, b] of fooList)
{
  a += b;
  b -= a;
}

for (let [a, b] of fooList);

for (k of fooList)
  alert(k);


let a = function() { return 1; };
let b = {
  get foo() { return 1; }
};

function foo()
{
  return {foo: 1, bar: 2};
}

if (a == b)
  foo();
else if (a == c)
  bar();
else
  bas();
if (a == b);

for (let a = 0; a < b.length; a++)
  foo();
for (var a = 0; a < b.length; a++);

for (let a in b)
  foo();
for (var a in b);

while (a==b)
  foo();
while (a==b);

function genFunc()
{
  for (var i = 0; i < 10; i++)
  {
    yield i;
  }
}
var a = function()
{
  for (var i = 0; i < 10; i++)
  {
    yield i;
  }
};

let x = (y) => y + 1;
x = y => y + 1;
x = (a, b) => this[a] + b;
x = (a, b) => { return () => 1; }
