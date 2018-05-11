'use strict';
angular.module( 'laspChart' ).controller( 'timeRangeModalCtrl', [
    '$scope',
    '$uibModalInstance',
    'data',
    function( $scope, $uibModalInstance, data ) {
        
        $scope.date = {
            start: data.timeRange.total.start,
            end: data.timeRange.total.end
        };

        $scope.datePickerConfig = {
            type: "datetime_minimal",
            timeFormat: data.menuOptions.timeLabels.momentTimeFormat,
            timezone: data.menuOptions.timeLabels.timezone === 'Zulu' ? 'utc' : 'local'
        };
        
        $scope.hasOffsetDatasets = data.hasOffsetDatasets;
        
        /**
         * @ngdoc method
         * @name ok
         * @methodOf timeRangeModalCtrl
         * @description
         * Dismisses the dialog modal and returns the input values to the parent scope
         */
        $scope.ok = function() {
            $uibModalInstance.close({
                date: $scope.date,
                timeFormat: $scope.datePickerConfig.timeFormat
            });
            //destroy the scope so we don't have to watch through it anymore
            $scope.$destroy();
        };
        
        /**
         * @ngdoc method
         * @name cancel
         * @methodOf timeRangeModalCtrl
         * @description
         * Dismisses the dialog modal
         */
        $scope.cancel = function() {
            $uibModalInstance.dismiss( 'cancel' );
            $scope.$destroy();
        };
    }
]);
