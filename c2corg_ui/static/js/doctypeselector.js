goog.provide('app.DoctypeSelectorController');
goog.provide('app.doctypeSelectorDirective');

goog.require('app');


/**
 * Directive managing the user mailinglists.
 * @return {angular.Directive} The directive specs.
 * @ngInject
 */
app.doctypeSelectorDirective = function() {
  return {
    restrict: 'A',
    controller: 'appDoctypeSelectorController',
    controllerAs: 'doctypeCtrl'
  };
};


app.module.directive('appDoctypeSelector', app.doctypeSelectorDirective);


/**
 * @param {ngeo.Location} ngeoLocation ngeo Location service.
 * @constructor
 * @ngInject
 * @export
 */
app.DoctypeSelectorController = function(ngeoLocation) {

  /**
   * @type {ngeo.Location}
   * @private
   */
  this.ngeoLocation_ = ngeoLocation;
};


/**
 * @param {string} path
 * @export
 */
app.DoctypeSelectorController.prototype.redirectTo = function(path) {
  window.location = path;
};


app.module.controller('appDoctypeSelectorController', app.DoctypeSelectorController);
