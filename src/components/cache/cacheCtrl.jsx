var cache = ['keys', '$location', function(keys, $location) {
	this.keys = keys;
	console.log(keys)
	this.open = function(storage){
		$location.path("/cache/" + storage);
	}
}];

app.config(['$routeProvider', function($routeProvider) {

	$routeProvider.when('/cache/:type/', {
		templateUrl: 'components/cache/cache.html',
		controller: cache,
		controllerAs: 'cache',
		resolve: {
			keys: ["$route", function($route) {
				return caches.open($route.current.params.type).then(e=>e.keys())
			}]
		}
	}).when('/cache/', {
		templateUrl: 'components/cache/cache.html',
		controller: cache,
		controllerAs: 'cache',
		resolve: {
			keys: () => {
				return caches.keys();
			}
		}
	});

}]);