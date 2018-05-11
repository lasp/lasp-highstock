
var gulp = require("gulp");

// optimization: only initialize browserSync variable when serve task is called
var browserSync;

gulp.task("serve", ["cleanBuild"], function() {

	var sourceSets = require("./conf").sourceSets;
	browserSync = require("browser-sync").create("default");

	browserSync.init({
		server: {
			baseDir: "./"
		},
		startPath: "/src/"
	});

	gulp.watch(sourceSets.scripts, ["_reload_scripts"]);
	gulp.watch(sourceSets.templates, ["_reload_scripts"]);
	gulp.watch(sourceSets.css, ["_reload_styles"]);
	gulp.watch(sourceSets.testPage).on("change", browserSync.reload);
});

// wrapper tasks for our individual build tasks that call browserSync.reload()
gulp.task("_reload_scripts", ["build-scripts"], function() { browserSync.reload(); });
gulp.task("_reload_styles",  ["build-css"],  function() { browserSync.reload(); });
