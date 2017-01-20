function setupModuleLoader(window) {

	let ensure = function (obj, name, factory) {
		return obj[name] || (obj[name] = factory());
	};

	let createModule = function (name, requires, modules, configFn) {

		let invokeQueue = [];
		let configBlock = [];

		if (name === 'hasOwnProperty') {
			throw new Error('hasOwnProperty is not a valid module name');
		}

		let invokeLater = function (service, method, arrayMethod, queue = invokeQueue) {
			return function () {
				queue[arrayMethod || 'push']([service, method, arguments]);
				return moduleInstance;
			};
		};

		let moduleInstance = {
			name,
			requires,
			constant: invokeLater('$provide', 'constant', 'unshift'),
			provider: invokeLater('$provide', 'provider'),
			factory: invokeLater('$provide', 'factory'),
			value: invokeLater('$provide', 'value'),
			service: invokeLater('$provide', 'service'),
			config: invokeLater('$injector', 'invoke', 'push', configBlock),
			run(runFn) {
				this._runBlock.push(runFn);
				return this;
			},
			_invokeQueue: invokeQueue,
			_configBlock: configBlock,
			_runBlock: []
		};

		if (configFn) {
			moduleInstance.config(configFn);
		}

		modules[name] = moduleInstance;
		return moduleInstance;
	};

	let getModule = function (name, modules) {
		if (modules.hasOwnProperty(name)) {
			return modules[name];
		} else {
			throw new Error(`Module ${name} is not available!`);
		}
	};

	let angular = ensure(window, 'angular', Object);

	ensure(angular, 'module', () => {
		let modules = {};
		return function (name, requires, configFn) {
			if (requires) {
				return createModule(name, requires, modules, configFn);
			} else {
				return getModule(name, modules);
			}
		};
	});
}

export default setupModuleLoader;
