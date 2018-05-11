'use strict';
angular.module( 'laspChart' ).controller( 'eventsModalCtrl', [
    '$uibModalInstance',
    'eventDetails',
    'timeLabelsOptions',
    function( $uibModalInstance, eventDetails, timeLabelsOptions ) {
        /**
         * @ngdoc service
         * @name eventsModalCtrl
         * @requires $uibModalInstance
         * @description
         * Modal controller for viewing details of an event
         */

        var $ctrl = this;
        $ctrl.eventDetails = eventDetails;

        // make an array of properly formatted dates-
        // the start date (index 0) and end date (index 1)
        var dates = [eventDetails.start, eventDetails.end].map( function(date) {
            date = moment.utc( new Date(date) );
            date.tz( timeLabelsOptions.timezone );
            return date.format( timeLabelsOptions.momentTimeFormat + 'THH:mm:ss' );
        });
        $ctrl.eventDetails.startFormatted = dates[0];
        $ctrl.eventDetails.endFormatted = dates[1];
    }
]);
