var nutritionController = ['$scope','$q', '$mdDialog', '$location', function($scope, $q, $mdDialog, $location) {

	function setrawcookie(name, value, opts) {
		var r = [name + '=' + value],
		s = {
			expires: opts.expires && opts.expires.toGMTString(),
			path: opts.path,
			domain: opts.domain
		},
		i = '';
		for (i in s) {
			if (s.hasOwnProperty(i)) {
				s[i] && r.push(i + '=' + s[i]);
			}
		}

		opts.secure && r.push('secure');
		opts.httpOnly && r.push('HttpOnly');
		console.log(r.join(';'));
		document.cookie = r.join(';');
	}

	var storageType = window.e = {
		"/localstorage": localStorage,
		"/sessionstorage": sessionStorage,
		"/cookies": window.cookie || (function(){
			var cookie = {}
			Object.defineProperty(cookie, "storage", new (function () {
				var aKeys = [], oStorage = {};
				Object.defineProperty(oStorage, "getItem", {
					value: function (sKey) { console.log(aKeys[sKey]); return aKeys[sKey] },
					writable: false,
					configurable: false,
					enumerable: false
				});
				Object.defineProperty(oStorage, "key", {
					value: function (nKeyId) { return nKeyId; },
					writable: false,
					configurable: false,
					enumerable: false
				});
				Object.defineProperty(oStorage, "setItem", {
					value: function(name, value, options) {
						setrawcookie(name, value, options);
						options.domain = options.domain || location.hostname;
						options.expiresDate = options.expiresDate || "Session";
						options.path = options.path || "/";
						options.secure = options.secure || false;
						options.httpOnly = options.httpOnly || false;
						options = angular.copy(options);
						aKeys.push(options);
					},
					writable: false,
					configurable: false,
					enumerable: false
				});
				Object.defineProperty(oStorage, "length", {
					get: function () { return aKeys.length; },
					configurable: false,
					enumerable: false
				});
				Object.defineProperty(oStorage, "clear", {
					value: function () {
						var i = aKeys.length;
						for (;i--;) {
							this.removeItem(aKeys[i]);
						};

						return undefined;
					},
					configurable: false,
					enumerable: false
				});
				Object.defineProperty(oStorage, "removeItem", {
					value: function (sKey) {
						if(!sKey) { return; }
						arrayRemove(aKeys, sKey);
						if(sKey.domain === location.hostname){
							sKey.domain = undefined;
						}
						sKey.expires = new Date();
						setrawcookie(sKey.name, "v", sKey);
					},
					writable: false,
					configurable: false,
					enumerable: false
				});
				this.get = function () {

					var cookies = document.cookie ? document.cookie.split(/\s*;\s*/) : [];
					var rdecode = /(%[0-9A-Z]{2})+/g;
					var i = 0;

					for (; i < cookies.length; i++) {
						var parts = cookies[i].split('=');
						var name = parts[0].replace(rdecode, decodeURIComponent);
						var cookie = parts.slice(1).join('=');

						if (cookie.charAt(0) === '"') {
							cookie = cookie.slice(1, -1);
						}

						aKeys.push({
							name: name,
							value: cookie,
							domain: null,
							path: null,
							expires: null,
							httpOnly: false, // If we can read it with javascript, then its false
							secure: null,
							firstParty: null
						});
					}


					return oStorage;
				};
				this.configurable = false;
				this.enumerable = true;

			})());
			return cookie.storage
		})()
	}[$location.path()];

	$scope.storageTitle = {
		"/localstorage": "LocalStorage",
		"/sessionstorage": "SessionStorage",
		"/cookies": "Cookies"
	}[$location.path()];

	$scope.localStorage = storageType
	update()

	$scope.selected = [];

	$scope.filter = {
		options: {
			debounce: 300
		}
	};

	$scope.query = {
		filter: '',
		order: 'id',
		limit: 5,
		page: 1
	};
	
	$scope.$watch(function(){
		return storageType.length
	}, update);

	function update(){
		var result = [];
		var name, value, item;

		for (var i = 0, len = storageType.length; i < len; i++) {
			name = storageType.key(i);
			value = storageType.getItem(name);
			item = {
				id:i,
				name: name,
				value: value
			}

			angular.isObject(item.value) && angular.extend(item, item.value)

			result.push(item);
		};

		$scope.storage = result;
	}

	$scope.removeFilter = function () {
		$scope.filter.show = false;
		$scope.query.filter = '';

		if($scope.filter.form.$dirty) {
			$scope.filter.form.$setPristine();
		}
	};

	// in the future we may see a few built in alternate headers but in the mean time
	// you can implement your own search header and do something like
	$scope.search = function (predicate) {
		$scope.filter = predicate;
		$scope.deferred = $nutrition.desserts.get($scope.query, success).$promise;
	};

	$scope.onOrderChange = function (order) {
		update();
		$scope.query.order = order;
	};

	$scope.onPaginationChange = function (page, limit) {
		$scope.query.page = page;
		$scope.query.limit = limit;
	};

	$scope.add = function($event){
		var deferred = $q.defer();

		$mdDialog.show({
			targetEvent: $event,
			templateUrl: 'shared/editDialog/editDialog.html',
			controller: 'editDialog',
			controllerAs: 'dialog',
			bindToController: true,
			onComplete: deferred.resolve,
			locals: { item: {value:""}, animate: {sowed:deferred.promise}, storageTitle: $scope.storageTitle }
		}).then(function(res){
			storageType.setItem(res.name, res.value, res);
			update();
		});
	}

	$scope.edit = function($event, item){
		var deferred = $q.defer();

		$mdDialog.show({
			targetEvent: $event,
			templateUrl: 'shared/editDialog/editDialog.html',
			controller: 'editDialog',
			controllerAs: 'dialog',
			bindToController: true,
			onComplete: deferred.resolve,
			locals: { item: angular.copy(item), animate: {sowed:deferred.promise}, storageTitle: $scope.storageTitle }
		}).then(function(res){
			storageType.removeItem(item.name);
			storageType.setItem(res.name, res.value, res);
			update();
		});
	}

	$scope.clear = function(){
		storageType.clear();
		update();
	}

	$scope.destroy = function(){
		$scope.selected.forEach(function(item){
			storageType.removeItem(item.name)
		});
		update();
	}

}];

app.config(['$routeProvider', function($routeProvider) {
	$routeProvider.when('/localstorage', {
		templateUrl: 'components/storage/storage.html',
		controller: nutritionController
	}).when('/sessionstorage', {
		templateUrl: 'components/storage/storage.html',
		controller: nutritionController
	}).when('/cookies', {
		templateUrl: 'components/storage/storage.html',
		controller: nutritionController
	});
}])