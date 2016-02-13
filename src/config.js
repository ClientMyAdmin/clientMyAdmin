app.config([
	'$compileProvider',
	'$locationProvider',
	'$mdIconProvider',
	'$mdThemingProvider',
	'$sceDelegateProvider',
	function($compileProvider, $locationProvider,
			 $mdIconProvider, $mdThemingProvider, $sceDelegateProvider) {

		$locationProvider.html5Mode(false);
		$mdIconProvider.icon("check", "check");

		$mdThemingProvider.theme('default')
			.primaryPalette('blue')
			.accentPalette('pink');

		$sceDelegateProvider.resourceUrlWhitelist(['**']);
	    $compileProvider.aHrefSanitizationWhitelist(/^\s*(filesystem|https?|ftp|mailto|chrome-extension):/);
}])
.run(["$templateCache", function($templateCache) {
	$templateCache.put("check", '<svg xmlns="http://www.w3.org/2000/svg" fit="" height="100%" width="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24" style="pointer-events: none; display: block;"><g id="check"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></g></svg>');
}])