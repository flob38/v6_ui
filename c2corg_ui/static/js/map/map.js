goog.provide('app.MapController');
goog.provide('app.mapDirective');
goog.provide('app.BiodivSportsModalController');

goog.require('app');
goog.require('app.utils');
goog.require('app.Url');
goog.require('app.Biodivsports');
goog.require('ngeo.Debounce');
goog.require('ngeo.Location');
/** @suppress {extraRequire} */
goog.require('ngeo.mapDirective');
goog.require('ol.Collection');
goog.require('ol.Feature');
goog.require('ol.Map');
goog.require('ol.View');
goog.require('ol.control.ScaleLine');
goog.require('ol.format.GeoJSON');
goog.require('ol.format.GPX');
goog.require('ol.geom.Point');
goog.require('ol.geom.MultiLineString');
goog.require('ol.interaction.DragAndDrop');
goog.require('ol.interaction.Draw');
goog.require('ol.interaction.Modify');
goog.require('ol.interaction.MouseWheelZoom');
/** @suppress {extraRequire} */
goog.require('ol.interaction.Select');
goog.require('ol.layer.Vector');
goog.require('ol.source.Vector');
goog.require('ol.style.Circle');
goog.require('ol.style.Fill');
goog.require('ol.style.Icon');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');
goog.require('ol.style.Text');
goog.require('app.map.simplify');
/** @suppress {extraRequire} */
goog.require('app.trustAsHtmlFilter');


/**
 * This directive is used to display a pre-configured map in v6_ui pages.
 *
 * @return {angular.Directive} The directive specs.
 * @ngInject
 */
app.mapDirective = function() {
  return {
    restrict: 'E',
    scope: {
      'edit': '=appMapEdit',
      'drawType': '@appMapDrawType',
      'disableWheel': '=appMapDisableWheel',
      'advancedSearch': '=appMapAdvancedSearch',
      'zoom': '@appMapZoom',
      'defaultMapFilter': '=appMapDefaultMapFilter',
      'featureCollection': '=appMapFeatureCollection',
      'showRecenterTools': '=appMapShowRecenterTools',
      'showBiodivsportsAreas': '=appMapShowBiodivsportsAreas',
      'biodivSportsActivities': '=appMapBiodivsportsActivities'
    },
    controller: 'AppMapController as mapCtrl',
    bindToController: true,
    templateUrl: '/static/partials/map/map.html'
  };
};

app.module.directive('appMap', app.mapDirective);


/**
 * @param {angular.Scope} $scope Directive scope.
 * @param {?GeoJSONFeatureCollection} mapFeatureCollection FeatureCollection of
 *    features to show on the map.
 * @param {ngeo.Location} ngeoLocation ngeo Location service.
 * @param {ngeo.Debounce} ngeoDebounce ngeo Debounce service.
 * @param {app.Url} appUrl URL service.
 * @param {app.Biodivsports} appBiodivsports service.
 * @param {app.Lang} appLang Lang service.
 * @param {ui.bootstrap.$modal} $uibModal modal from angular bootstrap
 * @param {string} imgPath Path to the image directory.
 * @constructor
 * @struct
 * @ngInject
 */
app.MapController = function($scope, mapFeatureCollection, ngeoLocation,
  ngeoDebounce, appUrl, appBiodivsports, appLang, $uibModal, imgPath) {

  /**
   * @type {number}
   * @export
   */
  this.zoom;

  /**
   * @type {angular.Scope}
   * @private
   */
  this.scope_ = $scope;

  /**
   * @type {string}
   * @private
   */
  this.imgPath_ = imgPath;

  /**
   * @type {?ol.layer.Vector}
   * @private
   */
  this.vectorLayer_ = null;

  /**
   * @type {Object.<string, ol.style.Icon>}
   */
  this.iconCache = {};

  /**
   * @type {Object.<string, ol.style.Style|Array.<ol.style.Style>>}
   */
  this.styleCache = {};

  /**
   * @type {Array<ol.Feature>}
   * @private
   */
  this.features_ = [];

  /**
   * @type {?ol.geom.GeometryType}
   * @export
   */
  this.drawType; // For Closure, comes from isolated scope.

  /**
   * @type {boolean}
   * @export
   */
  this.advancedSearch;

  /**
   * @type {boolean}
   * @export
   */
  this.edit;

  /**
   * @type {boolean}
   * @export
   */
  this.disableWheel;

  /**
   * @type {boolean}
   * @export
   */
  this.showRecenterTools;

  /**
   * @type {boolean}
   * @export
   */
  this.showBiodivsportsAreas;

  /**
   * @type {Array.<string>}
   * @export
   */
  this.biodivSportsActivities;

  /**
   * @type {boolean}
   * @export
   */
  this.defaultMapFilter;

  /**
   * @type {boolean}
   * @export
   */
  this.enableMapFilter = !!this.defaultMapFilter;

  /**
   * @type {?GeoJSONFeatureCollection}
   * @export
   */
  this.featureCollection;

  /**
   * @type {ngeo.Location}
   * @private
   */
  this.location_ = ngeoLocation;

  /**
   * @type {ol.format.GeoJSON}
   * @private
   */
  this.geojsonFormat_ = new ol.format.GeoJSON();

  /**
   * @type {?ol.Extent}
   * @private
   */
  this.initialExtent_ = null;

  /**
   * @type {?ol.Feature}
   * @private
   */
  this.initialFeature_ = null;

  /**
   * Remember the initial geometry so that the changes can be reset.
   * @type {?Object|undefined}
   * @private
   */
  this.initialGeometry_ = undefined;

  /**
   * @type {ol.interaction.Draw}
   * @private
   */
  this.draw_;

  /**
   * @type {boolean}
   * @private
   */
  this.isDrawing_ = false;

  /**
   * @type {?number|string}
   * @private
   */
  this.currentSelectedFeatureId_ = null;

  /**
   * @type {boolean}
   * @export
   */
  this.isFullscreen = false;

  /**
   * @type {boolean}
   * @private
   */
  this.ignoreExtentChange_ = false;

  /**
   * @type {app.Url}
   * @private
   */
  this.url_ = appUrl;

  /**
   * @type {app.Biodivsports}
   * @private
   */
  this.biodivSports_ = appBiodivsports;

  /**
   * @type {app.Lang}
   * @private
   */
  this.langService_ = appLang;

  /**
   * @type {ui.bootstrap.$modal} angular bootstrap modal
   * @private
   */
  this.modal_ = $uibModal;

  /**
   * @type {ol.Map}
   * @export
   */
  this.map = new ol.Map({
    interactions: ol.interaction.defaults({mouseWheelZoom: false}),
    controls: ol.control.defaults().extend([new ol.control.ScaleLine()]),
    view: new ol.View({
      center: ol.extent.getCenter(app.MapController.DEFAULT_EXTENT),
      zoom: app.MapController.DEFAULT_ZOOM
    })
  });

  /**
   * @type {ol.View}
   * @private
   */
  this.view_ = this.map.getView();

  // editing mode
  if (this.edit) {
    this.scope_.$root.$on('documentDataChange', this.handleEditModelChange_.bind(this));
    this.scope_.$root.$on('featuresUpload', this.handleFeaturesUpload_.bind(this));
    this.addTrackImporter_();
  }

  // advanced search mode
  if (this.advancedSearch) {
    this.scope_.$root.$on('resizeMap', ngeoDebounce(this.resizeMap_.bind(this), 300, true));

    if (this.location_.hasFragmentParam('bbox')) {
      this.enableMapFilter = true;
      const bbox = this.location_.getFragmentParam('bbox');
      const extent = bbox.split(',');
      if (extent.length == 4) {
        this.initialExtent_ = extent.map((x) => {
          return parseInt(x, 10);
        });
      }
    } else {
      this.ignoreExtentChange_ = app.utils.detectDocumentIdFilter(this.location_);
    }

    this.scope_.$root.$on('searchFeaturesChange', this.handleSearchChange_.bind(this));
    this.scope_.$root.$on('searchFilterClear', this.handleSearchClear_.bind(this));
    this.scope_.$root.$on('cardEnter', (event, id) => {
      this.toggleFeatureHighlight_(id, true);
    });
    this.scope_.$root.$on('cardLeave', (event, id) => {
      this.toggleFeatureHighlight_(id, false);
    });

    this.view_.on('propertychange', ngeoDebounce(
      this.handleMapSearchChange_.bind(this),
      500, /* invokeApply */ true
    ));

    this.scope_.$watch(() => {
      return this.enableMapFilter;
    }, this.handleMapFilterSwitchChange_.bind(this));
  }

  if (!this.disableWheel) {
    const mouseWheelZoomInteraction = new ol.interaction.MouseWheelZoom();
    this.map.addInteraction(mouseWheelZoomInteraction);
    app.utils.setupSmartScroll(mouseWheelZoomInteraction);
  }

  if (this.featureCollection || mapFeatureCollection) {
    this.features_ = this.geojsonFormat_.readFeatures(
      this.featureCollection || mapFeatureCollection);
  }

  // add the features interactions
  if (this.features_.length > 0 || this.advancedSearch) {
    this.getVectorLayer_().setStyle(this.createStyleFunction_());
    this.map.on('click', this.handleMapFeatureClick_.bind(this));
    this.map.on('pointermove', this.handleMapFeatureHover_.bind(this));
  }

  if (this.edit && this.drawType) {
    const vectorSource = this.getVectorLayer_().getSource();

    this.draw_ = new ol.interaction.Draw({
      source: vectorSource,
      type: this.drawType
    });
    this.draw_.on('drawstart', this.handleDrawStart_.bind(this));
    this.draw_.on('drawend', this.handleDrawEnd_.bind(this));
    this.map.addInteraction(this.draw_);

    this.map.once('postrender', () => {
      // add modify interaction after the map has been initialized
      const modify = new ol.interaction.Modify({
        features: vectorSource.getFeaturesCollection(),
        // the SHIFT key must be pressed to delete vertices, so
        // that new vertices can be drawn at the same position
        // of existing vertices
        deleteCondition: function(event) {
          return ol.events.condition.shiftKeyOnly(event) &&
            ol.events.condition.singleClick(event);
        }
      });
      modify.on('modifyend', this.handleModify_.bind(this));
      this.map.addInteraction(modify);
    });
  }

  // When the map is rendered:
  this.map.once('change:size', event => {
    if (this.features_.length > 0) {
      this.showFeatures_(this.features_, true);
    } else {
      const extent = this.initialExtent_ || app.MapController.DEFAULT_EXTENT;
      this.recenterOnExtent_(extent);
    }
    if (this.showBiodivsportsAreas) {
      let extent = this.view_.calculateExtent(this.map.getSize() || null);
      // get extent in WGS format
      extent = ol.proj.transformExtent(extent, ol.proj.get('EPSG:3857'), ol.proj.get('EPSG:4326'));
      this.biodivSports_.fetchData(extent, this.biodivSportsActivities).then(this.addBiodivsportsData_.bind(this));
    }
  });
};


/**
 * @const
 * @type {Array.<number>}
 */
app.MapController.DEFAULT_EXTENT = [-400000, 5200000, 1200000, 6000000];


/**
 * @const
 * @type {number}
 */
app.MapController.DEFAULT_ZOOM = 4;


/**
 * @const
 * @type {number}
 */
app.MapController.DEFAULT_POINT_ZOOM = 12;


/**
 * @param {Object} response Biodiv'sports request result.
 * @private
 */
app.MapController.prototype.addBiodivsportsData_ = function(response) {
  const results = response['data']['results'];
  const features = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    let geometry = result['geometry'];
    geometry = this.geojsonFormat_.readGeometry(geometry, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857'
    });
    const feature = new ol.Feature({
      geometry,
      'id': /** @type {number} */ (result['id']),
      'source': 'biodivsports',
      'title': /** @type {string} */ (result['name']),
      'description': /** @type {string} */ (result['description']),
      'info_url': /** @type {string} */ (result['info_url']),
      'kml_url': /** @type {string} */ (result['kml_url']),
      'period': /** @type {Array<boolean>} */ (result['period'])
    });
    feature.setId('biodiv_' + /** @type {number} */ (result['id']));
    features.push(feature);

  }
  this.getVectorLayer_().getSource().addFeatures(features);
  if (features.length) {
    this.scope_.$emit('foundBiodivsportAreas');
  }
};


/**
 * @param {ol.Extent} extent Extent to recenter to.
 * @param {olx.view.FitOptions=} options Options.
 * @private
 */
app.MapController.prototype.recenterOnExtent_ = function(extent, options) {
  const mapSize = this.map.getSize();
  if (!mapSize || !ol.extent.getWidth(extent) || !ol.extent.getHeight(extent)) {
    this.view_.setCenter(ol.extent.getCenter(extent));
    this.view_.setZoom(this.zoom || app.MapController.DEFAULT_POINT_ZOOM);
  } else {
    options = options || {};
    this.view_.fit(extent, mapSize, options);
  }
};


/**
 * @return {ol.layer.Vector} Vector layer.
 * @private
 */
app.MapController.prototype.getVectorLayer_ = function() {
  if (!this.vectorLayer_) {
    // The Modify interaction requires the vector source is created
    // with an ol.Collection.
    const features = new ol.Collection();
    this.vectorLayer_ = new ol.layer.Vector({
      source: new ol.source.Vector({features: features})
    });

    // Use vectorLayer.setMap(map) rather than map.addLayer(vectorLayer). This
    // makes the vector layer "unmanaged", meaning that it is always on top.
    this.vectorLayer_.setMap(this.map);
  }
  return this.vectorLayer_;
};


/**
 * @return {ol.StyleFunction}
 * @private
 */
app.MapController.prototype.createStyleFunction_ = function() {
  return (
    /**
     * @param {ol.Feature|ol.render.Feature} feature
     * @param {number} resolution
     * @return {ol.style.Style|Array.<ol.style.Style>}
     */
    function(feature, resolution) {
      const source = /** @type {string} */ (feature.get('source'));
      if (source === 'biodivsports') {
        return this.createBiodivsportsAreaStyle_(feature, resolution);
      } else if (source === 'c2c') {
        const module = /** @type {string} */ (feature.get('module'));
        switch (module) {
          case 'waypoints':
          case 'images':
          case 'profiles':
          case 'xreports':
            return this.createPointStyle_(feature, resolution);
          case 'routes':
          case 'outings':
            return this.advancedSearch ? this.createPointStyle_(feature, resolution) : this.createLineStyle_(feature, resolution);
          case 'areas':
            return this.createLineStyle_(feature, resolution);
          default: {
            return null;
          }
        }
      }
      return null;
    }).bind(this);
};


app.MapController.prototype.createBiodivsportsAreaStyle_ = function(feature, resolution) {
  const id = /** @type {number} */ (feature.get('id'));
  const highlight = /** @type {boolean} */ (!!feature.get('highlight'));
  const key = 'lines_biodivsports'  + (highlight ? ' _highlight' : '') + '_' + id;
  const opacityFactor = highlight ? 1.5 : 1;
  let style = this.styleCache[key];
  if (!style) {
    const stroke = new ol.style.Stroke({
      color: [51, 122, 183, 0.8 * opacityFactor],
      width: 1
    });
    const fill = new ol.style.Fill({
      color: [51, 122, 183, 0.4 * opacityFactor]
    });
    style = new ol.style.Style({
      text: this.createTextStyle_(feature, 'biodivsports', highlight),
      stroke,
      fill
    });
    this.styleCache[key] = style;
  }
  return style;
};

/**
 * @param {ol.Feature|ol.render.Feature} feature
 * @param {number} resolution
 * @return {ol.style.Style|Array.<ol.style.Style>}
 * @private
 */
app.MapController.prototype.createPointStyle_ = function(feature, resolution) {
  const module = feature.get('module');
  let path;
  let imgSize;
  let type = /** @type {string} */ (feature.get('module'));
  if (type === 'waypoints' && feature.get('type')) {
    type = /** @type {string} */ (feature.get('type'));
  }
  const id = /** @type {number} */ (feature.get('documentId'));
  const highlight = /** @type {boolean} */ (!!feature.get('highlight'));
  const scale = highlight ? 0.55 : 0.4;

  imgSize = highlight ? 22 : 16;
  switch (module) {
    case 'waypoints':
      path = '/documents/waypoints/' + type + '.svg';
      break;
    case 'images':
      imgSize = 0; // no circle for images
      path = '/documents/images.svg';
      break;
    case 'profiles':
      path = '/documents/profile.svg';
      break;
    default:
      path = '/documents/' + type + '.svg';
      break;
  }

  const key = type + scale + '_' + id;
  let styles = this.styleCache[key];
  if (!styles) {
    let iconKey = type + scale;
    if (type === 'outings') {
      // outing icon color depends on the condition_rating attribute
      iconKey += '_' + id;
    }
    let icon = this.iconCache[iconKey];
    if (!icon) {
      icon = new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
        scale: scale,
        color: this.getIconColor_(feature),
        src: this.imgPath_ + path
      }));
      this.iconCache[iconKey] = icon;
    }
    styles = [
      // render a transparent circle behind the actual icon so that selecting
      // is easier (the icons contain transparent areas that are not
      // selectable).
      new ol.style.Style({
        image: new ol.style.Circle({
          radius: imgSize,
          fill: new ol.style.Fill({
            color: 'rgba(255, 255, 255, 0.5)'
          }),
          stroke: new ol.style.Stroke({
            color: '#ddd',
            width: 2
          })
        })
      }),
      new ol.style.Style({
        image: icon,
        text: this.createTextStyle_(feature, type, highlight)
      })
    ];
    this.styleCache[key] = styles;
  }
  return styles;
};


/**
 * @param {ol.Feature|ol.render.Feature} feature
 * @param {number} resolution
 * @return {ol.style.Style|Array.<ol.style.Style>}
 * @private
 */
app.MapController.prototype.createLineStyle_ = function(feature, resolution) {
  const type = /** @type {string} */ (feature.get('module'));
  const highlight = /** @type {boolean} */ (feature.get('highlight'));
  const id = /** @type {number} */ (feature.get('documentId'));
  const key = 'lines' + (highlight ? ' _highlight' : '') + '_' + id;
  let style = this.styleCache[key];
  if (!style) {
    const stroke = new ol.style.Stroke({
      color: highlight ? 'red' : 'yellow',
      width: 3
    });
    style = new ol.style.Style({
      text: this.createTextStyle_(feature, type, highlight),
      stroke: stroke
    });
    this.styleCache[key] = style;
  }
  return style;
};


/**
 * @param {ol.Feature|ol.render.Feature} feature
 * @param {string} type
 * @param {boolean} highlight
 * @return {ol.style.Text|undefined}
 * @private
 */
app.MapController.prototype.createTextStyle_ = function(feature, type, highlight) {
  let text;
  if (highlight) { // on hover in list view
    let title = '';
    if (type === 'routes' && feature.get('title_prefix')) {
      title = feature.get('title_prefix') + ' : ';
    }
    if (type === 'biodivsports') {
      title = this.langService_.translate('Sensitive area:') + ' ';
    }
    title += feature.get('title');

    text = new ol.style.Text({
      text: app.utils.stringDivider(title, 30, '\n'),
      textAlign: 'left',
      offsetX: 20,
      font: '12px verdana,sans-serif',
      stroke: new ol.style.Stroke({
        color: 'white',
        width: 3
      }),
      fill: new ol.style.Fill({
        color: 'black'
      }),
      textBaseline: 'middle'
    });
  }
  return text;
};


/**
 * @param {ol.Feature|ol.render.Feature} feature
 * @return {string|undefined}
 * @private
 */
app.MapController.prototype.getIconColor_ = function(feature) {
  let color;
  if (feature.get('module') === 'outings') {
    switch (feature.get('condition_rating')) {
      case 'excellent':
        color = '#008000';
        break;
      case 'good':
        color = '#9ACD32';
        break;
      case 'average':
        color = '#FFFF00';
        break;
      case 'poor':
        color = '#FF0000';
        break;
      case 'awful':
        color = '#8B0000';
        break;
      default:
        // Usual icon orange
        color = '#FFAA45';
        break;
    }
  }
  return color;
};


/**
 * @param {Array.<ol.Feature>} features Features to show.
 * @param {boolean} recenter Whether or not to recenter on the features.
 * @private
 */
app.MapController.prototype.showFeatures_ = function(features, recenter) {
  const vectorLayer = this.getVectorLayer_();
  const source = vectorLayer.getSource();
  source.clear();

  if (!features.length) {
    if (recenter) {
      this.recenterOnExtent_(app.MapController.DEFAULT_EXTENT);
    }
    return;
  }

  features.forEach(feature => {
    const properties = feature.getProperties();
    if (properties['documentId']) {
      feature.setId(/** @type {number} */ (properties['documentId']));
    }
  });

  source.addFeatures(features);
  if (recenter) {
    this.recenterOnExtent_(source.getExtent(), {
      padding: [10, 10, 10, 10]
    });
  }
};


/**
 * @param {Object} event
 * @param {Object} data
 * @private
 */
app.MapController.prototype.handleEditModelChange_ = function(event, data) {
  if (this.initialGeometry_ === undefined) {
    this.initialGeometry_ = data['geometry'] ? angular.copy(data['geometry']) : null;
  }

  if (!('geometry' in data && data['geometry'])) {
    return;
  }
  const geomattr = this.drawType == 'Point' ? 'geom' : 'geom_detail';
  let geomstr = data['geometry'][geomattr];
  let geometry;
  if (geomstr) {
    geometry = this.geojsonFormat_.readGeometry(geomstr);
    const features = [new ol.Feature(geometry)];
    this.showFeatures_(features, true);
  } else if (this.drawType != 'Point') {
    // recenter the map on the default point geometry for routes or outings
    // with no geom_detail
    geomstr = data['geometry']['geom'];
    geometry = /** @type {ol.geom.Point} */ (this.geojsonFormat_.readGeometry(geomstr));
    this.view_.setCenter(geometry.getCoordinates());
    this.view_.setZoom(this.zoom || app.MapController.DEFAULT_POINT_ZOOM);
  }
};


/**
 * @param {Object} event
 * @param {Array.<ol.Feature>} features Uploaded features.
 * @private
 */
app.MapController.prototype.handleFeaturesUpload_ = function(event, features) {
  features = features.filter(app.utils.isLineFeature);
  features = this.validateFeatures_(features);
  features.forEach(this.simplifyFeature_);
  this.showFeatures_(features, true);
  this.scope_.$root.$emit('mapFeaturesChange', features);
};


/**
 *
 * @param {Array.<ol.Feature>} features - invalid features that have to be checked
 * @returns {Array.<ol.Feature>} features - this geometry is valid
 * @private
 */
app.MapController.prototype.validateFeatures_ = function(features) {
  for (let i = 0; i < features.length; i++) {
    const geom = /** @type{ol.geom.Geometry} */ (features[i].getGeometry());

    if (geom instanceof ol.geom.MultiLineString) {
      const multiLineString = /** @type{ol.geom.MultiLineString} */ (geom);
      const lineStrings = multiLineString.getLineStrings();

      for (let j = 0; j < lineStrings.length; j++) {
        if (lineStrings[j].getCoordinates().length === 1) {
          lineStrings.splice(j, 1);
        }
      }

      const newMs = new ol.geom.MultiLineString([]);
      newMs.setLineStrings(lineStrings);
      features[i].setGeometry(newMs);
    }
  }
  return features;
};


/**
 * @param {ol.interaction.Draw.Event} event
 * @private
 */
app.MapController.prototype.handleDrawStart_ = function(event) {
  this.isDrawing_ = true;
  const feature = event.feature;
  // Only one feature can be drawn at a time
  const source = this.getVectorLayer_().getSource();
  source.getFeatures().forEach((f) => {
    if (f !== feature) {
      source.removeFeature(f);
    }
  });
};


/**
 * @param {ol.interaction.Draw.Event} event
 * @private
 */
app.MapController.prototype.handleDrawEnd_ = function(event) {
  this.isDrawing_ = false;
  this.scope_.$root.$emit('mapFeaturesChange', [event.feature]);
  this.scope_.$applyAsync();
};


/**
 * @param {ol.interaction.Modify.Event} event
 * @private
 */
app.MapController.prototype.handleModify_ = function(event) {
  const features = event.features.getArray();
  this.scope_.$root.$emit('mapFeaturesChange', features);
};


/**
 * @param {Object} event
 * @param {Array.<ol.Feature>} features Search results features.
 * @param {number} total Total number of results.
 * @param {boolean} recenter
 * @private
 */
app.MapController.prototype.handleSearchChange_ = function(event, features, total, recenter) {
  // show the search results on the map but don't change the map filter
  // if recentering on search results, the extent change must not trigger
  // a new search request.
  this.ignoreExtentChange_ = recenter;
  recenter = recenter || !this.enableMapFilter;
  this.showFeatures_(features, recenter);
};


/**
 * @param {Object} event
 * @private
 */
app.MapController.prototype.handleSearchClear_ = function(event) {
  if (!this.location_.hasFragmentParam('bbox')) {
    const mapSize = this.map.getSize();
    if (mapSize) {
      let extent = this.view_.calculateExtent(mapSize);
      extent = extent.map(Math.floor);
      this.location_.updateFragmentParams({
        'bbox': extent.join(',')
      });
    }
  }
};


/**
 * @param {number|string} id Feature id.
 * @param {boolean} highlight Whether the feature must be highlighted.
 * @private
 */
app.MapController.prototype.toggleFeatureHighlight_ = function(id, highlight) {
  const feature = this.getVectorLayer_().getSource().getFeatureById(id);
  if (feature) {
    this.currentSelectedFeatureId_ = highlight ? id : null;
    feature.set('highlight', highlight);
  }
};


/**
 * @private
 */
app.MapController.prototype.handleMapSearchChange_ = function() {
  if (!this.enableMapFilter) {
    return;
  }
  if (this.initialExtent_) {
    // The map has just been set with an extent passed as permalink
    // => no need to set it again in the URL.
    this.initialExtent_ = null;
    this.scope_.$root.$emit('searchFilterChange');
  } else {
    const mapSize = this.map.getSize();
    if (mapSize) {
      if (this.ignoreExtentChange_) {
        this.ignoreExtentChange_ = false;
        return;
      }
      let extent = this.view_.calculateExtent(mapSize);
      extent = extent.map(Math.floor);
      this.location_.updateFragmentParams({
        'bbox': extent.join(',')
      });
      this.location_.deleteFragmentParam('offset');
      this.scope_.$root.$emit('searchFilterChange');
    }
  }
};


/**
 * @param {ol.MapBrowserEvent} event
 * @private
 */
app.MapController.prototype.handleMapFeatureClick_ = function(event) {
  const feature = this.map.forEachFeatureAtPixel(event.pixel, feature => feature, this, function(layer) {
    // test only features from the current vector layer
    return layer === this.getVectorLayer_();
  }, this);
  if (feature) {
    const source = feature.get('source');
    if (source === 'c2c') {
      const module = feature.get('module');
      const id = feature.get('documentId');
      const locale = {
        'lang': feature.get('lang'),
        'title': feature.get('title')
      };
      if (module === 'routes' && feature.get('title_prefix')) {
        locale['title_prefix'] = feature.get('title_prefix');
      }
      window.location.href = this.url_.buildDocumentUrl(
        module, id, /** @type {appx.DocumentLocale} */ (locale));
    } else if (source === 'biodivsports') {
      this.modal_.open({
        animation: true,
        size: 'sm',
        templateUrl: '/static/partials/map/biodivsportsinfo.html',
        controller: 'AppBiodivSportsModalController',
        controllerAs: 'modalCtrl',
        resolve: {
          'title': () => feature.get('title'),
          'description': () => feature.get('description'),
          'infoUrl': () => feature.get('info_url'),
          'kmlUrl': () => feature.get('kml_url'),
          'period': () => feature.get('period')
        }
      });
    }
  }
};


/**
 * @param {ol.MapBrowserEvent} event
 * @private
 */
app.MapController.prototype.handleMapFeatureHover_ = function(event) {
  if (event.dragging) {
    return;
  }
  const pixel = this.map.getEventPixel(event.originalEvent);
  const hit = this.map.hasFeatureAtPixel(pixel, function(layer) {
    // test only features from the current vector layer
    return layer === this.getVectorLayer_();
  }, this);
  this.map.getTarget().style.cursor = hit ? 'pointer' : '';

  if (hit) {
    const feature = this.map.forEachFeatureAtPixel(pixel, feature => feature, this, function(layer) {
      // test only features from the current vector layer
      return layer === this.getVectorLayer_();
    }, this);
    if (this.currentSelectedFeatureId_) {
      // reset any feature that was highlighted previously
      this.toggleFeatureHighlight_(this.currentSelectedFeatureId_, false);
    }
    const id = /** @type {number|string} */ (feature.getId());
    this.toggleFeatureHighlight_(id, true);
    this.scope_.$root.$emit('mapFeatureHover', id);
  } else if (this.currentSelectedFeatureId_) {
    // if a feature was highlighted but no longer hovered
    this.toggleFeatureHighlight_(this.currentSelectedFeatureId_, false);
    this.scope_.$root.$emit('mapFeatureHover', null);
  }
};


/**
 * @param {boolean} enabled Whether the map filter is enabled or not.
 * @param {boolean} was_enabled Former value.
 * @private
 */
app.MapController.prototype.handleMapFilterSwitchChange_ = function(
  enabled, was_enabled) {
  if (enabled === was_enabled) {
    // initial setting of the filter switch
    // * do nothing if the filter is enabled by default
    //   (request is triggered later)
    // * trigger a request if disabled by default
    //   (no request is triggered later)
    if (!enabled) {
      this.scope_.$root.$emit('searchFilterChange');
    }
    return;
  }
  if (enabled) {
    this.handleMapSearchChange_();
  } else {
    this.location_.deleteFragmentParam('bbox');
    this.location_.deleteFragmentParam('offset');
    this.scope_.$root.$emit('searchFilterChange');
  }
};


/**
 * @private
 */
app.MapController.prototype.addTrackImporter_ = function() {
  const dragAndDropInteraction = new ol.interaction.DragAndDrop({
    formatConstructors: [
      ol.format.GPX
    ]
  });
  dragAndDropInteraction.on('addfeatures', (event) => {
    const features = event.features;
    if (features.length) {
      this.handleFeaturesUpload_(null, features);
    }
  });
  this.map.addInteraction(dragAndDropInteraction);
};


/**
 * @param {ol.Feature} feature Feature to process.
 * @return {ol.Feature}
 * @private
 */
app.MapController.prototype.simplifyFeature_ = function(feature) {
  let geometry = feature.getGeometry();
  goog.asserts.assert(geometry !== undefined);
  // simplify geometry with a tolerance of 20 meters
  geometry = app.map.simplify.simplify(geometry, 20);
  feature.setGeometry(geometry);
  return feature;
};


/**
 * @export
 */
app.MapController.prototype.toggleFullscreen = function() {
  this.isFullscreen = !this.isFullscreen;
  setTimeout(() => {
    this.scope_.$apply();
    this.map.renderSync();
    this.map.updateSize();
  }, 0);

};

/**
 * @export
 */
app.MapController.prototype.canReset = function() {
  return this.edit;
};


/**
 * @export
 */
app.MapController.prototype.resetFeature = function() {
  if (this.isDrawing_) {
    this.draw_.finishDrawing();
  }
  const source = this.getVectorLayer_().getSource();
  source.clear();

  this.scope_.$root.$emit('mapFeaturesReset', angular.copy(this.initialGeometry_));
};


/**
 * @export
 */
app.MapController.prototype.canDelete = function() {
  return this.edit && this.getVectorLayer_().getSource().getFeatures().length > 0 &&
      this.initialGeometry_ && this.initialGeometry_['geom'];
};


/**
 * @export
 */
app.MapController.prototype.deleteFeature = function() {
  if (this.isDrawing_) {
    this.draw_.finishDrawing();
  }
  const source = this.getVectorLayer_().getSource();
  source.clear();
  this.scope_.$root.$emit('mapFeaturesChange', []);
};


/**
 * @private
 */
app.MapController.prototype.resizeMap_ = function() {
  this.map.renderSync();
  this.map.updateSize();
};


app.module.controller('AppMapController', app.MapController);


/**
 * We have to use a secondary controller for the modal so that we can inject
 * uibModalInstance which is not available from the first level controller.
 * @param {Object} $uibModalInstance modal from angular bootstrap
 * @param {string} title title
 * @param {string|null} description description
 * @param {string} infoUrl link for more information
 * @param {string} kmlUrl link to area KML
 * @param {Array<boolean>} period sensitive month
 * @constructor
 * @ngInject
 */
app.BiodivSportsModalController = function($uibModalInstance, title, description, infoUrl, kmlUrl, period) {

  /**
   * @type {Object} $uibModalInstance angular bootstrap
   * @private
   */
  this.modalInstance_ = $uibModalInstance;

  /**
   * @type {string} title
   * @export
   */
  this.title = title;

  /**
   * @type {string|null} description
   * @export
   */
  this.description = description;

  /**
   * @type {string} infoUrl
   * @export
   */
  this.infoUrl = infoUrl;

  /**
   * @type {string} kmlUrl
   * @export
   */
  this.kmlUrl = kmlUrl;

  /**
   * @type {Array<string>} sensitive months
   * @export
   */
  this.months = [];

  for (let i = 0; i < period.length; i++) {
    if (period[i]) {
      this.months.push(window.moment().month(i).format('MMMM'));
    }
  }
};

/**
 * @export
 */
app.BiodivSportsModalController.prototype.close = function() {
  this.modalInstance_.close();
};

app.module.controller('AppBiodivSportsModalController', app.BiodivSportsModalController);

