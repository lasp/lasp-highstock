
var gulp = require("gulp");

gulp.task("watch", ["cleanBuild"], function() {
    var conf = require("./conf");
    gulp.watch(conf.paths.src + "**/*", ["cleanBuild"]);
});


