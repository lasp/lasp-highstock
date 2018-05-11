'use strict';
angular.module( 'laspChart' ).controller( 'dialogCtrl', [
    '$scope',
    '$uibModalInstance',
    '$sce',
    'data',
    function( $scope, $uibModalInstance, $sce, data ) {
        /**
         * @ngdoc service
         * @name dialogCtrl
         * @requires $scope
         * @requires $uibModalInstance
         * @requires $sce
         *
         * @description
         * Modal controller for viewing metadata
         */

        /**
         * @ngdoc method
         * @name cancel
         * @methodOf dialogCtrl
         * @description
         * Dismisses the dialog modal
         *
         * @example
         * ```
         * $scope.cancel();
         * ```
         */
        $scope.closeMetadata = function() {
            $scope.isMetadataOpen = false;
            $uibModalInstance.dismiss( 'cancel' );
            $scope.$destroy();
        };

        //initialization stuff:
        $scope.modal = {
            catalog: null,
            selectedDatasets: null,
            overplot: null,
            autoExpandNum: null,
            searchQuery: null,
            isCollapsed: null
        };

        $scope.isMetadataOpen = true;
        $scope.modal.metadata = data;
    }
]);