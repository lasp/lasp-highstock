'use strict';

function eventsData( backend, $q ) {

    function Data() {
        // A list of event type id's and labels. The index of each element equates to the y-value of the event type on the chart.
        // Each element in the array has the following properties:
        //   id: {int} An ID number for this event type
        //   name: {string} An description of the event type
        //   label: {string} A shortened description of 'name'
        this.types = [];
        // An array of events in the loaded data. Each element should be an object with the following properties:
        //   type: {object} An event type object, as described above.
        //   y: {int} The y-value of the event, which is also the index of the type string in the types array.
        //            This information is duplicated, but it makes other parts of the code very convenient
        //   start: {int} The start time of the event, in ms since 1970.
        //   end: {int} The end time of the event, in ms since 1970.
        //   info: {object} properties and values which give additional information about the event.  
        this.events = [];

        this.error = false;
    }
    
    Data.prototype = {
        
        downloadData: function( accessURL, cancel, progressHandler ) {
            this.error = false;
            this.types = [];
            this.events = [];
            // Generally, javascript callbacks, like here the $http.get callback,
            // change the value of the "this" variable inside it
            // so we need to keep a reference to the current instance "this" :
            var self = this;
            return backend.get( accessURL, cancel, progressHandler ).then( function( response ) {
                // parse data
                // find indexes of parameters based on metadata
                var parameters = response.data.Events.parameters;
                var idIndex = parameters.indexOf( 'id' ),
                    typeIdIndex = parameters.indexOf( 'typeId' ),
                    startIndex = parameters.indexOf( 'startTime' ),
                    endIndex = parameters.indexOf( 'endTime' );
                
                // Get the list of unique event types returned by the metadata.
                // This should be a list of all possible event types.
                self.types = response.data.Events.metadata.typeId.event_types;

                // now build a list of events
                self.events = response.data.Events.data.map( function(event) {
                    var eventTypeIndex = self.types.findIndex( function(type) {
                        return event[typeIdIndex] === type.id;
                    });
                    return {
                        type: self.types[eventTypeIndex],
                        y: eventTypeIndex,
                        start: event[startIndex],
                        end: event[endIndex],
                        info: {
                            'Event ID': event[idIndex].toString()
                        }
                    };
                });
                
            }, function( response ) {
                self.error = response;
                // return a rejected promise so that further chained promise handlers will correctly execute the error handler
                return $q.reject( response.data );
            });
        }
    };

    return( Data );
}

angular.module( 'laspChart' ).factory( 'EventsData', [ 'latis', '$q', eventsData ]);