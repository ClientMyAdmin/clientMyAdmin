app.factory('fileSystem', ['$q', '$timeout', '$rootScope', function($q, $timeout, $rootScope) {

	var type = function(c){var d={}.toString;return function(a){if(a===c)return"global";var b=typeof a;return"object"!=b?b:d.call(a).slice(8,-1).toLowerCase()}}(this);
	var rq = window.requestFileSystem || window.webkitRequestFileSystem;

	class FileSystem {
		constructor(type){
			var self = this;

			self.cwdFiles = [];

			return $q(function(resolve, reject){
				rq(type, "", function(fs) {
					self.fs = fs;
					self.cwd = fs.root;

					self.type = type ? 'persistent':'temporary';

					self.Folder = class Folder extends Array{
						constructor(name){
							super();
							Object.defineProperty(this, '$$name', {value: name, writable: true});
						}

						push(item){
							var index = this.length++;
							this[index] = item;
							Object.defineProperty(item, '$$parent', {value: this});
							return index;
						}

						get name(){
							return this.$$name;
						}

						set name(value){
							var src = this.fullPath;
							this.$$name = value;
							var dest = this.fullPath;
							console.log(self.mv(src, dest));
							return value;
						}

						get type(){
							return "inode/directory"
						}

						get fullPath(){
							var name = (this.$$parent || {}).fullPath || "";
							return (name.length>1 ? name:'') + "/" + this.name
						}

						get size(){
							return this.reduce(function(size, item){
								return size + item.size;
							}, 0);
						}
					}

					self.File = class File {
						constructor(name, size, type, lastModified){
							Object.defineProperty(this, '$$name', {value: name});
							this.size = size;
							this.type = type;
						}

						get fullPath(){
							var name = (this.$$parent || {}).fullPath || "";
							return (name.length>1 ? name:'') + "/" + this.name
						}

						get name(){
							return this.$$name;
						}

						set name(value){
							return this.$$name = value;
						}

					}

					var store = navigator[type?'webkitPersistentStorage':'webkitTemporaryStorage'];
					var query = store.queryUsageAndQuota.bind(store);


					self.query = function(orig){
						return function(result){
							query(function(u, a){
								self.used = u;
								self.avalible = a;
								orig(result);
							})
						}
					};

					self.query(resolve)(self)

					// var result = self.walk(fs.root, function(){
					// });
					// self.root = result["/"]

				});
			});
		}

		mv( src, dest ){
			var cwd = this.cwd;

			var i = dest.lastIndexOf("/") + 1;
			var destName = dest.substring(i);
			var destDir = dest.substring(0, i);

			var justRename = (src.substring(0, src.lastIndexOf("/") + 1) === destDir)

			return $q(function(resolve, reject){

				cwd.getFile(src, {create: false}, function(fileEntry) {
					console.log()
					fileEntry.moveTo(cwd, dest, resolve, reject);
				}, function(err){
					if(err.name === "TypeMismatchError"){
						return $q(function(resolve, reject){
							cwd.getDirectory(src, {create: false}, function(fileEntry) {
								var i = dest.lastIndexOf("/") + 1;
								var name = dest.substring(i);
								var dir = dest.substring(0, i);

								cwd.getDirectory(dir, {create: false}, function(dest) {
									fileEntry.moveTo(dest, name, resolve, reject);
								});
							}, reject);
						}).catch(function(e){
							console.log(e);
						})
					}

					return $q.reject(err);
				});

			});
		}

		cd( path ){
			var self = this;
			return $q(function(resolve, reject){
				self.cwd.getDirectory(path, {}, function(dirEntry){
					self.cwd = dirEntry;
					resolve(dirEntry)
				}, reject)
			})
		}

		rm( flags, pathOrEntry ){
			// TODO should be able to remove dir also and rescrusive
			if(arguments.length === 1){
				pathOrEntry = flags;
				flags = ""
			}
			var self = this;
			var kind = type(pathOrEntry);
			var rescrusive = ~flags.indexOf("r")

			switch(kind){
				case "string":
					return $q(function(resolve, reject){
						self.cwd.getFile(pathOrEntry, {create:false}, function(fileEntry) {
							fileEntry.remove(self.query(resolve), reject);
						}, reject);
					}).catch(function(e){
						if(e.name == "TypeMismatchError") //  its a dir

							return $q(function(resolve, reject){

								self.cwd.getDirectory(pathOrEntry, {create: true}, function( dirEntry ){
									dirEntry[rescrusive ? 'removeRecursively' : 'remove'](self.query(resolve), reject);
								})

							});

						return $q.reject(e);
					})
				break

				case "fileentry": rescrusive = 0
				case "directoryentry":
					return $q(function(resolve, reject){
						pathOrEntry[rescrusive ? 'removeRecursively':'remove'](self.query(resolve), reject);
					});
				break
			}

		}

		touch(...files){
			var cwd = this.cwd;
			var self = this;

			return $q.all(files.map(function(fileName){
				return $q(function(resolve, reject){
					cwd.getFile(fileName, {create: true}, self.query(resolve), reject)
				});
			}));
		}

		ls( path, callback ){
			var value = [];

			this.cwd.createReader().readEntries(function(entries) {

				var names = entries.map(function(entry){
					return entry.name
				});

				console.log(names.join("\n"))

				value.push.apply(value, names)

				if(callback) callback(value)
			});

			return value;
		}

		cp( src, dest, newName ){
			var cwd = this.cwd;
			var self = this;

			return $q(function(resolve, reject){

				switch (type(src)){
					case "fileentry":
						src.copyTo(dest, newName, self.query(resolve), reject);
						return;
					case "string":
						// TODO: move in filesystem
					break
					case "arraybuffer":
						src = new Blob([src]);
					case "file":
					case "blob":
						cwd.getFile(dest, {create: true}, function(fileEntry){
							fileEntry.createWriter(function(fileWriter){
								fileWriter.onwriteend = function(){
									cwd.getFile(dest, {create: false}, self.query(resolve), reject);
								};
								fileWriter.onerror = reject;
								fileWriter.write(src);
							});
						}, reject);
					break
					default:
						console.log( type(src) )

				}

			})

		}

		clear() {
			var fs = this;
			return $q(function(resolve, reject){
				fs.cwd.filesystem.root.createReader().readEntries(function(entries) {
					$q.all(entries.map(function(entry){
						return fs.rm("-r", entry);
					})).then(resolve, reject);
				});
			})
		}

		mkdir( config, path ){
			var root = this.cwd;
			var self = this;
			if(arguments.length === 1){
				path = config;
				config = ""
			}

			return $q(function(resolve, reject){
				if( !~config.indexOf("p") ){
					root.getDirectory(path, {create: true}, self.query(resolve), reject);
				} else {
					var sequence = $q.when();

					function createFolder( folder ) {
						return sequence = sequence.then(function(){
							return $q(function( resolve, reject ) {
								root.getDirectory(folder, {create: true}, function( dirEntry ){
									root = dirEntry;
									resolve(dirEntry);
								}, reject);
							});
						});
					}

					path.split("/").filter(function(a){return !!a}).forEach(createFolder);
					sequence.then(self.query(resolve), reject);
				}
			})

		}

		rmdir( path ) {
			var cwd = this.cwd;

			return $q(function(resolve, reject){
				cwd.getDirectory(path, {}, function(dirEntry){
					dirEntry.remove(self.query(resolve), reject);
				}, reject);
			});

		}

		walk( dirEntry, cb ){
			var fs = this;
			var stats = {files: 0, size: 0, folders: 0, $pending: 0, $done: false, "/": new fs.Folder("")};
			var sequence = $q.when();

			function pending(i){
				stats.$pending += i;
				if(stats.$pending === 0){
					console.log(stats.$pending);
					cb(stats);
				}
			}

			function readFolder( dirEntry, cwd ) {
				pending(1);
				dirEntry.createReader().readEntries(function(entries) {

					entries.forEach(function(entry){

						if(entry.isFile) {
							stats.files += 1;

							pending(1);
							entry.file(function(e){
								cwd.push(new fs.File(entry.name, e.size, e.type, e.lastModified));
								pending(-1);
							});
						} else {
							var folder = new fs.Folder(entry.name);
							cwd.push(folder);
							stats.folders += 1;
							readFolder(entry, folder);
						}
					});

					pending(-1);
				});
			}

			readFolder(dirEntry, stats["/"]);

			return stats;
		}

		getFolderContents() {
			var fs = this;

			fs.cwd.createReader().readEntries(function(entries) {
				fs.cwdFiles.$resolved = false;
				fs.cwdFiles.$promise = $q.all(entries.map(function(entry){
					return $q(function(resolve, reject){
						if(entry.isFile){
							entry.file(function(file){
								angular.extend(entry, {
									size: file.size,
									lastModifiedDate: file.lastModifiedDate,
									type: file.type
								})
								resolve(entry);
							});
						} else {
							entry.getMetadata(function(data){
								entry.lastModifiedDate = data.modificationTime,
								entry.type = "inode/directory"
								resolve(entry);
							});
						}
					});
				})).then(function(files){
					// We want to keep the same reference to the array
					// so we need to modify it
					fs.cwdFiles.splice(0, fs.cwdFiles.length);
					fs.cwdFiles.push.apply(fs.cwdFiles, files);
					fs.cwdFiles.$resolved = true;

					return self.cwdFiles;
				})
			});

			return fs.cwdFiles;
		}
	}

	return FileSystem;
}]);



/*
self.Folder = class Folder extends Array{
	constructor(name, lastModifiedDate){
		super();

		Object.defineProperty(this, 'lastModifiedDate', {value: lastModifiedDate});
		Object.defineProperty(this, '$$name', {value: name, writable: true});
	}

	push(item){
		var index = this.length++;
		this[index] = item;
		Object.defineProperty(item, '$$parent', {value: this});
		return index;
	}

	get name(){
		return this.$$name;
	}

	set name(value){

		fs.root.getDirectory(this.fullPath, {}, function(dirEntry) {
			dirEntry.getParent(function(parent){
				dirEntry.moveTo(parent, value);
			});
		});

		this.$$name = value;

		return value;
	}

	get type(){
		return "inode/directory"
	}

	get fullPath(){
		var name = (this.$$parent || {}).fullPath || "";
		return (name.length>1 ? name:'') + "/" + this.name
	}

	get size(){
		return this.reduce(function(size, item){
			return size + item.size;
		}, 0);
	}

	search(folder){
		var dir = this;
		var parts = path.split("/");
		var parts2 = path.split("/");
		var j = 0;
		var i = 0;

		for (; i-- ; ) {
			for (; i-- ; ) {
				Things[i]
			}
		}

	}
}

self.File = class File {
	constructor(name, size, type, lastModifiedDate){
		Object.defineProperty(this, '$$name', {value: name});
		this.size = size;
		this.type = type;
		this.lastModifiedDate = lastModifiedDate;
	}

	get fullPath(){
		var name = (this.$$parent || {}).fullPath || "";
		return (name.length>1 ? name:'') + "/" + this.name
	}

	get name(){
		return this.$$name;
	}

	set name(value){
		return this.$$name = value;
	}

}

var result = self.walk(fs.root, function(){
	resolve(self);
});
self.root = result["/"]
*/