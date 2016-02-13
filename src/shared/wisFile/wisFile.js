app.directive('wisFile', ["$rootScope", "$parse", "$q", function($rootScope, $parse, $q) {
	function processDragOverOrEnter(event) {
		event.stopPropagation();
		event.preventDefault();
	}

	var sequence = $q.when();
	var readFolder = function(folder) {
		return sequence = sequence.then(function(){
			return $q(function(resolve, reject) {
				folder.createReader().readEntries(resolve, reject);
			});
		});
	};

	return {
		// name: '',
		// priority: 1,
		// terminal: true,
		scope: {opts: '=wisFile'},
		// controller: function($scope, $element, $attrs, $transclude) {},
		// require: 'ngModel', // Array = multiple requires, ? = optional, ^ = check parent elements
		// restrict: 'A', // E = Element, A = Attribute, C = Class, M = Comment
		// template: '',
		// templateUrl: '',
		// replace: true,
		// transclude: true,
		// compile: function(tElement, tAttrs, function transclude(function(scope, cloneLinkingFn){ return function linking(scope, elm, attrs){}})),
		link: function($scope, $element, $attr) {
			var file;

			$scope.$watch($attr.wisMultiple, function(value) {
				$attr.$set("multiple", !!(value-1));
			});

			function add(item, fullPath){
				$scope.opts.add('file', item, item.lastModifiedDate, item.name, item.size, item.type, fullPath);
			}

			$element.on('dragover dragenter', processDragOverOrEnter);

			$element.on('drop change', function(event) {
				event.preventDefault();

				var dataTransfered = event.dataTransfer;

				// Chrome 21+ accepts folders via Drag'n'Drop
				if($parse("items[0].webkitGetAsEntry")(dataTransfered)){
					var files = dataTransfered.files;
					var length = files.length;
					var folders = [];
					for (var i = 0; i < length; i++) {
						var entry = dataTransfered.items[i].webkitGetAsEntry();

						entry.isFile ?
							add(files[i], "/"+files[i].name) :
						entry.isDirectory &&
							folders.push(entry);
					}

					function recrusive(entries){
						// TODO: tell user about the åäö folder name error
						if(!(entries instanceof FileError)){

							angular.forEach(entries, function(entry){

								entry.isFile && entry.file(function(file){
									add(file, entry.fullPath);
									$scope.$apply();
								}, function(err){
									// console.log(err);
								});

								if(entry.isDirectory) {
									$scope.opts.add("directory", undefined, new Date, ".", 0, "inode/directory", entry.fullPath+"/.");

									readFolder(entry).then(recrusive/* error */);
								}
							});
						}
					}
					recrusive(folders);

					$scope.$apply();
					return;
				}

				var files = (dataTransfered || event.target).files;
				var i = files.length;

				for(;i--;){
					add(files[i], "/"+(files[i].webkitRelativePath || ""));
				}

				$scope.$apply();
			});

		}
	};
}]);