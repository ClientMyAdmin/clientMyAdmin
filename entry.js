window.arrayRemove = function(array, value) {
	var index = array.indexOf(value);
	if (index >= 0) {
		array.splice(index, 1);
	}
	return index;
}

function load(src) {

	return new Promise(function(resolve, reject) {
		var script = document.createElement("script");
		script.src = src;
		script.onload = function(){script.remove(),resolve()}
		document.head.appendChild(script);
	});

}

Promise.all([
	// Load 3d party lib
	load('https://ajax.googleapis.com/ajax/libs/angularjs/1.4.5/angular.min.js'),
	load('https://cdnjs.cloudflare.com/ajax/libs/ace/1.2.0/ace.min.js'),
	load('https://cdnjs.cloudflare.com/ajax/libs/dexie/1.2.0/Dexie.js'),
	load('https://cdn.gitcdn.xyz/cdn/codeschool/sqlite-parser/5cfa81210be12a96a040f9e66552e7c3b2316638/dist/sqlite-parser-min.js')
	// load('https://gitcdn.xyz/repo/kripken/sql.js/master/js/sql.js')
]).then(function(){
	// Load 3d party plugins that depends on angular
	return Promise.all([
		load('https://ajax.googleapis.com/ajax/libs/angularjs/1.4.5/angular-animate.min.js'),
		load('https://ajax.googleapis.com/ajax/libs/angularjs/1.4.5/angular-messages.min.js'),
		load('https://ajax.googleapis.com/ajax/libs/angularjs/1.4.5/angular-aria.min.js'),
		load('https://ajax.googleapis.com/ajax/libs/angularjs/1.4.5/angular-route.min.js'),
		load('https://gitcdn.xyz/repo/angular/bower-material/master/angular-material.js')
	]);
}).then(function() {
	
	window.app = angular.module('myApp', ['ngMessages', 'ngMaterial', 'ngRoute', 'ngAnimate', 'md.data.table', 'ui.ace'])

	ace.config.set("basePath", "https://cdnjs.cloudflare.com/ajax/libs/ace/1.2.0/");

	var templates=require.context("./src/", true, /^./);
	templates.keys().forEach(function(key) {
		templates(key);
	});
	
	app.config(["$provide", function($provide) {
		
		$provide.decorator("$rootScope", ["$delegate", function($delegate) {
			var origThen = Dexie.Promise.prototype.then;
			var timer = null;
			Dexie.Promise.prototype.then = function(success){
				var args = Array.from(arguments);
				if(typeof success === 'function'){
					args[0] = function(e){
						clearTimeout(timer);
						timer = setTimeout(function(){
							$delegate.$apply();
						},0);
						return success(e)
					}
				}
				return origThen.apply(this, args);
			};
			return $delegate;
		}]);

	}]);


	Dexie.addons.push(function(db){

		db.Collection.prototype.toObjectArray = Dexie.override (db.Collection.prototype.each, function (originalEach) {
			return function () {

				var returnValue = [];
				return originalEach.apply(this, [function(value, item){
					returnValue.push({key:item.key, value:value})
				}]).then(function(){
					return returnValue
				})

			}
		});

		var originalOpen = db.open;



		Dexie.Promise.prototype.onuncatched = function(err){
			console.warn("uncatch error", err);
		}
		
		db.open = function(){
			return originalOpen.apply(this, []).then(function(){
				return db;
			})
		}

		db.addTable = function(name, src){
			var stores = this.stores();
			var db = new Dexie(this.name);
			this.close();
			db.version(this.verno).stores(stores);
			stores = angular.copy(stores);
			stores[name] = src;
			db.version(this.verno+0.1).stores(stores)
			return db.open();
		}

		db.dropTable = function(table){
			var self = this;
			self.close();

			return new Dexie.Promise(function(resolve, reject){

				var db = indexedDB.open(self.name, self.v+1);

	            db.onupgradeneeded = function(evt){
					event.target.result.deleteObjectStore(table);
					event.target.result.close();
					(new Dexie(event.target.result.name)).open().then(function(db){
						resolve(db);
					})
	            }

			});
		}

		db.stores = function(){
			var stores = {};
			db.tables.forEach(function (t, i) {
				stores[t.name] =
					[t.schema.primKey]
					.concat(t.schema.indexes)
					.map(function (index){
						return index.src;
					})
					.join(',');
			});
			return stores;
		}

		db.copy = function(name, version){
			return new Dexie.Promise(function(resolve){
				db.export({version: version, name: name}, resolve).then(function(result){
					result()
				});
			});
		}

		db.rename = function(name){
			return new Dexie.Promise(function(resolve){
				db.export({name: name}, resolve).then(function(result){
					db.delete().then(function(){
						result();
					});
				});
			});
		}

		db.changeVersion = function(v){
			
			if(v < this.v){
				var self = this;
				return new Dexie.Promise(function(resolve){
					self.export({version: v}, resolve).then(function(result){
						self.delete().then(function(){
							result()
						});
					});
				});

			} else {
				this.close();
				var db = indexedDB.open(this.name, v);
				db.onsuccess = function(evt){
					evt.target.result.close();
				}
				return this.open();
			}
		}

		var importFn = function(data) {
			var request = indexedDB.open(data.name, data.version);

			request.onsuccess = function(){
				var db = event.target.result.close();
				if(typeof data.callback === "string"){
					window[data.callback]()
				}
				
				if(typeof data.callback === "function"){
					data.callback();
				}
			}

			request.onupgradeneeded = function(event) {
				var db = event.target.result;

				data.tables.forEach(function(table) {
					var store, schema, idx, i;

					schema = table.schema;
					
					store = db.createObjectStore(schema.name, { keyPath: schema.primKey.keyPath || undefined, autoIncrement: schema.primKey.auto });

					for (i in schema.indexes) {
						idx = schema.indexes[i];
						store.createIndex(idx.name, idx.keyPath, { unique: idx.unique, multiEntry: idx.multi});
					}

					store.transaction.addEventListener('complete', function(){
						var store = db.transaction(schema.name, "readwrite").objectStore(schema.name);
						for (var i in table.content) {
							if(schema.primKey.keyPath){
								store.add(table.content[i].value);
							} else {
								store.add(table.content[i].value, table.content[i].key);
							}
						}
					});

				})

			};

		}

		Object.defineProperty(db, "v", { 
			get: function (){ 
				return Math.round(this.verno * 10); 
			} 
		});


		db.export = function(override, callback, stringify) {
			var version = this.backendDB().version;
					
			return Dexie.Promise.all(db.tables.map(function (t) {

				return t.toCollection().toObjectArray().then(function(content){
					return {
						name: t.name,
						content: content,
						schema: t.schema
					}
				})

			})).then(function(result){
				result = {
					name: override.name || db.name,
					version: override.version || version,
					tables: result
				}

				callback && (result.callback = callback);

				return stringify ? asyncJSON.stringify(result).then(function(result) {
					return ";("+importFn.toString()+")("+result+")";
				}) : importFn.bind(undefined, result);
				
			});

		}

	})

	
	Dexie.deleteAll = function(){
		return Dexie.getDatabaseNames().then(function(names){
			return Dexie.Promise.all(names.map(Dexie.delete));
		})
	}

	var viewPortTag = document.createElement('meta');
	viewPortTag.id = 'viewport';
	viewPortTag.name = 'viewport';
	viewPortTag.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0';

	document.head.appendChild(viewPortTag);
	document.body.setAttribute('ng-view', '');

	angular.bootstrap(document, ['myApp']);

});