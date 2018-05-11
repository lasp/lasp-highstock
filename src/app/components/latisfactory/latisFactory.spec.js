( function() {
    'use strict';
    
    describe( 'Factory: latis', function() {
        
        var $httpBackend;
        
        beforeEach( module( 'latis' ) );
        beforeEach( inject( function( $injector ) {
            $httpBackend = $injector.get( '$httpBackend' );
        }));
        
        afterEach( function() {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
        } );
        
        it( 'should use "latis/" as a default latisBase', inject( function( latis ) {
            $httpBackend.expectGET( 'latis/' ).respond( 200, {} );
            latis.get( '' );
            
            $httpBackend.expectGET( 'latis/banana' ).respond( 200, {} );
            latis.get( 'banana' );
            
            $httpBackend.flush();
        }));
        
        it( 'should use "join/" as a default latisJoinBase', inject( function( latis ) {
            expect( latis.getJoinBase() ).toBe( 'join/' );
        }));
        
        it( 'should accept other values for latisBase', inject( function( latis ) {
            $httpBackend.expectGET( 'http://foobarbaz.com:12345/monkey/' ).respond( 200, {} );
            latis.setBase( 'http://foobarbaz.com:12345/monkey/' );
            latis.get( '' );
            
            $httpBackend.expectGET( 'http://foobarbaz.com:12345/monkey/banana' ).respond( 200, {} );
            latis.setBase( 'http://foobarbaz.com:12345/monkey/' );
            latis.get( 'banana' );
            
            $httpBackend.flush();
        }));
        
        it( 'should accept other values for latisJoinBase', inject( function( latis ) {
            latis.setJoinBase( 'http://foobar.com/coconut/' );
            expect( latis.getJoinBase() ).toBe( 'http://foobar.com/coconut/' );
        }));
        
        it( 'should add trailing slashes when missing', inject( function( latis ) {
            $httpBackend.expectGET( 'http://foobarbaz.com:12345/monkey/banana' ).respond( 200, {} );
            latis.setBase( 'http://foobarbaz.com:12345/monkey' ); // no trailing slash - base should be changed to '.../monkey/' automatically
            latis.get( 'banana' );
            
            latis.setJoinBase( 'http://foobarbaz.com:12345/coconut' );
            expect( latis.getJoinBase() ).toBe( 'http://foobarbaz.com:12345/coconut/' );
            
            $httpBackend.flush();
        }));
        
        it( 'should correctly download a single dataset as csv', inject( function( latis, $window ) {
            //$httpBackend.expectGET( './mango.csv?key1=val1&key2=val2' ).respond( 200, {} );
            spyOn( $window, 'open' );
            latis.downloadCSV( ['mango.jsond?key1=val1&key2=val2'] );
            expect( $window.open ).toHaveBeenCalled();
            expect( $window.open ).toHaveBeenCalledWith( 'latis/mango.csv?key1=val1&key2=val2' );
        }));
        
        it( 'should construct a fully qualified URL based on latisBase', inject( function( latis, $window ) {
            latis.setBase( 'http://foo.bar/baz/' );
            expect( latis.getFullyQualifiedLatisBase() ).toBe( 'http://foo.bar/baz/' );
            // add some junk to the window's URL
            $window.location = $window.location + '#foo?bar=baz';
            // the fully qualified latis base should ignore that junk
            // this test assumes that jasmine is running at 'http://localhost:9876/context.html'
            latis.setBase( 'banana/' );
            expect( latis.getFullyQualifiedLatisBase() ).toBe( 'http://localhost:9876/banana/' );
        }));
        
    } );
} )();
