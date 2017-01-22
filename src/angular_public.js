
import setupModuleLoader from './loader';
import $rootScopeProvider from './scope';

export default function publishExternalAPI() {
	// 安装 module loader
	setupModuleLoader(window);
	// 创建 ng module
	let ngModule = window.angular.module('ng', []);
	ngModule.provider('$rootScope', $rootScopeProvider);
}
