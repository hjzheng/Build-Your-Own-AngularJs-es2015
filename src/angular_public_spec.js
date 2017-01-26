import publishExternalAPI from './angular_public';
import createInjector from './injector';

describe('angularPublic', () => {

	it('sets up the angular object and the module loader', () => {
		publishExternalAPI();

		expect(window.angular).toBeDefined();
		expect(window.angular.module).toBeDefined();
	});

	it('sets up the ng module', () => {
		publishExternalAPI();

		expect(createInjector(['ng'])).toBeDefined();
	});

	// it('sets up the $filter service', function() {
	// 	publishExternalAPI();
	// 	var injector = createInjector(['ng']);
	// 	expect(injector.has('$filter')).toBe(true);
	// });
	//
	// it('sets up the $parse service', function() {
	// 	publishExternalAPI();
	// 	var injector = createInjector(['ng']);
	// 	expect(injector.has('$parse')).toBe(true);
	// });

	it('sets up the $rootScope', () => {
		publishExternalAPI();
		var injector = createInjector(['ng']);
		expect(injector.has('$rootScope')).toBe(true);
	});

	// 第 16 章, 配置 $compile
	it('sets up the $compile', () => {
		publishExternalAPI();
		var injector = createInjector(['ng']);
		expect(injector.has('$compile')).toBe(true);
	});
});
