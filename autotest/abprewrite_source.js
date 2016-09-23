const Cc = Components.classes
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;
const Cl = Components.unknown;

Cu.import("foo/bar.jsm");

"foo \x2B bar \n\r\x02\x0F\x1E";

let {Utils} = require("utils");
let {Filter, BlockingFilter} = require("filterClasses");

let foovar;
let bar = 2;
var bas;
const FOO = "FOO";

let [a, b] = foo();
[a, b] = [1, 2];

let {x: prop} = foo();
let {k1: v1, k2: v2} = foo();


for (let v of fooList)
  alert(v);

for (let [i1, i2] of fooList)
{
  i1 += i2;
  i2 -= i1;
}

for (let [j1, j2] of fooList);

for (k of fooList)
  alert(k);


let arrow = () => 1;
let getter = {
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

for (let x = 0; x < b.length; x++)
  foo();
for (var y = 0; y < b.length; y++);

for (let i in b)
  foo();
for (var j in b);

while (a==b)
  foo();
while (a==b);

function* genFunc()
{
  for (var i = 0; i < 10; i++)
  {
    yield i;
  }
}
var func = function*()
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
