
app.config(['$routeProvider', function($routeProvider) {
	$routeProvider.when('/permission/:database?/:view?/:table?', {
		templateUrl: 'components/permission/pm.html',
		reloadOnSearch: false,
		controller: ["permissions", "$q", "$rootScope", function(permissions, $q, $rootScope){
			angular.extend(this, permissions)
			function update(){
				$rootScope.$apply()
			}

			permissions.geo.avalible = 'geolocation' in navigator
			permissions.geo.onchange = update;
			permissions.geo.setter = function(val){
				if(arguments.length){
					navigator.geolocation.getCurrentPosition(function(position) {
						console.log(position);
						console.log('Geolocation permissions granted');
						console.log('Latitude:' + position.coords.latitude);
						console.log('Longitude:' + position.coords.longitude);
						update();
					}, function(err){
						if(err.code == 1 && window.chrome && window.chrome.webstore && permissions.geo.state == 'prompt'){
							// position is tempery unavalible in chrome (just need to refresh the page)
							permissions.geo._state = "tempery disabled";
							update();
						}
					});
				}
				return permissions.geo.state == 'granted'
			};

			if(permissions.pers){
				var persGranted = permissions.pers.granted;
				permissions.pers.setter = function(val){
					if(arguments.length){
						navigator.webkitPersistentStorage.requestQuota(permissions.pers.granted, function(grantedBytes){
							persGranted = grantedBytes;
							update();
						}, function(e) { console.log('Error', e)});
					}

					if(permissions.pers.granted > persGranted){
						permissions.pers.state = "prompt";
					} else {
						permissions.pers.state = "granted";
					}

					return permissions.pers.granted <= persGranted;
				};
			}

			if(permissions.temp){
				// var tempGranted = permissions.temp.granted;
				permissions.temp.setter = function(val){
					// if(arguments.length){
					// 	navigator.webkitTemporaryStorage.requestQuota(permissions.temp.granted, function(grantedBytes){
					// 		tempGranted = grantedBytes;
					// 		update();
					// 	}, function(e) { console.log('Error', e)});
					// }

					// if(permissions.temp.granted > tempGranted){
					// 	permissions.temp.state = "prompt";
					// } else {
					// 	permissions.temp.state = "granted";
					// }

					return !!permissions.temp.granted;
				};
			}

			permissions.noti.avalible = true // TODO: test
			permissions.noti.onchange = update;
			permissions.noti.setter = function(val){
				if(arguments.length){
					Notification.requestPermission();
					// navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {
					// 	serviceWorkerRegistration.pushManager.subscribe({userVisibleOnly: true})
					// 	update();
					// }).catch(function(e){
					// 	console.log(e)
					// });
				}
				return permissions.noti.state == 'granted'
			};

			permissions.push.avalible = true // TODO: test
			permissions.push.onchange = update;
			permissions.push.setter = function(val){
				// if(arguments.length){
					
				// }
				return permissions.push.state == 'granted'
			};

			permissions.midi.avalible = "requestMIDIAccess" in navigator
			permissions.midi.onchange = update;
			permissions.midi.setter = function(val){
				if(arguments.length){
					navigator.requestMIDIAccess({
						sysex: false
					});
				}
				return permissions.midi.state == 'granted'
			};

			permissions.midiSys.onchange = update;
			permissions.midiSys.setter = function(val){
				if(arguments.length){
					navigator.requestMIDIAccess({
						sysex: true
					});
				}
				return permissions.midiSys.state == 'granted'
			};


			permissions.media.avalible = getUserMedia;
			permissions.media.audio = {
				state: permissions.media.enabledAudio ? "granted" : "prompt or disabled",
				setter: function(val){
					if(arguments.length){
						permissions.media.audio.state = 'prompt';
						navigator.mediaDevices.getUserMedia({audio:true}).then(function(mediaStream){
							
							try{// WTF? 
								// Cannot set property active of #<MediaStream> which has only a getter
								mediaStream.active = false;
							} catch (e){
								// 'MediaStream.stop()' is deprecated and will be removed in M47, around November 2015. Please use 'MediaStream.active' instead.
								mediaStream.stop();
							}
							
							permissions.media.audio.state = window.location.protocol == "https:" ? 'granted' : 'prompt'
							update();
						}, function(err){
							if(err.name == "PermissionDismissedError"){
								permissions.media.audio.state = 'prompt'
							}
							
							if(err.name == "PermissionDeniedError"){
								permissions.media.audio.state = 'disabled'
							}
							
							update();
						});
						
					}
					return permissions.media.audio.state == 'granted'
				}
			}

			permissions.media.video = {
				state: permissions.media.enabledVideo ? "granted" : "prompt or disabled",
				setter: function(val){
					if(arguments.length){
						permissions.media.video.state = 'prompt';
						navigator.mediaDevices.getUserMedia({video:true}).then(function(mediaStream){
							
							try{// WTF? 
								// Cannot set property active of #<MediaStream> which has only a getter
								mediaStream.active = false;
							} catch (e){
								// 'MediaStream.stop()' is deprecated and will be removed in M47, around November 2015. Please use 'MediaStream.active' instead.
								mediaStream.stop();
							}

							permissions.media.video.state = window.location.protocol == "https:" ? 'granted' : 'prompt'
							update();
						}, function(err){
							if(err.name == "PermissionDismissedError")
								permissions.media.video.state = 'prompt'
							
							if(err.name == "PermissionDeniedError")
								permissions.media.video.state = 'disabled'
							
							update();
						});
					}
					return permissions.media.video.state == 'granted'
				}
			}

		}],
		controllerAs: 'pm',
		resolve: {
			permissions: ["$q", function($q){
				function PermissionStatus(){
					var timer;
					var obj = {};
					var lastState;

					Object.defineProperties(this, {
						onchange: {
							set: function(cb){
								if(cb == null){
									clearInterval(timer);
									return;
								}

								lastState = this.state;
								var self = this;
								timer = setInterval(function(){
									if(lastState != self.state){
										lastState = self.state;
										cb();
									}
								}, 100);
							}
						},
						"state": {
							get: function(){
								return Notification.permission === 'default' ? 'prompt' : Notification.permission
							}
						}
					});
				}

				return $q.all({
					geo: !navigator.permissions ? {state: "prompt"} : navigator.permissions.query({
						name: 'geolocation'
					}),
					pers: navigator.webkitPersistentStorage && $q(function(resolve, reject){
						navigator.webkitPersistentStorage.queryUsageAndQuota(function(usedBytes, grantedBytes) {  
							resolve({
								state: grantedBytes ? "granted" : "prompt",
								used: usedBytes,
								granted: grantedBytes
							})
						}, reject);
					}),
					temp: navigator.webkitTemporaryStorage && $q(function(resolve, reject){
						navigator.webkitTemporaryStorage.queryUsageAndQuota(function(usedBytes, grantedBytes) {  
							resolve({
								state: grantedBytes ? "granted" : "prompt",
								used: usedBytes,
								granted: grantedBytes
							})
						}, reject);
					}),
					noti: !navigator.permissions ? new PermissionStatus() : navigator.permissions.query({
						name: 'notifications'
					}),
					midi: !navigator.permissions ? {state: "prompt"} : navigator.permissions.query({
						name: 'midi',
						sysex: false
					}),
					midiSys: !navigator.permissions ? {state: "prompt"} : navigator.permissions.query({
						name: 'midi',
						sysex: true
					}),
					push: !navigator.permissions ? {state: "prompt"} : navigator.permissions.query({
						name: 'push',
						userVisibleOnly: true
					}),
					media: navigator.mediaDevices.enumerateDevices().then(function(devices){
						var DetectRTC = {
							hasMicrophone: false,
							hasSpeakers: false,
							hasWebcam: false,
							enabledAudio: false,
							enabledVideo: false
						}

						devices.forEach(function(device){

							if (device.kind === 'audioinput' || device.kind === 'audio') {
								DetectRTC.hasMicrophone = true;
							}

							if (device.kind === 'audiooutput') {
								DetectRTC.hasSpeakers = true;
							}

							if (device.kind === 'videoinput' || device.kind === 'video') {
								DetectRTC.hasWebcam = true;
							}

							if (!DetectRTC.enabledAudio && device.kind.indexOf('audio') !== -1) {
								DetectRTC.enabledAudio = !!device.label;
							}

							if (!DetectRTC.enabledVideo && device.kind.indexOf('video') !== -1) {
								DetectRTC.enabledVideo = !!device.label;
							}

						});
						
						return DetectRTC;
					})
				}).catch(err => { console.log(err)})
				//fyyyys
			}]
		}
	});
}]);





var getUserMedia = null;
var webrtcDetectedVersion = null;

if (navigator.mozGetUserMedia) {
	console.log('This appears to be Firefox');

	// the detected firefox version.
	webrtcDetectedVersion =
		parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);

	// getUserMedia shim (only difference is the prefix).
	// Code from Adam Barth.
	getUserMedia = navigator.mozGetUserMedia.bind(navigator);

	// Shim for mediaDevices on older versions.
	if (!navigator.mediaDevices) {
		navigator.mediaDevices = {
			getUserMedia: requestUserMedia
		};
	}
	navigator.mediaDevices.enumerateDevices =
		navigator.mediaDevices.enumerateDevices || function() {
			return Promise.resolve([]);
		};
	if (webrtcDetectedVersion < 41) {
		// Work around http://bugzil.la/1169665
		var orgEnumerateDevices =
			navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
		navigator.mediaDevices.enumerateDevices = function() {
			return orgEnumerateDevices().catch(function(e) {
				if (e.name === 'NotFoundError') {
					return [];
				}
				throw e;
			});
		};
	}

	

} else if (navigator.webkitGetUserMedia) {
	console.log('This appears to be Chrome');

	// Get UserMedia (only difference is the prefix).
	// Code from Adam Barth.
	getUserMedia = navigator.webkitGetUserMedia.bind(navigator);

	if (!navigator.mediaDevices) {
		navigator.mediaDevices = {
			getUserMedia: requestUserMedia,
			enumerateDevices: function() {
				return new Promise(function(resolve) {
					var kinds = {
						audio: 'audioinput',
						video: 'videoinput'
					};
					return MediaStreamTrack.getSources(function(devices) {
						resolve(devices.map(function(device) {
							return {
								label: device.label,
								kind: kinds[device.kind],
								deviceId: device.id,
								groupId: ''
							};
						}));
					});
				});
			}
		};
	}
} else {
	console.log('Browser does not appear to be WebRTC-capable');
}

// Returns the result of getUserMedia as a Promise.
function requestUserMedia(constraints) {
	return new Promise(function(resolve, reject) {
		getUserMedia(constraints, resolve, reject);
	});
}