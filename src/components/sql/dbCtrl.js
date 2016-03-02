var transactionIds = 0;
var databases = window.databases = [];

function createTransaction(db, dbName, readonly, args) {
	var transactionId = ++transactionIds;
	var prefix = dbName + ': ' + (readonly ? 'r transaction' : 'r/w transaction') + ' #' + transactionId;
	var transactionMethod = db[readonly ? 'readTransaction' : 'transaction'];

	var callback = args[0];
	if (callback) {
		args[0] = function (tx) {
			var proxyTransaction = {
				executeSql : function (sql, sqlArgs, success, failure) {
					console.log(prefix + ': ' + sql + (sqlArgs, JSON.stringify(sqlArgs) : ''));
					tx.executeSql(sql, sqlArgs, function(tx, res){
						// Safari can't handle to cast this to an array with Array.from
                        // Its not arrayLike in Safari...
                        // var value = Array.from(result.rows);

						var rows = res.rows;
						var len = rows.length;
						var arr = Array(len);
						var i = 0;

						for (; i < len; i++) {
							arr[i] = rows.item(i)
						}

						res = {rows: arr, rowsAffected: res.rowsAffected}
						success(tx, res);
					}, failure);
				}
			};
			callback(proxyTransaction);
		};
	}
	transactionMethod.apply(db, args);
}
if (window.openDatabase) {
	var oldOpenDatabase = window.openDatabase;
	window.openDatabase = function(a,b,c,d){
		var db = oldOpenDatabase(a,b,c,d);
		var dbName = arguments[0];

		window.databases.push(Array.from(arguments))

		var database = {
			changeVersion: db.changeVersion.bind(db),
			transaction : function(){
				return createTransaction(db, dbName, false, Array.from(arguments));
			},
			readTransaction : function(){
				return createTransaction(db, dbName, true, Array.from(arguments));
			}
		};

		Object.defineProperty(database, 'version', {
			get: function(){
				return db.version
			}
		});

		return database;
	};
}

app.controller('sql', ["websql", "$location", "db", "$mdDialog", "$filter", "$route", function(websql, $location, db, $mdDialog, $filter, $route){
	var self = this;

	self.type = "sql";
	self.view = db.showStructure ? 'structure' : db.tableRows ? "result" : "dashboard";
	self.databases = databases;
	self.database = db.database;
	self.tableRows = db.tableRows;
	self.table = db.table;
	self.tables = db.tables;
	self.version = db.version;
	self.db = db.db;
	self.$route = $route;

	var t = self.table && $filter('filter')(self.tables, {name:self.table})[0];

	if(db.tableRows){
		self.tableColumns = t.structure.reduce(function(prev, v){
			prev.push({name:v})
			return prev;
		}, [{name:'rowid'}])
	}

	self.go = function(path){
		$location.path("sql/");
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
				$scope.blacklisted = self.tables.map(function(t){
					return t.name
				});
				$scope.blacklisted.$caseInsensitive = true;
			}],
			templateUrl: 'components/indexeddb/addTable.html',
			parent: angular.element(document.body),
			targetEvent: $event,
			clickOutsideToClose: true
		})
		.then(function(table) {
			var src = table.auto+table.keyPath;

			self.db.addTable(table.name, src).then(function(db){
				self.go(self.database + "/" + Math.round(db.verno * 10));
				$scope.$apply();
			});
		});
	}

	self.open = function(){
		$mdDialog.show({
			controller: ["$scope", "$mdDialog", function ($scope, $mdDialog) {
				$scope.$mdDialog = $mdDialog;
			}],
			templateUrl: 'components/indexeddb/open.html',
			parent: angular.element(document.body),
			targetEvent: $event,
			clickOutsideToClose: true
		})
		.then(function(table) {
			alert(table);
		});
	}

	self.truncate = function(table){
		table.nRows = 0;
		websql.execute(self.db, 'Delete from '+table.name);
	}

	self.dropTable = function(table){
		websql.execute(self.db, 'DROP TABLE '+table.name);
		arrayRemove(self.tables, table);
	}

	self.deleteDatabase = function(){
		websql.emptyDatabase(self.db);
		self.go("");
	}

}])

// app.config(['$routeProvider', function($routeProvider) {
// 	$routeProvider.when('/sql/:database?/:version?/:table?', {
// 		templateUrl: 'components/indexeddb/db.html',
// 		controller: 'sql',
// 		controllerAs: 'db',
// 		resolve: {
// 			db: ["$q", "$route", "$location", "websql", function($q, $route, $location, websql){
// 				var params = $route.current.params;

// 				var obj = {
// 					databases: [],
// 					table: params.table,
// 					version: params.version,
// 					database: params.database,
// 					showStructure: !!params.structure
// 				}


// 				if(!obj.database) return $q.resolve(obj);

// 				obj.db = websql.openDatabase(params.database, params.version, "", 1024*2)
// 				obj.tables = websql.getTables(obj.db);

// 				if(obj.showStructure){
// 					return $q.all(obj);
// 				}
// 				else if(obj.table){
// 					obj.tableRows = websql.select(obj.db, "select rowid, * FROM "+obj.table).then(function(res){
// 						return res.rows;
// 					}).catch(function(err){
// 						return obj.tableRows = websql.select(obj.db, "select * FROM "+obj.table).then(function(res){
// 							return res.rows;
// 						});
// 					});
// 				} else {
// 					obj.tables = obj.tables.then(function(tables){
// 						if(!tables.length) return tables;

// 						var sql = "SELECT "
// 						tables.forEach(function(table, i){
// 							sql += (i?', ':'') + '(select count(*) from '+table.name+') as "'+i+'"'
// 						});

// 						return websql.select(obj.db, sql).then(function(res){

// 							for (var i = tables.length; i--;) {
// 								tables[i].nRows = res.rows[0][i];
// 							};

// 							return tables;
// 						});
// 					})
// 				}

// 				return $q.all(obj)
// 			}]
// 		}
// 	});
// }])
app.config(['$routeProvider', function($routeProvider) {
	$routeProvider.when('/sql/:database?/:view?/:table?', {
		templateUrl: 'components/indexeddb/db.html',
		reloadOnSearch: false,
		controller: 'db',
		controllerAs: 'db',
		resolve: {
			db: ["$q", "$route", "$location", "websql", function($q, $route, $location, websql){

				var params = $route.current.params;

				var obj = {
					type: "sql",
					databases: [],
					table: params.table,
					tables: [],
					view: params.view || "dashboard",
					database: params.database,
					showStructure: !!params.structure
				}

				if(!obj.database) return $q.all(obj);

				obj.db = new websql(obj.database).open();
				obj.db.then(function(db){
					obj.version = db.backendDB().version;

					obj.tables.push.apply(obj.tables, db.tables);
					obj.tables.forEach(function(table){
						$q.when(table.count()).then(function(v){
							table.nRows = v;
						})
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
.directive('sqlExist', ["websql", "$q", function(websql, $q) {
    return {
        require: 'ngModel',
        link: function(scope, element, attrs, ngModel) {
        	ngModel.$asyncValidators.exist = function(modelValue, viewValue) {
        		return websql.exist(viewValue).then(function(exist){
    				return exist && $q.reject();
    			});
            };
        }
    };
}]);

