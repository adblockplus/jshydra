const Cc = Components.classes
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;
const Cl = Components.unknown;

Cu.import("foo/bar.jsm");

let {Timeline} = require("timeline");
let {Utils} = require("utils");
let {Filter, BlockingFilter} = require("filterClasses");

let foo;
let bar = 2;
var bas;

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


let a = function() 1;
let b = {
  get foo() 1
};

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
