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
 *
 * 为 instanceCache 和 providerCache 添加 $injector 服务
 * 为 providerCache 添加 $provide 服务
 *
 * 为 module 增加 config 方法, 参考 loader.js 中的 config 模块, 注意 invokeLater 方法
 * 以及后面的 config 如何配置 invokeLater 方法, 由于 config 是会被 providerCache 中的 $injector.invoke 方法调用,
 * 因此, 在下面遍历 _configBlock _.forEach(module._configBlock, runInvokeQueue);
 *
 * 为 module 增加 run 方法, 注意 run 方法中的函数只能注入实例, 所以必须被 instanceCache 中的 $injector.invoke 方法调用
 * 注意 run 方法必须在所有 module loader 加载完成后, 最后一并执行, 所以需要在 module loader 中将所有的 run 函数收集起来
 *
 * 支持函数式模块
 * 函数式模块返回一个 run 方法
 *
 * 使用 Map 保证 函数式模块只 load 一次, 之前是对象字面量 key 不能是函数, 没办法处理.
 *
 * Factories
 * factory 实际上是 provider 的 $get 方法, 实际上, 我们调用 provider 方法为它生产一个 provider (按照 AngularJS 理解)
 * 事实上, 我们可以直接调用 instanceCache.$injector.invoke 方法直接调用, 进行初始化, 将其 keep 到 instanceCache 中
 *
 * factory 必须要有返回值, 因此需要将 factoryFn 进一步封装
 *
 * value 只需要将 value 包装成 function
 *
 * service 将注册的函数, instanceCache.$injector.instantiate
 * */

import _ from 'lodash';

function createInjector(modulesToLoad, strictDi = false) {

	let FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
	let FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
	let STRIP_COMMENTS = /(\/\/.*$)|(\/\*.*?\*\/)/mg;

	let loadedModules = new Map();
	// just a marker for INSTANTIATING's provider
	let INSTANTIATING = {};
	// record dependence path, when error happen, can easily decipher it.
	let path = [];

	// 用于收集所有的 runBlock
	let runBlocks = [];

	let providerCache = {};
	let providerInjector = providerCache.$injector = createInternalInjector(providerCache, function () {
		throw new Error('Unknown provider: ' + path.join(' <- '));
	});
	let instanceCache = {};
	let instanceInjector = instanceCache.$injector = createInternalInjector(instanceCache, function (name) {
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
	}

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

	function enforceReturnValue(factory) {
		return function () {
			let value = instanceInjector.invoke(factory);
			if (_.isUndefined(value)) {
				throw new Error('factory must have a return value');
			}
			return value;
		};
	}

	providerCache.$provide = {
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
		},
		factory(key, factory, force = true) {
			let fn = force ? enforceReturnValue(factory) : factory;
			this.provider(key, {$get: fn});
		},
		value(key, value) {
			this.factory(key, _.constant(value), false);
		},
		service(key, service) {
			this.factory(key, function () {
				return instanceInjector.instantiate(service);
			});
			// instanceCache[key] = instanceInjector.instantiate(service);
			// return instanceInjector;
		}
	};

	function runInvokeQueue(args) {
		let serviceName = args[0];
		let methodName = args[1];
		let methodArgs = args[2];
		providerCache[serviceName][methodName].apply(providerCache[serviceName], methodArgs);
	}

	_.forEach(modulesToLoad, function loadModule(moduleToLoad) {
		if (!loadedModules.has(moduleToLoad)) {
			loadedModules.set(moduleToLoad, true);
			if (_.isString(moduleToLoad)) {
				let module = window.angular.module(moduleToLoad);
				_.forEach(module.requires, loadModule);
				_.forEach(module._invokeQueue, runInvokeQueue);
				_.forEach(module._configBlock, runInvokeQueue);
				// 收集所有的 runBlock
				runBlocks.push(...module._runBlock);

			} else if (_.isArray(moduleToLoad) || _.isFunction(moduleToLoad)) { // 支持函数式模块
				runBlocks.push(providerCache.$injector.invoke(moduleToLoad));
			}
		}
	});

	// 所有 module load 完成后, 运行 runBlock 使用 _.compact 方法是因为 对于函数式模块如果不返回 run 的话, 将将它清除掉.
	_.forEach(_.compact(runBlocks), fn => {
		instanceCache.$injector.invoke(fn);
	});

	return instanceInjector;

}

export default createInjector;
