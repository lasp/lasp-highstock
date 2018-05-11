"use strict";

var gulp = require("gulp");

function runTests(singleRun, callback) {

	var karma = require("karma");
	var path = require("path");
	var conf = require("./conf");
	var sourceSets = conf.sourceSets;

	new karma.Server(
		{
			configFile: path.join(__dirname, "../karma.conf.js"),
			singleRun: singleRun,
			autoWatch: !singleRun
		},
		function(exitCode) {
			callback();
			process.exit(exitCode);
		}
	).start();
}

gulp.task("test", ["cleanBuild"], function(callback) {
	runTests(true, callback);
});

gulp.task("test:auto", function(callback) {
	gulp.watch(sourceSets.scripts, ["build-scripts"]);
	gulp.watch(sourceSets.templates, ["build-scripts"]);
	gulp.watch(sourceSets.styles, ["build-styles"]);

	runTests(false, callback);
});

