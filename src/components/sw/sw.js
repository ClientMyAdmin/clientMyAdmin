app.config(['$routeProvider', function($routeProvider) {
	$routeProvider.when('/workers/', {
		templateUrl: 'components/sw/sw.html',
		controller: ["workers", "$q", "$rootScope", function(workers, $q, $rootScope){
			function update(){
				$rootScope.$apply()
			}

			this.workers = workers.map(function(worker){
				worker.active.$$active = true;
				return worker;
			});

			this.toggle = worker => {
				if(worker.active.$$active){
					worker.unregister().then(function(successful){
						if(successful){
							worker.active.$$active = false;	
							update();
						}
					}, function(err){
						console.log("error unregister worker", err);
					})
				} else {
					worker.active.$$active = true;
					navigator.serviceWorker.register(worker.active.scriptURL, {scope: worker.scope})
				}
			}
			
		}],
		controllerAs: 'sw',
		resolve: {
			workers: ["$q", function($q){
				return navigator.serviceWorker.getRegistrations().catch(function(err){
					if(window.opener && err.name === "SecurityError"){
						return opener.navigator.serviceWorker.getRegistrations()
					}
					alert(err);
					return $q.reject(err);
				});
			}]
		}
	});
}]);