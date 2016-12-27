'use strict';

import parse from './parse';

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
	//
	// it('will parse an empty object', function() {
	// 	var fn = parse('{}');
	// 	expect(fn()).toEqual({});
	// });
	//
	// it('will parse a non-empty object', function() {
	// 	var fn = parse('{"a key": 1, \'another-key\': 2}');
	// 	expect(fn()).toEqual({'a key': 1, 'another-key': 2});
	// });
	//
	// it('will parse an object with identifier keys', function() {
	// 	var fn = parse('{a: 1, b: [2, 3], c: {d: 4}}');
	// 	expect(fn()).toEqual({a: 1, b: [2, 3], c: {d: 4}});
	// });

});
