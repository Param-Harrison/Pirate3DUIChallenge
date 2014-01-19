var app = angular.module('Pirate3D', []);

/* Hack for Non Blocking exection of Long Running JS Function */
var RefQueue = {
    SetTimer: null,
    Queue: {},
    add: function(fn, time, key) {
        RefQueue.SetTimer = setTimeout(function() {
            fn.call();
        }, time || 2);
        if(RefQueue.Queue[key] == undefined) RefQueue.Queue[key] = [];
        RefQueue.Queue[key].push(RefQueue.SetTimer);
    },
    delete: function(key, callback) {
        var len = RefQueue.Queue[key].length, i;
        if(len == 0) callback.call();
        for(i = len - 1; i >= 0; i--) {
            clearTimeout(RefQueue.Queue[key][i]);
            if(i == 0) {
            	RefQueue.Queue[key] = [];
            	callback.call();
            }
        }
    }
}

app.controller('MegaHashCntrl', function ($scope) {
	$scope.files = [];

	/* Snippet for Safe use of $scope.apply */
	$scope.safeApply = function(fn) {
		var phase = this.$root.$$phase;
		if(phase == '$apply' || phase == '$digest') {
		    if(fn && (typeof(fn) === 'function')) {
		    	fn();
		    }
		} else {
		    this.$apply(fn);
		}
	};

	$scope.ComputeHash = function() {
		var obj = {
			name: $scope.file.name,
			loading: true,
			Canceled: false,
			megahash: "",
			NumValue: 0,
			style: {
				width: "0%"
			},
			read: ""
		};
  
		$scope.files.push(obj);

		var reader = new FileReader();
		reader.originalLength = $scope.files.length - 1;

		reader.onprogress = function(e) {
            if (e.lengthComputable) {
                $scope._calculatePercentage(e.loaded, e.total, reader.originalLength);
            }
	    };
	    reader.onabort = function(e) {
	      alert('File read cancelled');
	    };
	    reader.onloadstart = function(e) {
	    };
	    reader.onload = function(e) {
	    	$scope.files[reader.originalLength].read = reader.result;
            $scope.files[reader.originalLength].style.width = "0%";
	    	RefQueue.add(function() {
				$scope.megaHashCompute(reader.result, $scope.files[reader.originalLength].NumValue, reader.originalLength);
	    	}, 1, reader.originalLength);
	    };
	    
	    reader.readAsBinaryString($scope.file);
	}

	$scope._calculatePercentage = function(loaded, total, originalLength) {
		var percentLoaded = Math.round((loaded / total) * 100);
        if (percentLoaded <= 100) {
        	$scope.safeApply(function() {
            	$scope.files[originalLength].style.width = percentLoaded + "%";
            });
        }
	}

	$scope.megaHashCompute = function(file, n, originalLength) {
		RefQueue.add(function() {
			if(!$scope.files[originalLength].Canceled) {
				md5(file, originalLength, function(mdHash) {
					n--;
					var loaded = $scope.files[originalLength].NumValue - n,
						total = $scope.files[originalLength].NumValue;
					$scope._calculatePercentage(loaded, total, originalLength);
					if(n >= 0) {
						$scope.megaHashCompute(mdHash + file, n, originalLength);
					} else {
						$scope.safeApply(function() {
							//Angular.extend can be used if the object is too large
							$scope.files[originalLength].loading = false;
							$scope.files[originalLength].megahash = mdHash;
							setTimeout(function() {
								$scope.files[originalLength].style.width = "0%";
							}, 2000);
						});
					}
				});
			}
		}, 1, originalLength);
	}

	$scope._CancelCommon = function(originalLength, callback) {
		$scope.files[originalLength].loading = true;
		$scope.files[originalLength].Canceled = true;
		
		RefQueue.delete(originalLength, function() {
			$scope.safeApply(function() {
				$scope.files[originalLength].style.width = "0%";
				$scope.files[originalLength].Canceled = false;
			});
			callback.call();
		});
	};

	$scope.megaHashIterate = function(file, n, originalLength) {
		$scope._CancelCommon(originalLength, function() {
			RefQueue.add(function() {
				$scope.files[originalLength].style.width = "0%";
				$scope.megaHashCompute(file, n, originalLength);
			}, 1, originalLength);
		});
	}

	$scope.CancelComputation = function(originalLength) {
		RefQueue.delete(originalLength, function() {});
		$scope.files[originalLength].style.width = "0%";
		$scope.files[originalLength].Canceled = true;
		$scope.files[originalLength].loading = false;
	}

	$scope.MegaHashDestroy = function(originalLength) {
		$scope._CancelCommon(originalLength, function() {
			$scope.files.splice(originalLength, 1);
		});
	}
});

app.directive("ngFileSelect", function() {    
  return {
    link: function($scope, el) {          
      el.bind("change", function(e) {      
    	$scope.file = (e.srcElement || e.target).files[0];
    	$scope.safeApply(function() {
    		$scope.ComputeHash();
    	});
      });
    }
  }
});