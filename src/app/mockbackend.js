// We will be using backend-less development
// $http uses $httpBackend to make its calls to the server
// $resource uses $http, so it uses $httpBackend too
// We will mock $httpBackend, capturing routes and returning data

function mockBackend($httpBackend, $http, $timeout) {
    
    $httpBackend.whenGET('app/main/main.html').passThrough();
    $httpBackend.whenGET('app/main/colors.html').passThrough();
    $httpBackend.whenGET('app/main/test_plot.html').passThrough();
    $httpBackend.whenGET('app/testDatasets/arearange_manual_load.json').passThrough();
    
$httpBackend.whenGET(/latis\/dataset_analog1.*/).respond(function() {
    var request = new XMLHttpRequest();
    
    request.open('GET', 'app/testDatasets/dataset_analog1.json', false);
    request.send(null);
    
    return [request.status, request.response, {}];
});

$httpBackend.whenGET(/latis\/dataset_analog2.*/).respond(function() {
    var request = new XMLHttpRequest();
    
    request.open('GET', 'app/testDatasets/dataset_analog2.json', false);
    request.send(null);
    
    return [request.status, request.response, {}];
});

$httpBackend.whenGET(/latis\/dataset_Discrete1.*/).respond(function() {
    var request = new XMLHttpRequest();
    
    request.open('GET', 'app/testDatasets/dataset_discrete1.json', false);
    request.send(null);
    
    return [request.status, request.response, {}];
});

$httpBackend.whenGET(/latis\/dataset_Discrete2.*/).respond(function() {
    var request = new XMLHttpRequest();
    
    request.open('GET', 'app/testDatasets/dataset_discrete2.json', false);
    request.send(null);
    
    return [request.status, request.response, {}];
});

$httpBackend.whenGET(/latis\/dataset_analog3.*/).respond(function() {
    var request = new XMLHttpRequest();
    
    request.open('GET', 'app/testDatasets/dataset_analog3.json', false);
    request.send(null);
    
    return [request.status, request.response, {}];
});

$httpBackend.whenGET(/latis\/dataset_analog4.*/).respond(function() {
    var request = new XMLHttpRequest();
    
    request.open('GET', 'app/testDatasets/dataset_analog4.json', false);
    request.send(null);
    
    return [request.status, request.response, {}];
});

var counter = 0;
$httpBackend.whenGET(/latis\/dataset_random.*/).respond(function() {       
    // Create some random data
    var data = [];
    var count = 0;
    var maxPoints = 25;
    console.log( counter );
    counter++;
    var time = counter * 1000 * 25;
    console.log( time );
    for ( var i = 0; i < maxPoints; i++ ) {
        var dataPoint = Math.random() * 100;
        data.push([time, dataPoint, dataPoint, dataPoint, 3]);
        time += 1000;
        count++;
    }
    console.log( data );
    
    var response = {"Random": {
        "metadata": {"time": {
            "length": "23",
            "alias": "time,DT",
            "units": "milliseconds since 1970-01-01"
            },
            "Random": {
                "long_name": "Gyro Temperature 2",
                "tlmId": "201",
                "alias": "value",
                "units": "C",
                "full_resolution": "true",
                "limits": {"yellow": {"low": 20.0, "high": 70.0}, "red": {"low": 10.0, "high": 80.0}}
            },
            "min": {},
            "max": {},
            "count": {}
        },
        "parameters": [ "time", "Random", "min", "max", "count" ],
        "data": data
    }}
    
    return [200, response];
});

$httpBackend.whenGET(/latis\/dataset_String1.*/).respond(function() {
    var request = new XMLHttpRequest();
    
    request.open('GET', 'app/testDatasets/dataset_string1.json', false);
    request.send(null);
    
    return [request.status, request.response, {}];
});
}

angular.module('laspHighstock').run(['$httpBackend', '$http', '$timeout', mockBackend]);
