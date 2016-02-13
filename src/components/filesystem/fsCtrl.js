var fsCtrl = ['$scope','$q', '$mdDialog', '$location', '$routeParams','fileSystem', 'fs', function($scope, $q, $mdDialog, $location, $routeParams, fileSystem, fs) {
	this.$routeParams = $routeParams;

	window.fss = fs;

	var currentDir = ("/" + ($routeParams.dir || '') + "/").replace(/\/*$/, "/")

	$scope.messages = ['Click a button'];
	$scope.selected = [];

	var next = "";

	this.pathArray = fs.cwd && fs.cwd.fullPath.split("/").filter(a=>a).reduce(function(prev, current){
		prev.push({fullPath: next + current, name: current});
		next += current + "/";
		return prev;
	}, []);

	this.opts = {
		add: function(type, blob, lastModifiedDate, name, size, mimetype, fullPath){
			fullPath = fullPath.replace("/", "") // remove First slash

			// if(type !== "file"){
			// 	fullPath = fullPath.replace("/", "")
			// }

			var to = currentDir + fullPath;
			// console.log(to)
			if(type == "file"){
				fs.cp(blob, to).then(function(e) {

					if(!~fullPath.indexOf("/", 1)){
						$scope.files.push(e)
					}

				}, function(err) {
					alert(err.message);
				});
			} else {
				fs.mkdir("-p", to.replace(/\.$/, "")).then(function(dirEntry) {
					$scope.files = fs.getFolderContents();
				}, function(e){
					alert(e.name)
				});
			}
		}
	}

	this.deleteSelected = function(){
		$q.all($scope.selected.map(function(entry){
			fs.rm("-r", entry).then(function(){
				arrayRemove($scope.selected, entry);
				arrayRemove($scope.files, entry);
			});
		}));
	}

	this.clear = function() {

		fs.clear().then(function() {
			$scope.files = [];
			$location.path("/filesystem/"+$routeParams.type);
		});

	};

	this.createFolder = function(){
		var path = prompt("Folder name");
		if(!path) return;

		fs.mkdir(path).then(function(dirEntry){
			$scope.files = fs.getFolderContents();
		});
	};

	this.createFile = function(){
		var file = prompt("File name", "example.txt");
		if(!file) return;

		fs.touch(file).then(function(fileEntry){
			$scope.files = fs.getFolderContents();
		});
	};

	this.dublicate = function(){
		var newName = prompt("File name", $scope.selected[0].name);
		if(!newName) return;

		fs.cp($scope.selected[0], fs.cwd, newName).then(function(){
			$scope.files = fs.getFolderContents();
		});
	};

	this.fs = fs;
	if(Array.isArray(fs)) return $scope.disks = fs;
	fs.getFolderContents();
	$scope.files = fs.getFolderContents();
}];

app.config(['$routeProvider', function($routeProvider) {

	$routeProvider.when('/filesystem/:type/', {
		templateUrl: 'components/filesystem/fs.html',
		controller: fsCtrl,
		controllerAs: 'fs',
		resolve: {
			fs: ["fileSystem", "$route", "$location", function(fileSystem, $route, $location){
				return new fileSystem($route.current.params.type == "temporary" ? 0:1);
			}]
		}
	}).when('/filesystem/:type/:dir*', {
		templateUrl: 'components/filesystem/fs.html',
		controller: fsCtrl,
		controllerAs: 'fs',
		resolve: {
			fs: ["fileSystem", "$route", function(fileSystem, $route){
				return new fileSystem($route.current.params.type == "temporary" ? 0:1).then(function(fs){
					return fs.cd($route.current.params.dir).then(function(){
						return fs;
					});
				})
			}]
		}
	}).when('/filesystem/', {
		templateUrl: 'components/filesystem/fs.html',
		controller: fsCtrl,
		controllerAs: 'fs',
		resolve: {
			fs: ["fileSystem", "$route", function(fileSystem, $route){
				return Promise.all([
					new fileSystem(1),
					new fileSystem(0)
				])
			}]
		}
	});
}]).
directive("wisPreview", function(){
	return {
		link: function($scope, $element, $attr){
			$scope.$watch($attr.wisPreview, function(value) {
				console.log(value.type);
			});
		}
	}
})
.filter('filesize', function(){
	return function (size, cUnit){

		for(var i = 0, unit = 'Byte0KiB0MiB0GiB0TiB0PiB0EiB0ZiB0YiB'.split(0);
			1024 <= size; // While the size is smaller
			i++
		) size /= 1024;

		return  (size+.5|0) + (cUnit + "" === cUnit ? cUnit : ' ' + unit[i]) // jshint ignore:line
	};
});