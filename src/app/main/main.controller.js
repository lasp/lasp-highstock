'use strict';

function mainCtrl($scope, constants, $http) {

    //load data for date range plot
    $http.get('app/testDatasets/arearange_manual_load.json').success( function( response ) {
        $scope.rangeMenuOptions = response.menuOptions;
        $scope.rangeData = response.data;
        $scope.rangeTimeRange = {
            total: {
                "start": new Date("1970-01-01T00:00:00.000Z"),
                "end": new Date("2015-11-10T19:17:35.609Z"),
                "ertStart":null,
                "ertEnd":null
            }
        };
        $scope.rangeMenuOptions.yAxis.scaleType = 'logarithmic';
    }).error( function() {
        $scope.error = 'Failed to load Area Range Data';
        $scope.rangeMenuOptions = false;
    });

    $scope.html = 'Usage: <div draw-plot chart="chart" menu-options="menuOptions" plot-obj="plotObj"></div>'

    $scope.datasets = {
        discrete1: {
            accessURL: "dataset_Discrete1",
            desc: "Discrete Test Dataset 1",
            name: "DTD1"
        },
        discrete2: {
            accessURL: "dataset_Discrete2",
            desc: "Discrete Test Dataset 2",
            name: "DTD2",
        },
        analog1: {
            accessURL: "dataset_analog1",
            desc: "Analog Test Dataset 1",
            name: "ATD1"
        },
        analog2: {
            accessURL: "dataset_analog2",
            desc: "Analog Test Dataset 2",
            name: "ATD2"
        },
        analog3: {
            accessURL: "dataset_analog3",
            desc: "Analog Test Dataset 3",
            name: "ATD3"
        },
        analog3offset: {
            accessURL: "dataset_analog3",
            desc: "Analog Test Dataset 3",
            name: "ATD3",
            offset: "-2 h"
        },
        analog4: {
            accessURL: "dataset_analog4",
            desc: "Analog Test Dataset 4",
            name: "ATD4"
        },
        string1: {
            accessURL: "dataset_String1",
            desc: "String Test Dataset 1",
            name: "STD1"
        }
    };


}

angular.module('laspHighstock').controller('MainCtrl', ['$scope', 'constants', '$http', mainCtrl]);
