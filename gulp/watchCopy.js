
var gulp = require("gulp");
var runSequence = require("run-sequence");

gulp.task("watchCopy", ["cleanBuildCopy"], function() {
    var conf = require("./conf");
    gulp.watch(conf.paths.src + "**/*", ["cleanBuildCopy"]);
});

gulp.task("cleanBuildCopy", ["cleanBuild"], function(cb) {
    // copy dist files to the bower_components/lasp-highstock/dist folder of another project defined by args
    var i = process.argv.indexOf( '--project' );
    if ( i == -1 ) {
        i = process.argv.indexOf( '-p' ); 
    }

    if ( i == -1 || typeof process.argv[i+1] === 'undefined' ) {
        cb( 'No destination project defined. Use -p [project-name] or --project [project-name]' );
        return;
    }
    
    var destProject = process.argv[i+1];
    var conf = require("./conf");
    // destination project must have its bower_components folder inside /app/
    return gulp.src( conf.paths.dist + "*" )
      .pipe( gulp.dest( "../" + destProject + "/app/bower_components/lasp-highstock/dist" ) );
});

