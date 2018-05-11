'use strict';
angular.module( 'laspChart' ).controller( 'downloadCtrl', [
    '$scope',
    '$uibModalInstance',
    'data',
    function( $scope, $uibModalInstance, data ) {
        /**
         * @ngdoc service
         * @name dialogCtrl
         * @requires $scope
         * @requires $uibModalInstance
         *
         * @description
         * Modal controller for viewing a list of downloadable datasets
         */

        $scope.datasets = data.datasets;
        $scope.downloadFunc = data.downloadFunc;
        $scope.datasetIsEmpty = data.datasetIsEmpty;
        $scope.formData = {
            selectedDatasets: []
        };
        
        /**
         * @ngdoc method
         * @name setAllSelected
         * @methodOf dialogCtrl
         * @description
         * Either selects or deselects all checkboxes.
         * 
         * @param {boolean} selected Whether all checkboxes should be selected.
         */
        $scope.setAllSelected = function( selected ) {
            $scope.datasets.forEach( function( dataset, i ) {
                if ( !$scope.datasetIsEmpty( dataset ) ) {
                    $scope.formData.selectedDatasets[i] = selected;
                }
            });
        };
        
        /**
         * @ngdoc method
         * @name someAreSelected
         * @methodOf dialogCtrl
         * @description
         * Returns true if any of the checkboxes are checked, false otherwise.
         */
        $scope.someAreSelected = function() {
            return $scope.formData.selectedDatasets.some( function( val ) {
                return val;
            });
        };
        
        /**
         * @ngdoc method
         * @name downloadSelectedDatasets
         * @methodOf dialogCtrl
         * @description
         * Triggers a download of the selected datasets.
         */
        $scope.downloadSelectedDatasets = function() {
            // convert an array of true/false to an array of dataset indices to be downloaded
            var datasetsToDownload = [];
            $scope.formData.selectedDatasets.forEach( function( val, index ) {
                if ( val ) datasetsToDownload.push( index );
            });
            $scope.downloadFunc.apply( null, datasetsToDownload );
            $scope.cancel();
        };
        
        /**
         * @ngdoc method
         * @name cancel
         * @methodOf dialogCtrl
         * @description
         * Dismisses the dialog modal
         */
        $scope.cancel = function() {
            $uibModalInstance.dismiss( 'cancel' );
            $scope.$destroy();
        };
    }
]);
