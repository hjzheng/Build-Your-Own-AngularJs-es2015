import _ from 'lodash';
import setupModuleLoader from './loader';
import createInjector from './injector';

describe('injector', () => {

	beforeEach(() => {
		delete window.angular;
		setupModuleLoader(window);
	});

	it('can be created', () => {
		let injector = createInjector([]);
		expect(injector).toBeDefined();
	});

	it('has a constant that has been registered to a module', () => {
		let module = window.angular.module('myModule', []);
		module.constant('aConstant', 42);
		let injector = createInjector(['myModule']);
		expect(injector.has('aConstant')).toBe(true);
	});

	it('does not have a non-registered constant', () => {
		window.angular.module('myModule', []);
		let injector = createInjector(['myModule']);
		expect(injector.has('aConstant')).toBe(false);
	});

	it('does not allow a constant called hasOwnProperty', () => {
		let module = window.angular.module('myModule', []);
		module.constant('hasOwnProperty', false);
		expect(() => {
			createInjector(['myModule']);
		}).toThrow();
	});

	it('can return a registered constant', () => {
		let module = window.angular.module('myModule', []);
		module.constant('aConstant', 42);
		let injector = createInjector(['myModule']);
		expect(injector.get('aConstant')).toBe(42);
	});

	it('loads multiple modules', () => {
		let module1 = window.angular.module('myModule', []);
		let module2 = window.angular.module('myOtherModule', []);
		module1.constant('aConstant', 42);
		module2.constant('anotherConstant', 43);
		let injector = createInjector(['myModule', 'myOtherModule']);

		expect(injector.has('aConstant')).toBe(true);
		expect(injector.has('anotherConstant')).toBe(true);
	});

	it('loads the required modules of a module', () => {
		let module1 = window.angular.module('myModule', []);
		let module2 = window.angular.module('myOtherModule', ['myModule']);
		module1.constant('aConstant', 42);
		module2.constant('anotherConstant', 43);
		let injector = createInjector(['myOtherModule']);

		expect(injector.has('aConstant')).toBe(true);
		expect(injector.has('anotherConstant')).toBe(true);
	});

	it('loads the transitively required modules of a module', () => {
		let module1 = window.angular.module('myModule', []);
		let module2 = window.angular.module('myOtherModule', ['myModule']);
		let module3 = window.angular.module('myThirdModule', ['myOtherModule']);
		module1.constant('aConstant', 42);
		module2.constant('anotherConstant', 43);
		module3.constant('aThirdConstant', 44);
		let injector = createInjector(['myThirdModule']);

		expect(injector.has('aConstant')).toBe(true);
		expect(injector.has('anotherConstant')).toBe(true);
		expect(injector.has('aThirdConstant')).toBe(true);
	});

	it('loads each module only once', () => {
		window.angular.module('myModule', ['myOtherModule']);
		window.angular.module('myOtherModule', ['myModule']);

		createInjector(['myModule']);
	});

	it('invokes an annotated function with dependency injection', () => {
		let module = window.angular.module('myModule', []);
		module.constant('a', 1);
		module.constant('b', 2);
		let injector = createInjector(['myModule']);

		let fn = function (one, two) { return one + two; };
		fn.$inject = ['a', 'b'];

		expect(injector.invoke(fn)).toBe(3);
	});

	it('does not accept non-strings as injection tokens', () => {
		let module = window.angular.module('myModule', []);
		module.constant('a', 1);
		let injector = createInjector(['myModule']);

		let fn = function (one, two) { return one + two; };
		fn.$inject = ['a', 2];

		expect(() => {
			injector.invoke(fn);
		}).toThrow();
	});

	it('invokes a function with the given this context', () => {
		let module = window.angular.module('myModule', []);
		module.constant('a', 1);
		let injector = createInjector(['myModule']);

		let obj = {
			two: 2,
			fn: function (one) { return one + this.two; }
		};
		obj.fn.$inject = ['a'];

		expect(injector.invoke(obj.fn, obj)).toBe(3);
	});

	it('overrides dependencies with locals when invoking', () => {
		var module = window.angular.module('myModule', []);
		module.constant('a', 1);
		module.constant('b', 2);
		var injector = createInjector(['myModule']);

		var fn = function (one, two) { return one + two; };
		fn.$inject = ['a', 'b'];

		expect(injector.invoke(fn, undefined, {b: 3})).toBe(4);
	});

	describe('annotate', () => {

		it('returns a functions $inject annotation when it has one', () => {
			let injector = createInjector([]);

			let fn = function () { };
			fn.$inject = ['a', 'b'];

			expect(injector.annotate(fn)).toEqual(['a', 'b']);
		});

		it('returns the array-style annotations of a function', () => {
			let injector = createInjector([]);

			let fn = ['a', 'b', function () { }];

			expect(injector.annotate(fn)).toEqual(['a', 'b']);
		});

		it('returns an empty array for a non-annotated function with no arguments', () => {
			let injector = createInjector([]);

			let fn = function () { };

			expect(injector.annotate(fn)).toEqual([]);
		});

		it('returns annotations parsed from a non-annotated function', () => {
			let injector = createInjector([]);

			let fn = function (a, b) { };

			expect(injector.annotate(fn)).toEqual(['a', 'b']);
		});

		it('strips comments from argument lists when parsing', () => {
			var injector = createInjector([]);

			var fn = function (a, /*b,*/ c) { }; // eslint-disable-line

			expect(injector.annotate(fn)).toEqual(['a', 'c']);
		});

		it('strips several comments from argument lists when parsing', () => {
			var injector = createInjector([]);

			var fn = function (a, /*b,*/ c/*, d*/) { }; // eslint-disable-line

			expect(injector.annotate(fn)).toEqual(['a', 'c']);
		});

		it('strips // comments from argument lists when parsing', () => {
			let injector = createInjector([]);

			// eslint-disable-next-line spaced-comment
			let fn = function (a, // b,
			                  c) { };  // eslint-disable-line

			expect(injector.annotate(fn)).toEqual(['a', 'c']);
		});

		it('strips surrounding underscores from argument names when parsing', () => {
			let injector = createInjector([]);

			let fn = function (a, _b_, c_, _d, an_argument) { };

			expect(injector.annotate(fn)).toEqual(['a', 'b', 'c_', '_d', 'an_argument']);
		});

		it('throws when using a non-annotated function in strict mode', () => {
			var injector = createInjector([], true);

			var fn = function (a, b, c) { };

			expect(() => {
				injector.annotate(fn);
			}).toThrow();
		});

	});

	it('invokes an array-annotated function with dependency injection', () => {
		let module = window.angular.module('myModule', []);
		module.constant('a', 1);
		module.constant('b', 2);
		let injector = createInjector(['myModule']);

		let fn = ['a', 'b', function (one, two) { return one + two; }];

		expect(injector.invoke(fn)).toBe(3);
	});

	it('invokes a non-annotated function with dependency injection', () => {
		let module = window.angular.module('myModule', []);
		module.constant('a', 1);
		module.constant('b', 2);
		let injector = createInjector(['myModule']);

		let fn = function (a, b) { return a + b; };

		expect(injector.invoke(fn)).toBe(3);
	});

	it('instantiates an annotated constructor function', () => {
		let module = window.angular.module('myModule', []);
		module.constant('a', 1);
		module.constant('b', 2);
		let injector = createInjector(['myModule']);

		function Type(one, two) {
			this.result = one + two;
		}
		Type.$inject = ['a', 'b'];

		let instance = injector.instantiate(Type);
		expect(instance.result).toBe(3);
	});

	it('instantiates an array-annotated constructor function', () => {
		let module = window.angular.module('myModule', []);
		module.constant('a', 1);
		module.constant('b', 2);
		let injector = createInjector(['myModule']);

		function Type(one, two) {
			this.result = one + two;
		}

		let instance = injector.instantiate(['a', 'b', Type]);
		expect(instance.result).toBe(3);
	});

	it('instantiates a non-annotated constructor function', () => {
		let module = window.angular.module('myModule', []);
		module.constant('a', 1);
		module.constant('b', 2);
		let injector = createInjector(['myModule']);

		function Type(a, b) {
			this.result = a + b;
		}

		let instance = injector.instantiate(Type);
		expect(instance.result).toBe(3);
	});

	it('uses the prototype of the constructor when instantiating', () => {
		function BaseType() { }
		BaseType.prototype.getValue = _.constant(42);

		function Type() { this.v = this.getValue(); }
		Type.prototype = BaseType.prototype;

		window.angular.module('myModule', []);
		let injector = createInjector(['myModule']);

		let instance = injector.instantiate(Type);
		expect(instance.v).toBe(42);
	});

	it('supports locals when instantiating', () => {
		let module = window.angular.module('myModule', []);
		module.constant('a', 1);
		module.constant('b', 2);
		let injector = createInjector(['myModule']);

		function Type(a, b) {
			this.result = a + b;
		}

		let instance = injector.instantiate(Type, {b: 3});
		expect(instance.result).toBe(4);
	});

});