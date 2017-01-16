import _ from 'lodash';

function createInjector(modulesToLoad, strictDi = false) {

	let FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
	let FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
	let STRIP_COMMENTS = /(\/\/.*$)|(\/\*.*?\*\/)/mg;

	let cache = {};
	let loadedModules = {};

	let $provide = {
		constant(key, value) {
			if (key === 'hasOwnProperty') {
				throw new Error('hasOwnProperty is not valid constant name');
			}
			cache[key] = value;
		}
	};

	let annotate = function (fn) {
		if (fn.$inject) {
			return fn.$inject;
		} else if (_.isArray(fn)) {
			return _.initial(fn);
		} else if (fn.length === 0) {
			return [];
		} else {

			if (strictDi) {
				throw new Error('fn is not using explicit annotation and cannot be invoked in strict mode');
			}

			let source = fn.toString().replace(STRIP_COMMENTS, '');
			let argDeclaration = source.match(FN_ARGS);
			return _.map(argDeclaration[1].split(','), argName => {
				return argName.match(FN_ARG)[2];
			});
		}
	};

	let invoke = function (fn, self = null, locals = {}) {
		let args = _.map(annotate(fn), token => {
			if (_.isString(token)) {
				return locals.hasOwnProperty(token) ? locals[token] : cache[token];
			} else {
				throw new Error(`Incorrect injection token: Expected a string, got ${token}`);
			}
		});

		if (_.isArray(fn)) {
			fn = _.last(fn);
		}

		return fn.apply(self, args);
	};

	let instantiate = function (Fn, locals) {
		var UnwrappedFn = _.isArray(Fn) ? _.last(Fn) : Fn;
		var instance = Object.create(UnwrappedFn.prototype);
		invoke(Fn, instance, locals);
		return instance;
	};

	_.forEach(modulesToLoad, function loadModule(moduleToLoad) {
		if (!loadedModules.hasOwnProperty(moduleToLoad)) {
			let module = window.angular.module(moduleToLoad);
			loadedModules[moduleToLoad] = true;
			_.forEach(module.requires, loadModule);
			_.forEach(module._invokeQueue, args => {
				let methodName = args[0];
				let methodArgs = args[1];
				$provide[methodName].apply($provide, methodArgs);
			});
		}
	});


	return {
		has(key) {
			return cache.hasOwnProperty(key);
		},
		get(key) {
			return cache[key];
		},
		invoke,
		annotate,
		instantiate
	};
}

export default createInjector;
