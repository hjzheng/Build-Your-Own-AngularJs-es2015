/**
 * 1.create the $compile Provider
 * 参见 angular_public.js 设置 $compile provider, 确保 injector 可以获得 $compile 服务
 *
 * 2.Registering Directives
 * 需要在 moduleInstance 上增加 directive 方法
 * 参加 load.js
 * directive: invokeLater('$compileProvider', 'directive'),
 * 使用 $compileProvider 上的 directive 方法
 *
 * $compile 方法的实现方式
 * 1. compileNodes // 遍历传给自己的 Jquery Object, 对每个 node 进行单独处理
 *
 * 2. collectDirectives // 收集每个 node 上的指令, 通过元素的名称来寻找
 * 需要两个帮助函数 nodeName 和 addDirectives
 *
 * 3. applyDirectivesToNode // 执行每个指令的 compile 方法, 之后可能更复杂.
 *
 * */
import _ from 'lodash';
import $ from 'jquery';

export default function $compileProvider($provide) {
	let hasDirectives = {};

	function nodeName(element) {
		return element.nodeName ? element.nodeName : element[0].nodeName;
	}

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
	this.$get = function ($injector) {
		function compile($compileNodes) {
			compileNodes($compileNodes);
		}

		function compileNodes($compileNodes) {
			_.forEach($compileNodes, node => {
				let directives = collectDirectives(node);
				applyDirectivesToNode(directives, node);
			});
		}

		function collectDirectives(node) {
			let directives = [];
			var normalizedNodeName = _.camelCase(nodeName(node).toLowerCase());
			addDirectives(directives, normalizedNodeName);
			return directives;
		}

		function addDirectives(directives, name) {
			if (hasDirectives.hasOwnProperty(name)) {
				directives.push.apply(directives, $injector.get(name + 'Directive'));
			}
		}

		function applyDirectivesToNode(directives, node) {
			var $compileNode = $(node);
			_.forEach(directives, directive => {
				if (directive.compile) {
					directive.compile($compileNode);
				}
			});
		}

		return compile;
	};
}

$compileProvider.$inject = ['$provide'];
