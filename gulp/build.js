var gulp = require("gulp");

// Optimization - lazily load dependencies when they're
// actually needed
var conf, paths, sourceSets, concat;
gulp.task("_basicDeps_build", function(cb) {
	conf = require("./conf");
	paths = conf.paths;
	sourceSets = conf.sourceSets;
	concat = require("gulp-concat");
	cb();
});

gulp.task("clean", ["_basicDeps_build"], function(cb) {

	var del = require("del");

	del(conf.cleanDirs, cb);
});

gulp.task("build-scripts", ["_basicDeps_build"], function() {
	
	var templateCache = require("gulp-angular-templatecache");
	var addSrc = require("gulp-add-src");
	var minifyHtml = require("gulp-minify-html");
	
	return gulp.src(sourceSets.templates)
		.pipe(minifyHtml({
			empty: true, // do not remove empty attributesd
			spare: true, // do not remove redundant attributes
			quotes: true // do not remove arbitrary quotes
		}))
		.pipe(templateCache(
			"templates.js",
			{
				module: "laspChart"
			}
		))
		.pipe(addSrc.prepend(sourceSets.scripts))
		.pipe(concat("lasp-highstock.js"))
		.pipe(gulp.dest(paths.dist));
});

gulp.task("build-css", ["_basicDeps_build"], function() {

	var csso = require("gulp-csso");
	var cssBase64 = require("gulp-css-base64");
	var autoprefixer = require('gulp-autoprefixer');

	return gulp.src(sourceSets.css)
		.pipe(cssBase64())
		.pipe(concat("lasp-highstock.css"))
		.pipe(autoprefixer({browsers: ['> 1%', 'last 4 versions', 'not ie<9']}))
		.pipe(csso())
		.pipe(gulp.dest(paths.dist))
});

gulp.task("build", ["build-scripts", "build-css"], function (cb) { cb(); });

gulp.task("cleanBuild", function(cb) {

	var runSequence = require("run-sequence");

	runSequence(
		"clean",
		"build",
		cb
	);
});
