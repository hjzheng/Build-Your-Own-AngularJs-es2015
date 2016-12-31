'use strict';

import parse from './parse';
import _ from 'lodash';

describe('parse', () => {

	it('can parse an integer', () => {
		var fn = parse('42');
		expect(fn).toBeDefined();
		expect(fn()).toBe(42);
	});

	it('can parse a floating point number', () => {
		var fn = parse('4.2');
		expect(fn()).toBe(4.2);
	});

	it('can parse a floating point number without an integer part', () => {
		var fn = parse('.42');
		expect(fn()).toBe(0.42);
	});

	it('can parse a number in scientific notation', () => {
		var fn = parse('42e3');
		expect(fn()).toBe(42000);
	});

	it('can parse scientific notation with a float coefficient', () => {
		var fn = parse('.42e2');
		expect(fn()).toBe(42);
	});

	it('can parse scientific notation with negative exponents', () => {
		var fn = parse('4200e-2');
		expect(fn()).toBe(42);
	});

	it('can parse scientific notation with the + sign', () => {
		var fn = parse('.42e+2');
		expect(fn()).toBe(42);
	});

	it('can parse upper case scientific notation', () => {
		var fn = parse('.42E2');
		expect(fn()).toBe(42);
	});

	it('will not parse invalid scientific notation', () => {
		expect(() => { parse('42e-'); }).toThrow();
		expect(() => { parse('42e-a'); }).toThrow();
	});

	it('can parse a string in single quotes', () => {
		var fn = parse("'abc'");
		expect(fn()).toEqual('abc');
	});

	it('can parse a string in double quotes', () => {
		var fn = parse('"abc"');
		expect(fn()).toEqual('abc');
	});

	it('will not parse a string with mismatching quotes', () => {
		expect(() => { parse('"abc\''); }).toThrow();
	});

	it('can parse a string with single quotes inside', () => {
		var fn = parse("'a\\\'b'");
		expect(fn()).toEqual('a\'b');
	});

	it('can parse a string with double quotes inside', () => {
		var fn = parse('"a\\\"b"');
		expect(fn()).toEqual('a\"b');
	});

	it('will parse a string with unicode escapes', () => {
		var fn = parse('"\\u00A0"'); expect(fn()).toEqual('\u00A0');
	});

	it('will not parse a string with invalid unicode escapes', () => {
		expect(() => { parse('"\\u00T0"'); }).toThrow();
	});

	it('will parse null', () => {
		var fn = parse('null');
		expect(fn()).toBe(null);
	});

	it('will parse true', () => {
		var fn = parse('true');
		expect(fn()).toBe(true);
	});

	it('will parse false', () => {
		var fn = parse('false');
		expect(fn()).toBe(false);
	});

	it('ignores whitespace', () => {
		var fn = parse(' \n42 ');
		expect(fn()).toEqual(42);
	});

	it('will parse an empty array', () => {
		var fn = parse('[]');
		expect(fn()).toEqual([]);
	});

	it('will parse a non-empty array', () => {
		var fn = parse('[1, "two", [3], true]');
		expect(fn()).toEqual([1, 'two', [3], true]);
	});

	it('will parse an array with trailing commas', () => {
		var fn = parse('[1, 2, 3, ]');
		expect(fn()).toEqual([1, 2, 3]);
	});

	it('will parse an empty object', () => {
		var fn = parse('{}');
		expect(fn()).toEqual({});
	});

	it('will parse a non-empty object', () => {
		var fn = parse('{"a key": 1, \'another-key\': 2}');
		expect(fn()).toEqual({'a key': 1, 'another-key': 2});
	});

	it('will parse an object with identifier keys', () => {
		var fn = parse('{a: 1, b: [2, 3], c: {d: 4}}');
		expect(fn()).toEqual({a: 1, b: [2, 3], c: {d: 4}});
	});

	// 第 7 章
	it('looks up an attribute from the scope', () => {
		var fn = parse('aKey');
		expect(fn({aKey: 42})).toBe(42);
		expect(fn({})).toBeUndefined();
	});

	it('will parse this', () => {
		var fn = parse('this');
		var scope = {};
		expect(fn(scope)).toBe(scope);
		expect(fn()).toBeUndefined();
	});

	// Non-Computed Attribute Lookup
	it('looks up a 2-part identi er path from the scope', () => {
		var fn = parse('aKey.anotherKey');
		expect(fn({aKey: {anotherKey: 42}})).toBe(42);
		expect(fn({aKey: {}})).toBeUndefined();
		expect(fn({})).toBeUndefined();
	});

	it('looks up a member from an object', () => {
		var fn = parse('{aKey: 42}.aKey');
		expect(fn()).toBe(42);
	});

	it('looks up a 4-part identi er path from the scope', () => {
		var fn = parse('aKey.secondKey.thirdKey.fourthKey');
		expect(fn({aKey: {secondKey: {thirdKey: {fourthKey: 42}}}})).toBe(42);
		expect(fn({aKey: {secondKey: {thirdKey: {}}}})).toBeUndefined();
		expect(fn({aKey: {}})).toBeUndefined();
		expect(fn()).toBeUndefined();
	});

	// local
	it('uses locals instead of scope when there is a matching key', () => {
		var fn = parse('aKey');
		var scope = {aKey: 42};
		var locals = {aKey: 43};
		expect(fn(scope, locals)).toBe(43);
	});
	it('does not use locals instead of scope when no matching key', () => {
		var fn = parse('aKey');
		var scope = {aKey: 42};
		var locals = {otherKey: 43};
		expect(fn(scope, locals)).toBe(42);
	});

	it('will parse $locals', () => {
		var fn = parse('$locals');
		var scope = {};
		var locals = {};
		expect(fn(scope, locals)).toBe(locals);
		expect(fn(scope)).toBeUndefined();
		fn = parse('$locals.aKey');
		scope = {aKey: 42};
		locals = {aKey: 43};
		expect(fn(scope, locals)).toBe(43);
	});

	// Computed Attribute Lookup
	it('parses a simple computed property access', () => {
		var fn = parse('aKey["anotherKey"]');
		expect(fn({aKey: {anotherKey: 42}})).toBe(42);
	});

	it('parses a computed numeric array access', () => {
		var fn = parse('anArray[1]');
		expect(fn({anArray: [1, 2, 3]})).toBe(2);
	});

	it('parses a computed access with another key as property', () => {
		var fn = parse('lock[key]');
		expect(fn({key: 'theKey', lock: {theKey: 42}})).toBe(42);
	});

	it('parses computed access with another access as property', () => {
		var fn = parse('lock[keys["aKey"]]');
		expect(fn({keys: {aKey: 'theKey'}, lock: {theKey: 42}})).toBe(42);
	});

	// Function calls
	it('parses a function call', () => {
		var fn = parse('aFunction()');
		expect(fn({aFunction: function () { return 42; }})).toBe(42);
	});

	it('parses a function call with a single number argument', () => {
		var fn = parse('aFunction(42)');
		expect(fn({aFunction: function (n) { return n; }})).toBe(42);
	});

	it('parses a function call with a single identifier argument', () => {
		var fn = parse('aFunction(n)');
		expect(fn({n: 42, aFunction: function (arg) { return arg; }})).toBe(42);
	});

	it('parses a function call with a single function call argument', () => {
		var fn = parse('aFunction(argFn())');
		expect(fn({
			argFn: _.constant(42),
			aFunction: function (arg) { return arg; }
		})).toBe(42);
	});

	it('parses a function call with multiple arguments', () => {
		var fn = parse('aFunction(37, n, argFn())');
		expect(fn({
			n: 3,
			argFn: _.constant(2),
			aFunction: function (a1, a2, a3) { return a1 + a2 + a3; }
		})).toBe(42);
	});
});
