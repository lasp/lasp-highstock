'use strict';

function colorCtrl($scope, constants, $http) {
    $scope.datasets = [{
        accessURL: "dataset_random1",
        desc: "Analog Test Dataset 5",
        name: "R1"
    },{
        accessURL: "dataset_random2",
        desc: "Analog Test Dataset 5",
        name: "R2"
    },{
        accessURL: "dataset_random3",
        desc: "Analog Test Dataset 5",
        name: "R3"
    },{
        accessURL: "dataset_random4",
        desc: "Analog Test Dataset 5",
        name: "R4"
    },{
        accessURL: "dataset_random5",
        desc: "Analog Test Dataset 5",
        name: "R5"
    },{
        accessURL: "dataset_random6",
        desc: "Analog Test Dataset 5",
        name: "R6"
    },{
        accessURL: "dataset_random7",
        desc: "Analog Test Dataset 5",
        name: "R7"
    },{
        accessURL: "dataset_random8",
        desc: "Analog Test Dataset 5",
        name: "R8"
    },{
        accessURL: "dataset_random9",
        desc: "Analog Test Dataset 5",
        name: "R9"
    },{
        accessURL: "dataset_random10",
        desc: "Analog Test Dataset 5",
        name: "R10"
    }]
}

angular.module('laspHighstock').controller('ColorCtrl', ['$scope', 'constants', '$http', colorCtrl]);
