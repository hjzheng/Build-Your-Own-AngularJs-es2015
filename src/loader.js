function setupModuleLoader(window) {

	let ensure = function (obj, name, factory) {
		return obj[name] || (obj[name] = factory());
	};

	let createModule = function (name, requires, modules) {

		let invokeQueue = [];

		if (name === 'hasOwnProperty') {
			throw new Error('hasOwnProperty is not a valid module name');
		}

		let invokeLater = function (method) {
			return function () {
				invokeQueue.push([method, arguments]);
				return moduleInstance;
			};
		};

		let moduleInstance = {
			name,
			requires,
			constant: invokeLater('constant'),
			provider: invokeLater('provider'),
			_invokeQueue: invokeQueue
		};
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
		return function (name, requires) {
			if (requires) {
				return createModule(name, requires, modules);
			} else {
				return getModule(name, modules);
			}
		};
	});
}

export default setupModuleLoader;
