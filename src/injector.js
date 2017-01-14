import _ from 'lodash';

function createInjector(modulesToLoad) {

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
		}
	};
}

export default createInjector;
