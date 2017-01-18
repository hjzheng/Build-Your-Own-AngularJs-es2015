/**
 * 本章最复杂的为什么需要将 injector 拆成两个 injectors
 * 一个是 provider Injector 一个 instance Injector
 *
 * 特点:
 * 不能将 instance 注入到 provider constructor (这个属于 provider Injector)
 * 不能将 provider 注入到 provider 的 $get 方法中 (这个属于 instance Injector)
 * 不能使用 injector 的 get 方法获取 provider -> 实现方式 createInjector 只对外返回 instance Injector instanceCache 中并没有 provider
 * 不能使用 injector 的 invoke 方法调用 provider -> 实现方式 createInjector 只对外返回 instance Injector instanceCache 中并没有 provider
 *
 * provider 为什么可以注入 provider constructor 因为 provider 将所有的 provider 放入 providerCache. 注意 $provide.provider 方法, 如果是 provider constructor 它已经调用 instantiate 方法
 * constant 为什么也可以注入 provider constructor 因为 constant 方法将注册的 constant 放入 providerCache. 注意 $provide.constant 方法
 * */

import _ from 'lodash';

function createInjector(modulesToLoad, strictDi = false) {

	let FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
	let FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
	let STRIP_COMMENTS = /(\/\/.*$)|(\/\*.*?\*\/)/mg;

	let loadedModules = {};
	// just a marker for INSTANTIATING's provider
	let INSTANTIATING = {};
	// record dependence path, when error happen, can easily decipher it.
	let path = [];

	let providerCache = {};
	let providerInjector = createInternalInjector(providerCache, function () {
		throw new Error('Unknown provider: ' + path.join(' <- '));
	});
	let instanceCache = {};
	let instanceInjector = createInternalInjector(instanceCache, function (name) {
		var provider = providerInjector.get(name + 'Provider');
		return instanceInjector.invoke(provider.$get, provider);
	});

	function annotate(fn) {
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

	function createInternalInjector(cache, factoryFn) {

		function getService(key) {
			if (cache.hasOwnProperty(key)) {
				if (cache[key] === INSTANTIATING) {
					throw new Error(`Circular dependency found: ${key} <- ${path.join(' <- ')}`);
				}
				return cache[key];
			} else {
				path.unshift(key);
				cache[key] = INSTANTIATING;
				try {
					let instance = cache[key] = factoryFn(key);
					return instance;
				} finally {
					path.shift();
					if (cache[key] === INSTANTIATING) {
						delete cache[key];
					}
				}
			}
		}

		function invoke(fn, self = null, locals = {}) {
			let args = _.map(annotate(fn), token => {
				if (_.isString(token)) {
					return locals.hasOwnProperty(token) ? locals[token] : getService(token);
				} else {
					throw new Error(`Incorrect injection token: Expected a string, got ${token}`);
				}
			});

			if (_.isArray(fn)) {
				fn = _.last(fn);
			}

			return fn.apply(self, args);
		}

		function instantiate(Fn, locals) {
			var UnwrappedFn = _.isArray(Fn) ? _.last(Fn) : Fn;
			var instance = Object.create(UnwrappedFn.prototype);
			invoke(Fn, instance, locals);
			return instance;
		}

		return {
			has(key) {
				return cache.hasOwnProperty(key) || providerCache.hasOwnProperty(key + 'Provider');
			},
			get: getService,
			invoke,
			annotate,
			instantiate
		};

	}

	let $provide = {
		constant(key, value) {
			if (key === 'hasOwnProperty') {
				throw new Error('hasOwnProperty is not valid constant name');
			}
			providerCache[key] = value;
			instanceCache[key] = value;
		},
		provider(key, provider) {
			if (_.isFunction(provider)) {
				// provider constructor 中为什么可以注入 provider ?
				provider = providerInjector.instantiate(provider);
			}
			providerCache[key + 'Provider'] = provider;
		}
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

	return instanceInjector;

}

export default createInjector;
