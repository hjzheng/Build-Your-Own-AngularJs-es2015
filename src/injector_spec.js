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

	it('allows registering a provider and uses its $get', () => {
		let module = window.angular.module('myModule', []);
		module.provider('a', {
			$get: function () {
				return 42;
			}
		});

		let injector = createInjector(['myModule']);

		expect(injector.has('a')).toBe(true);
		expect(injector.get('a')).toBe(42);
	});

	it('injects the $get method of a provider', () => {
		let module = window.angular.module('myModule', []);
		module.constant('a', 1);
		module.provider('b', {
			$get: function (a) {
				return a + 2;
			}
		});

		let injector = createInjector(['myModule']);

		expect(injector.get('b')).toBe(3);
	});

	it('injects the $get method of a provider lazily', () => {
		let module = window.angular.module('myModule', []);
		module.provider('b', {
			$get: function (a) {
				return a + 2;
			}
		});
		module.provider('a', {$get: _.constant(1)});

		let injector = createInjector(['myModule']);

		expect(injector.get('b')).toBe(3);
	});

	it('instantiates a dependency only once', () => {
		let module = window.angular.module('myModule', []);
		module.provider('a', {$get: function () { return {}; }});

		let injector = createInjector(['myModule']);

		expect(injector.get('a')).toBe(injector.get('a'));
	});

	it('notifies the user about a circular dependency', () => {
		let module = window.angular.module('myModule', []);
		module.provider('a', {$get: function (b) { }});
		module.provider('b', {$get: function (c) { }});
		module.provider('c', {$get: function (a) { }});

		let injector = createInjector(['myModule']);

		expect(function () {
			injector.get('a');
		}).toThrowError(/Circular dependency found/);
	});

	it('cleans up the circular marker when instantiation fails', () => {
		let module = window.angular.module('myModule', []);
		module.provider('a', {$get: function () {
			throw 'Failing instantiation!'; // eslint-disable-line
		}});

		let injector = createInjector(['myModule']);

		expect(function () {
			injector.get('a');
		}).toThrow('Failing instantiation!');
		expect(function () {
			injector.get('a');
		}).toThrow('Failing instantiation!');
	});

	it('instantiates a provider if given as a constructor function', () => {
		let module = window.angular.module('myModule', []);

		module.provider('a', function AProvider() {
			this.$get = function () { return 42; };
		});

		let injector = createInjector(['myModule']);

		expect(injector.get('a')).toBe(42);
	});

	it('injects the given provider constructor function', () => {
		let module = window.angular.module('myModule', []);

		module.constant('b', 2);
		module.provider('a', function AProvider(b) {
			this.$get = function () { return 1 + b; };
		});

		let injector = createInjector(['myModule']);

		expect(injector.get('a')).toBe(3);
	});

	it('injects another provider to a provider constructor function', () => {
		var module = window.angular.module('myModule', []);

		module.provider('a', function AProvider() {
			var value = 1;
			this.setValue = function (v) { value = v; };
			this.$get = function () { return value; };
		});
		module.provider('b', function BProvider(aProvider) {
			aProvider.setValue(2);
			this.$get = function () { };
		});


		var injector = createInjector(['myModule']);

		expect(injector.get('a')).toBe(2);
	});

	it('does not inject an instance to a provider constructor function', () => {
		var module = window.angular.module('myModule', []);

		module.provider('a', function AProvider() {
			this.$get = function () { return 1; };
		});

		module.provider('b', function BProvider(a) {
			this.$get = function () { return a; };
		});

		expect(function () {
			createInjector(['myModule']);
		}).toThrow();

	});

	it('does not inject a provider to a $get function', () => {
		var module = window.angular.module('myModule', []);

		module.provider('a', function AProvider() {
			this.$get = function () { return 1; };
		});
		module.provider('b', function BProvider() {
			this.$get = function (aProvider) { return aProvider.$get(); };
		});

		var injector = createInjector(['myModule']);

		expect(function () {
			injector.get('b');
		}).toThrow();
	});

	it('does not inject a provider to invoke', () => {
		var module = window.angular.module('myModule', []);

		module.provider('a', function AProvider() {
			this.$get = function () { return 1; };
		});

		var injector = createInjector(['myModule']);

		expect(function () {
			injector.invoke(function (aProvider) { });
		}).toThrow();
	});

	it('does not give access to providers through get', () => {
		var module = window.angular.module('myModule', []);

		module.provider('a', function AProvider() {
			this.$get = function () { return 1; };
		});

		var injector = createInjector(['myModule']);
		expect(function () {
			injector.get('aProvider');
		}).toThrow();
	});

	it('registers constants first to make them available to providers', () => {
		var module = window.angular.module('myModule', []);

		module.provider('a', function AProvider(b) {
			this.$get = function () { return b; };
		});
		module.constant('b', 42);

		var injector = createInjector(['myModule']);
		expect(injector.get('a')).toBe(42);
	});

	it('allows injecting the instance injector to $get', () => {
		let module = window.angular.module('myModule', []);

		module.constant('a', 42);
		module.provider('b', function BProvider() {
			this.$get = function ($injector) {
				return $injector.get('a');
			};
		});

		let injector = createInjector(['myModule']);

		expect(injector.get('b')).toBe(42);
	});

	it('allows injecting the provider injector to provider', () => {
		let module = window.angular.module('myModule', []);

		module.provider('a', function AProvider() {
			this.value = 42;
			this.$get = function () { return this.value; };
		});
		module.provider('b', function BProvider($injector) {
			var aProvider = $injector.get('aProvider');
			this.$get = function () {
				return aProvider.value;
			};
		});

		let injector = createInjector(['myModule']);

		expect(injector.get('b')).toBe(42);
	});

	it('allows injecting the $provide service to providers', () => {
		let module = window.angular.module('myModule', []);

		module.provider('a', function AProvider($provide) {
			$provide.constant('b', 2);
			this.$get = function (b) { return 1 + b; };
		});

		let injector = createInjector(['myModule']);

		expect(injector.get('a')).toBe(3);
	});

	it('does not allow injecting the $provide service to $get', () => {
		let module = window.angular.module('myModule', []);

		module.provider('a', function AProvider() {
			this.$get = function ($provide) { };
		});

		let injector = createInjector(['myModule']);

		expect(() => {
			injector.get('a');
		}).toThrow();
	});

	it('runs config blocks when the injector is created', () => {
		var module = window.angular.module('myModule', []);

		var hasRun = false;
		module.config(function () {
			hasRun = true;
		});

		createInjector(['myModule']);

		expect(hasRun).toBe(true);
	});

	it('injects config blocks with provider injector', () => {
		let module = window.angular.module('myModule', []);

		module.config(function ($provide) {
			$provide.constant('a', 42);
		});

		let injector = createInjector(['myModule']);

		expect(injector.get('a')).toBe(42);
	});

	it('allows registering config blocks before providers', () => {
		let module = window.angular.module('myModule', []);

		module.config(function (aProvider) { });
		module.provider('a', function () {
			this.$get = _.constant(42);
		});

		let injector = createInjector(['myModule']);

		expect(injector.get('a')).toBe(42);
	});


	it('runs a config block added during module registration', () => {
		window.angular.module('myModule', [], function ($provide) {
			$provide.constant('a', 42);
		});

		let injector = createInjector(['myModule']);

		expect(injector.get('a')).toBe(42);
	});

	it('runs run blocks when the injector is created', () => {
		var module = window.angular.module('myModule', []);

		var hasRun = false;
		module.run(function () {
			hasRun = true;
		});

		createInjector(['myModule']);

		expect(hasRun).toBe(true);
	});

	it('injects run blocks with the instance injector', () => {
		var module = window.angular.module('myModule', []);

		module.provider('a', {$get: _.constant(42)});

		var gotA;
		module.run(function (a) {
			gotA = a;
		});

		createInjector(['myModule']);

		expect(gotA).toBe(42);
	});

	it('configures all modules before running any run blocks', () => {
		var module1 = window.angular.module('myModule', []);
		module1.provider('a', {$get: _.constant(1)});
		var result;
		module1.run(function (a, b) {
			result = a + b;
		});

		var module2 = window.angular.module('myOtherModule', []);
		module2.provider('b', {$get: _.constant(2)});

		createInjector(['myModule', 'myOtherModule']);

		expect(result).toBe(3);
	});

	it('runs a function module dependency as a config block', () => {
		window.angular.module('myModule', [function ($provide) {
			$provide.constant('a', 42);
		}]);

		var injector = createInjector(['myModule']);

		expect(injector.get('a')).toBe(42);
	});

	it('runs a function module with array injection as a config block', () => {
		window.angular.module('myModule', [['$provide', function ($provide) {
			$provide.constant('a', 42);
		}]]);

		var injector = createInjector(['myModule']);

		expect(injector.get('a')).toBe(42);
	});

	it('supports returning a run block from a function module', () => {
		var result;
		var requiredModule = function ($provide) {
			$provide.constant('a', 42);
			return function (a) {
				result = a;
			};
		};
		window.angular.module('myModule', [requiredModule]);

		createInjector(['myModule']);

		expect(result).toBe(42);
	});

	it('only loads function modules once', () => {
		var loadedTimes = 0;
		var fnModule = function () {
			loadedTimes++;
		};

		window.angular.module('myModule', [fnModule, fnModule]);
		createInjector(['myModule']);

		expect(loadedTimes).toBe(1);
	});

	it('allows registering a factory', () => {
		var module = window.angular.module('myModule', []);

		module.factory('a', function () { return 42; });

		var injector = createInjector(['myModule']);

		expect(injector.get('a')).toBe(42);
	});

	it('injects a factory function with instances', () => {
		var module = window.angular.module('myModule', []);

		module.factory('a', function () { return 1; });
		module.factory('b', function (a) { return a + 2; });

		var injector = createInjector(['myModule']);

		expect(injector.get('b')).toBe(3);
	});

	it('only calls a factory function once', () => {
		var module = window.angular.module('myModule', []);

		module.factory('a', function () { return {}; });

		var injector = createInjector(['myModule']);

		expect(injector.get('a')).toBe(injector.get('a'));
	});

	it('forces a factory to return a value', () => {
		var module = window.angular.module('myModule', []);

		module.factory('a', function () {});
		module.factory('b', function () { return null; });

		var injector = createInjector(['myModule']);

		expect(function () {
			injector.get('a');
		}).toThrow();
		expect(injector.get('b')).toBeNull();
	});

	it('allows registering a value', () => {
		var module = window.angular.module('myModule', []);

		module.value('a', 42);

		var injector = createInjector(['myModule']);

		expect(injector.get('a')).toBe(42);
	});
	//
	// it('does not make values available to config blocks', function() {
	// 	var module = window.angular.module('myModule', []);
	//
	// 	module.value('a', 42);
	// 	module.config(function(a) {
	// 	});
	//
	// 	expect(function() {
	// 		createInjector(['myModule']);
	// 	}).toThrow();
	//
	// });
	//
	// it('allows an undefined value', function() {
	// 	var module = window.angular.module('myModule', []);
	//
	// 	module.value('a', undefined);
	//
	// 	var injector = createInjector(['myModule']);
	//
	// 	expect(injector.get('a')).toBeUndefined();
	// });
	//
	// it('allows registering a service', function() {
	// 	var module = window.angular.module('myModule', []);
	//
	// 	module.service('aService', function MyService() {
	// 		this.getValue = function() { return 42; };
	// 	});
	//
	// 	var injector = createInjector(['myModule']);
	//
	// 	expect(injector.get('aService').getValue()).toBe(42);
	// });
	//
	// it('injects service constructors with instances', function() {
	// 	var module = window.angular.module('myModule', []);
	//
	// 	module.value('theValue', 42);
	// 	module.service('aService', function MyService(theValue) {
	// 		this.getValue = function() { return theValue; };
	// 	});
	//
	// 	var injector = createInjector(['myModule']);
	//
	// 	expect(injector.get('aService').getValue()).toBe(42);
	// });
	//
	// it('only instantiates services once', function() {
	// 	var module = window.angular.module('myModule', []);
	//
	// 	module.service('aService', function MyService() {
	// 	});
	//
	// 	var injector = createInjector(['myModule']);
	//
	// 	expect(injector.get('aService')).toBe(injector.get('aService'));
	// });
	//
	//
	// it('allows changing an instance using a decorator', function() {
	// 	var module = window.angular.module('myModule', []);
	// 	module.factory('aValue', function() {
	// 		return {};
	// 	});
	// 	module.decorator('aValue', function($delegate) {
	// 		$delegate.decoratedKey = 42;
	// 	});
	//
	// 	var injector = createInjector(['myModule']);
	//
	// 	expect(injector.get('aValue').decoratedKey).toBe(42);
	// });
	//
	// it('allows multiple decorators per service', function() {
	// 	var module = window.angular.module('myModule', []);
	// 	module.factory('aValue', function() {
	// 		return {};
	// 	});
	// 	module.decorator('aValue', function($delegate) {
	// 		$delegate.decoratedKey = 42;
	// 	});
	// 	module.decorator('aValue', function($delegate) {
	// 		$delegate.otherDecoratedKey = 43;
	// 	});
	//
	// 	var injector = createInjector(['myModule']);
	//
	// 	expect(injector.get('aValue').decoratedKey).toBe(42);
	// 	expect(injector.get('aValue').otherDecoratedKey).toBe(43);
	// });
	//
	// it('uses dependency injection with decorators', function() {
	// 	var module = window.angular.module('myModule', []);
	// 	module.factory('aValue', function() {
	// 		return {};
	// 	});
	// 	module.constant('a', 42);
	// 	module.decorator('aValue', function(a, $delegate) {
	// 		$delegate.decoratedKey = a;
	// 	});
	//
	// 	var injector = createInjector(['myModule']);
	//
	// 	expect(injector.get('aValue').decoratedKey).toBe(42);
	// });

});
