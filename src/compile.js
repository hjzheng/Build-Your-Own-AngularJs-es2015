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
 * $compile 方法的实现
 * - compileNodes // 遍历传给自己的 Jquery Object, 对每个 node 进行单独处理
 *
 * - collectDirectives // 收集每个 node 上的指令, 通过元素的名称来寻找
 * 需要两个帮助函数 nodeName 和 addDirectives
 *
 * - applyDirectivesToNode // 执行每个指令的 compile 方法, 之后可能更复杂.
 *
 * 3.Recursing to child Elements
 *
 * 4.Using Prefixes with Element Directive
 *
 * prefix x data
 * <x-my-directive></x-my-directive>
 * <data-my-directive></data-my-directive>
 *
 * hyphens : _ -
 * <x:my-directive></x:my-directive>
 * <x_my-directive></x_my-directive>
 *
 * 组合情况 8 种
 *
 * 需要一个正则表达式, 判断 nodeName 时 去掉这些前缀
 *
 * 5.Applying Directives to Attributes
 * - <div my-directive></div> 属性
 * - <div x:my-directive></div> 支持前缀
 * - <div my-directive my-second-directive></div> 多个属性
 * - <my-directive my-directive></my-directive> 元素 + 属性
 * - 支持 ng-attr 开头的属性
 * <div ng-attr-my-directive></div>
 * <div data:ng-attr-my-directive></div>
 *
 * 6.Applying Directives to Classes
 * <div class="my-directive my-second-directive unrelated-class"></div>
 * <div class="x-my-directive"></div>
 *
 * 7.Applying Directives to Comments
 * <!-- directive: my-directive -->
 *
 * 8.Restricting Directives
 * ECMA
 *
 * 在 addDirectives 方法中对 restrict 属性进行过滤
 *
 * restrict 默认是 EA
 *
 * 9.优先级 priority
 * 收集的指令需要按照优先级进行排序
 * 默认是 0
 * 安装优先级执行 compile 方法, 数字越大优先级越高
 *
 * 排序规则
 * 同一元素上的指令
 * 优先级值高, 先执行
 * 优先级相同, 比较指令名称
 * 指令名称也相同, 按照指令注册先后排序
 *
 * 10.terminal
 * 终止指令继续编译
 * 相同优先级的不会终止, 父指令会终止子指令
 * 在 applyDirectivesToNode 方法中处理
 *
 * 11.Applying Directives Across Multiple Nodes
 * */
import _ from 'lodash';
import $ from 'jquery';

export default function $compileProvider($provide) {
	let PREFIX_REGEXP = /(x[\:\-_]|data[\:\-_])/i;
	let hasDirectives = {};

	function nodeName(element) {
		return element.nodeName ? element.nodeName : element[0].nodeName;
	}

	function directiveNormalize(name) {
		return _.camelCase(name.replace(PREFIX_REGEXP, ''));
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
					return _.map(factories, (factory, i) => {
						let ddo = $injector.invoke(factory);
						// restrict 默认值 'EA'
						ddo.restrict = ddo.restrict || 'EA';
						ddo.priority = ddo.priority || 0;

						// 比较优先级有用到 name 和 注册的顺序
						ddo.name = ddo.name || name;
						ddo.index = i;
						return ddo;
					});
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
		function byPriority(a, b) {
			let diff = b.priority - a.priority;
			if (diff === 0) {
				if (a.name !== b.name) {
					return (a.name < b.name ? -1 : 1);
				} else {
					return a.index - b.index;
				}
			} else {
				return diff;
			}
		}

		function compile($compileNodes) {
			compileNodes($compileNodes);
		}

		function compileNodes($compileNodes) {
			_.forEach($compileNodes, node => {
				let directives = collectDirectives(node);
				var terminal = applyDirectivesToNode(directives, node);

				// 支持嵌套
				if (!terminal && node.childNodes && node.childNodes.length !== 0) {
					compileNodes(node.childNodes);
				}
			});
		}

		function collectDirectives(node) {
			let directives = [];
			if (node.nodeType === Node.ELEMENT_NODE) {
				var normalizedNodeName = directiveNormalize(nodeName(node).toLowerCase());
				addDirectives(directives, normalizedNodeName, 'E');

				// 收集属性上的指令
				_.forEach(node.attributes, attr => {
					var normalizedAttrName = directiveNormalize(attr.name.toLowerCase());

					// 如果以 ngAttr 开头, 除过 ngAttr 首字母小写, 后面紧跟
					if (/^ngAttr[A-Z]/.test(normalizedAttrName)) {
						normalizedAttrName = normalizedAttrName[6].toLowerCase() + normalizedAttrName.substring(7);
					}

					addDirectives(directives, normalizedAttrName, 'A');
				});

				// 收集 class 上的指令
				_.forEach(node.classList, cls => {
					var normalizedClassName = directiveNormalize(cls.toLowerCase());
					addDirectives(directives, normalizedClassName, 'C');
				});
			} else if (node.nodeType === Node.COMMENT_NODE) {
				var match = /^\s*directive\:\s*([\d\w\-_]+)/.exec(node.nodeValue);
				if (match) {
					addDirectives(directives, directiveNormalize(match[1]), 'M');
				}
			}

			directives.sort(byPriority);

			return directives;
		}

		function addDirectives(directives, name, mode) {
			if (hasDirectives.hasOwnProperty(name)) {
				let foundDirectives = $injector.get(name + 'Directive');
				let applicableDirectives = _.filter(foundDirectives, d => {
					return d.restrict.includes(mode);
				});
				directives.push.apply(directives, applicableDirectives);
			}
		}

		function applyDirectivesToNode(directives, node) {
			var $compileNode = $(node);
			var terminalPriority = -Number.MAX_VALUE;
			var terminal = false;
			_.forEach(directives, directive => {
				// 优先级低于 terminal 指令的优先级时
				if (directive.priority < terminalPriority) {
					return false;
				}

				if (directive.compile) {
					directive.compile($compileNode);
				}
				if (directive.terminal) {
					terminalPriority = directive.terminal;
					terminal = true;
				}
			});

			return terminal;
		}

		return compile;
	};
}

$compileProvider.$inject = ['$provide'];
