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

for each (let v in fooList)
  alert(v);

for each (let [a, b] in fooList)
{
  a += b;
  b -= a;
}

for each (let [a, b] in fooList);

for each (k in fooList)
  alert(k);

let a = function() 1;
let b = {
  get foo() 1
};
