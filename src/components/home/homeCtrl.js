app.controller('AppCtrl', ["$scope", "$location", function ($scope, $location) {
	this.menu =  [
		{
			link : '/permission',
			title: 'Permission',
			icon: 'lock_open'
		},
		{
			link : '/localstorage',
			title: 'LocalStorage',
			icon: 'storage'
		},
		{
			link : '/sessionstorage',
			title: 'SessionStorage',
			icon: 'storage'
		},
		{
			link : '/filesystem',
			title: 'File system',
			icon: 'folder'
		},
		{
			link : '/cookies',
			title: 'Cookies',
			icon: 'cake'
		},
		{
			link : '/sql',
			title: 'Web Sql',
			icon: 'code'
		},
		{
			link : '/indexeddb',
			title: 'IndexedDB',
			icon: 'storage'
		},
		{
			link : '/cache',
			title: 'Cache',
			icon: 'storage'
		},
		{
			link : '/workers',
			title: 'Web Workers',
			icon: 'settings'
			// ServiceWorkerContainer.getRegistrations()
		}
	]

	$scope.go = function ( path ) {
		$location.path( path );
	};

}])
.config(['$routeProvider', function($routeProvider) {
	$routeProvider.when('/', {
		templateUrl: 'components/home/home.html',
		controller: 'AppCtrl',
		controllerAs: 'app'
	}).otherwise({
		redirectTo: '/'
	});
}])