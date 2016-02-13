app.controller('db', ["$scope", "$location", "$mdDialog", "db", "$route", "$mdUtil", function ($scope, $location, $mdDialog, db, $route, $mdUtil) {
	var self = this;
	var db;

	self.type = db.type;
	self.$route = $route;
	self.view = db.showStructure ? 'structure' : db.tableRows ? "result" : "dashboard";
	self.databases = db.databases;
	self.database = db.database;
	self.tableRows = db.tableRows;
	self.table = db.table;
	self.tables = db.tables;
	self.version = db.version;
	self.db = window.db = db.db;
	self.tableColumns = db.tableColumns;

	self.go = function(path){
		$location.path(self.type + "/" + (path || ''));
	}

	self.open = function(){
		$mdDialog.show({
			controller: ["$scope", "$mdDialog", function ($scope, $mdDialog) {
				$scope.$mdDialog = $mdDialog;
			}],
			onComplete: function($scope, $element){
				$element.find("input").focus();
			},
			templateUrl: 'components/indexeddb/open.html',
			parent: angular.element(document.body),
			clickOutsideToClose: true
		})
		.then(function(table) {
			self.go(table);
		});
	}

	self.addTable = function($event){
		$mdDialog.show({
			controller: ["$scope", "$mdDialog", function ($scope, $mdDialog) {
				$scope.hide = function() {
					$mdDialog.hide();
				};
				$scope.cancel = function() {
					$mdDialog.cancel();
				};
				$scope.answer = function(answer) {
					$mdDialog.hide(answer);
				};
				$scope.blacklisted = self.db.tables.map(function(t){
					return t.name
				});
				$scope.type = self.type;
			}],
			onComplete: function($scope, $element){
				$element.find("input").focus();
			},
			templateUrl: 'components/indexeddb/addTable.html',
			parent: angular.element(document.body),
			targetEvent: $event,
			clickOutsideToClose: true
		})
		.then(function(table) {
			var src = table.auto+table.keyPath;
			self.db.addTable(table.name, src).then($route.reload);
		});
	}

	self.changeVersion = function(){

		$mdDialog.show({
			controller: ["$scope", "$mdDialog", function ($scope, $mdDialog) {
				$scope.current = db.db.v;
				$scope.version = db.db.v+1;
				$scope.$mdDialog = $mdDialog;
			}],
			onComplete: function($scope, $element){
				$element.find("input").focus();
			},
			templateUrl: 'components/indexeddb/changeVersion.html',
			parent: angular.element(document.body),
			clickOutsideToClose: true
		})
		.then(function(version) {
			self.db.changeVersion(version).then($route.reload);
		});
	}

	self.deleteAll = function(){
		Dexie.deleteAll().then(function(){
			self.go();
		})
	};

	self.newDatabase = function(){
		$mdDialog.show({
			controller: ["$scope", "$mdDialog", function ($scope, $mdDialog) {
				$scope.title = "Add database";
				$scope.$mdDialog = $mdDialog;
				$scope.data = {
					name: "",
					version: undefined
				}
			}],
			onComplete: function($scope, $element){
				$element.find("input").focus();
			},
			templateUrl: 'components/indexeddb/addDatabase.html',
			parent: angular.element(document.body),
			clickOutsideToClose: true
		}).then(function(item){
			if(self.type === "sql"){
				var db = new Websql(item.name);
				db.version((item.version || 1) +"")
				db.open().then(function(db){
					self.go(db.name);
				});
			} else {
				var db = new Dexie(item.name);
				db.version((item.version || 1) / 10)
				db.open().then(function(db){
					self.go(db.name);
				});
			}
		});
	}

	self.copy = function(){
		$mdDialog.show({
			controller: ["$scope", "$mdDialog", function ($scope, $mdDialog) {
				$scope.$mdDialog = $mdDialog;
				$scope.title = 'Copy database "' + db.db.name + '"';
				$scope.data = {
					name: db.db.name + "-copy",
					version: db.db.v
				}
			}],
			templateUrl: 'components/indexeddb/addDatabase.html',
			parent: angular.element(document.body),
			clickOutsideToClose: true
		}).then(function(item){
			db.db.copy(item.name, item.version).then(function(db){
				self.go(item.name);
			});
		});
	}

	self.rename = function(){
		$mdDialog.show({
			controller: ["$scope", "$mdDialog", function ($scope, $mdDialog) {
				$scope.$mdDialog = $mdDialog;
				$scope.title = 'Rename database "' + db.db.name + '"';
				$scope.name = db.db.name + " copy";
				$scope.version = db.v
				$scope.blacklisted = self.databases.map(function(d){return d.name});
			}],
			onComplete: function($scope, $element){
				$element.find("input").focus();
			},
			templateUrl: 'components/indexeddb/addDatabase.html',
			parent: angular.element(document.body),
			clickOutsideToClose: true
		}).then(function(item){
			db.db.rename(item.name).then(function(backup){
				self.go(item.name);
				$scope.$apply();
			});
		});
	}

	self.addRow = function($event) {

		$mdDialog.show({
			controller: ["$scope", "$mdDialog", function ($scope, $mdDialog) {
				$scope.hide = function() {
					$mdDialog.hide();
				};
				$scope.cancel = function() {
					$mdDialog.cancel();
				};
				var primKey = self.db.table(self.table).schema.primKey;
				var kp = primKey.keyPath;
				var e = {};
				e[kp] = 'value';
				
				var resolve = !kp ? "'value'" : primKey.auto ? '{}' : JSON.stringify(e)

				$scope.item={
					value: "return new Promise(function(resolve, reject){\n\tresolve("+resolve+");\n});",
					key: undefined
				};
				$scope.answer = function(answer) {
					Promise.resolve(new Function($scope.item.value)()).then(function(value){
						$mdDialog.hide({value: value, key: $scope.item.key});
					});
				};

				$scope.keyPath = kp;
				$scope.autoIncrement = primKey.auto;

			}],
			templateUrl: 'components/indexeddb/addRow.html',
			parent: angular.element(document.body),
			targetEvent: $event,
			clickOutsideToClose: true
		})
		.then(function(item) {
			var key;

			if(key === "" || key === undefined){
				key = undefined;
			} else {
				try {
					key = JSON.parse(item.key);
				} catch(e){
					key = item.key
				}
			}

			self.db.table(self.table).add(item.value, key).then($route.reload);

		});

	}

	self.truncate = function(table){
		table.nRows = 0;
		self.db.table(table.name).clear();
	}

	self.dropTable = function(table){
		self.db.dropTable(table.name).then($route.reload);
	}

	self.deleteDatabase = function(){
		self.db.delete().then(function(){
			self.go();
		});
	}

	self.deleteItem = function(item){
		if(self.type === 'sql') {
			item.key = item[db.db.table(self.table).schema.primKey.keyPath]
		}

		self.db.table(self.table).delete(item.key).then(self.onPaginationChange);
	}

	$scope.$on('$locationChangeStart', function (event, next, current) {
		next.split("?", 1)[0] !== current.split("?", 1)[0] && 
		self.db && 
		self.db.close() ||
		self.onPaginationChange()
	});

	self.onPaginationChange = self.table ? function(q) {
		var params = $location.search();
		var page = (params.page || 1) - 1;
		var limit = params.limit || 5;
		
		if(self.type === 'sql') {
			var table = self.db.table(self.table);
			// self.tableColumns.splice(0, self.tableColumns.length);
			console.log(table.schema.columns);
			// label: "key (Key path: "rowid", autoIncrement)"
			// name: "key"
			
			self.tableColumns = table.schema.columns

			table.limit(limit).offset(page*limit).toArray().then(function(result) {
				self.tableRows = result;
			});
		} else {
			self.db.table(self.table).offset(page*limit).limit(limit).toObjectArray().then(function(result) {
				self.tableRows = result;
			});
		}

	} : angular.noop;

	self.onPaginationChange();
}])
.controller('db.dashboard', ["$location", "$scope", function($location, $scope){
	var self = this;

	this.init = function(db){
		self.db = db;
	}

	this.filter = {
		options: {

		}
	};
	
	self.query = {
		filter: '',
		order: ''
	};

	$scope.$on('$locationChangeStart', updateSearch);

	function updateSearch() {
		var params = $location.search();

		self.query.page = params.page || 1;
		self.query.limit = params.limit || 5;
	}

	updateSearch()

	this.onPaginationChange = function() {
		var q = self.db.query = self.query;
		$location.search('page', q.page === 1 ? null : q.page);
		$location.search('limit', q.limit === 5 ? null : q.limit);
	}

	this.selected = [];

}])
.controller('db.export', ["$scope", "$q", function($scope, $q){
	var self = this;
	var db = $scope.db.db;
	self.config = {
		format: "vanilla"
	}
	self.mode = "fast";
	
	self.execute = function(){
		db.export(self.config, "", true).then(function(result){
			console.log(result);
			saveAs(new Blob([result]), db.name + ".js");
		})
	}

}])
.config(['$routeProvider', function($routeProvider) {
	$routeProvider.when('/indexeddb/:database?/:view?/:table?', {
		templateUrl: 'components/indexeddb/db.html',
		reloadOnSearch: false,
		controller: 'db',
		controllerAs: 'db',
		resolve: {
			db: ["$q", "$route", "$location", function($q, $route, $location){

				var params = $route.current.params;

				var obj = {
					type: "indexeddb",
					databases: Dexie.getDatabaseNames().then(function(databaseNames){
						var stores = databaseNames.map(function(database){

							var db = new Dexie(database);
							return db.open().then(function(db){
								db.close();
								return {name: db.name, version: db.verno*10}
							});
						});

						return $q.all(stores);
					}),
					table: params.table,
					tables: [],
					view: params.view || "dashboard",
					database: params.database,
					showStructure: !!params.structure
				}

				if(!obj.database) return $q.all(obj);

				obj.db = new Dexie(obj.database).open();
				obj.db.then(function(db){
					obj.version = db.backendDB().version;
					obj.tables.push.apply(obj.tables, db.tables);
					obj.tables.forEach(function(table){
						$q.when(table.count()).then(function(v){
							table.nRows = v;
						});
					});
				})

				if(obj.table){
					obj.tableColumns = [{name: "key"},{name: "value"}];
					obj.tableRows = obj.db.then(function(db){
						var table = db.table(obj.table);
						var primKey = table.schema.primKey;

						obj.tableColumns[0].label = ('key (Key path: "'+primKey.keyPath+'"'+(primKey.auto?', autoIncrement':'')+')').replace('Key path: ""', '').replace(" ()", '').replace(" (, ", ' (');
					});
				}
				
				return $q.all(obj);
			}]
		}
	});
}])
.filter('keyboardShortcut', function() {
	var isOSX = /Mac OS X/.test(navigator.userAgent);
	return function(str) {
		if (!str) return;
		var keys = str.split('-');
		var seperator = (!isOSX || keys.length > 2) ? '+' : '';
		var abbreviations = {
			M: isOSX ? '⌘' : 'Ctrl',
			A: isOSX ? 'Option' : 'Alt',
			S: 'Shift'
		};
		return ""; keys.map(function(key, index) {
			var last = index == keys.length - 1;
			return last ? key : abbreviations[key];
		}).join(seperator);
	};
})
.directive('idbExist', ["$http", "$q", function($http, $q) {
	return {
		require: 'ngModel',
		link: function(scope, element, attrs, ngModel) {
			ngModel.$asyncValidators.exist = function(modelValue, viewValue) {
				return Dexie.exists(viewValue).then(function(exist){
					return exist && $q.reject();
				});	
			};
		}
	};
}]);