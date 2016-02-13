app.directive('blacklist', function (){
	return {
		require: 'ngModel',
		scope: {blacklist:"="},
		link: function($scope, $elem, attr, ngModel) {
			var blacklist = $scope.blacklist;

			function insensitive(val){
				var value = val.toLowerCase();
				return !blacklist.some(function(item){
					return item.toLowerCase() === value
				});
			}

			function sensitive(value){
				return blacklist.indexOf(value) === -1;
			}
			
			var parser = blacklist.$caseInsensitive ? insensitive : sensitive;

			ngModel.$validators.blacklist = parser;
		}
	};
});

app.directive('mustEndWith', function (){
	return {
		require: 'ngModel',
		scope: {mustEndWith:"="},
		link: function($scope, $elem, attr, ngModel) {

			function sensitive(value){
				var valid = !value || value.endsWith($scope.mustEndWith);
				ngModel.$setValidity('mustEndWith', valid);
				return value;
			}

			ngModel.$parsers.unshift(sensitive);
			ngModel.$formatters.unshift(sensitive);
		}
	};
});

app.directive("validity", function() {
    return {
        restrict: "A",
        require: "ngModel",
        link: function(scope, element, attributes, ngModel) {
        	element = element[0];
        	
        	// if(!ngModel.$$hasNativeValidators) return;
            ngModel.$parsers.unshift(function(value) {
            	ngModel._validationMessage = element.validationMessage
            	ngModel.$setValidity('validity', element.validity.valid);
            	return value
            });
        }
    };
});

