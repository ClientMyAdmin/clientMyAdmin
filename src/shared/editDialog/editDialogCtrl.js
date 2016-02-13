app.controller('editDialog', ["$scope", "$mdDialog", "animate", "item", "storageTitle", function($scope, $mdDialog, animate, item, storageTitle){

	$scope.hide = $mdDialog.hide;
	$scope.storageTitle = $mdDialog.storageTitle;

	this.location = location;

	this.cancel = function() {
		$mdDialog.cancel();
	};

	this.save = function(){
		$mdDialog.hide(item);
	}

	$scope.item = item;
	console.log(item);
	$scope.sowed = animate.sowed;
}])

