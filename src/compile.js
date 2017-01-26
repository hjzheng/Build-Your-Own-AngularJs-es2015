/**
 * 1.create the $compile Provider
 * 参见 angular_public.js 设置 $compile provider, 确保 injector 可以获得 $compile 服务
 *
 * 2.Registering Directives
 * 需要在 moduleInstance 上增加 directive 方法
 * 参加 load.js
 * directive: invokeLater('$compileProvider', 'directive'),
 * 使用 $compileProvider 上的 directive 方法
 * */
import _ from 'lodash';

export default function $compileProvider($provide) {
	let hasDirectives = {};
	this.directive = function (name, directiveFactory) {
		if (_.isString(name)) {
			if (name === 'hasOwnProperty') {
				throw new Error('hasOwnProperty can not be a valid directive name');
			}

			if (!hasDirectives.hasOwnProperty(name)) {
				hasDirectives[name] = [];
				$provide.factory(name + 'Directive', ['$injector', function ($injector) {
					let factories = hasDirectives[name];
					return _.map(factories, $injector.invoke);
				}]);
			}
			hasDirectives[name].push(directiveFactory);
		} else {
			_.forEach(name, (directiveFactory, name) => {
				this.directive(name, directiveFactory);
			});
		}
	};
	this.$get = function () {
		function compile($compileNodes) {
		}

		return compile;
	};
}

$compileProvider.$inject = ['$provide'];
