"use strict";

exports.paths = {
	components: "./src/app/components/",
	dist: "./dist/",
	tmp: './.tmp/',
	src: "./src/",
	bowerComponents: "./bower_components/"
};
var paths = exports.paths; // shorthand

exports.sourceSets = {
	scripts: [
        paths.components + "value-in-legend.js",
        paths.components + "plot_frame/plot_frame.directive.js",
		paths.components + "logger/logger.factory.js",
		paths.components + "lasp_chart/lasp_chart.directive.js",
		paths.components + "event_table/event_table.directive.js",
        paths.components + "download_modal/download_modal.controller.js",
        paths.components + "metadata_modal/metadata_modal.controller.js",
        paths.components + "timerange_modal/timerange_modal.controller.js",
		paths.components + "chart_data/chart_data.factory.js",
		paths.components + "events_data/events_data.factory.js",
		paths.components + "events_modal/events_modal.controller.js",
		paths.components + "loading_progress_tracker/loading_progress_tracker.factory.js",
		paths.components + "constants/constants.js",
		paths.components + "plot_menu/plot_menu.directive.js",
		paths.components + "color_themes/color_themes.factory.js",
		paths.components + "highstock_config/highstock_config.factory.js",
		paths.components + "highstock_adapter/highstock_adapter.factory.js",
		paths.components + "latisfactory/latisFactory.js"
        
	],
	unitTests: [
		paths.components + "**/*.spec.js"
		//, paths.components + "**/*.mock.js"
	],
	templates: [
		paths.components + "**/*.html"
	],
	css: [
		paths.components + "**/*.css"
	],
	testPage: [
		"./src/index.html",
		"./src/app/index.css",
		"./src/app/index.js",
        "./src/app/mockbackend.js",
		'./src/images/**/*',
		"./src/app/main/**/*.js",
		"./src/app/main/**/*",
        "./src/app/testDatasets/*.json"
	],
	all: [
		paths.components + "**/*.(js|html|css|json)",
		"!" + paths.components + "**/*.spec.js",
		"!" + paths.components + "**/*.mock.js"
	],
	images: [
		paths.src + "images/**/*"
	]
};

exports.cleanDirs = [
	paths.dist,
	paths.tmp
];

exports.deploy = {
	projectName: 'lasp-highstock',

	domain: 'ds-webapp-dev',
	adminProtocol: 'https',
	adminPort: '4848',
	ignoreCertificateErrors: true,
	target: 'dev',
	username: 'demo-deployer',
	password: 'JebediahKerman',
	displayPort: '28080',
	displayProtocol: 'http'

	// domain: 'localhost',
	// adminProtocol: 'http',
	// adminPort: '4848',
	// ignoreCertificateErrors: false,
	// target: undefined,
	// username: undefined,
	// password: undefined,
	// displayPort: '8080',
	// displayProtocol: 'http'
};
