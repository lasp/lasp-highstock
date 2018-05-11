
var gulp = require("gulp");

gulp.task("lint", function() {

	var jshint = require("gulp-jshint");
	var sourceSets = require("./conf").sourceSets;
	
	return gulp.src(sourceSets.scripts)
		.pipe(jshint())
		.pipe(jshint.reporter("jshint-stylish"));
});

